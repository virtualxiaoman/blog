/**
 * 把用户笔记里常见的各种公式定界符统一成 $...$ / $$...$$。
 *
 * 支持：
 *   $...$、$$...$$            （保持，仅规整首尾空白）
 *   \(...\)                   → $...$
 *   \[...\]                   → $$...$$
 *   \\...\\ / \\[...\\]       → $$...$$
 *   [公式]                    → $公式$
 *
 * 代码块、行内代码、Markdown 链接/图片/引用式链接/任务列表/脚注保持原样。
 */
export interface NormalizeFormulaResult {
  text: string;
  /** 识别到的公式总数（含本来就是 $ 的）。 */
  formulas: number;
  /** 实际发生定界符转换的数量。 */
  converted: number;
}

export function normalizeFormulaDelimiters(source: string): NormalizeFormulaResult {
  const token = `~!~F${Math.random().toString(36).slice(2)}~!~`;
  const stash: string[] = [];
  const protect = (value: string) => {
    stash.push(value);
    return `${token}${stash.length - 1}${token}`;
  };

  let text = source.replace(/```[\s\S]*?```/g, protect);
  text = text.replace(/~~~[\s\S]*?~~~/g, protect);
  text = text.replace(/`[^`\n]+`/g, protect);

  // 引用式链接 / 脚注的定义 id，避免把 [id] 当成公式
  const refIds = new Set<string>();
  for (const match of text.matchAll(/^[ \t]{0,3}\[([^\]\n]+)\]:/gm)) {
    refIds.add(match[1].trim());
  }

  let formulas = 0;
  let converted = 0;
  const out: string[] = [];
  const n = text.length;
  let i = 0;

  const inline = (inner: string) => {
    formulas += 1;
    return `$${cleanFormulaSource(inner)}$`;
  };
  const display = (inner: string, openStart: number, closeEnd: number) => {
    formulas += 1;
    const body = cleanFormulaSource(inner);
    const block = isStandalone(text, openStart, closeEnd) || body.includes('\n');
    return block ? `$$\n${body}\n$$` : `$$${body}$$`;
  };

  while (i < n) {
    const ch = text[i];

    if (ch === '\\') {
      // \\[公式\\] —— 转义方括号写法的行间公式
      if (text.startsWith('\\\\[', i)) {
        const close = text.indexOf('\\\\]', i + 3);
        if (close !== -1) {
          out.push(display(text.slice(i + 3, close), i, close + 3));
          converted += 1;
          i = close + 3;
          continue;
        }
      }

      // \\(公式\\) —— 双反斜杠包裹的括号定界
      if (text.startsWith('\\\\(', i)) {
        const close = text.indexOf('\\\\)', i + 3);
        if (close !== -1) {
          const body = text.slice(i + 3, close);
          if (body.trim() && !body.includes('\n')) {
            out.push(inline(body));
            converted += 1;
            i = close + 3;
            continue;
          }
        }
      }

      // \\公式\\ —— 双反斜杠定界
      if (text[i + 1] === '\\') {
        if (isDoubleBackslashOpener(text, i)) {
          const close = findDoubleBackslashClose(text, i + 2);
          if (close !== -1) {
            out.push(display(text.slice(i + 2, close), i, close + 2));
            converted += 1;
            i = close + 2;
            continue;
          }
        }
        out.push('\\\\');
        i += 2;
        continue;
      }

      // \(公式\)
      if (text[i + 1] === '(') {
        const close = findUnescaped(text, '\\)', i + 2);
        if (close !== -1) {
          const body = text.slice(i + 2, close);
          if (body.trim() && !body.includes('\n')) {
            out.push(inline(body));
            converted += 1;
            i = close + 2;
            continue;
          }
        }
      }

      // \[公式\]
      if (text[i + 1] === '[') {
        const close = findUnescaped(text, '\\]', i + 2);
        if (close !== -1) {
          out.push(display(text.slice(i + 2, close), i, close + 2));
          converted += 1;
          i = close + 2;
          continue;
        }
      }

      out.push(ch);
      i += 1;
      continue;
    }

    if (ch === '$') {
      if (text[i + 1] === '$') {
        const close = findUnescaped(text, '$$', i + 2);
        if (close !== -1) {
          const body = text.slice(i + 2, close);
          if (body.trim()) {
            out.push(display(body, i, close + 2));
            i = close + 2;
            continue;
          }
        }
      } else {
        const close = findInlineDollarClose(text, i + 1);
        if (close !== -1) {
          const body = text.slice(i + 1, close);
          if (body.trim()) {
            out.push(inline(body));
            i = close + 1;
            continue;
          }
        }
      }
      out.push(ch);
      i += 1;
      continue;
    }

    if (ch === '[') {
      const close = findInlineBracketClose(text, i);
      if (close !== -1) {
        const content = text.slice(i + 1, close);
        const after = text[close + 1];
        const linePrefix = text.slice(text.lastIndexOf('\n', i - 1) + 1, i);
        const isImage = i > 0 && text[i - 1] === '!';

        // [文字](链接) / [文字][引用]
        if (after === '(' || after === '[') {
          let end = close + 1;
          if (after === '(') {
            end = findClosingParen(text, close + 1);
          } else {
            const refClose = text.indexOf(']', close + 2);
            end = refClose === -1 ? close + 1 : refClose + 1;
          }
          out.push(text.slice(i, end));
          i = end;
          continue;
        }

        const isDefinition = after === ':' && /^[ \t]*$/.test(linePrefix);
        const isReference = refIds.has(content.trim());
        const isTocMarker = content.trim().toLowerCase() === 'toc';
        const isTask =
          /^(\s*|x|X|-|✓)$/.test(content) &&
          /^[ \t]*(?:[-*+]\s+|\d+[.)]\s+)$/.test(linePrefix) &&
          (after === undefined || /\s/.test(after));
        const keepAsIs =
          isImage ||
          isDefinition ||
          isReference ||
          isTocMarker ||
          isTask ||
          content.startsWith('^') ||
          /^\d+$/.test(content.trim()) ||
          !content.trim() ||
          content.includes('\n') ||
          content.includes('[') ||
          content.includes(']');

        if (keepAsIs) {
          out.push(text.slice(i, close + 1));
        } else {
          out.push(inline(content));
          converted += 1;
        }
        i = close + 1;
        continue;
      }
    }

    out.push(ch);
    i += 1;
  }

  const restore = new RegExp(`${escapeRegExp(token)}(\\d+)${escapeRegExp(token)}`, 'g');
  const result = out.join('').replace(restore, (_, index: string) => stash[Number(index)] ?? '');
  return { text: result, formulas, converted };
}

/**
 * 清理聊天工具/GPT 输出在公式里残留的 Markdown 转义：
 *   J\_{GRPO} → J_{GRPO}（Markdown 把 _ 转义了，KaTeX 会当成字面下划线）
 *   \\|       → \|       （范数定界符被多转义了一层）
 *   \*        → *        （KaTeX 未定义 \*，多为乘号被 Markdown 转义）
 * \text{...} / \operatorname{...} 等文本命令里的 \_ 是合法字面量，先保护起来。
 */
export function cleanFormulaSource(source: string): string {
  const { text, groups } = protectTextModeGroups(source);
  const cleaned = text
    .replace(/\\_(?=\{|\p{L}|\\|\d)/gu, '_')
    .replace(/\\\\\|/g, '\\|')
    .replace(/\\\*/g, '*');

  return cleaned
    .replace(/\u0000T(\d+)\u0000/g, (_, index: string) => groups[Number(index)] ?? '')
    .trim();
}

const TEXT_MODE_COMMAND = /\\(?:text|textrm|textnormal|textbf|textit|texttt|mbox|operatorname|mathrm)\s*\{/g;

/** 把 \text{...} 等文本模式分组替换成占位符，避免清理 \_ 时误伤合法的字面下划线 */
function protectTextModeGroups(source: string): { text: string; groups: string[] } {
  const groups: string[] = [];
  let result = '';
  let last = 0;

  TEXT_MODE_COMMAND.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TEXT_MODE_COMMAND.exec(source))) {
    const start = match.index;
    const braceStart = start + match[0].length - 1;
    let depth = 0;
    let end = -1;

    for (let i = braceStart; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) continue;

    result += `${source.slice(last, start)}\u0000T${groups.length}\u0000`;
    groups.push(source.slice(start, end + 1));
    last = end + 1;
    TEXT_MODE_COMMAND.lastIndex = end + 1;
  }

  return { text: result + source.slice(last), groups };
}

function isStandalone(text: string, start: number, end: number): boolean {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = text.indexOf('\n', end);
  const before = text.slice(lineStart, start);
  const after = text.slice(end, lineEnd === -1 ? text.length : lineEnd);
  return /^[ \t]*$/.test(before) && /^[ \t]*$/.test(after);
}

function isDoubleBackslashOpener(text: string, index: number): boolean {
  return index === 0 || /\s|[（(【>]/.test(text[index - 1]);
}

function findDoubleBackslashClose(text: string, from: number): number {
  let i = from;
  while (i < text.length - 1) {
    if (text[i] === '\\' && text[i + 1] === '\\') {
      const body = text.slice(from, i);
      const after = text[i + 2];
      const boundary = after === undefined || /[\s，。；：、,.;:!?)\]}>"'”’]/.test(after);
      if (body.trim() && !/\n[ \t]*\n/.test(body) && boundary) return i;
      i += 2;
    } else {
      i += 1;
    }
  }
  return -1;
}

function findUnescaped(text: string, needle: string, from: number): number {
  let index = from;
  for (;;) {
    index = text.indexOf(needle, index);
    if (index === -1) return -1;
    let slashes = 0;
    for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) slashes += 1;
    if (slashes % 2 === 0) return index;
    index += needle.length;
  }
}

function findInlineDollarClose(text: string, from: number): number {
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\n') return -1;
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === '$') {
      if (text[i + 1] === '$') {
        i += 1;
        continue;
      }
      return i;
    }
  }
  return -1;
}

function findInlineBracketClose(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\n') return -1;
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === ']') return i;
  }
  return -1;
}

function findClosingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    } else if (ch === '\n' && depth === 0) {
      return open + 1;
    }
  }
  return open + 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
