# Image Host - 图床管理模板

基于 **Vue 3 + Naive UI + Cloudflare Worker + GitHub API** 的轻量图床解决方案。

## 特性

- 🚀 **零服务器成本**：Cloudflare Worker 免费额度 + GitHub 免费仓库
- 🔒 **Token 不暴露**：GitHub Token 仅存在于 Worker Secrets
- 📅 **自动日期分目录**：`images/YYYY/MM/DD/` 存储，规避 GitHub Contents API 单目录 1000 文件限制
- 🌲 **Trees API 列表**：递归查询整棵文件树，支持数万张图片
- 🧵 **Web Worker 转码**：前端后台线程做 Base64，不阻塞 UI
- 🌍 **jsDelivr CDN**：图片访问自动走 CDN，国内可用
- 🗑️ **删除确认**：二次确认 + GitHub API 安全删除

## 架构

```
用户浏览器 → Vue 3 前端 → Cloudflare Worker → GitHub API
                ↓               ↓
           Web Worker      鉴权 + 透传
           (Base64 转码)   (零重计算)
```

## 为什么 Worker 不做 Base64？

Cloudflare Worker **免费版仅保证 10ms CPU time**，而 Base64 编码是 CPU 密集型操作（500KB 文件约需 50ms）。

因此本模板将 Base64 转码放在**前端 Web Worker** 中执行，Worker 仅做 JSON 透传，CPU 消耗趋近于 0。

## 快速开始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

### 1. 准备 GitHub 仓库

1. 新建一个 GitHub 仓库（如 `my-images`），设为 **Public**
2. 生成 Fine-grained Personal Access Token：
   - 地址：https://github.com/settings/tokens?type=beta
   - Repository access：选择你的图床仓库
   - Permissions：**Contents** → `Read and write`

### 2. 部署 Cloudflare Worker

```bash
cd worker
npm install
```

编辑 `wrangler.toml`：

```toml
[vars]
GITHUB_OWNER = "你的GitHub用户名"
GITHUB_REPO = "你的仓库名"
ACCESS_PASSWORD = ""   # 可选，设置后前端需填写密码
```

配置 Secrets（敏感信息）：

```bash
npx wrangler secret put GITHUB_TOKEN
# 输入你的 GitHub Token
```

部署：

```bash
npx wrangler deploy
```

部署成功后，记下 Worker URL（如 `https://image-host-worker.xxx.workers.dev`）。

### 3. 部署前端

```bash
cd frontend
npm install
```

开发调试：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

将 `dist/` 目录部署到任意静态托管：
- [Vercel](https://vercel.com)
- [Netlify](https://netlify.com)
- [Cloudflare Pages](https://pages.cloudflare.com)
- [GitHub Pages](https://pages.github.com)

### 4. 使用

打开前端页面，填入 Worker URL 和访问密码（如果设置了），即可：
- 拖拽或点击上传图片
- 按日期分组浏览图片
- 复制 CDN 直链
- 删除图片

## API 说明

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/images` | GET | 使用 Trees API 递归获取所有图片 |
| `/api/upload` | POST | 上传图片（body 含前端转好的 base64） |
| `/api/delete` | DELETE | 删除图片（body 含 path） |

请求头（可选）：
- `X-Access-Password`: 若 Worker 设置了密码，则必填

## 目录结构

```
image-host-template/
├── frontend/              # Vue 3 前端
│   ├── src/
│   │   ├── api/          # 请求封装
│   │   ├── components/   # Vue 组件
│   │   ├── workers/      # Web Worker
│   │   ├── utils/        # 工具函数
│   │   └── views/        # 页面
│   └── package.json
├── worker/                # Cloudflare Worker
│   ├── src/index.js      # Worker 入口
│   ├── wrangler.toml     # 配置
│   └── package.json
└── README.md
```

## 限制说明

| 项目 | 限制 |
|------|------|
| 单张图片大小 | 100MB（GitHub API 上限） |
| 单目录文件数 | 通过日期分目录规避了 1000 限制 |
| 仓库总文件数 | Trees API 支持 100,000 条目 |
| Worker 每日请求 | 100,000 次（免费版） |
| 图片直链缓存 | jsDelivr 有缓存，删除后可能仍短暂可访问 |

## 安全建议

1. **Token 最小权限**：使用 Fine-grained PAT，仅授权图床仓库的 Contents 读写
2. **设置访问密码**：在 `wrangler.toml` 配置 `ACCESS_PASSWORD`，防止他人滥用 Worker
3. **仓库设为 Public**：避免 Token 需要 `repo` 全权限，Fine-grained `Contents` 即可
4. **不要在前端暴露 wrangler.toml**：该文件不含 Token，但含仓库名，建议也保密

## 常见问题

**Q: 上传大图片时前端卡顿？**  
A: 本模板已使用 Web Worker 做 Base64 转码，理论上不会阻塞 UI。如果仍感觉卡，可能是网络传输阶段，请检查网络状况。

**Q: 删除图片后 CDN 链接还能访问？**  
A: jsDelivr 有缓存机制，删除后可能短暂可访问（通常数分钟到数小时），这是 CDN 正常行为。

**Q: 能否支持多仓库？**  
A: 当前版本 Worker 绑定单一仓库。如需多仓库，可部署多个 Worker 实例，或修改 Worker 代码支持动态仓库名（但需注意安全风险）。

## License

MIT
