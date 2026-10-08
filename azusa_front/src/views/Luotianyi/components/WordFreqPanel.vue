<template>
  <div class="wf-panel">
    <h3 class="wf-title">词频统计</h3>
    <p v-if="loadError" class="wf-status">
      {{ loadError }}
      <button type="button" class="wf-retry" @click="retry">重试</button>
    </p>
    <p v-else-if="!data" class="wf-status">统计加载中…</p>
    <template v-else>
      <button type="button" class="wf-cloud" title="点击查看大图与完整词频" @click="openModal">
        <span v-for="(w, i) in cloudWords" :key="w.w" class="wf-cloud-word" :style="cloudStyle(w, i)">{{ w.w }}</span>
      </button>
      <p class="wf-hint">基于 {{ data.total }} 条动态 · 已去除停用词<br />点击词云查看大图</p>
    </template>
  </div>

  <!-- 弹层：大条形图 + 可调数量的词汇-频率对，Teleport 到 body 避免被卡片裁剪 -->
  <Teleport to="body">
    <div v-if="modalOpen" class="wf-mask" @click.self="closeModal">
      <div class="wf-modal" role="dialog" aria-modal="true" aria-label="词频统计大图">
        <header class="wf-modal-head">
          <div>
            <h3 class="wf-modal-title">词频统计</h3>
            <span class="wf-modal-sub">基于 {{ data?.total ?? 0 }} 条动态全文 · 已去除停用词 · 共收录 {{ data?.vocab ?? 0 }} 词</span>
          </div>
          <button type="button" class="wf-modal-close" aria-label="关闭" @click="closeModal">×</button>
        </header>
        <div class="wf-modal-body">
          <div class="wf-chart">
            <div v-for="w in chartWords" :key="w.w" class="wf-bar-row" :title="`${w.w}：出现 ${w.n} 次`">
              <span class="wf-bar-label">{{ w.w }}</span>
              <span class="wf-bar-track">
                <span class="wf-bar-fill" :style="{ width: barPct(w) }"></span>
              </span>
              <span class="wf-bar-count">{{ w.n }}</span>
            </div>
          </div>

          <div class="wf-control">
            <label for="wf-topn">显示前</label>
            <input
              id="wf-topn"
              v-model.number="topNInput"
              type="number"
              min="1"
              :max="maxN"
              @change="commitTopN"
              @keydown.enter="commitTopN"
            />
            <span>组最高频词汇</span>
            <span class="wf-control-tip">可输入 1～{{ maxN }}</span>
          </div>

          <div class="wf-pairs">
            <span v-for="w in pairWords" :key="w.w" class="wf-pair" :title="`${w.w}：出现 ${w.n} 次`">
              <b class="wf-pair-word">{{ w.w }}</b>
              <span class="wf-pair-count">{{ w.n }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { fetchDynamicsWordFreq, type WordFreqData } from '../dynamics-data';

const data = ref<WordFreqData | null>(null);
const loadError = ref('');
const modalOpen = ref(false);
const topN = ref(20);
const topNInput = ref<number | null>(20);

const maxN = computed(() => data.value?.words.length ?? 500);

const CLOUD_COUNT = 32;
const cloudWords = computed(() => (data.value ? data.value.words.slice(0, CLOUD_COUNT) : []));

// 词云配色取自站点主色；字号按 sqrt(频率/最高频) 缩放，避免最高频词一家独大
const CLOUD_COLORS = ['#66ccff', '#b39ddb', '#aa6680', '#3a8dbf', '#39c5bb', '#6b5aa8'];
function cloudStyle(w: { w: string; n: number }, i: number) {
  const max = cloudWords.value[0]?.n ?? 1;
  const size = 11 + 9 * Math.sqrt(w.n / max);
  return { fontSize: `${size.toFixed(1)}px`, color: CLOUD_COLORS[i % CLOUD_COLORS.length] };
}

const chartWords = computed(() => (data.value ? data.value.words.slice(0, topN.value) : []));
const pairWords = computed(() => chartWords.value);

function barPct(w: { w: string; n: number }) {
  const max = chartWords.value[0]?.n ?? 1;
  return `${Math.max(2, (w.n / max) * 100)}%`;
}

function openModal() {
  if (!data.value) return;
  modalOpen.value = true;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOpen.value = false;
  document.body.style.overflow = '';
}

// 数字输入：非法/越界值在失焦或回车时收敛到 1..maxN
function commitTopN() {
  const raw = topNInput.value;
  let n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) n = 1;
  n = Math.min(n, maxN.value);
  topNInput.value = n;
  topN.value = n;
}

function retry() {
  loadError.value = '';
  fetchDynamicsWordFreq()
    .then((d) => {
      data.value = d;
    })
    .catch(() => {
      loadError.value = '词频数据加载失败';
    });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && modalOpen.value) closeModal();
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  fetchDynamicsWordFreq()
    .then((d) => {
      data.value = d;
    })
    .catch(() => {
      loadError.value = '词频数据加载失败';
    });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.wf-panel {
  border: 1px solid rgba(179, 157, 219, 0.35);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 4px 16px rgba(120, 160, 200, 0.12);
  padding: 14px;
}

.wf-title {
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 4px solid #b39ddb;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  color: #6b5aa8;
}

.wf-status {
  margin: 0;
  padding: 16px 0;
  text-align: center;
  font-size: 13px;
  color: #7a8699;
}

.wf-retry {
  border: none;
  background: none;
  padding: 0;
  color: #3a8dbf;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
}

.wf-cloud {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 2px 10px;
  width: 100%;
  padding: 8px 2px 14px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: center;
}

.wf-cloud-word {
  line-height: 1.7;
  font-weight: 600;
  transition: color 0.15s ease;
}

.wf-cloud-word:hover {
  color: #aa6680;
}

.wf-hint {
  margin: 0;
  padding-top: 10px;
  border-top: 1px dashed #dbe6f0;
  text-align: center;
  font-size: 12px;
  line-height: 1.7;
  color: #9aa7b8;
}

/* ---------- 弹层 ---------- */
.wf-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(40, 52, 70, 0.45);
}

.wf-modal {
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  max-height: min(84vh, 820px);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(30, 45, 70, 0.28);
  overflow: hidden;
}

.wf-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e8eef5;
}

.wf-modal-title {
  margin: 0;
  font-size: 18px;
  color: #6b5aa8;
}

.wf-modal-sub {
  font-size: 13px;
  color: #9aa7b8;
}

.wf-modal-close {
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

.wf-modal-close:hover {
  background: #e2ecf5;
}

.wf-modal-body {
  padding: 16px 20px 20px;
  overflow-y: auto;
}

/* ---------- 条形图 ---------- */
.wf-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 28px;
}

.wf-bar-label {
  flex-shrink: 0;
  width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 13px;
  color: #6b5aa8;
  font-weight: 600;
}

.wf-bar-track {
  flex: 1;
  height: 12px;
  border-radius: 999px;
  background: #eef4f9;
  overflow: hidden;
}

.wf-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(102, 204, 255, 0.45), #66ccff);
}

.wf-bar-count {
  flex-shrink: 0;
  width: 52px;
  text-align: right;
  font-size: 12px;
  color: #7a8699;
  font-variant-numeric: tabular-nums;
}

/* ---------- 数量输入 ---------- */
.wf-control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 12px;
  padding: 10px 14px;
  border: 1px dashed #b8d9ee;
  border-radius: 10px;
  background: #f6fbfe;
  font-size: 14px;
  color: #3a3f45;
}

.wf-control input {
  width: 64px;
  padding: 4px 8px;
  border: 1px solid rgba(102, 204, 255, 0.5);
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  color: #1c3a4a;
  outline: none;
}

.wf-control input:focus {
  border-color: #66ccff;
}

.wf-control-tip {
  margin-left: auto;
  font-size: 12px;
  color: #9aa7b8;
}

/* ---------- 词汇-频率对 ---------- */
.wf-pairs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
  gap: 8px;
}

.wf-pair {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 10px;
  border: 1px solid #e6eef6;
  border-radius: 8px;
  background: #fbfdff;
}

.wf-pair-word {
  font-size: 14px;
  font-weight: 700;
  color: #6b5aa8;
}

.wf-pair-count {
  font-size: 12px;
  color: #7a8699;
  font-variant-numeric: tabular-nums;
}
</style>
