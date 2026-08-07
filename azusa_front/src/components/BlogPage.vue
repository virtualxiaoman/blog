<template>
  <div class="clearfix">
    <div class="left-content">
      <OutlineGenerator v-if="contentReady" :content="content" />
    </div>
    <div class="main-content">
      <div class="main-title">
        {{ displayName }}
      </div>
      <div class="main-md">
        <MarkdownViewer :fileName="fileName" @contentLoaded="updateContent" />
      </div>
    </div>
    <!-- 右侧导航栏自包含固定定位，无需外层容器 -->
    <ArticleNav :contentReady="contentReady" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MarkdownViewer from './mdViewer.vue';
import OutlineGenerator from './OutlineGenerator.vue';
import ArticleNav from './ArticleNav.vue';

const props = defineProps({
  fileName: {
    type: String,
    required: true,
  },
});

// fileName 形如 "AI/强化学习"，取出最后一个 / 之后的部分作为标题
const displayName = computed(() => props.fileName.split('/').pop() || props.fileName);

const content = ref('');
const contentReady = ref(false);

function updateContent(newContent: string) {
  content.value = newContent;
  contentReady.value = !!newContent; // 确保 contentReady 在内容被加载时才为 true
}
</script>

<style scoped>
.clearfix {
  display: flex;
  background-image: -webkit-radial-gradient(-20% 140%, ellipse, rgba(102, 204, 255, .2) 30%, rgba(178, 216, 232, .3) 50%),
    -webkit-radial-gradient(60% 40%, ellipse, rgba(57, 197, 187, 0.3) 10%, rgba(44, 70, 76, 0.1) 60%),
    -webkit-linear-gradient(-45deg, rgba(102, 204, 255, .3) -10%, rgba(178, 216, 232, .4) 80%);
}

.left-content {
  padding-left: 0.6%;
  padding-right: 1%;
  width: 14%;

  position: fixed;
  overflow-y: scroll;
  height: 100%;
}

.left-content::-webkit-scrollbar {
  background: transparent;
}

.main-content {
  padding-left: 3%;
  padding-right: 3%;
  margin-left: 14%;
  margin-right: 14%;

  background-color: #ffffff;
  width: 72%;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.main-title {
  font-size: 48px;
  font-weight: bold;
  color: #409EFF;
  text-align: center;
  margin-top: 15px;
  margin-bottom: 30px;
  text-shadow: 2px 2px 4px rgba(102, 204, 255, 0.5);
  animation: fadeIn 2s ease-in-out;
}

.main-md {
  margin-bottom: 50px;
}

.main-md ::v-deep(h1) {
  color: #EE0000;
}
.main-md ::v-deep(h2) {
  color: #66CCFF;
}
.main-md ::v-deep(h3) {
  color: #39C5BB;
}
.main-md ::v-deep(h4) {
  color: #ECAD9E;
}
</style>
