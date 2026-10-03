<template>
  <!-- 动态搜索浮层：仅在洛天依页"动态"板块下由 Ctrl+K 触发（GlobalSearch 派发事件） -->
  <Teleport to="body">
    <div v-if="open" class="ds-backdrop" @click.self="close">
      <div class="ds-panel">
        <input
          ref="inputRef"
          v-model="query"
          class="ds-input"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="搜索动态（标题、正文）…"
          @keydown="onKeydown"
        />
        <ul v-if="results.length" class="ds-list">
          <li
            v-for="(item, i) in results"
            :key="item.entry.key"
            class="ds-item"
            :class="{ active: i === activeIndex }"
            @mouseenter="activeIndex = i"
            @click="go(item.entry.key)"
          >
            <span class="ds-badge">{{ item.entry.typeLabel }}</span>
            <span class="ds-title">{{ item.entry.title }}</span>
            <span class="ds-sub">
              {{ item.entry.date }}
              <template v-if="item.entry.lunarText"> · {{ item.entry.lunarText }}</template>
            </span>
            <span v-if="item.snippet" class="ds-snippet">{{ item.snippet }}</span>
          </li>
        </ul>
        <p v-else-if="!query.trim()" class="ds-empty ds-hint">输入关键词搜索动态全文 · ↑↓ 选择 · Enter 打开 · Esc 关闭</p>
        <p v-else-if="loadError" class="ds-empty">{{ loadError }}</p>
        <p v-else-if="!entries" class="ds-empty">动态索引加载中…</p>
        <p v-else class="ds-empty">未找到与「{{ query }}」相关的动态</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { scoreBodyLower, scoreTitleLower, splitKeywords } from '../utils/searchMatch';
import { DYN_SEARCH_EVENT, fetchDynamicsSearchIndex, type DynamicSearchEntry } from '../views/Luotianyi/dynamics-data';

const router = useRouter();

const open = ref(false);
const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const activeIndex = ref(0);
const loadError = ref('');

// 索引加载后预小写化，检索热路径零分配
interface DecoratedEntry {
  entry: DynamicSearchEntry;
  titleLower: string;
  textLower: string;
}
const entries = ref<DecoratedEntry[] | null>(null);
let loading = false;

watch(open, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

// Ctrl+K（动态界面下由 GlobalSearch 转发）：再次按下关闭，行为与全局搜索一致
function toggle() {
  if (open.value) close();
  else openSearch();
}

function openSearch() {
  open.value = true;
  query.value = '';
  activeIndex.value = 0;
  nextTick(() => inputRef.value?.focus());
  if (!entries.value && !loading) void loadIndex();
}

async function loadIndex() {
  loading = true;
  loadError.value = '';
  try {
    const list = await fetchDynamicsSearchIndex();
    entries.value = list.map((entry) => ({
      entry,
      titleLower: entry.title.toLowerCase(),
      textLower: entry.text.toLowerCase(),
    }));
  } catch {
    loadError.value = '动态索引加载失败，请重试';
  } finally {
    loading = false;
  }
}

function close() {
  open.value = false;
}

const MAX_RESULTS = 50;

const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q || !entries.value) return [];
  const hits: { entry: DynamicSearchEntry; score: number; snippet: string }[] = [];
  for (const d of entries.value) {
    const score = Math.max(scoreTitleLower(d.titleLower, q).score, scoreBodyLower(d.textLower, q).score);
    if (!score) continue;
    hits.push({ entry: d.entry, score, snippet: makeSnippet(d.entry.text, q) });
  }
  // 稳定排序：同分保持索引顺序（新动态在前）
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, MAX_RESULTS);
});

// 命中位置前后截断的摘要；“为什么命中”一目了然
function makeSnippet(text: string, qLower: string): string {
  const lower = text.toLowerCase();
  let idx = lower.indexOf(qLower);
  let hitLen = qLower.length;
  if (idx < 0) {
    const kw = splitKeywords(qLower).find((k) => lower.includes(k));
    if (!kw) return '';
    idx = lower.indexOf(kw);
    hitLen = kw.length;
  }
  const start = Math.max(0, idx - 24);
  const end = Math.min(text.length, idx + hitLen + 40);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function onKeydown(e: KeyboardEvent) {
  const n = results.value.length;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (n) activeIndex.value = (activeIndex.value + 1) % n;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (n) activeIndex.value = (activeIndex.value - 1 + n) % n;
  } else if (e.key === 'Enter') {
    const item = results.value[activeIndex.value];
    if (item) go(item.entry.key);
  } else if (e.key === 'Escape') {
    close();
  }
}

function go(key: string) {
  close();
  router.push({ name: 'lty-dynamic', params: { key } });
}

onMounted(() => window.addEventListener(DYN_SEARCH_EVENT, toggle));
onBeforeUnmount(() => {
  window.removeEventListener(DYN_SEARCH_EVENT, toggle);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.ds-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(20, 40, 55, 0.25);
  backdrop-filter: blur(2px);
  animation: ds-fade-in 0.12s ease-out;
}

.ds-panel {
  position: absolute;
  top: 16vh;
  left: 50%;
  transform: translateX(-50%);
  width: min(680px, 92vw);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px) saturate(1.3);
  border: 1px solid rgba(179, 157, 219, 0.45);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 30, 50, 0.25);
  overflow: hidden;
  animation: ds-panel-in 0.15s ease-out;
}

.ds-input {
  width: 100%;
  box-sizing: border-box;
  padding: 18px 22px;
  border: none;
  background: transparent;
  font-size: 18px;
  color: #1c3a4a;
  outline: none;
}

.ds-input::placeholder {
  color: #a7b4bd;
}

.ds-list {
  list-style: none;
  margin: 0;
  padding: 0 8px 8px;
  max-height: calc(70vh - 60px);
  overflow-y: auto;
  border-top: 1px solid rgba(179, 157, 219, 0.25);
}

.ds-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 9px;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.ds-item.active {
  background: rgba(179, 157, 219, 0.28);
}

.ds-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
  background: #b39ddb;
}

.ds-title {
  font-size: 15px;
  color: #1c3a4a;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ds-sub {
  flex-shrink: 0;
  font-size: 12px;
  color: #7d8a94;
  white-space: nowrap;
}

.ds-snippet {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #94a1ab;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ds-empty {
  margin: 0;
  padding: 16px 22px;
  border-top: 1px solid rgba(179, 157, 219, 0.25);
  font-size: 14px;
  color: #7d8a94;
}

.ds-hint {
  color: #a7b4bd;
  text-align: center;
}

@keyframes ds-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes ds-panel-in {
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
