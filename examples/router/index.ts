import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import Home from '../views/Home.vue';
import WebcadTemplate from '../views/WebcadTemplate.vue';
import LightGuideView from '../views/LightGuideView.vue';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: 'Home',
        component: Home,
        meta: {
            title: '主页'
        }
    },
    {
        path: '/template',
        name: 'webcad-template',
        component: WebcadTemplate,
        meta: {
            title: 'webcad-template'
        }
    },
    {
        path: '/lightguide',
        name: 'lightguide',
        component: LightGuideView,
        meta: {
            title: 'LightGuide CAD View'
        }
    }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

router.beforeEach((to, from, next) => {
    if (to.meta.title) {
        document.title = to.meta.title as string;
    }
    next();
});

export default router;

