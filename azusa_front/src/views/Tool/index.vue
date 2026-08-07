<template>
  <div class="tool-page">
    <ArticleNav />
    <div class="tool-main">
      <h1 class="page-title">工具箱</h1>
      <p class="page-sub">按分类整理的小工具，新增工具只需放入对应分类目录。</p>

      <section v-for="cat in categories" :key="cat" class="tool-category">
        <h2 class="cat-title">{{ cat }}</h2>
        <div class="tool-grid">
          <button
            v-for="tool in toolsByCategory(cat)"
            :key="tool.name"
            type="button"
            class="tool-card"
            @click="goTo(tool.path)"
          >
            <span class="tool-name">{{ tool.name }}</span>
          </button>
        </div>
      </section>

      <p v-if="!categories.length" class="empty">
        还没有工具，把 .vue 文件放进 src/views/Tool/tools/ 即可。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ArticleNav from '../../components/ArticleNav.vue';
import { toolCategoryNames, toolsByCategory } from '../../tools';

const router = useRouter();
const categories = toolCategoryNames();

function goTo(path: string) {
  router.push(path);
}
</script>

<style scoped>
.tool-page {
  min-height: 100vh;
  background-image: -webkit-radial-gradient(-20% 140%, ellipse, rgba(102, 204, 255, .2) 30%, rgba(178, 216, 232, .3) 50%),
    -webkit-radial-gradient(60% 40%, ellipse, rgba(57, 197, 187, 0.3) 10%, rgba(44, 70, 76, 0.1) 60%),
    -webkit-linear-gradient(-45deg, rgba(102, 204, 255, .3) -10%, rgba(178, 216, 232, .4) 80%);
}

/* 两列布局：内容 + 右侧固定导航栏。右侧栏宽 14%，留出空间避免内容被遮 */
.tool-main {
  margin-left: 6%;
  margin-right: 16%;
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
  margin: 10px 0 32px;
  color: #73767a;
}

.tool-category {
  margin-bottom: 28px;
}

.cat-title {
  margin: 0 0 14px;
  font-size: 18px;
  color: #39c5bb;
  border-bottom: 2px solid rgba(57, 197, 187, 0.35);
  padding-bottom: 6px;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}

.tool-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72px;
  padding: 12px 16px;
  border: 1px solid #dbeef7;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 204, 255, 0.35);
  border-color: #66ccff;
}

.tool-name {
  font-size: 15px;
  font-weight: 600;
  color: #1c3a4a;
}

.empty {
  color: #73767a;
}
</style>
