<template>
  <div class="text-process">
    <h2 class="tool-title">文本处理</h2>

    <!-- 原文：第一列第一行 -->
    <section class="block input-block">
      <div class="block-head">
        <div class="block-head-content">
          <span class="block-title">原文</span>
        </div>
      </div>
      <div class="text-editor">
        <div ref="inputLineNumbers" class="line-numbers" aria-hidden="true">
          <span v-for="(line, index) in inputLineRows" :key="index">{{ line }}</span>
        </div>
        <textarea
          ref="inputTextarea"
          v-model="input"
          class="editor-textarea"
          rows="10"
          spellcheck="false"
          placeholder="在此粘贴或输入文本…"
          @scroll="syncScroll($event.currentTarget as HTMLTextAreaElement, inputLineNumbers)"
        ></textarea>
        <div ref="inputMeasurer" class="line-measurer" aria-hidden="true">
          <span v-for="(line, index) in inputLogicalLines" :key="index">{{ line || ' ' }}</span>
        </div>
      </div>
    </section>

    <!-- 字数统计：第二列第一行 -->
    <section class="block stats-block">
      <div class="block-head">
        <div class="block-head-content">
          <span class="block-title">字数统计</span>
          <span class="block-sub">字符数、汉字数、单词数、段落数等统计指标</span>
        </div>
      </div>
      <ul class="stats-grid">
        <li v-for="item in stats" :key="item.label" class="stat-item">
          <span class="stat-value">{{ item.value }}</span>
          <span class="stat-label">{{ item.label }}</span>
        </li>
      </ul>
    </section>

    <!-- 文本替换：第一列第二行 -->
    <section class="block">
      <div class="block-head">
        <div class="block-head-content">
          <span class="block-title">文本替换</span>
          <span class="block-sub">
            将 <code>[公式]</code> / <code>\(公式\)</code> 转换为 <code>$公式$</code>，<code>\[公式\]</code> 转换为 <code>$$公式$$</code>
          </span>
        </div>
        <button type="button" class="copy-btn" :class="{ copied: replaceCopied }" @click="copyReplace">
          {{ replaceCopied ? '已复制' : '复制' }}
        </button>
      </div>

      <div class="options">
        <label class="option" title="忽略代码块与行内代码中的 [ ]">
          <input v-model="ignoreCode" type="checkbox" />
          忽略代码（推荐）
        </label>
        <label class="option" title="将连续空行合并为一个换行">
          <input v-model="cleanBlankLines" type="checkbox" />
          合并多余换行
        </label>
        <label class="option" title="合并公式为单行，并归一化等号">
          <input v-model="mergeFormulaLines" type="checkbox" />
          公式单行化
        </label>
      </div>

      <div class="text-editor">
        <div ref="replaceLineNumbers" class="line-numbers" aria-hidden="true">
          <span v-for="(line, index) in replaceLineRows" :key="index">{{ line }}</span>
        </div>
        <textarea
          ref="replaceTextarea"
          :value="replaceOutput"
          readonly
          class="editor-textarea"
          rows="10"
          spellcheck="false"
          @scroll="syncScroll($event.currentTarget as HTMLTextAreaElement, replaceLineNumbers)"
        ></textarea>
        <div ref="replaceMeasurer" class="line-measurer" aria-hidden="true">
          <span v-for="(line, index) in replaceLogicalLines" :key="index">{{ line || ' ' }}</span>
        </div>
      </div>
    </section>

    <!-- 去除换行：第二列第二行 -->
    <section class="block">
      <div class="block-head">
        <div class="block-head-content">
          <span class="block-title">去除换行</span>
          <span class="block-sub">合并折行文本，保留段落边界</span>
        </div>
        <button type="button" class="copy-btn" :class="{ copied: unwrapCopied }" @click="copyUnwrap">
          {{ unwrapCopied ? '已复制' : '复制' }}
        </button>
      </div>

      <div class="seg">
        <button
          v-for="m in unwrapModes"
          :key="m"
          type="button"
          class="seg-btn"
          :class="{ active: unwrapMode === m }"
          @click="unwrapMode = m"
        >
          {{ m }}
        </button>
      </div>

      <div class="text-editor">
        <div ref="unwrapLineNumbers" class="line-numbers" aria-hidden="true">
          <span v-for="(line, index) in unwrapLineRows" :key="index">{{ line }}</span>
        </div>
        <textarea
          ref="unwrapTextarea"
          :value="unwrapOutput"
          readonly
          class="editor-textarea"
          rows="10"
          spellcheck="false"
          @scroll="syncScroll($event.currentTarget as HTMLTextAreaElement, unwrapLineNumbers)"
        ></textarea>
        <div ref="unwrapMeasurer" class="line-measurer" aria-hidden="true">
          <span v-for="(line, index) in unwrapLogicalLines" :key="index">{{ line || ' ' }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { copyText } from '../../../../utils/clipboard';
import { analyzeText } from '../../../../utils/textStats';

const input = ref('');

/* ---------- 文本替换 ---------- */
const ignoreCode = ref(true);
const cleanBlankLines = ref(true);
const mergeFormulaLines = ref(false);

// 转换管线：
// 1. （可选）保护 fenced code block 与行内代码，避免 [x] / \(...\) / \[...\] 被误转换
// 2. \[...\] / \(...\) → 先占位，避免多行公式或公式中的 [] 被下方规则误拆
// 3. [内容] → $内容$
// 4. 默认：去除多余空行（折叠连续换行为单个换行）
// 5. 更进一步：把公式里的 ==== 对齐等号行合并为单个 =、去掉冒号后多余的断行
function convertReplace(text: string): string {
  let processed = text;
  const blocks: string[] = [];
  const inline: string[] = [];
  const imath: string[] = [];
  const dmath: string[] = [];

  if (ignoreCode.value) {
    processed = processed.replace(/```[\s\S]*?```/g, (b) => {
      blocks.push(b);
      return `~!~CB~!~${blocks.length - 1}~!~`;
    });
    processed = processed.replace(/`[^`\n]+`/g, (c) => {
      inline.push(c);
      return `~!~IC~!~${inline.length - 1}~!~`;
    });
  }

  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, p: string) => {
    imath.push(p);
    return `~!~IM~!~${imath.length - 1}~!~`;
  });
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, p: string) => {
    dmath.push(p);
    return `~!~DM~!~${dmath.length - 1}~!~`;
  });
  processed = processed.replace(/\[([^\]]+)\]/g, (_, p1: string) => `$${p1}$`);

  if (cleanBlankLines.value) {
    processed = processed.replace(/[ \t]*\r?\n[ \t]*\r?\n+/g, '\n');
  }

  if (mergeFormulaLines.value) {
    processed = processed.replace(
      /(\$\$?)([^\n]+?)(\$\$?)\n[ \t]*={2,}[ \t]*\n(\$\$?)([^\n]+?)(\$\$?)/g,
      (_, o1, a, _c1, _o2, b, c2) => `${o1}${a}=${b}${c2}`
    );
    processed = processed.replace(/([：:])\s*\n(?!\s*\$)/g, '$1');
  }

  if (ignoreCode.value) {
    processed = processed.replace(/~!~IC~!~(\d+)~!~/g, (_, i) => inline[+i]);
    processed = processed.replace(/~!~CB~!~(\d+)~!~/g, (_, i) => blocks[+i]);
  }
  processed = processed.replace(/~!~IM~!~(\d+)~!~/g, (_, i) => `$${imath[+i].trim()}$`);
  processed = processed.replace(/~!~DM~!~(\d+)~!~/g, (_, i) => {
    const raw = dmath[+i];
    const inner = raw.trim();
    return /\n/.test(raw) ? `$$\n${inner}\n$$` : `$$ ${inner} $$`;
  });
  return processed;
}

const replaceOutput = computed(() => convertReplace(input.value));
const replaceCopied = ref(false);

async function copyReplace() {
  if (!replaceOutput.value) return;
  const ok = await copyText(replaceOutput.value);
  if (ok) {
    replaceCopied.value = true;
    setTimeout(() => (replaceCopied.value = false), 1500);
  }
}

/* ---------- 去除换行 ---------- */
const unwrapModes = ['合并段落内换行', '全部合并为一行'] as const;
type UnwrapMode = (typeof unwrapModes)[number];
const unwrapMode = ref<UnwrapMode>('合并段落内换行');

function isCjk(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xffef) ||
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0xac00 && code <= 0xd7af)
  );
}

function joinLines(lines: string[]): string {
  let acc = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!acc) {
      acc = trimmed;
      continue;
    }
    const sep = isCjk(acc[acc.length - 1]) || isCjk(trimmed[0]) ? '' : ' ';
    acc += sep + trimmed;
  }
  return acc;
}

function unwrapByParagraph(text: string): string {
  const paragraphs: string[][] = [];
  let cur: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      if (cur.length) {
        paragraphs.push(cur);
        cur = [];
      }
    } else {
      cur.push(line);
    }
  }
  if (cur.length) paragraphs.push(cur);
  return paragraphs.map(joinLines).join('\n');
}

function unwrapAll(text: string): string {
  return joinLines(text.split(/\r?\n/));
}

const unwrapOutput = computed(() =>
  unwrapMode.value === '全部合并为一行' ? unwrapAll(input.value) : unwrapByParagraph(input.value)
);
const unwrapCopied = ref(false);

async function copyUnwrap() {
  if (!unwrapOutput.value) return;
  const ok = await copyText(unwrapOutput.value);
  if (ok) {
    unwrapCopied.value = true;
    setTimeout(() => (unwrapCopied.value = false), 1500);
  }
}

/* ---------- 字数统计 ---------- */
const data = computed(() => analyzeText(input.value));
const stats = computed(() => [
  { label: '字符数', value: data.value.chars },
  { label: '汉字数', value: data.value.hanzi },
  { label: '单词数', value: data.value.words },
  { label: '段落数', value: data.value.paragraphs },
  { label: '行数', value: data.value.lines },
  { label: '标点符号', value: data.value.punctuation },
  { label: '空格数', value: data.value.spaces },
  { label: '表情符号', value: data.value.emoji },
]);

/* ---------- VS Code 风格行号 ---------- */
const inputTextarea = ref<HTMLTextAreaElement | null>(null);
const replaceTextarea = ref<HTMLTextAreaElement | null>(null);
const unwrapTextarea = ref<HTMLTextAreaElement | null>(null);
const inputLineNumbers = ref<HTMLDivElement | null>(null);
const replaceLineNumbers = ref<HTMLDivElement | null>(null);
const unwrapLineNumbers = ref<HTMLDivElement | null>(null);
const inputMeasurer = ref<HTMLDivElement | null>(null);
const replaceMeasurer = ref<HTMLDivElement | null>(null);
const unwrapMeasurer = ref<HTMLDivElement | null>(null);

const inputLogicalLines = computed(() => input.value.split(/\r?\n/));
const replaceLogicalLines = computed(() => replaceOutput.value.split(/\r?\n/));
const unwrapLogicalLines = computed(() => unwrapOutput.value.split(/\r?\n/));
const inputLineRows = ref<string[]>(['1']);
const replaceLineRows = ref<string[]>(['1']);
const unwrapLineRows = ref<string[]>(['1']);

type EditorParts = {
  textarea: typeof inputTextarea;
  lineNumbers: typeof inputLineNumbers;
  measurer: typeof inputMeasurer;
  logicalLines: typeof inputLogicalLines;
  lineRows: typeof inputLineRows;
};

const editors: EditorParts[] = [
  { textarea: inputTextarea, lineNumbers: inputLineNumbers, measurer: inputMeasurer, logicalLines: inputLogicalLines, lineRows: inputLineRows },
  { textarea: replaceTextarea, lineNumbers: replaceLineNumbers, measurer: replaceMeasurer, logicalLines: replaceLogicalLines, lineRows: replaceLineRows },
  { textarea: unwrapTextarea, lineNumbers: unwrapLineNumbers, measurer: unwrapMeasurer, logicalLines: unwrapLogicalLines, lineRows: unwrapLineRows },
];

function syncScroll(textarea: HTMLTextAreaElement | null, lineNumbers: HTMLDivElement | null) {
  if (textarea && lineNumbers) {
    lineNumbers.scrollTop = textarea.scrollTop;
  }
}

function measureEditor(editor: EditorParts) {
  const textarea = editor.textarea.value;
  const measurer = editor.measurer.value;
  if (!textarea || !measurer) return;

  const style = window.getComputedStyle(textarea);
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;
  const contentWidth = Math.max(0, textarea.clientWidth - paddingLeft - paddingRight);
  const fontSize = parseFloat(style.fontSize) || 13;
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.6;

  measurer.style.width = `${contentWidth}px`;
  measurer.style.fontFamily = style.fontFamily;
  measurer.style.fontSize = style.fontSize;
  measurer.style.fontWeight = style.fontWeight;
  measurer.style.letterSpacing = style.letterSpacing;
  measurer.style.lineHeight = style.lineHeight;
  measurer.style.whiteSpace = 'pre-wrap';
  measurer.style.overflowWrap = 'break-word';
  measurer.style.wordBreak = 'break-word';

  const rows: string[] = [];
  Array.from(measurer.children).forEach((child, index) => {
    const height = (child as HTMLElement).getBoundingClientRect().height;
    const visualRows = Math.max(1, Math.round(height / lineHeight));
    rows.push(String(index + 1));
    for (let row = 1; row < visualRows; row += 1) rows.push('');
  });

  editor.lineRows.value = rows.length ? rows : ['1'];
  syncScroll(editor.textarea.value, editor.lineNumbers.value);
}

let measureFrame = 0;
function scheduleMeasure() {
  if (measureFrame) cancelAnimationFrame(measureFrame);
  nextTick(() => {
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0;
      editors.forEach(measureEditor);
    });
  });
}

let resizeObserver: ResizeObserver | null = null;
watch(
  [input, replaceOutput, unwrapOutput, unwrapMode],
  () => scheduleMeasure(),
  { flush: 'post' }
);

onMounted(() => {
  resizeObserver = new ResizeObserver(() => scheduleMeasure());
  [inputTextarea, replaceTextarea, unwrapTextarea].forEach((textarea) => {
    if (textarea.value) resizeObserver?.observe(textarea.value);
  });
  scheduleMeasure();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (measureFrame) cancelAnimationFrame(measureFrame);
});
</script>

<style scoped>
.tool-title {
  grid-column: 1 / -1;
  margin: 0 0 16px;
  font-size: 24px;
  color: #1c3a4a;
}

.text-process {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  align-items: start;
}

.block {
  min-width: 0;
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #fafdff;
  padding: 16px 18px;
}

.block-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}

.block-head-content {
  min-width: 0;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.block-title {
  flex: 0 0 auto;
  font-size: 17px;
  font-weight: 700;
  color: #1c3a4a;
}

.block-sub {
  min-width: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #73767a;
}

.block-sub code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f0f7fa;
  border: 1px solid #dbeef7;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.92em;
}

.text-editor {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.editor-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  padding: 10px 12px 10px 52px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: break-word;
  word-break: break-word;
  resize: vertical;
  background: #fff;
  color: #333;
}

.editor-textarea:focus {
  outline: none;
  border-color: #66ccff;
}

.line-numbers {
  position: absolute;
  z-index: 1;
  top: 1px;
  bottom: 1px;
  left: 1px;
  width: 43px;
  box-sizing: border-box;
  padding: 10px 8px 10px 0;
  overflow: hidden;
  border-radius: 8px 0 0 8px;
  background: #f7f9fa;
  color: #aab3ba;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  text-align: right;
  user-select: none;
  pointer-events: none;
}

.line-numbers span {
  display: block;
  height: 1.6em;
  white-space: pre;
}

.line-measurer {
  position: absolute;
  left: -100000px;
  top: 0;
  visibility: hidden;
  box-sizing: content-box;
  padding: 0;
  border: 0;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-word;
}

.line-measurer span {
  display: block;
  min-height: 1.6em;
  white-space: pre-wrap;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-bottom: 12px;
}

.option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
}

.seg {
  display: inline-flex;
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid #dbeef7;
  border-radius: 8px;
}

.seg-btn {
  padding: 6px 16px;
  border: none;
  background: #fff;
  color: #1c3a4a;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.seg-btn + .seg-btn {
  border-left: 1px solid #dbeef7;
}

.seg-btn.active {
  background-color: #66ccff;
  color: #fff;
}

.copy-btn {
  flex: 0 0 auto;
  margin-left: auto;
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  background-color: #66ccff;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.copy-btn:hover {
  background-color: #4bbdf5;
}

.copy-btn.copied {
  background-color: #39c5bb;
}

.stats-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #fff;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #409eff;
}

.stat-label {
  font-size: 12px;
  color: #73767a;
}

@media (max-width: 800px) {
  .text-process {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 520px) {
  .block-head-content {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }

  .block-head:has(.copy-btn) {
    flex-wrap: wrap;
  }

  .copy-btn {
    margin-left: 0;
  }
}
</style>
