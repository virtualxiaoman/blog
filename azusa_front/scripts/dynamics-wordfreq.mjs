// 动态词频统计：构建期对全部动态的标题+正文做中文分词（segmentit，纯 JS 无原生依赖），
// 去除停用词后按"出现总次数"统计，输出 data/wordfreq.json（前端词频图数据）。
// 停用词 = segmentit 自带虚词表 + 高频代词/副词 + B 站动态归档样板词（转发/图片/链接/本地存档等）。
import segmentit from 'segmentit';

const { Segment, useDefault, stopwords } = segmentit;

const STOPWORDS = new Set(stopwords.map((w) => w.replace(/#/g, '')));

// 高频代词/副词/泛化动词：几乎每条动态都会出现，不承载内容
const FILLER_WORDS = [
  '大家', '一起', '时间', '更多', '今天', '明天', '昨天', '现在', '已经', '记得',
  '准备', '获得', '这次', '相关', '目前', '提供', '进行', '使用', '需要', '包括',
  '其中', '内容', '前往', '即可', '立即', '直接', '全部', '后续', '各位', '即将',
  '全新', '正式', '公开', '专属', '限定',
  '我们', '你们', '他们', '她们', '它们', '自己', '别人', '可以', '还有', '一个',
  '什么', '所有', '真的', '感觉', '觉得', '知道', '看到', '好多', '一下', '这样',
  '那样', '这个', '那个', '这些', '那些', '这么', '那么', '只是', '就是', '还是',
  '因为', '所以', '如果', '但是', '不过', '虽然', '然后', '于是', '非常', '一直',
  '一点', '本次', '此次',
  '开启', '送出', '解锁', '带来', '开售', '上线',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '三十', '四十', '五十',
];

// B 站动态归档样板词：转发/抽奖/商品卡的固定文案与站内术语
const BOILERPLATE_WORDS = [
  '转发', '图片', '链接', '详情', '查看', '点击', '话题', '动态', '卡片', '本地',
  '存档', '网页', '传送', '入口', '通知', '投稿', '标题', '表情', '私信', '关注',
  '预约', '互动', '收藏', '会员', '伙伴', '参与', '恭喜', '原创', '视频', '分享',
  '微博', '账号', '专栏', '原文',
];

for (const w of [...FILLER_WORDS, ...BOILERPLATE_WORDS]) STOPWORDS.add(w);

// 只保留纯汉字词（2~12 字）：过滤数字混合词（如 1份）、标点、表情与英文
const CJK_WORD = /^[\u4e00-\u9fff]{2,12}$/;

// 输出上限：词频尾部全是出现 1~2 次的词，无展示价值
const TOP_N = 500;

/**
 * @param {{ title: string; text: string }[]} entries 全部动态的搜索条目（标题 + 正文）
 * @returns {{ total: number; vocab: number; words: { w: string; n: number }[] }}
 */
export function computeWordFreq(entries) {
  const segment = useDefault(new Segment());
  const counts = new Map();
  for (const e of entries) {
    for (const w of segment.doSegment(`${e.title} ${e.text}`, { simple: true })) {
      if (!CJK_WORD.test(w) || STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const words = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .slice(0, TOP_N)
    .map(([w, n]) => ({ w, n }));
  return { total: entries.length, vocab: counts.size, words };
}
