<template>
    <div class="p1-root">
        <section class="p1-list-pane">
            <div class="p1-inner">
                <div class="p1-eyebrow">{{ t('step') }} 01 · {{ t('p1.title') }}</div>
                <h1 class="p1-title">{{ t('p1.title') }}</h1>
                <p class="p1-desc">{{ t('p1.desc') }}</p>

                <div class="p1-search-row">
                    <div class="p1-search">
                        <span class="p1-search-ico">⌕</span>
                        <input
                            v-model="query"
                            type="text"
                            class="p1-search-input"
                            :placeholder="t('p1.search')"
                            @input="searchProjects"
                        />
                    </div>
                    <button class="p1-ghost-btn" :disabled="listLoading" @click="refresh">{{ t('refresh') }}</button>
                    <button class="p1-ghost-btn" :disabled="importing" @click="fileInput?.click()">
                        {{ importing ? t('p1.importing') : '↓ ' + t('p1.import') }}
                    </button>
                    <input
                        ref="fileInput"
                        type="file"
                        accept=".ifc,.step,.stp,.STEP,.STP,.IFC"
                        hidden
                        @change="onImport"
                    />
                </div>

                <div v-if="listLoading" class="p1-loading">
                    <span class="p1-spinner"></span>
                    <span>{{ t('loading') }}</span>
                </div>

                <div v-else class="p1-cards">
                    <button
                        v-for="project in store.projects"
                        :key="project.id"
                        class="p1-card"
                        :class="{ selected: store.project?.id === project.id }"
                        @click="selectProject(project.id)"
                    >
                        <div class="p1-card-icon">🏗</div>
                        <div class="p1-card-body">
                            <div class="p1-card-head">
                                <span class="p1-card-name">{{ project.name }}</span>
                                <span class="p1-card-code lg-mono">{{ project.code }}</span>
                            </div>
                            <div class="p1-card-meta">
                                <span>{{ t('p1.totalComps') }} · <b class="lg-mono">{{ project.total_components }}</b></span>
                                <span>{{ t('createdBy') }} {{ project.prepared_by }}</span>
                                <span class="lg-mono">{{ project.prepared_at }}</span>
                            </div>
                        </div>
                        <span class="lg-pill p1-status" :style="statusPill(project.status)">{{ t('status.' + project.status) }}</span>
                        <span class="p1-chevron">›</span>
                    </button>
                    <div v-if="!store.projects.length" class="p1-empty">{{ t('p2.noMatch') }}</div>
                </div>
            </div>
        </section>

        <aside class="p1-aside">
            <div class="p1-aside-label">{{ t('p1.projInfo') }}</div>
            <div class="p1-aside-name">{{ store.project?.name || '—' }}</div>
            <div class="p1-aside-code lg-mono">{{ store.project?.code || '' }}</div>
            <div class="p1-info-rows">
                <div v-for="row in infoRows" :key="row.k" class="p1-info-row">
                    <span class="p1-info-k">{{ row.k }}</span>
                    <span class="p1-info-v" :class="{ 'lg-mono': row.mono }">{{ row.v }}</span>
                </div>
            </div>
            <div class="p1-aside-spacer"></div>
            <button class="p1-cta" :disabled="!store.project || store.project.status === 'expired'" @click="enterBinding">
                {{ t('p1.continueBind') }} →
            </button>
            <button class="p1-detail-btn" :disabled="!store.project" @click="detailOpen = true">{{ t('viewInfo') }}</button>
        </aside>

        <Teleport to="body">
            <div v-if="detailOpen && store.project" class="p1-modal-overlay" @click="detailOpen = false">
                <div class="p1-modal" @click.stop>
                    <div class="p1-modal-head">
                        <div class="p1-modal-icon">🏗</div>
                        <div class="p1-modal-titles">
                            <div class="p1-modal-name">{{ store.project.name }}</div>
                            <div class="p1-modal-code lg-mono">{{ store.project.code }}</div>
                        </div>
                        <button class="p1-modal-close" @click="detailOpen = false">✕</button>
                    </div>
                    <div class="p1-modal-body">
                        <div v-for="row in infoRows" :key="row.k" class="p1-modal-row">
                            <span class="p1-info-k">{{ row.k }}</span>
                            <span class="p1-info-v" :class="{ 'lg-mono': row.mono }">{{ row.v }}</span>
                        </div>
                    </div>
                    <div class="p1-modal-foot">
                        <button class="p1-modal-cancel" @click="detailOpen = false">{{ t('close') }}</button>
                        <button class="p1-modal-go" @click="enterBinding">{{ t('p1.continueBind') }} →</button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '../i18n';
import { Store, store } from '../store';
import * as api from '../api/client';
import { toast } from '../composables/useToast';
import { useWorkflowNav } from '../composables/useWorkflow';
import type { ProjectStatus } from '../api/types';

const { t } = useI18n();
const { gotoStep } = useWorkflowNav();
const query = ref('');
const importing = ref(false);
const listLoading = ref(false);
const detailOpen = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const infoRows = computed<{ k: string; v: string; mono: boolean }[]>(() => {
    const p = store.project;
    if (!p) return [];
    return [
        { k: t('p1.projCode'), v: p.code, mono: true },
        { k: t('p1.totalComps'), v: String(p.total_components), mono: true },
        { k: t('p1.currentBatch'), v: p.code, mono: true },
        { k: t('createdBy'), v: p.prepared_by, mono: false },
        { k: t('createdAt'), v: p.prepared_at, mono: true },
    ];
});

function statusPill(status: ProjectStatus): Record<string, string> {
    const map: Record<ProjectStatus, [string, string, string]> = {
        available: ['#37d27a', 'rgba(55,210,122,.12)', 'rgba(55,210,122,.3)'],
        pending: ['#f5b53d', 'rgba(245,181,61,.12)', 'rgba(245,181,61,.3)'],
        expired: ['#f2545b', 'rgba(242,84,91,.12)', 'rgba(242,84,91,.4)'],
    };
    const [fg, bg, bd] = map[status];
    return { color: fg, background: bg, border: `1px solid ${bd}` };
}

function searchProjects(): void {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { void Store.loadProjects(query.value); }, 160);
}

async function refresh(): Promise<void> {
    listLoading.value = true;
    try {
        await Store.loadProjects(query.value);
        toast(t('p1.refreshed'), 'ok');
    } finally {
        listLoading.value = false;
    }
}

async function selectProject(id: number): Promise<void> {
    await Store.loadProject(id);
}

async function enterBinding(): Promise<void> {
    if (!store.project) {
        toast(t('p1.selectFirst'), 'warn');
        return;
    }
    detailOpen.value = false;
    await Store.openSession(store.project.id);
    await gotoStep(2);
}

async function onImport(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importing.value = true;
    try {
        const result = await api.importModel(file.name, await file.text());
        toast(t('p1.imported', result.component.mark, result.component.secondary.length), 'ok');
        await Store.loadProjects();
        await Store.loadProject(result.project.id);
    } catch (err) {
        toast(t('p1.importFail', err instanceof Error ? err.message : String(err)), 'bad');
    } finally {
        importing.value = false;
        input.value = '';
    }
}

onMounted(async () => {
    listLoading.value = true;
    try {
        await Store.loadProjects();
    } finally {
        listLoading.value = false;
    }
});
</script>

<style scoped>
.p1-root {
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
}

/* ---------- left list pane ---------- */
.p1-list-pane {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 34px 40px;
}
.p1-inner {
    max-width: 940px;
    margin: 0 auto;
    animation: riseIn .32s ease both;
}
.p1-eyebrow {
    font-size: 11px;
    letter-spacing: 1.5px;
    color: #3d66f0;
    font-weight: 600;
    margin-bottom: 6px;
}
.p1-title {
    font-size: 25px;
    font-weight: 700;
    letter-spacing: .2px;
    margin: 0 0 6px;
    color: #e9ebf0;
}
.p1-desc {
    font-size: 13.5px;
    color: #8a8f99;
    max-width: 680px;
    line-height: 1.55;
    margin: 0;
}

/* ---------- search row ---------- */
.p1-search-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 24px 0 16px;
}
.p1-search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 42px;
    padding: 0 14px;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .09);
    border-radius: 9px;
}
.p1-search-ico {
    color: #5b606b;
    font-size: 15px;
}
.p1-search-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: #e9ebf0;
    font-size: 13px;
    font-family: inherit;
}
.p1-search-input::placeholder {
    color: #6b707a;
}
.p1-ghost-btn {
    height: 42px;
    padding: 0 16px;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .09);
    border-radius: 9px;
    color: #aeb2bb;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all .15s ease;
    white-space: nowrap;
}
.p1-ghost-btn:hover:not(:disabled) {
    background: #1c1f25;
    border-color: rgba(255, 255, 255, .18);
}
.p1-ghost-btn:disabled {
    opacity: .5;
    cursor: default;
}

/* ---------- loading ---------- */
.p1-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 13px;
    padding: 64px 0;
    color: #7f848e;
    font-size: 12.5px;
}
.p1-spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba(255, 255, 255, .14);
    border-top-color: #3d66f0;
    border-radius: 50%;
    animation: spin .8s linear infinite;
}

/* ---------- cards ---------- */
.p1-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.p1-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 18px;
    width: 100%;
    cursor: pointer;
    border-radius: 13px;
    transition: all .15s ease;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .08);
    text-align: left;
    font-family: inherit;
}
.p1-card:hover {
    border-color: rgba(61, 102, 240, .5);
}
.p1-card.selected {
    background: rgba(61, 102, 240, .08);
    border-color: #3d66f0;
}
.p1-card-icon {
    width: 54px;
    height: 54px;
    flex: none;
    border-radius: 10px;
    background: #1a1d22;
    border: 1px solid rgba(255, 255, 255, .08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
}
.p1-card.selected .p1-card-icon {
    background: rgba(61, 102, 240, .14);
    border-color: rgba(61, 102, 240, .4);
}
.p1-card-body {
    flex: 1;
    min-width: 0;
}
.p1-card-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 5px;
}
.p1-card-name {
    font-size: 15px;
    font-weight: 600;
    color: #eef0f4;
}
.p1-card-code {
    font-size: 12px;
    color: #3d66f0;
    background: rgba(61, 102, 240, .13);
    padding: 2px 8px;
    border-radius: 5px;
}
.p1-card-meta {
    display: flex;
    gap: 18px;
    font-size: 12px;
    color: #7f848e;
}
.p1-card-meta b {
    color: #aeb2bb;
    font-weight: 600;
}
.p1-status {
    flex: none;
}
.p1-chevron {
    color: #4a4e56;
    font-size: 20px;
    margin-left: 4px;
    flex: none;
}
.p1-empty {
    padding: 48px 0;
    text-align: center;
    color: #6b707a;
    font-size: 13px;
}

/* ---------- right aside ---------- */
.p1-aside {
    width: 340px;
    flex: none;
    border-left: 1px solid rgba(255, 255, 255, .07);
    background: #101115;
    padding: 26px 22px;
    display: flex;
    flex-direction: column;
}
.p1-aside-label {
    font-size: 11px;
    letter-spacing: 1px;
    color: #7f848e;
    font-weight: 600;
    margin-bottom: 14px;
}
.p1-aside-name {
    font-size: 17px;
    font-weight: 700;
    color: #e9ebf0;
    margin-bottom: 2px;
}
.p1-aside-code {
    font-size: 12.5px;
    color: #3d66f0;
    margin-bottom: 20px;
}
.p1-info-rows {
    display: flex;
    flex-direction: column;
    border-top: 1px solid rgba(255, 255, 255, .07);
}
.p1-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 0;
    border-bottom: 1px solid rgba(255, 255, 255, .06);
}
.p1-info-k {
    font-size: 12.5px;
    color: #7f848e;
}
.p1-info-v {
    font-size: 13px;
    font-weight: 600;
    color: #dfe2e8;
}
.p1-aside-spacer {
    flex: 1;
}
.p1-cta {
    height: 48px;
    width: 100%;
    background: #3d66f0;
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14.5px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(61, 102, 240, .4);
    margin-bottom: 10px;
    transition: filter .15s ease;
}
.p1-cta:hover:not(:disabled) {
    filter: brightness(1.08);
}
.p1-cta:disabled {
    background: #2a2d33;
    opacity: .5;
    box-shadow: none;
    cursor: default;
}
.p1-detail-btn {
    height: 42px;
    width: 100%;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, .12);
    border-radius: 10px;
    color: #aeb2bb;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all .15s ease;
}
.p1-detail-btn:hover:not(:disabled) {
    background: #15171c;
    border-color: rgba(255, 255, 255, .2);
}
.p1-detail-btn:disabled {
    opacity: .5;
    cursor: default;
}

/* ---------- detail modal ---------- */
.p1-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(6, 7, 9, .66);
    backdrop-filter: blur(3px);
    animation: overlayIn .18s ease;
}
.p1-modal {
    width: 540px;
    max-width: 100%;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .12);
    border-radius: 16px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, .6);
    animation: modalPop .22s cubic-bezier(.2, .9, .3, 1);
    overflow: hidden;
}
.p1-modal-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, .08);
}
.p1-modal-icon {
    width: 42px;
    height: 42px;
    flex: none;
    border-radius: 11px;
    background: rgba(61, 102, 240, .14);
    border: 1px solid rgba(61, 102, 240, .4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}
.p1-modal-titles {
    flex: 1;
    min-width: 0;
}
.p1-modal-name {
    font-size: 16px;
    font-weight: 700;
    color: #e9ebf0;
}
.p1-modal-code {
    font-size: 12px;
    color: #3d66f0;
}
.p1-modal-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, .12);
    background: transparent;
    color: #aeb2bb;
    font-size: 15px;
    cursor: pointer;
    transition: all .15s ease;
}
.p1-modal-close:hover {
    background: #22252b;
    color: #fff;
}
.p1-modal-body {
    padding: 6px 22px 8px;
    max-height: 54vh;
    overflow: auto;
}
.p1-modal-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, .06);
}
.p1-modal-row .p1-info-v {
    font-size: 13.5px;
}
.p1-modal-foot {
    padding: 16px 22px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid rgba(255, 255, 255, .08);
}
.p1-modal-cancel {
    height: 42px;
    padding: 0 20px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, .14);
    background: transparent;
    color: #dfe2e8;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all .15s ease;
}
.p1-modal-cancel:hover {
    background: #22252b;
}
.p1-modal-go {
    height: 42px;
    padding: 0 22px;
    border-radius: 10px;
    border: none;
    background: #3d66f0;
    color: #fff;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(61, 102, 240, .4);
    transition: filter .15s ease;
}
.p1-modal-go:hover {
    filter: brightness(1.08);
}
</style>
