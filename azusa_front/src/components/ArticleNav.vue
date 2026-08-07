<template>
  <aside class="article-nav" :class="{ 'is-floating': isFloating }" @click.stop>
    <!-- 顶级导航栏：图标按钮，悬浮显示文字 -->
    <div class="nav-bar">
      <!-- 回到主页（首页也保留） -->
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

      <!-- 工具箱：级联菜单（首页 → 分类 → 工具），与文章导航一致 -->
      <div class="nav-btn-wrap">
        <button
          type="button"
          class="nav-btn"
          :class="{ 'is-open': toolMenuOpen, 'is-active': isToolRoute }"
          aria-label="工具箱"
          data-tooltip="工具箱"
          @click="toggleToolMenu"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="currentColor" d="M22.7 19 13.6 9.9c.8-1.4 1.1-3 .8-4.6-.4-2.2-1.9-4.1-4-4.8C9-.1 7.5.3 6.4 1.4L10.6 5.6l-2 2-4.2-4.2C3.3 4.5 2.9 6 3.3 7.5c.7 2.1 2.6 3.6 4.8 4 .1 0 .1 0 .2.1l2.8 2.8-1.2 1.2-2.8-2.8c-2.3-.8-4.9-.3-6.7 1.5L6 18.3l1.4-1.4 2.1 2.1-1.4 1.4 4.2 4.2c2-2 2.5-4.6 1.6-7l2.9 2.9a2 2 0 0 0 2.8-2.8L23.9 18.3a2 2 0 0 1-1.2 2.9 2 2 0 0 1-2.8-1.2h.8z" />
          </svg>
        </button>

        <!-- 工具级联菜单：第一级 工具箱首页 + 分类，第二级 工具列表 -->
        <div v-if="toolMenuOpen" class="nav-menu">
          <div v-if="toolCategory" class="menu-head">
            <button type="button" class="menu-back" aria-label="返回分类" @click="backToToolCategories">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path fill="currentColor" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12l4.6-4.6z" />
              </svg>
            </button>
            <span class="menu-head-title">{{ toolCategory }}</span>
          </div>
          <ul class="menu-list">
            <template v-if="!toolCategory">
              <li>
                <button type="button" class="menu-item level-home" @click="goToolHome">
                  工具箱首页
                </button>
              </li>
              <li v-for="cat in toolCategories" :key="cat">
                <button type="button" class="menu-item level-category" @click="selectToolCategory(cat)">
                  {{ cat }}
                </button>
              </li>
            </template>
            <template v-else>
              <li v-for="tool in currentTools" :key="tool.name">
                <button type="button" class="menu-item level-article" @click="goToTool(tool.name)">
                  {{ tool.name }}
                </button>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </div>

    <!-- 返回顶部按钮 + 阅读进度环：固定于视口右下角（首页开屏不显示） -->
    <button
      v-if="showBackTop"
      type="button"
      class="nav-btn back-top-btn"
      aria-label="回到顶部"
      data-tooltip="回到顶部"
      @click="scrollToTop"
    >
      <svg class="back-top-arrow" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="currentColor" d="M12 4l8 8-1.4 1.4L13 7.8V20h-2V7.8l-5.6 5.6L4 12l8-8z" />
      </svg>
      <svg class="progress-ring" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle
          class="ring-fg"
          cx="22"
          cy="22"
          r="19"
          fill="none"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="dashOffset"
        />
      </svg>
    </button>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { articlesByCategory, categoryNames } from '../articles';
import { toolCategoryNames, toolsByCategory } from '../tools';

const props = defineProps({
  // 文章内容是否已加载：切换文章后内容会先被清空再重新加载，
  // 用这个 prop 触发重新测量滚动容器，避免进度环停留在上一篇文章的数值上。
  contentReady: {
    type: Boolean,
    default: false,
  },
});

const router = useRouter();
const route = useRoute();

const categories = categoryNames();
const toolCategories = toolCategoryNames();

// 当前是否在首页：首页开屏是全屏图片，导航栏要等滚过开屏再固定（见 navStuck）
const isHome = computed(() => route.name === 'home');
// 当前是否在工具页：高亮"工具箱"按钮
const isToolRoute = computed(() => String(route.path).startsWith('/tool'));

const menuOpen = ref(false);
const currentCategory = ref<string | null>(null);
// 工具箱级联菜单：独立于文章菜单，打开时互斥（见 closeAllMenus）
const toolMenuOpen = ref(false);
const toolCategory = ref<string | null>(null);

const currentArticles = computed(() =>
  currentCategory.value ? articlesByCategory(currentCategory.value) : []
);
const currentTools = computed(() =>
  toolCategory.value ? toolsByCategory(toolCategory.value) : []
);

// 阅读进度环：进度 = 页面滚动位置 / (文档可滚动高度 - 视口高度)，转成圆环周长比例。
// 周长为 0 时圆环完全隐藏，100% 时闭合为整圆，符合"进度环"语义。
const CIRCUMFERENCE = 2 * Math.PI * 19; // r=19，周长 ≈ 119.38
const progress = ref(0);
let scrollRaf = 0; // 滚动节流：requestAnimationFrame 的 id，0 表示空闲

// 首页导航栏吸顶逻辑：开屏是全屏图片，导航栏先浮在开屏底部（与文章区顶部平齐），
// 滚动越过开屏（>100vh）后固定到视口右上角（与文章/工具页位置一致）。
// 非首页时始终固定。
const isFloating = ref(false);
const HOME_SPLASH_H = window.innerHeight;

function updateNavState() {
  const next = isHome.value && window.scrollY < HOME_SPLASH_H - 1;
  if (next !== isFloating.value) isFloating.value = next;
}

function updateProgress() {
  const docEl = document.documentElement;
  const scrollable = docEl.scrollHeight - window.innerHeight;
  if (scrollable <= 0) {
    progress.value = 0;
    return;
  }
  progress.value = Math.min(1, Math.max(0, window.scrollY / scrollable));
}

function onScroll() {
  // requestAnimationFrame 节流：滚动事件高频触发，避免每次重排计算进度
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    updateProgress();
    updateNavState();
  });
}

const dashOffset = computed(() => CIRCUMFERENCE * (1 - progress.value));

// 返回顶部按钮：首页开屏（导航栏浮在底部）时隐藏，其余情况显示
const showBackTop = computed(() => !isFloating.value);

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
  router.push('/');
}

function toggleMenu() {
  // 打开文章菜单时关闭工具菜单，保证两个菜单互斥
  if (!menuOpen.value) closeToolMenu();
  menuOpen.value = !menuOpen.value;
  if (!menuOpen.value) currentCategory.value = null;
}

function toggleToolMenu() {
  // 打开工具菜单时关闭文章菜单
  if (!toolMenuOpen.value) closeMenu();
  toolMenuOpen.value = !toolMenuOpen.value;
  if (!toolMenuOpen.value) toolCategory.value = null;
}

function selectCategory(cat: string) {
  currentCategory.value = cat;
}

function selectToolCategory(cat: string) {
  toolCategory.value = cat;
}

function backToCategories() {
  currentCategory.value = null;
}

function backToToolCategories() {
  toolCategory.value = null;
}

function goToArticle(name: string) {
  if (!currentCategory.value) return;
  // 跳到 /article/<分类>/<文章名>，hash 模式下 base 前缀自动处理
  router.push(`/article/${currentCategory.value}/${name}`);
  closeMenu();
}

function goToTool(name: string) {
  if (!toolCategory.value) return;
  // 跳到 /tool/<分类>/<工具名>
  router.push(`/tool/${toolCategory.value}/${name}`);
  closeToolMenu();
}

function goToolHome() {
  router.push('/tool');
  closeToolMenu();
}

function closeMenu() {
  menuOpen.value = false;
  currentCategory.value = null;
}

function closeToolMenu() {
  toolMenuOpen.value = false;
  toolCategory.value = null;
}

function closeAllMenus() {
  closeMenu();
  closeToolMenu();
}

// 点击导航栏以外的区域时关闭菜单
function onDocClick() {
  closeAllMenus();
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  window.addEventListener('scroll', onScroll, { passive: true });
  updateProgress(); // 首帧测量一次，避免初始时进度环空转
  updateNavState(); // 首帧确定导航栏是浮空还是固定
  window.addEventListener('resize', updateProgress); // 窗口尺寸变化后重新测量可滚动高度
});

onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', updateProgress);
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
});

// 文章内容切换（加载中/加载完成/失败清空）后，文档高度变化，重新测量进度
watch(
  () => props.contentReady,
  () => {
    // 等 DOM 更新完成、文档有了新高度再测量
    requestAnimationFrame(updateProgress);
  }
);

// 路由切换（如从文章页返回首页）后，滚动位置变化，重新确定导航栏是浮动还是固定。
// ArticleNav 在页面间复用，不能只依赖 onMounted 初始化。
watch(
  () => route.name,
  () => {
    requestAnimationFrame(() => {
      updateNavState();
      updateProgress();
    });
  }
);
</script>

<style scoped>
/* 右侧导航栏容器：默认固定在视口右上角（文章/工具/其他页通用）。
   首页开屏（is-floating）时改为绝对定位于开屏底部，随滚动上滑直至固定。 */
.article-nav {
  position: fixed;
  right: 0;
  top: 0;
  width: 14%;
  height: 100vh;
  padding: 24px 1% 0;
  box-sizing: border-box;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start; /* 关键：导航栏按内容高度排布，不被拉伸成一长条 */
  pointer-events: none; /* 空白区域不拦截点击，穿透到下方正文 */
}

/* 首页开屏阶段：导航栏浮在开屏图片底部（视口 100vh 处），
   与文章区（main-section）顶部平齐；滚过开屏后 is-floating 移除，回到右上角固定 */
.article-nav.is-floating {
  position: absolute;
  top: 100vh;
  height: auto;
  align-items: flex-start;
}

/* 导航栏与返回顶部按钮自身可点击 */
.nav-bar,
.back-top-btn {
  pointer-events: auto;
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

/* 当前所在页面对应的导航按钮高亮 */
.nav-btn.is-active {
  background-color: rgba(255, 255, 255, 0.28);
}

/* 返回顶部 + 进度环按钮：固定在视口右下角。
   右边缘与顶部导航栏对齐，底部留 28px */
.back-top-btn {
  position: fixed;
  right: 1vw;
  bottom: 28px;
  z-index: 90;
  width: 44px;
  height: 44px;
  padding: 0;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  pointer-events: auto; /* 右栏容器 pointer-events:none，这里恢复按钮可点击 */
}

.back-top-btn:hover {
  background: #f2fbff;
}

/* 箭头：66CCFF，悬浮时轻微上浮 */
.back-top-arrow {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: #66ccff;
  transition: transform 0.2s ease;
}

.back-top-btn:hover .back-top-arrow {
  transform: translate(-50%, -56%);
}

/* 进度环：39C5BB 描边，圆心留空，逆时针起于顶部 */
.progress-ring {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg); /* 起点转到顶部，否则从 3 点钟方向开始 */
  pointer-events: none;
}

.ring-fg {
  stroke: #39c5bb;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.1s linear; /* 滚动时平滑过渡 */
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

/* 工具菜单第一级的「工具箱首页」：66CCFF 底色，与分类项同属一级但加以区分 */
.level-home {
  background-color: #66ccff;
  color: #fff;
}

.level-home:hover {
  background-color: #4bbdf5;
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
