<template>
  <div class="gallery-section">
    <n-space justify="space-between" align="center" class="gallery-header">
      <n-h3>🖼️ 图片列表 ({{ images.length }})</n-h3>
      <n-button text type="primary" @click="$emit('refresh')">
        刷新
      </n-button>
    </n-space>

    <n-spin :show="loading">
      <n-empty v-if="images.length === 0 && !loading" description="暂无图片" />

      <n-collapse v-else default-expanded-names="group-0">
        <n-collapse-item
          v-for="(group, index) in groupedImages"
          :key="group.date"
          :name="`group-${index}`"
          :title="`${group.date} (${group.items.length} 张)`"
        >
          <n-grid :cols="2" :x-gap="16" :y-gap="16" responsive="screen">
            <n-grid-item v-for="image in group.items" :key="image.path">
              <ImageCard :image="image" @delete="$emit('delete', $event)" />
            </n-grid-item>
          </n-grid>
        </n-collapse-item>
      </n-collapse>
    </n-spin>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ImageCard from './ImageCard.vue'

const props = defineProps({
  images: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['delete', 'refresh'])

// 按 date (YYYY/MM/DD) 分组，最新的在前面
const groupedImages = computed(() => {
  const map = new Map()
  for (const img of props.images) {
    const date = img.date || '未知日期'
    if (!map.has(date)) {
      map.set(date, [])
    }
    map.get(date).push(img)
  }

  // 按日期降序排列
  const dates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a))
  return dates.map(date => ({
    date,
    items: map.get(date),
  }))
})
</script>

<style scoped>
.gallery-section {
  max-width: 1200px;
  margin: 0 auto;
}

.gallery-header {
  margin-bottom: 16px;
}
</style>
