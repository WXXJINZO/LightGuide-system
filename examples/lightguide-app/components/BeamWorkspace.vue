<template>
    <div class="workspace-root">
        <div v-if="showAlarm" class="alarm-bar"><span class="alarm-ico">!</span> {{ t('check.alarm') }}</div>

        <div class="slot-bar">
            <button
                v-for="slot in slots"
                :key="slot.slot_no"
                class="sbar-card"
                :class="[{ sel: slot.slot_no === selectedSlotNo }, slotDetail(slot).cls]"
                @click="switchBeam(slot.slot_no)"
            >
                <div class="sbar-top">
                    <span class="sbar-no">{{ slot.slot_no }}</span>
                    <span class="sbar-mark">{{ slot.component?.mark || '-' }}</span>
                    <span class="sbar-dot" :class="slotDetail(slot).dotCls"></span>
                </div>
                <div class="sbar-detail" v-html="slotDetail(slot).line"></div>
                <div class="sbar-status" :class="slotDetail(slot).statusCls">{{ slotDetail(slot).status || '' }}</div>
            </button>
        </div>

        <div class="cad-toolbar">
            <div class="tb-group">
                <button class="tool-btn" data-act="fit" :title="t('tool.fit')" @click="viewer?.fit()">⤢</button>
                <button class="tool-btn" data-act="zoom-in" :title="t('tool.zoomIn')" @click="viewer?.zoom(1.2)">＋</button>
                <button class="tool-btn" data-act="zoom-out" :title="t('tool.zoomOut')" @click="viewer?.zoom(1 / 1.2)">－</button>
                <button class="tool-btn" :class="{ active: activeTool === 'pan' }" :title="t('tool.pan')" @click="setTool('pan')">✥</button>
                <button class="tool-btn" :class="{ active: activeTool === 'orbit' }" :title="t('tool.rotate')" @click="setTool('orbit')">⟳</button>
                <button class="tool-btn" :class="{ active: activeTool === 'measure' }" :title="t('tool.measure')" @click="setTool('measure')">⌁</button>
            </div>
            <div class="tb-sep"></div>
            <div class="tb-group">
                <button v-for="view in views" :key="view.name" class="view-btn" :class="{ active: activeView === view.name }" @click="setView(view.name)">
                    {{ view.label }}
                </button>
            </div>
            <div class="tb-sep"></div>
            <div class="tb-group">
                <button class="tool-btn" :class="{ active: rotMode }" :title="t('tool.rotCenter')" @click="toggleRotCenter">✛</button>
                <button class="tool-btn" :title="t('tool.rotCenterReset')" @click="viewer?.resetRotationCenter()">↺</button>
            </div>
            <div class="tb-spacer"></div>
            <div v-if="showPreviewToggle" class="prev-toggle">
                <button class="prev-btn" :class="{ active: store.previewMode === 'projection' }" @click="setPreview('projection')">◉ {{ t('ws.projView') }}</button>
                <button class="prev-btn" :class="{ active: store.previewMode === 'completed' }" @click="setPreview('completed')">▣ {{ t('ws.completedView') }}</button>
            </div>
        </div>

        <div class="cad-main">
            <section class="cad-area">
                <div class="cad-header">
                    <template v-if="selectedSlot && component">
                        <span class="ch-label">{{ t('ws.current') }}</span>
                        <b class="ch-slot">{{ t('p2.slot') }}{{ selectedSlot.slot_no }}</b><span class="ch-sep">·</span>
                        <b class="ch-mark">{{ component.mark }}</b><span class="ch-sep">|</span>
                        <span class="ch-spec">{{ component.spec }}</span><span class="ch-sep">|</span>
                        <span class="ch-len">{{ (component.length_mm / 1000).toFixed(2) }} {{ t('common.m') }}</span><span class="ch-sep">|</span>
                        <span class="ch-face">{{ t('ws.assemblyFace') }}: {{ faceLabel(selectedSlot.assembly_face) }}</span>
                        <span class="ch-ifc">{{ component.ifc_name }} <i>IFC4</i></span>
                    </template>
                </div>
                <div ref="hostRef" class="cad-host">
                    <div v-if="!selectedSlot?.component_id" class="cad-empty">{{ t('ws.pickBeam') }}</div>
                </div>
            </section>

            <aside class="cad-side" :class="sideClass">
                <div class="op-panel">
                    <slot name="op" :slot="selectedSlot" :component="component" :viewer="viewer" :reload="reloadBeam" />
                </div>
                <div v-if="showBom && component" class="bom-panel">
                    <div class="bom-head"><span class="bom-title">BOM {{ t('bom.title') }}</span><span class="bom-count">{{ component.parts.length }}</span></div>
                    <div class="bom-scroll">
                        <table class="bom-table">
                            <thead>
                                <tr>
                                    <th>{{ t('bom.col.id') }}</th><th>{{ t('bom.col.spec') }}</th><th class="r">{{ t('bom.col.length') }}</th>
                                    <th>{{ t('bom.col.material') }}</th><th class="r">{{ t('bom.col.unit') }}</th><th class="r">{{ t('bom.col.qty') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="part in component.parts"
                                    :key="part.part_id + part.spec"
                                    class="bom-row"
                                    :class="{ primary: part.is_primary, active: activePartId === part.part_id }"
                                    @click="selectBomPart(part.part_id)"
                                >
                                    <td class="bom-id">{{ part.part_id }}<span v-if="part.is_primary" class="primary-tag">{{ t('bom.primary') }}</span></td>
                                    <td class="bom-spec">{{ part.spec }}</td>
                                    <td class="bom-num">{{ part.length_mm }}</td>
                                    <td class="bom-mat">{{ part.material }}</td>
                                    <td class="bom-num">{{ part.unit_kg.toFixed(1) }}</td>
                                    <td class="bom-num">{{ part.qty }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="bom-total"><span>{{ t('bom.total') }}</span><b>{{ component.total_weight.toFixed(1) }} {{ t('common.kg') }}</b></div>
                </div>
            </aside>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { LightGuideViewer } from '@/projects/lightguide';
import type { Deviation, LightGuideViewerApi, PreviewMode } from '@/projects/lightguide';
import { componentToModel } from '../adapter';
import { useI18n } from '../i18n';
import { Store, store } from '../store';
import type { ComponentFull, SlotDTO } from '../api/types';

export interface SlotDecor {
    line: string;
    status?: string;
    dotCls?: string;
    statusCls?: string;
    cls?: string;
}

const props = withDefaults(defineProps<{
    slotDetail: (slot: SlotDTO) => SlotDecor;
    showProjection?: boolean;
    showPreviewToggle?: boolean;
    showBom?: boolean;
    sideClass?: string;
    showAlarm?: boolean;
}>(), {
    showProjection: false,
    showPreviewToggle: false,
    showBom: false,
    sideClass: '',
    showAlarm: false
});

const emit = defineEmits<{
    ready: [viewer: LightGuideViewerApi, component: ComponentFull, slot: SlotDTO];
    viewerSelect: [id: string | null];
}>();

const { t } = useI18n();
const hostRef = ref<HTMLElement | null>(null);
const viewer = ref<LightGuideViewerApi | null>(null);
const component = ref<ComponentFull | null>(null);
const activeTool = ref('orbit');
const activeView = ref('iso');
const rotMode = ref(false);
const activePartId = ref<string | null>(null);

const slots = computed(() => store.session?.slots ?? []);
const selectedSlotNo = computed(() => store.selectedSlotNo);
const selectedSlot = computed(() => Store.selectedSlot());

const faceKeys: Record<string, string> = {
    top_flange: 'face.top',
    bottom_flange: 'face.bottom',
    left_web: 'face.left',
    right_web: 'face.right'
};
const views = computed(() => [
    { name: 'front', label: t('view.front') },
    { name: 'top', label: t('view.top') },
    { name: 'side', label: t('view.side') },
    { name: 'iso', label: t('view.iso') },
    { name: 'assembly', label: t('view.assembly') }
]);

function faceLabel(face: string): string {
    return t(faceKeys[face] || 'face.top');
}

function disposeViewer(): void {
    viewer.value?.dispose();
    viewer.value = null;
}

async function reloadBeam(): Promise<void> {
    await nextTick();
    const host = hostRef.value;
    const slot = selectedSlot.value;
    disposeViewer();
    component.value = null;
    activePartId.value = null;
    if (!host || !slot?.component_id) {
        if (host) host.innerHTML = `<div class="cad-empty">${t('ws.pickBeam')}</div>`;
        return;
    }
    const comp = await Store.loadComponent(slot.component_id);
    const model = componentToModel(comp, slot);
    component.value = comp;
    const opts = {
        previewMode: store.previewMode,
        showProjection: props.showProjection,
        onSelect: (id) => {
            store.selectedSecondaryId = id;
            const sec = comp.secondary.find((s) => String(s.id) === id);
            activePartId.value = sec?.number ?? null;
            emit('viewerSelect', id);
        },
        onRotMode: (on) => { rotMode.value = on; }
    };
    if (viewer.value) {
        viewer.value.loadModel(model, opts);
        emit('ready', viewer.value, comp, slot);
        return;
    }
    host.innerHTML = '';
    const api = LightGuideViewer.mount(host, model, opts);
    viewer.value = api;
    emit('ready', api, comp, slot);
}

async function switchBeam(slotNo: number): Promise<void> {
    const slot = Store.slot(slotNo);
    if (!slot?.component_id) return;
    store.selectedSlotNo = slotNo;
    await reloadBeam();
}

function setTool(tool: string): void {
    activeTool.value = tool;
    viewer.value?.setTool(tool);
}

function setView(view: string): void {
    activeView.value = view;
    viewer.value?.setView(view);
}

function toggleRotCenter(): void {
    rotMode.value = !rotMode.value;
    viewer.value?.setRotationCenterMode(rotMode.value);
}

function setPreview(mode: PreviewMode): void {
    store.previewMode = mode;
    viewer.value?.setPreviewMode(mode);
}

function selectBomPart(partId: string): void {
    activePartId.value = partId;
    const sec = component.value?.secondary.find((s) => s.number === partId);
    viewer.value?.setSelected(sec ? String(sec.id) : null);
}

function setPoseFromSlot(): void {
    const slot = selectedSlot.value;
    if (slot) viewer.value?.setPose({ headTail: slot.head_tail, assemblyFace: slot.assembly_face });
}

function setDeviation(deviation: Deviation | null): void {
    viewer.value?.setDeviation(deviation);
}

onMounted(() => {
    const first = slots.value.find((s) => s.component_id != null);
    if (first && !selectedSlot.value?.component_id) store.selectedSlotNo = first.slot_no;
    void reloadBeam();
});

onBeforeUnmount(() => {
    disposeViewer();
});

defineExpose({ reloadBeam, switchBeam, setPoseFromSlot, setDeviation, viewer, component, selectedSlot, faceLabel });
</script>
