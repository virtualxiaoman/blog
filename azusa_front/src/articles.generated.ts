// 本文件由 scripts/generate-articles.mjs 自动生成，请勿手动编辑。
// 数据源：public/article/md/<分类>/<文章名>.md + public/article/cover/
export interface ArticleInfo {
  name: string;
  cover: string | null; // 封面文件名，null 表示用默认占位图
}

export const articleCategories: Record<string, ArticleInfo[]> = {
  "AI": [
    {
      "name": "深度学习",
      "cover": "深度学习.jpeg"
    },
    {
      "name": "机器学习",
      "cover": "机器学习.png"
    },
    {
      "name": "论文阅读",
      "cover": "论文阅读.png"
    },
    {
      "name": "深度学习实践",
      "cover": "深度学习实践.jpg"
    },
    {
      "name": "机器学习实践",
      "cover": "机器学习实践.jpg"
    },
    {
      "name": "推荐系统",
      "cover": "推荐系统.jpg"
    },
    {
      "name": "自然语言处理",
      "cover": "自然语言处理.jpg"
    },
    {
      "name": "强化学习",
      "cover": null
    },
    {
      "name": "扩散模型",
      "cover": null
    },
    {
      "name": "计算机视觉",
      "cover": null
    }
  ],
  "Others": [
    {
      "name": "零碎东西的存档",
      "cover": null
    },
    {
      "name": "git",
      "cover": null
    },
    {
      "name": "LaTeX",
      "cover": null
    },
    {
      "name": "plt",
      "cover": null
    },
    {
      "name": "vue",
      "cover": null
    }
  ]
};
