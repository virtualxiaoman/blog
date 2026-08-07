<template>
  <div class="replace-tool">
    <h2 class="tool-title">文本替换</h2>
    <p class="tool-desc">将 <code>[公式]</code> 格式转换为 <code>$公式$</code> 格式。</p>

    <label class="option">
      <input v-model="ignoreCode" type="checkbox" />
      忽略代码块与行内代码中的 [ ]（推荐）
    </label>

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
const copied = ref(false);

// 将 [内容] 替换为 $内容$。可选地先保护 fenced code block 与行内代码，
// 避免代码里的 [x] 被误转换（哨兵占位思路与 md2katex 一致）。
function convert(text: string, protectCode: boolean): string {
  let processed = text;
  const blocks: string[] = [];
  const inline: string[] = [];
  if (protectCode) {
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
  if (protectCode) {
    processed = processed.replace(/~!~IC~!~(\d+)~!~/g, (_, i) => inline[+i]);
    processed = processed.replace(/~!~CB~!~(\d+)~!~/g, (_, i) => blocks[+i]);
  }
  return processed;
}

const output = computed(() => convert(input.value, ignoreCode.value));

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

.option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  font-size: 14px;
  color: #555;
  cursor: pointer;
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
