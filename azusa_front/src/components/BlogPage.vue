<template>
  <MarkdownDocumentPage
    :source="source"
    :title="displayName"
    variant="article"
    :features="articleFeatures"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MarkdownDocumentPage, { type MarkdownPageFeatures } from './markdown/MarkdownDocumentPage.vue';

const props = defineProps({
  fileName: {
    type: String,
    required: true,
  },
});

const displayName = computed(() => props.fileName.split('/').pop() || props.fileName);
const source = computed(() => `article/md/${props.fileName}.md`);

// 文章页启用完整能力；后续新 Markdown 仅需改 features 组合即可复用该页面容器。
const articleFeatures: MarkdownPageFeatures = {
  outline: true,
  siteNavigation: true,
  copyFull: true,
  wordCount: true,
  backToTop: true,
};
</script>
