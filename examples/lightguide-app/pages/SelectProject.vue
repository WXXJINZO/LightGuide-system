<template>
    <div>
        <div class="page-head">
            <div>
                <h1>{{ t('p1.title') }}</h1>
                <p class="page-sub">{{ t('p1.subtitle') }}</p>
            </div>
            <div class="p1-actions">
                <button class="btn" :disabled="importing" @click="fileInput?.click()">{{ importing ? t('p1.importing') : '↓ ' + t('p1.import') }}</button>
                <input ref="fileInput" type="file" accept=".ifc,.step,.stp,.STEP,.STP,.IFC" hidden @change="onImport" />
            </div>
        </div>

        <div class="p1-layout">
            <section class="p1-list">
                <div class="searchbar">
                    <span class="search-ico">⌕</span>
                    <input v-model="query" type="text" :placeholder="t('p1.search')" @input="searchProjects" />
                </div>
                <div class="proj-cards">
                    <button
                        v-for="project in store.projects"
                        :key="project.id"
                        class="proj-card"
                        :class="{ selected: store.project?.id === project.id }"
                        @click="selectProject(project.id)"
                    >
                        <div class="proj-card-head">
                            <div class="proj-name">{{ project.name }}</div>
                            <span class="badge" :class="statusClass(project.status)">{{ t('status.' + project.status) }}</span>
                        </div>
                        <div class="proj-code">{{ project.code }}</div>
                        <div class="proj-meta">
                            <span><i>{{ t('p1.col.total') }}</i> {{ project.total_components }}</span>
                            <span><i>{{ t('p1.col.prepared') }}</i> {{ project.prepared_components }}</span>
                            <span><i>{{ t('p1.col.by') }}</i> {{ project.prepared_by }}</span>
                            <span><i>{{ t('p1.col.time') }}</i> {{ project.prepared_at }}</span>
                        </div>
                    </button>
                    <div v-if="!store.projects.length" class="empty">No matching project</div>
                </div>
            </section>

            <aside class="p1-detail">
                <div class="detail-panel">
                    <div v-if="!store.project" class="detail-empty">{{ t('p1.detail.empty') }}</div>
                    <template v-else>
                        <div class="detail-head">
                            <div class="detail-title">{{ store.project.name }}</div>
                            <span class="badge" :class="statusClass(store.project.status)">{{ t('status.' + store.project.status) }}</span>
                        </div>
                        <div class="detail-code">{{ store.project.code }}</div>
                        <div class="prepared-note"><span class="dot ok"></span>{{ t('status.prepared') }}</div>
                        <div class="detail-grid">
                            <div><i>{{ t('p1.col.total') }}</i><b>{{ store.project.total_components }}</b></div>
                            <div><i>{{ t('p1.col.prepared') }}</i><b>{{ store.project.prepared_components }}</b></div>
                            <div><i>{{ t('p1.col.by') }}</i><b>{{ store.project.prepared_by }}</b></div>
                            <div><i>{{ t('p1.col.time') }}</i><b>{{ store.project.prepared_at }}</b></div>
                        </div>
                        <div class="detail-comps-title">{{ t('p1.components') }} <span class="muted">({{ store.project.components.length }})</span></div>
                        <div class="detail-comps">
                            <div v-for="comp in store.project.components" :key="comp.id" class="comp-row">
                                <span class="comp-mark">{{ comp.mark }}</span>
                                <span class="comp-spec">{{ comp.spec }}</span>
                                <span class="comp-len">{{ (comp.length_mm / 1000).toFixed(2) }} {{ t('common.m') }}</span>
                            </div>
                        </div>
                        <button class="btn btn-primary btn-lg enter-binding" :disabled="store.project.status === 'expired'" @click="enterBinding">
                            {{ t('p1.enterBinding') }} <span class="arrow">→</span>
                        </button>
                    </template>
                </div>
            </aside>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from '../i18n';
import { Store, store } from '../store';
import * as api from '../mock/api';
import { toast } from '../composables/useToast';
import { useWorkflowNav } from '../composables/useWorkflow';
import type { ProjectStatus } from '../mock/types';

const { t } = useI18n();
const { gotoStep } = useWorkflowNav();
const query = ref('');
const importing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function statusClass(status: ProjectStatus): string {
    return status === 'available' ? 'badge-ok' : status === 'pending' ? 'badge-warn' : 'badge-bad';
}

function searchProjects(): void {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { void Store.loadProjects(query.value); }, 160);
}

async function selectProject(id: number): Promise<void> {
    await Store.loadProject(id);
}

async function enterBinding(): Promise<void> {
    if (!store.project) {
        toast(t('p1.selectFirst'), 'warn');
        return;
    }
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
    await Store.loadProjects();
});
</script>
