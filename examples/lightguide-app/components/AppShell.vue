<template>
    <div class="lg-app">
        <header class="topbar">
            <div class="brand">
                <div class="logo">投</div>
                <div class="brand-text">
                    <div class="brand-title">{{ t('brand.title') }}</div>
                    <div class="brand-sub">{{ t('brand.subtitle') }}</div>
                </div>
                <div class="brand-project">
                    <span class="proj-icon">▦</span>
                    <template v-if="proj">{{ proj.name }} <span class="sep">/</span> {{ proj.code }}</template>
                    <template v-else>—</template>
                </div>
            </div>
            <div class="topbar-right">
                <router-link class="home-link" to="/">↩ {{ t('nav.home') }}</router-link>
                <div class="lang-toggle" role="group" aria-label="language">
                    <button class="lang" :class="{ on: lang === 'zh' }" @click="setLang('zh')">{{ t('lang.zh') }}</button>
                    <button class="lang" :class="{ on: lang === 'en' }" @click="setLang('en')">{{ t('lang.en') }}</button>
                </div>
                <div class="role-pill">
                    <span class="role-dot"></span>
                    <div class="role-text"><span class="role-cap">{{ t('role.label') }}</span><b>{{ t('role.worker') }}</b></div>
                </div>
            </div>
        </header>

        <nav class="stepper">
            <template v-for="(n, i) in [1, 2, 3, 4, 5]" :key="n">
                <button
                    class="step"
                    :class="[stepState(n), { locked: !stepReachable(n) }]"
                    :disabled="!stepReachable(n)"
                    @click="onStep(n)"
                >
                    <span class="step-no">{{ String(n).padStart(2, '0') }}</span>
                    <span class="step-name">{{ t('step.' + n) }}</span>
                </button>
                <span v-if="i < 4" class="step-arrow">›</span>
            </template>
        </nav>

        <main class="page" :class="{ 'page-workspace': isWorkspace }">
            <router-view />
        </main>

        <div class="toast" :class="['', toastState.show ? 'show ' + toastState.kind : '']">{{ toastState.msg }}</div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '../i18n';
import { Store, store } from '../store';
import { ROUTE_STEP, stepReachable, useWorkflowNav } from '../composables/useWorkflow';
import { useToast } from '../composables/useToast';

const { state, t, setLang } = useI18n();
const lang = computed(() => state.lang);
const route = useRoute();
const { gotoStep } = useWorkflowNav();
const { toastState } = useToast();

const step = computed(() => ROUTE_STEP[route.name as string] || 1);
const isWorkspace = computed(() => step.value >= 3);
const proj = computed(() => store.session?.project || store.project);

function stepState(n: number): string {
    return n === step.value ? 'active' : n < step.value ? 'done' : 'todo';
}
async function onStep(n: number) {
    if (!stepReachable(n)) return;
    await gotoStep(n);
}

onMounted(async () => {
    setLang(state.lang);
    // Restore an in-flight session (the workflow survives a reload).
    if (Store.sessionId && (!store.session || store.session.id !== Store.sessionId)) {
        try { await Store.refreshSession(); } catch { Store.sessionId = null; }
    }
});
</script>
