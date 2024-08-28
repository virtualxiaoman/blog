<template>
  <div class="main-section">
    <div class="main-container">
      <div class="blog">
        <BlogPost />
      </div>
      <div class="info">
        <xmInfo />
      </div>
    </div>
  </div>
</template>

<script setup>
import BlogPost from './blogpost.vue';
import xmInfo from './xminfo.vue';
</script>

<style scoped>
.main-section {
  background-image: -webkit-radial-gradient(-20% 140%, ellipse, rgba(143, 192, 193, .6) 30%, rgba(255, 255, 227, 0) 50%),
  -webkit-radial-gradient(60% 40%, ellipse, #d9e3e5 10%, rgba(44, 70, 76, .0) 60%),
  -webkit-linear-gradient(-45deg, rgba(143, 181, 158, .8) -10%, rgba(213, 232, 211, .8) 80%);
}

.main-container {
  display: flex;
  align-items: flex-start;
  padding: 3% 2%;
  background-color: rgba(255, 255, 255, 0.8);
  margin-left: 11%;
  margin-right: 11%;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  border-radius: 6px;
}

.blog {
  flex: 5;
  overflow-y: auto;
  padding-right: 3%;
}

.info {
  flex: 2;
  border: 1px solid #ddd;
  background-color: rgba(254,228,208, 0.2);
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  transition: background-color 3s ease-in-out;
}

</style>
