<template>
    <div v-if="!ready" class="boot">Loading...</div>
    <div v-else-if="!store.session?.all_bound" class="need-prev">
        <div class="np-title">{{ t('p2.needAll') }}</div>
        <button class="btn btn-primary" @click="gotoStep(2)">{{ t('step.2') }} →</button>
    </div>
    <BeamWorkspace v-else ref="workspaceRef" :slot-detail="slotDetail">
        <template #op="{ slot, viewer }">
            <div v-if="slot?.component_id" class="op-card">
                <div class="op-title">{{ t('pose.title') }}</div>
                <div class="op-hint">{{ t('pose.hint') }}</div>
                <div class="op-group">
                    <div class="op-label">{{ t('pose.headTail') }}</div>
                    <div class="seg">
                        <button class="seg-btn" :class="{ on: pending.headTail === 'normal' }" @click="setHeadTail('normal', viewer)">{{ t('pose.normal') }}</button>
                        <button class="seg-btn" :class="{ on: pending.headTail === 'reversed' }" @click="setHeadTail('reversed', viewer)">{{ t('pose.reversed') }}</button>
                    </div>
                </div>
                <div class="op-group">
                    <div class="op-label">{{ t('pose.face') }}</div>
                    <div class="face-grid">
                        <button v-for="face in faces" :key="face" class="face-btn" :class="{ on: pending.assemblyFace === face }" @click="setFace(face, viewer)">
                            {{ faceLabel(face) }}
                        </button>
                    </div>
                </div>
                <div class="op-status">
                    <div><span>{{ t('pose.status') }}</span><b :class="slot.pose_set ? 'ok' : 'warn'">{{ t(slot.pose_set ? 'pose.set' : 'pose.notSet') }}</b></div>
                    <div><span>{{ t('pose.completedFaces') }}</span><b>{{ completedFaces(slot) }}</b></div>
                </div>
                <div class="op-actions">
                    <button class="btn btn-sm" @click="save(false)">{{ t('pose.save') }}</button>
                    <button class="btn btn-sm btn-primary" @click="save(true)">{{ t('pose.saveNext') }}</button>
                </div>
                <button class="btn btn-lg btn-accent op-go" :disabled="!store.session?.all_pose_set" @click="goCheck">
                    {{ t(store.session?.all_pose_set ? 'pose.allConfirmed' : 'pose.needAllSet') }} <span class="arrow">→</span>
                </button>
            </div>
        </template>
    </BeamWorkspace>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import type { AssemblyFace, HeadTail, LightGuideViewerApi } from '@/projects/lightguide';
import BeamWorkspace from '../components/BeamWorkspace.vue';
import { useI18n } from '../i18n';
import * as api from '../mock/api';
import { Store, store } from '../store';
import { toast } from '../composables/useToast';
import { useWorkflowNav } from '../composables/useWorkflow';
import type { SlotDTO } from '../mock/types';

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
            status: t('pose.set'),
            dotCls: 'on',
            statusCls: 'ok'
        };
    }
    return { line: `<span class="muted">${t('pose.notSet')}</span>`, status: t('pose.notSet'), dotCls: 'warn', statusCls: 'warn' };
}

function completedFaces(slot: SlotDTO): string {
    return slot.completedFaces.map(faceLabel).join('、') || t('pose.none');
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
