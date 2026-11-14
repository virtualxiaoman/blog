import DOMPurify from 'dompurify';
import { decorateBrackets } from './bracketHighlight';
import { appendFormulaCopyButtons } from './formulaCopy';
import { insertToc } from './markdownToc';
import { renderMarkdownCore } from './markdownRenderCore';
import { renderMermaidDiagrams } from './mermaidRender';

export interface MarkdownDocumentOptions {
  /** public/ 下的 Markdown 路径；用于推断同目录 assets/ 图片地址。 */
  source?: string;
  /** 覆盖图片公共目录（public/ 下，如 lty/assets/）。 */
  assetBase?: string;
}

export interface MarkdownDocumentResult {
  html: string;
  mermaidTexts: string[];
}

/**
 * 完整的 Markdown 文档渲染管线：文章正文与 Markdown 解析器共用。
 * 核心解析之外，统一处理图片、标题 id/序号、[toc]、消毒、Mermaid、
 * 括号配对和公式复制按钮，避免两处效果不一致。
 */
export async function renderMarkdownDocument(
  markdown: string,
  options: MarkdownDocumentOptions = {}
): Promise<MarkdownDocumentResult> {
  const { html, mermaidTexts, hasToc } = renderMarkdownCore(markdown, {
    codeFormulas: true,
    mermaid: true,
    codeCopyButtons: true,
    tocSlots: true,
  });

  let processed = prepareImages(html, options.source ?? '', options.assetBase ?? '');
  processed = generateHeadingIds(processed);
  if (hasToc) processed = insertToc(processed);
  processed = autoNumberHeadings(processed);

  // 消毒在 Mermaid 渲染之前：拦截 Markdown 内联 HTML 中可能携带的脚本、事件属性。
  // katex 依赖行内 style 定位上下标，需显式放行 style；mermaid 槽位可安全通过。
  processed = DOMPurify.sanitize(processed, { ADD_ATTR: ['style'] });
  processed = await renderMermaidDiagrams(mermaidTexts, processed);

  // 括号与公式按钮最后处理，避免前面的正则/序列化破坏刚插入的节点。
  const container = document.createElement('div');
  container.innerHTML = processed;
  decorateBrackets(container);
  appendFormulaCopyButtons(container);

  return { html: container.innerHTML, mermaidTexts };
}

// 将文章内相对路径的图片（assets/xxx/...）重写为带 base 前缀的绝对路径，
// 并统一启用懒加载与异步解码。
function prepareImages(html: string, source: string, assetBaseOverride: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const base = import.meta.env.BASE_URL;
  const assetBase = assetBaseOverride
    ? `${base}${assetBaseOverride.replace(/^\/+/, '').replace(/\/?$/, '/')}`
    : source.startsWith('article/md/')
      ? `${base}article/assets/`
      : source
        ? `${base}${source.slice(0, source.lastIndexOf('/') + 1)}assets/`
        : '';

  tempDiv.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    // 只处理 assets/ 开头的相对路径，跳过 http(s)、//、#、data: 和 / 开头的地址
    if (assetBase && /^(\.\/)?assets\//.test(src)) {
      const rest = src.replace(/^(\.\/)?assets\//, '');
      img.setAttribute('src', `${assetBase}${rest}`);
    }
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  });
  return tempDiv.innerHTML;
}

// 为 h 标签生成 id。同时记录标题在文档内的序号（data-sec），
// 供全局搜索“跳转到文章内对应区域”精确定位。
function generateHeadingIds(html: string): string {
  let counter = 0;
  let headingSeq = 0;
  return html.replace(/<(h[1-6])>(.*?)<\/\1>/gi, (_, tag: string, inner: string) => {
    const id = generateUniqueId(inner.trim(), counter++);
    const sec = ++headingSeq;
    return `<${tag} id="${id}" data-sec="${sec}">${inner}</${tag}>`;
  });
}

function generateUniqueId(text: string, i: number): string {
  const sanitizedText = text.replace(/[^a-zA-Z0-9一-龥]+/g, ''); // 替换所有非字母数字字符
  return `${sanitizedText}_${i}`;
}

// 匹配标题开头的已有序号："1. " "1.1 " "1.1.1 " "一、 " "第一章 " 等
const HEADING_ORDER_RE = /^\s*(\d+(?:[.．]\d+)*[.．]?\s+|\d+[、.]\s*|[一二三四五六七八九十]+[、.]\s*|第[一二三四五六七八九十百千]+[章节篇]\s+)/;

// 自动为无序号标题补上层级式序号（1. / 1.1 / 1.1.1 ...）。
// 已有序号的标题原样保留，只改标题显示文本，id 与 data-sec 保持不变。
function autoNumberHeadings(html: string): string {
  const counters = [0, 0, 0, 0, 0, 0, 0]; // 下标 1~6 对应 h1~h6
  return html.replace(/<(h[1-6])\s+id="([^"]+)"([^>]*)>(.*?)<\/\1>/gi, (_, tag: string, id: string, attrs: string, inner: string) => {
    const level = Number(tag[1]);
    const text = inner.trim();
    if (HEADING_ORDER_RE.test(text)) return `<${tag} id="${id}"${attrs}>${inner}</${tag}>`;

    counters[level] += 1;
    for (let l = level + 1; l <= 6; l += 1) counters[l] = 0;

    const parts: string[] = [];
    for (let l = 1; l <= level; l += 1) {
      if (counters[l] > 0) parts.push(String(counters[l]));
    }
    const single = parts.length === 1;
    const prefix = parts.join('.') + (single ? '. ' : ' ');
    return `<${tag} id="${id}"${attrs}>${prefix}${inner}</${tag}>`;
  });
}
