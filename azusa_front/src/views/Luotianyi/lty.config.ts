import type { Component } from 'vue';
import HomeSection from './sections/HomeSection.vue';
import ResourcesSection from './sections/ResourcesSection.vue';
import LinksSection from './sections/LinksSection.vue';
import PromptSection from './sections/PromptSection.vue';
import SongPromotionSection from './sections/SongPromotionSection.vue';
import HolographicSection from './sections/HolographicSection.vue';

/**
 * 洛天依页面的板块注册表。
 *
 * 新增/调整板块只需两步：
 *   1. 在 sections/ 下新建一个组件（内部用 LtySection 分块组织内容）；
 *   2. 在下方 ltySections 数组中追加一条记录。
 * 顶部标签按钮、URL ?tab= 深链、默认板块都会自动生效，无需改 index.vue。
 */
export interface LtySection {
  /** 唯一标识：用于板块切换与 URL ?tab=<key> 深链，英文 slug */
  key: string;
  /** 顶部标签按钮显示的文字 */
  label: string;
  /** 板块内容组件 */
  component: Component;
  /** 板块说明：悬停在标签按钮上会提示，也作为该板块的占位描述 */
  description: string;
}

export const ltySections: LtySection[] = [
  {
    key: 'home',
    label: '首页',
    component: HomeSection,
    description: '洛天依主页：简介、形象、最新动态等',
  },
  {
    key: 'resources',
    label: '资源',
    component: ResourcesSection,
    description: '资源：音乐、壁纸、视频等收藏',
  },
  {
    key: 'links',
    label: '友链',
    component: LinksSection,
    description: '友链：其他站点链接',
  },
  {
    key: 'prompt',
    label: 'prompt',
    component: PromptSection,
    description: 'prompt：提示词与创作草稿',
  },
  {
    key: 'song_promotion',
    label: '推歌',
    component: SongPromotionSection,
    description: '推歌：歌曲推荐与相关内容',
  },
  {
    key: 'holographic',
    label: '全息',
    component: HolographicSection,
    description: '全息：全息投影与演出相关内容',
  },
];


\n