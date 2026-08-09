// 自动扫描 public/article/md 目录，生成文章数据源 src/articles.generated.ts。
// 新增文章只需把 .md 放进 public/article/md/<分类>/，运行 dev/build 时自动重新生成。
// 封面：优先用 public/article/cover/<文章名>.<ext>（任意图片扩展名），否则用 default.png。
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mdDir = join(root, 'public', 'article', 'md');
const coverDir = join(root, 'public', 'article', 'cover');

// 封面允许的扩展名（按优先级），与 cover 目录里实际存在的文件匹配
const COVER_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const DEFAULT_COVER = 'default.png';

// 排除的非文章文件（大小写不敏感）：README 是站主说明，不是文章
const IGNORED = ['readme']; // 不含 .md 后缀的文章名

// 手动排序表：key 是分类名，value 是期望的文章显示顺序（文章名，不含 .md 后缀）。
// 没列到的文章自动按字典序排在已列出的之后。新增文章想固定位置就加进来，否则自动追加。
const ARTICLE_ORDER = {
  AI: ['深度学习', '机器学习', '论文阅读', '深度学习实践', '机器学习实践', '推荐系统', '自然语言处理', '强化学习', '扩散模型', '计算机视觉'],
};

function scanCovers() {
  if (!existsSync(coverDir)) return [];
  return readdirSync(coverDir).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
}

// 返回文章名对应的封面文件名；找不到时返回 null（由调用方用 default.png 兜底）
function coverFor(name, coverFiles) {
  for (const ext of COVER_EXTS) {
    const f = `${name}.${ext}`;
    if (coverFiles.includes(f)) return f;
  }
  return null;
}

// 去掉标题文本里残留在行的 KaTeX 源码标记，得到干净的标题文字（用于搜索索引匹配与显示）。
// 例："# $\color{66ccff} 1.1\ 技术架构 $" → "1.1 技术架构"。
// 处理顺序：
//   1. \color{a}{b} → b（带第二参数的花括号形式）
//   2. \color{a}     → 去掉（只剩一个参数的旧写法）
//   3. $             → 去掉（公式定界符）
//   4. \             → 空格（LaTeX 空格命令，如 "1.\ 简介"）
//   5. 折叠连续空白
function stripTitleFormatting(text) {
  let cleaned = text.replace(/\\color\{[^}]*\}\{([^}]*)\}/g, '$1');
  cleaned = cleaned.replace(/\\color\{[^}]*\}/g, '');
  cleaned = cleaned.replace(/\$/g, '');
  cleaned = cleaned.replace(/\\ /g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
}

// 解析 markdown 文本里的标题，返回 [{ level, text }]，用于全局搜索的文章内小节索引。
// 支持两种形式：
//   1. ATX 标题 "#/##/###..."：必须跳过 fenced code block（```...```）里的行——
//      其中的 "# 注释" 不是标题，否则与渲染管线（marked 把代码块渲染成 <pre><code>，
//      不产生 h 标签）的标题序号会错位。
//   2. 原生 HTML 标题 "<h3>文本</h3>"：marked 原样保留，同样会经 generate_h_id 处理，
//      如 git.md 的 "<h3>git常用操作命令：</h3>"。
// 与渲染管线 generate_h_id + autoNumberHeadings 对应：渲染后标题带 id（data-sec 序号），
// 无序号标题会自动补 "1. " 前缀，因此这里对无序号标题做相同的补号。
function extractHeadings(md) {
  const counters = [0, 0, 0, 0, 0, 0, 0];
  const orderedRe =
    /^\s*(\d+(?:[.．]\d+)*[.．]?\s+|\d+[、.]\s*|[一二三四五六七八九十]+[、.]\s*|第[一二三四五六七八九十百千]+[章节篇]\s+)/;
  const headings = [];
  let inFence = false;
  for (const raw of md.split('\n')) {
    // fenced code block 开关（``` 或 ~~~ 围栏），代码块内不做标题解析
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // 原生 HTML 标题：<h3>文本</h3>（无属性形式，与渲染管线 generate_h_id 的匹配一致）
    let level = 0;
    let content = '';
    const htmlM = raw.match(/^\s*<h([1-6])>([\s\S]*?)<\/h\1>\s*$/);
    if (htmlM) {
      level = Number(htmlM[1]);
      content = htmlM[2];
    } else {
      // ATX 标题：# 标题
      const atxM = raw.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (atxM) {
        level = atxM[1].length;
        content = atxM[2];
      }
    }
    if (!level) continue;

    let text = stripTitleFormatting(content);

    // 与渲染一致：已有序号保留，无序号自动补层级式序号
    if (!orderedRe.test(text)) {
      counters[level]++;
      for (let l = level + 1; l <= 6; l++) counters[l] = 0;
      const parts = [];
      for (let l = 1; l <= level; l++) {
        if (counters[l] > 0) parts.push(String(counters[l]));
      }
      const prefix = parts.join('.') + (parts.length === 1 ? '. ' : ' ');
      text = prefix + text;
    }

    headings.push({ level, text });
  }
  return headings;
}

// 返回文章名对应的小节标题列表；解析失败时返回空数组
function headingsFor(name, dir) {
  try {
    const md = readFileSync(join(dir, `${name}.md`), 'utf8');
    return extractHeadings(md);
  } catch {
    return [];
  }
}

// 把一行 markdown 正文剥离成纯文本（只去行内语法，不折叠空白——保留原始阅读内容）。
// 覆盖面与浏览器 Ctrl+F（作用于渲染后 DOM 可见文本）对齐：
//   - 表格行：去掉 | 分隔符，保留单元格文字（表格里的术语/参数也可搜索）
//   - 图片：保留 alt 文字 + 文件路径（如 transformer.png）
//   - 链接：保留文字 + URL（URL 里的关键词也可能被搜索）
//   - 行内代码/公式：保留内容删定界符
//   - HTML 标签：去掉
function stripInline(mdLine) {
  // 表格行（| a | b |）：保留单元格文字，去掉 | 分隔符
  if (/^\s*\|.*\|\s*$/.test(mdLine)) {
    return mdLine
      .replace(/^\s*\||\|\s*$/g, '') // 首尾 |
      .split('|').map((s) => s.trim()).filter(Boolean).join(' ')
      .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2') // 图片 alt + 路径
      .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2') // 链接文字 + URL
      .replace(/`([^`\n]+)`/g, '$1') // 行内代码
      .replace(/\$([^$\n]+)\$/g, '$1') // 行内公式
      .replace(/\s+/g, ' ');
  }
  return mdLine
    // HTML img 标签：保留 src 路径（如 assets/.../transformer.png），Ctrl+F 能搜到它
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '$1')
    .replace(/<[^>]+>/g, ' ') // 其余 HTML 标签
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2') // 图片：alt + 路径
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2') // 链接：文字 + URL
    .replace(/`([^`\n]+)`/g, '$1') // 行内代码：保留内容
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1') // 块公式：保留源码
    .replace(/\$([^$\n]+)\$/g, '$1') // 行内公式：保留源码
    .replace(/\*\*|__|\*|_|~~/g, '') // 强调标记
    .replace(/^\s*[-*+]\s+/, '') // 列表项前缀
    .replace(/^\s*\d+[.、]\s+/, '') // 有序列表项前缀
    .replace(/^>\s?/, '') // 引用前缀
    .replace(/\s+/g, ' '); // 行内空白折叠（去 markdown 缩进与多余空格）
}

// 把整篇文章按标题切成小节正文，返回与 extractHeadings 输出**严格等长**的字符串数组：
//   bodies[i] 属于 headings[i]（即第 i+1 个标题到第 i+2 个标题之前的内容）。
// 关键：
//   1. 文首标题之前的序言**并入第一块**（如文章简介里的关键词也可搜索），
//      不与 extractHeadings 错位——序言仍归第 1 个标题的小节。
//   2. 最后一个标题到文末的内容并入最后一块（与 data-sec 序号精确对齐，bodies.length === headings.length）。
//   3. fenced code block 内容**保留**（代码里的注释/字符串是可搜索文本，与浏览器 Ctrl+F 行为一致），
//      只去掉围栏标记本身。
function extractSectionBodies(md) {
  const lines = md.split('\n');
  const bodies = [];
  let cur = [];
  let inFence = false;
  let started = false; // 是否已遇到第一个标题

  const flush = () => {
    bodies.push(cur.join('\n').trim());
    cur = [];
  };
  const isHeadingLine = (raw) => {
    if (/^\s*<h[1-6]>[\s\S]*?<\/h[1-6]>\s*$/.test(raw)) return true;
    return /^#{1,6}\s+/.test(raw);
  };

  for (const raw of lines) {
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      cur.push(''); // 代码块边界处留空行分隔
      continue;
    }
    if (inFence) {
      cur.push(raw); // 代码块内容保留（可搜索）；围栏内的行不可能是标题
      continue;
    }
    if (isHeadingLine(raw)) {
      if (started) flush(); // 遇到后续标题：上一段内容（序言或上一小节）收尾
      started = true;
      continue; // 标题行本身不进正文
    }

    // 首个标题之前的序言也收集进 cur，随第一块（第 1 个标题的小节）一起输出
    if (!raw.trim()) {
      cur.push(''); // 空行保留为段落分隔
    } else {
      const cleaned = stripInline(raw);
      if (cleaned) cur.push(cleaned);
    }
  }
  flush(); // 最后一节（到文末）

  return bodies;
}

// 生成正文搜索索引文件（public/article/search/content-index.json）。
// 结构：Record<"分类/文章名", { headings: string[], bodies: string[] }>
//  - headings[i] 对应小节标题文本，bodies[i] 对应小节正文
//  - headings.length === bodies.length === 渲染的 data-sec 标题数，正文命中后可精确跳到对应小节
// 独立静态文件、运行时懒加载，避免把 ~220KB 正文打进 JS bundle 拖慢首屏。
function writeContentIndex(categories) {
  const searchDir = join(root, 'public', 'article', 'search');
  mkdirSync(searchDir, { recursive: true });
  const index = {};

  for (const [category, articles] of Object.entries(categories)) {
    const dir = join(mdDir, category);
    for (const a of articles) {
      const key = `${category}/${a.name}`;
      const md = readFileSync(join(dir, `${a.name}.md`), 'utf8');
      const headings = extractHeadings(md);
      const bodies = extractSectionBodies(md);
      if (bodies.length !== headings.length) {
        throw new Error(`[generate-articles] ${key}: 正文块 ${bodies.length} 个，标题 ${headings.length} 个，索引结构错位`);
      }
      index[key] = {
        headings: headings.map((h) => h.text),
        bodies,
      };
    }
  }

  const out = JSON.stringify(index);
  const outFile = join(searchDir, 'content-index.json');
  writeFileSync(outFile, out, 'utf8');
  console.log(`[generate-articles] 已生成 ${outFile}：${Object.keys(index).length} 篇，${(Buffer.byteLength(out, 'utf8') / 1024).toFixed(0)} KB`);
}

// 返回文章名的排序权重：手动排序表里靠前，未列出的按字典序排在后面
function sortNames(names, category) {
  const order = ARTICLE_ORDER[category] ?? [];
  const indexOf = (name) => {
    const i = order.indexOf(name);
    return i === -1 ? order.length + 1 : i;
  };
  // 已列出的按手动顺序，未列出的按字典序排在其后
  return names
    .map((name) => ({ name, key: indexOf(name) }))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key - b.key;
      return a.name.localeCompare(b.name, 'zh');
    })
    .map(({ name }) => name);
}

function main() {
  if (!existsSync(mdDir)) {
    console.warn('[generate-articles] 未找到 public/article/md 目录，跳过生成');
    return;
  }
  const coverFiles = scanCovers();
  const categories = {};

  for (const category of readdirSync(mdDir)) {
    const dir = join(mdDir, category);
    if (!existsSync(dir)) continue;
    if (!statSync(dir).isDirectory()) continue;
    const names = sortNames(
      readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.slice(0, -3))
        .filter((name) => !IGNORED.includes(name.toLowerCase())),
      category
    );
    if (names.length > 0) {
      categories[category] = names.map((name) => ({
        name,
        cover: coverFor(name, coverFiles),
        headings: headingsFor(name, dir), // 小节标题，供全局搜索的"文章内区域"索引
      }));
    }
  }

  const out = `// 本文件由 scripts/generate-articles.mjs 自动生成，请勿手动编辑。
// 数据源：public/article/md/<分类>/<文章名>.md + public/article/cover/
export interface ArticleSection {
  level: number; // 标题层级 1~6
  text: string; // 标题文本（已去掉 KaTeX 颜色标记与 $ 定界符，无序号标题已补层级序号）
}

export interface ArticleInfo {
  name: string;
  cover: string | null; // 封面文件名，null 表示用默认占位图
  headings: ArticleSection[]; // 小节标题列表，供全局搜索的"文章内区域"索引
}

export const articleCategories: Record<string, ArticleInfo[]> = ${JSON.stringify(categories, null, 2)};
`;
  const outFile = join(root, 'src', 'articles.generated.ts');
  writeFileSync(outFile, out);
  const count = Object.values(categories).reduce((n, a) => n + a.length, 0);
  console.log(`[generate-articles] 已生成 ${outFile}：${Object.keys(categories).length} 个分类，${count} 篇文章`);
  writeContentIndex(categories); // 生成正文搜索索引（懒加载，不进入 JS bundle）
}

main();
