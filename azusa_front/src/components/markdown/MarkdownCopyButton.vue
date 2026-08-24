<template>
  <button
    type="button"
    class="nav-btn copy-md-btn"
    :class="{ 'is-copied': copied }"
    aria-label="复制Markdown全文"
    data-tooltip="复制Markdown全文"
    @click="copyMarkdown"
  >
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { copyText } from '../../utils/clipboard';
import { resolveMarkdownSource } from '../../utils/markdownSource';

const props = defineProps<{
  /** public/ 下的 Markdown 相对路径，例如 article/md/AI/示例.md。 */
  source: string;
}>();

const copied = ref(false);
let copiedTimer = 0;

async function copyMarkdown() {
  try {
    const response = await axios.get(resolveMarkdownSource(props.source));
    const ok = await copyText(String(response.data));
    if (!ok) return;

    copied.value = true;
    window.clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    // 请求或剪贴板不可用时保持静默，避免影响阅读。
  }
}
</script>

<style scoped>
/* 保持与原 ArticleNav 中按钮完全一致的类名和视觉规则。 */
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

.copy-md-btn {
  pointer-events: auto;
  width: 40px;
  height: 40px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.copy-md-btn:hover {
  background: #f2fbff;
}

.copy-md-btn svg {
  color: #66ccff;
}

.copy-md-btn.is-copied {
  background: #e6fbf8;
}

.copy-md-btn.is-copied svg {
  color: #39c5bb;
}

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
</style>
