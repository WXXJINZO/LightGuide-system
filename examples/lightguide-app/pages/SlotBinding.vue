<template>
    <div v-if="store.session && store.project" class="p2-root">
        <section class="p2-main">
            <div class="p2-eyebrow">{{ t('step') }} 02 · {{ t('p2.title') }}</div>
            <h1 class="p2-h1">{{ t('p2.title') }}</h1>
            <p class="p2-desc">{{ t('p2.desc') }}</p>

            <div class="slot-grid">
                <button
                    v-for="slot in store.session.slots"
                    :key="slot.slot_no"
                    type="button"
                    class="slot-card"
                    :class="{ active: slot.slot_no === activeSlotNo }"
                    @click="activeSlotNo = slot.slot_no"
                >
                    <div class="slot-head">
                        <span class="slot-num" :class="{ active: slot.slot_no === activeSlotNo }">{{ slot.slot_no }}</span>
                        <span class="slot-label">{{ t('slot') }} {{ slot.slot_no }}</span>
                        <span class="slot-spacer"></span>
                        <span
                            class="lg-pill slot-pill"
                            :style="slot.component ? boundPillStyle : emptyPillStyle"
                        >{{ t(slot.component ? 'p2.bound' : 'p2.unbound') }}</span>
                    </div>

                    <div v-if="slot.component" class="slot-body bound">
                        <span class="slot-ico">▣</span>
                        <div class="slot-info">
                            <div class="slot-mark lg-mono">{{ slot.component.mark }}</div>
                            <div class="slot-spec lg-mono">{{ slot.component.spec }} · {{ (slot.component.length_mm / 1000).toFixed(2) }} {{ t('common.m') }}</div>
                        </div>
                        <span class="slot-clear" @click.stop="clear(slot.slot_no)">{{ t('p2.clearBind') }}</span>
                    </div>
                    <div v-else class="slot-body empty">
                        <span class="slot-ico empty">＋</span>
                        <span class="slot-placeholder">{{ t('p2.chooseForSlot') }}</span>
                    </div>
                </button>
            </div>
        </section>

        <aside class="p2-aside">
            <div class="aside-head">
                <div class="aside-title">{{ t('p2.candidates') }}</div>
                <div class="searchbar" :class="{ focused: !!query.trim() }">
                    <span class="search-ico">⌕</span>
                    <input v-model="query" type="text" :placeholder="t('p2.searchComp')" />
                    <span v-if="query.trim()" class="search-clear" @click="query = ''">✕</span>
                </div>
                <div class="aside-meta">
                    <span class="binding-to">{{ t('p2.bindingTo') }} · {{ t('slot') }} {{ activeSlotNo }}</span>
                    <span class="cand-count lg-mono">{{ filteredComponents.length }}/{{ allComponents.length }}</span>
                </div>
            </div>

            <div class="cand-list">
                <button
                    v-for="comp in filteredComponents"
                    :key="comp.id"
                    type="button"
                    class="cand-card"
                    :class="{ onsel: slotsUsing(comp.id).includes(activeSlotNo) }"
                    @click="bind(comp.id)"
                >
                    <span class="cand-ico">▣</span>
                    <div class="cand-info">
                        <div class="cand-mark lg-mono">{{ comp.mark }}</div>
                        <div class="cand-spec lg-mono">{{ comp.spec }} · {{ (comp.length_mm / 1000).toFixed(2) }} {{ t('common.m') }}</div>
                    </div>
                    <span
                        v-if="slotsUsing(comp.id).length"
                        class="lg-pill cand-tag"
                        :style="candTagStyle(comp.id)"
                    >{{ candTagText(comp.id) }}</span>
                </button>

                <div v-if="filteredComponents.length === 0" class="cand-empty">
                    <span class="cand-empty-ico">⃠</span>
                    <span class="cand-empty-text">{{ t('p2.noMatch') }}</span>
                    <span class="cand-empty-clear" @click="query = ''">{{ t('p2.clearSearch') }}</span>
                </div>
            </div>

            <div class="aside-foot">
                <div class="bind-done" :style="bindDoneBoxStyle">
                    <span class="bind-done-dot" :style="{ background: allBound ? '#37d27a' : '#f5b53d' }"></span>
                    <span class="bind-done-text" :style="{ color: allBound ? '#7fe3aa' : '#e6c98a' }">
                        {{ t('p2.completion', boundCount) }}
                    </span>
                </div>
                <button type="button" class="cta" :disabled="!allBound" @click="gotoStep(3)">
                    {{ t('p2.toPose') }} →
                </button>
            </div>
        </aside>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '../i18n';
import * as api from '../api/client';
import { Store, store } from '../store';
import { toast } from '../composables/useToast';
import { useWorkflowNav } from '../composables/useWorkflow';

const { t } = useI18n();
const { gotoStep, router } = useWorkflowNav();
const activeSlotNo = ref(1);
const query = ref('');

const allComponents = computed(() => store.project?.components ?? []);

const filteredComponents = computed(() => {
    const term = query.value.trim().toLowerCase();
    return allComponents.value.filter((c) => !term || c.mark.toLowerCase().includes(term) || c.spec.toLowerCase().includes(term));
});

const boundCount = computed(() => store.session?.bound_count ?? 0);
const allBound = computed(() => !!store.session?.all_bound);

const boundPillStyle = { color: '#37d27a', background: 'rgba(55,210,122,.12)', border: '1px solid rgba(55,210,122,.3)' };
const emptyPillStyle = { color: '#8a8f99', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)' };

const bindDoneBoxStyle = computed(() => allBound.value
    ? { background: 'rgba(55,210,122,.1)', border: '1px solid rgba(55,210,122,.3)' }
    : { background: 'rgba(245,181,61,.08)', border: '1px solid rgba(245,181,61,.25)' });

function slotsUsing(componentId: number): number[] {
    return store.session?.slots.filter((slot) => slot.component_id === componentId).map((slot) => slot.slot_no) ?? [];
}

function candTagText(componentId: number): string {
    const usedIn = slotsUsing(componentId);
    if (usedIn.length === 0) return '';
    if (usedIn.length > 1) return t('p2.duplicate');
    return `${t('slot')} ${usedIn[0]}`;
}

function candTagStyle(componentId: number): Record<string, string> {
    const usedIn = slotsUsing(componentId);
    const multi = usedIn.length > 1;
    const onSel = usedIn.includes(activeSlotNo.value);
    const fg = multi ? '#f5b53d' : (onSel ? '#7fa7ff' : '#37d27a');
    const bg = multi ? 'rgba(245,181,61,.12)' : (onSel ? 'rgba(61,102,240,.14)' : 'rgba(55,210,122,.12)');
    const bd = multi ? 'rgba(245,181,61,.35)' : (onSel ? 'rgba(61,102,240,.4)' : 'rgba(55,210,122,.3)');
    return { color: fg, background: bg, border: `1px solid ${bd}` };
}

async function bind(componentId: number): Promise<void> {
    if (!store.session) return;
    Store.setSession(await api.bindSlot(store.session.id, activeSlotNo.value, componentId));
    const next = store.session.slots.find((slot) => slot.component_id == null);
    activeSlotNo.value = next ? next.slot_no : activeSlotNo.value;
    toast(`${t('slot')} ${activeSlotNo.value} ✓`, 'ok');
}

async function clear(slotNo: number): Promise<void> {
    if (!store.session) return;
    Store.setSession(await api.clearSlot(store.session.id, slotNo));
    activeSlotNo.value = slotNo;
}

onMounted(async () => {
    await Store.refreshSession();
    if (!store.session) {
        await router.push({ name: 'lg-select' });
        return;
    }
    if (!store.project || store.project.id !== store.session.project_id) await Store.loadProject(store.session.project_id);
    activeSlotNo.value = store.session.slots.find((slot) => slot.component_id == null)?.slot_no ?? 1;
});
</script>

<style scoped>
.p2-root {
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
}

/* ── left main ───────────────────────────── */
.p2-main {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 26px 30px;
    animation: riseIn .32s ease both;
}
.p2-eyebrow {
    font-size: 11px;
    letter-spacing: 1.5px;
    color: #3d66f0;
    font-weight: 600;
    margin-bottom: 6px;
}
.p2-h1 {
    font-size: 23px;
    font-weight: 700;
    color: #e9ebf0;
    margin-bottom: 6px;
}
.p2-desc {
    font-size: 13px;
    color: #8a8f99;
    max-width: 620px;
    line-height: 1.55;
    margin-bottom: 20px;
}

.slot-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 13px;
}
.slot-card {
    text-align: left;
    width: 100%;
    cursor: pointer;
    padding: 14px 15px;
    border-radius: 12px;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .08);
    transition: border-color .15s ease, background .15s ease;
}
.slot-card:hover {
    border-color: rgba(61, 102, 240, .45);
}
.slot-card.active {
    background: rgba(61, 102, 240, .09);
    border-color: #3d66f0;
}

.slot-head {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 12px;
}
.slot-num {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    background: #22252b;
    color: #aeb2bb;
}
.slot-num.active {
    background: #3d66f0;
    color: #fff;
}
.slot-label {
    font-size: 12px;
    color: #7f848e;
    font-weight: 600;
}
.slot-spacer {
    flex: 1;
}
.slot-pill {
    font-size: 10.5px;
}

.slot-body {
    display: flex;
    align-items: center;
    gap: 10px;
}
.slot-body.empty {
    color: #6b707a;
    padding: 6px 0;
}
.slot-ico {
    width: 40px;
    height: 40px;
    flex: none;
    border-radius: 8px;
    background: rgba(61, 102, 240, .12);
    border: 1px solid rgba(61, 102, 240, .3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
}
.slot-ico.empty {
    background: transparent;
    border: 1px dashed rgba(255, 255, 255, .18);
}
.slot-info {
    flex: 1;
    text-align: left;
    min-width: 0;
}
.slot-mark {
    font-size: 14px;
    font-weight: 600;
    color: #eef0f4;
}
.slot-spec {
    font-size: 11px;
    color: #7f848e;
}
.slot-clear {
    font-size: 11px;
    color: #8a8f99;
    padding: 5px 9px;
    border-radius: 7px;
    border: 1px solid rgba(255, 255, 255, .12);
    cursor: pointer;
}
.slot-clear:hover {
    color: #e6a8ab;
    border-color: rgba(242, 84, 91, .4);
}
.slot-placeholder {
    font-size: 12.5px;
}

/* ── right aside ─────────────────────────── */
.p2-aside {
    width: 360px;
    flex: none;
    border-left: 1px solid rgba(255, 255, 255, .07);
    background: #101115;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.aside-head {
    flex: none;
    padding: 22px 20px 14px;
}
.aside-title {
    font-size: 11px;
    letter-spacing: 1px;
    color: #7f848e;
    font-weight: 600;
    margin-bottom: 12px;
}
.searchbar {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 40px;
    padding: 0 12px;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .09);
    border-radius: 9px;
    margin-bottom: 10px;
    transition: border-color .15s ease;
}
.searchbar.focused {
    border-color: rgba(61, 102, 240, .5);
}
.search-ico {
    color: #5b606b;
    font-size: 14px;
}
.searchbar input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: #eef0f4;
    font-size: 12.5px;
    font-family: inherit;
}
.searchbar input::placeholder {
    color: #5b606b;
}
.search-clear {
    color: #7f848e;
    font-size: 13px;
    cursor: pointer;
    padding: 2px 4px;
}
.aside-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.binding-to {
    font-size: 11.5px;
    color: #7fa7ff;
    font-weight: 600;
}
.cand-count {
    font-size: 11px;
    color: #6b707a;
}

.cand-list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.cand-card {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    text-align: left;
    cursor: pointer;
    padding: 10px 12px;
    border-radius: 10px;
    transition: all .15s ease;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .08);
}
.cand-card:hover {
    border-color: rgba(61, 102, 240, .5);
    background: #1a1d24;
}
.cand-card.onsel {
    background: rgba(61, 102, 240, .1);
    border-color: #3d66f0;
}
.cand-ico {
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 7px;
    background: #22252b;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    color: #8a8f99;
}
.cand-info {
    flex: 1;
    text-align: left;
    min-width: 0;
}
.cand-mark {
    font-size: 13px;
    font-weight: 600;
    color: #eef0f4;
}
.cand-spec {
    font-size: 10.5px;
    color: #7f848e;
}
.cand-tag {
    font-size: 10.5px;
}

.cand-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 9px;
    padding: 38px 14px;
    text-align: center;
    animation: riseIn .25s ease both;
}
.cand-empty-ico {
    font-size: 26px;
    opacity: .5;
}
.cand-empty-text {
    font-size: 12.5px;
    color: #7f848e;
}
.cand-empty-clear {
    font-size: 12px;
    color: #7fa7ff;
    cursor: pointer;
    font-weight: 600;
}

.aside-foot {
    flex: none;
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, .07);
}
.bind-done {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 13px;
    border-radius: 10px;
    margin-bottom: 12px;
}
.bind-done-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}
.bind-done-text {
    font-size: 12.5px;
    font-weight: 600;
}
.cta {
    width: 100%;
    height: 46px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    background: #3d66f0;
    box-shadow: 0 4px 16px rgba(61, 102, 240, .4);
    font-family: inherit;
}
.cta:disabled {
    background: #2a2d33;
    opacity: .5;
    box-shadow: none;
    cursor: not-allowed;
}
</style>
