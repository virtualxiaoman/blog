// 文章正文全文搜索：匹配小节正文，返回命中小节（含匹配上下文）。
// 索引数据在构建时由 scripts/generate-articles.mjs 生成到
// public/article/search/content-index.json（按 /blog/ 部署路径 fetch），首次搜索时懒加载。
import { scoreBodyLower, splitKeywords } from './utils/searchMatch';
import type { ScopeFilter } from './search-scope';

// content-index.json 结构：Record<"分类/文章名", { headings: string[], bodies: string[] }>
interface ContentIndexEntry {
  headings: string[];
  bodies: string[];
}
type ContentIndex = Record<string, ContentIndexEntry>;

// 加载后一次性预处理：拍平空白（flats，供摘要截取）并预存小写文本（flatsLower），
// 之后每次搜索不再对全语料重复 replace/toLowerCase——匹配阶段零分配。
interface PreparedEntry {
  headings: string[];
  flats: string[];
  flatsLower: string[];
}
type PreparedIndex = Record<string, PreparedEntry>;

function prepare(index: ContentIndex): PreparedIndex {
  const out: PreparedIndex = {};
  for (const [key, entry] of Object.entries(index)) {
    const flats = entry.bodies.map((b) => b.replace(/\s+/g, ' ').trim());
    out[key] = {
      headings: entry.headings,
      flats,
      flatsLower: flats.map((f) => f.toLowerCase()),
    };
  }
  return out;
}

let indexPromise: Promise<PreparedIndex> | null = null;

// 懒加载正文索引（只请求一次，之后缓存）。
// 注意 fetch 相对路径要带 BASE_URL 前缀，才能兼容 GitHub Pages 的 /blog/ 子路径部署。
function loadIndex(): Promise<PreparedIndex> {
  if (!indexPromise) {
    indexPromise = fetch(`${import.meta.env.BASE_URL}article/search/content-index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`正文索引加载失败: ${r.status}`);
        return r.json() as Promise<ContentIndex>;
      })
      .then(prepare)
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
// 入参均已小写（flatLower 来自索引预处理，queryLower 在搜索入口统一小写一次），
// 返回在拍平正文中的下标，找不到返回 -1。
function findHitPos(flatLower: string, queryLower: string): number {
  if (!queryLower) return -1;
  const p = flatLower.indexOf(queryLower);
  if (p !== -1) return p;
  for (const kw of splitKeywords(queryLower)) {
    const i = flatLower.indexOf(kw);
    if (i !== -1) return i;
  }
  return -1;
}

// 从拍平正文里截取命中位置附近的上下文片段（前后各留 ~40 字符，命中词后再多留 30 字符
// 保证匹配词完整展示），供结果列表展示"为什么命中"。找不到命中位置时退回小节开头。
function makeSnippet(flat: string, flatLower: string, queryLower: string, span = 40): string {
  if (!flat) return '';
  const pos = findHitPos(flatLower, queryLower);
  if (pos === -1) return flat.slice(0, 80); // 无命中（理论不出现，因为已通过匹配）
  const start = Math.max(0, pos - span);
  const end = Math.min(flat.length, pos + span + 30);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < flat.length ? '…' : '';
  return `${prefix}${flat.slice(start, end)}${suffix}`;
}

// 正文搜索结果：results 为按 maxPerArticle 截断后的展示列表，total 为截断前的真实命中数
export interface ContentSearchOutcome {
  results: ContentSearchResult[];
  total: number;
}

// 搜索所有小节正文。只返回"正文命中"的小节（标题命中的小节由 search-index 的标题搜索覆盖）。
// 评分：正文完整匹配 50 / 正文关键词匹配 10。
// 排序与截断：按分数降序，同分保持阅读顺序；每篇文章最多返回 maxPerArticle 条。
// filter 限定搜索范围（不传则全量），索引 key（"分类/文章名"）与范围过滤的文章 key 对齐。
export async function searchContent(
  query: string,
  maxPerArticle = 20,
  filter?: ScopeFilter
): Promise<ContentSearchOutcome> {
  const q = query.trim().toLowerCase();
  if (!q) return { results: [], total: 0 };
  let index: PreparedIndex;
  try {
    index = await loadIndex();
  } catch {
    return { results: [], total: 0 }; // 索引加载失败时正文搜索静默降级（标题搜索仍可用）
  }

  interface Hit {
    result: ContentSearchResult;
  }
  const hits: Hit[] = [];
  for (const [key, entry] of Object.entries(index)) {
    if (filter && !filter.articles.has(key)) continue;
    const slash = key.lastIndexOf('/');
    const category = key.slice(0, slash);
    const article = key.slice(slash + 1);
    const path = `/article/${category}/${article}`;

    for (let i = 0; i < entry.headings.length; i++) {
      const title = entry.headings[i];
      const flatLower = entry.flatsLower[i] ?? '';
      if (!flatLower) continue; // 空正文小节（仅标题命中）交给标题搜索

      // 正文评分：完整 50 / 关键词 10 / 未命中 0
      const s = scoreBodyLower(flatLower, q);
      if (!s.matched) continue;

      hits.push({
        result: {
          title,
          article,
          category,
          path,
          sec: i + 1, // 与渲染 data-sec 对齐
          score: s.score,
          snippet: makeSnippet(entry.flats[i], flatLower, q),
        },
      });
    }
  }

  // 排序：分数降序；同分按文章 + 小节序号（保持阅读顺序）
  hits.sort((a, b) => {
    if (b.result.score !== a.result.score) return b.result.score - a.result.score;
    return a.result.path.localeCompare(b.result.path, 'zh') || a.result.sec - b.result.sec;
  });
  const total = hits.length;

  // 每篇文章最多保留 maxPerArticle 条，避免单一长文刷屏
  const perArticle = new Map<string, number>();
  const results = hits
    .filter((h) => {
      const c = perArticle.get(h.result.path) ?? 0;
      if (c >= maxPerArticle) return false;
      perArticle.set(h.result.path, c + 1);
      return true;
    })
    .map((h) => h.result);
  return { results, total };
}
