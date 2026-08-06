<template>
  <div>
    <h2>选择Markdown文章</h2>
    <ul>
      <li v-for="article in articles" :key="article.name">
        <!-- 每个按钮会导航到对应的文章页面 -->
        <button @click="navigateToArticle(article.name)">
          {{ article.name }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { articleCategories, findCategory, getCover } from '../../articles';

const router = useRouter();

// 杂项文章列表：Others 分类全部 + AI 分类没有首页封面（未在首页展示）的文章，
// 直接从文章注册表派生，避免两处维护不一致
const articles = [
  ...articleCategories.Others,
  ...articleCategories.AI.filter((a) => getCover(a.name) === null),
].map((a) => ({ name: a.name }));

function navigateToArticle(articleName: string) {
  const category = findCategory(articleName);
  if (!category) {
    console.error('文章未登记分类：', articleName);
    return;
  }
  // 跳转到 /article/<分类>/<文章名>，hash 模式下 base 前缀自动处理
  router.push(`/article/${category}/${articleName}`);
}
</script>

<style scoped>
ul {
  list-style-type: none;
  padding: 0;
}
li {
  margin-bottom: 1rem;
}
button {
  padding: 0.5rem 1rem;
  border: 1px solid #66ccff;
  border-radius: 4px;
  background-color: rgba(102, 204, 255, 0.2);
  cursor: pointer;
}
</style>
