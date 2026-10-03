<template>
  <div>
    <h2>选择Markdown文章</h2>
    <div v-for="cat in categories" :key="cat" class="category-group">
      <h3>{{ cat }}</h3>
      <ul>
        <li v-for="article in articlesByCategory(cat)" :key="article.name">
          <RouterLink class="article-link" :to="`/article/${cat}/${article.name}`">
            {{ article.name }}
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { articlesByCategory, categoryNames } from '../../articles';

const categories = categoryNames();
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
.article-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  border: 1px solid #66ccff;
  border-radius: 4px;
  background-color: rgba(102, 204, 255, 0.2);
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}
</style>
