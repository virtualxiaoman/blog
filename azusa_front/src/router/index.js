import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/HomePage/index.vue';
import ArticleChoice from '../views/Article/misc.vue';

const routes = [
    {
        path: '/',
        name: 'home',  // 主页
        component: Home,
    },
    {
        path: '/article/:name',
        name: 'article',  // 文章页(Markdown)
        component: () => import('../views/Article/index.vue'),
    },
    {
        path: '/article/choice',
        name: 'article-choice',  // 文章选择页(Markdown+PDF)
        component: ArticleChoice,
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes: routes,
});

export default router;
