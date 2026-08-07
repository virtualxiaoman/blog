<template>
  <div class="stats-tool">
    <h2 class="tool-title">字数统计</h2>
    <p class="tool-desc">统计一段文本的字符数、汉字数、单词数、段落数、行数、标点、空格与表情符号。</p>

    <textarea
      v-model="text"
      class="input-area"
      rows="10"
      spellcheck="false"
      placeholder="在此粘贴或输入文本…"
    ></textarea>

    <ul class="stats-grid">
      <li v-for="item in stats" :key="item.label" class="stat-item">
        <span class="stat-value">{{ item.value }}</span>
        <span class="stat-label">{{ item.label }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { analyzeText } from '../../../../utils/textStats';

const text = ref('');

const data = computed(() => analyzeText(text.value));

// 顺序与展示名：字符数、汉字数、单词数、段落数、行数、标点符号、空格数、表情符号
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

.input-area:focus {
  outline: none;
  border-color: #66ccff;
}

.stats-grid {
  list-style: none;
  margin: 18px 0 0;
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
  background: #fafdff;
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
