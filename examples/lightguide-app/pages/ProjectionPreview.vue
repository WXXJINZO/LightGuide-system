<template>
    <div v-if="!ready" class="boot">{{ t('loading') }}</div>
    <div v-else-if="!store.session || !store.session.all_bound || !store.session.all_checked || store.session.has_out_of_tolerance" class="need-prev">
        <div class="np-title">{{ t('check.blocked') }}</div>
        <button class="np-btn" @click="gotoStep(4)">{{ t('step.4') }} →</button>
    </div>
    <BeamWorkspace
        v-else
        ref="workspaceRef"
        :slot-detail="slotDetail"
        :show-projection="true"
        :show-preview-toggle="true"
        :show-bom="false"
        side-class="proj"
        @viewer-select="onViewerSelect"
    >
        <template #op="{ component, viewer }">
            <div v-if="component" class="proj-panel">
                <div class="pp-head">
                    <span class="pp-head-ico">▤</span>
                    <span class="pp-head-title">{{ t('bom.title') }}</span>
                    <span class="pp-head-count">{{ bomRows(component).length }}</span>
                    <div class="pp-head-spacer"></div>
                    <span class="pp-head-caret">⌄</span>
                </div>

                <div class="pp-colhead">
                    <span>{{ t('bom.col.id') }}</span>
                    <span>{{ t('bom.col.spec') }}</span>
                    <span class="r">{{ t('bom.col.length') }}</span>
                    <span>{{ t('bom.col.material') }}</span>
                    <span class="r">{{ t('bom.col.unit') }}</span>
                    <span class="r">{{ t('bom.col.qty') }}</span>
                </div>

                <div class="pp-rows">
                    <button
                        v-for="part in bomRows(component)"
                        :key="part.part_id"
                        class="pp-row"
                        :class="{ on: selectedPartId === part.part_id }"
                        @click="selectPart(part.part_id, component, viewer)"
                    >
                        <span class="pp-id-wrap">
                            <span class="pp-id" :class="{ blue: selectedPartId === part.part_id || part.is_primary }">{{ part.part_id }}</span>
                            <span v-if="part.is_primary" class="pp-tag">{{ t('bom.primary') }}</span>
                        </span>
                        <span class="pp-spec">{{ part.spec }}</span>
                        <span class="pp-len">{{ part.length_mm }}</span>
                        <span class="pp-mat">{{ part.material }}</span>
                        <span class="pp-kg">{{ part.unit_kg.toFixed(1) }}</span>
                        <span class="pp-qty">{{ part.qty }}</span>
                    </button>
                </div>

                <div class="pp-total">
                    <span class="pp-total-label">{{ t('bom.total') }}</span>
                    <span class="pp-total-val">{{ component.total_weight.toFixed(1) }} kg</span>
                </div>

                <div class="pp-actions">
                    <button
                        v-if="store.session && store.session.projection_state === 'projecting'"
                        class="pp-project pp-project-pause"
                        @click="projectionAction('pause')"
                    >⏸ {{ t('proj.pauseProj') }}</button>
                    <button
                        v-else-if="store.session && store.session.projection_state === 'paused'"
                        class="pp-project pp-project-start"
                        @click="projectionAction('resume')"
                    >▶ {{ t('proj.continueProj') }}</button>
                    <button
                        v-else
                        class="pp-project pp-project-start"
                        @click="projectionAction('start')"
                    >▶ {{ t('proj.startProj') }}</button>
                    <button class="pp-complete" @click="confirmOpen = true">✓ {{ t('proj.completeProj') }}</button>
                </div>
            </div>
        </template>
    </BeamWorkspace>

    <div v-if="confirmOpen" class="pp-backdrop" @click.self="confirmOpen = false">
        <div class="pp-modal">
            <div class="pp-modal-head">
                <div class="pp-modal-ico">✓</div>
                <div class="pp-modal-title">{{ t('proj.confirmCompleteTitle') }}</div>
            </div>
            <p class="pp-modal-body">{{ t('proj.completeHint') }}</p>
            <div class="pp-modal-actions">
                <button class="pp-modal-cancel" @click="confirmOpen = false">{{ t('cancel') }}</button>
                <button class="pp-modal-confirm" @click="completeProjection">✓ {{ t('confirm') }}</button>
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
import type { BomPart, ComponentFull, ProjectionStatus, SlotDTO } from '../api/types';

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

function bomRows(component: ComponentFull): BomPart[] {
    return [...component.parts].sort((a, b) => {
        if (a.is_primary !== b.is_primary) return b.is_primary - a.is_primary;
        return a.sort_order - b.sort_order;
    });
}

function selectPart(partId: string, component: ComponentFull, viewer: LightGuideViewerApi | null): void {
    selectedPartId.value = partId;
    const sec = component.secondary.find((s) => s.number === partId);
    viewer?.setSelected(sec ? String(sec.id) : null);
}

function onViewerSelect(id: string | null): void {
    if (id == null) {
        selectedPartId.value = null;
        return;
    }
    const sec = store.session && workspaceRef.value?.component?.secondary.find((s) => String(s.id) === id);
    selectedPartId.value = sec ? sec.number : null;
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
    toast(t('proj.faceCompleted'), 'ok');
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

<style scoped>
.boot {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8a8f99;
    font-size: 14px;
}

.need-prev {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
}
.np-title {
    color: #c4c8d0;
    font-size: 15px;
    font-weight: 600;
}
.np-btn {
    height: 46px;
    padding: 0 24px;
    border: none;
    border-radius: 10px;
    background: #3d66f0;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(61, 102, 240, .4);
}

/* ── Projection BOM panel ─────────────────────────── */
.proj-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.pp-head {
    flex: none;
    height: 58px;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 16px;
    border-bottom: 1px solid rgba(255, 255, 255, .13);
}
.pp-head-ico {
    display: flex;
    width: 22px;
    height: 22px;
    align-items: center;
    justify-content: center;
    color: #aeb2bb;
    font-size: 15px;
}
.pp-head-title {
    font-size: 14.5px;
    font-weight: 700;
    color: #f2f4f8;
    white-space: nowrap;
}
.pp-head-count {
    font-size: 11px;
    font-weight: 600;
    color: #aeb2bb;
    border: 1px solid rgba(255, 255, 255, .2);
    border-radius: 999px;
    padding: 1px 9px;
}
.pp-head-spacer { flex: 1; }
.pp-head-caret {
    color: #6b707a;
    font-size: 15px;
}

.pp-colhead {
    flex: none;
    display: grid;
    grid-template-columns: 92px 1fr 40px 46px 46px 20px;
    gap: 5px;
    padding: 9px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, .1);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6b707a;
}
.pp-colhead .r { text-align: right; }

.pp-rows {
    flex: 1;
    min-height: 96px;
    overflow: auto;
}
.pp-row {
    display: grid;
    grid-template-columns: 92px 1fr 40px 46px 46px 20px;
    align-items: center;
    gap: 5px;
    width: 100%;
    text-align: left;
    cursor: pointer;
    padding: 9px 14px;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, .05);
    background: transparent;
    transition: background .14s ease;
}
.pp-row:hover { background: rgba(255, 255, 255, .04); }
.pp-row.on {
    background: rgba(61, 102, 240, .16);
    box-shadow: inset 2px 0 0 #3d66f0;
}

.pp-id-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.pp-id {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12.5px;
    font-weight: 700;
    color: #eef0f4;
}
.pp-id.blue { color: #7fa7ff; }
.pp-tag {
    flex: none;
    align-items: center;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .5px;
    color: #7fa7ff;
    background: rgba(61, 102, 240, .12);
    border: 1px solid #3d66f0;
    border-radius: 5px;
    padding: 1px 5px;
    white-space: nowrap;
}
.pp-spec {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #8a8f99;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pp-len {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11.5px;
    color: #dfe2e8;
    text-align: right;
}
.pp-mat {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #8a8f99;
}
.pp-kg {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11.5px;
    color: #aeb2bb;
    text-align: right;
}
.pp-qty {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11.5px;
    color: #dfe2e8;
    text-align: right;
}

.pp-total {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 13px 16px;
    border-top: 1px solid rgba(255, 255, 255, .13);
    background: #0d0e12;
}
.pp-total-label {
    font-size: 12.5px;
    color: #7f848e;
}
.pp-total-val {
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    font-family: 'IBM Plex Mono', monospace;
}

.pp-actions {
    flex: none;
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, .1);
    background: #0d0e12;
}
.pp-project {
    width: 100%;
    height: 50px;
    border: none;
    border-radius: 11px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
}
.pp-project-start {
    color: #fff;
    background: #37d27a;
    box-shadow: 0 4px 18px rgba(55, 210, 122, .4);
}
.pp-project-pause {
    color: #241c00;
    background: #f5b53d;
    box-shadow: 0 4px 18px rgba(245, 181, 61, .4);
}
.pp-complete {
    width: 100%;
    height: 46px;
    margin-top: 10px;
    border: none;
    border-radius: 11px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    color: #fff;
    background: #3d66f0;
    box-shadow: 0 4px 16px rgba(61, 102, 240, .4);
}

/* ── Complete-confirm modal ───────────────────────── */
.pp-backdrop {
    position: absolute;
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
.pp-modal {
    width: 440px;
    max-width: 100%;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .12);
    border-radius: 16px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, .6);
    animation: modalPop .22s cubic-bezier(.2, .9, .3, 1);
    padding: 26px;
}
.pp-modal-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
}
.pp-modal-ico {
    width: 40px;
    height: 40px;
    flex: none;
    border-radius: 11px;
    background: rgba(55, 210, 122, .14);
    border: 1px solid rgba(55, 210, 122, .4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 19px;
    color: #37d27a;
}
.pp-modal-title {
    font-size: 16.5px;
    font-weight: 700;
    color: #e9ebf0;
}
.pp-modal-body {
    font-size: 13px;
    color: #9aa0aa;
    line-height: 1.6;
    margin-bottom: 22px;
}
.pp-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
.pp-modal-cancel {
    height: 44px;
    padding: 0 22px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, .14);
    background: transparent;
    color: #dfe2e8;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all .15s ease;
}
.pp-modal-cancel:hover { background: #22252b; }
.pp-modal-confirm {
    height: 44px;
    padding: 0 24px;
    border-radius: 10px;
    border: none;
    background: #3d66f0;
    color: #fff;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(61, 102, 240, .4);
    transition: all .15s ease;
}
.pp-modal-confirm:hover { filter: brightness(1.08); }
</style>
