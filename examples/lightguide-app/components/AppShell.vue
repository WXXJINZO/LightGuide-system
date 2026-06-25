<template>
    <div class="lg-app">
        <header class="topbar">
            <div class="brand">
                <div class="logo">投</div>
                <div class="brand-text">
                    <div class="brand-title">{{ t('appName') }}</div>
                    <div class="brand-sub">{{ t('appSub') }}</div>
                </div>
            </div>

            <div class="topbar-divider"></div>

            <div class="breadcrumb">
                <template v-if="projName">
                    <span class="bc-name">{{ projName }}</span>
                    <span class="bc-sep">/</span>
                    <span class="bc-batch">{{ batch }}</span>
                </template>
                <span v-else class="bc-name">—</span>
            </div>

            <div class="topbar-spacer"></div>

            <router-link class="home-link" to="/">↩ {{ t('nav.home') }}</router-link>

            <div class="lang-toggle" role="group" aria-label="language">
                <button class="lang" :class="{ on: lang === 'zh' }" @click="setLang('zh')">{{ t('lang.zh') }}</button>
                <button class="lang" :class="{ on: lang === 'en' }" @click="setLang('en')">{{ t('lang.en') }}</button>
            </div>

            <div class="role-chip">
                <div class="role-avatar"></div>
                <div class="role-text">
                    <div class="role-cap">{{ t('role') }}</div>
                    <div class="role-name">{{ t('worker') }}</div>
                </div>
            </div>

            <div
                class="status-badge"
                :style="{ background: headerStatus.bg, borderColor: headerStatus.bd }"
            >
                <span
                    class="status-dot"
                    :style="{ background: headerStatus.color, boxShadow: '0 0 8px ' + headerStatus.color }"
                ></span>
                <span class="status-label" :style="{ color: headerStatus.color }">{{ headerStatus.text }}</span>
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
                    <span class="step-num">{{ String(n).padStart(2, '0') }}</span>
                    <span class="step-label">{{ t('step.' + n) }}</span>
                    <span v-if="i < 4" class="step-sep">›</span>
                </button>
            </template>
        </nav>

        <main class="page">
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

const proj = computed(() => store.session?.project || store.project);
const projName = computed(() => proj.value?.name || '');
const batch = computed(() => proj.value?.code || '');

/** Header status badge — text + accent colour vary with the current step.
    Colours mirror the prototype renderVals() header status map. */
type StatusColor = '#37d27a' | '#f5b53d' | '#3d66f0' | '#f2545b';
interface HeaderStatus { text: string; color: StatusColor; bg: string; bd: string; }

const tints: Record<StatusColor, { bg: string; bd: string }> = {
    '#37d27a': { bg: 'rgba(55,210,122,.1)', bd: 'rgba(55,210,122,.3)' },
    '#f5b53d': { bg: 'rgba(245,181,61,.1)', bd: 'rgba(245,181,61,.3)' },
    '#3d66f0': { bg: 'rgba(61,102,240,.12)', bd: 'rgba(61,102,240,.4)' },
    '#f2545b': { bg: 'rgba(242,84,91,.12)', bd: 'rgba(242,84,91,.4)' }
};

function make(text: string, color: StatusColor): HeaderStatus {
    return { text, color, bg: tints[color].bg, bd: tints[color].bd };
}

const headerStatus = computed<HeaderStatus>(() => {
    const s = store.session;
    switch (step.value) {
        case 1: return make(t('header.ready'), '#37d27a');
        case 2: return make(t('header.binding'), '#f5b53d');
        case 3: return make(t('header.poseSet'), '#f5b53d');
        case 4:
            return s?.has_out_of_tolerance
                ? make(t('header.alarm'), '#f2545b')
                : make(t('header.checkPass'), '#37d27a');
        case 5: {
            const ps = store.session?.projection_state;
            if (ps === 'projecting') return make(t('header.projecting'), '#3d66f0');
            if (ps === 'paused') return make(t('header.paused'), '#f5b53d');
            return make(t('header.readyProject'), '#37d27a');
        }
        default: return make(t('header.ready'), '#37d27a');
    }
});

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
