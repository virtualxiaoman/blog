// 文本统计工具：文章页字数与「字数统计」工具共用。

// 从源 markdown 剥离语法标记，返回纯正文文本。
// 顺序：代码块/行内代码 → 公式 → HTML → 图片 → 链接(保留文字) → 表格块 → 各级标记。
export function stripMarkdown(md: string): string {
  let text = md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code block
    .replace(/`[^`\n]+`/g, ' ') // 行内代码
    .replace(/\$\$[\s\S]*?\$\$/g, ' ') // 块公式
    .replace(/\$[^$\n]+\$/g, ' ') // 行内公式
    .replace(/<[^>]+>/g, ' ') // HTML 标签
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
    // 表格块：整体剥离（表格是数据展示，不计入叙述性正文的字数）
    .replace(/((?:^\|[^\n]*\n)+)/gm, '\n')
    .replace(/^#{1,6}\s+/gm, '') // 标题
    .replace(/^>\s?/gm, '') // 引用
    .replace(/^[-*+]\s+/gm, '') // 无序列表
    .replace(/^\d+[.、]\s+/gm, '') // 有序列表
    .replace(/\*\*|__|\*|_|~~|`/g, ''); // 强调标记
  return text;
}

// 汉字字符（含扩展区）
const HANZI_RE = /[一-鿿㐀-䶿豈-﫿]/g;
// 英文单词（含连字符/撇号，如 well-known、don't、IPv6）；要求至少含一个字母，纯数字不算单词
const WORD_RE = /(?=.*[A-Za-z])[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;

// 统计纯文本：汉字数 + 英文单词数（一个汉字或一个单词都算 1 个字）
export function countHanzi(text: string): number {
  return text.match(HANZI_RE)?.length ?? 0;
}

export function countWords(text: string): number {
  return text.match(WORD_RE)?.length ?? 0;
}

export interface TextStats {
  chars: number; // 字符数（含空格、标点、换行）
  hanzi: number; // 汉字数
  words: number; // 单词数
  paragraphs: number; // 段落数（非空行分段）
  lines: number; // 行数
  punctuation: number; // 标点符号
  spaces: number; // 空格数
  emoji: number; // 表情符号
}

// 全量统计（供「字数统计」工具使用）
export function analyzeText(text: string): TextStats {
  return {
    chars: Array.from(text).length,
    hanzi: countHanzi(text),
    words: countWords(text),
    paragraphs: text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length,
    lines: text.split(/\n/).length,
    punctuation: (text.match(/[，。！？；：、,.!?;:""''（）()《》<>「」『』【】…—～·]/g) ?? []).length,
    spaces: (text.match(/ /g) ?? []).length,
    emoji: (text.match(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu) ?? []).length,
  };
}
