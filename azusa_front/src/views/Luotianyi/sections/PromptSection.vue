<template>
  <MarkdownDocumentPage
    source="lty/prompt/lty_prompt.md"
    variant="compact"
    :features="promptFeatures"
  />
</template>

<script setup lang="ts">
import MarkdownDocumentPage, { type MarkdownPageFeatures } from '../../../components/markdown/MarkdownDocumentPage.vue';

// 提示词页只保留正文解析、复制全文和回到顶部；不显示文章大纲、站点右侧导航或字数统计。
const promptFeatures: MarkdownPageFeatures = {
  copyFull: true,
  backToTop: true,
};
</script>
