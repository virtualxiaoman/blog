// 搜索匹配公共工具：简单的字符串匹配 + 统一评分，供标题索引（search-index）与正文索引（content-search）复用。
//
// 匹配策略（多个搜索词，空格隔开）：
//   1. 完整匹配优先：整段查询字符串作为子串匹配（text.includes(query)）
//   2. 关键词兜底：按空格拆成关键词，每个关键词都需命中（关键词子串匹配）
// 大小写不敏感：目标文本与查询统一小写。
//
// 评分（一个结果命中的最高档）：
//   标题完整匹配  100
//   正文完整匹配   50
//   标题关键词匹配  30
//   正文关键词匹配  10
// 副标题（分类/文章名等上下文）命中不计入独立评分，仅作为"关键词兜底"的匹配范围。

// 按空格拆关键词（过滤空段），不做语言切分
export function splitKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 匹配判定：目标文本是否命中查询。
// 完整查询作为子串命中，或每个关键词都作为子串命中。
export function matchesQuery(hay: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const text = hay.toLowerCase();
  if (text.includes(q)) return true; // 完整匹配
  const keywords = splitKeywords(q);
  if (!keywords.length) return false;
  return keywords.every((kw) => text.includes(kw)); // 关键词匹配
}

// 结果类型：用于确定评分档位
export type HitLocation = 'title' | 'body';

// 对单个目标计算评分。title 与 body 传入小写或原始文本均可（内部统一小写）。
// 返回：
//   score  — 按评分表取命中的最高档，未命中返回 0
//   full   — 是否为完整匹配（查询整段作为子串命中）
//   matched — 是否命中（完整或关键词）
export interface ScoredHit {
  score: number;
  full: boolean;
  matched: boolean;
}

// 标题命中评分：完整 100，关键词 30，未命中 0。
export function scoreTitle(title: string, query: string): ScoredHit {
  const q = query.trim().toLowerCase();
  const text = title.toLowerCase();
  if (!q) return { score: 0, full: false, matched: false };
  if (text.includes(q)) return { score: 100, full: true, matched: true };
  const keywords = splitKeywords(q);
  if (keywords.length && keywords.every((kw) => text.includes(kw))) {
    return { score: 30, full: false, matched: true };
  }
  return { score: 0, full: false, matched: false };
}

// 正文命中评分：完整 50，关键词 10，未命中 0。
export function scoreBody(body: string, query: string): ScoredHit {
  const q = query.trim().toLowerCase();
  const text = body.toLowerCase();
  if (!q) return { score: 0, full: false, matched: false };
  if (text.includes(q)) return { score: 50, full: true, matched: true };
  const keywords = splitKeywords(q);
  if (keywords.length && keywords.every((kw) => text.includes(kw))) {
    return { score: 10, full: false, matched: true };
  }
  return { score: 0, full: false, matched: false };
}
