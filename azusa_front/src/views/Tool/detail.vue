<template>
  <div class="tool-page">
    <ArticleNav />
    <div class="tool-main">
      <nav class="breadcrumb">
        <button type="button" class="crumb-btn" @click="goHome">主页</button>
        <span class="crumb-sep">/</span>
        <button type="button" class="crumb-btn" @click="goTool">工具</button>
        <span class="crumb-sep">/</span>
        <span class="crumb-cur">{{ category }}</span>
        <span class="crumb-sep">/</span>
        <span class="crumb-cur">{{ name }}</span>
      </nav>

      <div class="tool-card-body">
        <component :is="toolComponent" v-if="toolComponent" />
        <p v-else class="not-found">未找到工具：{{ category }} / {{ name }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ArticleNav from '../../components/ArticleNav.vue';
import { loadTool } from '../../tools';

const route = useRoute();
const router = useRouter();

// 用 computed 从路由参数派生：切换工具时（复用同一组件实例）自动更新组件。
// 不能只用 onMounted——从 /tool/coding/文本替换 切到 /tool/daily/好评模板 不会重新挂载本页。
const category = computed(() => String(route.params.category ?? ''));
const name = computed(() => String(route.params.name ?? ''));
const toolComponent = computed(() => loadTool(category.value, name.value));

function goHome() {
  router.push('/');
}
function goTool() {
  router.push('/tool');
}
</script>

<style scoped>
.tool-page {
  min-height: 100vh;
  background-image: -webkit-radial-gradient(-20% 140%, ellipse, rgba(102, 204, 255, .2) 30%, rgba(178, 216, 232, .3) 50%),
    -webkit-radial-gradient(60% 40%, ellipse, rgba(57, 197, 187, 0.3) 10%, rgba(44, 70, 76, 0.1) 60%),
    -webkit-linear-gradient(-45deg, rgba(102, 204, 255, .3) -10%, rgba(178, 216, 232, .4) 80%);
}

/* 两列布局：内容 + 右侧固定导航栏 */
.tool-main {
  margin-left: 6%;
  margin-right: 16%;
  padding: 40px 0 80px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
  font-size: 14px;
  color: #73767a;
}

.crumb-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.7);
  color: #409eff;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.crumb-btn:hover {
  background: rgba(102, 204, 255, 0.25);
}

.crumb-sep {
  color: #b0b6bd;
}

.crumb-cur {
  color: #1c3a4a;
}

.tool-card-body {
  background: #fff;
  border-radius: 12px;
  padding: 28px 32px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.not-found {
  color: #d9534f;
  margin: 0;
}
</style>
