<template>
  <div class="holo-section">
    <!-- 图片展示区（占满可用高度） -->
    <div
      class="holo-stage"
      :class="{ 'holo-stage--image': phase === 'loading' || phase === 'active' }"
      @dragover.prevent="onDragOver"
      @drop.prevent="onDrop"
    >
      <canvas ref="canvasRef" class="holo-canvas" aria-label="全息投影画布" />

      <!-- 运行时资源下载提示：默认只提示，不会在用户选择前发起下载 -->
      <aside v-if="downloadNoticeState !== 'hidden'" class="holo-download-notice" aria-live="polite">
        <template v-if="downloadNoticeState === 'prompt'">
          <strong class="holo-download-title">全息功能需要下载运行文件</strong>
          <p class="holo-download-text">首次使用需要下载模型和运行组件，之后会由浏览器缓存。</p>
          <div class="holo-download-actions">
            <button type="button" class="holo-btn holo-download-confirm" @click="confirmRuntimeDownload">
              确定下载
            </button>
            <button type="button" class="holo-btn holo-btn-ghost" @click="cancelRuntimeDownload">
              取消
            </button>
          </div>
        </template>
        <template v-else-if="downloadNoticeState === 'downloading'">
          <strong class="holo-download-title">正在下载运行文件…</strong>
          <p class="holo-download-text">{{ downloadNoticeText }}</p>
          <div class="holo-progress holo-download-progress">
            <div class="holo-progress-bar" :style="{ width: downloadProgress + '%' }" />
          </div>
          <span class="holo-download-percent">{{ Math.round(downloadProgress) }}%</span>
        </template>
        <template v-else-if="downloadNoticeState === 'done'">
          <strong class="holo-download-title">下载完毕</strong>
          <p class="holo-download-text">运行文件已准备好，可以开始使用全息功能。</p>
        </template>
        <template v-else>
          <strong class="holo-download-title holo-download-error">下载失败</strong>
          <p class="holo-download-text">{{ downloadNoticeText }}</p>
          <button type="button" class="holo-btn holo-download-confirm" @click="confirmRuntimeDownload">
            重试下载
          </button>
        </template>
      </aside>

      <!-- 默认舞台的氛围粒子；选图后只保留图片解析出的全息效果。 -->
      <div v-if="phase === 'idle'" class="holo-particles" aria-hidden="true">
        <span
          v-for="(p, i) in particles"
          :key="i"
          class="holo-particle"
          :style="{
            left: p.left + '%',
            bottom: p.bottom + '%',
            width: p.size + 'px',
            height: p.size + 'px',
            opacity: p.opacity,
            animationDelay: p.delay + 's',
            animationDuration: p.duration + 's',
          }"
        />
      </div>

      <!-- 上传区 -->
      <button
        v-if="phase === 'idle'"
        type="button"
        class="holo-upload"
        role="button"
        tabindex="0"
        @click="openPicker"
        @keydown.enter.prevent="openPicker"
        @keydown.space.prevent="openPicker"
      >
        <span class="holo-upload-icon" aria-hidden="true">＋</span>
        <span class="holo-upload-main">点击或拖拽图片到这里</span>
        <span class="holo-upload-sub">在浏览器本地完成深度分析，支持 JPG / PNG / WebP</span>
      </button>

      <!-- 加载中 -->
      <div v-if="phase === 'loading'" class="holo-overlay" aria-live="polite">
        <div class="holo-spinner" aria-hidden="true" />
        <p class="holo-status">{{ loadingStatus }}</p>
        <div class="holo-progress">
          <div class="holo-progress-bar" :style="{ width: loadingProgress + '%' }" />
        </div>
        <p v-if="showFallbackNotice" class="holo-notice">当前设备无 WebGPU，已切换兼容模式（推理会慢一些）</p>
      </div>

      <!-- 错误 -->
      <div v-if="phase === 'error'" class="holo-overlay">
        <p class="holo-error">{{ errorMessage }}</p>
        <div class="holo-actions">
          <button type="button" class="holo-btn" @click="openPicker">重试</button>
          <button type="button" class="holo-btn holo-btn-ghost" @click="resetStage">返回</button>
        </div>
      </div>
    </div>

    <!-- 宽屏时位于展示区之外的左右空白处，不覆盖全息画面。 -->
    <aside v-if="phase === 'active'" class="holo-panel-left">
      <p class="holo-hint">移动指针 / 触摸滑动</p>
      <button type="button" class="holo-btn holo-change-image" @click="openPicker">更换图片</button>
    </aside>
    <aside v-if="phase === 'active'" class="holo-controls" aria-label="全息效果调节">
      <label class="holo-control" title="控制全息画面的视差幅度">
        <span>视差</span>
        <input v-model.number="parallaxStrength" type="range" min="0" max="0.65" step="0.01" />
      </label>
      <label class="holo-control" title="控制扫描线强度">
        <span>扫描线</span>
        <input v-model.number="scanlineStrength" type="range" min="0" max="1" step="0.01" />
      </label>
      <label class="holo-control" title="控制全息边缘的辉光强度">
        <span>辉光</span>
        <input v-model.number="glowStrength" type="range" min="0" max="1" step="0.01" />
      </label>
      <label class="holo-control" title="控制全息画面的不透明度">
        <span>透明</span>
        <input v-model.number="opacityStrength" type="range" min="0.5" max="1" step="0.01" />
      </label>
      <label class="holo-control" title="调整 RGB 色差效果；设为 0 可关闭色差">
        <span>色彩</span>
        <input v-model.number="chromaStrength" type="range" min="0" max="1" step="0.01" aria-label="色彩调整强度" />
      </label>
      <label class="holo-control" title="1 为原始饱和度；小于 1 降低，大于 1 增强">
        <span>饱和度</span>
        <input v-model.number="saturationStrength" type="range" min="0" max="2" step="0.01" />
      </label>
      <label class="holo-control" title="向左偏冷，向右偏暖">
        <span>色温</span>
        <input v-model.number="temperatureStrength" type="range" min="-1" max="1" step="0.01" />
      </label>
      <label class="holo-control" title="向左降低亮度，向右提高亮度">
        <span>亮度</span>
        <input v-model.number="brightnessStrength" type="range" min="-1" max="1" step="0.01" />
      </label>
      <label class="holo-control" title="调整整体颜色的色相">
        <span>色相</span>
        <input v-model.number="hueStrength" type="range" min="-180" max="180" step="1" />
      </label>
      <button type="button" class="holo-btn holo-btn-ghost" @click="resetEffects">重置设置</button>
    </aside>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="holo-file-input"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import {
  estimateDepth,
  isDepthRuntimeReady,
  prepareDepthRuntime,
  type DepthProgressEvent,
} from '../components/hologram/depthService';
import { HologramRenderer } from '../components/hologram/HologramRenderer';

type Phase = 'idle' | 'loading' | 'active' | 'error';

const phase = ref<Phase>('idle');
const loadingStatus = ref('');
const loadingProgress = ref(0);
const errorMessage = ref('');
const showFallbackNotice = ref(false);

type DownloadNoticeState = 'prompt' | 'downloading' | 'done' | 'hidden' | 'error';
const DOWNLOAD_PROMPT_STORAGE_KEY = 'azusa:hologram-runtime-download-prompt-v1';

function hasHandledDownloadPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DOWNLOAD_PROMPT_STORAGE_KEY) === 'handled';
  } catch {
    return false;
  }
}

function markDownloadPromptHandled(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DOWNLOAD_PROMPT_STORAGE_KEY, 'handled');
  } catch {
    // 隐私模式或禁用存储时不影响全息功能本身。
  }
}

const downloadNoticeState = ref<DownloadNoticeState>(hasHandledDownloadPrompt() ? 'hidden' : 'prompt');
const downloadProgress = ref(0);
const downloadNoticeText = ref('');

const canvasRef = ref<HTMLCanvasElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

// 控制条状态
const parallaxStrength = ref(0.45);
const glowStrength = ref(0.6);
const opacityStrength = ref(0.97);
const scanlineStrength = ref(0.2);
// 1 = 保持当前全息色差效果，0 = 完全关闭 RGB 色彩偏移。
const chromaStrength = ref(1);
const saturationStrength = ref(1);
const temperatureStrength = ref(0);
const brightnessStrength = ref(0);
const hueStrength = ref(0);
const MAX_CHROMA = 0.0035;

let renderer: HologramRenderer | null = null;
let disposed = false;
let runtimeDownloadPromise: Promise<void> | null = null;
let downloadNoticeTimer: ReturnType<typeof setTimeout> | null = null;

/** 上浮粒子的静态配置（黄金角散布） */
const particles = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 137.508) % 100,
  bottom: 6 + ((i * 29) % 28),
  size: 2 + (i % 4),
  opacity: 0.25 + ((i * 7) % 5) / 12,
  delay: (i * 0.7) % 6,
  duration: 4 + (i % 5),
}));

onBeforeUnmount(() => {
  disposed = true;
  renderer?.dispose();
  renderer = null;
  if (downloadNoticeTimer) clearTimeout(downloadNoticeTimer);
});

watch(
  [
    parallaxStrength,
    glowStrength,
    opacityStrength,
    scanlineStrength,
    chromaStrength,
    saturationStrength,
    temperatureStrength,
    brightnessStrength,
    hueStrength,
  ],
  () => {
    if (renderer && phase.value === 'active') {
      renderer.setOptions({
        pointerStrength: mapParallax(parallaxStrength.value),
        maxParallax: mapParallax(parallaxStrength.value) * 1.15,
        glow: glowStrength.value * 1.2,
        opacity: opacityStrength.value,
        scanline: scanlineStrength.value * 0.3,
        chroma: chromaStrength.value * MAX_CHROMA,
        saturation: saturationStrength.value,
        temperature: temperatureStrength.value,
        brightness: brightnessStrength.value,
        hue: hueStrength.value,
      });
    }
  },
);

/** 视差强度：滑块 0~0.65 → 指针全幅位移 0.02~0.085（实际视差幅度，非钳制值） */
function mapParallax(v: number): number {
  return 0.02 + v * 0.1;
}

// ---------- 运行时资源下载 ----------

function confirmRuntimeDownload(): void {
  markDownloadPromptHandled();
  void startRuntimeDownload();
}

function cancelRuntimeDownload(): void {
  markDownloadPromptHandled();
  if (downloadNoticeState.value === 'prompt') {
    downloadNoticeState.value = 'hidden';
  }
}

function startRuntimeDownload(): Promise<void> {
  if (isDepthRuntimeReady()) {
    showDownloadFinished();
    return Promise.resolve();
  }
  if (runtimeDownloadPromise) return runtimeDownloadPromise;

  downloadNoticeState.value = 'downloading';
  downloadProgress.value = 0;
  downloadNoticeText.value = '正在准备下载地址…';
  runtimeDownloadPromise = prepareDepthRuntime(onRuntimeDownloadProgress)
    .then(() => {
      if (!disposed) showDownloadFinished();
    })
    .catch((err) => {
      runtimeDownloadPromise = null;
      if (!disposed) {
        downloadNoticeState.value = 'error';
        downloadNoticeText.value = err instanceof Error ? err.message : '请检查网络后重试';
      }
      throw err;
    });
  // 这里不让“确定下载”按钮触发未处理的 Promise rejection；真正使用时仍会再次抛出错误。
  void runtimeDownloadPromise.catch(() => undefined);
  return runtimeDownloadPromise;
}

function showDownloadFinished(): void {
  if (downloadNoticeTimer) clearTimeout(downloadNoticeTimer);
  downloadProgress.value = 100;
  downloadNoticeState.value = 'done';
  downloadNoticeText.value = '下载完毕';
  downloadNoticeTimer = setTimeout(() => {
    if (!disposed) downloadNoticeState.value = 'hidden';
  }, 5000);
}

function onRuntimeDownloadProgress(ev: DepthProgressEvent): void {
  if (disposed) return;
  if (ev.status === 'fallback') {
    downloadNoticeText.value = '正在切换兼容模式…';
    return;
  }
  if (ev.status === 'inference') return;
  if (ev.status === 'initiate' || ev.status === 'download' || ev.status === 'progress') {
    downloadNoticeText.value = ev.file ? `正在下载 ${ev.file}…` : '正在下载模型和运行组件…';
    downloadProgress.value = Math.max(0, Math.min(99, ev.progress || 0));
  } else if (ev.status === 'ready' || ev.status === 'done') {
    downloadNoticeText.value = '正在完成初始化…';
  }
}

// ---------- 图片输入 ----------

function openPicker(): void {
  fileInputRef.value?.click();
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  void processFile(file);
}

function onDragOver(): void {
  /* preventDefault 已在模板内联处理，避免浏览器打开图片 */
}

function onDrop(e: DragEvent): void {
  const file = e.dataTransfer?.files?.[0] ?? null;
  void processFile(file);
}

async function processFile(file: File | null): Promise<void> {
  if (!file || disposed) return;
  if (!file.type.startsWith('image/')) {
    setError('请选择 JPG / PNG / WebP 图片文件');
    return;
  }
  phase.value = 'loading';
  loadingStatus.value = '正在解析图片…';
  loadingProgress.value = 0;
  errorMessage.value = '';
  showFallbackNotice.value = false;

  try {
    // 用户若之前取消了提示，第一次真正使用时自动开始下载，并在右侧显示进度。
    if (!isDepthRuntimeReady()) {
      await startRuntimeDownload();
    }
    const canvas = await makeCanvas(file);
    if (disposed) return;
    loadingStatus.value = '准备深度模型…';
    const result = await estimateDepth(canvas, onDepthProgress);
    if (disposed) return;

    if (!renderer) {
      if (!canvasRef.value) throw new Error('渲染画布不可用');
      renderer = new HologramRenderer(canvasRef.value, {
        pointerStrength: mapParallax(parallaxStrength.value),
        maxParallax: mapParallax(parallaxStrength.value) * 1.15,
        glow: glowStrength.value * 1.2,
        opacity: opacityStrength.value,
        scanline: scanlineStrength.value * 0.3,
        chroma: chromaStrength.value * MAX_CHROMA,
        saturation: saturationStrength.value,
        temperature: temperatureStrength.value,
        brightness: brightnessStrength.value,
        hue: hueStrength.value,
      });
      // 调试钩子：dev 下暴露实例供 console / e2e 切换视图
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__holoRenderer = renderer;
      }
    }
    renderer.setImage(result);
    phase.value = 'active';
    // 调试钩子：暴露本次结果供 e2e 检查 rgba/depth
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__holoLastImage = result;
    }
  } catch (err) {
    if (disposed) return;
    setError(err instanceof Error ? err.message : '分析失败，请重试');
  }
}

function onDepthProgress(ev: DepthProgressEvent): void {
  if (disposed) return;
  switch (ev.status) {
    case 'fallback':
      showFallbackNotice.value = true;
      loadingStatus.value = '正在切换兼容模式…';
      break;
    case 'inference':
      loadingStatus.value = '正在分析图片深度（首次需编译 GPU 着色器，约几秒）…';
      loadingProgress.value = 100;
      break;
    case 'initiate':
    case 'download':
    case 'progress':
      loadingStatus.value = `正在下载深度模型${ev.file ? `（${ev.file}）` : ''}…`;
      loadingProgress.value = ev.progress || 0;
      break;
    case 'ready':
    case 'done':
      loadingStatus.value = '模型就绪，开始分析…';
      break;
    default:
      loadingStatus.value = '处理中…';
  }
}

/** 读取图片 → 按最大边缩放 → 返回画布（保证宽度高度为像素整数） */
async function makeCanvas(file: File): Promise<HTMLCanvasElement> {
  const MAX_DIM = 1536;
  let bitmap: ImageBitmap | null = null;
  let w: number;
  let h: number;

  if (typeof createImageBitmap === 'function') {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    w = bitmap.width;
    h = bitmap.height;
  } else {
    const img = await loadImg(file);
    w = img.naturalWidth;
    h = img.naturalHeight;
  }

  const scale = Math.min(1, MAX_DIM / Math.max(w, h, 1));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, cw, ch);
    bitmap.close();
  } else {
    const img = await loadImg(file);
    ctx.drawImage(img, 0, 0, cw, ch);
  }
  return canvas;
}

function loadImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    img.src = url;
  });
}

function setError(message: string): void {
  errorMessage.value = message;
  phase.value = 'error';
}

function resetEffects(): void {
  parallaxStrength.value = 0.45;
  glowStrength.value = 0.6;
  opacityStrength.value = 0.97;
  scanlineStrength.value = 0.2;
  chromaStrength.value = 1;
  saturationStrength.value = 1;
  temperatureStrength.value = 0;
  brightnessStrength.value = 0;
  hueStrength.value = 0;
}

function resetStage(): void {
  renderer?.clearImage();
  phase.value = 'idle';
  loadingStatus.value = '';
  loadingProgress.value = 0;
  errorMessage.value = '';
  showFallbackNotice.value = false;
}
</script>

<style scoped>
/* 宽屏：操作区使用图片展示区域左右的页面留白，不覆盖画布。 */
.holo-section {
  display: grid;
  grid-template-areas: 'left stage controls';
  grid-template-columns: minmax(110px, auto) minmax(540px, 1fr) minmax(190px, auto);
  align-items: stretch;
  gap: 16px;
  height: calc(100dvh - 164px);
  min-height: 460px;
}

/* 图片展示区：未选择图片时才显示默认深色舞台框。 */
.holo-stage {
  grid-area: stage;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(102, 204, 255, 0.28);
  border-radius: 14px;
  background:
    radial-gradient(120% 90% at 50% -10%, rgba(48, 100, 180, 0.30) 0%, transparent 58%),
    radial-gradient(90% 70% at 50% 115%, rgba(102, 204, 255, 0.14) 0%, transparent 60%),
    linear-gradient(180deg, #0c1626 0%, #0d1420 58%, #0a0f18 100%),
    linear-gradient(rgba(102, 204, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(102, 204, 255, 0.045) 1px, transparent 1px);
  background-size: auto, auto, auto, 42px 42px, 42px 42px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 10px 36px rgba(0, 10, 32, 0.55),
    inset 0 0 70px rgba(0, 24, 56, 0.55);
}

/* 用户选图并开始解析后：移除默认背景框，只留下画布绘制出的全息图。 */
.holo-stage--image {
  overflow: visible;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.holo-download-notice {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 5;
  width: min(300px, calc(100% - 36px));
  box-sizing: border-box;
  padding: 14px 16px;
  border: 1px solid rgba(102, 204, 255, 0.38);
  border-radius: 12px;
  background: rgba(5, 15, 28, 0.88);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28), inset 0 0 24px rgba(45, 155, 220, 0.08);
  color: #bfe9ff;
  backdrop-filter: blur(8px);
}

.holo-download-title {
  display: block;
  font-size: 14px;
  line-height: 1.45;
  letter-spacing: 0.4px;
}

.holo-download-error {
  color: #ffb1b7;
}

.holo-download-text {
  margin: 7px 0 0;
  color: #9fc0d6;
  font-size: 12px;
  line-height: 1.55;
}

.holo-download-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.holo-download-actions .holo-btn {
  flex: 1;
}

.holo-download-progress {
  width: 100%;
  margin-top: 12px;
}

.holo-download-percent {
  display: block;
  margin-top: 5px;
  color: #66ccff;
  font-size: 11px;
  text-align: right;
}

.holo-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

/* ---------- 粒子 ---------- */
.holo-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.holo-particle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(150, 220, 255, 0.95) 0%, rgba(102, 204, 255, 0) 70%);
  filter: blur(0.4px);
  animation: holo-rise linear infinite;
}

@keyframes holo-rise {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  12% {
    opacity: var(--po, 0.5);
  }
  70% {
    opacity: var(--po, 0.5);
  }
  100% {
    transform: translateY(-52vh);
    opacity: 0;
  }
}

/* ---------- 上传 / 加载 / 错误覆盖层（在图片区内） ---------- */
.holo-upload,
.holo-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #bfe9ff;
}

.holo-upload {
  width: 100%;
  height: 100%;
  border: none;
  background: rgba(8, 18, 32, 0.35);
  cursor: pointer;
  transition: background 0.2s ease;
}

.holo-upload:hover {
  background: rgba(20, 44, 76, 0.45);
}

/* 加载 / 错误状态已切到无背景框的全息步骤，给覆盖层一个半透明暗色底确保文字可读 */
.holo-overlay {
  background: rgba(8, 18, 32, 0.55);
  border-radius: 14px;
}

.holo-upload-icon {
  font-size: 40px;
  line-height: 1;
  color: #66ccff;
  animation: holo-pulse 2.4s ease-in-out infinite;
}

@keyframes holo-pulse {
  0%, 100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.12);
  }
}

.holo-upload-main {
  font-size: 18px;
  letter-spacing: 1px;
}

.holo-upload-sub {
  font-size: 13px;
  color: #8fb6cf;
}

.holo-spinner {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid rgba(102, 204, 255, 0.2);
  border-top-color: #66ccff;
  animation: holo-spin 0.9s linear infinite;
}

@keyframes holo-spin {
  to {
    transform: rotate(360deg);
  }
}

.holo-status {
  margin: 0;
  font-size: 14px;
  color: #bfe9ff;
}

.holo-progress {
  width: min(320px, 60%);
  height: 5px;
  border-radius: 3px;
  background: rgba(102, 204, 255, 0.16);
  overflow: hidden;
}

.holo-progress-bar {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #3fa9e8, #66ccff);
  transition: width 0.2s ease;
}

.holo-notice {
  margin: 0;
  font-size: 12px;
  color: #ffd166;
}

.holo-error {
  margin: 0 20px;
  text-align: center;
  font-size: 14px;
  color: #ff9aa2;
}

.holo-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

/* ---------- 图片区内的按钮（错误态） ---------- */
.holo-btn {
  padding: 7px 16px;
  border: 1px solid rgba(102, 204, 255, 0.5);
  border-radius: 8px;
  background: rgba(102, 204, 255, 0.12);
  color: #bfe9ff;
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.holo-btn:hover {
  background: rgba(102, 204, 255, 0.24);
}

.holo-btn-ghost {
  background: transparent;
  border-color: rgba(160, 190, 220, 0.35);
  color: #9fc0d6;
}

/* ---------- 展示区外的左右操作区（浅色页面背景） ---------- */
.holo-panel-left {
  grid-area: left;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 12px;
  min-width: 0;
}

.holo-hint {
  margin: 0;
  color: #6b8aa0;
  font-size: 13px;
  line-height: 1.7;
  letter-spacing: 1px;
}

.holo-controls {
  grid-area: controls;
  display: grid;
  grid-template-columns: 1fr;
  align-self: center;
  justify-self: end;
  width: 100%;
  max-width: 220px;
  gap: 10px;
}

.holo-panel-left .holo-btn,
.holo-controls .holo-btn {
  border-color: rgba(102, 160, 210, 0.55);
  background: rgba(255, 255, 255, 0.72);
  color: #2b6f8f;
}

.holo-panel-left .holo-btn:hover,
.holo-controls .holo-btn:hover {
  background: #ffffff;
}

.holo-controls .holo-btn-ghost {
  background: transparent;
  border-color: rgba(120, 150, 175, 0.4);
  color: #6b8aa0;
}

/* 重置设置按钮：只占内容宽度，不再占满整行，让右侧整体收窄 */
.holo-controls > .holo-btn {
  justify-self: end;
  padding: 6px 12px;
}

.holo-control {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: #41607a;
  font-size: 13px;
  white-space: nowrap;
}

.holo-control input[type='range'] {
  width: 100%;
  min-width: 0;
  max-width: 140px;
  margin-left: auto;
  accent-color: #66ccff;
}

.holo-file-input {
  display: none;
}

@media (max-width: 1100px) {
  .holo-section {
    grid-template-areas:
      'stage stage'
      'left controls';
    grid-template-columns: minmax(0, 1fr) minmax(360px, 1fr);
    grid-template-rows: minmax(420px, 1fr) auto;
    height: auto;
    min-height: 0;
  }

  .holo-stage {
    min-height: 520px;
  }

  .holo-panel-left {
    align-self: start;
    flex-direction: row;
    align-items: center;
  }

  .holo-controls {
    justify-self: end;
  }
}

@media (max-width: 720px) {
  .holo-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: auto;
    min-height: 0;
  }

  .holo-stage {
    aspect-ratio: 4 / 3;
    min-height: 340px;
  }

  .holo-download-notice {
    top: auto;
    right: 12px;
    bottom: 12px;
    width: calc(100% - 24px);
  }

  .holo-panel-left {
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .holo-hint {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .holo-controls {
    width: 100%;
    max-width: none;
    gap: 10px;
  }

  .holo-control {
    gap: 5px;
  }

  .holo-controls .holo-btn {
    justify-self: stretch;
  }
}

</style>
