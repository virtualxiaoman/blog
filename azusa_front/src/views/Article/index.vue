<template>
    <div>
        <BlogPage v-if="fileName" :fileName="fileName" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import BlogPage from '../../components/BlogPage.vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const fileName = ref('');

onMounted(async () => {
    // 使用路由参数来获取文件名，路径形如 /article/AI/强化学习
    const category = route.params.category;
    const name = route.params.name;
    console.log("article/index.vue", category, name);
    fileName.value = `${category}/${name}`;
    console.log("article/index.vue", fileName.value);
});
</script>
