<template>
  <div>
    <h2>选择Markdown文章</h2>
    <ul>
      <li v-for="article in articles" :key="article.name">
        <!-- 每个按钮会导航到对应的文章页面 -->
        <button @click="navigateToArticle(article.name)">
          {{ article.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

// 定义文章列表
const articles = [
  { name: 'LaTeX.md', label: 'LaTeX' },
  { name: 'vue.md', label: 'Vue' },
  { name: 'plt.md', label: 'Plt' },
  { name: 'git.md', label: 'Git' },
  { name: '计算机视觉.md', label: 'CV' },
  { name: '强化学习.md', label: 'RL'}
];

const router = useRouter();

function navigateToArticle(articleName: string) {
  // 如果articleName以md结尾，则跳转到article/articleName(去掉md后缀)
  if (articleName.endsWith('.md')) {
    const articlePath = articleName.slice(0, -3);
    const path = '/article/' + articlePath;
    router.push(`${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`);
  }
  else {
    console.error('文章名必须以.md结尾');
  }
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