<template>
  <div class="dyn-layout">
    <!-- 宽屏：日期查找放进左侧空白区，粘性跟随滚动 -->
    <aside class="dyn-sidebar">
      <DynamicFinder
        v-if="index"
        variant="side"
        :first-date="index.firstDate"
        :last-date="index.lastDate"
        @search-range="onRangeSearch"
        @search-special="onSpecialSearch"
      />
    </aside>

    <div class="dyn-main">
      <LtySection title="动态日历">
        <div v-if="!index" class="dyn-status">{{ loadError || '动态数据加载中…' }}</div>
        <template v-else>
          <!-- 窄屏回退：查找面板显示在卡片内顶部 -->
          <div class="dyn-inline-finder">
            <DynamicFinder
              variant="inline"
              :first-date="index.firstDate"
              :last-date="index.lastDate"
              @search-range="onRangeSearch"
              @search-special="onSpecialSearch"
            />
          </div>

          <p class="dyn-intro">{{ rangeText }} · 共 <strong>{{ index.total }}</strong> 条动态 · 点击月份卡片查看</p>

          <div v-for="y in index.years" :key="y.year" class="dyn-year">
            <div class="dyn-year-head">
              <span class="dyn-year-label">{{ y.year }} 年</span>
              <span class="dyn-year-count">{{ y.count }} 条</span>
            </div>
            <div class="dyn-month-grid">
              <button
                v-for="m in monthCells(y)"
                :key="m.ym"
                type="button"
                class="dyn-month"
                :class="{ 'is-empty': !m.count }"
                :disabled="!m.count"
                :title="m.count ? `${m.ym} 共 ${m.count} 条动态` : `${m.ym} 无动态`"
                @click="openMonth(m.ym)"
              >
                <span class="dyn-month-name">{{ m.num }}月</span>
                <span class="dyn-month-count">{{ m.count || '—' }}</span>
              </button>
            </div>
          </div>
        </template>
      </LtySection>
    </div>
  </div>

  <!-- 弹层：月份列表与查找结果共用，Teleport 到 body 避免被卡片裁剪 -->
  <Teleport to="body">
    <div v-if="modalKind" class="dyn-mask" @click.self="closeModal()">
      <div class="dyn-modal" role="dialog" aria-modal="true" :aria-label="modalTitle">
        <header class="dyn-modal-head">
          <div>
            <h3 class="dyn-modal-title">{{ modalTitle }}</h3>
            <span class="dyn-modal-sub">{{ modalSubtitle || ' ' }}</span>
          </div>
          <button type="button" class="dyn-modal-close" aria-label="关闭" @click="closeModal()">×</button>
        </header>
        <div class="dyn-modal-body">
          <div v-if="!modalItems" class="dyn-status">{{ modalError || '加载中…' }}</div>
          <template v-else>
            <p v-if="!modalItems.length" class="dyn-status">没有符合条件的动态</p>
            <a
              v-for="item in visibleItems"
              :key="item.key"
              class="dyn-card"
              :href="dynamicDetailHref(item.key)"
              target="_blank"
              rel="noopener"
            >
              <img
                v-if="item.cover"
                class="dyn-card-thumb"
                :src="item.cover"
                :alt="item.title"
                loading="lazy"
                decoding="async"
                referrerpolicy="no-referrer"
                @error="onThumbError"
              />
              <span v-else class="dyn-card-thumb dyn-card-thumb--none">{{ typeShort(item.type) }}</span>
              <div class="dyn-card-info">
                <div class="dyn-card-meta">
                  <span class="dyn-badge">{{ item.typeLabel }}</span>
                  <time class="dyn-card-date">{{ item.date }}</time>
                </div>
                <h4 class="dyn-card-title">{{ item.title }}</h4>
                <p class="dyn-card-excerpt">{{ item.excerpt }}</p>
              </div>
            </a>
            <button v-if="remainingCount" type="button" class="dyn-load-more" @click="visibleCount += 100">
              加载更多（还剩 {{ remainingCount }} 条）
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LtySection from '../components/LtySection.vue';
import DynamicFinder from '../components/DynamicFinder.vue';
import {
  dynamicDetailHref,
  fetchDynamicsIndex,
  fetchDynamicsMonth,
  fetchDynamicsSearchIndex,
  LUNAR_DAY_LABELS,
  LUNAR_MONTH_LABELS,
  type DynamicSearchEntry,
  type DynamicsIndex,
} from '../dynamics-data';

const route = useRoute();
const router = useRouter();

const index = ref<DynamicsIndex | null>(null);
const loadError = ref('');

// 弹层状态：month（月份列表）/ results（查找结果）/ null（关闭）
type ModalKind = 'month' | 'results';
interface ModalCard {
  key: string;
  date: string;
  type: string;
  typeLabel: string;
  title: string;
  cover: string | null;
  excerpt: string;
}
const modalKind = ref<ModalKind | null>(null);
const modalTitle = ref('');
const modalSubtitle = ref('');
const modalItems = ref<ModalCard[] | null>(null);
const modalError = ref('');
const visibleCount = ref(100);
const activeYm = ref('');
const monthCache = new Map<string, ModalCard[]>();
// 月份加载/查找请求的过期令牌：新动作作废旧请求的回填
let modalToken = 0;

onMounted(loadIndex);
window.addEventListener('keydown', onKeydown);
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});

async function loadIndex() {
  try {
    index.value = await fetchDynamicsIndex();
    applyMonthQuery(route.query.month);
  } catch {
    loadError.value = '动态数据加载失败，请刷新重试';
  }
}

const rangeText = computed(() => {
  const years = index.value?.years ?? [];
  if (!years.length) return '';
  const first = years[years.length - 1].months[0]?.key ?? '';
  const last = years[0].months[years[0].months.length - 1]?.key ?? '';
  return `${first} ～ ${last}`;
});

const TYPE_SHORT: Record<string, string> = {
  DYNAMIC_TYPE_AV: '视频',
  DYNAMIC_TYPE_DRAW: '图文',
  DYNAMIC_TYPE_FORWARD: '转发',
  DYNAMIC_TYPE_WORD: '文字',
  DYNAMIC_TYPE_ARTICLE: '专栏',
  DYNAMIC_TYPE_LIVE: '直播',
  DYNAMIC_TYPE_MUSIC: '音频',
  DYNAMIC_TYPE_COMMON_SQUARE: '卡片',
};

function monthCells(y: DynamicsIndex['years'][number]) {
  return Array.from({ length: 12 }, (_, i) => {
    const ym = `${y.year}-${String(i + 1).padStart(2, '0')}`;
    return { ym, num: i + 1, count: y.months.find((m) => m.key === ym)?.count ?? 0 };
  });
}

function monthExists(ym: string): boolean {
  const y = ym.slice(0, 4);
  return Boolean(index.value?.years.find((it) => it.year === y)?.months.some((m) => m.key === ym));
}

function monthLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `${m[1]}年${Number(m[2])}月` : ym;
}

function openModalShell(kind: ModalKind, title: string): void {
  modalToken++;
  modalKind.value = kind;
  modalTitle.value = title;
  modalSubtitle.value = '';
  modalItems.value = null;
  modalError.value = '';
  visibleCount.value = 100;
  document.body.style.overflow = 'hidden';
}

async function openMonth(ym: string) {
  activeYm.value = ym;
  openModalShell('month', monthLabel(ym));

  const cached = monthCache.get(ym);
  if (cached) {
    modalItems.value = cached;
    modalSubtitle.value = `${cached.length} 条动态`;
    return;
  }
  const token = modalToken;
  try {
    const list = await fetchDynamicsMonth(ym);
    const cards: ModalCard[] = list.map((it) => ({ ...it, excerpt: it.excerpt }));
    monthCache.set(ym, cards);
    if (token !== modalToken || modalKind.value !== 'month') return;
    modalItems.value = cards;
    modalSubtitle.value = `${cards.length} 条动态`;
  } catch {
    if (token === modalToken && modalKind.value === 'month') modalError.value = '该月数据加载失败，请重试';
  }
}

// 查找结果统一走弹层：文本转成卡片所需的极简字段
function toCard(e: DynamicSearchEntry): ModalCard {
  return {
    key: e.key,
    date: e.date,
    type: e.type,
    typeLabel: e.typeLabel,
    title: e.title,
    cover: e.cover,
    excerpt: e.text.slice(0, 90),
  };
}

async function runSearch(title: string, filter: (e: DynamicSearchEntry) => boolean) {
  activeYm.value = '';
  openModalShell('results', title);
  const token = modalToken;
  try {
    const all = await fetchDynamicsSearchIndex();
    if (token !== modalToken || modalKind.value !== 'results') return;
    const matched = all.filter(filter).map(toCard);
    modalItems.value = matched;
    modalSubtitle.value = `${matched.length} 条动态`;
  } catch {
    if (token === modalToken && modalKind.value === 'results') modalError.value = '搜索索引加载失败，请重试';
  }
}

function onRangeSearch(start: string, end: string) {
  void runSearch(`日期范围 ${start} ～ ${end}`, (e) => e.date >= start && e.date <= end);
}

function onSpecialSearch(mode: 'solar' | 'lunar', m: number, d: number) {
  const label =
    mode === 'lunar'
      ? `农历${LUNAR_MONTH_LABELS[m - 1]}${LUNAR_DAY_LABELS[d - 1]}`
      : `公历 ${m}月${d}日`;
  if (mode === 'lunar') {
    void runSearch(`每年 ${label}`, (e) => e.lunar === `${m}-${d}`);
  } else {
    const md = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    void runSearch(`每年 ${label}`, (e) => e.date.slice(5) === md);
  }
}

// syncQuery 为 false 时（关闭动作由 URL 变化触发）不回写 query，避免循环
function closeModal(syncQuery = true) {
  modalToken++;
  modalKind.value = null;
  modalItems.value = null;
  activeYm.value = '';
  document.body.style.overflow = '';
  if (syncQuery && route.query.month) {
    // undefined 值会被 vue-router 从 query 中移除
    router.replace({ query: { ...route.query, month: undefined } });
  }
}

// ?tab=dynamic&month=2016-08 深链：进入板块自动打开对应月份弹层
function applyMonthQuery(value: unknown) {
  if (!index.value) return;
  if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) && monthExists(value)) {
    openMonth(value);
  } else if (activeYm.value) {
    closeModal(false);
  }
}

watch(() => route.query.month, applyMonthQuery);
// 切走板块时关掉弹层（KeepAlive 下组件不会卸载，弹层会悬浮在其他板块之上）
watch(
  () => route.query.tab,
  (tab) => {
    if (tab !== 'dynamic' && modalKind.value) closeModal(false);
  }
);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && modalKind.value) closeModal();
}

function onThumbError(e: Event) {
  (e.target as HTMLImageElement).classList.add('is-broken');
}

function typeShort(type: string): string {
  return TYPE_SHORT[type] ?? '动态';
}

const visibleItems = computed(() =>
  modalItems.value ? modalItems.value.slice(0, visibleCount.value) : []
);
const remainingCount = computed(() =>
  modalItems.value ? Math.max(0, modalItems.value.length - visibleCount.value) : 0
);
</script>

<style scoped>
.dyn-status {
  padding: 24px 0;
  text-align: center;
  color: #7a8699;
}

/* ---------- 布局：宽屏时查找面板占左侧空白区 ---------- */
.dyn-sidebar {
  display: none;
}

.dyn-inline-finder {
  padding: 12px 14px;
  margin-bottom: 14px;
  border: 1px solid rgba(179, 157, 219, 0.35);
  border-radius: 12px;
  background: rgba(248, 246, 252, 0.7);
}

@media (min-width: 1520px) {
  .dyn-layout {
    display: grid;
    grid-template-columns: 184px minmax(0, 1fr);
    gap: 16px;
    width: calc(100% + 200px);
    margin-left: -200px;
    align-items: start;
  }

  .dyn-sidebar {
    display: block;
    position: sticky;
    top: 24px;
    padding: 14px;
    border: 1px solid rgba(179, 157, 219, 0.35);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.86);
    box-shadow: 0 4px 16px rgba(120, 160, 200, 0.12);
  }

  .dyn-inline-finder {
    display: none;
  }
}

.dyn-intro {
  margin: 0 0 16px;
  font-size: 14px;
  color: #7a8699;
}

.dyn-intro strong {
  color: #3a8dbf;
}

.dyn-year {
  border: 1px solid rgba(102, 204, 255, 0.25);
  border-radius: 12px;
  padding: 14px 16px;
  background: rgba(248, 251, 255, 0.75);
}

.dyn-year + .dyn-year {
  margin-top: 14px;
}

.dyn-year-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

.dyn-year-label {
  font-size: 16px;
  font-weight: 700;
  color: #6b5aa8;
}

.dyn-year-count {
  font-size: 13px;
  color: #9aa7b8;
}

.dyn-month-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 8px;
}

.dyn-month {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  aspect-ratio: 1;
  padding: 4px;
  border: 1px solid rgba(102, 204, 255, 0.4);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.dyn-month:hover:not(.is-empty) {
  border-color: #66ccff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 204, 255, 0.25);
}

.dyn-month.is-empty {
  border-style: dashed;
  border-color: #e2e8f0;
  background: transparent;
  cursor: default;
}

.dyn-month-name {
  font-size: 12px;
  color: #7a8699;
}

.dyn-month-count {
  font-size: 16px;
  font-weight: 700;
  color: #66ccff;
}

.dyn-month.is-empty .dyn-month-count {
  color: #c3cdd9;
  font-weight: 400;
}

/* ---------- 弹层 ---------- */
.dyn-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(40, 52, 70, 0.45);
}

.dyn-modal {
  display: flex;
  flex-direction: column;
  width: min(880px, 100%);
  max-height: min(82vh, 760px);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(30, 45, 70, 0.28);
  overflow: hidden;
}

.dyn-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e8eef5;
}

.dyn-modal-title {
  margin: 0;
  font-size: 18px;
  color: #6b5aa8;
}

.dyn-modal-sub {
  font-size: 13px;
  color: #9aa7b8;
}

.dyn-modal-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: #f0f5fa;
  color: #7a8699;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dyn-modal-close:hover {
  background: #e2ecf5;
}

.dyn-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 20px 20px;
  overflow-y: auto;
}

.dyn-card {
  display: flex;
  gap: 14px;
  padding: 12px;
  border: 1px solid #e6eef6;
  border-radius: 12px;
  background: #fbfdff;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.dyn-card:hover {
  border-color: #66ccff;
  box-shadow: 0 4px 14px rgba(102, 204, 255, 0.22);
}

.dyn-card-thumb {
  width: 112px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 8px;
  object-fit: cover;
  background: #eef4f9;
}

.dyn-card-thumb.is-broken {
  display: none;
}

.dyn-card-thumb--none {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  letter-spacing: 1px;
  color: #66ccff;
  background: linear-gradient(135deg, #eaf7ff 0%, #f3eefb 100%);
}

.dyn-card-info {
  min-width: 0;
}

.dyn-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #9aa7b8;
}

.dyn-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(102, 204, 255, 0.14);
  color: #3a8dbf;
  font-size: 12px;
}

.dyn-card-title {
  margin: 4px 0 2px;
  font-size: 15px;
  font-weight: 700;
  color: #3a3f45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dyn-card-excerpt {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #7a8699;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.dyn-load-more {
  padding: 10px;
  border: 1px dashed #b8d9ee;
  border-radius: 10px;
  background: #f6fbfe;
  color: #3a8dbf;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dyn-load-more:hover {
  background: #eaf6fd;
}

@media (max-width: 720px) {
  .dyn-month-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .dyn-month {
    aspect-ratio: auto;
    padding: 8px 4px;
  }

  .dyn-card-thumb {
    width: 88px;
    height: 60px;
  }
}
</style>
