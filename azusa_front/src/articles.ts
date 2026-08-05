// 文章分类注册表：分类名 -> 该分类下的文章名（不含 .md 后缀）
// 新增文章时只需在此登记，首页、文章列表、md 加载路径都会自动更新
export const articleCategories: Record<string, string[]> = {
  AI: ['强化学习', '扩散模型', '推荐系统', '机器学习', '机器学习实践', '深度学习', '自然语言处理', '计算机视觉'],
  Others: ['LaTeX', 'git', 'plt', 'vue', '零碎东西的存档'],
}

// 根据文章名返回它所在的分类，未登记时返回 null
export function findCategory(name: string): string | null {
  for (const [category, names] of Object.entries(articleCategories)) {
    if (names.includes(name)) return category
  }
  return null
}
