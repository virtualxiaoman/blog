import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/HomePage/index.vue';
import ArticleChoice from '../views/Article/misc.vue';

const routes = [
    {
        path: import.meta.env.BASE_URL, // 动态基地址，开发环境和生产环境自适应
        name: 'home',
        component: Home,
    },
    {
        path: `${import.meta.env.BASE_URL}article/:name`,
        name: 'article',
        component: () => import('../views/Article/index.vue'),
    },
    {
        path: `${import.meta.env.BASE_URL}article/choice`,
        name: 'article-choice',
        component: ArticleChoice,
    }
];

// console.log(routes);
console.log(import.meta.env.BASE_URL);


const router = createRouter({
    history: createWebHistory(),
    routes: routes,
});

export default router;
