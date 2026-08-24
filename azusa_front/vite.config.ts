import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Vite 默认会把整个 public/ 原样复制到 dist/。
 * 全息模型是运行时下载资源，不能随站点一起部署；其余 public 资源保持原有行为。
 */
function copyPublicAssetsWithoutHologramModel() {
  return {
    name: 'copy-public-assets-without-hologram-model',
    apply: 'build' as const,
    generateBundle(_options: unknown, bundle: Record<string, { type: string }>) {
      // Transformers.js/ONNX Runtime 会让 Vite 额外产出一份 asyncify WASM。
      // 运行时已改用 CDN，因此删除这个构建副本，避免与旧的 public 文件重复。
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'asset' && /^assets\/ort-wasm-simd-threaded\./.test(fileName)) {
          delete bundle[fileName];
        }
      }

      const publicRoot = path.join(__dirname, 'public')

      const emitDirectory = (directory: string) => {
        for (const entry of readdirSync(directory)) {
          const absolutePath = path.join(directory, entry)
          const relativePath = path.relative(publicRoot, absolutePath).replaceAll('\\', '/')

          // 保留源文件，但不要把模型权重写入构建产物。
          if (
            relativePath === 'models' ||
            relativePath.startsWith('models/') ||
            relativePath === 'transformers-wasm' ||
            relativePath.startsWith('transformers-wasm/')
          ) {
            continue
          }

          if (statSync(absolutePath).isDirectory()) {
            emitDirectory(absolutePath)
          } else {
            this.emitFile({
              type: 'asset',
              fileName: relativePath,
              source: readFileSync(absolutePath),
            })
          }
        }
      }

      emitDirectory(publicRoot)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    copyPublicAssetsWithoutHologramModel(),

  ],
  // 生产构建使用上面的过滤复制；开发环境仍由 Vite 正常提供整个 public/，
  // 这样不会影响现有文章、字体和洛天依资源的本地预览。
  publicDir: mode === 'production' ? false : 'public',
  // 生产环境使用 '/blog/'（GitHub Pages 仓库路径），开发环境使用 '/'
  base: mode === 'production' ? '/blog/' : '/',
}))
