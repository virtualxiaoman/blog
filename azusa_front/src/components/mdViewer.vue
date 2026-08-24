<template>
  <div v-html="content" class="markdown-body" @click="onContentClick" @copy="onContentCopy"></div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { resolveMarkdownSource } from '../utils/markdownSource';
import axios from 'axios';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import 'github-markdown-css';
import 'highlight.js/styles/github.css'; // 代码高亮配色（浅色主题，适合正文）
import katex from 'katex';
import 'katex/dist/katex.min.css'; // 公式渲染必需的样式（字体、间距、上下标定位）
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const props = defineProps({
  /** public/ 下的 Markdown 相对路径，例如 article/md/AI/示例.md。 */
  source: {
    type: String,
    required: true,
  },
});
const emit = defineEmits(['contentLoaded']);

const content = ref('');

// UTF-8 安全的 base64 编码/解码，替代 Buffer polyfill。
// btoa/atob 只接受 ASCII，而公式里可能有中文或 Unicode 符号（如 ∀、∈），必须先转成字节。
function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
function decodeBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// 第一步，把markdown中的数学公式转换为base64编码。
// 先保护代码块（fenced code block）与行内代码——其中的 $ 是代码而不是公式，
// 替换完公式后再把代码原样还原，避免公式正则误伤代码内容。
function md2katex(md: string) {
  // 1. 保护 fenced code block，整块暂存，用哨兵占位
  const codeBlocks: string[] = [];
  let processed = md.replace(/```[\s\S]*?```/g, (block) => {
    codeBlocks.push(block);
    return `~!~CB~!~${codeBlocks.length - 1}~!~`;
  });
  // 2. 保护行内代码（fenced block 已被占位，不会被这里误匹配）
  const inlineCodes: string[] = [];
  processed = processed.replace(/`[^`\n]+`/g, (code) => {
    inlineCodes.push(code);
    return `~!~IC~!~${inlineCodes.length - 1}~!~`;
  });
  // 3. 替换公式（此时代码已被保护）
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, p1) => {
    return `{{katex_block:${encodeBase64(p1)}}}`;
  }).replace(/\$([^$\n]+)\$/g, (_, p1) => {
    return `{{katex_inline:${encodeBase64(p1)}}}`;
  });
  // 4. 还原行内代码与代码块
  processed = processed.replace(/~!~IC~!~(\d+)~!~/g, (_, i) => inlineCodes[+i]);
  processed = processed.replace(/~!~CB~!~(\d+)~!~/g, (_, i) => codeBlocks[+i]);
  return processed;
}

// 第二步，把md转化为html。
// 返回 { html, mermaidTexts }：mermaid 图表定义文本单独抽出，代码块用占位元素标记，
// 后续由 renderMermaid 异步渲染成 SVG。
async function md2html(md: string) {
  const html = await marked(md);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const mermaidTexts: string[] = [];

  tempDiv.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector('code');
    if (!code) return;

    // mermaid 图表：只抽取定义文本，用占位元素替换（图表由 mermaid 渲染，不走代码高亮）
    if (code.classList.contains('language-mermaid')) {
      mermaidTexts.push(code.textContent ?? '');
      const slot = document.createElement('div');
      slot.className = 'mermaid-slot';
      slot.dataset.idx = String(mermaidTexts.length - 1);
      pre.replaceWith(slot);
      return;
    }

    // 手动处理代码高亮，并给每个代码块加右上角复制按钮
    hljs.highlightElement(code as HTMLElement);

    // 复制按钮：只负责展示。点击逻辑由根容器事件委托处理（见 onContentClick）。
    // 注意不能在这里 addEventListener——按钮会经 innerHTML 序列化后由浏览器重建，监听器会丢失。
    const button = document.createElement('button');
    button.className = 'code-copy-btn';
    button.type = 'button';
    button.setAttribute('aria-label', '复制代码');
    button.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
      '<path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
    pre.appendChild(button);
  });
  return { html: tempDiv.innerHTML, mermaidTexts };
}

// 全局递增，mermaid.render 不允许重复使用相同的图表 id，跨文章切换也不能复用
let mermaidRenderId = 0;

// 把 mermaid 占位元素渲染成 SVG 图表。
// mermaid 体积很大，只在文章确实包含图表时才动态加载，避免拖慢首屏。
// 当前文章的所有 mermaid 源码，按渲染顺序存（data-idx 索引）。
// 供"选中区域复制为 Markdown"把已渲染的图表还原回 ```mermaid 代码块。
let mermaidTexts: string[] = [];

async function renderMermaid(texts: string[], html: string): Promise<string> {
  mermaidTexts = texts;
  if (!texts.length) return html;
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });

  let result = html;
  for (let i = 0; i < texts.length; i++) {
    const slot = `<div class="mermaid-slot" data-idx="${i}"></div>`;
    try {
      const { svg } = await mermaid.render(`mermaid-svg-${mermaidRenderId++}`, texts[i]);
      const svgWithClass = svg.replace('<svg', `<svg class="mermaid-diagram" data-idx="${i}"`);
      // 用函数形式替换，避免 SVG 内容里的 $ 被当作字符串替换的模板模式解释
      result = result.replace(slot, () => svgWithClass);
    } catch (error) {
      console.error('mermaid 渲染失败：', error);
      // 回退为展示原始代码，避免图表内容丢失
      result = result.replace(slot, () =>
        `<pre class="mermaid-error"><code>${escapeHtml(texts[i])}</code></pre>`
      );
    }
  }
  return result;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

// 复制按钮的"已复制"反馈（1.5s 后恢复原状）
function showCopied(button: HTMLElement) {
  const original = button.innerHTML;
  button.classList.add('is-copied');
  button.textContent = '已复制';
  setTimeout(() => {
    button.classList.remove('is-copied');
    button.innerHTML = original;
  }, 1500);
}

// 将文章内相对路径的图片（assets/xxx/...）重写为带 base 前缀的绝对路径，
// 使图片在本地（/）和 GitHub Pages（/blog/）下都能正确加载
function fixMarkdownImagePaths(html: string, source: string) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const base = import.meta.env.BASE_URL;
  const assetBase = source.startsWith('article/md/')
    ? `${base}article/assets/`
    : `${base}${source.slice(0, source.lastIndexOf('/') + 1)}assets/`;
  tempDiv.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    // 只处理 assets/ 开头的相对路径，跳过 http(s)、//、#、data: 和 / 开头的地址
    if (/^(\.\/)?assets\//.test(src)) {
      const rest = src.replace(/^(\.\/)?assets\//, '');
      img.setAttribute('src', `${assetBase}${rest}`);
    }
    // 文章内图片启用懒加载与异步解码，避免长文章一次性加载全部大图
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  });
  return tempDiv.innerHTML;
}

// 第三步，替换html中的数学公式。
// 渲染结果外层包 <span class="katex-wrap" data-src="...">，data-src 存公式源码，
// 供"选中区域复制为 Markdown"把渲染后的公式还原回 $...$ / $$...$$。
function katex2html(html: string) {
  let processedContent = html.replace(/{{katex_block:(.*?)}}/g, (_, p1) => {
    const src = decodeBase64(p1);
    const rendered = katex.renderToString(src, {
      throwOnError: false,
      displayMode: true,
    });
    return `<span class="katex-wrap" data-src="${escapeAttr(`$$${src}$$`)}">${rendered}</span>`;
  }).replace(/{{katex_inline:(.*?)}}/g, (_, p1) => {
    const src = decodeBase64(p1);
    const rendered = katex.renderToString(src, {
      throwOnError: false,
    });
    return `<span class="katex-wrap" data-src="${escapeAttr(`$${src}$`)}">${rendered}</span>`;
  });
  return processedContent;
}

// HTML 属性值转义：& 和 " 必须转，getAttribute 时会自动解码回原文
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// 第四步，为h标签生成id。同时记录标题在文章内的序号（data-sec），
// 供全局搜索"跳转到文章内对应区域"精确定位：序号与 scripts/generate-articles.mjs
// 生成的 headings 数组顺序一致（1 开始），渲染后把 data-sec 写在标题标签上。
let headingSeq = 0; // 标题序号：跨标题递增，与生成脚本的 headings 顺序对应

function generate_h_id(html: string) {
  let counter = 0; // 递增计数器，保证同名标题也能拿到唯一 id
  headingSeq = 0;
  const processedContent = html.replace(/<(h[1-6])>(.*?)<\/\1>/gi, (_, p1, p2) => {
    const id = generateUniqueId(p2.trim(), counter++);
    const sec = ++headingSeq;
    return `<${p1} id="${id}" data-sec="${sec}">${p2}</${p1}>`;
  });
  return processedContent;
}

// 生成唯一的id
function generateUniqueId(text: string, i: number) {
  const sanitizedText = text.replace(/[^a-zA-Z0-9一-龥]+/g, ''); // 替换所有非字母数字字符
  return `${sanitizedText}_${i}`;
}

// 匹配标题开头的已有序号："1. " "1.1 " "1.1.1 " "一、 " "第一章 " 等
// 有序号 → 返回 null（跳过不处理）；无序号 → 返回标题文本
const HEADING_ORDER_RE = /^\s*(\d+(?:[.．]\d+)*[.．]?\s+|\d+[、.]\s*|[一二三四五六七八九十]+[、.]\s*|第[一二三四五六七八九十百千]+[章节篇]\s+)/;

// 自动为无序号标题补上层级式序号（1. / 1.1 / 1.1.1 ...）。
// 已有序号的标题原样保留。只改标题显示文本，复用 generate_h_id 生成的 id，
// 这样文章里的页内锚点链接与大刚跳转（按 id 定位）不会失效。
// 保留 data-sec 属性：它与 id 一起用于全局搜索定位（id 不可预测，data-sec 序号可精确对应索引）。
function autoNumberHeadings(html: string) {
  // 各层级当前计数（h1~h6 用数组下标 1~6 表示）
  const counters = [0, 0, 0, 0, 0, 0, 0];
  return html.replace(/<(h[1-6])\s+id="([^"]+)"([^>]*)>(.*?)<\/\1>/gi, (_, tag, id, attrs, inner) => {
    const level = Number(tag[1]);
    const text = inner.trim();
    // 已有层级式/中文章节号/数字点号序号的标题，不处理
    if (HEADING_ORDER_RE.test(text)) return `<${tag} id="${id}"${attrs}>${inner}</${tag}>`;

    // 本级计数 +1，低层级计数清零
    counters[level]++;
    for (let l = level + 1; l <= 6; l++) counters[l] = 0;

    // 组装序号：只有一段时用 "1."（如 h1，或没有更上层标题时的第一个 h2），
    // 多段时用 "1.1"、"1.1.1"（末级不带点）
    const parts: string[] = [];
    for (let l = 1; l <= level; l++) {
      if (counters[l] > 0) parts.push(String(counters[l]));
    }
    const single = parts.length === 1;
    const prefix = parts.join('.') + (single ? '. ' : ' ');

    // 只加序号前缀，id 与 data-sec 保持不变
    return `<${tag} id="${id}"${attrs}>${prefix}${inner}</${tag}>`;
  });
}

// 处理文章内点击：
// 1. 代码块复制按钮 → 复制整个代码块（事件委托，按钮是 v-html 重建的 DOM，不能直接绑监听器）
// 2. 页内锚点链接（如 [流形](#manifold-comment)）→ scrollIntoView 平滑滚动
function onContentClick(event: MouseEvent) {
  // 放行修饰键点击与非左键点击，保留用户"新标签页打开"等意图
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target as Element | null;

  // 代码块复制按钮
  const copyBtn = target?.closest?.('.code-copy-btn');
  if (copyBtn) {
    const pre = copyBtn.closest('pre');
    const code = pre?.querySelector('code');
    if (pre && code) {
      copyText(code.textContent ?? '');
      showCopied(copyBtn as HTMLElement);
    }
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
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const mdUrl = resolveMarkdownSource(source);
    const response = await axios.get(mdUrl);
    if (id !== loadId) return; // 已有更新的请求发出，丢弃本次结果

    const mdWithPlaceholders = md2katex(response.data);
    const { html, mermaidTexts } = await md2html(mdWithPlaceholders);
    let processedContent = fixMarkdownImagePaths(html, source); // 修复 Markdown 内图片路径
    processedContent = katex2html(processedContent);
    processedContent = generate_h_id(processedContent); // 为 h 标签生成唯一 id
    processedContent = autoNumberHeadings(processedContent); // 为无序号标题自动补层级序号
    // 最后渲染 mermaid 图表（katex 与标题 id 处理完成后，避免图表 SVG 被这些正则误伤）
    processedContent = await renderMermaid(mermaidTexts, processedContent);
    if (id !== loadId) return; // await 之后再次检查竞态

    content.value = processedContent;
    emit('contentLoaded', processedContent); // 触发 contentLoaded 事件并传递渲染后的内容
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

/* 复制按钮：代码块内部右上角 */
.code-copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background-color: rgba(102, 204, 255, 0.18);
  color: #409eff;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

.markdown-body pre:hover .code-copy-btn {
  opacity: 1;
}

.code-copy-btn:hover {
  background-color: rgba(102, 204, 255, 0.32);
}

.code-copy-btn.is-copied {
  background-color: rgba(57, 197, 187, 0.25);
  color: #2eaaa0;
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

/* mermaid 图表：居中，水平方向可滚动避免窄屏挤压 */
.mermaid-slot,
.mermaid-diagram {
  display: block;
  margin: 16px auto;
  overflow-x: auto;
}

/* 渲染失败的兜底展示 */
.mermaid-error {
  background-color: rgba(255, 248, 220, 0.3);
}
</style>



\n