<template>
  <div class="markdown-parser">
    <div class="tool-head">
      <div class="tool-head-text">
        <h2 class="tool-title">Markdown 解析器</h2>
        <p class="tool-desc">
          左侧编辑 Markdown，右侧按文章样式实时预览；复制与下载都会使用统一为
          <code>$…$</code> / <code>$$…$$</code> 的规范公式。
        </p>
      </div>
    </div>

    <div class="panes">
      <section v-if="editorOpen" class="pane editor-pane">
        <header class="pane-head">
          <div class="pane-title-wrap">
            <span class="pane-title">Markdown 原文</span>
            <span class="pane-meta">{{ input.length }} 字符</span>
          </div>
          <div class="pane-actions">
            <button type="button" class="mini-btn" @click="loadSample">示例</button>
            <button type="button" class="mini-btn" @click="clearInput">清空</button>
            <button
              type="button"
              class="icon-btn"
              title="折叠编辑栏"
              aria-label="折叠编辑栏"
              :disabled="!previewOpen"
              @click="toggleEditor"
            >
              «
            </button>
          </div>
        </header>
        <p class="format-hint">
          支持 <code>$…$</code>、<code>$$…$$</code>、<code>[公式]</code>、<code>\(…\)</code>、<code>\[…\]</code>、<code>\\…\\</code>，代码块内不改动
        </p>
        <textarea
          v-model="input"
          class="editor-textarea"
          spellcheck="false"
          placeholder="在此粘贴或输入 Markdown…"
        ></textarea>
      </section>
      <section v-else class="pane-rail">
        <button type="button" class="rail-btn" aria-label="展开编辑栏" @click="editorOpen = true">
          编辑
        </button>
      </section>

      <section v-if="previewOpen" class="pane preview-pane">
        <header class="pane-head">
          <div class="pane-title-wrap">
            <span class="pane-title">预览</span>
            <span class="pane-meta">
              {{ formulaCount }} 处公式<template v-if="convertedCount"> · 已统一 {{ convertedCount }} 处</template>
            </span>
          </div>
          <div class="pane-actions">
            <button
              type="button"
              class="action-btn"
              :class="{ 'is-copied': copied }"
              :disabled="!hasContent"
              title="复制已统一为 $ / $$ 的 Markdown"
              @click="copyNormalized"
            >
              {{ copied ? '已复制' : '复制 Markdown' }}
            </button>
            <button
              type="button"
              class="action-btn primary"
              :disabled="!hasContent || !previewHtml || pdfBusy"
              @click="downloadPdf"
            >
              {{ pdfBusy ? '生成中…' : '下载 PDF' }}
            </button>
            <button
              type="button"
              class="icon-btn"
              title="折叠预览栏"
              aria-label="折叠预览栏"
              :disabled="!editorOpen"
              @click="togglePreview"
            >
              »
            </button>
          </div>
        </header>
        <p class="format-hint">选中预览内容后复制，得到带 <code>$…$</code> 公式的 Markdown</p>
        <div class="preview-scroll">
          <p v-if="renderError" class="render-error">解析失败：{{ renderError }}</p>
          <div
            v-else-if="hasContent"
            class="markdown-body preview-body"
            v-html="previewHtml"
            @click="onPreviewClick"
            @copy="onPreviewCopy"
          ></div>
          <p v-else class="empty-hint">在左侧粘贴或输入 Markdown，右侧会按文章样式实时预览。</p>
        </div>
      </section>
      <section v-else class="pane-rail">
        <button type="button" class="rail-btn" aria-label="展开预览栏" @click="previewOpen = true">
          预览
        </button>
      </section>
    </div>

    <p v-if="pdfError" class="pdf-error">{{ pdfError }}</p>

    <!-- PDF 排版容器：外层移到屏幕外，只把内层交给 html2pdf，避免克隆后仍带偏移样式 -->
    <div class="pdf-stage" aria-hidden="true" inert>
      <div ref="pdfRoot" class="markdown-body preview-body pdf-root" v-html="pdfHtml"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import 'github-markdown-css';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { copyText } from '../../../../utils/clipboard';
import { normalizeFormulaDelimiters } from '../../../../utils/formulaNormalize';
import { renderMarkdownPreview } from '../../../../utils/markdownPreview';

const SAMPLE = [
  '# Markdown 解析器',
  '',
  '左侧支持多种公式写法，右侧会**自动统一**为 `$...$` 与 `$$...$$`。',
  '',
  '行内公式：$E = mc^2$，也可以写成 \\(a^2 + b^2 = c^2\\) 或 [x^2 + y^2 = r^2]。',
  '',
  '行间公式：',
  '',
  '$$',
  '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}',
  '$$',
  '',
  '\\[',
  '\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}',
  '\\]',
  '',
  '\\\\x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\\\',
  '',
  '> 代码块和行内代码里的 `$x$` 会保持原样。',
  '',
  '```python',
  'def area(r):',
  '    return 3.14 * r ** 2',
  '```',
].join('\n');

const input = ref('');
const normalizedText = ref('');
const formulaCount = ref(0);
const convertedCount = ref(0);
const previewHtml = ref('');
const pdfHtml = ref('');
const renderError = ref('');
const copied = ref(false);
const pdfBusy = ref(false);
const pdfError = ref('');
const editorOpen = ref(true);
const previewOpen = ref(true);
const pdfRoot = ref<HTMLElement | null>(null);

const hasContent = computed(() => normalizedText.value.trim().length > 0);

let previewTimer = 0;
let copiedTimer = 0;

function refreshPreview() {
  window.clearTimeout(previewTimer);
  previewTimer = 0;

  const result = normalizeFormulaDelimiters(input.value);
  normalizedText.value = result.text;
  formulaCount.value = result.formulas;
  convertedCount.value = result.converted;

  if (!result.text.trim()) {
    previewHtml.value = '';
    renderError.value = '';
    return;
  }

  try {
    previewHtml.value = renderMarkdownPreview(result.text);
    renderError.value = '';
  } catch (error) {
    previewHtml.value = '';
    renderError.value = error instanceof Error ? error.message : String(error);
  }
}

function schedulePreview() {
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(refreshPreview, 180);
}

watch(input, schedulePreview);

function toggleEditor() {
  if (editorOpen.value && !previewOpen.value) return;
  editorOpen.value = !editorOpen.value;
}

function togglePreview() {
  if (previewOpen.value && !editorOpen.value) return;
  previewOpen.value = !previewOpen.value;
}

function loadSample() {
  if (input.value.trim() && !window.confirm('载入示例会覆盖当前内容，继续？')) return;
  input.value = SAMPLE;
  refreshPreview();
}

function clearInput() {
  if (!input.value) return;
  if (!window.confirm('清空当前内容？')) return;
  input.value = '';
  refreshPreview();
}

async function copyNormalized() {
  refreshPreview();
  if (!normalizedText.value.trim()) return;

  const ok = await copyText(normalizedText.value);
  if (!ok) return;
  copied.value = true;
  window.clearTimeout(copiedTimer);
  copiedTimer = window.setTimeout(() => {
    copied.value = false;
  }, 1500);
}

function buildPdfFilename(): string {
  const heading = normalizedText.value.match(/^\s{0,3}#{1,6}\s+(.+)$/m)?.[1];
  const firstLine = normalizedText.value.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const title = (heading ?? firstLine)
    .replace(/[*_~`>#]/g, '')
    .replace(/\$+/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return title || 'markdown';
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      img.loading = 'eager';
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        window.setTimeout(done, 5000);
        const src = img.getAttribute('src');
        if (src) img.setAttribute('src', src);
      });
    })
  );
}

async function downloadPdf() {
  refreshPreview();
  if (!hasContent.value || !previewHtml.value || !pdfRoot.value) return;

  pdfBusy.value = true;
  pdfError.value = '';
  pdfHtml.value = previewHtml.value;
  try {
    await nextTick();
    if (document.fonts) await document.fonts.ready;
    await waitForImages(pdfRoot.value);

    const { default: html2pdf } = await import('html2pdf.js');
    const contentHeight = Math.max(1, pdfRoot.value.scrollHeight);
    const scale = Math.max(1, Math.min(2, 12000 / contentHeight));
    const options = {
      margin: [10, 10, 12, 10],
      filename: `${buildPdfFilename()}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      enableLinks: true,
      html2canvas: {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['pre', 'table', 'blockquote', 'img', 'h1', 'h2', 'h3', 'h4'],
      },
    };

    // 类型声明里没有 pagebreak 字段，但运行时支持
    await html2pdf().set(options as any).from(pdfRoot.value).save();
  } catch (error) {
    pdfError.value = `PDF 生成失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    pdfBusy.value = false;
    pdfHtml.value = '';
  }
}

let copyConverter: TurndownService | null = null;

function getCopyConverter(): TurndownService {
  if (copyConverter) return copyConverter;
  copyConverter = new TurndownService({
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    headingStyle: 'atx',
    emDelimiter: '*',
    strongDelimiter: '**',
  });
  copyConverter.use(gfm);
  // KaTeX 渲染结果里同时有 MathML 与 HTML 两份文本，复制时用 data-src 还原成 $ 公式源码
  copyConverter.addRule('katex', {
    filter: (node: HTMLElement) => node.nodeName === 'SPAN' && node.classList.contains('katex-wrap'),
    replacement: (_content: string, node: HTMLElement) => node.getAttribute('data-src') || '',
  });
  return copyConverter;
}

function onPreviewCopy(event: ClipboardEvent) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  if (!selection.toString().trim()) return;

  const container = event.currentTarget as HTMLElement;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return;

  const holder = document.createElement('div');
  holder.appendChild(range.cloneContents());
  let markdown = getCopyConverter().turndown(holder.innerHTML);
  // turndown 会转义标题里序号后的点（"1\."），还原成正常写法
  markdown = markdown.replace(/^(#{1,6}\s+\d+)\\\. /gm, '$1. ');

  event.preventDefault();
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', markdown);
    return;
  }
  copyText(markdown);
}

function onPreviewClick(event: MouseEvent) {
  const anchor = (event.target as Element | null)?.closest?.('a');
  if (!anchor) return;

  const href = anchor.getAttribute('href') || '';
  if (!href) return;
  if (href.startsWith('#/')) return;

  event.preventDefault();
  if (href.startsWith('#')) {
    const target = document.getElementById(href.slice(1));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  window.open(anchor.href, '_blank', 'noopener,noreferrer');
}

onBeforeUnmount(() => {
  window.clearTimeout(previewTimer);
  window.clearTimeout(copiedTimer);
});
</script>

<style scoped>
.markdown-parser {
  min-height: 0;
}

.tool-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 14px;
}

.tool-title {
  margin: 0 0 6px;
  font-size: 24px;
  color: #1c3a4a;
}

.tool-desc {
  margin: 0;
  color: #73767a;
  font-size: 14px;
  line-height: 1.6;
}

.tool-desc code,
.format-hint code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f0f7fa;
  border: 1px solid #dbeef7;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.92em;
}

.panes {
  display: flex;
  align-items: stretch;
  gap: 14px;
  height: calc(100vh - 260px);
  min-height: 470px;
  max-height: 900px;
}

.pane {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #fafdff;
}

.pane-rail {
  flex: 0 0 42px;
}

.rail-btn {
  width: 100%;
  height: 100%;
  padding: 12px 0;
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #f4fbff;
  color: #409eff;
  font-size: 13px;
  letter-spacing: 3px;
  writing-mode: vertical-rl;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.rail-btn:hover {
  background: #e9f8ff;
}

.pane-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #e3f1f8;
  background: #f4fbff;
}

.pane-title-wrap {
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.pane-title {
  flex: 0 0 auto;
  color: #1c3a4a;
  font-size: 15px;
  font-weight: 700;
}

.pane-meta {
  overflow: hidden;
  color: #7b8a94;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pane-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}

.mini-btn,
.action-btn,
.icon-btn {
  border: 1px solid #dbeef7;
  border-radius: 7px;
  background: #fff;
  color: #2c5a70;
  font-size: 12.5px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.mini-btn {
  padding: 6px 10px;
}

.action-btn {
  padding: 7px 12px;
  color: #1c6f8c;
  font-weight: 600;
}

.primary {
  border-color: #66ccff;
  background: #66ccff;
  color: #fff;
}

.mini-btn:hover,
.action-btn:hover,
.icon-btn:hover {
  border-color: #66ccff;
  background: #eefaff;
}

.primary:hover {
  border-color: #4bbdf5;
  background: #4bbdf5;
  color: #fff;
}

.action-btn.is-copied {
  border-color: #39c5bb;
  background: #39c5bb;
  color: #fff;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-btn {
  width: 28px;
  height: 28px;
  color: #409eff;
  font-size: 14px;
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.format-hint {
  margin: 0;
  padding: 8px 14px;
  border-bottom: 1px solid #eef7fb;
  background: #fff;
  color: #7b8a94;
  font-size: 12px;
  line-height: 1.6;
}

.editor-textarea {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  border: 0;
  outline: none;
  resize: none;
  background: #fff;
  color: #333;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13.5px;
  line-height: 1.7;
  tab-size: 2;
}

.preview-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  background: #fff;
}

.preview-body {
  box-sizing: border-box;
  min-height: 100%;
  padding: 20px 26px;
}

/* github-markdown-css 会跟随系统深色主题；工具与文章页都使用浅色，这里在容器内固定浅色变量 */
.preview-body {
  color-scheme: light;
  --focus-outlineColor: #0969da;
  --fgColor-default: #1f2328;
  --fgColor-muted: #636c76;
  --fgColor-accent: #0969da;
  --fgColor-success: #1a7f37;
  --fgColor-attention: #9a6700;
  --fgColor-danger: #d1242f;
  --fgColor-done: #8250df;
  --bgColor-default: #ffffff;
  --bgColor-muted: #f6f8fa;
  --bgColor-neutral-muted: #afb8c133;
  --bgColor-attention-muted: #fff8c5;
  --borderColor-default: #d0d7de;
  --borderColor-muted: #d0d7deb3;
  --borderColor-neutral-muted: #afb8c133;
  --borderColor-accent-emphasis: #0969da;
  --borderColor-success-emphasis: #1a7f37;
  --borderColor-attention-emphasis: #bf8700;
  --borderColor-danger-emphasis: #cf222e;
  --borderColor-done-emphasis: #8250df;
}

.empty-hint {
  margin: 0;
  padding: 48px 24px;
  color: #8a969e;
  font-size: 14px;
  text-align: center;
}

.render-error,
.pdf-error {
  margin: 16px 0 0;
  padding: 10px 14px;
  border: 1px solid #f3c9c6;
  border-radius: 8px;
  background: #fff5f4;
  color: #c0392b;
  font-size: 13px;
}

.pdf-error {
  margin-top: 12px;
}

/* ---- 文章正文样式（与文章页保持一致） ---- */
.preview-body :deep(h1) {
  color: #ee0000;
}

.preview-body :deep(h2) {
  color: #66ccff;
}

.preview-body :deep(h3) {
  color: #39c5bb;
}

.preview-body :deep(h4) {
  color: #ecad9e;
}

.preview-body :deep(pre) {
  position: relative;
  padding: 16px;
  overflow: auto;
  border-radius: 6px;
  background-color: rgba(178, 216, 232, 0.05);
  font-size: 0.712em;
  line-height: 1.45;
}

.preview-body :deep(pre code) {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 1em;
  white-space: pre;
}

.preview-body :deep(:not(pre) > code) {
  box-sizing: border-box;
  margin: 0 2px;
  padding: 0 2px;
  border: 1px solid #ddd;
  border-radius: 2px;
  background-color: #fffafa;
  color: #333;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 1em;
}

.preview-body :deep(blockquote) {
  margin-left: 0;
  padding: 0 2em;
  border-left: none;
  background-color: rgba(255, 248, 220, 0.2);
  font-style: normal;
  font-size: 1em;
}

.preview-body :deep(blockquote blockquote) {
  margin-left: -4px;
  padding-left: calc(2ch - 4px);
  padding-right: 0;
  border-left: 4px solid hsl(60, 40%, 70%);
  border-radius: 0;
}

.preview-body :deep(img) {
  max-width: 100%;
}

.preview-body :deep(.katex-display) {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0;
}

/* ---- PDF 排版：屏幕外生成，宽度按 A4 正文区设定 ---- */
.pdf-stage {
  position: fixed;
  top: 0;
  left: -20000px;
  width: 718px;
  pointer-events: none;
}

.pdf-root {
  width: 718px;
  min-height: 0;
  padding: 0;
  background: #fff;
  font-size: 14px;
  line-height: 1.65;
}

.pdf-root :deep(pre),
.pdf-root :deep(table),
.pdf-root :deep(blockquote),
.pdf-root :deep(img),
.pdf-root :deep(.katex-display) {
  break-inside: avoid;
}

@media (max-width: 1100px) {
  .panes {
    flex-direction: column;
    height: auto;
    min-height: 0;
    max-height: none;
  }

  .pane {
    flex: 0 0 auto;
    min-height: 420px;
  }

  .editor-textarea {
    min-height: 360px;
  }

  .preview-pane {
    min-height: 520px;
  }

  .pane-rail {
    flex: 0 0 42px;
    min-height: 42px;
  }

  .rail-btn {
    padding: 0 12px;
    letter-spacing: 0;
    writing-mode: horizontal-tb;
  }
}

@media (max-width: 620px) {
  .pane-head {
    align-items: flex-start;
  }

  .pane-actions {
    width: 100%;
    margin-left: 0;
  }

  .preview-body {
    padding: 16px;
  }
}
</style>
