<template>
    <div v-if="!ready" class="boot">{{ t('loading') }}</div>
    <div v-else-if="!store.session || !store.session.all_bound || !store.session.all_pose_set" class="need-prev">
        <div class="np-title">{{ t('check.needPose') }}</div>
        <button class="np-btn" @click="gotoStep(3)">{{ t('step.3') }} →</button>
    </div>
    <BeamWorkspace
        v-else
        ref="workspaceRef"
        :slot-detail="slotDetail"
        :show-alarm="alarmActive"
        @ready="applyDeviation"
    >
        <template #op="{ slot }">
            <div v-if="slot?.component_id" class="dev-panel">
                <div v-if="checking" class="dev-loading">
                    <span class="dev-spin"></span>
                    <span class="dev-loading-txt">{{ t('checking') }}</span>
                </div>

                <div class="dev-body">
                    <div class="dev-head">
                        <span class="dev-eyebrow">{{ t('check.title') }}</span>
                        <button class="dev-demo" @click="toggleDemo">{{ t('check.demoToggle') }}</button>
                    </div>

                    <div class="dev-hero" :class="heroVals(slot).tone">
                        <div class="dev-hero-result">{{ heroVals(slot).result }}</div>
                        <div class="dev-hero-num">
                            <span class="dev-hero-val lg-mono">{{ heroVals(slot).val }}</span>
                            <span class="dev-hero-unit">mm</span>
                        </div>
                        <div class="dev-hero-sub">{{ t('check.maxDev') }} · {{ t('check.threshold') }} 3.0 mm</div>
                    </div>

                    <div class="dev-rows">
                        <div class="dev-row">
                            <span class="dev-k">{{ t('slot') }}</span>
                            <span class="dev-v lg-mono">{{ slot.slot_no }} · {{ slot.component?.mark }}</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-k">{{ t('targets') }}</span>
                            <span class="dev-v lg-mono">12 / 12</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-k">{{ t('recog.recogPanel') }}</span>
                            <span class="dev-v">{{ t('recog.recogOk') }}</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-k">{{ t('check.maxDev') }}</span>
                            <span class="dev-v lg-mono" :style="{ color: heroVals(slot).color }">{{ heroVals(slot).val }} mm</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-k">{{ t('check.threshold') }}</span>
                            <span class="dev-v lg-mono">3.0 mm</span>
                        </div>
                        <div class="dev-row">
                            <span class="dev-k">{{ t('check.title') }}</span>
                            <span class="dev-v" :style="{ color: heroVals(slot).color }">{{ heroVals(slot).result }}</span>
                        </div>
                    </div>

                    <div v-if="heroVals(slot).isAlarm" class="dev-alarm">
                        <div class="dev-alarm-title">⛔ {{ t('check.alarmTitle') }}</div>
                        <div class="dev-alarm-desc">{{ t('check.alarmDesc') }}</div>
                    </div>
                </div>

                <div class="dev-foot">
                    <button class="dev-cta" :class="{ disabled: blocked(slot) }" :disabled="blocked(slot)" @click="goProjection">
                        {{ t('check.enterProj') }} →
                    </button>
                    <button class="dev-recheck" @click="recheck">{{ t('check.checkAgain') }}</button>
                </div>
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

// Frontend-only demo: flips the active beam between its real value and an alarm (>3mm) value for presentation.
const demoAlarm = ref(false);
const DEMO_ALARM_VALUE = 4.8;

const alarmActive = ref(false);

interface HeroVals {
    val: string;
    result: string;
    color: string;
    tone: 'pass' | 'near' | 'out';
    isAlarm: boolean;
}

function isOut(slot: SlotDTO): boolean {
    return slot.check_result === 'out' || demoAlarm.value;
}

function heroVals(slot: SlotDTO): HeroVals {
    const out = isOut(slot);
    const value = out ? Math.max(slot.max_deviation, DEMO_ALARM_VALUE) : slot.max_deviation;
    const near = !out && slot.max_deviation > 2.4;
    if (out) {
        return { val: value.toFixed(1), result: t('check.out'), color: '#f2545b', tone: 'out', isAlarm: true };
    }
    if (near) {
        return { val: value.toFixed(1), result: t('check.near'), color: '#f5b53d', tone: 'near', isAlarm: false };
    }
    return { val: value.toFixed(1), result: t('check.pass'), color: '#37d27a', tone: 'pass', isAlarm: false };
}

function blocked(slot: SlotDTO): boolean {
    return isOut(slot) || !!store.session?.has_out_of_tolerance;
}

function badgeResult(slot: SlotDTO | null | undefined): CheckResult {
    return slot?.check_result ?? 'pending';
}

function slotDetail(slot: SlotDTO) {
    if (slot.component_id == null) return { line: `<span class="muted">${t('p2.unbound')}</span>` };
    if (!slot.checked) return { line: '<span class="muted">-</span>' };
    const result = badgeResult(slot);
    const cls = result === 'pass' ? 'ok' : result === 'near' ? 'warn' : 'bad';
    return { line: `${slot.max_deviation.toFixed(1)} mm`, status: t('check.' + result), dotCls: cls, statusCls: cls };
}

function applyDeviation(): void {
    const slot = Store.selectedSlot();
    if (slot?.checked) {
        const out = isOut(slot);
        const value = out ? Math.max(slot.max_deviation, DEMO_ALARM_VALUE) : slot.max_deviation;
        const result: CheckResult = out ? 'out' : slot.check_result === 'pending' ? 'pass' : slot.check_result;
        workspaceRef.value?.setDeviation({ value, result });
        alarmActive.value = out;
    } else {
        workspaceRef.value?.setDeviation(null);
        alarmActive.value = false;
    }
}

function toggleDemo(): void {
    demoAlarm.value = !demoAlarm.value;
    applyDeviation();
}

async function recheck(): Promise<void> {
    if (!store.session) return;
    checking.value = true;
    demoAlarm.value = false;
    try {
        await new Promise((resolve) => setTimeout(resolve, 480));
        Store.setSession(await api.runCheck(store.session.id));
        toast(t('check.rechecked'), 'ok');
        applyDeviation();
    } finally {
        checking.value = false;
    }
}

async function goProjection(): Promise<void> {
    const slot = Store.selectedSlot();
    if ((slot && isOut(slot)) || store.session?.has_out_of_tolerance) {
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

<style scoped>
.boot,
.need-prev {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #8a8f99;
    font-size: 13px;
}
.np-title {
    font-size: 14px;
    color: #aeb2bb;
    font-weight: 600;
}
.np-btn {
    height: 42px;
    padding: 0 22px;
    background: #3d66f0;
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(61, 102, 240, 0.4);
}

/* ---- Deviation operation panel ---- */
.dev-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    position: relative;
}

.dev-loading {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 13px;
    background: rgba(16, 17, 21, 0.82);
    backdrop-filter: blur(2px);
}
.dev-spin {
    width: 34px;
    height: 34px;
    border: 3px solid rgba(255, 255, 255, 0.14);
    border-top-color: #3d66f0;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
.dev-loading-txt {
    font-size: 12.5px;
    color: #aeb2bb;
    font-weight: 600;
}

.dev-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 22px 20px;
    position: relative;
}

.dev-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
}
.dev-eyebrow {
    font-size: 11px;
    letter-spacing: 1px;
    color: #7f848e;
    font-weight: 600;
}
.dev-demo {
    font-size: 10.5px;
    color: #8a8f99;
    background: #1a1d22;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 4px 9px;
    cursor: pointer;
}

.dev-hero {
    text-align: center;
    padding: 20px;
    border-radius: 12px;
    background: rgba(55, 210, 122, 0.08);
    border: 1px solid rgba(55, 210, 122, 0.28);
}
.dev-hero.near {
    background: rgba(245, 181, 61, 0.08);
    border-color: rgba(245, 181, 61, 0.28);
}
.dev-hero.out {
    background: rgba(242, 84, 91, 0.1);
    border-color: rgba(242, 84, 91, 0.4);
}
.dev-hero-result {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    color: #37d27a;
}
.dev-hero.near .dev-hero-result {
    color: #f5b53d;
}
.dev-hero.out .dev-hero-result {
    color: #f2545b;
}
.dev-hero-num {
    display: flex;
    align-items: baseline;
    gap: 6px;
    justify-content: center;
}
.dev-hero-val {
    font-size: 38px;
    font-weight: 700;
    color: #fff;
    line-height: 1;
}
.dev-hero-unit {
    font-size: 15px;
    color: #8a8f99;
    font-weight: 600;
}
.dev-hero-sub {
    font-size: 11px;
    color: #7f848e;
    margin-top: 4px;
}

.dev-rows {
    display: flex;
    flex-direction: column;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    margin-top: 16px;
}
.dev-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.dev-k {
    font-size: 12.5px;
    color: #7f848e;
}
.dev-v {
    font-size: 13px;
    font-weight: 600;
    color: #dfe2e8;
}

.dev-alarm {
    margin-top: 16px;
    padding: 14px;
    background: rgba(242, 84, 91, 0.12);
    border: 1px solid rgba(242, 84, 91, 0.4);
    border-radius: 10px;
    animation: cad-blink 1.4s infinite;
}
.dev-alarm-title {
    font-size: 12.5px;
    color: #ff8a8f;
    font-weight: 700;
    margin-bottom: 4px;
}
.dev-alarm-desc {
    font-size: 12px;
    color: #e6a8ab;
    line-height: 1.5;
}

.dev-foot {
    flex: none;
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    display: flex;
    flex-direction: column;
    gap: 9px;
}
.dev-cta {
    height: 46px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    color: #fff;
    background: #3d66f0;
    box-shadow: 0 4px 16px rgba(61, 102, 240, 0.4);
}
.dev-cta.disabled {
    cursor: not-allowed;
    background: #2a2d33;
    opacity: 0.5;
    box-shadow: none;
}
.dev-recheck {
    height: 40px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: #aeb2bb;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
}
.dev-recheck:hover {
    background: #15171c;
    border-color: rgba(255, 255, 255, 0.2);
}
</style>
