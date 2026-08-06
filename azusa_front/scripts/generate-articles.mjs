// 自动扫描 public/article/md 目录，生成文章数据源 src/articles.generated.ts。
// 新增文章只需把 .md 放进 public/article/md/<分类>/，运行 dev/build 时自动重新生成。
// 封面：优先用 public/article/cover/<文章名>.<ext>（任意图片扩展名），否则用 default.png。
import { readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mdDir = join(root, 'public', 'article', 'md');
const coverDir = join(root, 'public', 'article', 'cover');

// 封面允许的扩展名（按优先级），与 cover 目录里实际存在的文件匹配
const COVER_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const DEFAULT_COVER = 'default.png';

// 排除的非文章文件（大小写不敏感）：README 是站主说明，不是文章
const IGNORED = ['readme']; // 不含 .md 后缀的文章名

// 手动排序表：key 是分类名，value 是期望的文章显示顺序（文章名，不含 .md 后缀）。
// 没列到的文章自动按字典序排在已列出的之后。新增文章想固定位置就加进来，否则自动追加。
const ARTICLE_ORDER = {
  AI: ['深度学习', '深度学习实践', '机器学习', '机器学习实践', '推荐系统', '自然语言处理', '论文阅读', '强化学习', '扩散模型', '计算机视觉'],
};

function scanCovers() {
  if (!existsSync(coverDir)) return [];
  return readdirSync(coverDir).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
}

// 返回文章名对应的封面文件名；找不到时返回 null（由调用方用 default.png 兜底）
function coverFor(name, coverFiles) {
  for (const ext of COVER_EXTS) {
    const f = `${name}.${ext}`;
    if (coverFiles.includes(f)) return f;
  }
  return null;
}

// 返回文章名的排序权重：手动排序表里靠前，未列出的按字典序排在后面
function sortNames(names, category) {
  const order = ARTICLE_ORDER[category] ?? [];
  const indexOf = (name) => {
    const i = order.indexOf(name);
    return i === -1 ? order.length + 1 : i;
  };
  // 已列出的按手动顺序，未列出的按字典序排在其后
  return names
    .map((name) => ({ name, key: indexOf(name) }))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key - b.key;
      return a.name.localeCompare(b.name, 'zh');
    })
    .map(({ name }) => name);
}

function main() {
  if (!existsSync(mdDir)) {
    console.warn('[generate-articles] 未找到 public/article/md 目录，跳过生成');
    return;
  }
  const coverFiles = scanCovers();
  const categories = {};

  for (const category of readdirSync(mdDir)) {
    const dir = join(mdDir, category);
    if (!existsSync(dir)) continue;
    if (!statSync(dir).isDirectory()) continue;
    const names = sortNames(
      readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.slice(0, -3))
        .filter((name) => !IGNORED.includes(name.toLowerCase())),
      category
    );
    if (names.length > 0) {
      categories[category] = names.map((name) => ({
        name,
        cover: coverFor(name, coverFiles),
      }));
    }
  }

  const out = `// 本文件由 scripts/generate-articles.mjs 自动生成，请勿手动编辑。
// 数据源：public/article/md/<分类>/<文章名>.md + public/article/cover/
export interface ArticleInfo {
  name: string;
  cover: string | null; // 封面文件名，null 表示用默认占位图
}

export const articleCategories: Record<string, ArticleInfo[]> = ${JSON.stringify(categories, null, 2)};
`;
  const outFile = join(root, 'src', 'articles.generated.ts');
  writeFileSync(outFile, out);
  const count = Object.values(categories).reduce((n, a) => n + a.length, 0);
  console.log(`[generate-articles] 已生成 ${outFile}：${Object.keys(categories).length} 个分类，${count} 篇文章`);
}

main();
