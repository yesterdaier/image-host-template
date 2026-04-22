// Cloudflare Worker - GitHub Image Host Proxy
// 核心原则：零重计算，仅做鉴权 + 透传 + 轻量 JSON 过滤

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Access-Password, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// 校验访问密码（如果配置了）
function checkPassword(request, env) {
  if (!env.ACCESS_PASSWORD) return true;
  const password = request.headers.get('X-Access-Password');
  return password === env.ACCESS_PASSWORD;
}

/**
 * 修复 3.1：GitHub API 基础请求封装
 * 处理 GitHub 返回非 JSON (如 502/503 HTML) 的情况
 */
async function githubFetch(path, options, env) {
  const url = `https://api.github.com${path}`;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'image-host-worker',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // 修复点：如果不是 JSON，捕获错误并构造友好的错误信息
      data = {
        message: `GitHub API returned non-JSON response (HTTP ${response.status}). Body: ${text.slice(0, 200)}`
      };
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || `GitHub API error: ${response.status}`);
  }
  return data;
}

// 支持的图片扩展名
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'
]);

function isImageFile(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 密码校验
    if (!checkPassword(request, env)) {
      return errorResponse('Access password invalid', 403);
    }

    const url = new URL(request.url);
    const { GITHUB_OWNER, GITHUB_REPO } = env;

    try {
      // ==================== GET /api/images ====================
      if (url.pathname === '/api/images' && request.method === 'GET') {
        const refData = await githubFetch(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/main`,
          { method: 'GET' },
          env
        ).catch(() =>
          githubFetch(
            `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/master`,
            { method: 'GET' },
            env
          )
        );

        const commitSha = refData.object.sha;
        const commitData = await githubFetch(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${commitSha}`,
          { method: 'GET' },
          env
        );
        const treeSha = commitData.tree.sha;

        const treeData = await githubFetch(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${treeSha}?recursive=1`,
          { method: 'GET' },
          env
        );

        const images = (treeData.tree || [])
          .filter(item =>
            item.type === 'blob' &&
            item.path.startsWith('images/') &&
            isImageFile(item.path)
          )
          .map(item => {
            const parts = item.path.split('/');
            const dateFolder = parts.slice(1, 4).join('/');
            const filename = parts[parts.length - 1];
            return {
              path: item.path,
              filename,
              size: item.size,
              date: dateFolder,
              sha: item.sha,
              url: `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${commitSha}/${item.path}`,
              rawUrl: `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${commitSha}/${item.path}`,
            };
          })
          .sort((a, b) => b.path.localeCompare(a.path));

        return jsonResponse({ images, truncated: treeData.truncated || false });
      }

      // ==================== POST /api/upload ====================
      if (url.pathname === '/api/upload' && request.method === 'POST') {
        const body = await request.json();
        const { path, content, message } = body;

        if (!path || !content) {
          return errorResponse('Missing path or content');
        }

        const data = await githubFetch(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: message || `Upload ${path}`,
              content,
            }),
          },
          env
        );

        return jsonResponse({
          success: true,
          path: data.content?.path,
          sha: data.content?.sha,
          size: data.content?.size,
          html_url: data.content?.html_url,
        });
      }

      // ==================== DELETE /api/delete ====================
      if (url.pathname === '/api/delete' && request.method === 'DELETE') {
        const body = await request.json();
        const { path } = body;

        if (!path) {
          return errorResponse('Missing path');
        }

        const fileData = await githubFetch(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
          { method: 'GET' },
          env
        );

        const sha = Array.isArray(fileData) ? fileData[0]?.sha : fileData.sha;
        if (!sha) {
          return errorResponse('File not found', 404);
        }

        await githubFetch(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `Delete ${path}`,
              sha,
            }),
          },
          env
        );

        return jsonResponse({ success: true, path });
      }

      return errorResponse('Not found', 404);
    } catch (err) {
      console.error('Worker error:', err.message);
      return errorResponse(err.message, 500);
    }
  },
};