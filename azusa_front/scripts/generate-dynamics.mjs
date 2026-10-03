// 自动扫描 public/lty/dynamic/<yyyy-mm>/<key>/ 下的 dynamic.json + dynamic.md，
// 生成静态数据索引（静态托管无法列目录，必须构建期预生成）：
//   _data/index.json      总条数、年份→月份计数（日历视图）、最新动态摘要（首页用）
//   _data/<yyyy-mm>.json  当月动态摘要列表（月份弹层用）
// 输出不含时间戳、键顺序固定，内容不变则不产生 diff。predev/prebuild 自动运行。
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Solar } from 'lunar-javascript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dynamicDir = join(root, 'public', 'lty', 'dynamic');
const dataDir = join(dynamicDir, '_data');

const MONTH_RE = /^\d{4}-\d{2}$/;
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})_(\d+)$/;

// meta 行解析失败时按 type 兜底
const TYPE_LABELS = {
  DYNAMIC_TYPE_AV: '视频动态',
  DYNAMIC_TYPE_DRAW: '图文动态',
  DYNAMIC_TYPE_FORWARD: '转发动态',
  DYNAMIC_TYPE_WORD: '纯文字动态',
  DYNAMIC_TYPE_ARTICLE: '专栏/长文动态',
  DYNAMIC_TYPE_COMMON_SQUARE: '通用卡片动态',
  DYNAMIC_TYPE_LIVE: '直播动态',
  DYNAMIC_TYPE_MUSIC: '音频动态',
};

// 去除行内 markdown 标记：图片整体丢弃，链接保留文字，强调符号去掉
function cleanInline(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 从 md 提取：一级标题、meta 行（作者那行）、正文第一段
function parseMd(md) {
  const lines = md.split(/\r?\n/);
  let h1 = '';
  let metaLine = '';
  let bodyExcerpt = '';
  for (const raw of lines) {
    const t = raw.trim();
    if (!h1 && /^#\s+/.test(t)) {
      h1 = cleanInline(t.replace(/^#\s+/, ''));
      continue;
    }
    if (/^>\s*作者：/.test(t)) {
      metaLine = t.replace(/^>\s*/, '');
      continue;
    }
    if (/^>/.test(t)) continue; // 其余引用行（原文/数据统计）跳过
    if (
      !bodyExcerpt &&
      t &&
      !/^#{1,6}\s/.test(t) && // 小节标题（卡片、图片、抽奖等）
      !/^[-*]\s/.test(t) &&
      !/^!\[/.test(t) &&
      t !== '---'
    ) {
      bodyExcerpt = cleanInline(t);
    }
  }
  return { h1, metaLine, bodyExcerpt };
}

// 类型标签优先取 meta 行最后一段（如 "图文动态（含互动抽奖、含商品）"），兜底用 type 映射
function typeLabelFrom(metaLine, type) {
  if (metaLine) {
    const segs = metaLine.split('｜').map((s) => s.trim());
    const last = segs[segs.length - 1];
    if (last && !/^\d{4}-\d{2}-\d{2}/.test(last)) return last;
  }
  return TYPE_LABELS[type] ?? '动态';
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// 全文搜索文本：剥离 meta 引用块与图片，保留标题（h1 除外，标题单独存）与正文
function extractSearchText(md) {
  const parts = [];
  for (const raw of md.split(/\r?\n/)) {
    let t = raw.trim();
    if (!t) continue;
    if (/^#\s/.test(t)) continue;
    if (/^>/.test(t)) {
      if (/^>\s*(作者：|原文：|数据：|数据统计日期)/.test(t)) continue;
      t = t.replace(/^>\s*/, '');
    }
    if (t === '---') continue;
    t = t.replace(/^#{1,6}\s+/, ''); // 小节标题去掉 # 标记（#话题# 无空格，不受影响）
    t = cleanInline(t);
    if (t) parts.push(t);
  }
  const text = parts.join(' ');
  return text.length > 1500 ? text.slice(0, 1500) : text;
}

// 公历 → 农历：月初一中午转换（日期正午无跨日歧义），闰月月份取绝对值
function solarToLunar(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return { md: '', text: '' };
  try {
    const l = Solar.fromYmd(Number(m[1]), Number(m[2]), Number(m[3])).getLunar();
    return {
      md: `${Math.abs(l.getMonth())}-${l.getDay()}`,
      text: `${l.getMonthInChinese()}月${l.getDayInChinese()}`,
    };
  } catch {
    return { md: '', text: '' };
  }
}

function buildSummary(ym, key, dir) {
  const jsonPath = join(dir, 'dynamic.json');
  const mdPath = join(dir, 'dynamic.md');
  if (!existsSync(jsonPath) || !existsSync(mdPath)) return null;

  const j = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const md = readFileSync(mdPath, 'utf8');
  const { h1, metaLine, bodyExcerpt } = parseMd(md);
  const cards = Array.isArray(j.cards) ? j.cards : [];
  const media = j.media && Array.isArray(j.media.images) ? j.media.images : [];

  // 缩略图：视频卡封面优先，其次正文第一张图；都没有则为 null（前端显示无图样式）
  const rawCover =
    cards.map((c) => c.cover_url).find((u) => typeof u === 'string' && u) ||
    media.map((mi) => mi.url).find((u) => typeof u === 'string' && u) ||
    null;
  // 部分是 http:// 链接，站内为 https，统一升级避免混合内容告警
  const cover = rawCover ? rawCover.replace(/^http:\/\//, 'https://') : null;

  const cardTitle = cards.map((c) => c.title).find((t) => typeof t === 'string' && t.trim()) || '';
  // 视频动态的 h1 是 "动态 <id>"，没有可读信息，用卡片标题/正文兜底
  let title = h1;
  if (!title || /^动态\s+\d+$/.test(title)) title = cardTitle || bodyExcerpt;
  title = truncate(cleanInline(title) || `${key} 动态`, 60);

  const m = KEY_RE.exec(key);
  const date = m ? `${m[1]}-${m[2]}-${m[3]}` : `${ym}-01`;

  const rawStats = j.stats && typeof j.stats === 'object' ? j.stats : null;

  const summary = {
    key,
    ym,
    date,
    type: j.type ?? '',
    typeLabel: typeLabelFrom(metaLine, j.type),
    title,
    excerpt: truncate(bodyExcerpt || title, 90),
    cover,
    url: typeof j.url === 'string' ? j.url : '',
    stats: rawStats
      ? { like: rawStats.like ?? 0, comment: rawStats.comment ?? 0, forward: rawStats.forward ?? 0 }
      : null,
  };

  const lunar = solarToLunar(date);
  const search = {
    key,
    date,
    lunar: lunar.md,
    lunarText: lunar.text,
    type: summary.type,
    typeLabel: summary.typeLabel,
    title: summary.title,
    cover,
    text: extractSearchText(md),
  };

  return { summary, search };
}

// key 排序：日期倒序，同日按序号倒序（_10 排在 _2 前面）
function keySort(a, b) {
  const ma = KEY_RE.exec(a);
  const mb = KEY_RE.exec(b);
  const da = `${ma[1]}${ma[2]}${ma[3]}`;
  const db = `${mb[1]}${mb[2]}${mb[3]}`;
  if (da !== db) return db.localeCompare(da);
  return Number(mb[4]) - Number(ma[4]);
}

if (!existsSync(dynamicDir)) {
  console.log('generate-dynamics: 未找到 public/lty/dynamic，跳过');
  process.exit(0);
}

const months = readdirSync(dynamicDir)
  .filter((n) => MONTH_RE.test(n) && statSync(join(dynamicDir, n)).isDirectory())
  .sort();

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

const yearMap = new Map();
const monthLists = new Map();
const searchByMonth = new Map();
let total = 0;
let firstDate = '';
let lastDate = '';

for (const ym of months) {
  const monthDir = join(dynamicDir, ym);
  const keys = readdirSync(monthDir)
    .filter((n) => KEY_RE.test(n) && statSync(join(monthDir, n)).isDirectory())
    .sort(keySort);

  const built = keys.map((k) => buildSummary(ym, k, join(monthDir, k))).filter(Boolean);
  if (!built.length) continue;

  const list = built.map((b) => b.summary);
  monthLists.set(ym, list);
  searchByMonth.set(ym, built.map((b) => b.search));
  total += list.length;
  for (const s of list) {
    if (!firstDate || s.date < firstDate) firstDate = s.date;
    if (s.date > lastDate) lastDate = s.date;
  }
  writeFileSync(join(dataDir, `${ym}.json`), JSON.stringify(list, null, 2));

  const year = ym.slice(0, 4);
  if (!yearMap.has(year)) yearMap.set(year, []);
  yearMap.get(year).push({ key: ym, count: list.length });
}

// 年份倒序（最新在前）；同年月份正序（1 月→12 月，呈现日历观感）
const years = [...yearMap.entries()]
  .sort((a, b) => b[0].localeCompare(a[0]))
  .map(([year, mts]) => ({
    year,
    count: mts.reduce((s, m) => s + m.count, 0),
    months: mts.sort((a, b) => a.key.localeCompare(b.key)),
  }));

// 最新动态（首页用）：月份倒序遍历，取前 3 条
const latest = [];
for (const ym of [...months].reverse()) {
  const list = monthLists.get(ym);
  if (!list) continue;
  for (const item of list) {
    latest.push(item);
    if (latest.length >= 3) break;
  }
  if (latest.length >= 3) break;
}

writeFileSync(
  join(dataDir, 'index.json'),
  JSON.stringify({ total, firstDate, lastDate, years, latest }, null, 2)
);

// 全文搜索索引（Ctrl+K 搜索与日期查找共用）：月份倒序展开，新动态在前
const searchEntries = [];
for (const ym of [...months].reverse()) {
  const entries = searchByMonth.get(ym);
  if (entries) searchEntries.push(...entries);
}
const searchJson = JSON.stringify(searchEntries);
writeFileSync(join(dataDir, 'search-index.json'), searchJson);

console.log(
  `generate-dynamics: ${total} 条动态 / ${months.length} 个月 -> public/lty/dynamic/_data/` +
    `（search-index ${(searchJson.length / 1048576).toFixed(1)}MB）`
);
