<template>
  <div class="blog-section">
    <div class="blog-post" @click="goToArticle('/article/AI/深度学习')">
      <img :src="`${base}article/cover/深度学习.jpeg`" alt="博客图片">
      <div class="post-info">
        <h3>深度学习</h3>
        <p>深度学习总结</p>
      </div>
    </div>
    <div class="blog-post" @click="goToArticle('/article/AI/机器学习')">
      <img :src="`${base}article/cover/机器学习.jpg`" alt="博客图片">
      <div class="post-info">
        <h3>机器学习</h3>
        <p>机器学习原理</p>
      </div>
    </div>
    <div class="blog-post" @click="goToArticle('/article/AI/机器学习实践')">
      <img :src="`${base}article/cover/机器学习实践.png`" alt="博客图片">
      <div class="post-info">
        <h3>机器学习实践</h3>
        <p>全流程的深度学习实践</p>
      </div>
    </div>
    <div class="blog-post" @click="goToArticle('/article/AI/推荐系统')">
      <img :src="`${base}article/cover/推荐系统.jpeg`" alt="博客图片">
      <div class="post-info">
        <h3>推荐系统</h3>
        <p>推广搜，第一位就是推</p>
      </div>
    </div>
    <div class="blog-post" @click="goToArticle('/article/AI/自然语言处理')">
      <img :src="`${base}article/cover/自然语言处理.jpeg`" alt="博客图片">
      <div class="post-info">
        <h3>自然语言处理</h3>
        <p>似乎当下很火</p>
      </div>
    </div>
    <div class="blog-post" @click="goToArticle('/article/choice')">
      <img :src="`${base}article/cover/其他文章.png`" alt="博客图片">
      <div class="post-info">
        <h3>其他文章</h3>
        <p>其他内容</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {useRouter} from 'vue-router';

const router = useRouter();
const base = import.meta.env.BASE_URL;

const goToArticle = (path: string) => {
  // hash 模式下直接使用路径即可，base 前缀由 hash 模式自动处理
  router.push(path);
};

</script>

<style scoped>
.blog-post {
  display: flex;
  margin-bottom: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.blog-post img {
  width: 25%;
  height: 175px;
  object-fit: cover;
}

.post-info {
  padding: 1rem;
}

.post-info h3 {
  margin: 0;
  font-size: 24px;
  color: #409EFF;
}

.post-info p {
  margin: 12px 0;
  color: #73767a;
}
</style>