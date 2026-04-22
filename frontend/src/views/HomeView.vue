<template>
  <div class="home">
    <div class="header">
      <n-h1>📷 图床管理</n-h1>
      <n-p>基于 GitHub + Cloudflare Worker 的轻量图床</n-p>
    </div>

    <!-- 配置面板 -->
    <n-card title="⚙️ 服务配置" class="config-card">
      <n-space vertical>
        <n-input
          v-model:value="config.workerUrl"
          placeholder="Worker URL，例如：https://image-host-worker.xxx.workers.dev"
          @blur="saveConfig"
        >
          <template #prefix>Worker</template>
        </n-input>
        <n-input
          v-model:value="config.password"
          type="password"
          placeholder="访问密码（若 Worker 未设置可留空）"
          show-password-on="mousedown"
          @blur="saveConfig"
        >
          <template #prefix>密码</template>
        </n-input>
        <n-space>
          <n-button type="primary" @click="loadImages" :loading="loading">
            刷新列表
          </n-button>
          <n-button @click="clearConfig">清除配置</n-button>
        </n-space>
      </n-space>
    </n-card>

    <n-divider />

    <!-- 上传组件 -->
    <UploadPanel @upload-success="loadImages" />

    <n-divider />

    <!-- 图片列表 -->
    <ImageGallery
      :images="images"
      :loading="loading"
      @delete="handleDelete"
      @refresh="loadImages"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { getConfig, setConfig, clearConfig as clearStoredConfig } from '../utils/config.js'
import { api } from '../api/github.js'
import UploadPanel from '../components/UploadPanel.vue'
import ImageGallery from '../components/ImageGallery.vue'

const message = useMessage()

const config = ref({
  workerUrl: '',
  password: '',
})

const images = ref([])
const loading = ref(false)

function loadStoredConfig() {
  const cfg = getConfig()
  config.value = {
    workerUrl: cfg.workerUrl || '',
    password: cfg.password || '',
  }
}

function saveConfig() {
  setConfig({
    workerUrl: config.value.workerUrl.trim(),
    password: config.value.password,
  })
}

function clearConfig() {
  clearStoredConfig()
  config.value = { workerUrl: '', password: '' }
  message.success('配置已清除')
}

async function loadImages() {
  if (!config.value.workerUrl) {
    message.warning('请先填写 Worker URL')
    return
  }

  loading.value = true
  try {
    const data = await api.getImages()
    images.value = data.images || []
    if (data.truncated) {
      message.warning('仓库文件过多，部分数据可能被截断')
    }
  } catch (err) {
    message.error('获取图片列表失败：' + (err.response?.data?.error || err.message))
  } finally {
    loading.value = false
  }
}

async function handleDelete(path) {
  try {
    await api.deleteFile(path)
    message.success('删除成功')
    await loadImages()
  } catch (err) {
    message.error('删除失败：' + (err.response?.data?.error || err.message))
  }
}

onMounted(() => {
  loadStoredConfig()
})
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.header {
  text-align: center;
  margin-bottom: 24px;
}

.config-card {
  max-width: 600px;
  margin: 0 auto;
}
</style>
