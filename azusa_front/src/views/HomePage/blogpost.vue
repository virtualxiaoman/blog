<template>
  <div class="blog-section">
    <div class="blog-post" @click="goToArticle('/article/深度学习')">
      <img src="/article_cover/深度学习.jpeg" alt="博客图片">
      <div class="post-info">
        <h3>深度学习</h3>
        <p>深度学习总结</p>
      </div>
    </div>
    <div class="blog-post" @click="goToArticle('/article/机器学习')">
      <img src="/article_cover/机器学习.jpg" alt="博客图片">
      <div class="post-info">
        <h3>机器学习</h3>
        <p>机器学习原理</p>
      </div>
    </div>
    <div class="blog-post" @click="goToArticle('/article/机器学习实践')">
      <img src="/article_cover/机器学习实践.png" alt="博客图片">
      <div class="post-info">
        <h3>机器学习实践</h3>
        <p>全流程的深度学习实践</p>
      </div>
    </div>
    <div class="blog-post" @click="goToArticle('/article/推荐系统')">
      <img src="/article_cover/推荐系统.jpeg" alt="博客图片">
      <div class="post-info">
        <h3>推荐系统</h3>
        <p>推广搜，第一位就是推</p>
      </div>
    </div>
    <div class="blog-post" @click="goToArticle('/article/自然语言处理')">
      <img src="/article_cover/自然语言处理.jpeg" alt="博客图片">
      <div class="post-info">
        <h3>自然语言处理</h3>
        <p>似乎当下很火</p>
      </div>
    </div>
    <div class="blog-post" @click="goToArticle('/article/choice')">
      <img src="/article_cover/其他文章.png" alt="博客图片">
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

// const goToArticle = () => {
// //   router.push('/test'); // 跳转到指定路径
// //   window.location.href = '/article/深度学习';
//     router.push('/article/深度学习');
// };
const goToArticle = (path: string) => {
  router.push(`${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`); // 确保路径前缀正确(防止//article/...的情况)
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