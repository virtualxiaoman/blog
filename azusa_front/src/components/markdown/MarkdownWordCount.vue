<template>
  <span class="markdown-word-count">{{ wordCount }} 字</span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import axios from 'axios';
import { countHanzi, countWords, stripMarkdown } from '../../utils/textStats';
import { resolveMarkdownSource } from '../../utils/markdownSource';

const props = defineProps<{
  /** public/ 下的 Markdown 相对路径。 */
  source: string;
}>();

const wordCount = ref(0);
let requestId = 0;

async function updateWordCount(source: string) {
  const id = ++requestId;
  wordCount.value = 0;

  try {
    const response = await axios.get(resolveMarkdownSource(source));
    if (id !== requestId) return;
    const text = stripMarkdown(String(response.data));
    wordCount.value = countHanzi(text) + countWords(text);
  } catch {
    if (id === requestId) wordCount.value = 0;
  }
}

watch(() => props.source, updateWordCount, { immediate: true });
</script>

<style scoped>
.markdown-word-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  color: #39c5bb;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
</style>
