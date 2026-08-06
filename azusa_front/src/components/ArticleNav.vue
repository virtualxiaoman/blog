<template>
  <div class="nav-rail" @click.stop>
    <!-- 顶级导航栏：图标按钮，悬浮显示文字 -->
    <div class="nav-bar">
      <button
        type="button"
        class="nav-btn"
        aria-label="回到主页"
        data-tooltip="回到主页"
        @click="goHome"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M12 3 3 10.5V21h6v-6h6v6h6V10.5L12 3z" />
        </svg>
      </button>

      <div class="nav-btn-wrap">
        <button
          type="button"
          class="nav-btn"
          aria-label="文章导航"
          data-tooltip="文章导航"
          :class="{ 'is-open': menuOpen }"
          @click="toggleMenu"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" />
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M9 14h6M9 18h6" />
          </svg>
        </button>

        <!-- 级联菜单：点图标 → 分类 → 文章 -->
        <div v-if="menuOpen" class="nav-menu">
          <div v-if="currentCategory" class="menu-head">
            <button type="button" class="menu-back" aria-label="返回分类" @click="backToCategories">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path fill="currentColor" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12l4.6-4.6z" />
              </svg>
            </button>
            <span class="menu-head-title">{{ currentCategory }}</span>
          </div>
          <ul class="menu-list">
            <template v-if="!currentCategory">
              <li v-for="cat in categories" :key="cat">
                <button type="button" class="menu-item level-category" @click="selectCategory(cat)">
                  {{ cat }}
                </button>
              </li>
            </template>
            <template v-else>
              <li v-for="article in currentArticles" :key="article.name">
                <button type="button" class="menu-item level-article" @click="goToArticle(article.name)">
                  {{ article.name }}
                </button>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { articlesByCategory, categoryNames } from '../articles';

const router = useRouter();

const categories = categoryNames();

const menuOpen = ref(false);
const currentCategory = ref<string | null>(null);

const currentArticles = computed(() =>
  currentCategory.value ? articlesByCategory(currentCategory.value) : []
);

function goHome() {
  router.push('/');
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
  if (!menuOpen.value) currentCategory.value = null;
}

function selectCategory(cat: string) {
  currentCategory.value = cat;
}

function backToCategories() {
  currentCategory.value = null;
}

function goToArticle(name: string) {
  if (!currentCategory.value) return;
  // 跳到 /article/<分类>/<文章名>，hash 模式下 base 前缀自动处理
  router.push(`/article/${currentCategory.value}/${name}`);
  closeMenu();
}

function closeMenu() {
  menuOpen.value = false;
  currentCategory.value = null;
}

// 点击导航栏以外的区域时关闭菜单
function onDocClick() {
  closeMenu();
}

onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));
</script>

<style scoped>
.nav-rail {
  display: flex;
  justify-content: flex-end;
}

/* 顶级导航栏：66CCFF 底色 */
.nav-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border-radius: 14px;
  background-color: #66ccff;
  box-shadow: 0 4px 14px rgba(102, 204, 255, 0.4);
}

.nav-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.nav-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.nav-btn.is-open {
  background-color: rgba(255, 255, 255, 0.25);
}

/* 悬浮提示：显示在按钮左侧 */
.nav-btn::after {
  content: attr(data-tooltip);
  position: absolute;
  right: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) translateX(6px);
  background-color: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 60;
}

.nav-btn:hover::after {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

/* 菜单打开时隐藏文章按钮的提示，避免与菜单重叠 */
.nav-btn.is-open::after {
  opacity: 0;
}

.nav-btn-wrap {
  position: relative;
}

/* 级联菜单面板：从按钮左侧弹出 */
.nav-menu {
  position: absolute;
  right: calc(100% + 12px);
  top: 0;
  min-width: 132px;
  max-width: 220px;
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 50;
  animation: menu-in 0.15s ease-out;
}

@keyframes menu-in {
  from {
    opacity: 0;
    transform: translateX(8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.menu-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  background-color: #39c5bb;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.menu-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #fff;
  cursor: pointer;
}

.menu-back:hover {
  background-color: rgba(255, 255, 255, 0.25);
}

.menu-list {
  list-style: none;
  margin: 0;
  padding: 6px;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.menu-item + .menu-item {
  margin-top: 4px;
}

/* 第一级（分类）：39C5BB 底色 */
.level-category {
  background-color: #39c5bb;
  color: #fff;
}

.level-category:hover {
  background-color: #2eaaa0;
}

/* 第二级（文章）：B2D8E8 底色 */
.level-article {
  background-color: #b2d8e8;
  color: #1c3a4a;
}

.level-article:hover {
  background-color: #9cc6db;
}
</style>
