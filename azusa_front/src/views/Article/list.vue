<template>
  <div class="article-list-page">
    <ArticleNav />
    <div class="article-list-content">
      <h1 class="page-title">文章</h1>
      <p class="page-sub">点击卡片即可阅读对应文章。</p>
      <BlogPost />
    </div>
  </div>
</template>

<script setup lang="ts">
import ArticleNav from '../../components/ArticleNav.vue';
import BlogPost from '../../components/BlogPost.vue';
</script>

<style scoped>
.article-list-page {
  min-height: 100vh;
  background-image: -webkit-radial-gradient(-20% 140%, ellipse, rgba(102, 204, 255, .2) 30%, rgba(178, 216, 232, .3) 50%),
    -webkit-radial-gradient(60% 40%, ellipse, rgba(57, 197, 187, 0.3) 10%, rgba(44, 70, 76, 0.1) 60%),
    -webkit-linear-gradient(-45deg, rgba(102, 204, 255, .3) -10%, rgba(178, 216, 232, .4) 80%);
}

.article-list-content {
  margin-left: 6%;
  margin-right: 16%; /* 给右侧固定导航栏让位 */
  padding: 40px 0 80px;
}

.page-title {
  margin: 0;
  font-size: 40px;
  font-weight: bold;
  color: #409eff;
  text-shadow: 2px 2px 4px rgba(102, 204, 255, 0.5);
}

.page-sub {
  margin: 10px 0 28px;
  color: #73767a;
}
</style>
