<template>
  <div class="blog-section">
    <div
      v-for="article in articles"
      :key="article.name"
      class="blog-post"
      @click="goToArticle(article.path)"
    >
      <img loading="lazy" :src="`${base}article/cover/${article.cover}`" :alt="article.name">
      <div class="post-info">
        <h3>{{ article.name }}</h3>
        <p>{{ article.desc }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { articlesByCategory, coverFile } from '../articles';

const router = useRouter();
const base = import.meta.env.BASE_URL;

// 首页展示列表：AI 分类全部文章（无封面的自动用 default.png）+ "其他文章"入口，全部从注册表派生
const articles = articlesByCategory('AI').map((a) => ({
  name: a.name,
  cover: coverFile(a.name),
  path: `/article/AI/${a.name}`,
  desc: a.name,
})).concat([
  {
    name: '其他文章',
    cover: '其他文章.jpg',
    path: '/article/choice',
    desc: '其他内容',
  },
]);

const goToArticle = (path: string) => {
  // hash 模式下直接使用路径即可，base 前缀由 hash 模式自动处理
  router.push(path);
};
</script>

<style scoped>
.blog-post {
  display: flex;
  margin-bottom: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}

.blog-post img {
  width: 25%;
  height: 175px;
  object-fit: cover;
}

.post-info {
  padding: 1rem;
}

.post-info h3 {
  margin: 0;
  font-size: 24px;
  color: #409EFF;
}

.post-info p {
  margin: 12px 0;
  color: #73767a;
}
</style>
