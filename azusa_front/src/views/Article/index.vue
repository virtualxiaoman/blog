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
    // 使用路由参数来获取文件名
    const articleName = route.params.name;
    console.log("test.vue", articleName);
    fileName.value = articleName.toString();
    console.log("test.vue", fileName.value);
});
</script>
