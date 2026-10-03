<template>
  <div class="reading-tool">
    <h2 class="tool-title">辅助阅读</h2>
    <p class="tool-desc">
      填写待学习文件与笔记的路径，自动替换模板中的 <code>[path1]</code> / <code>[path2]</code>，复制后粘贴给 AI 使用。
    </p>

    <div class="path-row">
      <label class="path-label" for="paper-path">论文原文</label>
      <input
        id="paper-path"
        v-model="paperPath"
        class="path-input"
        placeholder="path1：待学习文件的路径"
      />
    </div>
    <div class="path-row">
      <label class="path-label" for="note-path">学习笔记</label>
      <input
        id="note-path"
        v-model="notePath"
        class="path-input"
        placeholder="path2：笔记文件的路径"
      />
    </div>
    <p class="hint">未填写的路径会保留对应的 [path1] / [path2] 占位符。</p>

    <p v-if="loading" class="status">模板加载中…</p>
    <p v-else-if="error" class="status error">{{ error }}</p>

    <template v-else>
      <div class="result-head">
        <span class="result-title">生成结果</span>
        <span class="char-count">{{ charCount }} 字</span>
        <button type="button" class="copy-btn" :class="{ copied }" @click="onCopy">
          {{ copied ? '已复制' : '复制' }}
        </button>
      </div>
      <textarea class="result-text" readonly :value="generated" spellcheck="false"></textarea>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import axios from 'axios';
import { copyText } from '../../../../utils/clipboard';

const template = ref('');
const loading = ref(true);
const error = ref('');
const paperPath = ref('');
const notePath = ref('');
const copied = ref(false);

// 模板放 public/ 下运行时读取，编辑提示词无需重新构建
onMounted(async () => {
  try {
    const url = `${import.meta.env.BASE_URL}tool/study/辅助阅读.md`;
    const resp = await axios.get(url);
    template.value = String(resp.data);
  } catch {
    error.value = '模板文件加载失败，请确认 public/tool/study/辅助阅读.md 存在';
  } finally {
    loading.value = false;
  }
});

// 用 split/join 替换占位符（用户输入可能含 $ 等正则特殊字符）；空路径保留占位符
const generated = computed(() => {
  let text = template.value;
  const p1 = paperPath.value.trim();
  const p2 = notePath.value.trim();
  if (p1) text = text.split('[path1]').join(p1);
  if (p2) text = text.split('[path2]').join(p2);
  return text;
});

// 按 Unicode 码点计数（中文、emoji 都算 1 个字符）
const charCount = computed(() => Array.from(generated.value).length);

async function onCopy() {
  if (!template.value) return;
  const ok = await copyText(generated.value);
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

.path-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.path-label {
  width: 72px;
  flex-shrink: 0;
  font-size: 14px;
  color: #555;
  text-align: right;
}

.path-input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  font-size: 14px;
  font-family: Consolas, 'Courier New', monospace;
  background: #fafdff;
  color: #333;
}

.path-input:focus {
  outline: none;
  border-color: #66ccff;
}

.hint {
  margin: 0 0 18px;
  padding-left: 82px;
  font-size: 13px;
  color: #9aa4ad;
}

.status {
  color: #73767a;
}

.status.error {
  color: #d9534f;
}

.result-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.result-title {
  font-size: 14px;
  font-weight: 600;
  color: #1c3a4a;
}

.char-count {
  font-size: 13px;
  color: #73767a;
}

/* 复制按钮推到最右 */
.copy-btn {
  margin-left: auto;
  padding: 5px 16px;
  border: none;
  border-radius: 7px;
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

.result-text {
  display: block;
  width: 100%;
  min-height: 420px;
  max-height: 70vh;
  padding: 12px 14px;
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #fafdff;
  color: #333;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
}

.result-text:focus {
  outline: none;
  border-color: #66ccff;
}
</style>
