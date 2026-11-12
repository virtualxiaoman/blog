<template>
  <MarkdownDocumentPage
    source="lty/freebies/洛天依无料.md"
    asset-base="lty/assets/"
    variant="compact"
    :features="freebiesFeatures"
  />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { MarkdownPageFeatures } from '../../../components/markdown/MarkdownDocumentPage.vue';

// Markdown 渲染器较重，进入无料板块时才拉取（与 prompt 板块同一策略）。
const MarkdownDocumentPage = defineAsyncComponent(
  () => import('../../../components/markdown/MarkdownDocumentPage.vue'),
);

// 只保留正文解析、复制全文和回到顶部；不显示文章大纲、站点右侧导航或字数统计。
const freebiesFeatures: MarkdownPageFeatures = {
  copyFull: true,
  backToTop: true,
};
</script>
