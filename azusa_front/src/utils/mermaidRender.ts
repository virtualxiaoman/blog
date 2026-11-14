// 全局递增，mermaid.render 不允许重复使用相同的图表 id，跨文章/预览切换也不能复用
let mermaidRenderId = 0;

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
    try {
      const { svg } = await mermaid.render(`mermaid-svg-${mermaidRenderId++}`, texts[idx]);
      const tpl = document.createElement('template');
      tpl.innerHTML = svg.replace('<svg', `<svg class="mermaid-diagram" data-idx="${idx}"`);
      slot.replaceWith(tpl.content.cloneNode(true));
    } catch (error) {
      console.error('mermaid 渲染失败：', error);
      // 回退为展示原始代码，避免图表内容丢失
      const pre = document.createElement('pre');
      pre.className = 'mermaid-error';
      const code = document.createElement('code');
      code.textContent = texts[idx];
      pre.appendChild(code);
      slot.replaceWith(pre);
    }
  }
  return container.innerHTML;
}
