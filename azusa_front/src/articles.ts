// 文章数据统一入口：所有列表与跳转都基于 src/articles.generated.ts（由 scripts/generate-articles.mjs 自动生成）。
// 新增文章只需把 .md 放进 public/article/md/<分类>/，运行 dev/build 时数据自动更新，无需手动维护本文件。
import { articleCategories as generated } from './articles.generated';
import type { ArticleInfo, ArticleSection } from './articles.generated';

export type { ArticleInfo, ArticleSection };

// 封面缺省占位图：文章没有对应封面文件时使用
const DEFAULT_COVER = 'default.png';

export interface ArticleWithCategory extends ArticleInfo {
  category: string;
}

// 返回带分类信息的扁平文章列表
export function allArticles(): ArticleWithCategory[] {
  return Object.entries(generated).flatMap(([category, articles]) =>
    articles.map((a) => ({ ...a, category }))
  );
}

// 返回所有分类名（按注册表顺序）
export function categoryNames(): string[] {
  return Object.keys(generated);
}

// 返回某分类下的文章列表，分类不存在时返回空数组
export function articlesByCategory(category: string): ArticleInfo[] {
  return generated[category] ?? [];
}

// 根据文章名返回它所在的分类，未登记时返回 null
export function findCategory(name: string): string | null {
  for (const [category, articles] of Object.entries(generated)) {
    if (articles.some((a) => a.name === name)) return category;
  }
  return null;
}

// 返回文章的封面文件名（相对 article/cover/），未登记或没有封面时返回默认占位图
export function coverFile(name: string): string {
  for (const articles of Object.values(generated)) {
    const article = articles.find((a) => a.name === name);
    if (article) return article.cover ?? DEFAULT_COVER;
  }
  return DEFAULT_COVER;
}

// 返回带分类上下文的小节索引（全局搜索用）。
// 每篇文章的每个标题对应一条，可直接路由跳转 + data-sec 定位。
export interface SectionWithArticle extends ArticleSection {
  category: string;
  article: string; // 文章名（不含分类）
  path: string; // 文章路由路径 /article/<分类>/<文章名>
  seq: number; // 标题在文章内的序号（与渲染的 data-sec 对应），0 表示文章本身
}

export function allSections(): SectionWithArticle[] {
  const result: SectionWithArticle[] = [];
  for (const [category, articles] of Object.entries(generated)) {
    for (const article of articles) {
      result.push({
        level: 0, // 文章本身作为顶层条目
        text: article.name,
        category,
        article: article.name,
        path: `/article/${category}/${article.name}`,
        seq: 0,
      });
      article.headings.forEach((h, i) => {
        result.push({
          ...h,
          category,
          article: article.name,
          path: `/article/${category}/${article.name}`,
          seq: i + 1, // 标题序号从 1 开始，与渲染的 data-sec 对齐
        });
      });
    }
  }
  return result;
}
