<template>
  <div class="replace-tool">
    <h2 class="tool-title">文本替换</h2>
    <p class="tool-desc">将 <code>[公式]</code> 格式转换为 <code>$公式$</code> 格式，并清理多余换行与等号。</p>

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

    <div class="panes">
      <div class="pane">
        <div class="pane-head">原文</div>
        <textarea
          v-model="input"
          class="pane-text"
          rows="12"
          spellcheck="false"
          placeholder="粘贴包含 [公式] 的文本…"
        ></textarea>
      </div>
      <div class="pane">
        <div class="pane-head">结果</div>
        <textarea :value="output" readonly class="pane-text" rows="12" spellcheck="false"></textarea>
      </div>
    </div>

    <div class="actions">
      <button type="button" class="action-btn" :class="{ copied }" @click="onCopy">
        {{ copied ? '已复制' : '复制结果' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { copyText } from '../../../../utils/clipboard';

const input = ref('');
const ignoreCode = ref(true);
const cleanBlankLines = ref(true); // 默认行为：去除多余换行（折叠空行）
const mergeFormulaLines = ref(false); // 更进一步：合并公式为单行、归一化等号
const copied = ref(false);

// 转换管线：
// 1. （可选）保护 fenced code block 与行内代码，避免 [x] 被误转换（哨兵占位思路与 md2katex 一致）
// 2. [内容] → $内容$
// 3. 默认：去除多余空行（折叠连续换行为单个换行）
// 4. 更进一步：把公式里的 ==== 对齐等号行合并为单个 =、去掉冒号后多余的断行
// 5. 还原被保护的代码
function convert(
  text: string,
  opts: { ignoreCode: boolean; cleanBlankLines: boolean; mergeFormulaLines: boolean }
): string {
  let processed = text;
  const blocks: string[] = [];
  const inline: string[] = [];
  if (opts.ignoreCode) {
    processed = processed.replace(/```[\s\S]*?```/g, (b) => {
      blocks.push(b);
      return `~!~CB~!~${blocks.length - 1}~!~`;
    });
    processed = processed.replace(/`[^`\n]+`/g, (c) => {
      inline.push(c);
      return `~!~IC~!~${inline.length - 1}~!~`;
    });
  }
  processed = processed.replace(/\[([^\]]+)\]/g, (_, p1: string) => `$${p1}$`);

  // 默认行为：去除多余换行（折叠连续空行为单个换行）
  if (opts.cleanBlankLines) {
    processed = processed.replace(/[ \t]*\r?\n[ \t]*\r?\n+/g, '\n');
  }

  // 更进一步：归一化公式里的 ==== 对齐等号行、合并冒号后的断行。
  // 注意顺序在去除空行之后（等号行前后已无空行干扰）。
  if (opts.mergeFormulaLines) {
    // "A\n======\nB" → "A=B"（ChatGPT 常用整行等号做对齐分隔符）
    processed = processed.replace(
      /(\$\$?)([^\n]+?)(\$\$?)\n[ \t]*={2,}[ \t]*\n(\$\$?)([^\n]+?)(\$\$?)/g,
      (_, o1, a, _c1, _o2, b, c2) => `${o1}${a}=${b}${c2}`
    );
    // 冒号结尾的行与其后内容合并为一行，但紧跟公式定界符（$/$$）时不合并
    processed = processed.replace(/([：:])\s*\n(?!\s*\$)/g, '$1');
  }

  if (opts.ignoreCode) {
    processed = processed.replace(/~!~IC~!~(\d+)~!~/g, (_, i) => inline[+i]);
    processed = processed.replace(/~!~CB~!~(\d+)~!~/g, (_, i) => blocks[+i]);
  }
  return processed;
}

const output = computed(() =>
  convert(input.value, {
    ignoreCode: ignoreCode.value,
    cleanBlankLines: cleanBlankLines.value,
    mergeFormulaLines: mergeFormulaLines.value,
  })
);

async function onCopy() {
  const ok = await copyText(output.value);
  if (ok) {
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  }
}
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

.tool-desc code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f0f7fa;
  border: 1px solid #dbeef7;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.92em;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-bottom: 14px;
}

.option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
}

.panes {
  display: flex;
  gap: 16px;
}

.pane {
  flex: 1;
  min-width: 0;
}

.pane-head {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 6px;
}

.pane-text {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  background: #fafdff;
  color: #333;
}

.pane-text:focus {
  outline: none;
  border-color: #66ccff;
}

.actions {
  margin-top: 16px;
}

.action-btn {
  padding: 8px 22px;
  border: none;
  border-radius: 8px;
  background-color: #66ccff;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.action-btn:hover {
  background-color: #4bbdf5;
}

.action-btn.copied {
  background-color: #39c5bb;
}
</style>
