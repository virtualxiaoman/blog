<template>
  <div>
    <router-view></router-view>
    <!-- 全局搜索（Ctrl+K）：任意界面可触发 -->
    <GlobalSearch />
    <!-- 动态搜索：Ctrl+K 在洛天依页"动态"板块下由 GlobalSearch 转发事件触发 -->
    <DynamicSearchOverlay />
  </div>
</template>

<script setup lang="ts">
import GlobalSearch from './components/GlobalSearch.vue';
import DynamicSearchOverlay from './components/DynamicSearchOverlay.vue';
</script>
