<template>
  <div class="markdown-document-page" :class="[`is-${variant}`, { 'has-outline': enabled.outline }]">
    <aside v-if="enabled.outline" class="markdown-outline">
      <OutlineGenerator v-if="contentReady" :content="content" />
    </aside>

    <main class="markdown-main">
      <h1 v-if="title" class="markdown-title">{{ title }}</h1>
      <div class="markdown-content">
        <MarkdownViewer :source="source" @contentLoaded="updateContent" />
      </div>
    </main>

    <ArticleNav v-if="enabled.siteNavigation" />

    <div v-if="enabled.copyFull || enabled.wordCount" class="markdown-actions">
      <div v-if="enabled.copyFull" class="markdown-copy-control">
        <MarkdownCopyButton :source="source" />
      </div>
      <MarkdownWordCount v-if="enabled.wordCount" :source="source" />
    </div>

    <!-- 文章右侧导航已经内置同一个回到顶部组件，避免重复显示。 -->
    <BackToTopButton
      v-if="enabled.backToTop && !enabled.siteNavigation"
      :refresh-key="contentReady"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MarkdownViewer from '../mdViewer.vue';
import OutlineGenerator from '../OutlineGenerator.vue';
import ArticleNav from '../ArticleNav.vue';
import MarkdownCopyButton from './MarkdownCopyButton.vue';
import MarkdownWordCount from './MarkdownWordCount.vue';
import BackToTopButton from './BackToTopButton.vue';

export interface MarkdownPageFeatures {
  /** 左侧大纲。 */
  outline?: boolean;
  /** 网站的右侧主导航。 */
  siteNavigation?: boolean;
  /** 复制 Markdown 源文件全文。 */
  copyFull?: boolean;
  /** 基于源 Markdown 统计字数。 */
  wordCount?: boolean;
  /** 回到顶部与阅读进度环。 */
  backToTop?: boolean;
}

const props = withDefaults(defineProps<{
  /** public/ 下的 Markdown 相对路径。 */
  source: string;
  /** 可选的页面标题；不传时只渲染正文。 */
  title?: string;
  /** 按功能自由组合页面，未列出的功能默认关闭。 */
  features?: MarkdownPageFeatures;
  /** article 保留原文章布局，compact 用于嵌入其他栏目。 */
  variant?: 'article' | 'compact';
}>(), {
  title: '',
  features: () => ({}),
  variant: 'compact',
});

const enabled = computed(() => ({
  outline: false,
  siteNavigation: false,
  copyFull: false,
  wordCount: false,
  backToTop: false,
  ...props.features,
}));

const content = ref('');
const contentReady = ref(false);

function updateContent(newContent: string) {
  content.value = newContent;
  contentReady.value = Boolean(newContent);
}
</script>

<style scoped>
.markdown-document-page {
  position: relative;
  min-height: 100%;
}

.markdown-main {
  box-sizing: border-box;
  background: #fff;
}

.markdown-title {
  margin: 15px 0 30px;
  color: #409eff;
  font-size: 48px;
  font-weight: bold;
  text-align: center;
  text-shadow: 2px 2px 4px rgba(102, 204, 255, 0.5);
  animation: fade-in 2s ease-in-out;
}

.markdown-content {
  margin-bottom: 50px;
}

.markdown-content :deep(h1) {
  color: #ee0000;
}

.markdown-content :deep(h2) {
  color: #66ccff;
}

.markdown-content :deep(h3) {
  color: #39c5bb;
}

.markdown-content :deep(h4) {
  color: #ecad9e;
}

.markdown-actions {
  position: fixed;
  right: calc(1vw + 2px);
  bottom: 84px;
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.is-article {
  display: flex;
  background-image:
    -webkit-radial-gradient(-20% 140%, ellipse, rgba(102, 204, 255, 0.2) 30%, rgba(178, 216, 232, 0.3) 50%),
    -webkit-radial-gradient(60% 40%, ellipse, rgba(57, 197, 187, 0.3) 10%, rgba(44, 70, 76, 0.1) 60%),
    -webkit-linear-gradient(-45deg, rgba(102, 204, 255, 0.3) -10%, rgba(178, 216, 232, 0.4) 80%);
}

.is-article .markdown-main {
  width: 72%;
  margin-left: 14%;
  margin-right: 14%;
  padding: 0 3%;
}

.markdown-outline {
  position: fixed;
  width: 14%;
  height: 100%;
  overflow-y: scroll;
  padding-left: 0.6%;
  padding-right: 1%;
}

.markdown-outline::-webkit-scrollbar {
  background: transparent;
}

.is-compact .markdown-main {
  width: min(100%, 940px);
  margin: 0 auto;
  padding: clamp(20px, 4vw, 48px);
  border: 1px solid rgba(102, 204, 255, 0.24);
  border-radius: 18px;
  box-shadow: 0 12px 30px rgba(44, 70, 76, 0.08);
}

.is-compact .markdown-content {
  margin-bottom: 0;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 900px) {
  .is-article {
    display: block;
  }

  .is-article .markdown-main {
    width: 100%;
    margin: 0;
    padding: 0 6%;
  }

  .markdown-outline {
    display: none;
  }
}
</style>


\n