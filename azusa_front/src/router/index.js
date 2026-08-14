import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/HomePage/index.vue';

// 使用 hash 历史模式，兼容 GitHub Pages 等静态托管：
// 直接访问 / 刷新深链（如 /#/article/AI/强化学习）都能正常工作，无需服务端回退。
const routes = [
  {
    path: '/', // 首页（开屏 + 主页导航两页）
    name: 'home',
    component: Home,
  },
  {
    // 文章界面：集中展示文章列表（原首页左侧的文章导航移到这里）
    path: '/articles',
    name: 'article-list',
    component: () => import('../views/Article/list.vue'),
  },
  {
    // 洛天依界面：天依相关内容
    path: '/lty',
    name: 'luotianyi',
    component: () => import('../views/Luotianyi/index.vue'),
  },
  {
    // 分类后的文章详情页，路径形如 #/article/AI/强化学习
    path: '/article/:category/:name',
    name: 'article',
    component: () => import('../views/Article/index.vue'),
  },
  {
    path: '/article/choice',
    name: 'article-choice',
    component: () => import('../views/Article/misc.vue'),
  },
  {
    path: '/tool', // 工具箱首页
    name: 'tool',
    component: () => import('../views/Tool/index.vue'),
  },
  {
    // 具体工具页，路径形如 #/tool/text/text-processor
    path: '/tool/:category/:name',
    name: 'tool-detail',
    component: () => import('../views/Tool/detail.vue'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  // 切换路由后回到顶部：从首页第二页（已滚动到下方）进入文章/工具/洛天依页时，
  // 新页面从顶部开始展示，而不是停留在上一页的滚动位置。
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
