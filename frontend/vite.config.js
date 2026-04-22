import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // 添加这一行，注意两边都有斜杠 /
  base: '/image-host-template/', 
  
  plugins: [vue()],
  server: {
    port: 5173,
  },
})