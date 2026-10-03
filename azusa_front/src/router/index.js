import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/HomePage/index.vue';
// 文章/工具/洛天依是主页导航的首要入口，静态导入随主包直出：懒加载路由要等代码分片
// 下载完才更新 URL 并渲染，弱网下点击后数秒无任何反馈（首页大图占带宽时会更久）。
// 其余路由保持懒加载（文章详情页依赖较重，不适合进主包）。
import ArticleList from '../views/Article/list.vue';
import ToolIndex from '../views/Tool/index.vue';
import LuotianyiPage from '../views/Luotianyi/index.vue';

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
    component: ArticleList,
  },
  {
    // 洛天依界面：天依相关内容
    path: '/lty',
    name: 'luotianyi',
    component: LuotianyiPage,
  },
  {
    // 单条动态展示页，路径形如 #/lty/dynamic/2016-08-26_1（key 即归档目录名）
    path: '/lty/dynamic/:key',
    name: 'lty-dynamic',
    component: () => import('../views/Luotianyi/DynamicDetail.vue'),
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
    component: ToolIndex,
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
