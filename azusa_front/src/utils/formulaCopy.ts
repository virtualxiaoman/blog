import { copyText } from './clipboard';

const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">' +
  '<path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';

/**
 * 给渲染后的公式（.katex-wrap[data-src]）追加左上角复制按钮。
 * 代码块里的公式不处理，避免按钮遮挡代码。
 */
export function appendFormulaCopyButtons(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.katex-wrap').forEach((wrap) => {
    if (wrap.closest('pre, code')) return;
    if (wrap.querySelector(':scope > .formula-copy-btn')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'formula-copy-btn';
    button.title = '复制公式';
    button.setAttribute('aria-label', '复制公式');
    button.innerHTML = COPY_ICON;
    wrap.appendChild(button);
  });
}

/** 内容区域点击委托：命中公式复制按钮时复制 data-src。返回是否已处理。 */
export function handleFormulaCopyClick(target: EventTarget | null): boolean {
  const element = target as Element | null;
  const button = element?.closest?.('.formula-copy-btn') as HTMLButtonElement | null;
  if (!button) return false;

  const source = button.closest('.katex-wrap')?.getAttribute('data-src') ?? '';
  if (source) {
    void copyText(source).then((ok) => {
      if (!ok) return;
      button.classList.add('is-copied');
      window.clearTimeout(Number(button.dataset.copiedTimer ?? 0));
      button.dataset.copiedTimer = String(window.setTimeout(() => {
        button.classList.remove('is-copied');
      }, 1500));
    });
  }
  return true;
}

export function removeFormulaCopyButtons(root: ParentNode): void {
  root.querySelectorAll('.formula-copy-btn').forEach((button) => button.remove());
}

/** 生成 PDF 前去掉按钮，避免按钮被画进 PDF。 */
export function stripFormulaCopyButtons(html: string): string {
  if (!html.includes('formula-copy-btn')) return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  removeFormulaCopyButtons(container);
  return container.innerHTML;
}
