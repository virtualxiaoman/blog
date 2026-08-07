// 工具注册表：自动扫描 src/views/Tool/tools/<分类>/<工具名>.vue。
// 新增工具只需在对应分类文件夹里放一个 .vue 文件，无需手动维护本文件。
import { defineAsyncComponent, type Component } from 'vue';

const modules = import.meta.glob('./views/Tool/tools/**/*.vue');

export interface ToolInfo {
  category: string; // 分类名，如 coding / daily
  name: string; // 工具名，如 文本替换
  path: string; // 路由路径 /tool/<分类>/<工具名>
}

// 解析 glob 路径 "./views/Tool/tools/coding/文本替换.vue" → { category, name }
function parsePath(path: string): ToolInfo | null {
  const m = path.match(/\.\/views\/Tool\/tools\/([^/]+)\/([^/]+)\.vue$/);
  if (!m) return null;
  return { category: m[1], name: m[2], path: `/tool/${m[1]}/${m[2]}` };
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

// 按分类与工具名返回懒加载的异步组件；找不到返回 null
export function loadTool(category: string, name: string): Component | null {
  const loader = modules[`./views/Tool/tools/${category}/${name}.vue`];
  if (!loader) return null;
  // 显式取 default 导出（glob 加载器返回模块对象），避免依赖 defineAsyncComponent 的默认解包
  return defineAsyncComponent(() =>
    loader().then((mod) => (mod as { default: Component }).default)
  );
}
