<template>
    <div v-if="store.session && store.project">
        <div class="page-head">
            <div><h1>{{ t('p2.title') }}</h1><p class="page-sub">{{ t('p2.subtitle') }}</p></div>
            <div class="completion">
                <span class="completion-text">{{ t('p2.completion', store.session.bound_count) }}</span>
                <div class="completion-bar"><i :style="{ width: `${(store.session.bound_count / 6) * 100}%` }"></i></div>
            </div>
        </div>

        <div class="p2-layout">
            <section class="p2-slots">
                <div class="slot-grid">
                    <div
                        v-for="slot in store.session.slots"
                        :key="slot.slot_no"
                        class="slot-card"
                        :class="{ active: slot.slot_no === activeSlotNo, bound: !!slot.component, unbound: !slot.component }"
                        @click="activeSlotNo = slot.slot_no"
                    >
                        <div class="slot-head">
                            <span class="slot-no">{{ slot.slot_no }}</span>
                            <span class="slot-state" :class="{ on: !!slot.component }">{{ t(slot.component ? 'p2.bound' : 'p2.unbound') }}</span>
                            <span v-if="slot.duplicate" class="dup-tag">{{ t('p2.duplicate') }}</span>
                        </div>
                        <div class="slot-body">
                            <template v-if="slot.component">
                                <div class="slot-mark">{{ slot.component.mark }}</div>
                                <div class="slot-spec">{{ slot.component.spec }} · {{ (slot.component.length_mm / 1000).toFixed(2) }} {{ t('common.m') }}</div>
                            </template>
                            <div v-else class="slot-placeholder">{{ t('p2.unbound') }}</div>
                        </div>
                        <div class="slot-actions">
                            <button class="btn btn-sm" :class="slot.slot_no === activeSlotNo ? 'btn-primary' : 'btn-ghost'" @click.stop="activeSlotNo = slot.slot_no">
                                {{ t(slot.component ? 'p2.replace' : 'p2.bindHere') }}
                            </button>
                            <button v-if="slot.component" class="btn btn-sm btn-ghost danger" @click.stop="clear(slot.slot_no)">{{ t('p2.clear') }}</button>
                        </div>
                    </div>
                </div>
                <div class="p2-foot">
                    <span class="hint">{{ t('p2.selectComponent') }}</span>
                    <button class="btn btn-primary btn-lg" :disabled="!store.session.all_bound" @click="gotoStep(3)">
                        {{ t(store.session.all_bound ? 'p2.toPose' : 'p2.needAll') }} <span class="arrow">→</span>
                    </button>
                </div>
            </section>

            <aside class="p2-components">
                <div class="cf-head">{{ t('p2.componentList') }} <span class="muted">({{ filteredComponents.length }})</span></div>
                <div class="searchbar sm"><span class="search-ico">⌕</span><input v-model="query" type="text" :placeholder="t('p2.search')" /></div>
                <div class="cf-list">
                    <div v-for="comp in filteredComponents" :key="comp.id" class="cf-card" :class="{ used: slotsUsing(comp.id).length }">
                        <div class="cf-info">
                            <div class="cf-mark">{{ comp.mark }}</div>
                            <div class="cf-spec">{{ comp.spec }}</div>
                            <div class="cf-meta">{{ (comp.length_mm / 1000).toFixed(2) }} {{ t('common.m') }} · {{ comp.total_weight }} {{ t('common.kg') }}</div>
                            <div v-if="slotsUsing(comp.id).length" class="cf-used">{{ t('p2.usedIn', slotsUsing(comp.id).join(', ')) }}</div>
                        </div>
                        <button class="btn btn-sm btn-accent" @click="bind(comp.id)">{{ t('p2.bindHere') }} <b>{{ activeSlotNo }}</b></button>
                    </div>
                </div>
            </aside>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '../i18n';
import * as api from '../mock/api';
import { Store, store } from '../store';
import { toast } from '../composables/useToast';
import { useWorkflowNav } from '../composables/useWorkflow';

const { t } = useI18n();
const { gotoStep, router } = useWorkflowNav();
const activeSlotNo = ref(1);
const query = ref('');

const filteredComponents = computed(() => {
    const term = query.value.trim().toLowerCase();
    const components = store.project?.components ?? [];
    return components.filter((c) => !term || c.mark.toLowerCase().includes(term) || c.spec.toLowerCase().includes(term));
});

function slotsUsing(componentId: number): number[] {
    return store.session?.slots.filter((slot) => slot.component_id === componentId).map((slot) => slot.slot_no) ?? [];
}

async function bind(componentId: number): Promise<void> {
    if (!store.session) return;
    Store.setSession(await api.bindSlot(store.session.id, activeSlotNo.value, componentId));
    const next = store.session.slots.find((slot) => slot.component_id == null);
    activeSlotNo.value = next ? next.slot_no : activeSlotNo.value;
    toast(`工位 ${activeSlotNo.value} ✓`, 'ok');
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
