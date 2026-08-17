import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // 全息舞台依赖的 onnxruntime wasm 二进制（.mjs 代理 + .wasm）自托管在 public/transformers-wasm/。
    // 生产构建直接把 public/ 拷贝到 dist/ 正常使用；但 Vite dev server 会拦截对 public 内
    // .mjs?import 的请求并报 500，这里用静态中间件绕过转换逻辑直接返回文件。
    {
      name: 'serve-transformers-wasm',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/transformers-wasm', (req, res, next) => {
          const name = (req.url ?? '').split('?')[0].replace(/^\/+/, '')
          const file = path.join(__dirname, 'public', 'transformers-wasm', name)
          if (existsSync(file)) {
            const type = name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'
            res.setHeader('Content-Type', type)
            res.setHeader('Cache-Control', 'no-cache')
            createReadStream(file).pipe(res)
          } else {
            next()
          }
        })
      },
    },
  ],
  // 生产环境使用 '/blog/'（GitHub Pages 仓库路径），开发环境使用 '/'
  base: mode === 'production' ? '/blog/' : '/',
}))
