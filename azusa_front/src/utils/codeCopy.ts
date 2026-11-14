import { copyText } from './clipboard';

/** 代码块复制：把 KaTeX 渲染结果还原成源码，避免复制出 MathML/HTML 两份文本。 */
export function getCodeSource(code: Element): string {
  const clone = code.cloneNode(true) as Element;
  clone.querySelectorAll('.code-katex').forEach((el) => {
    el.replaceWith(el.getAttribute('data-src') ?? '');
  });
  return clone.textContent ?? '';
}

export function showCodeCopied(button: HTMLElement): void {
  const original = button.innerHTML;
  button.classList.add('is-copied');
  button.textContent = '已复制';
  window.setTimeout(() => {
    button.classList.remove('is-copied');
    button.innerHTML = original;
  }, 1500);
}

/** 内容区域点击委托：命中代码复制按钮时复制整个代码块。返回是否已处理。 */
export function handleCodeCopyClick(target: EventTarget | null): boolean {
  const element = target as Element | null;
  const button = element?.closest?.('.code-copy-btn') as HTMLElement | null;
  if (!button) return false;

  const pre = button.closest('pre');
  const code = pre?.querySelector('code');
  if (pre && code) {
    copyText(getCodeSource(code));
    showCodeCopied(button);
  }
  return true;
}

export function removeCodeCopyButtons(root: ParentNode): void {
  root.querySelectorAll('.code-copy-btn').forEach((button) => button.remove());
}

export function stripCodeCopyButtons(html: string): string {
  if (!html.includes('code-copy-btn')) return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  removeCodeCopyButtons(container);
  return container.innerHTML;
}
