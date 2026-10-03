<template>
  <div class="finder" :class="`finder--${variant}`">
    <div class="finder-head">日期查找</div>

    <div class="finder-block">
      <div class="finder-title">日期范围</div>
      <div class="finder-range">
        <input
          v-model="rangeStart"
          class="dyn-date-input"
          type="date"
          :min="firstDate"
          :max="lastDate"
          aria-label="起始日期"
        />
        <span class="finder-sep">至</span>
        <input
          v-model="rangeEnd"
          class="dyn-date-input"
          type="date"
          :min="firstDate"
          :max="lastDate"
          aria-label="结束日期"
        />
      </div>
      <button type="button" class="dyn-finder-btn" @click="emitRange">查找</button>
    </div>

    <div class="finder-block">
      <div class="finder-title">每年同一天</div>
      <select v-model="calMode" class="dyn-select" aria-label="历法">
        <option value="solar">公历</option>
        <option value="lunar">农历</option>
      </select>
      <div class="finder-range">
        <select v-model.number="spMonth" class="dyn-select" aria-label="月份">
          <option v-for="(label, i) in monthOptions" :key="label" :value="i + 1">{{ label }}</option>
        </select>
        <select v-model.number="spDay" class="dyn-select" aria-label="日期">
          <option v-for="(label, i) in dayOptions" :key="label" :value="i + 1">{{ label }}</option>
        </select>
      </div>
      <button type="button" class="dyn-finder-btn" @click="emitSpecial">查找</button>
    </div>

    <p v-if="rangeError" class="dyn-finder-error">{{ rangeError }}</p>
    <p class="finder-hint">如 公历 7月12日 / 农历 正月初一 · Ctrl+K 全文搜索</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LUNAR_DAY_LABELS, LUNAR_MONTH_LABELS } from '../dynamics-data';

const props = withDefaults(
  defineProps<{
    /** 最早动态日期（数据加载完成后传入），范围默认值 */
    firstDate: string;
    /** 最新动态日期 */
    lastDate: string;
    /** side：左侧栏（控件纵向堆叠）；inline：卡片内（控件横向成行） */
    variant?: 'side' | 'inline';
  }>(),
  { variant: 'inline' }
);

const emit = defineEmits<{
  (e: 'search-range', start: string, end: string): void;
  (e: 'search-special', mode: 'solar' | 'lunar', month: number, day: number): void;
}>();

const rangeStart = ref('');
const rangeEnd = ref('');
const rangeError = ref('');

// 数据异步加载：props 到位后回填默认值（只填空值，不覆盖用户输入）
watch(
  () => [props.firstDate, props.lastDate],
  ([first, last]) => {
    if (first && !rangeStart.value) rangeStart.value = first;
    if (last && !rangeEnd.value) rangeEnd.value = last;
  },
  { immediate: true }
);

// 修改输入即清除上一次的范围校验错误
watch([rangeStart, rangeEnd], () => {
  rangeError.value = '';
});

const calMode = ref<'solar' | 'lunar'>('solar');
const spMonth = ref(7);
const spDay = ref(12);

const monthOptions = computed(() =>
  calMode.value === 'lunar' ? LUNAR_MONTH_LABELS : Array.from({ length: 12 }, (_, i) => `${i + 1} 月`)
);
const dayOptions = computed(() =>
  calMode.value === 'lunar' ? LUNAR_DAY_LABELS : Array.from({ length: 31 }, (_, i) => `${i + 1} 日`)
);

// 切换农历时 31 日不存在，收敛到 30
watch(calMode, (mode) => {
  if (mode === 'lunar' && spDay.value > 30) spDay.value = 30;
});

function emitRange() {
  const start = rangeStart.value || props.firstDate;
  const end = rangeEnd.value || props.lastDate;
  if (!start || !end) {
    rangeError.value = '请选择完整的起止日期';
    return;
  }
  if (start > end) {
    rangeError.value = '起始日期不能晚于结束日期';
    return;
  }
  rangeError.value = '';
  emit('search-range', start, end);
}

function emitSpecial() {
  rangeError.value = '';
  emit('search-special', calMode.value, spMonth.value, spDay.value);
}
</script>

<style scoped>
.finder {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.finder-head {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #6b5aa8;
}

.finder-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.finder-title {
  font-size: 13px;
  color: #7a8699;
}

.finder-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.finder-sep {
  flex-shrink: 0;
  font-size: 12px;
  color: #9aa7b8;
}

.dyn-date-input,
.dyn-select {
  padding: 6px 10px;
  border: 1px solid rgba(102, 204, 255, 0.45);
  border-radius: 8px;
  background: #fff;
  color: #3a3f45;
  font-size: 14px;
  outline: none;
}

.dyn-date-input:focus,
.dyn-select:focus {
  border-color: #66ccff;
}

.dyn-finder-btn {
  padding: 6px 18px;
  border: none;
  border-radius: 999px;
  background: #66ccff;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dyn-finder-btn:hover {
  background: #4db8f0;
}

.dyn-finder-error {
  margin: 0;
  font-size: 13px;
  color: #e05c6e;
}

.finder-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #9aa7b8;
}

/* 左侧栏：控件纵向堆叠、占满宽度 */
.finder--side .finder-range {
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}

.finder--side .dyn-date-input,
.finder--side .dyn-select,
.finder--side .dyn-finder-btn {
  width: 100%;
  box-sizing: border-box;
}

/* 卡片内（窄屏回退）：标签 + 控件横向成行 */
.finder--inline .finder-head {
  display: none;
}

.finder--inline .finder-block {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
}

.finder--inline .finder-title {
  flex-shrink: 0;
  width: 5em;
}

.finder--inline .finder-block + .finder-block {
  margin-top: 4px;
}
</style>
