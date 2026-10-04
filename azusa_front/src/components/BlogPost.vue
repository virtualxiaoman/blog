<template>
  <div ref="rootRef" class="blog-section">
    <div class="board-header">
      <p class="board-hint">点击板块标题可折叠/展开，点击卡片即可阅读对应文章。</p>
      <button type="button" class="toggle-all" @click="toggleAll">
        {{ allExpanded ? '全部折叠' : '全部展开' }}
      </button>
    </div>

    <section v-for="cat in categories" :key="cat" class="board-group" :data-cat="cat">
      <button
        type="button"
        class="group-head"
        :aria-expanded="isExpanded(cat)"
        @click="toggleGroup(cat)"
      >
        <span class="group-title">{{ cat }}</span>
        <span class="group-count">{{ articlesByCategory(cat).length }} 篇</span>
        <svg
          class="group-chevron"
          :class="{ 'is-open': isExpanded(cat) }"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z" />
        </svg>
      </button>

      <div class="group-collapse">
        <div class="group-grid">
          <RouterLink
            v-for="article in articlesByCategory(cat)"
            :key="article.name"
            class="blog-post"
            :to="`/article/${cat}/${article.name}`"
          >
            <img loading="lazy" :src="`${base}article/cover/${coverFile(article.name)}`" :alt="article.name">
            <div class="post-info">
              <h3>{{ article.name }}</h3>
            </div>
          </RouterLink>
        </div>
      </div>
    </section>

    <div class="archive-row">
      <RouterLink class="archive-card" to="/article/choice">
        <img :src="`${base}article/cover/其他文章.jpg`" alt="全部文章归档">
        <div class="archive-info">
          <span class="archive-title">全部文章归档</span>
          <span class="archive-desc">其他文章与 PDF 资料</span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { articlesByCategory, categoryNames, coverFile } from '../articles';

const base = import.meta.env.BASE_URL;
const categories = categoryNames();

const rootRef = ref<HTMLElement | null>(null);

// 各板块折叠状态：默认全部展开
const expanded = ref<Record<string, boolean>>(
  Object.fromEntries(categories.map((cat) => [cat, true]))
);

const allExpanded = computed(() => categories.every((cat) => expanded.value[cat]));

function isExpanded(cat: string): boolean {
  return expanded.value[cat];
}

function toggleGroup(cat: string) {
  scheduleToggle([cat], !expanded.value[cat]);
}

function toggleAll() {
  scheduleToggle([...categories], !allExpanded.value);
}

// 预解码已加载的图片：否则折叠/展开动画首帧会把"加载了但未解码"的大图同步解码，
// 单次可达约 100ms 的渲染长帧（实测）。
onMounted(() => {
  rootRef.value?.querySelectorAll('img').forEach((img) => {
    const predecode = () => { img.decode().catch(() => {}); };
    if (img.complete) predecode();
    else img.addEventListener('load', predecode, { once: true });
  });
});

const COLLAPSE_MS = 220;
const EASING = 'ease-in-out';
// 全局操作时板块之间的错峰间隔：多个内容层同时首次光栅化会叠加成 60~150ms 的
// 卡顿帧（实测），错峰后每层的光栅化分散到不同帧，主线程不再被长时间阻塞。
const STAGGER_MS = 150;

// 操作序列号：新的点击会让尚未执行/收尾的旧动画失效
let sequence = 0;

function scheduleToggle(cats: string[], open: boolean) {
  sequence += 1;
  const mine = sequence;
  const stagger = cats.length > 1 ? STAGGER_MS : 0;

  cats.forEach((cat, i) => {
    const run = () => {
      if (mine !== sequence) return;
      runToggle(cat, open, mine);
      expanded.value[cat] = open;
    };
    if (i === 0) run();
    else window.setTimeout(run, i * stagger);
  });

  // 全部步骤结束后统一清理内联样式（不依赖单步定时器，避免错峰期间的清理竞争）
  window.setTimeout(() => {
    if (mine !== sequence) return;
    finalizeAll();
  }, stagger * (cats.length - 1) + COLLAPSE_MS + 80);
}

/**
 * 单个板块的折叠/展开：布局瞬变 + FLIP + clip-path 擦除。
 *
 * 为什么不直接过渡 height：height 是布局动画，会带动"被推动的下方板块"每帧重新
 * 光栅化（含图片的大区域，实测单帧 50~160ms、阻塞输入 80ms+）。
 * 这里两步解决：
 *  1. 布局瞬变（同一同步任务内完成高度切换），被推动的板块用 transform 反向补偿，
 *     渲染器发现"视觉位置从未变化过"，不需要任何重绘；
 *  2. transform 与 clip-path 补间交给合成器播放（0.3s 缓入缓出），
 *     板块平移补位、内容从底部卷起/向下揭示。
 * First/Last 都以"当前视觉位置"为起点，快速连点或中途反向会平滑续播。
 */
function runToggle(cat: string, open: boolean, mine: number) {
  const root = rootRef.value;
  if (!root) return;

  const targets = [...root.querySelectorAll<HTMLElement>('.board-group, .archive-row')];
  const box = root.querySelector<HTMLElement>(`[data-cat="${cat}"] .group-collapse`)!;
  const grid = box.querySelector<HTMLElement>('.group-grid')!;

  // 1) 记录当前视觉位置（含进行中的 transform，用于中断续播）
  const first = targets.map((t) => t.getBoundingClientRect().top);

  // 2) 冻结进行中的 clip（读当前计算值），并先把所有过渡降为 none 再动布局
  const clipValue = getComputedStyle(grid).clipPath;
  const startClip = clipValue && clipValue !== 'none' ? clipValue : null;
  grid.style.transition = 'none';
  targets.forEach((t) => { t.style.transition = 'none'; });

  // 3) 展开前恢复可见（折叠终态是 visibility:hidden）
  if (open) box.style.visibility = '';

  // 4) 清除旧补偿，让下一步读到纯布局位置
  targets.forEach((t) => { t.style.transform = ''; });

  // 5) 布局瞬变
  box.style.overflow = 'visible';
  box.style.height = open ? '' : '0px';
  box.style.marginTop = open ? '' : '0px';

  // 6) 读 Last 并做 FLIP 补偿：视觉位置 = 布局位置 + 补偿 = 变化前位置
  const last = targets.map((t) => t.getBoundingClientRect().top);
  targets.forEach((t, i) => {
    const dy = first[i] - last[i];
    if (dy !== 0) t.style.transform = `translateY(${dy}px)`;
  });

  // 7) clip 起始状态（无历史值时按方向取全显/全隐）
  grid.style.willChange = 'clip-path';
  grid.style.clipPath = startClip ?? (open ? 'inset(0 0 100% 0)' : 'inset(0 0 0% 0)');

  void root.offsetHeight; // flush 起始状态，保证过渡从静止值开始

  requestAnimationFrame(() => {
    if (mine !== sequence) return;
    targets.forEach((t) => {
      if (t.style.transform) {
        t.style.transition = `transform ${COLLAPSE_MS}ms ${EASING}`;
        t.style.transform = 'translateY(0px)';
      }
    });
    grid.style.transition = `clip-path ${COLLAPSE_MS}ms ${EASING}`;
    grid.style.clipPath = open ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)';
  });
}

// 序列结束后清理全部内联样式。
// 折叠完成的板块用 visibility:hidden 隐藏：不可见、不可聚焦，但保留渲染树与
// 光栅缓存——若改用 display:none，展开时层需整体重建（实测阻塞主线程 ~100ms）。
function finalizeAll() {
  const root = rootRef.value;
  if (!root) return;
  root.querySelectorAll<HTMLElement>('.board-group, .archive-row').forEach((t) => {
    t.style.transition = '';
    t.style.transform = '';
  });
  root.querySelectorAll<HTMLElement>('.group-collapse').forEach((box) => {
    const cat = box.closest<HTMLElement>('.board-group')?.dataset.cat;
    const folded = cat && !expanded.value[cat];
    box.style.overflow = '';
    // 折叠态要保留 height/margin 为 0：visibility:hidden 仍参与布局，不能放开高度
    box.style.height = folded ? '0px' : '';
    box.style.marginTop = folded ? '0px' : '';
    box.style.visibility = folded ? 'hidden' : '';
  });
  root.querySelectorAll<HTMLElement>('.group-grid').forEach((g) => {
    g.style.transition = '';
    g.style.willChange = '';
    g.style.clipPath = '';
  });
}
</script>

<style scoped>
.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin: 10px 0 28px;
}

.board-hint {
  margin: 0;
  color: #73767a;
}

.toggle-all {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 999px;
  background-color: #66ccff;
  color: #fff;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.toggle-all:hover {
  background-color: #4bbdf5;
}

.board-group + .board-group {
  margin-top: 28px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  padding: 12px 18px;
  border: none;
  border-radius: 10px;
  background-color: #fff;
  box-shadow: 0 2px 10px rgba(102, 204, 255, 0.28);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.group-head:hover {
  background-color: #f5fbff;
  box-shadow: 0 4px 14px rgba(102, 204, 255, 0.4);
}

.group-title {
  font-size: 22px;
  font-weight: 700;
  color: #409eff;
}

.group-count {
  font-size: 13px;
  color: #73767a;
}

.group-chevron {
  margin-left: auto;
  color: #409eff;
  transform: rotate(-90deg);
  transition: transform 0.3s ease-in-out;
}

.group-chevron.is-open {
  transform: rotate(0deg);
}

/* 折叠容器：动画期间 overflow 由 JS 置为 visible（内容靠 clip-path 控制可见性），
   折叠/展开的布局切换与位移补间也由 JS 统一驱动（见 setExpanded） */
.group-collapse {
  margin-top: 16px;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

@media (max-width: 1220px) {
  .group-grid {
    grid-template-columns: 1fr;
  }

  /* 单列时卡片宽度翻倍，图片回到卡片宽的 25%（与旧版单列一致） */
  .blog-post img {
    width: 25%;
  }
}

.blog-post {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  text-decoration: none;
}

/* 双列卡片宽约为旧版单列的一半，图片取卡片宽的 50%，渲染尺寸与旧版一致 */
.blog-post img {
  flex: 0 0 auto;
  width: 50%;
  height: 175px;
  object-fit: cover;
}

.post-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 1rem;
}

.post-info h3 {
  margin: 0;
  font-size: 24px;
  color: #409EFF;
}

.archive-row {
  display: flex;
  justify-content: center;
  margin-top: 40px;
}

.archive-card {
  display: flex;
  align-items: center;
  width: 460px;
  max-width: 100%;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.archive-card:hover {
  background-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 6px 18px rgba(102, 204, 255, 0.4);
}

.archive-card img {
  flex: 0 0 auto;
  width: 185px;
  height: 120px;
  object-fit: cover;
}

.archive-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 20px;
}

.archive-title {
  font-size: 20px;
  font-weight: 700;
  color: #409eff;
}

.archive-desc {
  font-size: 13px;
  color: #73767a;
}
</style>
