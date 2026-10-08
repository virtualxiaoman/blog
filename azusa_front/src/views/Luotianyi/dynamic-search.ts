// 动态全文搜索：从 DynamicSearchOverlay 抽出的检索逻辑，供统一 Ctrl+K 浮层使用。
// 索引（约 1.2MB）首次搜索时懒加载并缓存；条目预小写化，检索热路径零分配。
import { scoreBodyLower, scoreTitleLower, splitKeywords } from '../../utils/searchMatch';
import { fetchDynamicsSearchIndex, type DynamicSearchEntry } from './dynamics-data';

interface DecoratedEntry {
  entry: DynamicSearchEntry;
  titleLower: string;
  textLower: string;
}

let entriesPromise: Promise<DecoratedEntry[]> | null = null;

function loadEntries(): Promise<DecoratedEntry[]> {
  if (!entriesPromise) {
    entriesPromise = fetchDynamicsSearchIndex()
      .then((list) =>
        list.map((entry) => ({
          entry,
          titleLower: entry.title.toLowerCase(),
          textLower: entry.text.toLowerCase(),
        }))
      )
      .catch((e) => {
        entriesPromise = null; // 失败后允许重试
        throw e;
      });
  }
  return entriesPromise;
}

export interface DynamicSearchHit {
  entry: DynamicSearchEntry;
  score: number;
  snippet: string;
}

const MAX_RESULTS = 50;

// 动态搜索结果：hits 为展示列表（最多 50 条），total 为截断前的真实命中数
export interface DynamicSearchOutcome {
  hits: DynamicSearchHit[];
  total: number;
}

// 搜索动态（标题 + 正文）。索引加载失败时静默返回空结果（与正文搜索的降级策略一致）。
export async function searchDynamics(query: string): Promise<DynamicSearchOutcome> {
  const q = query.trim().toLowerCase();
  if (!q) return { hits: [], total: 0 };
  let entries: DecoratedEntry[];
  try {
    entries = await loadEntries();
  } catch {
    return { hits: [], total: 0 };
  }
  const hits: DynamicSearchHit[] = [];
  for (const d of entries) {
    const score = Math.max(scoreTitleLower(d.titleLower, q).score, scoreBodyLower(d.textLower, q).score);
    if (!score) continue;
    hits.push({ entry: d.entry, score, snippet: makeSnippet(d.entry.text, q) });
  }
  const total = hits.length;
  // 稳定排序：同分保持索引顺序（新动态在前）
  hits.sort((a, b) => b.score - a.score);
  return { hits: hits.slice(0, MAX_RESULTS), total };
}

// 命中位置前后截断的摘要；"为什么命中"一目了然
function makeSnippet(text: string, qLower: string): string {
  const lower = text.toLowerCase();
  let idx = lower.indexOf(qLower);
  let hitLen = qLower.length;
  if (idx < 0) {
    const kw = splitKeywords(qLower).find((k) => lower.includes(k));
    if (!kw) return '';
    idx = lower.indexOf(kw);
    hitLen = kw.length;
  }
  const start = Math.max(0, idx - 24);
  const end = Math.min(text.length, idx + hitLen + 40);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
