<template>
  <div>
    <h2>选择Markdown文章</h2>
    <div v-for="cat in categories" :key="cat" class="category-group">
      <h3>{{ cat }}</h3>
      <ul>
        <li v-for="article in articlesByCategory(cat)" :key="article.name">
          <button @click="navigateToArticle(cat, article.name)">
            {{ article.name }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { articlesByCategory, categoryNames } from '../../articles';

const router = useRouter();
const categories = categoryNames();

function navigateToArticle(category: string, articleName: string) {
  // 跳转到 /article/<分类>/<文章名>，hash 模式下 base 前缀自动处理
  router.push(`/article/${category}/${articleName}`);
}
</script>

<style scoped>
.category-group {
  margin-bottom: 1.5rem;
}

.category-group h3 {
  margin: 0 0 0.5rem;
  font-size: 16px;
  color: #409eff;
}

ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}
li {
  margin-bottom: 0.5rem;
}
button {
  padding: 0.5rem 1rem;
  border: 1px solid #66ccff;
  border-radius: 4px;
  background-color: rgba(102, 204, 255, 0.2);
  cursor: pointer;
}
</style>
