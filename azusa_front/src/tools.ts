// 工具注册表：自动扫描 src/views/Tool/tools/<分类>/<工具名>.vue。
// 文件名用英文 slug 作路由路径，界面显示名通过 DISPLAY_NAMES 映射，新增工具只需：
//   1. 在对应分类文件夹放一个 <slug>.vue
//   2. 在 DISPLAY_NAMES 里登记 slug → 中文名
import { defineAsyncComponent, type Component } from 'vue';

const modules = import.meta.glob('./views/Tool/tools/**/*.vue');

// slug（文件名）→ 中文显示名。工具名显示与文件路由（/tool/<分类>/<slug>）解耦。
const DISPLAY_NAMES: Record<string, string> = {
  format: '格式化',
  'text-processor': '文本处理',
  'review-template': '好评模板',
  'color-converter': '颜色转换',
};

export interface ToolInfo {
  category: string; // 分类名，如 coding / daily
  slug: string; // 工具 slug（文件名），如 format
  name: string; // 中文显示名，如 格式化
  path: string; // 路由路径 /tool/<分类>/<slug>
}

// 解析 glob 路径 "./views/Tool/tools/coding/format.vue" → { category, slug }
function parsePath(path: string): ToolInfo | null {
  const m = path.match(/\.\/views\/Tool\/tools\/([^/]+)\/([^/]+)\.vue$/);
  if (!m) return null;
  const [, category, slug] = m;
  return {
    category,
    slug,
    name: DISPLAY_NAMES[slug] ?? slug, // 未登记时退回文件名，保证可用
    path: `/tool/${category}/${slug}`,
  };
}

const tools: ToolInfo[] = Object.keys(modules)
  .map(parsePath)
  .filter((t): t is ToolInfo => t !== null)
  .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'zh'));

// 返回所有分类名（按出现顺序）
export function toolCategoryNames(): string[] {
  const seen: string[] = [];
  for (const t of tools) {
    if (!seen.includes(t.category)) seen.push(t.category);
  }
  return seen;
}

// 返回某分类下的工具列表
export function toolsByCategory(category: string): ToolInfo[] {
  return tools.filter((t) => t.category === category);
}

// 返回全部工具（扁平的 ToolInfo 列表，全局搜索用）
export function allTools(): ToolInfo[] {
  return tools;
}

// 按分类与工具 slug 返回懒加载的异步组件；找不到返回 null
export function loadTool(category: string, slug: string): Component | null {
  const loader = modules[`./views/Tool/tools/${category}/${slug}.vue`];
  if (!loader) return null;
  // 显式取 default 导出（glob 加载器返回模块对象），避免依赖 defineAsyncComponent 的默认解包
  return defineAsyncComponent(() =>
    loader().then((mod) => (mod as { default: Component }).default)
  );
}

// 由分类 + slug 解析中文显示名（面包屑/导航展示用）；未登记时退回 slug
export function toolTitle(category: string, slug: string): string {
  const found = tools.find((t) => t.category === category && t.slug === slug);
  return found?.name ?? slug;
}
