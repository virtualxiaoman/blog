// 动态归档的数据访问层：读取构建脚本（scripts/generate-dynamics.mjs）预生成的 JSON。
// 缓存的是 Promise：并发调用共享同一次请求；失败后移除缓存，下次调用可重试。
import { resolveMarkdownSource } from '../../utils/markdownSource';

export interface DynamicStats {
  like: number;
  comment: number;
  forward: number;
}

export interface DynamicSummary {
  /** 目录名，如 2016-08-26_1，同时作为详情页 URL 参数 */
  key: string;
  /** 所属月份，如 2016-08 */
  ym: string;
  /** 日期，如 2016-08-26 */
  date: string;
  /** 原始类型，如 DYNAMIC_TYPE_AV */
  type: string;
  /** 展示用类型标签，如 视频动态 */
  typeLabel: string;
  title: string;
  excerpt: string;
  /** 缩略图（B 站远程 URL），可能为 null */
  cover: string | null;
  /** B 站原文链接 */
  url: string;
  stats: DynamicStats | null;
}

export interface DynamicsIndex {
  total: number;
  /** 最早一条动态的日期（YYYY-MM-DD），日期查找默认值 */
  firstDate: string;
  /** 最新一条动态的日期 */
  lastDate: string;
  years: { year: string; count: number; months: { key: string; count: number }[] }[];
  /** 最新几条（首页用） */
  latest: DynamicSummary[];
}

/** 全文搜索索引条目（Ctrl+K 动态搜索与日期查找共用） */
export interface DynamicSearchEntry {
  key: string;
  /** 公历日期 YYYY-MM-DD */
  date: string;
  /** 农历月日，如 7-24（闰月取绝对月份） */
  lunar: string;
  /** 农历中文表述，如 七月廿四 */
  lunarText: string;
  /** 原始类型，如 DYNAMIC_TYPE_AV（卡片无封面时的类型角标用） */
  type: string;
  typeLabel: string;
  title: string;
  cover: string | null;
  /** 全文搜索文本（正文剥离图片/meta 后，上限 1500 字） */
  text: string;
}

/** 动态界面下按 Ctrl+K 时由 GlobalSearch 派发，动态搜索浮层监听此事件 */
export const DYN_SEARCH_EVENT = 'lty-dynamic-search';

/** 农历月份/日期选项（日期查找与结果标题共用），下标 + 1 为数值 */
export const LUNAR_MONTH_LABELS = [
  '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月',
];
export const LUNAR_DAY_LABELS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(path: string): Promise<T> {
  const url = resolveMarkdownSource(path);
  const cached = cache.get(url);
  if (cached) return cached as Promise<T>;

  const request = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`动态数据加载失败: ${r.status}`);
    return r.json() as Promise<T>;
  });
  request.catch(() => cache.delete(url));
  cache.set(url, request);
  return request;
}

// 注意：数据目录不能以 _ 开头——GitHub Pages 默认启用 Jekyll，会忽略 _data 这类目录导致线上 404
export function fetchDynamicsIndex(): Promise<DynamicsIndex> {
  return fetchJson<DynamicsIndex>('lty/dynamic/data/index.json');
}

export function fetchDynamicsMonth(ym: string): Promise<DynamicSummary[]> {
  return fetchJson<DynamicSummary[]>(`lty/dynamic/data/${ym}.json`);
}

/** 全文搜索索引约 1.2MB，按需加载（首次搜索/查找时） */
export function fetchDynamicsSearchIndex(): Promise<DynamicSearchEntry[]> {
  return fetchJson<DynamicSearchEntry[]>('lty/dynamic/data/search-index.json');
}

/** 详情页链接：hash 路由下拼成 <base>#/lty/dynamic/<key>，兼容本地与 /blog/ 子路径部署 */
export function dynamicDetailHref(key: string): string {
  return `${import.meta.env.BASE_URL}#/lty/dynamic/${encodeURIComponent(key)}`;
}

/** 动态正文 Markdown 的 public 路径 */
export function dynamicMarkdownPath(ym: string, key: string): string {
  return `lty/dynamic/${ym}/${key}/dynamic.md`;
}

/** 动态元数据 JSON 的 public 路径 */
export function dynamicJsonPath(ym: string, key: string): string {
  return `lty/dynamic/${ym}/${key}/dynamic.json`;
}

/** 详情页用到的 dynamic.json 字段（完整 schema 见 BiliTools 输出） */
export interface DynamicRaw {
  url?: string;
  type?: string;
  stats?: { like?: number; comment?: number; forward?: number };
  media?: { images?: { file?: string; url?: string }[] };
  cards?: { title?: string; cover_file?: string; cover_url?: string }[];
}

export function fetchDynamicJson(ym: string, key: string): Promise<DynamicRaw> {
  return fetchJson<DynamicRaw>(dynamicJsonPath(ym, key));
}
