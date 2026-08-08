import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/HomePage/index.vue';

// 使用 hash 历史模式，兼容 GitHub Pages 等静态托管：
// 直接访问 / 刷新深链（如 /#/article/AI/强化学习）都能正常工作，无需服务端回退。
const routes = [
  {
    path: '/', // 首页
    name: 'home',
    component: Home,
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
});

export default router;
