<template>
  <!-- 搜索范围选择：chip 显示当前范围摘要，点击展开勾选树（父级三态、实时生效） -->
  <div class="scope-pick">
    <button
      type="button"
      class="scope-chip"
      :class="{ 'is-open': open, 'is-empty': empty }"
      :aria-expanded="open"
      @click="togglePop"
    >
      <span class="scope-prefix">范围：</span>
      <span class="scope-summary">{{ summary }}</span>
      <span class="scope-caret" :class="{ 'is-open': open }">▾</span>
    </button>
    <div v-if="open" class="scope-pop" role="group" aria-label="搜索范围">
      <div
        v-for="row in rows"
        :key="row.node.id"
        class="scope-row"
      >
        <label class="scope-row-label" :style="{ paddingLeft: `${10 + row.depth * 16}px` }">
          <input
            type="checkbox"
            class="scope-check"
            :checked="stateOf(row.node) === 'all'"
            :indeterminate="stateOf(row.node) === 'partial'"
            @change="emitToggle(row.node)"
          />
          <span class="scope-name">{{ row.node.label }}</span>
          <span v-if="row.node.count != null" class="scope-count">{{ row.node.count }} {{ row.node.unit }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { nodeState, scopeSummary, scopeTreeRows, toggleNode, type ScopeTreeNode } from '../search-scope';

const props = defineProps<{
  modelValue: ReadonlySet<string>;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Set<string>): void;
  (e: 'update:open', value: boolean): void;
}>();

const rows = scopeTreeRows();

const summary = computed(() => scopeSummary(props.modelValue));
const empty = computed(() => props.modelValue.size === 0);

function stateOf(node: ScopeTreeNode) {
  return nodeState(node, props.modelValue);
}

function emitToggle(node: ScopeTreeNode) {
  emit('update:modelValue', toggleNode(node, props.modelValue));
}

function togglePop() {
  emit('update:open', !props.open);
}

// 点击外部关闭下拉（面板内其他区域点击不应关闭）
function onDocMouseDown(e: MouseEvent) {
  if (!props.open) return;
  const root = e.target as HTMLElement | null;
  if (root && root.closest('.scope-pick')) return;
  emit('update:open', false);
}

// Esc 关闭下拉；stopPropagation 避免同一次 Esc 继续冒泡触发全局"关面板"逻辑
function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    e.stopPropagation();
    emit('update:open', false);
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown);
  document.addEventListener('keydown', onDocKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMouseDown);
  document.removeEventListener('keydown', onDocKeydown);
});
</script>

<style scoped>
.scope-pick {
  position: relative;
  padding: 0 12px 10px;
}

.scope-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 4px 12px;
  border: 1px solid rgba(102, 204, 255, 0.45);
  border-radius: 999px;
  background: rgba(102, 204, 255, 0.12);
  color: #1c3a4a;
  font-size: 12.5px;
  cursor: pointer;
  transition: background-color 0.12s ease, border-color 0.12s ease;
}

.scope-chip:hover,
.scope-chip.is-open {
  background: rgba(102, 204, 255, 0.26);
}

.scope-chip.is-empty {
  border-color: rgba(236, 173, 158, 0.7);
  background: rgba(236, 173, 158, 0.18);
}

.scope-prefix {
  color: #7d8a94;
}

.scope-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.scope-caret {
  font-size: 10px;
  color: #7d8a94;
  transition: transform 0.12s ease;
}

.scope-caret.is-open {
  transform: rotate(180deg);
}

.scope-pop {
  position: absolute;
  top: calc(100% - 6px);
  left: 12px;
  right: 12px;
  z-index: 5;
  /* 可视高度取当前视口下面板能容纳的最大值（面板展开下拉时会增高到 560px 以内），
     保证常见的分类/篇目一屏尽量多显示，其余滚动查看 */
  max-height: min(calc(70vh - 120px), 440px);
  overflow-y: auto;
  padding: 6px 0;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(102, 204, 255, 0.4);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 30, 50, 0.18);
}

.scope-row-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px 5px 0;
  font-size: 13px;
  color: #1c3a4a;
  cursor: pointer;
}

.scope-row-label:hover {
  background: rgba(102, 204, 255, 0.12);
}

.scope-check {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: #66ccff;
}

.scope-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-count {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 11px;
  color: #a7b4bd;
}
</style>
