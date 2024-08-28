import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/HomePage/index.vue';

const routes = [
    {
        path: '/',
        name: 'home',
        component: Home,
    },
    {
        path: '/article/:name',
        component: () => import('../views/Article/index.vue'),
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes: routes,
});

export default router;
