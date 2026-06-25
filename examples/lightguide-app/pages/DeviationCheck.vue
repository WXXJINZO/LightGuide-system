<template>
    <div v-if="!ready" class="boot">Loading...</div>
    <div v-else-if="!store.session || !store.session.all_bound || !store.session.all_pose_set" class="need-prev">
        <div class="np-title">{{ t('check.needPose') }}</div>
        <button class="btn btn-primary" @click="gotoStep(3)">{{ t('step.3') }} →</button>
    </div>
    <BeamWorkspace
        v-else
        ref="workspaceRef"
        :slot-detail="slotDetail"
        :show-alarm="store.session.has_out_of_tolerance"
        @ready="applyDeviation"
    >
        <template #op="{ slot }">
            <div v-if="slot?.component_id" id="dev-card" class="op-card" :class="{ 'panel-loading': checking }">
                <div class="op-title">{{ t('check.title') }}</div>
                <div class="op-hint">{{ t('check.subtitle') }}</div>
                <div class="dev-big" :class="slot.check_result">{{ slot.checked ? `${slot.max_deviation.toFixed(1)} mm` : '-' }}</div>
                <div class="dev-rows">
                    <div class="dev-row"><span>{{ t('p2.slot') }}</span><b>{{ slot.slot_no }} · {{ slot.component?.mark }}</b></div>
                    <div class="dev-row"><span>{{ t('check.targetCount') }}</span><b>12 / 12</b></div>
                    <div class="dev-row"><span>{{ t('check.status') }}</span><b class="ok">{{ t('check.registered') }}</b></div>
                    <div class="dev-row"><span>{{ t('check.threshold') }}</span><b>3.0 mm</b></div>
                    <div class="dev-row"><span>{{ t('check.result') }}</span><span class="badge" :class="badgeClass(slot.check_result)">{{ t('check.' + slot.check_result) }}</span></div>
                </div>
                <div class="op-actions"><button class="btn btn-sm" @click="recheck">{{ t('check.recheck') }}</button></div>
                <button class="btn btn-lg btn-accent op-go" :disabled="store.session.has_out_of_tolerance" @click="goProjection">
                    {{ t(store.session.has_out_of_tolerance ? 'check.blocked' : 'check.toPreview') }} <span class="arrow">→</span>
                </button>
            </div>
        </template>
    </BeamWorkspace>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import BeamWorkspace from '../components/BeamWorkspace.vue';
import { useI18n } from '../i18n';
import * as api from '../api/client';
import { Store, store } from '../store';
import { toast } from '../composables/useToast';
import { useWorkflowNav } from '../composables/useWorkflow';
import type { CheckResult, SlotDTO } from '../api/types';

const { t } = useI18n();
const { gotoStep, router } = useWorkflowNav();
const workspaceRef = ref<InstanceType<typeof BeamWorkspace> | null>(null);
const ready = ref(false);
const checking = ref(false);

function badgeClass(result: CheckResult): string {
    return result === 'pass' ? 'badge-ok' : result === 'near' ? 'badge-warn' : result === 'out' ? 'badge-bad' : 'badge-muted';
}

function slotDetail(slot: SlotDTO) {
    if (slot.component_id == null) return { line: `<span class="muted">${t('p2.unbound')}</span>` };
    if (!slot.checked) return { line: '<span class="muted">-</span>' };
    const cls = slot.check_result === 'pass' ? 'ok' : slot.check_result === 'near' ? 'warn' : 'bad';
    return { line: `${slot.max_deviation.toFixed(1)} mm`, status: t('check.' + slot.check_result), dotCls: cls, statusCls: cls };
}

function applyDeviation(): void {
    const slot = Store.selectedSlot();
    workspaceRef.value?.setDeviation(slot?.checked ? { value: slot.max_deviation, result: slot.check_result === 'pending' ? 'pass' : slot.check_result } : null);
}

async function recheck(): Promise<void> {
    if (!store.session) return;
    checking.value = true;
    try {
        await new Promise((resolve) => setTimeout(resolve, 480));
        Store.setSession(await api.runCheck(store.session.id));
        toast(t('check.done'), 'ok');
        applyDeviation();
    } finally {
        checking.value = false;
    }
}

async function goProjection(): Promise<void> {
    if (store.session?.has_out_of_tolerance) {
        toast(t('check.blocked'), 'bad');
        return;
    }
    await gotoStep(5);
}

onMounted(async () => {
    await Store.refreshSession();
    if (!store.session) {
        await router.push({ name: 'lg-select' });
        return;
    }
    if (store.session.all_bound && store.session.all_pose_set && !store.session.all_checked) {
        Store.setSession(await api.runCheck(store.session.id));
    }
    ready.value = true;
});
</script>
