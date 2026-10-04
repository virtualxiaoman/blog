// 搜索范围模型：Ctrl+K 浮层的"范围"勾选树。
//
// 树结构：全部内容 → 博客内容 →（文章 → 分类 → 篇 / 工具箱 / 页面），以及洛天依 →（动态）。
// 洛天依板块下目前只有"动态"支持搜索，单独分组是为后续增加可搜索板块留出结构。
// 选择状态用"已勾选叶子 id 的集合"表示（叶子 = 单篇文章、工具箱、页面、动态），
// 父级三态由后代叶子推导；搜索过滤条件（ScopeFilter）由叶子集合导出。
import { articlesByCategory, categoryNames } from './articles';
import { allTools } from './tools';
import { PAGES } from './search-index';

export interface ScopeTreeNode {
  id: string;
  label: string;
  count?: number; // 子树内条数（文章篇数 / 工具个数 / 页面个数），洛天依动态为 undefined（索引未加载时不统计）
  unit?: string; // 数量单位（篇 / 个）
  children?: ScopeTreeNode[];
}

export const TOOLS_LEAF = 'tools';
export const PAGES_LEAF = 'pages';
export const DYNAMICS_LEAF = 'dynamics';

const articleLeafId = (category: string, name: string) => `art:${category}/${name}`;

function buildTree(): ScopeTreeNode {
  const categories: ScopeTreeNode[] = categoryNames().map((cat) => {
    const articles = articlesByCategory(cat);
    return {
      id: `cat:${cat}`,
      label: cat,
      count: articles.length,
      unit: '篇',
      children: articles.map((a) => ({ id: articleLeafId(cat, a.name), label: a.name })),
    };
  });
  const articleCount = categories.reduce((n, c) => n + (c.count ?? 0), 0);
  return {
    id: 'all',
    label: '全部内容',
    children: [
      {
        id: 'blog',
        label: '博客内容',
        children: [
          { id: 'articles', label: '文章', count: articleCount, unit: '篇', children: categories },
          { id: TOOLS_LEAF, label: '工具箱', count: allTools().length, unit: '个' },
          { id: PAGES_LEAF, label: '页面', count: PAGES.length, unit: '个' },
        ],
      },
      {
        id: 'lty',
        label: '洛天依',
        children: [{ id: DYNAMICS_LEAF, label: '动态' }],
      },
    ],
  };
}

export const SCOPE_TREE: ScopeTreeNode = buildTree();

function findNode(id: string, node: ScopeTreeNode = SCOPE_TREE): ScopeTreeNode | null {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(id, child);
    if (found) return found;
  }
  return null;
}

function leavesOf(node: ScopeTreeNode): string[] {
  if (!node.children) return [node.id];
  return node.children.flatMap(leavesOf);
}

// 展平为 [节点, 缩进层级] 列表，供下拉树直接渲染
export function scopeTreeRows(): { node: ScopeTreeNode; depth: number }[] {
  const rows: { node: ScopeTreeNode; depth: number }[] = [];
  const walk = (node: ScopeTreeNode, depth: number) => {
    rows.push({ node, depth });
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(SCOPE_TREE, 0);
  return rows;
}

export type NodeState = 'all' | 'partial' | 'none';

export function nodeState(node: ScopeTreeNode, selected: ReadonlySet<string>): NodeState {
  const leaves = leavesOf(node);
  let hit = 0;
  for (const leaf of leaves) if (selected.has(leaf)) hit++;
  return hit === 0 ? 'none' : hit === leaves.length ? 'all' : 'partial';
}

// 勾选/取消一个节点：整棵子树全选或全不选
export function toggleNode(node: ScopeTreeNode, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  const state = nodeState(node, selected);
  for (const leaf of leavesOf(node)) {
    if (state === 'all') next.delete(leaf);
    else next.add(leaf);
  }
  return next;
}

export function allScope(): Set<string> {
  return new Set(leavesOf(SCOPE_TREE));
}

// 默认范围：非动态界面 = 博客内容整棵子树；动态界面 = 仅洛天依动态（树中 洛天依 → 动态）
export function defaultBlogScope(): Set<string> {
  return new Set(leavesOf(findNode('blog')!));
}

export function defaultDynamicScope(): Set<string> {
  return new Set([DYNAMICS_LEAF]);
}

export function isSameScope(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

export function isEmptyScope(selected: ReadonlySet<string>): boolean {
  return selected.size === 0;
}

// 搜索过滤条件：由勾选叶子集合派生的扁平判断依据
export interface ScopeFilter {
  articles: ReadonlySet<string>; // 允许的文章 key（"分类/文章名"）
  tools: boolean;
  pages: boolean;
  dynamics: boolean;
}

export function toScopeFilter(selected: ReadonlySet<string>): ScopeFilter {
  const articles = new Set<string>();
  for (const id of selected) {
    if (id.startsWith('art:')) articles.add(id.slice(4));
  }
  return {
    articles,
    tools: selected.has(TOOLS_LEAF),
    pages: selected.has(PAGES_LEAF),
    dynamics: selected.has(DYNAMICS_LEAF),
  };
}

// 范围摘要（chip 文案）：把勾选状态概括成最高层级的选择描述。
// 全选 → "全部内容"；博客内容整体勾选 → "博客内容"；部分选择则向下展开到分类/篇名。
// 例："AI、工具箱"、"AI、经验贴 等 3 项"。
function describe(node: ScopeTreeNode, selected: ReadonlySet<string>): string[] {
  const state = nodeState(node, selected);
  if (state === 'all') return [node.label];
  if (state === 'none') return [];
  return (node.children ?? []).flatMap((child) => describe(child, selected));
}

export function scopeSummary(selected: ReadonlySet<string>): string {
  if (isEmptyScope(selected)) return '未选择';
  const labels = describe(SCOPE_TREE, selected);
  if (labels.length <= 2) return labels.join('、');
  return `${labels[0]}、${labels[1]} 等 ${labels.length} 项`;
}
