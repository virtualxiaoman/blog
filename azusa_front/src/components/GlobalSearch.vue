<template>
  <!-- 全局搜索：Ctrl+K 触发，悬浮半透明窗口，点击背景关闭 -->
  <Teleport to="body">
    <div v-if="open" class="gs-backdrop" @click.self="close">
      <div class="gs-panel">
        <input
          ref="inputRef"
          v-model="query"
          class="gs-input"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="搜索文章、小节、工具、正文…"
          @input="onInput"
          @keydown="onPanelKeydown"
        />
        <ul v-if="results.length" class="gs-list">
          <li
            v-for="(item, i) in results"
            :key="`${item.type}-${item.path}-${item.sec}-${item.snippet}-${i}`"
            class="gs-item"
            :class="{ active: i === activeIndex }"
            @mouseenter="activeIndex = i"
            @click="go(item)"
          >
            <span class="gs-type" :class="item.type">{{ typeLabel(item.type) }}</span>
            <span class="gs-title">{{ item.title }}</span>
            <span class="gs-sub">{{ item.subtitle }}</span>
            <span v-if="item.snippet" class="gs-snippet">{{ item.snippet }}</span>
          </li>
        </ul>
        <p v-else-if="query && !loading" class="gs-empty">未找到与「{{ query }}」相关的内容</p>
        <p v-else-if="query && loading" class="gs-empty">正在搜索正文…</p>
        <p v-else class="gs-empty gs-hint">
          ↑↓ 选择 · Enter 跳转 · Esc 关闭
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { searchAll, type SearchType } from '../search-index';
import { searchContent, type ContentSearchResult } from '../content-search';

const route = useRoute();
const router = useRouter();

const open = ref(false);
const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const activeIndex = ref(0);
const loading = ref(false); // 正文索引懒加载中
const contentResults = ref<ContentSearchResult[]>([]); // 异步加载的正文搜索结果

// 标题索引结果（同步，即时）
const titleResults = computed(() => searchAll(query.value, 20));

// 合并标题与正文结果：标题结果在前，正文结果在后（优先展示标题，再展示正文）。
// 两组各自已按评分降序排列（标题：100/30/10；正文：50/10）。
interface MergedResult {
  type: SearchType;
  title: string;
  subtitle: string;
  path: string;
  sec: number | null;
  score: number;
  snippet?: string;
}
const results = computed<MergedResult[]>(() => {
  const titles = titleResults.value.map((t) => ({
    type: t.type,
    title: t.title,
    subtitle: t.subtitle,
    path: t.path,
    sec: t.sec,
    score: 0, // 标题结果的分数在标题组内部已排序，合并时不参与跨组比较
    snippet: undefined,
  }));
  const contents = contentResults.value.map((c) => ({
    type: 'content' as const,
    title: c.title,
    subtitle: `${c.category} / ${c.article}`,
    path: c.path,
    sec: c.sec,
    score: c.score,
    snippet: c.snippet,
  }));
  return [...titles, ...contents];
});

// 打开时锁定背景滚动，关闭后恢复
watch(open, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

// 输入即搜（无需点按钮）。正文搜索是异步的（懒加载索引），
// 用 debounce 避免每次击键都触发 fetch/json 解析；标题搜索仍即时。
let contentTimer = 0;
function onInput() {
  activeIndex.value = 0;
  clearTimeout(contentTimer);
  const q = query.value.trim();
  if (!q) {
    contentResults.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  contentTimer = window.setTimeout(async () => {
    contentResults.value = await searchContent(q, 3);
    loading.value = false;
  }, 200); // 200ms debounce：等用户停止输入再查正文
}

function openSearch() {
  query.value = '';
  contentResults.value = [];
  loading.value = false;
  activeIndex.value = 0;
  open.value = true;
  nextTick(() => inputRef.value?.focus());
}

function close() {
  open.value = false;
}

function toggle() {
  if (open.value) close();
  else openSearch();
}

// 全局 Ctrl+K / ⌘K 触发（任意界面可用，preventDefault 阻止浏览器默认行为）
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    toggle();
  }
}

// 面板内键盘导航：方向键移动高亮，Enter 跳转，Esc 关闭
function onPanelKeydown(e: KeyboardEvent) {
  const n = results.value.length;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (n) activeIndex.value = (activeIndex.value + 1) % n;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (n) activeIndex.value = (activeIndex.value - 1 + n) % n;
  } else if (e.key === 'Enter') {
    const item = results.value[activeIndex.value];
    if (item) go(item);
  } else if (e.key === 'Escape') {
    close();
  }
}

const TYPE_LABELS: Record<MergedResult['type'], string> = {
  article: '文章',
  section: '小节',
  tool: '工具',
  page: '页面',
  content: '正文',
};
function typeLabel(t: MergedResult['type']) {
  return TYPE_LABELS[t];
}

// 定位到文章内标题：按 data-sec 序号轮询（mdViewer 异步渲染，元素出现后才能滚动）。
// 标题 id 由 base64 公式占位符生成、不可预测，data-sec 序号才是稳定的定位依据。
function scrollToSection(sec: number, attempt = 0) {
  const el = document.querySelector(`[data-sec="${sec}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (attempt < 50) setTimeout(() => scrollToSection(sec, attempt + 1), 100);
}

// 定位到文章顶部（整篇文章的搜索结果）
function scrollToArticleTop(attempt = 0) {
  const title = document.querySelector('.main-title');
  if (title) {
    title.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (attempt < 50) setTimeout(() => scrollToArticleTop(attempt + 1), 100);
}

async function go(item: MergedResult) {
  close();
  // 已在该文章页面：小节直接原地定位，无需路由跳转
  if (route.path === item.path && item.sec != null) {
    scrollToSection(item.sec);
    return;
  }
  await router.push(item.path);
  if (item.sec != null) {
    scrollToSection(item.sec); // 跳转到文章内对应小节
  } else if (item.type === 'article' || item.type === 'section') {
    scrollToArticleTop(); // 整篇文章：定位到文章标题
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 工具/页面：回到顶部
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
  clearTimeout(contentTimer);
  document.body.style.overflow = '';
});
</script>

<style scoped>
/* 遮罩：轻微压暗背景，点击任意非面板区域即关闭 */
.gs-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(20, 40, 55, 0.25);
  backdrop-filter: blur(2px);
  animation: gs-fade-in 0.12s ease-out;
}

/* 面板：悬浮窗口，半透明磨砂感，居中偏上，不占满屏幕 */
.gs-panel {
  position: absolute;
  top: 16vh;
  left: 50%;
  transform: translateX(-50%);
  width: min(640px, 92vw);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px) saturate(1.3);
  border: 1px solid rgba(102, 204, 255, 0.35);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 30, 50, 0.25);
  overflow: hidden;
  animation: gs-panel-in 0.15s ease-out;
}

.gs-input {
  width: 100%;
  box-sizing: border-box;
  padding: 18px 22px;
  border: none;
  background: transparent;
  font-size: 18px;
  color: #1c3a4a;
  outline: none;
}

.gs-input::placeholder {
  color: #a7b4bd;
}

/* 结果列表：输入框下方，可滚动 */
.gs-list {
  list-style: none;
  margin: 0;
  padding: 0 8px 8px;
  max-height: calc(70vh - 60px);
  overflow-y: auto;
  border-top: 1px solid rgba(102, 204, 255, 0.2);
}

.gs-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 9px;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.gs-item.active {
  background: rgba(102, 204, 255, 0.28);
}

.gs-type {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
  background: #a7b4bd;
}

.gs-type.article {
  background: #409eff;
}

.gs-type.section {
  background: #39c5bb;
}

.gs-type.tool {
  background: #66ccff;
}

.gs-type.page {
  background: #9aa8b8;
}

.gs-type.content {
  background: #ecad9e;
}

.gs-title {
  font-size: 15px;
  color: #1c3a4a;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gs-sub {
  flex-shrink: 0;
  font-size: 12px;
  color: #7d8a94;
  max-width: 30%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 正文结果摘要：单行省略，展示"为什么命中" */
.gs-snippet {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #94a1ab;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gs-empty {
  margin: 0;
  padding: 16px 22px;
  border-top: 1px solid rgba(102, 204, 255, 0.2);
  font-size: 14px;
  color: #7d8a94;
}

.gs-hint {
  color: #a7b4bd;
  text-align: center;
}

@keyframes gs-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes gs-panel-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
