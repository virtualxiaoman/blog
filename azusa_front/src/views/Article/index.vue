<template>
  <div>
    <BlogPage v-if="fileName" :fileName="fileName" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BlogPage from '../../components/BlogPage.vue';
import { useRoute } from 'vue-router';

const route = useRoute();
// 使用路由参数来获取文件名，路径形如 /article/AI/强化学习。
// 用 computed 派生而非 onMounted 赋值：路由复用同一组件实例时（如从一篇切到另一篇），
// 参数变化会自动触发更新，否则切换文章页面不会刷新。
const fileName = computed(() => {
  const category = route.params.category;
  const name = route.params.name;
  return `${category}/${name}`;
});
</script>
