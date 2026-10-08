<template>
  <!-- 全局搜索：Ctrl+K 触发，悬浮半透明窗口，点击背景关闭 -->
  <Teleport to="body">
    <div v-if="open" class="gs-backdrop" @click.self="close">
      <div class="gs-panel" :class="{ 'is-scope-open': scopeOpen }">
        <input
          ref="inputRef"
          v-model="query"
          class="gs-input"
          type="text"
          spellcheck="false"
          autocomplete="off"
          :placeholder="placeholder"
          @input="onInput"
          @keydown="onPanelKeydown"
        />
        <div class="gs-scope-row">
          <SearchScopePicker
            :model-value="scopeLeaves"
            :open="scopeOpen"
            @update:model-value="onScopeUpdate"
            @update:open="scopeOpen = $event"
          />
          <span v-if="showResultCount" class="gs-result-count">共 <strong>{{ totalCount }}</strong> 条结果</span>
        </div>
        <div v-if="results.length" class="gs-list">
          <a
            v-for="(item, i) in results"
            :key="`${item.type}-${item.path}-${item.dynKey ?? ''}-${item.sec}-${item.snippet ?? ''}-${i}`"
            class="gs-item"
            :class="{ active: i === activeIndex }"
            :href="itemHref(item)"
            @mouseenter="activeIndex = i"
            @click="onItemClick($event, item)"
          >
            <span class="gs-type" :class="item.type">{{ typeLabel(item.type) }}</span>
            <span class="gs-title">{{ item.title }}</span>
            <span class="gs-sub">{{ item.subtitle }}</span>
            <span v-if="item.snippet" class="gs-snippet">{{ item.snippet }}</span>
          </a>
        </div>
        <p v-else-if="scopeEmpty" class="gs-empty gs-hint">
          未选择搜索范围 · 点击上方「范围」勾选要搜索的内容
        </p>
        <p v-else-if="query && !loading" class="gs-empty">未找到与「{{ query }}」相关的内容</p>
        <p v-else-if="query && loading" class="gs-empty">正在搜索…</p>
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
import { searchAll, countAll, type SearchType } from '../search-index';
import { searchContent, type ContentSearchResult } from '../content-search';
import { searchDynamics, type DynamicSearchHit } from '../views/Luotianyi/dynamic-search';
import { scrollToElementStable } from '../utils/stableScroll';
import {
  allScope,
  defaultBlogScope,
  defaultDynamicScope,
  isEmptyScope,
  isSameScope,
  scopeSummary,
  toScopeFilter,
  type ScopeFilter,
} from '../search-scope';
import SearchScopePicker from './SearchScopePicker.vue';

const route = useRoute();
const router = useRouter();

const open = ref(false);
const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const activeIndex = ref(0);
const loading = ref(false); // 正文/动态索引懒加载中
const contentResults = ref<ContentSearchResult[]>([]); // 异步加载的正文搜索结果
const dynamicResults = ref<DynamicSearchHit[]>([]); // 异步加载的动态搜索结果
const contentTotal = ref(0); // 正文真实命中数（列表有每篇 3 条上限，总数不受限）
const dynamicTotal = ref(0); // 动态真实命中数（列表最多 50 条）
const scopeOpen = ref(false); // 范围下拉是否展开

// ---- 搜索范围：会话内按界面类型记忆（动态界面 / 其他界面各一份，初始为各自默认，刷新后重置）----

type ScopeSlot = 'dynamic' | 'other';

const scopeSlots: Record<ScopeSlot, Set<string>> = {
  dynamic: defaultDynamicScope(),
  other: defaultBlogScope(),
};

// 动态界面 = 洛天依"动态"板块或动态详情页；其余界面归入"其他"
function interfaceSlot(): ScopeSlot {
  const onDynamicBoard = route.path === '/lty' && route.query.tab === 'dynamic';
  const onDynamicDetail = route.path.startsWith('/lty/dynamic/');
  return onDynamicBoard || onDynamicDetail ? 'dynamic' : 'other';
}

const scopeLeaves = ref<ReadonlySet<string>>(scopeSlots[interfaceSlot()]);
const scope = computed<ScopeFilter>(() => toScopeFilter(scopeLeaves.value));
const scopeEmpty = computed(() => isEmptyScope(scopeLeaves.value));

// 界面类型切换（动态 ↔ 其他）：换用该类型上次的选择；浮层开着时按新范围重搜
watch(
  () => interfaceSlot(),
  (slot) => {
    scopeLeaves.value = scopeSlots[slot];
    scopeOpen.value = false;
    if (open.value) scheduleSearch(0);
  }
);

function onScopeUpdate(next: Set<string>) {
  scopeSlots[interfaceSlot()] = next;
  scopeLeaves.value = next;
  activeIndex.value = 0;
  scheduleSearch(0); // 勾选实时生效：立即按新范围重搜
}

// 输入框占位文案随范围变化，让用户打开就能确认正在搜索的范围
const placeholder = computed(() => {
  const leaves = scopeLeaves.value;
  if (isEmptyScope(leaves)) return '请先选择搜索范围…';
  if (isSameScope(leaves, allScope())) return '搜索文章、小节、工具、正文、动态…';
  if (isSameScope(leaves, defaultBlogScope())) return '搜索文章、小节、工具、正文…';
  if (isSameScope(leaves, defaultDynamicScope())) return '搜索洛天依动态（标题、正文）…';
  return `在「${scopeSummary(leaves)}」中搜索…`;
});

// 标题索引结果（同步，即时；随范围变化重算）
const titleResults = computed(() => searchAll(query.value, 20, scope.value));

// 结果计数：标题 + 正文 + 动态的真实匹配总数（标题同步、其余异步到达后并入）。
// 异步结果未返回前不展示，避免数字中途跳变。
const titleTotal = computed(() => countAll(query.value, scope.value));
const totalCount = computed(() => titleTotal.value + contentTotal.value + dynamicTotal.value);
const showResultCount = computed(
  () => Boolean(query.value.trim()) && !scopeEmpty.value && !loading.value
);

// 合并标题、正文与动态结果：标题结果在前，正文结果其次，动态结果最后。
// 各组已按评分降序排列（标题：100/30/10；正文：50/10；动态：标题/正文取高）。
type MergedType = SearchType | 'dynamic';
interface MergedResult {
  type: MergedType;
  title: string;
  subtitle: string;
  path: string;
  sec: number | null;
  score: number;
  snippet?: string;
  dynKey?: string; // 动态结果的跳转 key（走命名路由）
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
  const dynamics = dynamicResults.value.map((d) => ({
    type: 'dynamic' as const,
    title: d.entry.title,
    subtitle: `${d.entry.date} · ${d.entry.typeLabel}`,
    path: '',
    sec: null,
    score: d.score,
    snippet: d.snippet,
    dynKey: d.entry.key,
  }));
  return [...titles, ...contents, ...dynamics];
});

// 打开时锁定背景滚动，关闭后恢复
watch(open, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

// 输入即搜（无需点按钮）。正文/动态搜索是异步的（懒加载索引），
// 用 debounce 避免每次击键都触发 fetch/json 解析；标题搜索仍即时。
// searchSeq 单调递增：已发出的慢请求 resolve 时若序号已过期则丢弃，
// 避免旧查询结果覆盖新查询结果。
let contentTimer = 0;
let searchSeq = 0;

function scheduleSearch(delay: number) {
  activeIndex.value = 0;
  clearTimeout(contentTimer);
  const q = query.value.trim();
  const seq = ++searchSeq;
  if (!q || scopeEmpty.value) {
    contentResults.value = [];
    dynamicResults.value = [];
    contentTotal.value = 0;
    dynamicTotal.value = 0;
    loading.value = false;
    return;
  }
  loading.value = true;
  contentTimer = window.setTimeout(() => void runSearch(q, seq), delay);
}

function onInput() {
  scheduleSearch(200); // 200ms debounce：等用户停止输入再查正文/动态
}

async function runSearch(q: string, seq: number) {
  const filter = scope.value;
  const tasks: Promise<void>[] = [];
  if (filter.articles.size > 0) {
    tasks.push(
      searchContent(q, 3, filter).then((res) => {
        if (seq !== searchSeq) return;
        contentResults.value = res.results;
        contentTotal.value = res.total;
      })
    );
  } else {
    contentResults.value = [];
    contentTotal.value = 0;
  }
  if (filter.dynamics) {
    tasks.push(
      searchDynamics(q).then((res) => {
        if (seq !== searchSeq) return;
        dynamicResults.value = res.hits;
        dynamicTotal.value = res.total;
      })
    );
  } else {
    dynamicResults.value = [];
    dynamicTotal.value = 0;
  }
  await Promise.all(tasks);
  if (seq === searchSeq) loading.value = false;
}

function openSearch() {
  searchSeq++; // 作废可能在飞的旧请求
  query.value = '';
  contentResults.value = [];
  dynamicResults.value = [];
  contentTotal.value = 0;
  dynamicTotal.value = 0;
  loading.value = false;
  activeIndex.value = 0;
  scopeOpen.value = false;
  open.value = true;
  nextTick(() => inputRef.value?.focus());
}

function close() {
  open.value = false;
  scopeOpen.value = false;
}

function toggle() {
  if (open.value) close();
  else openSearch();
}

// 全局键盘：Ctrl+K / ⌘K 开关浮层；浮层打开时 Esc 也能关（先关范围下拉、再关面板，
// 不依赖焦点位置——焦点可能落在范围勾选框上）
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    toggle();
    return;
  }
  if (e.key === 'Escape' && open.value) {
    if (scopeOpen.value) {
      scopeOpen.value = false;
      return;
    }
    close();
  }
}

// 面板内键盘导航：方向键移动高亮，Enter 跳转，Esc 先关范围下拉、再关面板
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
    e.stopPropagation(); // 输入框已处理，不再冒泡到全局 Esc 处理
    if (scopeOpen.value) {
      scopeOpen.value = false;
      return;
    }
    close();
  }
}

const TYPE_LABELS: Record<MergedType, string> = {
  article: '文章',
  section: '小节',
  tool: '工具',
  page: '页面',
  content: '正文',
  dynamic: '动态',
};
function typeLabel(t: MergedType) {
  return TYPE_LABELS[t];
}

// 定位到文章内标题：按 data-sec 序号轮询（mdViewer 异步渲染，元素出现后才能滚动）。
// 标题 id 由 base64 公式占位符生成、不可预测，data-sec 序号才是稳定的定位依据。
// 元素出现后仍需持续校正落点：懒加载图片会撑高文档把目标向下推。
function scrollToSection(sec: number, attempt = 0) {
  const el = document.querySelector(`[data-sec="${sec}"]`);
  if (el) {
    scrollToElementStable(el);
    return;
  }
  if (attempt < 50) setTimeout(() => scrollToSection(sec, attempt + 1), 100);
}

// 定位到文章顶部（整篇文章的搜索结果）
function scrollToArticleTop(attempt = 0) {
  const title = document.querySelector('.main-title');
  if (title) {
    scrollToElementStable(title);
    return;
  }
  if (attempt < 50) setTimeout(() => scrollToArticleTop(attempt + 1), 100);
}

// 结果用真实链接渲染（右键可"在新标签页中打开"、可复制链接）；
// 普通左键仍走 SPA 跳转 + 小节定位逻辑，修饰键/中键交给浏览器新标签页打开
function itemHref(item: MergedResult) {
  if (item.dynKey) return router.resolve({ name: 'lty-dynamic', params: { key: item.dynKey } }).href;
  return router.resolve(item.path).href;
}

function onItemClick(e: MouseEvent, item: MergedResult) {
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  void go(item);
}

async function go(item: MergedResult) {
  close();
  if (item.dynKey) {
    await router.push({ name: 'lty-dynamic', params: { key: item.dynKey } });
    return;
  }
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
  min-height: 0;
  transition: min-height 0.15s ease-out;
  animation: gs-panel-in 0.15s ease-out;
}

/* 范围下拉展开时面板自动增高：下拉是面板内的绝对定位元素（面板 overflow:hidden），
   面板太矮（如空状态只有输入框+chip 时）会把下拉底边裁掉；增高后下拉可完整展示 */
.gs-panel.is-scope-open {
  min-height: min(70vh, 560px);
}

.gs-input {
  width: 100%;
  box-sizing: border-box;
  padding: 18px 22px 12px;
  border: none;
  background: transparent;
  font-size: 18px;
  color: #1c3a4a;
  outline: none;
}

.gs-input::placeholder {
  color: #a7b4bd;
}

/* 范围行：chip 在左，结果计数贴最右 */
.gs-scope-row {
  display: flex;
  align-items: center;
}

.gs-scope-row .scope-pick {
  flex: 1;
  min-width: 0;
}

.gs-result-count {
  flex-shrink: 0;
  padding: 0 14px 10px 6px;
  font-size: 12.5px;
  color: #7d8a94;
  white-space: nowrap;
}

.gs-result-count strong {
  color: #3a8dbf;
  font-weight: 700;
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
  color: inherit;
  text-decoration: none;
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

.gs-type.dynamic {
  background: #b39ddb;
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
