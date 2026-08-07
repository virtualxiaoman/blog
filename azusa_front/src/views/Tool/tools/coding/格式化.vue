<template>
  <div class="format-tool">
    <h2 class="tool-title">格式化</h2>
    <p class="tool-desc">格式化或压缩 JSON / YAML / HTML，带语法校验与错误提示。</p>

    <div class="format-bar">
      <div class="seg">
        <button
          v-for="f in formats"
          :key="f"
          type="button"
          class="seg-btn"
          :class="{ active: format === f }"
          @click="format = f"
        >
          {{ f }}
        </button>
      </div>
      <div class="actions">
        <button type="button" class="mini-btn" @click="mode = 'format'">格式化</button>
        <button type="button" class="mini-btn" @click="mode = 'minify'">压缩</button>
        <button type="button" class="mini-btn" :class="{ copied }" @click="onCopy">
          {{ copied ? '已复制' : '复制结果' }}
        </button>
      </div>
    </div>

    <div class="panes">
      <div class="pane">
        <div class="pane-head">输入</div>
        <textarea v-model="input" class="pane-text" rows="14" spellcheck="false" placeholder="粘贴内容…"></textarea>
      </div>
      <div class="pane">
        <div class="pane-head">输出</div>
        <textarea :value="output" readonly class="pane-text" rows="14" spellcheck="false"></textarea>
      </div>
    </div>

    <p v-if="error" class="error-msg">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { copyText } from '../../../../utils/clipboard';

type Format = 'JSON' | 'YAML' | 'HTML';

const formats: Format[] = ['JSON', 'YAML', 'HTML'];
const format = ref<Format>('JSON');
const mode = ref<'format' | 'minify'>('format');
const input = ref('');
const error = ref('');
const copied = ref(false);

const output = computed(() => {
  error.value = '';
  const raw = input.value;
  if (!raw.trim()) return '';
  try {
    if (format.value === 'JSON') {
      const obj = JSON.parse(raw);
      return mode.value === 'format' ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
    }
    if (format.value === 'YAML') {
      const obj = parseYaml(raw);
      return mode.value === 'format' ? stringifyYaml(obj) : JSON.stringify(obj);
    }
    // HTML
    return mode.value === 'format' ? formatHtml(raw) : minifyHtml(raw);
  } catch (e) {
    error.value = `解析失败：${e instanceof Error ? e.message : String(e)}`;
    return '';
  }
});

// 简单 HTML 格式化：按标签缩进
function formatHtml(html: string): string {
  const tokens = html
    .replace(/<!--[\s\S]*?-->/g, '') // 去注释
    .replace(/>\s+</g, '><') // 去标签间多余空白
    .match(/<[^>]+>|[^<]+/g) ?? [];
  let indent = 0;
  const out: string[] = [];
  const voidTags = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
  for (const tok of tokens) {
    const trimmed = tok.trim();
    if (!trimmed) continue;
    const isClose = /^<\//.test(trimmed);
    const isOpen = /^<[^/!][^>]*>/.test(trimmed);
    const tagName = (trimmed.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/) ?? [])[1]?.toLowerCase();
    if (isClose) indent = Math.max(0, indent - 1);
    out.push('  '.repeat(indent) + trimmed);
    if (isOpen && !isClose && tagName && !voidTags.has(tagName) && !/\/>$/.test(trimmed)) indent++;
  }
  return out.join('\n');
}

function minifyHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\n+/g, '')
    .trim();
}

// 切换格式/模式时清空错误提示
watch([format, mode], () => (error.value = ''));

async function onCopy() {
  if (!output.value) return;
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

.format-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.seg {
  display: inline-flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #dbeef7;
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

.actions {
  display: flex;
  gap: 8px;
}

.mini-btn {
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

.mini-btn:hover {
  background-color: #4bbdf5;
}

.mini-btn.copied {
  background-color: #39c5bb;
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
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  background: #fafdff;
  color: #333;
}

.pane-text:focus {
  outline: none;
  border-color: #66ccff;
}

.error-msg {
  margin: 12px 0 0;
  color: #d9534f;
  font-size: 13px;
  word-break: break-all;
}
</style>
