import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  // 生产环境使用 '/blog/'（GitHub Pages 仓库路径），开发环境使用 '/'
  base: mode === 'production' ? '/blog/' : '/',
}))
