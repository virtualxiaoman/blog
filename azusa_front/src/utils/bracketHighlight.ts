/**
 * 括号配对与彩虹层级标记。
 *
 * - 正文、行内代码、代码块、KaTeX 公式中的括号都参与悬停配对高亮；
 * - 只有配对成功的括号才上色，避免出现“有颜色却无法匹配”的括号；
 * - 代码块：嵌套 ≥2 层的括号按层级换色，一层保持原色；
 * - 公式：只有一对括号时保持原色；多对括号时，不嵌套统一用 #66ccff，
 *   有嵌套则从内向外依次使用 红 → 青 → 藕 → 浅蓝 → 粉；
 *   矩阵/分段环境自带的定界符保持原色；
 * - 代码块复用 highlight.js 的词法结果，跳过字符串/注释/正则里的括号。
 */

/** 开括号 → 对应闭括号；竖线类开闭同形，单独按栈顶判断 */
const OPEN_TO_CLOSE: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '（': '）',
  '⟨': '⟩',
  '∣': '∣',
  '|': '|',
  '‖': '‖',
  '∥': '∥',
};

const AMBIGUOUS = new Set(['∣', '|', '‖', '∥']);

/** 正文与代码块参与配对的括号 */
const BASIC_BRACKETS = new Set(['(', ')', '[', ']', '{', '}', '（', '）']);
/** 公式额外支持 \langle、\left|、\Vert 等渲染出的定界符字形 */
const FORMULA_BRACKETS = new Set([...BASIC_BRACKETS, '⟨', '⟩', '∣', '‖', '∥', '|']);

/** 跳过整棵子树：目录、公式（单独处理）、mermaid、复制按钮、SVG 等 */
const ROOT_SKIP =
  '.md-toc, .katex-wrap, .katex-mathml, .mermaid-slot, .mermaid-diagram, .mermaid-error, .code-copy-btn, svg, script, style, textarea, button';

/** highlight.js 已标注的字符串/注释/正则，括号不参与配对与上色 */
const CODE_SKIP = '.hljs-string, .hljs-comment, .hljs-regexp, .hljs-quote, .hljs-doctag';

/** 正文配对的分组边界：括号只在同一段落/列表项/表格单元格内配对 */
const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, td, th, dt, dd, figcaption, blockquote, summary, caption';

/** 参与彩虹配色的层级颜色数量（博客配色中对比度最高的 4 个） */
const COLOR_CLASS_COUNT = 4;
const ACTIVE_CLASS = 'is-bracket-active';
interface BracketEntry {
  el: HTMLElement;
  char: string;
}

interface MatchedPair {
  open: BracketEntry;
  close: BracketEntry;
  depth: number;
}

let pairSeq = 0;

function isBasicBracket(ch: string): boolean {
  return BASIC_BRACKETS.has(ch);
}

function isFormulaBracket(ch: string): boolean {
  return FORMULA_BRACKETS.has(ch);
}

function getGroup(map: Map<Element, BracketEntry[]>, key: Element): BracketEntry[] {
  let list = map.get(key);
  if (!list) {
    list = [];
    map.set(key, list);
  }
  return list;
}

/** 把文本节点里的括号字符拆成独立 span，按文档顺序收集到 entries */
function wrapTextNode(
  node: Text,
  matcher: (ch: string) => boolean,
  entries: BracketEntry[],
): void {
  const text = node.data;
  let frag: DocumentFragment | null = null;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!matcher(ch)) continue;
    if (!frag) frag = document.createDocumentFragment();
    if (i > last) frag.append(text.slice(last, i));
    const span = document.createElement('span');
    span.className = 'md-bracket';
    span.textContent = ch;
    frag.append(span);
    entries.push({ el: span, char: ch });
    last = i + 1;
  }
  if (!frag) return;
  if (last < text.length) frag.append(text.slice(last));
  node.replaceWith(frag);
}

// 代码块按嵌套层级给配对成功的括号上色。
// startDepth 之前（更外层）的括号保持原色：代码块从第 2 层开始。
function colorizePair(pair: MatchedPair, startDepth: number): void {
  if (pair.depth < startDepth) return;
  const level = ((pair.depth - startDepth) % COLOR_CLASS_COUNT) + 1;
  pair.open.el.classList.add(`md-bracket-color-${level}`);
  pair.close.el.classList.add(`md-bracket-color-${level}`);
}

/** 公式配色：不嵌套统一 #66ccff；有嵌套时从内向外依次红、青、藕、浅蓝、粉 */
const FORMULA_NESTED_COLOR_COUNT = 5;

// 矩阵（bmatrix/pmatrix/cases 等）自带的定界符：KaTeX 渲染为
// .minner > .mopen/.mclose + .mord > .mtable，这类括号不上色。
function isMatrixDelimiter(el: HTMLElement): boolean {
  const delimiter = el.closest('.mopen.delimcenter, .mclose.delimcenter');
  if (!delimiter) return false;
  const container = delimiter.parentElement;
  if (!container) return false;
  for (const child of container.children) {
    if (child === delimiter) continue;
    if (child.classList.contains('mord') && child.querySelector(':scope > .mtable')) return true;
  }
  return false;
}

function colorizeFormulaPairs(matched: MatchedPair[]): void {
  const maxDepth = matched.reduce((max, pair) => Math.max(max, pair.depth), 1);
  for (const pair of matched) {
    if (isMatrixDelimiter(pair.open.el)) continue;
    const cls =
      maxDepth <= 1
        ? 'md-bracket-formula-flat'
        : `md-bracket-formula-nested-${((maxDepth - pair.depth) % FORMULA_NESTED_COLOR_COUNT) + 1}`;
    pair.open.el.classList.add(cls);
    pair.close.el.classList.add(cls);
  }
}

function markPair(el: HTMLElement, id: number, unmatched: boolean): void {
  el.dataset.bracketPair = String(id);
  if (unmatched) el.dataset.bracketUnmatched = '1';
}

/**
 * 在一个分组内配对，返回配对成功的括号。
 * allowInterval：公式中的区间写法 (a, b] / [a, b) 允许跨类型配对。
 */
function pairEntries(entries: BracketEntry[], allowInterval = false): MatchedPair[] {
  const stack: { char: string; depth: number; entry: BracketEntry }[] = [];
  const matched: MatchedPair[] = [];

  for (const entry of entries) {
    const { el, char } = entry;
    const closesTopPipe = AMBIGUOUS.has(char) && stack.length > 0 && stack[stack.length - 1].char === char;

    if (char in OPEN_TO_CLOSE && !closesTopPipe) {
      stack.push({ char, depth: stack.length + 1, entry });
      continue;
    }

    // 闭括号：向下找最近的同类开括号（容忍中间未闭合的其它括号）
    let index = -1;
    for (let i = stack.length - 1; i >= 0; i--) {
      const openChar = stack[i].char;
      const intervalPair =
        allowInterval &&
        ((char === ']' && openChar === '(') || (char === ')' && openChar === '['));
      if (OPEN_TO_CLOSE[openChar] === char || intervalPair) {
        index = i;
        break;
      }
    }

    if (index === -1) {
      markPair(el, ++pairSeq, true);
      continue;
    }

    const open = stack[index];
    stack.length = index; // 同时丢弃被跨越的未闭合开括号
    matched.push({ open: open.entry, close: entry, depth: open.depth });
    const id = ++pairSeq;
    markPair(open.entry.el, id, false);
    markPair(el, id, false);
  }

  // 剩下的开括号没有对应闭合，悬停时只高亮自身
  for (const item of stack) markPair(item.entry.el, ++pairSeq, true);
  return matched;
}

/** 收集并包裹某个根节点内的括号文本 */
function collectTextNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

/**
 * 给 root 内的括号加上配对标记与层级类名（就地修改 DOM）。
 * 应在 HTML 渲染完成、mermaid 已渲染之后调用。
 */
export function decorateBrackets(root: HTMLElement): void {
  pairSeq = 0;
  const codeGroups = new Map<Element, BracketEntry[]>();
  const textGroups = new Map<Element, BracketEntry[]>();

  for (const node of collectTextNodes(root)) {
    const parent = node.parentElement;
    if (!parent) continue;
    if (parent.closest(ROOT_SKIP)) continue;

    const code = parent.closest('pre > code');
    if (code) {
      if (parent.closest(CODE_SKIP)) continue;
      wrapTextNode(node, isBasicBracket, getGroup(codeGroups, code));
      continue;
    }

    // 行内代码单独成组，避免与所在段落的括号混配
    const inlineCode = parent.closest('code');
    const block = inlineCode ?? parent.closest(BLOCK_SELECTOR) ?? root;
    wrapTextNode(node, isBasicBracket, getGroup(textGroups, block));
  }

  // 公式：只处理可见的 katex-html 层，MathML 副本保持不动。
  // 整个公式只有一对括号时视为小公式，保持原色；多对括号时从最外层开始上色。
  root.querySelectorAll('.katex-wrap .katex-html').forEach((html) => {
    const entries: BracketEntry[] = [];
    for (const node of collectTextNodes(html)) {
      const parent = node.parentElement;
      if (!parent || parent.closest(CODE_SKIP)) continue;
      wrapTextNode(node, isFormulaBracket, entries);
    }
    const matched = pairEntries(entries, true);
    if (matched.length >= 2) colorizeFormulaPairs(matched);
  });

  // 代码块维持原规则：只有嵌套（≥2 层）的括号才换色
  const codeMatched: MatchedPair[] = [];
  codeGroups.forEach((entries) => codeMatched.push(...pairEntries(entries)));
  codeMatched.forEach((pair) => colorizePair(pair, 2));

  textGroups.forEach((entries) => pairEntries(entries));
}

/** 悬停时给同一配对的两个括号加高亮类；无配对时只高亮自身 */
export function highlightBracketPair(root: HTMLElement, target: EventTarget | null): void {
  const candidate = (target as Element | null)?.closest?.('.md-bracket[data-bracket-pair]');
  if (!candidate) return;
  const id = candidate.getAttribute('data-bracket-pair');
  if (!id) return;
  root.querySelectorAll(`.md-bracket[data-bracket-pair="${id}"]`).forEach((el) => {
    el.classList.add(ACTIVE_CLASS);
  });
}

export function clearBracketHighlight(root: HTMLElement, target: EventTarget | null): void {
  const candidate = (target as Element | null)?.closest?.('.md-bracket[data-bracket-pair]');
  if (!candidate) return;
  root.querySelectorAll(`.md-bracket.${ACTIVE_CLASS}`).forEach((el) => {
    el.classList.remove(ACTIVE_CLASS);
  });
}
