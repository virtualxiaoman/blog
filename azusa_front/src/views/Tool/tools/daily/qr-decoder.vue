<template>
  <div class="qr-tool">
    <h2 class="tool-title">二维码识别转 URL</h2>
    <p class="tool-desc">上传二维码图片，或直接将截图粘贴到页面中，自动识别二维码内容。</p>

    <div
      class="drop-zone"
      :class="{ dragging: isDragging, 'has-image': previewUrl }"
      @click="openFilePicker"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <img v-if="previewUrl" :src="previewUrl" alt="待识别的二维码" class="preview-image" />
      <template v-else>
        <div class="upload-icon" aria-hidden="true">⌁</div>
        <strong>点击上传或拖拽图片到这里</strong>
        <span>也可以直接使用 Ctrl / ⌘ + V 粘贴截图</span>
      </template>
      <input ref="fileInput" type="file" accept="image/*" class="file-input" @change="handleFileChange" />
    </div>

    <div class="action-row">
      <button type="button" class="secondary-btn" @click="pasteFromClipboard" :disabled="isDecoding">
        从剪贴板读取图片
      </button>
      <button v-if="previewUrl" type="button" class="text-btn" @click="clearImage">清除图片</button>
      <span v-if="isDecoding" class="status">正在识别…</span>
    </div>

    <div v-if="result" class="result-panel">
      <div class="result-heading">
        <span class="result-label">识别结果</span>
        <span v-if="isUrl" class="url-badge">URL</span>
        <span v-else class="text-badge">文本</span>
      </div>
      <div class="result-value-row">
        <a v-if="isUrl" :href="result" target="_blank" rel="noopener noreferrer" class="result-value link-value">
          {{ result }}
        </a>
        <textarea v-else :value="result" readonly class="result-value text-value" rows="3"></textarea>
        <button type="button" class="copy-btn" :class="{ copied }" @click="copyResult">
          {{ copied ? '已复制' : '复制' }}
        </button>
      </div>
    </div>

    <p v-if="message" class="message" :class="messageType">{{ message }}</p>
    <p class="privacy-note">图片仅在当前浏览器本地处理，不会上传到服务器。浏览器不支持原生识别时，会自动使用内置的兼容识别引擎。</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { copyText } from '../../../../utils/clipboard';

declare global {
  interface BarcodeDetectorOptions {
    formats?: string[];
  }
  interface DetectedBarcode {
    rawValue?: string;
  }
  interface BarcodeDetector {
    detect(source: ImageBitmap | HTMLImageElement | HTMLCanvasElement): Promise<DetectedBarcode[]>;
  }
  interface BarcodeDetectorConstructor {
    new (options?: BarcodeDetectorOptions): BarcodeDetector;
    getSupportedFormats?: () => Promise<string[]>;
  }
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const fileInput = ref<HTMLInputElement | null>(null);
const previewUrl = ref('');
const result = ref('');
const message = ref('');
const messageType = ref<'error' | 'success'>('error');
const isDragging = ref(false);
const isDecoding = ref(false);
const copied = ref(false);

const isUrl = computed(() => {
  if (!result.value) return false;
  try {
    const url = new URL(result.value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
});

function openFilePicker() {
  fileInput.value?.click();
}

function setMessage(text: string, type: 'error' | 'success' = 'error') {
  message.value = text;
  messageType.value = type;
}

function clearMessage() {
  message.value = '';
}

function clearImage() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  result.value = '';
  copied.value = false;
  clearMessage();
  if (fileInput.value) fileInput.value.value = '';
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void processImage(file);
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) void processImage(file);
}

async function processImage(file: File) {
  if (!file.type.startsWith('image/')) {
    setMessage('请选择 PNG、JPG、WEBP 等图片文件。');
    return;
  }

  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = URL.createObjectURL(file);
  result.value = '';
  copied.value = false;
  clearMessage();
  await decodeImage(file);
}

async function decodeImage(file: File) {
  isDecoding.value = true;
  try {
    // 优先使用浏览器原生接口，速度更快；不支持时自动回退到 ZXing。
    const nativeValue = await decodeWithBarcodeDetector(file);
    const value = nativeValue || await decodeWithZxing(file);
    if (!value) {
      setMessage('未识别到二维码，请换一张清晰、完整的二维码图片。');
      return;
    }

    result.value = value;
    setMessage(isUrl.value ? '识别成功，可以点击 URL 打开或复制。' : '识别成功，但内容不是标准 http(s) URL。', 'success');
  } catch {
    setMessage('二维码识别失败，请确认图片中包含清晰的二维码。');
  } finally {
    isDecoding.value = false;
  }
}

async function decodeWithBarcodeDetector(file: File): Promise<string> {
  if (!window.BarcodeDetector) return '';

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const codes = await detector.detect(bitmap);
    return codes.find((code) => code.rawValue)?.rawValue?.trim() ?? '';
  } catch {
    return '';
  } finally {
    bitmap?.close();
  }
}

async function decodeWithZxing(file: File): Promise<string> {
  const { BrowserQRCodeReader } = await import('@zxing/browser');
  const image = new Image();
  const imageUrl = URL.createObjectURL(file);

  try {
    image.src = imageUrl;
    await image.decode();
    const reader = new BrowserQRCodeReader();
    const decoded = await reader.decodeFromImageElement(image);
    return decoded.getText().trim();
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function pasteFromClipboard() {
  try {
    if (!navigator.clipboard?.read) throw new Error('clipboard-read-unavailable');
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        await processImage(new File([blob], 'clipboard-image.png', { type: imageType }));
        return;
      }
    }
    setMessage('剪贴板中没有图片，请先复制二维码截图。');
  } catch {
    setMessage('无法读取剪贴板，请点击页面后使用 Ctrl / ⌘ + V 粘贴二维码截图。');
  }
}

function handlePaste(event: ClipboardEvent) {
  const items = Array.from(event.clipboardData?.items ?? []);
  const imageItem = items.find((item) => item.type.startsWith('image/'));
  const file = imageItem?.getAsFile();
  if (file) {
    event.preventDefault();
    void processImage(file);
  }
}

async function copyResult() {
  if (!result.value) return;
  const ok = await copyText(result.value);
  if (!ok) {
    setMessage('复制失败，请手动选择结果文本。');
    return;
  }
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

onMounted(() => window.addEventListener('paste', handlePaste));
onBeforeUnmount(() => {
  window.removeEventListener('paste', handlePaste);
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});
</script>

<style scoped>
.qr-tool {
  max-width: 760px;
}

.tool-title {
  margin: 0 0 6px;
  font-size: 24px;
  color: #1c3a4a;
}

.tool-desc {
  margin: 0 0 20px;
  color: #73767a;
}

.drop-zone {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  border: 2px dashed #b9e4f5;
  border-radius: 14px;
  background: #fafdff;
  color: #1c3a4a;
  cursor: pointer;
  transition: border-color .2s ease, background-color .2s ease;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: #66ccff;
  background: #f0fbff;
}

.drop-zone.has-image {
  min-height: 220px;
  padding: 16px;
}

.upload-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #e4f7ff;
  color: #409eff;
  font-size: 32px;
  line-height: 1;
}

.drop-zone span {
  color: #8b959c;
  font-size: 13px;
}

.preview-image {
  display: block;
  max-width: 100%;
  max-height: 360px;
  object-fit: contain;
  border-radius: 8px;
}

.file-input {
  display: none;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 14px 0 20px;
}

.secondary-btn,
.copy-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: #66ccff;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color .2s ease;
}

.secondary-btn:hover,
.copy-btn:hover {
  background: #4bbdf5;
}

.secondary-btn:disabled {
  cursor: wait;
  opacity: .65;
}

.text-btn {
  padding: 6px 0;
  border: none;
  background: transparent;
  color: #409eff;
  cursor: pointer;
}

.status {
  color: #73767a;
  font-size: 13px;
}

.result-panel {
  padding: 16px;
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #fff;
}

.result-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.result-label {
  color: #1c3a4a;
  font-size: 14px;
  font-weight: 600;
}

.url-badge,
.text-badge {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
}

.url-badge {
  background: #e4f8f5;
  color: #1a9a8e;
}

.text-badge {
  background: #fff4df;
  color: #c98925;
}

.result-value-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.result-value {
  flex: 1;
  min-width: 0;
  padding: 9px 11px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  background: #fafdff;
  color: #333;
  font: 14px/1.5 Consolas, 'Courier New', monospace;
  overflow-wrap: anywhere;
}

.link-value {
  display: block;
  min-height: 22px;
  color: #2688ce;
  text-decoration: none;
}

.link-value:hover {
  text-decoration: underline;
}

.text-value {
  resize: vertical;
}

.copy-btn.copied {
  background: #39c5bb;
}

.message {
  margin: 12px 0 0;
  font-size: 13px;
}

.message.error {
  color: #d9534f;
}

.message.success {
  color: #1a9a8e;
}

.privacy-note {
  margin: 18px 0 0;
  color: #9aa3a8;
  font-size: 12px;
}
</style>
