<template>
    <div v-if="!ready" class="boot">{{ t('loading') }}</div>
    <div v-else-if="!store.session?.all_bound" class="need-prev">
        <div class="np-title">{{ t('p2.needAll') }}</div>
        <button class="np-btn" @click="gotoStep(2)">{{ t('step.2') }} →</button>
    </div>
    <BeamWorkspace v-else ref="workspaceRef" side-class="pose" :slot-detail="slotDetail">
        <template #op="{ slot, viewer }">
            <div v-if="slot?.component_id" class="pose-op">
                <div class="op-scroll">
                    <div class="op-label">{{ t('pose.title') }}</div>

                    <div class="summary">
                        <div class="summary-row">
                            <span class="sum-k">{{ t('pose.headTail') }}</span>
                            <span class="sum-v dir">{{ t(pending.headTail === 'reversed' ? 'pose.reversed' : 'pose.normal') }}</span>
                        </div>
                        <div class="summary-row last">
                            <span class="sum-k">{{ t('pose.face') }}</span>
                            <span class="sum-v face">{{ faceLabel(pending.assemblyFace) }}</span>
                        </div>
                    </div>

                    <div class="actions">
                        <button class="act-btn" @click="toggleFlip(viewer)">
                            <span class="act-ic blue">⇄</span>
                            <span class="act-txt">
                                <span class="act-t">{{ t('pose.reverse') }}</span>
                                <span class="act-s">{{ t('pose.reverseSub') }}</span>
                            </span>
                        </button>
                        <button class="act-btn" @click="rotateFace(viewer)">
                            <span class="act-ic green">↻</span>
                            <span class="act-txt">
                                <span class="act-t">{{ t('pose.rotateAxis') }}</span>
                                <span class="act-s">{{ t('pose.rotateSub') }}</span>
                            </span>
                        </button>
                    </div>

                    <div class="hint">
                        <span class="hint-ic">↻</span>
                        <span class="hint-txt">{{ t('pose.hint') }}</span>
                    </div>

                    <div class="prog-label">{{ t('pose.faceProgress') }} · {{ t('slot') }} {{ slot.slot_no }}</div>
                    <div class="face-rows">
                        <div v-for="row in faceRows(slot)" :key="row.face" class="face-row" :style="{ borderColor: row.bd }">
                            <span class="fr-left">
                                <span class="fr-ic">{{ row.ic }}</span>{{ faceLabel(row.face) }}
                            </span>
                            <span class="fr-pill" :style="{ color: row.fg, background: row.bg, border: `1px solid ${row.bd}` }">{{ row.txt }}</span>
                        </div>
                    </div>
                </div>

                <div class="op-footer">
                    <button class="foot-secondary" @click="save(true)">{{ t('pose.saveNext') }}</button>
                    <button class="foot-primary" :disabled="!store.session?.all_pose_set" @click="goCheck">
                        {{ t('pose.allSetCheck') }} →
                    </button>
                </div>
            </div>
        </template>
    </BeamWorkspace>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import type { AssemblyFace, HeadTail, LightGuideViewerApi } from '@/projects/lightguide';
import BeamWorkspace from '../components/BeamWorkspace.vue';
import { useI18n } from '../i18n';
import * as api from '../api/client';
import { Store, store } from '../store';
import { toast } from '../composables/useToast';
import { useWorkflowNav } from '../composables/useWorkflow';
import type { SlotDTO } from '../api/types';

const { t } = useI18n();
const { gotoStep, router } = useWorkflowNav();
const ready = ref(false);
const workspaceRef = ref<InstanceType<typeof BeamWorkspace> | null>(null);
const faces: AssemblyFace[] = ['top_flange', 'bottom_flange', 'left_web', 'right_web'];
const faceKeys: Record<AssemblyFace, string> = {
    top_flange: 'face.top',
    bottom_flange: 'face.bottom',
    left_web: 'face.left',
    right_web: 'face.right'
};
const pending = reactive<{ slotNo: number; headTail: HeadTail; assemblyFace: AssemblyFace }>({
    slotNo: 0,
    headTail: 'normal',
    assemblyFace: 'top_flange'
});

function syncPending(slot: SlotDTO | null): void {
    if (!slot || pending.slotNo === slot.slot_no) return;
    pending.slotNo = slot.slot_no;
    pending.headTail = slot.head_tail;
    pending.assemblyFace = slot.assembly_face;
}

function faceLabel(face: AssemblyFace): string {
    return t(faceKeys[face]);
}

function slotDetail(slot: SlotDTO) {
    if (slot.component_id == null) return { line: `<span class="muted">${t('p2.unbound')}</span>` };
    if (slot.pose_set) {
        return {
            line: `${faceLabel(slot.assembly_face)} · ${t(slot.head_tail === 'reversed' ? 'pose.reversed' : 'pose.normal')}`,
            status: t('pose.faceAssembled'),
            dotCls: 'on',
            statusCls: 'ok'
        };
    }
    return { line: `<span class="muted">${t('pose.facePending')}</span>`, status: t('pose.facePending'), dotCls: 'warn', statusCls: 'warn' };
}

function apply(viewer: LightGuideViewerApi | null): void {
    viewer?.setPose({ headTail: pending.headTail, assemblyFace: pending.assemblyFace });
}

function setHeadTail(value: HeadTail, viewer: LightGuideViewerApi | null): void {
    pending.headTail = value;
    apply(viewer);
}

function setFace(value: AssemblyFace, viewer: LightGuideViewerApi | null): void {
    pending.assemblyFace = value;
    apply(viewer);
}

// 头尾翻转 — toggle headTail normal <-> reversed (prototype toggleFlip)
function toggleFlip(viewer: LightGuideViewerApi | null): void {
    setHeadTail(pending.headTail === 'reversed' ? 'normal' : 'reversed', viewer);
}

// 绕轴旋转 90° — cycle assembly face (prototype roll +90: top->leftWeb->bottom->rightWeb)
const faceCycle: Record<AssemblyFace, AssemblyFace> = {
    top_flange: 'left_web',
    left_web: 'bottom_flange',
    bottom_flange: 'right_web',
    right_web: 'top_flange'
};
function rotateFace(viewer: LightGuideViewerApi | null): void {
    setFace(faceCycle[pending.assemblyFace], viewer);
}

interface FaceRow {
    face: AssemblyFace;
    ic: string;
    txt: string;
    fg: string;
    bg: string;
    bd: string;
}
const faceIc: Record<AssemblyFace, string> = {
    top_flange: '▀',
    bottom_flange: '▄',
    left_web: '▌',
    right_web: '▐'
};
function faceRows(slot: SlotDTO): FaceRow[] {
    const done = slot.completedFaces;
    const cur = slot.pose_set || slot.slot_no === pending.slotNo ? pending.assemblyFace : null;
    return faces.map((face) => {
        const isDone = done.includes(face);
        const isCur = cur === face && !isDone;
        if (isDone) {
            return { face, ic: faceIc[face], txt: t('pose.faceAssembled'), fg: '#37d27a', bg: 'rgba(55,210,122,.12)', bd: 'rgba(55,210,122,.3)' };
        }
        if (isCur) {
            return { face, ic: faceIc[face], txt: t('pose.faceCurrent'), fg: '#7fa7ff', bg: 'rgba(61,102,240,.14)', bd: 'rgba(61,102,240,.4)' };
        }
        return { face, ic: faceIc[face], txt: t('pose.facePending'), fg: '#8a8f99', bg: 'rgba(255,255,255,.05)', bd: 'rgba(255,255,255,.12)' };
    });
}

async function save(advance: boolean): Promise<void> {
    if (!store.session) return;
    const slotNo = store.selectedSlotNo;
    Store.setSession(await api.setPose(store.session.id, slotNo, { headTail: pending.headTail, assemblyFace: pending.assemblyFace }));
    toast(t('pose.saved', slotNo), 'ok');
    if (advance) {
        const next = store.session.slots.find((slot) => slot.component_id != null && slot.pose_set === 0);
        if (next) {
            await workspaceRef.value?.switchBeam(next.slot_no);
            return;
        }
    }
    syncPending(Store.selectedSlot());
    workspaceRef.value?.setPoseFromSlot();
}

async function goCheck(): Promise<void> {
    if (!store.session?.all_pose_set) {
        toast(t('pose.needAllSet'), 'warn');
        return;
    }
    await gotoStep(4);
}

watch(() => store.selectedSlotNo, () => {
    syncPending(Store.selectedSlot());
});

onMounted(async () => {
    await Store.refreshSession();
    if (!store.session) {
        await router.push({ name: 'lg-select' });
        return;
    }
    if (!store.session.all_bound) {
        ready.value = true;
        return;
    }
    store.selectedSlotNo = store.session.slots.find((slot) => slot.component_id != null && slot.pose_set === 0)?.slot_no
        ?? store.session.slots.find((slot) => slot.component_id != null)?.slot_no
        ?? 1;
    syncPending(Store.selectedSlot());
    ready.value = true;
});
</script>

<style scoped>
.boot {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8a8f99;
    font-size: 13px;
}

.need-prev {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
}

.np-title {
    font-size: 14px;
    color: #aeb2bb;
}

.np-btn {
    height: 46px;
    padding: 0 22px;
    background: #3d66f0;
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(61, 102, 240, .4);
}

/* ---- pose operation panel (#op slot) ---- */
.pose-op {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.op-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 22px 18px;
}

.op-label {
    font-size: 11px;
    letter-spacing: 1px;
    color: #7f848e;
    font-weight: 600;
    margin-bottom: 14px;
}

.summary {
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .08);
    border-radius: 11px;
    padding: 14px;
    margin-bottom: 16px;
}

.summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 11px;
}

.summary-row.last {
    margin-bottom: 0;
}

.sum-k {
    font-size: 12px;
    color: #7f848e;
}

.sum-v {
    font-size: 13px;
    font-weight: 600;
}

.sum-v.dir {
    color: #7fa7ff;
}

.sum-v.face {
    color: #37d27a;
}

.actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.act-btn {
    height: 58px;
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 0 16px;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .12);
    border-radius: 11px;
    color: #eef0f4;
    cursor: pointer;
    text-align: left;
}

.act-ic {
    font-size: 22px;
}

.act-ic.blue {
    color: #7fa7ff;
}

.act-ic.green {
    color: #37d27a;
}

.act-txt {
    display: flex;
    flex-direction: column;
}

.act-t {
    font-size: 13.5px;
    font-weight: 600;
}

.act-s {
    font-size: 10.5px;
    color: #7f848e;
}

.hint {
    margin-top: 16px;
    padding: 12px 13px;
    background: rgba(61, 102, 240, .08);
    border: 1px solid rgba(61, 102, 240, .22);
    border-radius: 10px;
    display: flex;
    gap: 9px;
    align-items: flex-start;
}

.hint-ic {
    font-size: 14px;
    color: #9db6ff;
    line-height: 1.5;
}

.hint-txt {
    font-size: 11.5px;
    color: #9db6ff;
    line-height: 1.5;
}

.prog-label {
    font-size: 11px;
    letter-spacing: 1px;
    color: #7f848e;
    font-weight: 600;
    margin: 18px 0 9px;
}

.face-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.face-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 11px;
    border-radius: 9px;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .12);
}

.fr-left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #c4c8d0;
}

.fr-ic {
    font-size: 13px;
}

.fr-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10.5px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 999px;
    white-space: nowrap;
}

.op-footer {
    flex: none;
    padding: 16px 18px;
    border-top: 1px solid rgba(255, 255, 255, .07);
    display: flex;
    flex-direction: column;
    gap: 9px;
}

.foot-secondary {
    height: 42px;
    background: #22252b;
    border: 1px solid rgba(255, 255, 255, .12);
    border-radius: 10px;
    color: #eef0f4;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}

.foot-primary {
    height: 46px;
    background: #3d66f0;
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(61, 102, 240, .4);
}

.foot-primary:disabled {
    background: #2a2d33;
    opacity: .5;
    box-shadow: none;
    cursor: not-allowed;
}
</style>
