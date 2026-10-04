<template>
  <div>
    <router-view></router-view>
    <!-- 全局搜索（Ctrl+K）：任意界面可触发，范围选择器决定搜索动态还是其他内容 -->
    <GlobalSearch />
  </div>
</template>

<script setup lang="ts">
import GlobalSearch from './components/GlobalSearch.vue';
</script>
