import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';
import { cleanFormulaSource } from './formulaNormalize';

/**
 * 文章正文与 Markdown 解析器共用的 Markdown 核心渲染。
 *
 * 负责：保护代码块/行内代码 → 公式占位 → marked 解析 → 代码高亮
 * （可选渲染代码内公式）→ mermaid 抽取 → 代码复制按钮 → KaTeX 还原。
 * 标题 id、目录、图片路径、消毒等按页面需求在调用方继续处理。
 */
export interface MarkdownRenderOptions {
  /** 渲染代码块/行内代码中的 $...$ 公式（文章正文开启）。 */
  codeFormulas?: boolean;
  /** 把 ```mermaid 代码块抽成占位元素（文章正文开启）。 */
  mermaid?: boolean;
  /** 给代码块追加右上角复制按钮（文章正文开启）。 */
  codeCopyButtons?: boolean;
  /** 把独占一行的 [toc] 换成目录占位元素（文章正文开启）。 */
  tocSlots?: boolean;
}

export interface MarkdownRenderResult {
  html: string;
  mermaidTexts: string[];
  hasToc: boolean;
}

export function renderMarkdownCore(
  markdown: string,
  options: MarkdownRenderOptions = {}
): MarkdownRenderResult {
  const withPlaceholders = markdownToKatexPlaceholders(markdown);
  const { html, mermaidTexts, hasToc } = markdownToHtml(withPlaceholders, options);
  return { html: restoreKatexHtml(html), mermaidTexts, hasToc };
}

// UTF-8 安全的 base64 编码/解码，替代 Buffer polyfill。
// btoa/atob 只接受 ASCII，而公式里可能有中文或 Unicode 符号（如 ∀、∈），必须先转成字节。
function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// 第一步：把 Markdown 中的数学公式转成 base64 占位符。
// 先保护代码块与行内代码——其中的 $ 是代码而不是公式，
// 替换完公式后再把代码原样还原，避免公式正则误伤代码内容。
// 哨兵混入随机串：原文若恰好包含固定占位模式，会在还原阶段被误替换。
function markdownToKatexPlaceholders(md: string): string {
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];
  const token = `~!~${Math.random().toString(36).slice(2)}~!~`;

  let processed = md.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, (block) => {
    codeBlocks.push(block);
    return `${token}CB~!~${codeBlocks.length - 1}~!~`;
  });
  processed = processed.replace(/`[^`\n]+`/g, (code) => {
    inlineCodes.push(code);
    return `${token}IC~!~${inlineCodes.length - 1}~!~`;
  });

  processed = processed
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, p1: string) => `{{katex_block:${encodeBase64(cleanFormulaSource(p1))}}}`)
    .replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, p1: string) => `{{katex_inline:${encodeBase64(cleanFormulaSource(p1))}}}`);

  processed = processed.replace(new RegExp(`${token}IC~!~(\\d+)~!~`, 'g'), (_, i: string) => inlineCodes[Number(i)]);
  processed = processed.replace(new RegExp(`${token}CB~!~(\\d+)~!~`, 'g'), (_, i: string) => codeBlocks[Number(i)]);
  return processed;
}

// 代码中公式的占位符：纯字母数字，highlight.js 不会把它拆进多个文本节点。
const CODE_FORMULA_SLOT = `KATEXCODESLOT${Math.random().toString(36).slice(2).toUpperCase()}X`;

// 后行断言需要较新的内核；旧浏览器不支持时跳过代码内公式渲染，不影响其余内容。
const CODE_FORMULA_RE = (() => {
  try {
    return new RegExp(
      String.raw`(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$|(?<!\\)\$([^$\n]+?)(?<!\\)\$`,
      'g',
    );
  } catch {
    return null;
  }
})();

// 渲染代码块/行内代码中的 $...$ 公式。
// 顺序必须是：抽公式占位 → 语法高亮 → 还原公式；高亮会重建 code 的 DOM，
// 提前插入的公式节点会被清掉。
function highlightCodeWithFormulas(code: HTMLElement, highlight: boolean) {
  const slots: { src: string; display: boolean; html: string }[] = [];
  if (CODE_FORMULA_RE) {
    CODE_FORMULA_RE.lastIndex = 0; // 全局正则在多次调用间共用
    const text = (code.textContent ?? '').replace(
      CODE_FORMULA_RE,
      (_match, block: string | undefined, inline: string | undefined) => {
        const src = block ?? inline ?? '';
        const display = block !== undefined;
        slots.push({
          src,
          display,
          html: katex.renderToString(src, { throwOnError: false, displayMode: display }),
        });
        return `${CODE_FORMULA_SLOT}${slots.length - 1}`;
      },
    );
    if (slots.length) code.textContent = text;
  }

  if (highlight) hljs.highlightElement(code);
  if (!slots.length) return;

  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  const slotRe = new RegExp(`${CODE_FORMULA_SLOT}(\\d+)`, 'g');
  for (const node of textNodes) {
    if (!node.data.includes(CODE_FORMULA_SLOT)) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const match of node.data.matchAll(slotRe)) {
      const index = match.index ?? 0;
      if (index > last) frag.append(node.data.slice(last, index));
      const slot = slots[Number(match[1])];
      if (slot) {
        const wrap = document.createElement('span');
        wrap.className = 'katex-wrap code-katex';
        wrap.setAttribute('data-src', slot.display ? `$$${slot.src}$$` : `$${slot.src}$`);
        wrap.innerHTML = slot.html;
        frag.append(wrap);
      } else {
        frag.append(match[0]);
      }
      last = index + match[0].length;
    }
    if (last < node.data.length) frag.append(node.data.slice(last));
    node.replaceWith(frag);
  }
}

// 第二步：把 Markdown 转换成 HTML，并处理目录、mermaid、代码高亮与复制按钮。
function markdownToHtml(
  md: string,
  options: MarkdownRenderOptions
): { html: string; mermaidTexts: string[]; hasToc: boolean } {
  const html = marked.parse(md, { breaks: true }) as string;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const mermaidTexts: string[] = [];

  // 目录标记：[toc]（大小写均可）独占一行时插入占位元素，
  // 真正的目录等标题 id 生成后再填充（由调用方处理）。
  let hasToc = false;
  if (options.tocSlots) {
    tempDiv.querySelectorAll('p').forEach((p) => {
      // 只认纯文本的 [toc]，避免把 `[toc]` 行内代码误当成目录标记
      if (p.children.length > 0) return;
      if ((p.textContent ?? '').trim().toLowerCase() !== '[toc]') return;
      const slot = document.createElement('div');
      slot.className = 'md-toc-slot';
      p.replaceWith(slot);
      hasToc = true;
    });
  }

  // 代码中的公式按需渲染；mermaid 源码保持原样
  tempDiv.querySelectorAll('code').forEach((code) => {
    if (options.mermaid && code.classList.contains('language-mermaid')) return;
    if (options.codeFormulas) {
      highlightCodeWithFormulas(code as HTMLElement, code.closest('pre') !== null);
    } else if (code.closest('pre')) {
      hljs.highlightElement(code as HTMLElement);
    }
  });

  tempDiv.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector('code');
    if (!code) return;

    if (options.mermaid && code.classList.contains('language-mermaid')) {
      mermaidTexts.push(code.textContent ?? '');
      const slot = document.createElement('div');
      slot.className = 'mermaid-slot';
      slot.dataset.idx = String(mermaidTexts.length - 1);
      pre.replaceWith(slot);
      return;
    }

    if (!options.codeCopyButtons) return;
    // 复制按钮：只负责展示。点击逻辑由根容器事件委托处理（见调用方）。
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

  return { html: tempDiv.innerHTML, mermaidTexts, hasToc };
}

// 第三步：替换 HTML 中的数学公式。
// 渲染结果外层包 <span class="katex-wrap" data-src="...">，data-src 存公式源码，
// 供复制/选中转 Markdown 时还原回 $...$ / $$...$$。
function restoreKatexHtml(html: string): string {
  return html
    .replace(/{{katex_block:(.*?)}}/g, (_, p1: string) => {
      const src = decodeBase64(p1);
      const rendered = katex.renderToString(src, { throwOnError: false, displayMode: true });
      return `<span class="katex-wrap" data-src="${escapeAttr(`$$${src}$$`)}">${rendered}</span>`;
    })
    .replace(/{{katex_inline:(.*?)}}/g, (_, p1: string) => {
      const src = decodeBase64(p1);
      const rendered = katex.renderToString(src, { throwOnError: false });
      return `<span class="katex-wrap" data-src="${escapeAttr(`$${src}$`)}">${rendered}</span>`;
    });
}

/** HTML 属性值转义：& 和 " 必须转，getAttribute 时会自动解码回原文。 */
export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
