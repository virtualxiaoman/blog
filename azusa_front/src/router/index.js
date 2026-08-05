import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/HomePage/index.vue';
import ArticleChoice from '../views/Article/misc.vue';

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
        component: ArticleChoice,
    }
];

// console.log(routes);
console.log(import.meta.env.BASE_URL);


const router = createRouter({
    history: createWebHashHistory(),
    routes: routes,
});

export default router;
