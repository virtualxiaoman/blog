<template>
  <PageNotFound v-if="!isKnownArticle" />
  <div v-else>
    <BlogPage :fileName="fileName" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BlogPage from '../../components/BlogPage.vue';
import PageNotFound from '../NotFound.vue';
import { articlesByCategory } from '../../articles';
import { useRoute } from 'vue-router';

const route = useRoute();
// 使用路由参数来获取文件名，路径形如 /article/AI/强化学习。
// 用 computed 派生而非 onMounted 赋值：路由复用同一组件实例时（如从一篇切到另一篇），
// 参数变化会自动触发更新，否则切换文章页面不会刷新。
const category = computed(() => String(route.params.category ?? ''));
const name = computed(() => String(route.params.name ?? ''));
const fileName = computed(() => `${category.value}/${name.value}`);

// 分类或文章名不存在时（失效链接、手输地址）显示带导航的提示页，
// 而不是让 Markdown 请求失败后留下空白正文。
const isKnownArticle = computed(() =>
  articlesByCategory(category.value).some((article) => article.name === name.value)
);
</script>
