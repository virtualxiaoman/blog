<template>
  <div class="text-process">
    <h2 class="tool-title">文本处理</h2>
    <p class="tool-desc">在一个界面里完成文本替换、去除换行与字数统计：粘贴原文，三个结果同步生成。</p>

    <div class="input-block">
      <div class="block-head">原文</div>
      <textarea
        v-model="input"
        class="input-area"
        rows="8"
        spellcheck="false"
        placeholder="在此粘贴或输入文本…"
      ></textarea>
    </div>

    <!-- 1. 文本替换 -->
    <section class="block">
      <div class="block-head">
        <span class="block-title">文本替换</span>
        <span class="block-sub">将 <code>[公式]</code> / <code>\(公式\)</code> 转换为 <code>$公式$</code>，<code>\[公式\]</code> 转换为 <code>$$公式$$</code></span>
      </div>

      <div class="options">
        <label class="option">
          <input v-model="ignoreCode" type="checkbox" />
          忽略代码块与行内代码中的 [ ]（推荐）
        </label>
        <label class="option">
          <input v-model="cleanBlankLines" type="checkbox" />
          去除多余换行
        </label>
        <label class="option">
          <input v-model="mergeFormulaLines" type="checkbox" />
          更进一步：合并公式为单行、归一化等号
        </label>
      </div>

      <div class="pane-row">
        <textarea :value="replaceOutput" readonly class="pane-text" rows="6" spellcheck="false"></textarea>
        <button type="button" class="copy-btn" :class="{ copied: replaceCopied }" @click="copyReplace">
          {{ replaceCopied ? '已复制' : '复制' }}
        </button>
      </div>
    </section>

    <!-- 2. 去除换行 -->
    <section class="block">
      <div class="block-head">
        <span class="block-title">去除换行</span>
        <span class="block-sub">合并折行文本：空行分隔的段落保留，段落内折行拼接为连续文本</span>
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

      <div class="pane-row">
        <textarea :value="unwrapOutput" readonly class="pane-text" rows="6" spellcheck="false"></textarea>
        <button type="button" class="copy-btn" :class="{ copied: unwrapCopied }" @click="copyUnwrap">
          {{ unwrapCopied ? '已复制' : '复制' }}
        </button>
      </div>
    </section>

    <!-- 3. 字数统计 -->
    <section class="block">
      <div class="block-head">
        <span class="block-title">字数统计</span>
        <span class="block-sub">字符数、汉字数、单词数、段落数等统计指标</span>
      </div>

      <ul class="stats-grid">
        <li v-for="item in stats" :key="item.label" class="stat-item">
          <span class="stat-value">{{ item.value }}</span>
          <span class="stat-label">{{ item.label }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { copyText } from '../../../../utils/clipboard';
import { analyzeText } from '../../../../utils/textStats';

const input = ref('');

/* ---------- 文本替换 ---------- */
const ignoreCode = ref(true);
const cleanBlankLines = ref(true);
const mergeFormulaLines = ref(false);

// 转换管线：
// 1. （可选）保护 fenced code block 与行内代码，避免 [x] / \(...\) / \[...\] 被误转换（哨兵占位思路与 md2katex 一致）
// 2. \[...\] / \(...\) → 先占位（LaTeX 公式，可能多行，且内容可能含 ] 如 bmatrix / \left[）
// 3. [内容] → $内容$
// 4. 默认：去除多余空行（折叠连续换行为单个换行）
// 5. 更进一步：把公式里的 ==== 对齐等号行合并为单个 =、去掉冒号后多余的断行
// 6. 还原被保护的代码，并把占位转成 $...$（行内）与 $$...$$（块级，多行成块）
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
  // 先占位 LaTeX 公式：\(...\) 行内、\[...\] 块级，避免多行/含 [] 时被下方 [x] 规则误拆
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
    // "A\n======\nB" → "A=B"（ChatGPT 常用整行等号做对齐分隔符）
    processed = processed.replace(
      /(\$\$?)([^\n]+?)(\$\$?)\n[ \t]*={2,}[ \t]*\n(\$\$?)([^\n]+?)(\$\$?)/g,
      (_, o1, a, _c1, _o2, b, c2) => `${o1}${a}=${b}${c2}`
    );
    // 冒号结尾的行与其后内容合并为一行，但紧跟公式定界符（$/$$）时不合并
    processed = processed.replace(/([：:])\s*\n(?!\s*\$)/g, '$1');
  }

  if (ignoreCode.value) {
    processed = processed.replace(/~!~IC~!~(\d+)~!~/g, (_, i) => inline[+i]);
    processed = processed.replace(/~!~CB~!~(\d+)~!~/g, (_, i) => blocks[+i]);
  }
  // 还原 \(...\) 占位 → $...$（行内）
  processed = processed.replace(/~!~IM~!~(\d+)~!~/g, (_, i) => {
    const inner = imath[+i].trim();
    return `$${inner}$`;
  });
  // 还原 \[...\] 占位 → $$...$$：多行成块，单行行内
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

// 判断相邻字符是否含 CJK（中文连排时拼接不加空格，否则插入一个空格）
function isCjk(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK 统一汉字
    (code >= 0x3400 && code <= 0x4dbf) || // 扩展 A
    (code >= 0x3000 && code <= 0x303f) || // CJK 标点
    (code >= 0xff00 && code <= 0xffef) || // 全角字符
    (code >= 0x3040 && code <= 0x30ff) || // 平假名 + 片假名
    (code >= 0xac00 && code <= 0xd7af) // 谚文音节
  );
}

// 拼接单段：相邻行按 CJK 情况加或不加空格
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

// 合并段落内换行：空行作为段落分隔，段内折行合并为一行
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

// 全部合并为一行：忽略段落，所有行连成一段
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
</script>

<style scoped>
.tool-title {
  margin: 0 0 6px;
  font-size: 24px;
  color: #1c3a4a;
}

.tool-desc {
  margin: 0 0 16px;
  color: #73767a;
}

.input-block {
  margin-bottom: 18px;
}

.block {
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #fafdff;
  padding: 16px 18px;
}

.block + .block {
  margin-top: 18px;
}

.block-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-bottom: 12px;
}

.block-title {
  font-size: 17px;
  font-weight: 700;
  color: #1c3a4a;
}

.block-sub {
  font-size: 12px;
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

.input-area {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  background: #fafdff;
  color: #333;
}

.input-area:focus,
.pane-text:focus {
  outline: none;
  border-color: #66ccff;
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
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #dbeef7;
  margin-bottom: 12px;
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

.pane-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.pane-text {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  background: #fff;
  color: #333;
}

.copy-btn {
  flex-shrink: 0;
  padding: 8px 16px;
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
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
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
</style>
