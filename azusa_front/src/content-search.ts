// 文章正文全文搜索：匹配小节正文，返回命中小节（含匹配上下文）。
// 索引数据在构建时由 scripts/generate-articles.mjs 生成到
// public/article/search/content-index.json（按 /blog/ 部署路径 fetch），首次搜索时懒加载。
import { scoreBody, splitKeywords } from './utils/searchMatch';

// content-index.json 结构：Record<"分类/文章名", { headings: string[], bodies: string[] }>
interface ContentIndexEntry {
  headings: string[];
  bodies: string[];
}
type ContentIndex = Record<string, ContentIndexEntry>;

let indexPromise: Promise<ContentIndex> | null = null;

// 懒加载正文索引（只请求一次，之后缓存）。
// 注意 fetch 相对路径要带 BASE_URL 前缀，才能兼容 GitHub Pages 的 /blog/ 子路径部署。
function loadIndex(): Promise<ContentIndex> {
  if (!indexPromise) {
    indexPromise = fetch(`${import.meta.env.BASE_URL}article/search/content-index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`正文索引加载失败: ${r.status}`);
        return r.json();
      })
      .catch((e) => {
        indexPromise = null; // 失败后允许重试
        throw e;
      });
  }
  return indexPromise;
}

// 一条正文搜索结果。
export interface ContentSearchResult {
  title: string; // 命中小节的标题（如 "1.2 前向传播的计算"）
  article: string; // 文章名
  category: string; // 分类
  path: string; // 文章路由路径
  sec: number; // 命中小节序号（与渲染 data-sec 对齐，1 开始）
  score: number; // 正文评分（完整 50 / 关键词 10）
  snippet: string; // 匹配上下文摘要（含匹配词）
}

// 在正文里定位第一个命中位置：优先完整查询串，其次各关键词。
// 大小写不敏感，返回在 flat（已拍平空白的正文）中的下标，找不到返回 -1。
function findHitPos(flatHay: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return -1;
  const p = flatHay.indexOf(q);
  if (p !== -1) return p;
  for (const kw of splitKeywords(q)) {
    const i = flatHay.indexOf(kw);
    if (i !== -1) return i;
  }
  return -1;
}

// 从正文里截取命中位置附近的上下文片段（前后各留 ~40 字符），
// 供结果列表展示"为什么命中"。找不到命中位置时退回小节开头。
function makeSnippet(body: string, query: string, span = 40): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const pos = findHitPos(flat.toLowerCase(), query);
  if (pos === -1) return flat.slice(0, 80); // 无命中（理论不出现，因为已通过匹配）
  const start = Math.max(0, pos - span);
  const end = Math.min(flat.length, pos + span + 30);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < flat.length ? '…' : '';
  return `${prefix}${flat.slice(start, end)}${suffix}`;
}

// 搜索所有小节正文。只返回"正文命中"的小节（标题命中的小节由 search-index 的标题搜索覆盖）。
// 评分：正文完整匹配 50 / 正文关键词匹配 10。
// 排序与截断：按分数降序，同分保持阅读顺序；每篇文章最多返回 maxPerArticle 条。
export async function searchContent(query: string, maxPerArticle = 20): Promise<ContentSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  let index: ContentIndex;
  try {
    index = await loadIndex();
  } catch {
    return []; // 索引加载失败时正文搜索静默降级（标题搜索仍可用）
  }

  interface Hit {
    result: ContentSearchResult;
  }
  const hits: Hit[] = [];
  for (const [key, entry] of Object.entries(index)) {
    const slash = key.lastIndexOf('/');
    const category = key.slice(0, slash);
    const article = key.slice(slash + 1);
    const path = `/article/${category}/${article}`;

    for (let i = 0; i < entry.headings.length; i++) {
      const title = entry.headings[i];
      const body = entry.bodies[i] ?? '';
      if (!body) continue; // 空正文小节（仅标题命中）交给标题搜索

      // 正文评分：完整 50 / 关键词 10 / 未命中 0
      const s = scoreBody(body, q);
      if (!s.matched) continue;

      hits.push({
        result: {
          title,
          article,
          category,
          path,
          sec: i + 1, // 与渲染 data-sec 对齐
          score: s.score,
          snippet: makeSnippet(body, q),
        },
      });
    }
  }

  // 排序：分数降序；同分按文章 + 小节序号（保持阅读顺序）
  hits.sort((a, b) => {
    if (b.result.score !== a.result.score) return b.result.score - a.result.score;
    return a.result.path.localeCompare(b.result.path, 'zh') || a.result.sec - b.result.sec;
  });

  // 每篇文章最多保留 maxPerArticle 条，避免单一长文刷屏
  const perArticle = new Map<string, number>();
  return hits.filter((h) => {
    const c = perArticle.get(h.result.path) ?? 0;
    if (c >= maxPerArticle) return false;
    perArticle.set(h.result.path, c + 1);
    return true;
  }).map((h) => h.result);
}
