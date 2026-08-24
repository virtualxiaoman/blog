<template>
  <button
    type="button"
    class="back-to-top-button"
    aria-label="回到顶部"
    data-tooltip="回到顶部"
    @click="scrollToTop"
  >
    <svg class="back-to-top-arrow" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 4l8 8-1.4 1.4L13 7.8V20h-2V7.8l-5.6 5.6L4 12l8-8z" />
    </svg>
    <svg class="progress-ring" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
      <circle
        class="ring-fg"
        cx="22"
        cy="22"
        r="19"
        fill="none"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  /** 内容异步更新后递增或变更，用于重新计算阅读进度。 */
  refreshKey?: string | number | boolean;
}>(), {
  refreshKey: 0,
});

const circumference = 2 * Math.PI * 19;
const progress = ref(0);
let scrollRaf = 0;

function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  progress.value = scrollable > 0
    ? Math.min(1, Math.max(0, window.scrollY / scrollable))
    : 0;
}

function onScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    updateProgress();
  });
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const dashOffset = computed(() => circumference * (1 - progress.value));

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', updateProgress);
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
});

watch(() => props.refreshKey, () => {
  requestAnimationFrame(updateProgress);
});
</script>

<style scoped>
.back-to-top-button {
  position: fixed;
  right: 1vw;
  bottom: 28px;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.back-to-top-button:hover {
  background: #f2fbff;
}

.back-to-top-arrow {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: #66ccff;
  transition: transform 0.2s ease;
}

.back-to-top-button:hover .back-to-top-arrow {
  transform: translate(-50%, -56%);
}

.progress-ring {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
  pointer-events: none;
}

.ring-fg {
  stroke: #39c5bb;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.1s linear;
}

.back-to-top-button::after {
  content: attr(data-tooltip);
  position: absolute;
  right: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) translateX(6px);
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.back-to-top-button:hover::after {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}
</style>
