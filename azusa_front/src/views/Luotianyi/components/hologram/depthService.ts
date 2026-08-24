/**
 * 浏览器端深度估计服务。
 *
 * 用 Transformers.js（@huggingface/transformers v4）在浏览器内跑
 * Depth Anything V2 small（q8 ONNX，Apache-2.0）：
 * - 模型不随站点构建产物发布，而是在用户第一次使用全息功能时从模型仓库下载。
 *   Transformers.js 会使用浏览器缓存，二次访问通常不需要重新下载。
 * - WebGPU 优先（约 1~2 秒），不可用时降级 WASM（更慢）。WASM 二进制仅在运行时
 *   从 onnxruntime-web 的 CDN 下载，不进入站点构建产物；jsDelivr / Fastly jsDelivr /
 *   unpkg 按顺序尝试。
 * - 输出已插值到输入图尺寸的 Float32 深度（近大远小），归一化到 [0,1] 并做轻量平滑。
 *
 * 全部懒加载：本模块被 `import()` 时才拉取 three/transformers 相关代码。
 */

/** 进度事件：模型下载 / 推理阶段 */
export interface DepthProgressEvent {
  status: string;
  /** 0~100 */
  progress: number;
  file?: string;
}

export type DepthProgressCallback = (ev: DepthProgressEvent) => void;

/** 深度估计结果：与缩放宽高后的图片同尺寸 */
export interface DepthResult {
  width: number;
  height: number;
  /** 缩放宽高后的 RGBA 像素数据（含透明通道） */
  rgba: Uint8ClampedArray;
  /** 归一化深度 [0,1]，1=最近；已做轻量平滑便于 POM 稳定 */
  depth: Float32Array;
}

/** 解析运行目标：WebGPU 可用则优先（速度快一个量级），否则 WASM */
async function resolveDevice(): Promise<'webgpu' | 'wasm'> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
  if (gpu?.requestAdapter) {
    try {
      if (await gpu.requestAdapter()) return 'webgpu';
    } catch {
      // 适配器请求失败则走 WASM
    }
  }
  return 'wasm';
}

/**
 * 模型仓库 ID。模型权重是运行时资源，不能通过 import 或 public/ 同站点打包。
 * 如需使用镜像，可通过 VITE_HOLOGRAM_MODEL_ID / VITE_HOLOGRAM_REMOTE_HOST 配置。
 */
const MODEL_ID = import.meta.env.VITE_HOLOGRAM_MODEL_ID || 'onnx-community/depth-anything-v2-small';
const REMOTE_HOST = import.meta.env.VITE_HOLOGRAM_REMOTE_HOST;

// 与 package-lock.json 中的 onnxruntime-web 版本保持一致，避免 CDN 拉到不兼容的二进制。
const ONNX_RUNTIME_VERSION = '1.26.0-dev.20260416-b7804b056c';
const WASM_CDN_ROOTS = [
  `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_VERSION}/dist/`,
  `https://fastly.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_VERSION}/dist/`,
  `https://unpkg.com/onnxruntime-web@${ONNX_RUNTIME_VERSION}/dist/`,
];

type WasmPaths = { mjs: string; wasm: string };
let estimatorPromise: Promise<unknown> | null = null;
let deviceUsed: 'webgpu' | 'wasm' | null = null;
let wasmPathsPromise: Promise<WasmPaths> | null = null;
let runtimeReady = false;

/** 懒加载并缓存 depth-estimation pipeline 实例（同一 device 复用缓存） */
async function getEstimator(
  onProgress: DepthProgressCallback,
  device: 'webgpu' | 'wasm',
): Promise<any> {
  if (!estimatorPromise) {
    estimatorPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      // 不从 public/models/ 读取：该目录中的 ONNX 权重不能进入 dist，否则会让部署包过大。
      // 这里的模型请求只会在用户确认下载，或第一次实际使用全息功能时发起。
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      if (REMOTE_HOST) {
        env.remoteHost = REMOTE_HOST;
      }
      if (device === 'wasm') {
        // 通过多个原始 CDN 探测可用性，实际 WASM 仍由 ONNX Runtime 按需下载。
        // 注意：env.backends.onnx.wasm 是 ONNX env 的共享引用，必须原地赋值才会生效。
        env.backends.onnx.wasm!.wasmPaths = await resolveWasmPaths();
      }
      return pipeline('depth-estimation', MODEL_ID, {
        device,
        dtype: 'q8',
        progress_callback: (p: { status?: string; progress?: number; file?: string }) => {
          onProgress({
            status: p.status ?? 'progress',
            progress: p.progress ?? 0,
            file: p.file ?? '',
          });
        },
      });
    })()
      .then((estimator) => {
        runtimeReady = true;
        return estimator;
      })
      .catch((err) => {
        runtimeReady = false;
        estimatorPromise = null;
        throw err;
      });
  }
  return estimatorPromise;
}

/**
 * 预下载并初始化全息运行时（模型 + WASM 后端）。不执行推理。
 * 组件可用它实现“确认后下载”；如果用户跳过确认，第一次使用时仍会自动调用。
 */
export async function prepareDepthRuntime(onProgress: DepthProgressCallback): Promise<void> {
  if (deviceUsed === null) {
    deviceUsed = await resolveDevice();
  }
  try {
    await getEstimator(onProgress, deviceUsed);
  } catch (err) {
    if (deviceUsed === 'webgpu') {
      deviceUsed = 'wasm';
      runtimeReady = false;
      estimatorPromise = null;
      onProgress({ status: 'fallback', progress: 0 });
      await getEstimator(onProgress, deviceUsed);
      return;
    }
    runtimeReady = false;
    estimatorPromise = null;
    throw err;
  }
}

export function isDepthRuntimeReady(): boolean {
  return runtimeReady;
}

async function resolveWasmPaths(): Promise<WasmPaths> {
  if (!wasmPathsPromise) {
    wasmPathsPromise = (async () => {
      const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|Android/i.test(navigator.userAgent);
      const fileName = isSafari ? 'ort-wasm-simd-threaded' : 'ort-wasm-simd-threaded.asyncify';
      let lastError: unknown = null;
      for (const root of WASM_CDN_ROOTS) {
        const wasm = `${root}${fileName}.wasm`;
        const mjs = `${root}${fileName}.mjs`;
        try {
          const [wasmResponse, mjsResponse] = await Promise.all([
            fetch(wasm, { method: 'HEAD', mode: 'cors' }),
            fetch(mjs, { method: 'HEAD', mode: 'cors' }),
          ]);
          if (wasmResponse.ok && mjsResponse.ok) {
            return { mjs, wasm };
          }
          lastError = new Error(`WASM HTTP ${wasmResponse.status}, MJS HTTP ${mjsResponse.status}`);
        } catch (err) {
          lastError = err;
        }
      }
      throw new Error(`WASM 运行时 CDN 均不可用${lastError ? `：${String(lastError)}` : ''}`);
    })().catch((err) => {
      wasmPathsPromise = null;
      throw err;
    });
  }
  return wasmPathsPromise;
}

/**
 * 对一张已缩放好的画布做深度估计。
 * WebGPU 推理失败时自动回退 WASM 重试一次（部分显卡/驱动对某些 op 支持不全）。
 * @param canvas 已缩放到合适尺寸（长边 <= ~1536）的画布，与图片同内容
 * @param onProgress 进度回调（模型下载/推理/回退）
 */
export async function estimateDepth(
  canvas: HTMLCanvasElement,
  onProgress: DepthProgressCallback,
): Promise<DepthResult> {
  if (deviceUsed === null) {
    deviceUsed = await resolveDevice();
  }
  try {
    return await runEstimate(canvas, onProgress, deviceUsed);
  } catch (err) {
    if (deviceUsed === 'webgpu') {
      // WebGPU 不可用/失败：清缓存换 WASM 重试
      deviceUsed = 'wasm';
      runtimeReady = false;
      estimatorPromise = null;
      onProgress({ status: 'fallback', progress: 0 });
      return await runEstimate(canvas, onProgress, 'wasm');
    }
    throw err;
  }
}

async function runEstimate(
  canvas: HTMLCanvasElement,
  onProgress: DepthProgressCallback,
  device: 'webgpu' | 'wasm',
): Promise<DepthResult> {
  const estimator = await getEstimator(onProgress, device);
  onProgress({ status: 'inference', progress: 0 });

  const { width, height } = canvas;
  // 推理前先读取原图像素：避免任何潜在的画布改动影响结果
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const image = ctx.getImageData(0, 0, width, height);

  const out = await estimator(canvas);
  const pred = out.predicted_depth;

  // pred.dims 为 [H, W]，data 为 Float32Array（深度已由 pipeline 插值到输入图尺寸）
  const raw: Float32Array = pred.data;

  const depth = normalizeDepth(raw);
  blurDepth(depth, width, height, 2);

  return { width, height, rgba: image.data, depth };
}

/** 按百分位做 min-max 归一化，避免极值拉爆对比度；输出 [0,1]，1=最近 */
function normalizeDepth(raw: Float32Array, loPct = 0.02, hiPct = 0.98): Float32Array {
  const n = raw.length;
  const out = new Float32Array(n);
  if (n === 0) return out;

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = raw[i];
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  if (range <= 1e-9) {
    out.fill(0.5);
    return out;
  }

  // 直方图求百分位
  const bins = 512;
  const hist = new Float32Array(bins);
  for (let i = 0; i < n; i++) {
    const v = raw[i];
    if (!Number.isFinite(v)) continue;
    const b = Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / range) * bins)));
    hist[b]++;
  }
  const total = n;
  let lo = min;
  let hi = max;
  let acc = 0;
  for (let b = 0; b < bins; b++) {
    acc += hist[b];
    if (acc >= total * loPct) {
      lo = min + (b / bins) * range;
      break;
    }
  }
  acc = 0;
  for (let b = 0; b < bins; b++) {
    acc += hist[b];
    if (acc >= total * hiPct) {
      hi = min + (b / bins) * range;
      break;
    }
  }
  const span = Math.max(1e-6, hi - lo);
  for (let i = 0; i < n; i++) {
    const v = raw[i];
    if (!Number.isFinite(v)) {
      out[i] = 0;
    } else {
      out[i] = Math.min(1, Math.max(0, (v - lo) / span));
    }
  }
  return out;
}

/** 分离式 box blur（直接窗口求均值，边界按 clamp 处理） */
function boxBlur1D(src: Float32Array, w: number, h: number, horizontal: boolean, r: number): Float32Array {
  const dst = new Float32Array(src.length);
  const len = horizontal ? w : h;
  const other = horizontal ? h : w;
  const stride = horizontal ? 1 : w;
  const win = r * 2 + 1;
  for (let row = 0; row < other; row++) {
    const base = horizontal ? row * w : row;
    for (let col = 0; col < len; col++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const idx = Math.min(len - 1, Math.max(0, col + k));
        sum += src[base + idx * stride];
      }
      dst[base + col * stride] = sum / win;
    }
  }
  return dst;
}

function blurDepth(depth: Float32Array, w: number, h: number, radius: number): void {
  let d = boxBlur1D(depth, w, h, true, radius);
  d = boxBlur1D(d, w, h, false, radius);
  depth.set(d);
}
