// 文章分类注册表：分类名 -> 文章信息列表
// 新增文章时只需在此登记，首页、文章列表、md 加载路径都会自动更新。
// cover 省略时按 cover/<文章名>.jpg 兜底。
export interface ArticleInfo {
  name: string; // 文章名（不含 .md 后缀），也是 md/cover 文件名
  cover?: string; // 封面文件名（不含目录），缺省用 name 兜底
}

export const articleCategories: Record<string, ArticleInfo[]> = {
  AI: [
    { name: '深度学习', cover: '深度学习.jpeg' },
    { name: '深度学习实践', cover: '深度学习实践.jpg' },
    { name: '机器学习', cover: '机器学习.png' },
    { name: '机器学习实践', cover: '机器学习实践.jpg' },
    { name: '推荐系统', cover: '推荐系统.jpg' },
    { name: '自然语言处理', cover: '自然语言处理.jpg' },
    { name: '论文阅读', cover: '论文阅读.png' },
    { name: '强化学习' },
    { name: '扩散模型' },
    { name: '计算机视觉' },
  ],
  Others: ['LaTeX', 'git', 'plt', 'vue', '零碎东西的存档'].map(name => ({ name })),
}

// 根据文章名返回它所在的分类，未登记时返回 null
export function findCategory(name: string): string | null {
  for (const [category, articles] of Object.entries(articleCategories)) {
    if (articles.some(a => a.name === name)) return category
  }
  return null
}

// 返回文章的封面路径（相对 BASE_URL），未登记时返回 null
export function getCover(name: string): string | null {
  for (const articles of Object.values(articleCategories)) {
    const article = articles.find(a => a.name === name)
    if (article) return `article/cover/${article.cover ?? `${article.name}.jpg`}`
  }
  return null
}
