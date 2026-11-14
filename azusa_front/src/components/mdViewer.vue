<template>
  <div
    v-html="content"
    class="markdown-body"
    @click="onContentClick"
    @copy="onContentCopy"
    @mouseover="onBracketOver"
    @mouseout="onBracketOut"
  ></div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { fetchMarkdown } from '../utils/markdownSource';
import { scrollToElementStable } from '../utils/stableScroll';
import { clearBracketHighlight, highlightBracketPair } from '../utils/bracketHighlight';
import { handleFormulaCopyClick, removeFormulaCopyButtons } from '../utils/formulaCopy';
import { handleCodeCopyClick, removeCodeCopyButtons } from '../utils/codeCopy';
import { handleTocToggle } from '../utils/markdownToc';
import { renderMarkdownDocument } from '../utils/markdownDocument';
import 'github-markdown-css';
import 'highlight.js/styles/github.css'; // 代码高亮配色（浅色主题，适合正文）
import 'katex/dist/katex.min.css'; // 公式渲染必需的样式（字体、间距、上下标定位）
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const props = defineProps({
  /** public/ 下的 Markdown 相对路径，例如 article/md/AI/示例.md。 */
  source: {
    type: String,
    required: true,
  },
  /** 正文内 assets/ 图片的公共目录（public/ 下，如 lty/assets/）；不传按 Markdown 所在目录推断。 */
  assetBase: {
    type: String,
    default: '',
  },
});
const emit = defineEmits(['contentLoaded']);

const content = ref('');

// 当前文章的 mermaid 源码，供“选中区域复制为 Markdown”还原为代码块
let mermaidTexts: string[] = [];

// 复制文本到剪贴板（带降级方案，兼容非 HTTPS 的本地开发环境）
function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } catch {
    // 忽略复制失败
  }
  document.body.removeChild(textarea);
}

// 鼠标悬停括号时高亮配对的两个括号（事件委托，v-html 重建 DOM 后依然有效）
function onBracketOver(event: MouseEvent) {
  highlightBracketPair(event.currentTarget as HTMLElement, event.target);
}

function onBracketOut(event: MouseEvent) {
  clearBracketHighlight(event.currentTarget as HTMLElement, event.target);
}

// 处理文章内点击：
// 1. 代码块复制按钮 → 复制整个代码块（事件委托，按钮是 v-html 重建的 DOM，不能直接绑监听器）
// 2. 页内锚点链接（如 [流形](#manifold-comment)）→ scrollIntoView 平滑滚动
function onContentClick(event: MouseEvent) {
  // 放行修饰键点击与非左键点击，保留用户"新标签页打开"等意图
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target as Element | null;

  // 公式左上角的复制按钮
  if (handleFormulaCopyClick(target)) {
    event.preventDefault();
    return;
  }

  // 目录折叠按钮
  if (handleTocToggle(target)) return;

  // 代码块复制按钮
  if (handleCodeCopyClick(target)) {
    event.preventDefault();
    return;
  }

  // 页内锚点链接
  const anchor = target?.closest?.('a[href^="#"]');
  if (!anchor) return;
  const href = anchor.getAttribute('href') || '';
  if (href.startsWith('#/')) return; // 路由链接交给 Vue Router
  const id = href.slice(1);
  if (!id) {
    // href="#" 视为回到页面顶部
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;
  event.preventDefault();
  scrollToElementStable(el); // 懒加载图片会撑高文档，用稳定滚动持续校正落点
}

// 选中区域复制为 Markdown：
// 拦截 copy 事件，用 turndown 把选中范围的 HTML 还原成 markdown 写入剪贴板。
// 这样鼠标选中一段正文 Ctrl+C，粘贴出来是 markdown（公式还原为 $...$、表格还原为 | 表格等），
// 而不是渲染后的纯文本。TurndownService 构建成本高，惰性创建并复用。
let mdConverter: TurndownService | null = null;

function getMdConverter(): TurndownService {
  if (mdConverter) return mdConverter;
  mdConverter = new TurndownService({
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    headingStyle: 'atx',
    emDelimiter: '*',
    strongDelimiter: '**',
  });
  mdConverter.use(gfm);
  // 公式：优先用 data-src 还原源码，回退到纯文本
  mdConverter.addRule('katex', {
    filter: (node: HTMLElement) => node.nodeName === 'SPAN' && node.classList.contains('katex-wrap'),
    replacement: (content: string, node: HTMLElement) => node.getAttribute('data-src') || content,
  });
  // mermaid 图表还原为 fenced code block（渲染后 SVG 带 data-idx）
  mdConverter.addRule('mermaid', {
    filter: (node: HTMLElement) =>
      (node.nodeName === 'DIV' && node.classList.contains('mermaid-slot')) ||
      (node.nodeName === 'SVG' && node.hasAttribute?.('data-idx') === true),
    replacement: (content: string, node: HTMLElement) => {
      const idx = node.getAttribute('data-idx');
      return idx !== null && mermaidTexts[+idx]
        ? `\n\`\`\`mermaid\n${mermaidTexts[+idx]}\n\`\`\`\n`
        : content;
    },
  });
  return mdConverter;
}

function onContentCopy(event: ClipboardEvent) {
  // 只有真正的选区复制才转换；无选区（如点击复制按钮）交给默认行为
  const selection = window.getSelection();
  const text = selection ? selection.toString() : '';
  if (!text || text.trim() === '') return;
  if (!selection || selection.rangeCount === 0) return;

  // 选中范围必须落在文章容器内（选中代码块等不应被改写）
  const container = event.currentTarget as HTMLElement;
  const range = selection.getRangeAt(0);
  if (!range || !container.contains(range.commonAncestorContainer)) return;

  // 用选中范围 clone 出一份 HTML，交给 turndown 转换
  const frag = range.cloneContents();
  const holder = document.createElement('div');
  holder.appendChild(frag);
  removeFormulaCopyButtons(holder);
  removeCodeCopyButtons(holder);
  // turndown 的代码块规则按纯文本提取，先把代码内公式还原为源码，
  // 避免把 KaTeX 的 MathML 与 HTML 两份文本写进复制出的代码块。
  holder.querySelectorAll('code .katex-wrap').forEach((el) => {
    el.replaceWith(el.getAttribute('data-src') ?? '');
  });
  let markdown = getMdConverter().turndown(holder.innerHTML);
  // 标题行首的数字序号点（如 "1\."）是 turndown 为避免有序列表歧义的转义，还原为 "1."
  markdown = markdown.replace(/^(#{1,6}\s+\d+)\\\. /gm, '$1. ');

  event.preventDefault();
  navigator.clipboard.writeText(markdown).catch(() => {
    // 降级：直接放回选区字符串
    copyText(text);
  });
}

// source 是 public/ 下的 Markdown 相对路径；路由复用组件实例时也会自动重新加载。
// 用 watch 而非 onMounted：路由复用组件实例时（从一篇切到另一篇）能自动重新加载。
let loadId = 0; // 请求序号，每次切换文章时单调递增，用于丢弃过期响应

async function loadContent(source: string) {
  const id = ++loadId;
  content.value = '';
  emit('contentLoaded', ''); // 先清空旧内容，避免短暂显示上一篇文章

  try {
    const md = await fetchMarkdown(source);
    if (id !== loadId) return; // 已有更新的请求发出，丢弃本次结果

    const result = await renderMarkdownDocument(md, {
      source,
      assetBase: props.assetBase,
    });
    if (id !== loadId) return; // await 之后再次检查竞态

    mermaidTexts = result.mermaidTexts;
    content.value = result.html;
    emit('contentLoaded', content.value); // 触发 contentLoaded 事件并传递渲染后的内容
  } catch (error) {
    if (id !== loadId) return;
    content.value = '';
    emit('contentLoaded', '');
    console.error('加载 Markdown 失败：', source, error);
  }
}

watch(() => props.source, (source) => { loadContent(source); }, { immediate: true });
</script>

<style>
/* 代码块：浅蓝背景区分正文，圆角，带右上角复制按钮 */
.markdown-body pre {
  position: relative;
  font-size: 0.712em; /* 代码块字体相对于正文的缩小比例 */
  background-color: rgba(178, 216, 232, 0.05); /* 浅蓝背景，区分正文但不会印刷成大面积黑块 */
  box-shadow: none; /* 去掉阴影，打印更清晰 */
}

/* 行内代码 */
.markdown-body code {
  color: #333; /* 深灰近黑，更易阅读且打印友好 */
  background-color: #fffafa; /* 浅灰背景，区分正文但不会印刷成大面积黑块 */
  box-shadow: none; /* 去掉阴影，打印更清晰 */
  padding: 0 2px; /* 保留左右少量内边距 */
  border-radius: 2px; /* 轻微圆角 */
  border: 1px solid #ddd; /* 细线边框，突出"代码块"感 */
  font-family: Consolas, 'Courier New', monospace;
  /* 覆盖 github-markdown-css 的 85% 缩小，行内代码与正文等大 */
  font-size: 1em;
  box-sizing: border-box;
  margin: 0 2px;
}

/* 代码中渲染的公式：恢复正文色，避免继承语法高亮的注释/字符串配色 */
.markdown-body code .code-katex {
  color: #333;
}

/* 代码块字号是正文的 0.712em，按比例放大后公式与正文中的公式大小一致 */
.markdown-body pre code .code-katex {
  font-size: 1.4em;
}

/* 引言：一个 > 的引言仅为两字符缩进 */
.markdown-body blockquote {
  font-style: normal;
  font-family: inherit;
  font-size: 1em;
  /* 文字离左边框的距离 */
  padding-left: 2em;
  padding-right: 2em;
  /* 左边框离页面边的距离 */
  margin-left: 0;
  /* 覆盖 github-markdown-css 默认的灰色左竖线：单 > 只保留淡黄背景，不加线 */
  border-left: none;
  background-color: rgba(255, 248, 220, 0.2);
}

/* 嵌套引言 >>：传统引言样式，具有左竖线、左缩进 */
.markdown-body blockquote blockquote {
  font-style: normal;
  font-family: inherit;
  font-size: 1em;
  border-left: 4px solid hsl(60, 40%, 70%);
  padding-left: calc(2ch - 4px);
  padding-right: 0;
  margin-left: -4px;
  border-radius: 0;
}

</style>



\n