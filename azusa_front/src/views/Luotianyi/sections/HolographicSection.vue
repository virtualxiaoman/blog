<template>
  <div class="holo-section">
    <!-- 图片展示区（占满可用高度） -->
    <div
      class="holo-stage"
      @dragover.prevent="onDragOver"
      @drop.prevent="onDrop"
    >
      <canvas ref="canvasRef" class="holo-canvas" aria-label="全息投影画布" />

      <!-- 漂浮粒子（舞台氛围） -->
      <div class="holo-particles" aria-hidden="true">
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

    <!-- 图片区域之外：操作提示 + 控制条 -->
    <div v-if="phase === 'active'" class="holo-panel">
      <p class="holo-hint">移动指针 / 触摸滑动 · 查看全息视角</p>
      <div class="holo-controls">
        <button type="button" class="holo-btn" @click="openPicker">更换图片</button>
        <label class="holo-control">
          <span>视差</span>
          <input
            v-model.number="parallaxStrength"
            type="range"
            min="0"
            max="1"
            step="0.01"
          />
        </label>
        <label class="holo-control">
          <span>扫描线</span>
          <input
            v-model.number="scanlineStrength"
            type="range"
            min="0"
            max="1"
            step="0.01"
          />
        </label>
        <label class="holo-control">
          <span>辉光</span>
          <input
            v-model.number="glowStrength"
            type="range"
            min="0"
            max="1"
            step="0.01"
          />
        </label>
        <label class="holo-control">
          <span>透明</span>
          <input
            v-model.number="opacityStrength"
            type="range"
            min="0.5"
            max="1"
            step="0.01"
          />
        </label>
        <button type="button" class="holo-btn holo-btn-ghost" @click="resetStage">重置</button>
      </div>
    </div>

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
import { estimateDepth, type DepthProgressEvent } from '../components/hologram/depthService';
import { HologramRenderer } from '../components/hologram/HologramRenderer';

type Phase = 'idle' | 'loading' | 'active' | 'error';

const phase = ref<Phase>('idle');
const loadingStatus = ref('');
const loadingProgress = ref(0);
const errorMessage = ref('');
const showFallbackNotice = ref(false);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

// 控制条状态
const parallaxStrength = ref(0.5);
const glowStrength = ref(0.6);
const opacityStrength = ref(0.92);
const scanlineStrength = ref(0.4);

let renderer: HologramRenderer | null = null;
let disposed = false;

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
});

watch([parallaxStrength, glowStrength, opacityStrength, scanlineStrength], () => {
  if (renderer && phase.value === 'active') {
    renderer.setOptions({
      pointerStrength: mapParallax(parallaxStrength.value),
      maxParallax: mapParallax(parallaxStrength.value) * 1.15,
      glow: glowStrength.value * 1.2,
      opacity: opacityStrength.value,
      scanline: scanlineStrength.value * 0.3,
    });
  }
});

/** 视差强度：滑块 0~1 → 指针全幅位移 0.02~0.14（实际视差幅度，非钳制值） */
function mapParallax(v: number): number {
  return 0.02 + v * 0.12;
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
/* 整体：图片区 + 下方控制条，刚好占满一屏（桌面）
   高度 = 100dvh - 页面顶部留白(36) - 头部(72) - 主区上边距(32) - 主区下边距(24, is-holo 压缩后)
   配合 index.vue 的 .lty-page.is-holo / .lty-main.is-holo 正好不翻页。 */
.holo-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100dvh - 164px);
  min-height: 460px;
}

/* 图片展示区：占满剩余高度，深色舞台卡片 */
.holo-stage {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid rgba(102, 204, 255, 0.28);
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

/* ---------- 图片区外的提示 + 控制条（浅色页面背景） ---------- */
.holo-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px 22px;
  flex-wrap: wrap;
  padding: 2px 6px;
}

.holo-hint {
  margin: 0;
  font-size: 13px;
  letter-spacing: 1px;
  color: #6b8aa0;
  flex-shrink: 0;
}

.holo-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.holo-panel .holo-btn {
  border-color: rgba(102, 160, 210, 0.55);
  background: rgba(255, 255, 255, 0.72);
  color: #2b6f8f;
}

.holo-panel .holo-btn:hover {
  background: #ffffff;
}

.holo-panel .holo-btn-ghost {
  background: transparent;
  border-color: rgba(120, 150, 175, 0.4);
  color: #6b8aa0;
}

.holo-control {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: #41607a;
  white-space: nowrap;
}

.holo-control input[type='range'] {
  width: 96px;
  accent-color: #66ccff;
}

.holo-file-input {
  display: none;
}

@media (max-width: 720px) {
  /* 移动端高度自适应，允许滚动；图片区给一个合理比例 */
  .holo-section {
    height: auto;
    min-height: 0;
  }

  .holo-stage {
    aspect-ratio: 4 / 3;
    min-height: 340px;
  }

  .holo-panel {
    justify-content: center;
  }

  .holo-hint {
    text-align: center;
    width: 100%;
  }

  .holo-control {
    gap: 5px;
  }

  .holo-control input[type='range'] {
    width: 72px;
  }
}
</style>
