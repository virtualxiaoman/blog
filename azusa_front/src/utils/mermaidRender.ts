import { copyText } from './clipboard';
import { showCodeCopied } from './codeCopy';

// 全局递增，mermaid.render 不允许重复使用相同的图表 id，跨文章/预览切换也不能复用
let mermaidRenderId = 0;

const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
  '<path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';

/** Mermaid 图表右上角的复制按钮（点击逻辑走内容区域事件委托）。 */
export function createMermaidCopyButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mermaid-copy-btn';
  button.title = '复制 Mermaid 代码';
  button.setAttribute('aria-label', '复制 Mermaid 代码');
  button.innerHTML = COPY_ICON;
  return button;
}

/**
 * 把 HTML 中的 .mermaid-slot 占位元素渲染成 SVG 图表。
 * mermaid 体积很大，只在内容确实包含图表时才动态加载。
 */
export async function renderMermaidDiagrams(texts: string[], html: string): Promise<string> {
  if (!texts.length) return html;

  const { default: mermaid } = await import('mermaid');
  // strict：禁用图表内嵌 HTML 与 click 回调；该模式下 mermaid 自己会消毒标签
  // （剥掉 on* 事件属性与脚本），其输出不再经 DOMPurify——DOMPurify 会删掉
  // <foreignObject> 里的标签 HTML，导致"有框架无文字"。
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });

  // DOM 方式替换占位元素：消毒后属性顺序可能变化，字符串匹配槽位不可靠
  const container = document.createElement('div');
  container.innerHTML = html;
  for (const slot of container.querySelectorAll('.mermaid-slot')) {
    const idx = Number((slot as HTMLElement).dataset.idx);
    const block = document.createElement('div');
    block.className = 'mermaid-block';
    block.dataset.idx = String(idx);

    try {
      const { svg } = await mermaid.render(`mermaid-svg-${mermaidRenderId++}`, texts[idx]);
      const tpl = document.createElement('template');
      tpl.innerHTML = svg.replace('<svg', `<svg class="mermaid-diagram" data-idx="${idx}"`);
      block.appendChild(tpl.content);
    } catch (error) {
      console.error('mermaid 渲染失败：', error);
      // 回退为展示原始代码，避免图表内容丢失
      const pre = document.createElement('pre');
      pre.className = 'mermaid-error';
      const code = document.createElement('code');
      code.textContent = texts[idx];
      pre.appendChild(code);
      block.appendChild(pre);
    }

    block.appendChild(createMermaidCopyButton());
    slot.replaceWith(block);
  }
  return container.innerHTML;
}

/** 内容区域点击委托：命中 Mermaid 复制按钮时复制带 ```mermaid 围栏的源码。返回是否已处理。 */
export function handleMermaidCopyClick(target: EventTarget | null, texts: string[]): boolean {
  const button = (target as Element | null)?.closest?.('.mermaid-copy-btn') as HTMLElement | null;
  if (!button) return false;

  const block = button.closest('.mermaid-block') as HTMLElement | null;
  const idx = Number(block?.dataset.idx);
  const source = Number.isInteger(idx) ? (texts[idx] ?? '').replace(/\s+$/, '') : '';
  if (source) {
    void copyText(`\`\`\`mermaid\n${source}\n\`\`\``).then((ok) => {
      if (ok) showCodeCopied(button);
    });
  }
  return true;
}

export function removeMermaidCopyButtons(root: ParentNode): void {
  root.querySelectorAll('.mermaid-copy-btn').forEach((button) => button.remove());
}

/** 生成 PDF 前去掉按钮，避免被画进 PDF。 */
export function stripMermaidCopyButtons(html: string): string {
  if (!html.includes('mermaid-copy-btn')) return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  removeMermaidCopyButtons(container);
  return container.innerHTML;
}
