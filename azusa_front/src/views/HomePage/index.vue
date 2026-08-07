<template>
    <div>
        <ArticleNav />
        <Welcome />
        <MainPage />
    </div>
</template>

<script setup>
import Welcome from './welcome.vue';
import MainPage from './mainpage.vue';
import ArticleNav from '../../components/ArticleNav.vue';
</script>

<style>
/* 这里可以添加全局样式 */
</style>