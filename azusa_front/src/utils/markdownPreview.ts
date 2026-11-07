import DOMPurify from 'dompurify';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';

/**
 * 把 Markdown 渲染成与文章正文一致的 HTML（marked + highlight.js + KaTeX）。
 * 公式需先经 normalizeFormulaDelimiters 统一为 $...$ / $$...$$。
 */
export function renderMarkdownPreview(markdown: string): string {
  if (!markdown.trim()) return '';

  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];
  const token = `~!~R${Math.random().toString(36).slice(2)}~!~`;

  // 先保护代码：代码里的 $ 是代码而不是公式
  let processed = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, (block) => {
    codeBlocks.push(block);
    return `${token}CB${codeBlocks.length - 1}${token}`;
  });
  processed = processed.replace(/`[^`\n]+`/g, (code) => {
    inlineCodes.push(code);
    return `${token}IC${inlineCodes.length - 1}${token}`;
  });

  // 公式内容先编码成 base64 占位符，避免其中的 Markdown 符号被 marked 误解析
  processed = processed
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, inner: string) => `{{katex_block:${encodeBase64(inner)}}}`)
    .replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, inner: string) => `{{katex_inline:${encodeBase64(inner)}}}`);

  processed = processed.replace(new RegExp(`${token}IC(\\d+)${token}`, 'g'), (_, index: string) => inlineCodes[Number(index)]);
  processed = processed.replace(new RegExp(`${token}CB(\\d+)${token}`, 'g'), (_, index: string) => codeBlocks[Number(index)]);

  const html = marked.parse(processed, { breaks: true, gfm: true, async: false }) as string;
  const container = document.createElement('div');
  container.innerHTML = html;

  container.querySelectorAll('pre code').forEach((code) => {
    hljs.highlightElement(code as HTMLElement);
  });

  container.innerHTML = container.innerHTML
    .replace(/{{katex_block:(.*?)}}/g, (_, value: string) => {
      const src = decodeBase64(value);
      const rendered = katex.renderToString(src, { throwOnError: false, displayMode: true });
      return `<span class="katex-wrap" data-src="${escapeAttr(`$$${src}$$`)}">${rendered}</span>`;
    })
    .replace(/{{katex_inline:(.*?)}}/g, (_, value: string) => {
      const src = decodeBase64(value);
      const rendered = katex.renderToString(src, { throwOnError: false });
      return `<span class="katex-wrap" data-src="${escapeAttr(`$${src}$`)}">${rendered}</span>`;
    });

  let headingSeq = 0;
  container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => {
    const text = (heading.textContent ?? '').trim();
    const slug = text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
    heading.id = `${slug}-${(headingSeq += 1)}`;
  });

  container.querySelectorAll('img').forEach((img) => {
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  });

  return DOMPurify.sanitize(container.innerHTML, { ADD_ATTR: ['style'] });
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
