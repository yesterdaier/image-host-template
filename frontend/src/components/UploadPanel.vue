<template>
  <n-card title="📤 图片上传" class="upload-card">
    <n-space vertical>
      <div
        class="drop-zone"
        :class="{ dragging: isDragging }"
        @dragenter.prevent="handleDragEnter"
        @dragleave.prevent="handleDragLeave"
        @dragover.prevent
        @drop.prevent="handleDrop"
        @click="fileInput?.click()"
      >
        <input
          ref="fileInput"
          type="file"
          multiple
          accept="image/*"
          style="display: none"
          @change="handleFileSelect"
        />
        <n-icon :component="CloudUploadOutline" size="48" depth="3" />
        <n-p>点击或拖拽图片到此处上传</n-p>
        <n-p depth="3">支持多选，单张建议不超过 20MB</n-p>
      </div>

      <div v-if="pendingFiles.length > 0" class="pending-list">
        <n-h3>待上传 ({{ pendingFiles.length }})</n-h3>
        <n-space vertical>
          <n-card
            v-for="(item, index) in pendingFiles"
            :key="item.id"
            size="small"
            :title="item.file.name"
          >
            <n-space justify="space-between" align="center">
              <n-space>
                <img :src="item.preview" class="preview-thumb" />
                <n-space vertical>
                  <span>{{ formatSize(item.file.size) }}</span>
                  <n-tag v-if="item.status === 'waiting'" size="small">等待</n-tag>
                  <n-tag v-else-if="item.status === 'converting'" type="warning" size="small">转码中</n-tag>
                  <n-tag v-else-if="item.status === 'uploading'" type="info" size="small">上传中</n-tag>
                  <n-tag v-else-if="item.status === 'done'" type="success" size="small">完成</n-tag>
                  <n-tag v-else-if="item.status === 'error'" type="error" size="small">失败</n-tag>
                </n-space>
              </n-space>
              <n-button text type="error" @click.stop="removePending(index)">
                移除
              </n-button>
            </n-space>
          </n-card>
        </n-space>

        <n-space>
          <n-button
            type="primary"
            :loading="uploading"
            :disabled="pendingFiles.length === 0"
            @click="startUpload"
          >
            开始上传 ({{ pendingFiles.filter(f => f.status === 'waiting').length }})
          </n-button>
          <n-button @click="clearPending">清空</n-button>
        </n-space>
      </div>

      <n-progress
        v-if="uploading"
        type="line"
        :percentage="uploadProgress"
        :indicator-placement="'inside'"
        :height="24"
      />
    </n-space>
  </n-card>
</template>

<script setup>
import { ref, onUnmounted } from 'vue' // 修复 6.1：引入 onUnmounted
import { useMessage } from 'naive-ui'
import { CloudUploadOutline } from '@vicons/ionicons5'
import { api } from '../api/github.js'

const emit = defineEmits(['upload-success'])
const message = useMessage()

const fileInput = ref(null)
const isDragging = ref(false)
const dragCounter = ref(0) // 修复 2.1：增加拖拽计数器
const pendingFiles = ref([])
const uploading = ref(false)
const uploadProgress = ref(0)

// Web Worker 实例
let worker = null
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/base64.worker.js', import.meta.url))
  }
  return worker
}

// 修复 6.1：组件卸载时清理 Worker 资源
onUnmounted(() => {
  if (worker) {
    worker.terminate()
    worker = null
  }
})

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const id = generateId()
    const w = getWorker()

    function onMessage(e) {
      if (e.data.id !== id) return
      w.removeEventListener('message', onMessage)
      if (e.data.success) {
        resolve(e.data.base64)
      } else {
        reject(new Error(e.data.error))
      }
    }

    w.addEventListener('message', onMessage)
    w.postMessage({ file, id })
  })
}

function addFiles(fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith('image/')) {
      message.warning(`${file.name} 不是图片，已跳过`)
      continue
    }
    if (file.size > 100 * 1024 * 1024) {
      message.warning(`${file.name} 超过 100MB，已跳过`)
      continue
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      pendingFiles.value.push({
        id: generateId(),
        file,
        preview: e.target.result,
        status: 'waiting',
      })
    }
    reader.readAsDataURL(file)
  }
}

function handleFileSelect(e) {
  addFiles(e.target.files)
  e.target.value = ''
}

// 修复 2.1：拖拽事件处理逻辑
function handleDragEnter(e) {
  e.preventDefault()
  dragCounter.value++
  isDragging.value = true
}

function handleDragLeave(e) {
  e.preventDefault()
  dragCounter.value--
  if (dragCounter.value === 0) {
    isDragging.value = false
  }
}

function handleDrop(e) {
  e.preventDefault()
  dragCounter.value = 0
  isDragging.value = false
  addFiles(e.dataTransfer.files)
}

function removePending(index) {
  pendingFiles.value.splice(index, 1)
}

function clearPending() {
  pendingFiles.value = []
  uploadProgress.value = 0
}

/**
 * 修复 4.1：引入并发控制，提升上传效率
 * 修复 7.1：优化文件名正则，支持中文文件名
 */
async function startUpload() {
  const waiting = pendingFiles.value.filter(f => f.status === 'waiting')
  if (waiting.length === 0) return

  uploading.value = true
  uploadProgress.value = 0

  const total = waiting.length
  let completed = 0
  const CONCURRENCY = 3 // 限制并发数为 3

  async function uploadOne(item) {
    try {
      item.status = 'converting'
      const base64 = await fileToBase64(item.file)

      item.status = 'uploading'
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      const ts = Date.now()
      
      // 修复 7.1：只过滤系统非法字符，保留中文
      const safeName = item.file.name.replace(/[\\/*?:"<>|]/g, '_')
      const path = `images/${y}/${m}/${d}/${ts}_${safeName}`

      await api.upload(path, base64, item.file.name)
      item.status = 'done'
    } catch (err) {
      item.status = 'error'
      item.error = err.message
      message.error(`${item.file.name} 上传失败: ${err.message}`)
    } finally {
      completed++
      uploadProgress.value = Math.round((completed / total) * 100)
    }
  }

  // 并发队列控制逻辑
  const queue = [...waiting]
  const running = []

  while (queue.length > 0 || running.length > 0) {
    while (running.length < CONCURRENCY && queue.length > 0) {
      const item = queue.shift()
      const promise = uploadOne(item).finally(() => {
        const idx = running.indexOf(promise)
        if (idx > -1) running.splice(idx, 1)
      })
      running.push(promise)
    }
    if (running.length > 0) {
      await Promise.race(running)
    }
  }

  uploading.value = false
  if (completed > 0) {
    message.success(`上传完成：${completed} 个成功`)
    emit('upload-success')
  }
}
</script>

<style scoped>
.upload-card {
  max-width: 800px;
  margin: 0 auto;
}

.drop-zone {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafafa;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: #18a058;
  background: #f0faf5;
}

.preview-thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

.pending-list {
  margin-top: 16px;
}
</style>