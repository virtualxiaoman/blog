<template>
  <div class="review-tool">
    <h2 class="tool-title">好评模板</h2>

    <div class="product-row">
      <label class="product-label" for="product-name">商品名</label>
      <input
        id="product-name"
        v-model="productName"
        class="product-input"
        placeholder="不填则用「商品」代替"
      />
    </div>

    <p v-if="loading" class="status">模板加载中…</p>
    <p v-else-if="error" class="status error">{{ error }}</p>

    <ul v-else class="template-list">
      <li v-for="(t, i) in templates" :key="i" class="template-item">
        <div class="template-top">
          <span class="summary-badge">{{ t.summary }}</span>
          <span class="char-count">{{ charCount(t.body) }} 字</span>
          <button
            type="button"
            class="copy-btn"
            :class="{ copied: copiedIdx === i }"
            @click="onCopy(i)"
          >
            {{ copiedIdx === i ? '已复制' : '复制' }}
          </button>
        </div>
        <p class="template-text">{{ fill(t.body) }}</p>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import axios from 'axios';
import { copyText } from '../../../../utils/clipboard';

interface Template {
  summary: string; // 概要（展示用，不参与复制）
  body: string; // 好评正文
}

const templates = ref<Template[]>([]);
const loading = ref(true);
const error = ref('');
const productName = ref('');
const copiedIdx = ref(-1);

// 模板文件约定：每行「概要:正文」；# 开头为注释，空行忽略；{商品} 为商品名占位符。
// 放 public/ 下运行时读取，编辑模板无需重新构建。
onMounted(async () => {
  try {
    const url = `${import.meta.env.BASE_URL}tool/daily/好评模板.txt`;
    const resp = await axios.get(url);
    templates.value = String(resp.data)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const sep = l.indexOf(':'); // 只按第一个冒号切分，正文里再冒号不受影响
        return {
          summary: sep === -1 ? '通用' : l.slice(0, sep).trim(),
          body: sep === -1 ? l : l.slice(sep + 1).trim(),
        };
      });
  } catch {
    error.value = '模板文件加载失败，请确认 public/tool/daily/好评模板.txt 存在';
  } finally {
    loading.value = false;
  }
});

// 商品名替换占位符；不填则用「商品」代替（用 split/join 避免正则转义问题）
function fill(text: string): string {
  const name = productName.value.trim() || '商品';
  return text.split('{商品}').join(name);
}

// 按 Unicode 码点计数（中文、emoji 都算 1 个字符）
function charCount(text: string): number {
  return Array.from(fill(text)).length;
}

async function onCopy(i: number) {
  const ok = await copyText(fill(templates.value[i].body)); // 只复制正文，不复制概要
  if (ok) {
    copiedIdx.value = i;
    setTimeout(() => (copiedIdx.value = -1), 1500);
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

.product-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.product-label {
  font-size: 14px;
  color: #555;
  white-space: nowrap;
}

.product-input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  font-size: 14px;
  background: #fafdff;
  color: #333;
}

.product-input:focus {
  outline: none;
  border-color: #66ccff;
}

.status {
  color: #73767a;
}

.status.error {
  color: #d9534f;
}

.template-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.template-item {
  padding: 14px 16px;
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #fafdff;
  margin-bottom: 12px;
}

/* 第一行：摘要 + 字数 + 复制按钮（横向排布，节省一行空间） */
.template-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.summary-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  background-color: rgba(102, 204, 255, 0.18);
  color: #409eff;
  font-size: 12px;
  font-weight: 600;
}

.template-text {
  margin: 0;
  line-height: 1.7;
  color: #333;
  font-size: 15px;
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
</style>
