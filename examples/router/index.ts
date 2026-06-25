import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import Home from '../views/Home.vue';
import WebcadTemplate from '../views/WebcadTemplate.vue';
import LightGuideView from '../views/LightGuideView.vue';
import LightGuideApp from '../views/LightGuideApp.vue';
import SelectProject from '../lightguide-app/pages/SelectProject.vue';
import SlotBinding from '../lightguide-app/pages/SlotBinding.vue';
import PosePage from '../lightguide-app/pages/PosePage.vue';
import DeviationCheck from '../lightguide-app/pages/DeviationCheck.vue';
import ProjectionPreview from '../lightguide-app/pages/ProjectionPreview.vue';

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
        component: LightGuideApp,
        redirect: { name: 'lg-select' },
        children: [
            { path: 'select', name: 'lg-select', component: SelectProject, meta: { title: 'LightGuide · 选择工程' } },
            { path: 'binding', name: 'lg-binding', component: SlotBinding, meta: { title: 'LightGuide · 工位绑定' } },
            { path: 'pose', name: 'lg-pose', component: PosePage, meta: { title: 'LightGuide · 位姿选择' } },
            { path: 'check', name: 'lg-check', component: DeviationCheck, meta: { title: 'LightGuide · 偏差校验' } },
            { path: 'projection', name: 'lg-projection', component: ProjectionPreview, meta: { title: 'LightGuide · 投影预览' } }
        ]
    },
    {
        path: '/lightguide-cad',
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

