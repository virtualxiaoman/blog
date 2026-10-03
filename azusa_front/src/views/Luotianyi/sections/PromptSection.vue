<template>
  <MarkdownDocumentPage
    source="lty/prompt/lty_prompt.md"
    variant="compact"
    :features="promptFeatures"
  />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { MarkdownPageFeatures } from '../../../components/markdown/MarkdownDocumentPage.vue';

// Markdown 渲染器较重（构建产物约 285 KB），洛天依页面已静态导入主包，
// 它若同步引入会拖慢全站首屏；改为进入 prompt 板块时才拉取（与全息板块同一策略）。
const MarkdownDocumentPage = defineAsyncComponent(
  () => import('../../../components/markdown/MarkdownDocumentPage.vue'),
);

// 提示词页只保留正文解析、复制全文和回到顶部；不显示文章大纲、站点右侧导航或字数统计。
const promptFeatures: MarkdownPageFeatures = {
  copyFull: true,
  backToTop: true,
};
</script>
