import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Vite 默认会把整个 public/ 原样复制到 dist/。
 * 全息模型是运行时下载资源，不能随站点一起部署；其余 public 资源保持原有行为。
 */
function readRequestBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 128 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const OPENLUX_MODEL = 'gpt-5.6-terra';

function openLuxApiKeyPath(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'xiaoman', 'Blog', 'cookie', 'openlux.txt');
}

function readOpenLuxApiKey(): string {
  try {
    return readFileSync(openLuxApiKeyPath(), 'utf8').replace(/^\uFEFF/, '').trim();
  } catch {
    return '';
  }
}

function openLuxTranslationProxy(): Plugin {
  return {
    name: 'openlux-translation-proxy',
    configureServer(server) {
      server.middlewares.use('/api/openlux/status', (req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ available: Boolean(readOpenLuxApiKey()) }));
      });

      server.middlewares.use('/api/openlux/translate', async (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        try {
          const body = JSON.parse(await readRequestBody(req)) as {
            apiKey?: string;
            segments?: Array<{ id?: string; text?: string }>;
            sourceLanguage?: string;
            targetLanguage?: string;
          };
          const requestApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
          if (requestApiKey.length > 512) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'API Key 格式无效。' }));
            return;
          }
          const apiKey = requestApiKey || readOpenLuxApiKey();
          if (!apiKey) {
            res.statusCode = 503;
            res.end(JSON.stringify({
              error: '没有找到 OpenLux API Key。请在本机 openlux.txt 文件中配置，或在界面中临时输入。',
            }));
            return;
          }

          const segments = (body.segments || [])
            .slice(0, 32)
            .map((item, index) => ({ id: String(item.id ?? index), text: item.text?.trim() || '' }))
            .filter((item) => item.text);
          if (!segments.length) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: '没有可翻译的文本。' }));
            return;
          }
          if (segments.reduce((sum, item) => sum + item.text.length, 0) > 12000) {
            res.statusCode = 413;
            res.end(JSON.stringify({ error: '单次翻译文本过长，请缩小批次。' }));
            return;
          }

          const sourceLanguage = body.sourceLanguage === 'auto' ? '自动识别' : body.sourceLanguage || '英文';
          const targetLanguage = body.targetLanguage || '简体中文';
          const upstream = await fetch('https://api.openlux.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: OPENLUX_MODEL,
              temperature: 0.1,
              messages: [
                {
                  role: 'system',
                  content: [
                    '你是一名严谨的学术论文翻译助手。',
                    `把${sourceLanguage}文本翻译成${targetLanguage}。`,
                    '输入是 JSON 数组，每项有 id 和 text。只输出合法 JSON 数组，不要 Markdown 代码块、解释或额外文字。',
                    '输出每项必须保留原 id，并把译文放在 text 字段中；项目数量和顺序必须与输入完全一致。',
                    '保留段落换行、编号、公式、LaTeX、变量名、引用标记、URL、图表编号和专有名词；不要翻译代码、公式和引用键。',
                    '遇到已经是中文的内容，原样保留。',
                  ].join('\n'),
                },
                { role: 'user', content: JSON.stringify(segments) },
              ],
            }),
          });
          const upstreamText = await upstream.text();
          let upstreamData: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
          try {
            upstreamData = JSON.parse(upstreamText);
          } catch {
            upstreamData = {};
          }
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.end(JSON.stringify({
              error: upstreamData.error?.message || `OpenLux AI 返回 HTTP ${upstream.status}`,
            }));
            return;
          }
          const content = upstreamData.choices?.[0]?.message?.content?.trim() || '';
          const jsonText = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
          let translations: Array<{ id: string; text: string }>;
          try {
            translations = JSON.parse(jsonText);
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'OpenLux AI 返回的批量译文格式无效。' }));
            return;
          }
          if (!Array.isArray(translations)) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'OpenLux AI 没有返回有效译文。' }));
            return;
          }
          res.statusCode = 200;
          res.end(JSON.stringify({ translations }));
        } catch (error) {
          res.statusCode = 502;
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'OpenLux AI 代理请求失败。',
          }));
        }
      });
    },
  };
}

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
    openLuxTranslationProxy(),
    copyPublicAssetsWithoutHologramModel(),

  ],
  // 生产构建使用上面的过滤复制；开发环境仍由 Vite 正常提供整个 public/，
  // 这样不会影响现有文章、字体和洛天依资源的本地预览。
  publicDir: mode === 'production' ? false : 'public',
  // 生产环境使用 '/blog/'（GitHub Pages 仓库路径），开发环境使用 '/'
  base: mode === 'production' ? '/blog/' : '/',
}))
