<template>
  <div class="misc-page">
    <ArticleNav />
    <div class="misc-content">
      <div>
        <MiscMD />
      </div>
      <div>
        <MiscPDF />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MiscMD from './misc_md.vue';
import MiscPDF from './misc_pdf.vue';
import ArticleNav from '../../components/ArticleNav.vue';
</script>

<style scoped>
.misc-page {
  min-height: 100vh;
  background-image: -webkit-radial-gradient(-20% 140%, ellipse, rgba(102, 204, 255, .2) 30%, rgba(178, 216, 232, .3) 50%),
    -webkit-radial-gradient(60% 40%, ellipse, rgba(57, 197, 187, 0.3) 10%, rgba(44, 70, 76, 0.1) 60%),
    -webkit-linear-gradient(-45deg, rgba(102, 204, 255, .3) -10%, rgba(178, 216, 232, .4) 80%);
}

.misc-content {
  margin-left: 6%;
  margin-right: 16%; /* 给右侧固定导航栏让位 */
  padding: 40px 0 80px;
}
</style>
