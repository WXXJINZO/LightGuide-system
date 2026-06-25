<template>
    <div v-if="!ready" class="boot">Loading...</div>
    <div v-else-if="!store.session || !store.session.all_bound || !store.session.all_checked || store.session.has_out_of_tolerance" class="need-prev">
        <div class="np-title">{{ t('proj.needCheck') }}</div>
        <button class="btn btn-primary" @click="gotoStep(4)">{{ t('step.4') }} →</button>
    </div>
    <BeamWorkspace
        v-else
        ref="workspaceRef"
        :slot-detail="slotDetail"
        :show-projection="true"
        :show-preview-toggle="true"
        :show-bom="true"
        side-class="proj"
    >
        <template #op="{ slot, component, viewer }">
            <div v-if="slot?.component_id && component" class="op-card">
                <div class="part-list-head">{{ t('proj.partList') }} <span class="muted">({{ faceParts(component, slot).length }})</span></div>
                <div class="part-list">
                    <div
                        v-for="part in faceParts(component, slot)"
                        :key="part.id"
                        class="part-row"
                        :class="{ on: selectedPartId === String(part.id) }"
                        @click="selectPart(String(part.id), viewer)"
                    >
                        <span class="part-num">{{ part.number }}</span>
                        <span class="part-loc">{{ (part.position_mm / 1000).toFixed(2) }} {{ t('common.m') }}</span>
                        <span class="part-type">{{ t('type.' + part.type) }}</span>
                    </div>
                    <div v-if="!faceParts(component, slot).length" class="empty">{{ t('pose.none') }}</div>
                </div>
                <div class="proj-controls">
                    <button v-if="store.session.projection_state === 'projecting'" class="btn proj-btn proj-pause" @click="projectionAction('pause')">⏸ {{ t('proj.pause') }}</button>
                    <button v-else-if="store.session.projection_state === 'paused'" class="btn proj-btn proj-start" @click="projectionAction('resume')">▶ {{ t('proj.resume') }}</button>
                    <button v-else class="btn proj-btn proj-start" @click="projectionAction('start')">▶ {{ t('proj.start') }}</button>
                    <button class="btn proj-btn proj-complete" :disabled="store.session.projection_state === 'idle'" @click="confirmOpen = true">✓ {{ t('proj.complete') }}</button>
                </div>
            </div>
        </template>
    </BeamWorkspace>

    <div v-if="confirmOpen" class="modal-backdrop" @click.self="confirmOpen = false">
        <div class="modal">
            <div class="modal-title">{{ t('proj.confirmTitle') }}</div>
            <div class="modal-body">{{ t('proj.confirmBody') }}</div>
            <div class="modal-actions">
                <button class="btn" @click="confirmOpen = false">{{ t('common.cancel') }}</button>
                <button class="btn btn-primary" @click="completeProjection">{{ t('proj.confirm') }}</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { LightGuideViewerApi } from '@/projects/lightguide';
import BeamWorkspace from '../components/BeamWorkspace.vue';
import { useI18n } from '../i18n';
import * as api from '../api/client';
import { Store, store } from '../store';
import { toast } from '../composables/useToast';
import { useWorkflowNav } from '../composables/useWorkflow';
import type { ComponentFull, ProjectionStatus, SecondaryDTO, SlotDTO } from '../api/types';

const { t } = useI18n();
const { gotoStep, router } = useWorkflowNav();
const workspaceRef = ref<InstanceType<typeof BeamWorkspace> | null>(null);
const ready = ref(false);
const selectedPartId = ref<string | null>(null);
const confirmOpen = ref(false);

function slotDetail(slot: SlotDTO) {
    if (slot.component_id == null) return { line: `<span class="muted">${t('p2.unbound')}</span>` };
    const ps: ProjectionStatus = slot.projection_status;
    const statusKey = ps === 'projecting' ? 'proj.projecting' : ps === 'paused' ? 'proj.paused' : ps === 'completed' ? 'proj.completed' : 'proj.ready';
    const dotCls = ps === 'paused' ? 'warn' : 'on';
    const statusCls = ps === 'projecting' ? 'projecting' : ps === 'paused' ? 'warn' : 'ok';
    return {
        line: `${workspaceRef.value?.faceLabel(slot.assembly_face) ?? slot.assembly_face} · ${slot.component?.faceCount ?? 0} ${t('proj.parts')}`,
        status: t(statusKey),
        dotCls,
        statusCls
    };
}

function faceParts(component: ComponentFull, slot: SlotDTO): SecondaryDTO[] {
    return component.secondary
        .filter((part) => part.face === slot.assembly_face)
        .sort((a, b) => a.position_mm - b.position_mm);
}

function selectPart(id: string, viewer: LightGuideViewerApi | null): void {
    selectedPartId.value = id;
    viewer?.setSelected(id);
}

async function projectionAction(action: 'start' | 'pause' | 'resume'): Promise<void> {
    if (!store.session) return;
    Store.setSession(await api.projectionAction(store.session.id, action));
    toast(t(action === 'start' ? 'proj.started' : action === 'pause' ? 'proj.paused2' : 'proj.resumed'), action === 'pause' ? 'warn' : 'ok');
}

async function completeProjection(): Promise<void> {
    if (!store.session) return;
    confirmOpen.value = false;
    Store.setSession(await api.projectionAction(store.session.id, 'complete'));
    toast(t('proj.faceDone'), 'ok');
    await gotoStep(3);
}

onMounted(async () => {
    await Store.refreshSession();
    if (!store.session) {
        await router.push({ name: 'lg-select' });
        return;
    }
    store.previewMode = 'projection';
    ready.value = true;
});
</script>
