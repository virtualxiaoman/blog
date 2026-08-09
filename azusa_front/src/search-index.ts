// 全局搜索索引：把文章、文章内小节、工具、页面统一成一条条可搜索的记录。
// 数据全部来自 articles.generated.ts（构建时生成）与 tools.ts 注册表，运行时无需网络请求。
import { allSections, type SectionWithArticle } from './articles';
import { allTools, type ToolInfo } from './tools';
import { scoreTitle, matchesQuery } from './utils/searchMatch';

// 一条搜索结果的类型标签
export type SearchType = 'article' | 'section' | 'tool' | 'page' | 'content';

export interface SearchItem {
  type: SearchType;
  title: string; // 主要标题（文章的标题、工具名、页面名）
  subtitle: string; // 副标题（小节所在文章、工具分类、页面说明）
  path: string; // 跳转路由路径
  // 文章内小节定位：目标标题在文章渲染 HTML 中的 data-sec 序号，null 表示整篇文章/整页
  sec: number | null;
  keywords: string; // 参与匹配的关键词（中文原文 + 小写）
}

// 固定页面（非文章、非工具）。当前站点只有首页、文章选择页。
const PAGES: { title: string; subtitle: string; path: string; keywords: string }[] = [
  { title: '首页', subtitle: '博客主页', path: '/', keywords: '首页 主页 home azusa blog' },
  { title: '文章选择', subtitle: '按分类浏览全部文章', path: '/article/choice', keywords: '文章 选择 分类 choice' },
];

// 构建完整索引（模块加载时执行一次）
const INDEX: SearchItem[] = [
  // 文章 + 文章内小节
  ...allSections().map((s: SectionWithArticle) =>
    s.seq === 0
      ? {
          type: 'article' as const,
          title: s.text,
          subtitle: s.category,
          path: s.path,
          sec: null,
          keywords: `${s.text} ${s.category} ${s.article}`,
        }
      : {
          type: 'section' as const,
          title: s.text,
          subtitle: `${s.category} / ${s.article}`,
          path: s.path,
          sec: s.seq,
          keywords: `${s.text} ${s.article} ${s.category}`,
        }
  ),
  // 工具
  ...allTools().map((t: ToolInfo) => ({
    type: 'tool' as const,
    title: t.name,
    subtitle: `工具箱 / ${t.category}`,
    path: t.path,
    sec: null,
    keywords: `${t.name} ${t.category} ${t.slug}`,
  })),
  // 固定页面
  ...PAGES.map((p) => ({
    type: 'page' as const,
    title: p.title,
    subtitle: p.subtitle,
    path: p.path,
    sec: null,
    keywords: p.keywords,
  })),
];

// 匹配打分：一个结果分越高越靠前。采用统一评分表：
//   标题完整匹配  100（查询整段作为子串命中标题）
//   标题关键词匹配  30（空格拆出的关键词全部命中标题）
//   上下文命中   10（标题未命中，但副标题/关键词字段命中——如分类名、文章名）
// 未命中返回 0（不展示）。大小写不敏感。
function score(item: SearchItem, query: string): number {
  const t = scoreTitle(item.title, query);
  if (t.matched) return t.score;
  // 标题未命中：退而求其次匹配副标题/关键词（分类、文章名、slug 等上下文）
  if (matchesQuery(`${item.subtitle} ${item.keywords}`, query)) return 10;
  return 0;
}

// 搜索主入口：返回按相关度排序的结果，最多 limit 条。
// 排序规则：分数高者在前，同分按标题字典序。
export function searchAll(query: string, limit = 20): SearchItem[] {
  const q = query.trim();
  if (!q) return [];
  return INDEX.map((item) => ({ item, score: score(item, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'zh'))
    .slice(0, limit)
    .map((r) => r.item);
}
