<template>
  <div class="not-found-page">
    <ArticleNav />
    <div class="not-found-content">
      <p class="not-found-code">404</p>
      <h1 class="not-found-title">页面不存在</h1>
      <p class="not-found-desc">
        没有找到 <code class="not-found-path">{{ displayPath }}</code> 对应的内容，可能是链接已失效或地址有误。
      </p>

      <div class="not-found-actions">
        <RouterLink class="action primary" to="/articles">浏览全部文章</RouterLink>
        <RouterLink class="action" to="/">回到主页</RouterLink>
        <RouterLink class="action" to="/tool">工具箱</RouterLink>
      </div>

      <section class="not-found-categories">
        <h2 class="categories-title">按分类浏览文章</h2>
        <div class="categories-grid">
          <RouterLink
            v-for="cat in categories"
            :key="cat"
            class="category-card"
            :to="`/article/${cat}`"
          >
            <span class="category-name">{{ cat }}</span>
            <span class="category-count">{{ articlesByCategory(cat).length }} 篇</span>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ArticleNav from '../components/ArticleNav.vue';
import { articlesByCategory, categoryNames } from '../articles';

const route = useRoute();
const categories = categoryNames();

// route.fullPath 保留百分号编码，展示给用户时还原成中文路径
const displayPath = computed(() => {
  try {
    return decodeURI(route.fullPath);
  } catch {
    return route.fullPath;
  }
});
</script>

<style scoped>
.not-found-page {
  min-height: 100vh;
  background-image: -webkit-radial-gradient(-20% 140%, ellipse, rgba(102, 204, 255, .2) 30%, rgba(178, 216, 232, .3) 50%),
    -webkit-radial-gradient(60% 40%, ellipse, rgba(57, 197, 187, 0.3) 10%, rgba(44, 70, 76, 0.1) 60%),
    -webkit-linear-gradient(-45deg, rgba(102, 204, 255, .3) -10%, rgba(178, 216, 232, .4) 80%);
}

.not-found-content {
  margin-left: 6%;
  margin-right: 16%; /* 给右侧固定导航栏让位 */
  padding: 80px 0;
}

.not-found-code {
  margin: 0;
  font-size: 72px;
  font-weight: 800;
  line-height: 1;
  color: #66ccff;
  text-shadow: 2px 2px 4px rgba(102, 204, 255, 0.5);
}

.not-found-title {
  margin: 12px 0 16px;
  font-size: 36px;
  color: #409eff;
}

.not-found-desc {
  margin: 0;
  max-width: 760px;
  color: #73767a;
  font-size: 16px;
  line-height: 1.8;
  word-break: break-all;
}

.not-found-path {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(102, 204, 255, 0.15);
  color: #1c3a4a;
}

.not-found-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.action {
  padding: 10px 20px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.8);
  color: #409eff;
  font-size: 15px;
  text-decoration: none;
  box-shadow: 0 2px 10px rgba(102, 204, 255, 0.28);
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.action:hover {
  background-color: #fff;
  box-shadow: 0 4px 14px rgba(102, 204, 255, 0.4);
}

.action.primary {
  background-color: #66ccff;
  color: #fff;
}

.action.primary:hover {
  background-color: #4bbdf5;
}

.not-found-categories {
  margin-top: 48px;
}

.categories-title {
  margin: 0 0 16px;
  font-size: 22px;
  color: #409eff;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  max-width: 900px;
}

.category-card {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 18px;
  border: 1px solid rgba(102, 204, 255, 0.35);
  border-radius: 10px;
  background-color: rgba(255, 255, 255, 0.72);
  text-decoration: none;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.category-card:hover {
  background-color: #fff;
  box-shadow: 0 4px 14px rgba(102, 204, 255, 0.4);
}

.category-name {
  font-size: 17px;
  font-weight: 600;
  color: #1c3a4a;
}

.category-count {
  font-size: 13px;
  color: #73767a;
}
</style>
