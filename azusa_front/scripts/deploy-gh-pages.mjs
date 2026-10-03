// 发布 dist 到 gh-pages 分支（替代 gh-pages npm 包）。
// gh-pages@6 默认会把发布目录里的全部文件作为参数执行 `git rm`，文件数一多（本站约 6200 个）
// 在 Windows 上会超出命令行长度上限，报 spawn ENAMETOOLONG（见 gh-pages/lib/git.js rm）。
// 这里改为在临时仓库里操作：拉取分支最近一次提交 → 单参数清空旧文件 → 从文件系统复制 dist →
// 追加提交并推送。全程不生成超长命令行，行为与 gh-pages 默认一致（追加历史、非强制推送）。
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const BRANCH = 'gh-pages';

function git(args, cwd, { inherit = false, allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { cwd, stdio: inherit ? 'inherit' : 'pipe', encoding: 'utf8' });
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

if (!existsSync(join(dist, 'index.html'))) {
  console.error('deploy: dist 不存在或不完整，请先运行 npm run build');
  process.exit(1);
}

// DEPLOY_REMOTE 仅供本地测试覆盖远端地址
const remote = process.env.DEPLOY_REMOTE || git(['remote', 'get-url', 'origin'], root).trim();
const tmp = mkdtempSync(join(tmpdir(), 'blog-gh-pages-'));
console.log(`deploy: ${dist} -> ${remote} (${BRANCH})`);

try {
  git(['init', '-q'], tmp);
  git(['remote', 'add', 'origin', remote], tmp);
  git(['config', 'core.autocrlf', 'false'], tmp);

  // 只取分支最近一次提交（depth=1），在其基础上追加；分支不存在（首次部署）则新建
  const fetched = git(['fetch', '-q', '--depth=1', 'origin', BRANCH], tmp, { allowFail: true });
  if (fetched !== null) {
    git(['checkout', '-q', '-B', BRANCH, 'FETCH_HEAD'], tmp);
    git(['rm', '-r', '-f', '-q', '.'], tmp);
  } else {
    git(['checkout', '-q', '-B', BRANCH], tmp);
  }

  for (const entry of readdirSync(dist)) {
    cpSync(join(dist, entry), join(tmp, entry), { recursive: true });
  }
  // 关闭 GitHub Pages 的 Jekyll：否则下划线开头的目录（如 _data）不会被发布
  writeFileSync(join(tmp, '.nojekyll'), '');

  git(['add', '-A'], tmp);
  const changed = git(['status', '--porcelain'], tmp).trim();
  if (!changed) {
    console.log('deploy: 内容无变化，跳过推送');
  } else {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    git(['commit', '-q', '-m', `deploy ${stamp}`], tmp);
    console.log('deploy: 推送中…');
    git(['push', 'origin', `${BRANCH}:${BRANCH}`], tmp, { inherit: true });
    console.log('deploy: 完成');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
