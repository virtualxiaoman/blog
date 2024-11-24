import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
declare const process: {
  env: {
    NODE_ENV: 'development' | 'production' | 'test';
  };
};

export default defineConfig({
  plugins: [vue()],
  base: process.env.NODE_ENV === 'production' ? '/blog/' : '/', // 生产环境使用 '/blog/'，开发环境使用 '/'
  // base: './',  // 设置为相对路径
  // // base: '/blog/', // 替换为你的仓库名
})

