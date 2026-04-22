<template>
  <div class="image-card">
    <div class="image-wrapper">
      <img :src="image.url" :alt="image.filename" loading="lazy" @click="openRaw" />
    </div>
    <div class="info">
      <n-tooltip>
        <template #trigger>
          <div class="filename">{{ image.filename }}</div>
        </template>
        {{ image.path }}
      </n-tooltip>
      <div class="meta">
        <n-tag size="small" type="info">{{ formatSize(image.size) }}</n-tag>
      </div>
    </div>
    <n-space justify="center" size="small" class="actions">
      <n-tooltip>
        <template #trigger>
          <n-button text type="primary" @click="copyUrl(image.url)">
            <n-icon :component="LinkOutline" size="18" />
          </n-button>
        </template>
        复制 CDN 链接
      </n-tooltip>
      <n-tooltip>
        <template #trigger>
          <n-button text type="info" @click="openRaw">
            <n-icon :component="OpenOutline" size="18" />
          </n-button>
        </template>
        新标签页打开
      </n-tooltip>
      <n-tooltip>
        <template #trigger>
          <n-button text type="error" @click="handleDelete">
            <n-icon :component="TrashOutline" size="18" />
          </n-button>
        </template>
        删除
      </n-tooltip>
    </n-space>
  </div>
</template>

<script setup>
import { useMessage, useDialog } from 'naive-ui'
import { LinkOutline, OpenOutline, TrashOutline } from '@vicons/ionicons5'

const props = defineProps({
  image: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['delete'])
const message = useMessage()
const dialog = useDialog()

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

async function copyUrl(url) {
  try {
    await navigator.clipboard.writeText(url)
    message.success('链接已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

function openRaw() {
  window.open(props.image.rawUrl || props.image.url, '_blank')
}

function handleDelete() {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除 ${props.image.filename} 吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      emit('delete', props.image.path)
    },
  })
}
</script>

<style scoped>
.image-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s;
}

.image-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.image-wrapper {
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #f5f5f5;
  cursor: pointer;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.image-wrapper img:hover {
  transform: scale(1.05);
}

.info {
  padding: 8px 12px;
}

.filename {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  margin-top: 4px;
}

.actions {
  padding: 0 12px 12px;
}
</style>
