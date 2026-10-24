<template>
  <PageNotFound v-if="!isKnownCategory" />
  <div v-else class="article-category-page">
    <ArticleNav />
    <div class="article-category-content">
      <div class="page-head">
        <h1 class="page-title">{{ category }}</h1>
        <RouterLink class="all-articles-link" to="/articles">全部文章</RouterLink>
      </div>
      <!-- key 让切换分类时重新初始化折叠状态（BlogPost 只在 setup 时读取分类） -->
      <BlogPost :key="category" :category="category" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ArticleNav from '../../components/ArticleNav.vue';
import BlogPost from '../../components/BlogPost.vue';
import PageNotFound from '../NotFound.vue';
import { categoryNames } from '../../articles';

const route = useRoute();

// 路径形如 /article/KaoYan：只有分类、没有文章名时的分类落地页
const category = computed(() => String(route.params.category ?? ''));
const isKnownCategory = computed(() => categoryNames().includes(category.value));
</script>

<style scoped>
.article-category-page {
  min-height: 100vh;
  background-image: -webkit-radial-gradient(-20% 140%, ellipse, rgba(102, 204, 255, .2) 30%, rgba(178, 216, 232, .3) 50%),
    -webkit-radial-gradient(60% 40%, ellipse, rgba(57, 197, 187, 0.3) 10%, rgba(44, 70, 76, 0.1) 60%),
    -webkit-linear-gradient(-45deg, rgba(102, 204, 255, .3) -10%, rgba(178, 216, 232, .4) 80%);
}

.article-category-content {
  margin-left: 6%;
  margin-right: 16%; /* 给右侧固定导航栏让位 */
  padding: 40px 0 80px;
}

.page-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 28px;
}

.page-title {
  margin: 0;
  font-size: 40px;
  font-weight: bold;
  color: #409eff;
  text-shadow: 2px 2px 4px rgba(102, 204, 255, 0.5);
}

.all-articles-link {
  color: #39c5bb;
  font-size: 15px;
  text-decoration: none;
}

.all-articles-link:hover {
  text-decoration: underline;
}
</style>
