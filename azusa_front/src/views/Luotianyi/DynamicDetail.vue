<template>
  <div class="dynd-page">
    <header class="dynd-bar">
      <div class="dynd-bar-left">
        <a class="dynd-link" :href="calendarHref">← 动态日历</a>
        <a class="dynd-link" :href="monthHref">本月全部</a>
      </div>
      <div v-if="current" class="dynd-meta">
        <span class="dynd-badge">{{ current.typeLabel }}</span>
        <time>{{ current.date }}</time>
      </div>
      <a v-if="originUrl" class="dynd-origin" :href="originUrl" target="_blank" rel="noopener">B站原文</a>
    </header>

    <main class="dynd-article">
      <div v-if="loading" class="dynd-status">动态加载中…</div>
      <div v-else-if="error" class="dynd-status">
        <p class="dynd-status-text">{{ error }}</p>
        <a class="dynd-link" :href="calendarHref">返回动态日历</a>
      </div>
      <template v-else>
        <!-- 图片加载失败（error 不冒泡）由 contentEl 上的捕获监听兜底替换为文字占位 -->
        <div ref="contentEl" class="markdown-body dynd-content" v-html="contentHtml"></div>
        <nav class="dynd-pager" aria-label="动态翻页">
          <button v-if="prevItem" type="button" class="dynd-pager-btn" @click="go(prevItem.key)">
            <span class="dynd-pager-dir">← 上一条</span>
            <span class="dynd-pager-title">{{ prevItem.title }}</span>
          </button>
          <span v-else class="dynd-pager-btn is-disabled">已是最新</span>
          <button v-if="nextItem" type="button" class="dynd-pager-btn is-next" @click="go(nextItem.key)">
            <span class="dynd-pager-dir">下一条 →</span>
            <span class="dynd-pager-title">{{ nextItem.title }}</span>
          </button>
          <span v-else class="dynd-pager-btn is-disabled">已是最早</span>
        </nav>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';
// 用 light 版本固定浅色：默认版会跟随系统深色模式把正文染成黑底，
// 与本站的白色卡片风格冲突（动态正文只有浅色一版设计）
import 'github-markdown-css/github-markdown-light.css';
import 'highlight.js/styles/github.css';
import { fetchMarkdown } from '../../utils/markdownSource';
import {
  dynamicDetailHref,
  dynamicMarkdownPath,
  fetchDynamicJson,
  fetchDynamicsMonth,
  type DynamicRaw,
  type DynamicSummary,
} from './dynamics-data';

const route = useRoute();
const router = useRouter();
const base = import.meta.env.BASE_URL;

const calendarHref = `${base}#/lty?tab=dynamic`;

const contentEl = ref<HTMLElement | null>(null);
const contentHtml = ref('');
const loading = ref(true);
const error = ref('');
const current = ref<DynamicSummary | null>(null);
const monthList = ref<DynamicSummary[]>([]);
const originUrl = ref('');

const key = computed(() => String(route.params.key ?? ''));
const ym = computed(() => key.value.slice(0, 7));
const monthHref = computed(() => `${base}#/lty?tab=dynamic&month=${ym.value}`);

let requestToken = 0;
let previousTitle = '';

onMounted(() => {
  previousTitle = document.title;
  load();
});
onBeforeUnmount(() => {
  if (previousTitle) document.title = previousTitle;
});

// 上/下一条在同一板块内跳转，组件实例复用，需监听 key 变化重新加载
watch(key, load);

function go(targetKey: string) {
  router.push({ name: 'lty-dynamic', params: { key: targetKey } });
}

async function load() {
  const token = ++requestToken;
  const k = key.value;
  const m = ym.value;
  if (!k || !/^\d{4}-\d{2}/.test(m)) {
    loading.value = false;
    error.value = '无效的动态链接';
    return;
  }

  loading.value = true;
  error.value = '';
  current.value = null;
  originUrl.value = '';

  try {
    // 文本优先：先拿到 md 与附加信息再渲染；月份列表失败不影响正文展示
    const [md, raw, list] = await Promise.all([
      fetchMarkdown(dynamicMarkdownPath(m, k)),
      fetchDynamicJson(m, k).catch(() => null),
      fetchDynamicsMonth(m).catch(() => [] as DynamicSummary[]),
    ]);
    if (token !== requestToken) return;

    monthList.value = list;
    current.value = list.find((it) => it.key === k) ?? null;
    originUrl.value = raw?.url ?? current.value?.url ?? '';
    contentHtml.value = await renderMarkdown(md, raw);
    if (token !== requestToken) return;

    document.title = `${current.value?.title ?? k} - 洛天依动态`;
    loading.value = false;
    await nextTick();
    if (contentEl.value) {
      // error 事件不冒泡，用捕获阶段统一接管图片加载失败
      contentEl.value.removeEventListener('error', onImageError, true);
      contentEl.value.addEventListener('error', onImageError, true);
    }
  } catch {
    if (token !== requestToken) return;
    error.value = '动态不存在或加载失败';
    loading.value = false;
  }
}

// 正文渲染：md → HTML（消毒）→ 图片路径重写 → 代码高亮
// 图片策略（用户约定）：全部走 B 站远程 CDN，不本地化；拿不到远程地址或加载失败时
// 以文字占位兜底，保证正文优先完整可读。
async function renderMarkdown(md: string, raw: DynamicRaw | null): Promise<string> {
  const html = await marked(md, { breaks: true });

  const mediaByBase = new Map<string, string>();
  for (const mi of raw?.media?.images ?? []) {
    const name = baseName(mi.file);
    if (name && mi.url) mediaByBase.set(name, toHttps(mi.url));
  }
  const coversByBase = new Map<string, string>();
  for (const card of raw?.cards ?? []) {
    const name = baseName(card.cover_file);
    if (name && card.cover_url) coversByBase.set(name, toHttps(card.cover_url));
  }

  // 图片重写必须在"字符串阶段"完成：img 一旦进入 DOM（哪怕是游离节点），
  // 浏览器就会立即发起请求，无远程地址的转发图/商品封面会产生无谓的 404
  const rewritten = rewriteAssetImages(html, mediaByBase, coversByBase);

  const container = document.createElement('div');
  container.innerHTML = DOMPurify.sanitize(rewritten);

  container.querySelectorAll('img').forEach((img) => {
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.setAttribute('referrerpolicy', 'no-referrer');
  });

  // 视频动态的 md 标题是生成器的占位 "动态 <id>"，替换成视频卡片标题
  const h1 = container.querySelector('h1');
  if (h1 && /^动态\s+\d+$/.test((h1.textContent ?? '').trim())) {
    const niceTitle = raw?.cards?.map((c) => c.title).find((t) => t && t.trim());
    if (niceTitle) h1.textContent = niceTitle.trim();
  }

  container.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (/^(https?:)?\/\//.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    }
  });

  container.querySelectorAll('pre code').forEach((code) => {
    hljs.highlightElement(code as HTMLElement);
  });

  return container.innerHTML;
}

function baseName(file: string | undefined): string {
  if (!file) return '';
  return safeDecode(file.split('/').pop() ?? '');
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function toHttps(url: string): string {
  return url.replace(/^http:\/\//, 'https://');
}

// 字符串级的图片重写：能映射到远程地址的换 src，否则替换为文字占位（表情为行内文字形态）
function rewriteAssetImages(
  html: string,
  mediaByBase: Map<string, string>,
  coversByBase: Map<string, string>
): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = attrValue(tag, 'src');
    if (!src) return tag;
    const alt = attrValue(tag, 'alt');
    // 仅重写"本站归档"的相对路径（../../_assets/...）；转发动态引用其他用户目录
    // （../../../<mid>/_assets/...）无远程地址，直接占位
    const own = /^\.\.\/\.\.\/_assets\/(images|covers|emojis)\/(.+)$/.exec(src);
    if (own) {
      const [, kind, nameRaw] = own;
      const name = safeDecode(nameRaw);
      const remote =
        kind === 'images' ? mediaByBase.get(name) : kind === 'covers' ? coversByBase.get(name) : undefined;
      if (remote) {
        return tag.replace(/src="[^"]*"/i, `src="${escapeAttr(remote)}"`);
      }
      if (kind === 'emojis') {
        // 表情包无远程地址：渲染成文字形态（[点赞]），保持行内语义
        return `<span class="dynd-emoji">[${escapeHtml(alt || name.replace(/\.\w+$/, ''))}]</span>`;
      }
      return `<span class="dynd-missing">［${escapeHtml(alt || '图片')}］</span>`;
    }
    if (/_assets\//.test(src)) {
      // 其他归档路径（转发/商品卡封面等）：无远程地址
      return `<span class="dynd-missing">［${escapeHtml(alt || '图片')}］</span>`;
    }
    return tag;
  });
}

function attrValue(tag: string, name: string): string {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag);
  return m ? unescapeHtml(m[1]) : '';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function replaceWithPlaceholder(img: Element, text: string, className: string) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  img.replaceWith(span);
}

// 图片加载失败兜底：替换为文字占位（正则保证幂等替换，避免死循环）
function onImageError(e: Event) {
  const target = e.target;
  if (!(target instanceof HTMLImageElement) || !target.isConnected) return;
  replaceWithPlaceholder(target, `［${target.alt || '图片'}］`, 'dynd-missing');
}

const pagerIndex = computed(() => monthList.value.findIndex((it) => it.key === key.value));
// 月份列表按时间倒序：index-1 是更新的动态，index+1 是更早的动态
const prevItem = computed(() => (pagerIndex.value > 0 ? monthList.value[pagerIndex.value - 1] : null));
const nextItem = computed(() =>
  pagerIndex.value >= 0 && pagerIndex.value < monthList.value.length - 1
    ? monthList.value[pagerIndex.value + 1]
    : null
);
</script>

<style scoped>
.dynd-page {
  min-height: 100vh;
  padding: 28px 4% 72px;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(179, 157, 219, 0.18) 0%, transparent 55%),
    radial-gradient(120% 90% at 100% 0%, rgba(102, 204, 255, 0.14) 0%, transparent 55%),
    linear-gradient(180deg, #f8fafc 0%, #eef4f8 100%);
}

.dynd-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  max-width: 880px;
  margin: 0 auto 14px;
}

.dynd-bar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dynd-link {
  color: #3a8dbf;
  text-decoration: none;
  font-size: 14px;
}

.dynd-link:hover {
  color: #66ccff;
}

.dynd-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #7a8699;
}

.dynd-badge {
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(102, 204, 255, 0.14);
  color: #3a8dbf;
  font-size: 12px;
}

.dynd-origin {
  padding: 6px 14px;
  border-radius: 999px;
  background: #fb7299;
  color: #fff;
  font-size: 13px;
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.dynd-origin:hover {
  opacity: 0.85;
}

.dynd-article {
  max-width: 880px;
  margin: 0 auto;
  padding: 26px 34px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 18px rgba(120, 160, 200, 0.14);
}

.dynd-status {
  padding: 40px 0;
  text-align: center;
  color: #7a8699;
}

.dynd-status-text {
  margin: 0 0 12px;
}

.dynd-content {
  font-size: 16px;
  line-height: 1.8;
}

/* 无远程地址的图片占位与表情文字形态 */
.dynd-content :deep(.dynd-missing) {
  display: inline-block;
  padding: 2px 10px;
  border: 1px dashed #d3dce6;
  border-radius: 6px;
  color: #9aa7b8;
  font-size: 13px;
}

.dynd-content :deep(.dynd-emoji) {
  color: #8a93a3;
}

.dynd-content :deep(img) {
  border-radius: 8px;
}

.dynd-pager {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid #e8eef5;
}

.dynd-pager-btn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border: 1px solid #e6eef6;
  border-radius: 10px;
  background: #fbfdff;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.dynd-pager-btn:hover:not(.is-disabled) {
  border-color: #66ccff;
  box-shadow: 0 4px 12px rgba(102, 204, 255, 0.2);
}

.dynd-pager-btn.is-next {
  text-align: right;
}

.dynd-pager-btn.is-disabled {
  color: #c3cdd9;
  font-size: 13px;
  cursor: default;
  align-items: center;
  justify-content: center;
}

.dynd-pager-dir {
  font-size: 12px;
  color: #9aa7b8;
}

.dynd-pager-title {
  font-size: 13px;
  color: #3a3f45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .dynd-article {
    padding: 20px 18px;
  }
}
</style>
