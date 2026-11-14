import { escapeAttr } from './markdownRenderCore';

// 用正文内的全部标题构建目录 HTML。
// 结构取自 Typora 导出的目录（.md-toc > .md-toc-content > .md-toc-item.md-toc-hN），
// 编号由 CSS 计数器生成，因此这里的链接文字取标题原文，不包含自动编号的序号。
function buildTocHtml(container: HTMLElement): string {
  const items: string[] = [];
  // 平级结构下 Chrome 不会把兄弟元素的 counter-reset 应用到后续兄弟的 ::before，
  // 编号会跨父级连续累加。这里把各级当前值内联写到条目上，让每条的 ::before
  // 在自己的作用域内取到正确计数，编号仍由原 CSS 输出。
  const counters = [0, 0, 0, 0, 0, 0, 0]; // 下标 1~6 对应 h1~h6
  container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => {
    const id = heading.getAttribute('id');
    const text = (heading.textContent ?? '').trim();
    if (!id || !text) return;

    const level = Number(heading.tagName[1]);
    if (level === 1) {
      for (let l = 2; l <= 6; l++) counters[l] = 0;
    } else {
      counters[level] += 1;
      for (let l = level + 1; l <= 6; l++) counters[l] = 0;
    }
    const resets: string[] = [];
    for (let l = 2; l <= 6; l++) {
      // 本级写 n-1：::before 里 counter-increment 后正好显示 n
      const value = l < level ? counters[l] : l === level ? counters[l] - 1 : 0;
      resets.push(`toc-h${l} ${value}`);
    }

    items.push(
      `<div class="md-toc-item md-toc-h${level}" role="listitem" style="counter-reset: ${resets.join(' ')}">` +
        `<a class="md-toc-inner" href="#${escapeAttr(id)}">${heading.innerHTML}</a>` +
        '</div>',
    );
  });
  if (!items.length) return '';
  // 默认折叠：标题行是按钮，点击展开/收起；内容用 is-collapsed 控制显示
  return (
    '<div class="md-toc is-collapsed" role="navigation" aria-label="目录">' +
    '<button class="md-toc-toggle" type="button" aria-expanded="false" aria-label="展开目录">' +
    '<span class="md-toc-title">目录</span>' +
    '<span class="md-toc-arrow" aria-hidden="true"></span>' +
    '</button>' +
    `<div class="md-toc-content" role="list">${items.join('')}</div>` +
    '</div>'
  );
}

/** 把 [toc] 占位元素替换为目录；没有标题时直接移除占位，避免留下空块。 */
export function insertToc(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  const slots = container.querySelectorAll('.md-toc-slot');
  if (!slots.length) return html;

  const toc = buildTocHtml(container);
  slots.forEach((slot) => {
    if (!toc) {
      slot.remove();
      return;
    }
    const tpl = document.createElement('template');
    tpl.innerHTML = toc;
    slot.replaceWith(tpl.content.cloneNode(true));
  });
  return container.innerHTML;
}

/** 目录标题行点击：展开/收起目录。返回是否已处理。 */
export function handleTocToggle(target: EventTarget | null): boolean {
  const element = target as Element | null;
  const toggle = element?.closest?.('.md-toc-toggle');
  if (!toggle) return false;

  const toc = toggle.closest('.md-toc');
  if (!toc) return false;

  const collapsed = toc.classList.toggle('is-collapsed');
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.setAttribute('aria-label', collapsed ? '展开目录' : '收起目录');
  return true;
}
