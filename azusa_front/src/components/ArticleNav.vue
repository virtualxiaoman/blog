<template>
  <aside class="nav-panel">
    <!-- 返回主页 -->
    <RouterLink to="/" class="nav-home">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" d="M12 3 3 10.5V21h6v-6h6v6h6V10.5L12 3z"/>
      </svg>
      回到主页
    </RouterLink>

    <!-- 文章导航：选分类 -> 选文章 -> 跳转 -->
    <div class="nav-articles">
      <label class="nav-label" for="nav-category">文章导航</label>
      <select v-model="selectedCategory" id="nav-category" class="nav-select" @change="onCategoryChange">
        <option value="" disabled selected>选择分类…</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>
      <select
        v-model="selectedArticle"
        id="nav-article"
        class="nav-select"
        :disabled="!selectedCategory"
        @change="goToArticle"
      >
        <option value="" disabled selected>选择文章…</option>
        <option v-for="a in currentArticles" :key="a.name" :value="a.name">{{ a.name }}</option>
      </select>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { articlesByCategory, categoryNames } from '../articles';

const router = useRouter();

const categories = categoryNames();

// 文章列表是响应式的，但需要在分类切换时重置文章选择
const selectedCategory = ref('');
const selectedArticle = ref('');
const currentArticles = computed(() =>
  selectedCategory.value ? articlesByCategory(selectedCategory.value) : []
);

function onCategoryChange() {
  selectedArticle.value = ''; // 切换分类时清空已选文章，强制用户重新选择
}

function goToArticle() {
  if (!selectedCategory.value || !selectedArticle.value) return;
  // 跳到 /article/<分类>/<文章名>，hash 模式下 base 前缀自动处理
  router.push(`/article/${selectedCategory.value}/${selectedArticle.value}`);
  // 跳转后重置选择，方便下次导航
  selectedArticle.value = '';
}
</script>

<style scoped>
.nav-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.nav-home {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: #66ccff;
  color: #fff;
  font-size: 13px;
  text-decoration: none;
  transition: background-color 0.3s ease;
}

.nav-home:hover {
  background-color: #409eff;
}

.nav-label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  display: block;
  margin-bottom: 6px;
}

.nav-articles {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-select {
  width: 100%;
  padding: 7px 8px;
  font-size: 13px;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 6px;
  background-color: #fff;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.nav-select:focus {
  border-color: #66ccff;
  box-shadow: 0 0 0 2px rgba(102, 204, 255, 0.25);
}

.nav-select:disabled {
  background-color: #f5f7fa;
  color: #aaa;
  cursor: not-allowed;
}
</style>
