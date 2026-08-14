<template>
  <div class="home-nav">
    <h2 class="home-nav-title">主页导航</h2>
    <div class="home-nav-cards">
      <!-- 文章界面：进入文章列表页 -->
      <button type="button" class="home-nav-card accent-article" @click="go('/articles')">
        <span class="nav-card-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M9 13h6" />
            <path d="M9 17h6" />
          </svg>
        </span>
        <span class="nav-card-title">文章界面</span>
        <span class="nav-card-desc">阅读博客文章</span>
      </button>

      <!-- 工具界面：进入工具箱 -->
      <button type="button" class="home-nav-card accent-tool" @click="go('/tool')">
        <span class="nav-card-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </span>
        <span class="nav-card-title">工具界面</span>
        <span class="nav-card-desc">常用小工具合集</span>
      </button>

      <!-- 洛天依界面：天依相关内容 -->
      <button type="button" class="home-nav-card accent-tianyi" @click="go('/lty')">
        <span class="nav-card-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </span>
        <span class="nav-card-title">洛天依界面</span>
        <span class="nav-card-desc">天依相关内容</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const go = (path: string) => {
  router.push(path);
};
</script>

<style scoped>
.home-nav {
  width: 100%;
}

.home-nav-title {
  margin: 0 0 18px;
  font-size: 22px;
  font-weight: bold;
  color: #409eff;
  text-shadow: 2px 2px 4px rgba(102, 204, 255, 0.5);
}

.home-nav-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.home-nav-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 22px 20px;
  border: 1px solid #dbeef7;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.home-nav-card:hover {
  transform: translateY(-3px);
}

.nav-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
}

.nav-card-icon svg {
  width: 26px;
  height: 26px;
}

.nav-card-title {
  font-size: 18px;
  font-weight: 700;
  color: #1c3a4a;
}

.nav-card-desc {
  font-size: 13px;
  color: #73767a;
}

/* 三个入口各自的主题色 */
.accent-article .nav-card-icon {
  background-color: rgba(102, 204, 255, 0.18);
  color: #66ccff;
}

.accent-article:hover {
  border-color: #66ccff;
  box-shadow: 0 8px 20px rgba(102, 204, 255, 0.35);
}

.accent-tool .nav-card-icon {
  background-color: rgba(57, 197, 187, 0.18);
  color: #39c5bb;
}

.accent-tool:hover {
  border-color: #39c5bb;
  box-shadow: 0 8px 20px rgba(57, 197, 187, 0.35);
}

.accent-tianyi .nav-card-icon {
  background-color: rgba(179, 157, 219, 0.22);
  color: #9b8cd6;
}

.accent-tianyi:hover {
  border-color: #b39ddb;
  box-shadow: 0 8px 20px rgba(179, 157, 219, 0.4);
}
</style>
