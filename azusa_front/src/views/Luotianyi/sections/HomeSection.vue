<template>
  <LtySection title="关于洛天依">
    <p class="home-intro">
      主页内容占位。后续在这里放天依的简介、立绘、代表作品等，直接写在
      <code>&lt;LtySection&gt;</code> 标签内即可替换占位提示。
    </p>
  </LtySection>

  <LtySection title="最新动态" placeholder="动态占位：后续在此展示天依的最新消息、活动、作品发布等。" />
</template>

<script setup lang="ts">
import LtySection from '../components/LtySection.vue';
</script>

<style scoped>
.home-intro {
  margin: 0;
  color: #3a3f45;
}
</style>
