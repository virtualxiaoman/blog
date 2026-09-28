<template>
  <section class="pdf-translator">
    <div class="tool-heading">
      <div>
        <h2 class="tool-title">PDF 论文翻译</h2>
        <p class="tool-desc">
          上传英文 PDF，在右侧生成保持原页面尺寸与图表布局的中文 PDF。默认通过服务端代理调用 OpenLux AI；服务端会读取本机配置文件，也可以在这里临时输入 API Key。
        </p>
      </div>
      <span class="free-badge">OpenLux AI 默认</span>
    </div>

    <div
      class="upload-zone"
      :class="{ dragging: isDragging, 'has-file': Boolean(file) }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="fileInput"
        class="file-input"
        type="file"
        accept="application/pdf,.pdf"
        @change="onFileChange"
      />
      <div class="upload-copy">
        <span class="upload-icon">⇧</span>
        <strong>{{ file ? file.name : '拖拽 PDF 到这里，或点击选择文件' }}</strong>
        <small>支持可复制文本的论文 PDF，单文件建议不超过 20 MB</small>
      </div>
      <button type="button" class="secondary-btn" @click="fileInput?.click()">
        {{ file ? '重新选择' : '选择 PDF' }}
      </button>
    </div>

    <div class="settings-row">
      <label class="setting">
        <span>翻译引擎</span>
        <select v-model="translationProvider" :disabled="translating">
          <option value="ai">OpenLux AI（默认）</option>
          <option value="free">MyMemory 免费接口（备用）</option>
        </select>
      </label>
      <label class="setting">
        <span>原文语言</span>
        <select v-model="sourceLanguage" :disabled="translating">
          <option value="en">英文</option>
          <option value="de">德文</option>
          <option value="fr">法文</option>
          <option value="ja">日文</option>
          <option value="auto">自动识别</option>
        </select>
      </label>
      <button
        type="button"
        class="primary-btn"
        :disabled="!file || translating || loadingPdf"
        @click="translatePdf"
      >
        {{ translating ? '正在翻译…' : loaded ? '重新翻译' : '开始翻译' }}
      </button>
      <button v-if="translatedUrl" type="button" class="secondary-btn" @click="downloadTranslation">
        下载中文 PDF
      </button>
    </div>

    <div class="api-key-panel">
      <div class="api-key-copy">
        <strong>OpenLux API Key</strong>
        <span v-if="hasUserApiKey">当前 API Key：已设置（仅保存在本次页面会话中）</span>
        <span v-else-if="serverApiKeyAvailable === true">服务端文件 API Key：已找到</span>
        <span v-else-if="serverApiKeyAvailable === false">服务端文件 API Key：未找到，可在此输入</span>
        <span v-else>正在检查服务端文件 API Key…</span>
      </div>
      <div class="api-key-controls">
        <input
          v-if="!hasUserApiKey"
          v-model="apiKeyDraft"
          class="api-key-input"
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder="可选：输入 API Key"
          @keydown.enter.prevent="saveApiKey"
        />
        <button v-if="!hasUserApiKey" type="button" class="secondary-btn" :disabled="!apiKeyDraft.trim()" @click="saveApiKey">
          设置
        </button>
        <button v-else type="button" class="secondary-btn" @click="clearApiKey">
          清除
        </button>
      </div>
    </div>

    <div v-if="statusText || errorMessage" class="status-area" :class="{ error: errorMessage }">
      <div class="status-line">
        <span class="status-dot" />
        <span>{{ errorMessage || statusText }}</span>
      </div>
      <div v-if="translating" class="progress-track">
        <span class="progress-bar" :style="{ width: `${progress}%` }" />
      </div>
    </div>

    <div v-if="originalMarkdown" class="markdown-actions">
      <div class="markdown-action-card">
        <div>
          <strong>原文 Markdown</strong>
          <span>提取 PDF 文本并保留分页标题</span>
        </div>
        <button type="button" class="copy-btn" :class="{ copied: copiedType === 'original' }" @click="copyMarkdown('original')">
          {{ copiedType === 'original' ? '已复制' : '复制全文' }}
        </button>
      </div>
      <div class="markdown-action-card">
        <div>
          <strong>译文 Markdown</strong>
          <span>{{ translatedMarkdown ? '翻译结果已就绪' : '完成翻译后可复制' }}</span>
        </div>
        <button
          type="button"
          class="copy-btn"
          :class="{ copied: copiedType === 'translated' }"
          :disabled="!translatedMarkdown"
          @click="copyMarkdown('translated')"
        >
          {{ copiedType === 'translated' ? '已复制' : '复制全文' }}
        </button>
      </div>
    </div>

    <div v-if="originalUrl" class="viewer-grid">
      <article class="document-panel">
        <header class="panel-header">
          <div>
            <h3>PDF 原文</h3>
            <span>{{ pageCount ? `${pageCount} 页` : '正在读取…' }}</span>
          </div>
          <span class="language-tag">原文</span>
        </header>
        <iframe class="pdf-frame" :src="originalUrl" title="PDF 原文预览" />
      </article>

      <article class="document-panel">
        <header class="panel-header">
          <div>
            <h3>中文译文</h3>
            <span>{{ translatedUrl ? '版式与原文页面一致' : '点击“开始翻译”生成' }}</span>
          </div>
          <span class="language-tag translated">中文</span>
        </header>
        <div v-if="translatedUrl" class="translated-frame-wrap">
          <iframe class="pdf-frame" :src="translatedUrl" title="中文 PDF 译文预览" />
        </div>
        <div v-else class="translation-placeholder">
          <span class="placeholder-icon">文</span>
          <strong>译文会显示在这里</strong>
          <p>原 PDF 的文字、图片和页面尺寸会被保留，中文文本覆盖在对应位置。</p>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      <span class="empty-icon">PDF</span>
      <strong>上传一篇论文开始双栏阅读</strong>
      <p>左侧显示原文，右侧显示生成的中文 PDF；所有文件都不会上传到本站服务器。</p>
    </div>

    <p class="privacy-note">
      提示：默认使用 OpenLux AI，模型固定为 gpt-5.6-terra。服务端会读取 %APPDATA%\xiaoman\Blog\cookie\openlux.txt；界面输入的 API Key 只保存在本次页面会话中，页面不会显示具体字符串。
    </p>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { copyText } from '../../../../utils/clipboard';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type TextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

type TextLine = TextItem & { items: TextItem[] };
type TextBlock = {
  lines: TextLine[];
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

type PageData = {
  width: number;
  height: number;
  imageData: string;
  blocks: TextBlock[];
};

const fileInput = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const sourceLanguage = ref('en');
const translationProvider = ref<'ai' | 'free'>('ai');
const isDragging = ref(false);
const loadingPdf = ref(false);
const translating = ref(false);
const loaded = ref(false);
const pageCount = ref(0);
const progress = ref(0);
const statusText = ref('');
const errorMessage = ref('');
const originalUrl = ref('');
const translatedUrl = ref('');
const originalMarkdown = ref('');
const translatedMarkdown = ref('');
const copiedType = ref<'original' | 'translated' | ''>('');
const apiKeyDraft = ref('');
const userApiKey = ref('');
const serverApiKeyAvailable = ref<boolean | null>(null);
const hasUserApiKey = ref(false);
let sourceBytes: ArrayBuffer | null = null;
let pages: PageData[] = [];

const AI_TRANSLATION_PROXY = import.meta.env.VITE_OPENLUX_TRANSLATION_PROXY_URL || '/api/openlux/translate';
const AI_STATUS_ENDPOINT = AI_TRANSLATION_PROXY.replace(/\/translate(?:\?.*)?$/, '/status');
const FREE_TRANSLATION_ENDPOINT = 'https://api.mymemory.translated.net/get';
const FONT_URL = `${import.meta.env.BASE_URL}fonts/FZLanTYK_Zhong.c10069d1.OTF`;

async function refreshApiKeyStatus() {
  try {
    const response = await fetch(AI_STATUS_ENDPOINT);
    const data = await response.json().catch(() => ({})) as { available?: boolean };
    serverApiKeyAvailable.value = response.ok && data.available === true;
  } catch {
    serverApiKeyAvailable.value = null;
  }
}

function saveApiKey() {
  const value = apiKeyDraft.value.trim();
  if (!value) return;
  userApiKey.value = value;
  apiKeyDraft.value = '';
  hasUserApiKey.value = true;
  errorMessage.value = '';
  statusText.value = '已设置本次页面会话使用的 API Key。';
}

function clearApiKey() {
  userApiKey.value = '';
  apiKeyDraft.value = '';
  hasUserApiKey.value = false;
  statusText.value = '已清除页面中输入的 API Key，将使用服务端文件配置。';
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  if (selected) void selectFile(selected);
}

function onDrop(event: DragEvent) {
  isDragging.value = false;
  const dropped = event.dataTransfer?.files?.[0];
  if (dropped) void selectFile(dropped);
}

async function selectFile(selected: File) {
  clearOutput();
  if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
    errorMessage.value = '请选择 PDF 文件。';
    return;
  }
  if (selected.size > 20 * 1024 * 1024) {
    errorMessage.value = '文件超过 20 MB，建议先压缩 PDF 后再上传。';
    return;
  }

  file.value = selected;
  loadingPdf.value = true;
  statusText.value = '正在读取 PDF 文本…';
  try {
    sourceBytes = await selected.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(sourceBytes) }).promise;
    pageCount.value = pdf.numPages;
    pages = [];
    const markdownPages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      statusText.value = `正在解析第 ${pageNumber}/${pdf.numPages} 页…`;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const renderScale = Math.min(1.8, Math.max(1.2, 1400 / viewport.width));
      const renderViewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(renderViewport.width);
      canvas.height = Math.ceil(renderViewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('当前浏览器无法创建 PDF 渲染画布。');
      await page.render({ canvasContext: context, viewport: renderViewport }).promise;

      const content = await page.getTextContent();
      const items = content.items
        .filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number } =>
          'str' in item && typeof item.str === 'string' && item.str.trim().length > 0 && 'transform' in item,
        )
        .map((item) => {
          const transform = item.transform;
          const fontSize = Math.max(5, Math.hypot(transform[0], transform[1]));
          return {
            text: item.str,
            x: transform[4],
            y: viewport.height - transform[5] - fontSize * 0.86,
            width: Math.max(item.width, fontSize * 0.25),
            height: Math.max(item.height || fontSize, fontSize),
            fontSize,
          };
        });
      const lines = groupIntoLines(items);
      const blocks = groupIntoBlocks(lines);
      const pageData: PageData = {
        width: viewport.width,
        height: viewport.height,
        imageData: canvas.toDataURL('image/jpeg', 0.88),
        blocks,
      };
      pages.push(pageData);
      markdownPages.push(`## 第 ${pageNumber} 页\n\n${blocks.map((block) => block.text).join('\n\n')}`);
    }

    originalMarkdown.value = `# ${selected.name.replace(/\.pdf$/i, '')}\n\n${markdownPages.join('\n\n---\n\n')}`;
    originalUrl.value = URL.createObjectURL(selected);
    loaded.value = true;
    statusText.value = `已读取 ${pdf.numPages} 页，可以开始翻译。`;
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'PDF 读取失败，请确认文件未损坏且包含可复制文本。');
    file.value = null;
    sourceBytes = null;
    pages = [];
  } finally {
    loadingPdf.value = false;
  }
}

function groupIntoLines(items: TextItem[]): TextLine[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextLine[] = [];
  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2.5, item.fontSize * 0.42));
    if (!line) {
      lines.push({ ...item, items: [item] });
      continue;
    }
    line.items.push(item);
    line.x = Math.min(line.x, item.x);
    line.width = Math.max(line.width, item.x + item.width - line.x);
    line.height = Math.max(line.height, item.height);
    line.fontSize = Math.max(line.fontSize, item.fontSize);
    line.text = line.items
      .sort((a, b) => a.x - b.x)
      .map((part, index, all) => {
        if (index === 0) return part.text;
        const previous = all[index - 1];
        const gap = part.x - (previous.x + previous.width);
        return `${gap > part.fontSize * 0.18 ? ' ' : ''}${part.text}`;
      })
      .join('')
      .trim();
  }
  return lines.sort((a, b) => a.y - b.y || a.x - b.x).filter((line) => line.text.length > 0);
}

function groupIntoBlocks(lines: TextLine[]): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const line of lines) {
    const previous = blocks[blocks.length - 1];
    const sameColumn = previous && Math.abs(previous.x - line.x) < Math.max(18, line.fontSize * 2.5);
    const closeEnough = previous && line.y - (previous.y + previous.height) < line.fontSize * 1.55;
    if (!previous || !sameColumn || !closeEnough) {
      blocks.push({
        lines: [line],
        text: line.text,
        x: line.x,
        y: line.y,
        width: line.width,
        height: line.height,
        fontSize: line.fontSize,
      });
      continue;
    }
    previous.lines.push(line);
    previous.text += `\n${line.text}`;
    previous.width = Math.max(previous.width, line.width);
    previous.height = line.y + line.height - previous.y;
    previous.fontSize = Math.max(previous.fontSize, line.fontSize);
  }
  return blocks;
}

async function translatePdf() {
  if (!file.value || !sourceBytes || !pages.length) return;
  translating.value = true;
  errorMessage.value = '';
  translatedUrl.value = '';
  translatedMarkdown.value = '';
  progress.value = 0;
  const translatedPages: string[] = [];
  const translations = new Map<string, string>();

  try {
    const translatedPageData: Array<{ page: PageData; blocks: Array<TextBlock & { translation: string }> }> = [];
    const totalBlocks = pages.reduce((sum, page) => sum + page.blocks.length, 0);
    let completedBlocks = 0;

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const page = pages[pageIndex];
      const translatedBlocks: Array<TextBlock & { translation: string }> = [];
      const markdownBlocks: string[] = [];
      statusText.value = `正在翻译第 ${pageIndex + 1}/${pages.length} 页…`;

      if (translationProvider.value === 'ai') {
        // AI 按页面分批翻译，显著减少请求次数，也能让模型结合相邻段落保持术语一致。
        const pageTranslations = await translateBlocksWithOpenLux(page.blocks.map((block) => block.text));
        page.blocks.forEach((block, blockIndex) => {
          const translation = pageTranslations[blockIndex] || block.text;
          translatedBlocks.push({ ...block, translation });
          markdownBlocks.push(translation);
          completedBlocks += 1;
        });
        progress.value = totalBlocks ? Math.round((completedBlocks / totalBlocks) * 100) : 0;
      } else {
        for (const block of page.blocks) {
          const key = block.text.trim();
          let translation = translations.get(key);
          if (!translation) {
            translation = await translateText(key);
            translations.set(key, translation);
            await wait(90);
          }
          translatedBlocks.push({ ...block, translation });
          markdownBlocks.push(translation);
          completedBlocks += 1;
          progress.value = totalBlocks ? Math.round((completedBlocks / totalBlocks) * 100) : 0;
        }
      }
      translatedPageData.push({ page, blocks: translatedBlocks });
      translatedPages.push(`## 第 ${pageIndex + 1} 页\n\n${markdownBlocks.join('\n\n')}`);
    }

    statusText.value = '正在生成保持原版式的中文 PDF…';
    translatedUrl.value = await buildTranslatedPdf(translatedPageData);
    translatedMarkdown.value = `# ${file.value.name.replace(/\.pdf$/i, '')}（中文译文）\n\n${translatedPages.join('\n\n---\n\n')}`;
    progress.value = 100;
    statusText.value = '翻译完成，可以在右侧预览或下载中文 PDF。';
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '翻译失败，请稍后重试或更换翻译服务。');
  } finally {
    translating.value = false;
  }
}

async function translateText(text: string): Promise<string> {
  if (!text.trim()) return '';
  if (translationProvider.value === 'ai') return translateWithOpenLux(text);

  const langPair = `${sourceLanguage.value === 'auto' ? 'en' : sourceLanguage.value}|zh-CN`;
  const query = new URLSearchParams({ q: text.slice(0, 4800), langpair: langPair });
  const response = await fetch(`${FREE_TRANSLATION_ENDPOINT}?${query.toString()}`);
  if (!response.ok) throw new Error(`免费翻译服务返回 HTTP ${response.status}`);
  const data = await response.json() as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
  };
  const result = data.responseData?.translatedText?.trim();
  if (!result || data.responseStatus === 403) throw new Error('免费翻译接口暂时达到调用限制，请切换到 OpenLux AI。');
  return decodeHtmlEntities(result);
}

async function translateWithOpenLux(text: string): Promise<string> {
  const translations = await requestOpenLuxSegments([text]);
  return translations[0] || text;
}

async function translateBlocksWithOpenLux(texts: string[]): Promise<string[]> {
  const output = new Array<string>(texts.length);
  let chunk: Array<{ index: number; text: string }> = [];
  let chunkLength = 0;

  const flush = async () => {
    if (!chunk.length) return;
    const translations = await requestOpenLuxSegments(chunk.map((item) => item.text));
    chunk.forEach((item, index) => {
      output[item.index] = translations[index] || item.text;
    });
    chunk = [];
    chunkLength = 0;
  };

  for (let index = 0; index < texts.length; index += 1) {
    const text = texts[index].trim();
    // 控制单次上下文大小，避免长论文页面超过模型或代理限制。
    if (chunk.length && (chunkLength + text.length > 9000 || chunk.length >= 32)) await flush();
    chunk.push({ index, text: text.slice(0, 12000) });
    chunkLength += text.length;
  }
  await flush();
  return output;
}

async function requestOpenLuxSegments(texts: string[]): Promise<string[]> {
  const response = await fetch(AI_TRANSLATION_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      segments: texts.map((text, index) => ({ id: String(index), text })),
      sourceLanguage: sourceLanguage.value,
      targetLanguage: 'zh-CN',
      ...(userApiKey.value ? { apiKey: userApiKey.value } : {}),
    }),
  });
  const data = await response.json().catch(() => ({})) as {
    translations?: Array<{ id: string; text: string }>;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || `OpenLux AI 翻译服务返回 HTTP ${response.status}`);
  }
  if (!Array.isArray(data.translations)) throw new Error('OpenLux AI 没有返回有效译文。');
  const byId = new Map(data.translations.map((item) => [String(item.id), item.text?.trim()]));
  return texts.map((text, index) => byId.get(String(index)) || text);
}

async function buildTranslatedPdf(
  translatedPages: Array<{ page: PageData; blocks: Array<TextBlock & { translation: string }> }>,
): Promise<string> {
  const output = await PDFDocument.create();
  output.registerFontkit(fontkit);
  const fontResponse = await fetch(FONT_URL);
  if (!fontResponse.ok) throw new Error('中文字体加载失败，无法生成中文 PDF。');
  const font = await output.embedFont(await fontResponse.arrayBuffer(), { subset: false });

  for (const { page, blocks } of translatedPages) {
    const outputPage = output.addPage([page.width, page.height]);
    const image = await output.embedJpg(dataUrlToBytes(page.imageData));
    outputPage.drawImage(image, { x: 0, y: 0, width: page.width, height: page.height });

    for (const block of blocks) {
      const lines = wrapForPdf(block.translation, font, block.width, block.fontSize * 1.04);
      const lineHeight = Math.max(block.fontSize * 1.18, 8);
      const boxHeight = Math.max(block.height + 3, lines.length * lineHeight + 2);
      const boxY = page.height - block.y - boxHeight + 1;
      outputPage.drawRectangle({
        x: Math.max(0, block.x - 1.5),
        y: Math.max(0, boxY),
        width: Math.min(page.width - block.x + 1.5, block.width + 3),
        height: Math.min(page.height - Math.max(0, boxY), boxHeight),
        color: rgb(1, 1, 1),
      });
      lines.forEach((line, index) => {
        outputPage.drawText(line, {
          x: block.x,
          y: page.height - block.y - lineHeight * (index + 1) + (lineHeight - block.fontSize) * 0.35,
          size: block.fontSize,
          font,
          color: rgb(0.08, 0.08, 0.08),
          maxWidth: Math.max(20, block.width),
        });
      });
    }
  }

  const bytes = await output.save();
  return replaceObjectUrl(translatedUrl.value, new Blob([bytes], { type: 'application/pdf' }));
}

function wrapForPdf(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, maxWidth: number, size: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let current = '';
    for (const char of Array.from(paragraph.trim())) {
      const candidate = current + char;
      if (current && font.widthOfTextAtSize(candidate, size) > Math.max(20, maxWidth)) {
        result.push(current);
        current = char;
      } else {
        current = candidate;
      }
    }
    if (current) result.push(current);
  }
  return result.length ? result : [''];
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeHtmlEntities(value: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function replaceObjectUrl(previous: string, blob: Blob): string {
  if (previous) URL.revokeObjectURL(previous);
  return URL.createObjectURL(blob);
}

function downloadTranslation() {
  if (!translatedUrl.value || !file.value) return;
  const link = document.createElement('a');
  link.href = translatedUrl.value;
  link.download = `${file.value.name.replace(/\.pdf$/i, '')}-中文译文.pdf`;
  link.click();
}

async function copyMarkdown(type: 'original' | 'translated') {
  const text = type === 'original' ? originalMarkdown.value : translatedMarkdown.value;
  if (!text) return;
  const ok = await copyText(text);
  if (ok) {
    copiedType.value = type;
    window.setTimeout(() => {
      if (copiedType.value === type) copiedType.value = '';
    }, 1600);
  }
}

function clearOutput() {
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
  if (translatedUrl.value) URL.revokeObjectURL(translatedUrl.value);
  originalUrl.value = '';
  translatedUrl.value = '';
  originalMarkdown.value = '';
  translatedMarkdown.value = '';
  statusText.value = '';
  errorMessage.value = '';
  pageCount.value = 0;
  progress.value = 0;
  loaded.value = false;
  sourceBytes = null;
  pages = [];
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

onMounted(() => {
  void refreshApiKeyStatus();
});

onBeforeUnmount(() => {
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
  if (translatedUrl.value) URL.revokeObjectURL(translatedUrl.value);
});
</script>

<style scoped>
.pdf-translator {
  min-width: 0;
  color: #1c3a4a;
}

.tool-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.tool-title {
  margin: 0 0 6px;
  font-size: 24px;
}

.tool-desc {
  max-width: 840px;
  margin: 0 0 18px;
  color: #73767a;
  line-height: 1.65;
}

.free-badge,
.language-tag {
  flex: 0 0 auto;
  padding: 4px 9px;
  border: 1px solid rgba(57, 197, 187, 0.32);
  border-radius: 999px;
  background: rgba(57, 197, 187, 0.1);
  color: #238f88;
  font-size: 12px;
  white-space: nowrap;
}

.upload-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 96px;
  padding: 16px 18px;
  border: 1px dashed #a9dced;
  border-radius: 12px;
  background: #fafdff;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.upload-zone.dragging,
.upload-zone:hover {
  border-color: #39c5bb;
  background: #f2ffff;
}

.upload-zone.has-file {
  border-style: solid;
}

.file-input {
  display: none;
}

.upload-copy {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  column-gap: 10px;
  min-width: 0;
}

.upload-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-copy small {
  grid-column: 2;
  margin-top: 3px;
  color: #8b969d;
}

.upload-icon,
.empty-icon,
.placeholder-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: rgba(102, 204, 255, 0.2);
  color: #2595ce;
  font-weight: 700;
}

.secondary-btn,
.primary-btn,
.copy-btn {
  border: 0;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.secondary-btn {
  flex: 0 0 auto;
  border: 1px solid #cde8f1;
  background: #fff;
  color: #2387ad;
}

.secondary-btn:hover {
  background: #effaff;
}

.primary-btn {
  background: #39c5bb;
  color: #fff;
  font-weight: 600;
}

.primary-btn:hover {
  background: #2aae9f;
}

.primary-btn:disabled,
.secondary-btn:disabled,
.copy-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.api-key-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin: 0 0 14px;
  padding: 11px 13px;
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #fafdff;
}

.api-key-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.api-key-copy span {
  color: #8b969d;
  font-size: 12px;
}

.api-key-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: min(100%, 300px);
}

.api-key-input {
  min-width: 0;
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  background: #fff;
  color: #333;
  font-size: 13px;
}

.settings-row {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin: 14px 0;
}

.setting {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #73767a;
  font-size: 13px;
}

.setting select {
  padding: 8px 10px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  background: #fff;
  color: #333;
  font-size: 13px;
}

.status-area {
  margin: 12px 0 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f2fbfd;
  color: #36818b;
  font-size: 13px;
}

.status-area.error {
  background: #fff5f4;
  color: #d9534f;
}

.status-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.progress-track {
  height: 4px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 99px;
  background: rgba(57, 197, 187, 0.15);
}

.progress-bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #39c5bb;
  transition: width 0.2s ease;
}

.markdown-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 14px 0 18px;
}

.markdown-action-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #fafdff;
}

.markdown-action-card > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.markdown-action-card span {
  overflow: hidden;
  color: #8b969d;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  flex: 0 0 auto;
  background: #66ccff;
  color: #fff;
  font-weight: 600;
}

.copy-btn:hover {
  background: #4bbdf5;
}

.copy-btn.copied {
  background: #39c5bb;
}

.viewer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  min-width: 0;
}

.document-panel {
  display: flex;
  min-width: 0;
  min-height: 680px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #dbeef7;
  border-radius: 12px;
  background: #f5f9fb;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
}

.panel-header h3 {
  margin: 0 0 3px;
  font-size: 15px;
}

.panel-header span:not(.language-tag) {
  color: #8b969d;
  font-size: 12px;
}

.language-tag.translated {
  border-color: rgba(102, 204, 255, 0.35);
  background: rgba(102, 204, 255, 0.12);
  color: #248bb6;
}

.pdf-frame {
  display: block;
  width: 100%;
  flex: 1;
  min-height: 620px;
  border: 0;
  background: #68727a;
}

.translated-frame-wrap {
  display: flex;
  flex: 1;
  min-height: 0;
}

.translation-placeholder,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 620px;
  flex-direction: column;
  gap: 9px;
  padding: 24px;
  text-align: center;
  color: #73767a;
}

.translation-placeholder strong,
.empty-state strong {
  color: #1c3a4a;
}

.translation-placeholder p,
.empty-state p {
  max-width: 330px;
  margin: 0;
  line-height: 1.65;
  font-size: 13px;
}

.empty-state {
  min-height: 220px;
  margin-top: 12px;
  border: 1px dashed #cde8f1;
  border-radius: 12px;
  background: rgba(250, 253, 255, 0.78);
}

.empty-icon {
  width: 48px;
  height: 48px;
}

.privacy-note {
  margin: 14px 0 0;
  color: #9aa3a8;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 900px) {
  .viewer-grid,
  .markdown-actions {
    grid-template-columns: minmax(0, 1fr);
  }

  .document-panel {
    min-height: 540px;
  }

  .pdf-frame,
  .translation-placeholder {
    min-height: 480px;
  }
}

@media (max-width: 560px) {
  .tool-heading,
  .upload-zone {
    align-items: stretch;
    flex-direction: column;
  }

  .free-badge {
    align-self: flex-start;
  }

  .upload-copy strong {
    white-space: normal;
  }

  .api-key-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .api-key-controls {
    width: 100%;
  }

  .setting {
    justify-content: space-between;
  }

  .setting select {
    flex: 1;
  }
}
</style>


