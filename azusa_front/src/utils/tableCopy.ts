import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { copyText } from './clipboard';
import { showCodeCopied } from './codeCopy';

const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
  '<path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';

function hasUnescapedPipe(line: string): boolean {
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '\\') {
      i += 1;
      continue;
    }
    if (line[i] === '|') return true;
  }
  return false;
}

// 按未转义的 | 拆分单元格；单元格内的 \| 保留原样
function splitCells(row: string): string[] {
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (ch === '\\' && row[i + 1] === '|') {
      current += '\\|';
      i += 1;
      continue;
    }
    if (ch === '|') {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

function stripOuterPipes(row: string): { leading: boolean; trailing: boolean; inner: string } {
  let inner = row.trim();
  const leading = inner.startsWith('|');
  if (leading) inner = inner.slice(1);
  const trailing = inner.endsWith('|');
  if (trailing) inner = inner.slice(0, -1);
  return { leading, trailing, inner };
}

function isDelimiterRow(line: string): boolean {
  if (!hasUnescapedPipe(line)) return false;
  const cells = splitCells(stripOuterPipes(line).inner).map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

// 单元格左右各保留一个空格：| a | b |，去掉对齐用的多余空格
function normalizeRow(row: string): string {
  const { leading, trailing, inner } = stripOuterPipes(row);
  const body = splitCells(inner).map((cell) => cell.trim()).join(' | ');
  return `${leading ? '| ' : ''}${body}${trailing ? ' |' : ''}`;
}

/**
 * 把 Markdown 中表格行的单元格空格统一为左右各一个。
 * 只处理“表头 + 分隔行”开头、且不在代码围栏内的连续表格行，避免误伤普通文本。
 */
export function normalizeMarkdownTableSpacing(markdown: string): string {
  if (!markdown.includes('|')) return markdown;

  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const lines = markdown.split(/\r?\n/);
  let fence: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    if (i === 0 || !isDelimiterRow(line) || !hasUnescapedPipe(lines[i - 1])) continue;

    lines[i - 1] = normalizeRow(lines[i - 1]);
    lines[i] = normalizeRow(line);
    let j = i + 1;
    while (j < lines.length && lines[j].trim() && hasUnescapedPipe(lines[j])) {
      lines[j] = normalizeRow(lines[j]);
      j += 1;
    }
  }

  return lines.join(eol);
}

// 单元格内容里的 | 会截断 Markdown 表格，统一转义为 \|（已转义的保持不变）
function escapeCellPipes(content: string): string {
  let out = '';
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '\\' && content[i + 1] === '|') {
      out += '\\|';
      i += 1;
      continue;
    }
    out += ch === '|' ? '\\|' : ch;
  }
  return out;
}

let converter: TurndownService | null = null;

function getConverter(): TurndownService {
  if (converter) return converter;
  converter = new TurndownService({
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    headingStyle: 'atx',
    emDelimiter: '*',
    strongDelimiter: '**',
  });
  converter.use(gfm);
  // 公式用 data-src 还原为 $...$ 源码，避免复制出 MathML 与 HTML 两份文本
  converter.addRule('katex', {
    filter: (node: HTMLElement) => node.nodeName === 'SPAN' && node.classList.contains('katex-wrap'),
    replacement: (_content: string, node: HTMLElement) => node.getAttribute('data-src') || '',
  });
  // 覆盖 gfm 的单元格规则：转义内容中的竖线，避免复制出的表格多出列
  converter.addRule('tableCellEscape', {
    filter: ['th', 'td'],
    replacement: (content: string, node: HTMLElement) => {
      const index = Array.prototype.indexOf.call(node.parentNode?.childNodes ?? [], node);
      const prefix = index === 0 ? '| ' : ' ';
      return `${prefix}${escapeCellPipes(content)} |`;
    },
  });
  return converter;
}

/** 把渲染后的 table 转成 Markdown 表格，单元格左右各一个空格。 */
export function tableToMarkdown(table: Element): string {
  const clone = table.cloneNode(true) as Element;
  clone.querySelectorAll('.code-copy-btn, .formula-copy-btn, .table-copy-btn').forEach((button) => button.remove());
  clone.querySelectorAll('code .katex-wrap').forEach((el) => {
    el.replaceWith(el.getAttribute('data-src') ?? '');
  });
  const markdown = getConverter().turndown(clone.outerHTML).trim();
  return normalizeMarkdownTableSpacing(markdown);
}

/** 表格右上角的复制按钮（点击逻辑走内容区域事件委托）。 */
export function createTableCopyButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'table-copy-btn';
  button.title = '复制表格';
  button.setAttribute('aria-label', '复制表格');
  button.innerHTML = COPY_ICON;
  return button;
}

/** 内容区域点击委托：命中表格复制按钮时复制整张表格为 Markdown。返回是否已处理。 */
export function handleTableCopyClick(target: EventTarget | null): boolean {
  const button = (target as Element | null)?.closest?.('.table-copy-btn') as HTMLElement | null;
  if (!button) return false;

  const table = button.closest('.table-wrap')?.querySelector('table');
  const markdown = table ? tableToMarkdown(table) : '';
  if (markdown) {
    void copyText(markdown).then((ok) => {
      if (ok) showCodeCopied(button);
    });
  }
  return true;
}

export function removeTableCopyButtons(root: ParentNode): void {
  root.querySelectorAll('.table-copy-btn').forEach((button) => button.remove());
}

/** 生成 PDF 前去掉按钮，避免被画进 PDF。 */
export function stripTableCopyButtons(html: string): string {
  if (!html.includes('table-copy-btn')) return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  removeTableCopyButtons(container);
  return container.innerHTML;
}
