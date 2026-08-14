<template>
  <div class="lty-page" :class="{ 'is-home': current.key === 'home' }" :style="pageStyle">
    <header class="lty-header">
      <div class="lty-brand">
        <img class="lty-logo" :src="ltyLogoUrl" alt="洛天依" />
      </div>

      <nav class="lty-tabs" aria-label="洛天依板块导航">
        <button
          v-for="sec in ltySections"
          :key="sec.key"
          type="button"
          class="lty-tab"
          :class="{ 'is-active': sec.key === current.key }"
          :title="sec.description"
          @click="switchSection(sec.key)"
        >
          {{ sec.label }}
        </button>
      </nav>
    </header>

    <main class="lty-main">
      <component :is="current.component" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ltySections } from './lty.config';

const route = useRoute();
const router = useRouter();

// 资源在 public/ 下，路径带 BASE_URL 前缀兼容 GitHub Pages 的 /blog/ 子路径部署
const base = import.meta.env.BASE_URL;
const ltyLogoUrl = `${base}lty/ltylogo.png`;
const homeBgUrl = `${base}lty/116202487_p1.png`;

// lty 界面专属字体：@font-face 全局注册一次（lty 是懒加载路由，仅访问 /lty 时注入），
// 字体文件只在 .lty-page 用该 font-family 渲染时才下载，不影响其他页面。
const FONT_FACE_ID = 'lty-font-face';
if (!document.getElementById(FONT_FACE_ID)) {
  const style = document.createElement('style');
  style.id = FONT_FACE_ID;
  style.textContent = `@font-face {
    font-family: 'FZLanTYK';
    src: url('${base}fonts/FZLanTYK_Zhong.c10069d1.OTF') format('opentype');
    font-display: swap;
  }`;
  document.head.appendChild(style);
}

// 当前板块：优先读 URL 的 ?tab=，值非法或缺失时回退到第一项（首页），保证刷新/深链后停留在原板块
const current = computed(() => {
  const key = String(route.query.tab ?? '');
  return ltySections.find((s) => s.key === key) ?? ltySections[0];
});

// 切换板块：只更新 URL query（hash 路由下深链可用），用 replace 不堆积返回历史
function switchSection(key: string) {
  if (key === current.value.key) return;
  router.replace({ query: { ...route.query, tab: key } });
}

// 首页板块：整页铺满 116202487_p1.png 作背景；其余板块用 CSS 里的默认渐变
const pageStyle = computed(() =>
  current.value.key === 'home'
    ? {
        backgroundImage: `url('${homeBgUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined
);
</script>

<style scoped>
.lty-page {
  min-height: 100vh;
  padding-top: 36px; /* 顶部留白：头部不贴屏幕顶端，浮在背景上方 */
  font-family: 'FZLanTYK', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(179, 157, 219, 0.18) 0%, transparent 55%),
    radial-gradient(120% 90% at 100% 0%, rgba(102, 204, 255, 0.14) 0%, transparent 55%),
    linear-gradient(180deg, #f8fafc 0%, #eef4f8 100%);
}

/* 顶部栏：透明、不吸附、距顶留白，直接浮在背景上 */
.lty-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 4%;
  background: transparent;
}

.lty-brand {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.lty-logo {
  height: 72px;
  width: auto;
  object-fit: contain;
  flex-shrink: 0;
}

/* 标签栏：纯文字按钮，无边框无底色 */
.lty-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.lty-tab {
  padding: 8px 14px;
  border: none;
  background: none;
  font-size: 18px;
  color: #66ccff;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s ease;
}

.lty-tab:hover,
.lty-tab.is-active {
  color: #aa6680;
  font-weight: 700;
}

/* 内容区：各板块组件在此并列渲染（可多根），间距统一 */
.lty-main {
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 4% 96px;
}

@media (max-width: 720px) {
  .lty-header {
    flex-wrap: wrap;
    gap: 10px 16px;
  }

  .lty-tab {
    padding: 6px 10px;
    font-size: 15px;
  }
}
</style>
