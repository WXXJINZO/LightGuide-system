<template>
    <div class="workspace-root">
        <div v-if="showAlarm" class="alarm-bar"><span class="alarm-ico">!</span> {{ t('check.alarmTitle') }}</div>

        <!-- SIX-SLOT STATUS BAR -->
        <div class="slot-bar">
            <button
                v-for="slot in slots"
                :key="slot.slot_no"
                class="sbar-card"
                :class="{ sel: slot.slot_no === selectedSlotNo }"
                @click="switchBeam(slot.slot_no)"
            >
                <div class="sbar-top">
                    <div class="sbar-left">
                        <span class="sbar-no">{{ slot.slot_no }}</span>
                        <span class="sbar-mark">{{ slot.component?.mark || '—' }}</span>
                    </div>
                    <span class="sbar-dot" :class="slotDetail(slot).dotCls"></span>
                </div>
                <div class="sbar-detail" v-html="slotDetail(slot).line"></div>
                <span class="lg-pill sbar-status" :class="slotDetail(slot).statusCls">{{ slotDetail(slot).status || '' }}</span>
            </button>
        </div>

        <div class="cad-main">
            <!-- CAD VIEWPORT -->
            <section class="cad-area">
                <div ref="hostRef" class="cad-host">
                    <div v-if="!selectedSlot?.component_id" class="cad-empty">{{ t('ws.pickBeam') }}</div>
                </div>

                <!-- TOP CONTROL STRIP -->
                <div class="cad-toolbar">
                    <div class="tb-group">
                        <button class="tool-btn" :title="t('tool.fit')" @click="viewer?.fit()">⤢</button>
                        <button class="tool-btn" :class="{ active: activeTool === 'pan' }" :title="t('tool.pan')" @click="setTool('pan')">✥</button>
                        <button class="tool-btn" :class="{ active: activeTool === 'orbit' }" :title="t('tool.rotate')" @click="setTool('orbit')">↻</button>
                        <button class="tool-btn" :class="{ active: activeTool === 'measure' }" :title="t('tool.measure')" @click="setTool('measure')">📐</button>
                        <button class="tool-btn" :title="t('tool.rotCenterReset')" @click="resetView">⟲</button>
                    </div>
                    <div class="tb-sep"></div>
                    <div class="tb-group">
                        <button v-for="view in views" :key="view.name" class="view-btn" :class="{ active: activeView === view.name }" @click="setView(view.name)">
                            {{ view.label }}
                        </button>
                    </div>
                    <div class="tb-spacer"></div>
                    <template v-if="showPreviewToggle">
                        <div class="prev-toggle">
                            <button class="prev-btn proj" :class="{ active: store.previewMode === 'projection' }" @click="setPreview('projection')">◉ {{ t('ws.projView') }}</button>
                            <button class="prev-btn done" :class="{ active: store.previewMode === 'completed' }" @click="setPreview('completed')">▣ {{ t('ws.completedView') }}</button>
                        </div>
                        <div class="tb-sep"></div>
                    </template>
                    <div class="tb-group">
                        <button class="icon-btn" :title="t('tool.zoomOut')" @click="viewer?.zoom(1 / 1.2)">−</button>
                        <button class="icon-btn" :title="t('tool.zoomIn')" @click="viewer?.zoom(1.2)">+</button>
                        <button class="icon-btn rot-btn" :class="{ active: rotMode }" :title="t('tool.rotCenter')" @click="toggleRotCenter">⊹</button>
                    </div>
                </div>

                <!-- context stack (top-left) -->
                <div v-if="selectedSlot && component" class="cad-context">
                    <div class="ctx-row">
                        <span class="ctx-label">{{ t('ws.current') }}</span>
                        <span class="ctx-slot">{{ t('slot') }}{{ selectedSlot.slot_no }} · {{ component.mark }}</span>
                        <span class="ctx-sep">|</span>
                        <span class="ctx-spec">{{ component.spec }}</span>
                        <span class="ctx-sep">|</span>
                        <span class="ctx-len">{{ (component.length_mm / 1000).toFixed(2) }} {{ t('common.m') }}</span>
                        <span class="ctx-sep">|</span>
                        <span class="ctx-face">{{ t('face') }}: {{ faceLabel(selectedSlot.assembly_face) }}</span>
                    </div>
                    <div class="ctx-ifc">
                        <span class="ctx-ifc-ic">⬡</span>
                        <span class="ctx-ifc-name">{{ component.ifc_name }}</span>
                        <span class="ctx-ifc-badge">IFC4</span>
                    </div>
                </div>

                <!-- viewcube + view name top-right -->
                <div class="cad-cube">
                    <div class="cube-box">
                        <svg width="60" height="60" viewBox="0 0 62 62">
                            <polygon points="31,5 56,18 31,31 6,18" :fill="cubeFace === 'top' ? '#3d66f0' : '#363b44'" stroke="#5a616d" stroke-width="1" @click="setView('top')" />
                            <polygon points="6,18 31,31 31,57 6,44" :fill="cubeFace === 'front' ? '#3d66f0' : '#363b44'" stroke="#5a616d" stroke-width="1" @click="setView('front')" />
                            <polygon points="56,18 31,31 31,57 56,44" :fill="cubeFace === 'side' ? '#3d66f0' : '#363b44'" stroke="#5a616d" stroke-width="1" @click="setView('side')" />
                            <text x="31" y="18" :fill="cubeFace === 'top' ? '#fff' : '#cfd3da'" font-size="9.5" font-weight="700" font-family="'IBM Plex Mono',monospace" text-anchor="middle" dominant-baseline="middle">{{ t('cube.top') }}</text>
                            <text x="18" y="41" :fill="cubeFace === 'front' ? '#fff' : '#cfd3da'" font-size="9.5" font-weight="700" font-family="'IBM Plex Mono',monospace" text-anchor="middle" dominant-baseline="middle">{{ t('cube.front') }}</text>
                            <text x="44" y="41" :fill="cubeFace === 'side' ? '#fff' : '#cfd3da'" font-size="9.5" font-weight="700" font-family="'IBM Plex Mono',monospace" text-anchor="middle" dominant-baseline="middle">{{ t('cube.side') }}</text>
                        </svg>
                    </div>
                    <span class="cube-name">{{ viewName }}</span>
                </div>

                <!-- rotation-center hint banner -->
                <div v-if="rotMode" class="cad-rot-hint">
                    <span>⊹ {{ t('ws.rotHint') }}</span>
                </div>

                <!-- tool banner (measure / pan) -->
                <div v-if="toolBanner" class="cad-tool-banner">
                    <span>{{ toolBanner }}</span>
                </div>
            </section>

            <aside class="cad-side" :class="sideClass">
                <div class="op-panel">
                    <slot name="op" :slot="selectedSlot" :component="component" :viewer="viewer" :reload="reloadBeam" />
                </div>
                <div v-if="showBom && component" class="bom-panel">
                    <div class="bom-head"><span class="bom-title">{{ t('bom.title') }}</span><span class="bom-count">{{ component.parts.length }}</span></div>
                    <div class="bom-cols">
                        <span>{{ t('bom.col.id') }}</span>
                        <span>{{ t('bom.col.spec') }}</span>
                        <span class="r">{{ t('bom.col.length') }}</span>
                        <span>{{ t('bom.col.material') }}</span>
                        <span class="r">{{ t('bom.col.unit') }}</span>
                        <span class="r">{{ t('bom.col.qty') }}</span>
                    </div>
                    <div class="bom-scroll">
                        <button
                            v-for="part in component.parts"
                            :key="part.part_id + part.spec"
                            class="bom-row"
                            :class="{ primary: part.is_primary, active: activePartId === part.part_id }"
                            @click="selectBomPart(part.part_id)"
                        >
                            <span class="bom-id">{{ part.part_id }}<span v-if="part.is_primary" class="primary-tag">{{ t('bom.primary') }}</span></span>
                            <span class="bom-spec">{{ part.spec }}</span>
                            <span class="bom-len">{{ part.length_mm }}</span>
                            <span class="bom-mat">{{ part.material }}</span>
                            <span class="bom-unit">{{ part.unit_kg.toFixed(1) }}</span>
                            <span class="bom-qty">{{ part.qty }}</span>
                        </button>
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

const viewNameKeys: Record<string, string> = {
    front: 'view.frontFull',
    top: 'view.topFull',
    side: 'view.sideFull',
    iso: 'view.isoFull',
    assembly: 'view.faceFull'
};
const viewName = computed(() => t(viewNameKeys[activeView.value] || 'view.freeFull'));

// viewcube highlight: only the three drawn faces (top/front/side) map directly
const cubeFace = computed(() => {
    if (activeView.value === 'top' || activeView.value === 'front' || activeView.value === 'side') return activeView.value;
    return '';
});

const toolBanner = computed(() => {
    if (activeTool.value === 'measure') return `📐 ${t('tool.measure')}`;
    if (activeTool.value === 'pan') return `✥ ${t('tool.pan')}`;
    return '';
});

function faceLabel(face: string): string {
    return t(faceKeys[face] || 'face.top');
}

function resetView(): void {
    setView('iso');
    setTool('orbit');
    if (rotMode.value) toggleRotCenter();
    viewer.value?.resetRotationCenter();
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

<style scoped>
.workspace-root {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

/* alarm bar */
.alarm-bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 16px;
    background: rgba(242, 84, 91, .12);
    border-bottom: 1px solid rgba(242, 84, 91, .4);
    color: #ff8a8f;
    font-size: 12.5px;
    font-weight: 600;
}
.alarm-ico {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(242, 84, 91, .2);
    border: 1px solid rgba(242, 84, 91, .4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
}

/* ---------- SIX-SLOT STATUS BAR ---------- */
.slot-bar {
    flex: none;
    padding: 11px 14px;
    display: flex;
    gap: 9px;
    background: #0f1014;
    border-bottom: 1px solid rgba(255, 255, 255, .07);
}
.sbar-card {
    flex: 1;
    min-width: 0;
    text-align: left;
    cursor: pointer;
    padding: 9px 11px;
    border-radius: 10px;
    transition: all .15s ease;
    background: #15171c;
    border: 1px solid rgba(255, 255, 255, .08);
}
.sbar-card:hover {
    border-color: rgba(61, 102, 240, .45);
}
.sbar-card.sel {
    background: rgba(61, 102, 240, .12);
    border-color: #3d66f0;
    box-shadow: inset 3px 0 0 #3d66f0;
}
.sbar-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 7px;
}
.sbar-left {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
}
.sbar-no {
    width: 20px;
    height: 20px;
    flex: none;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    background: #22252b;
    color: #aeb2bb;
}
.sbar-card.sel .sbar-no {
    background: #3d66f0;
    color: #fff;
}
.sbar-mark {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #c4c8d0;
}
.sbar-card.sel .sbar-mark {
    color: #7fa7ff;
}
.sbar-dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
    background: #5b606b;
}
.sbar-dot.ok {
    background: #37d27a;
    box-shadow: 0 0 7px #37d27a;
}
.sbar-dot.warn {
    background: #f5b53d;
    box-shadow: 0 0 7px #f5b53d;
}
.sbar-dot.bad {
    background: #f2545b;
    box-shadow: 0 0 7px #f2545b;
}
.sbar-dot.blue,
.sbar-dot.on {
    background: #37d27a;
    box-shadow: 0 0 7px #37d27a;
}
.sbar-detail {
    font-size: 10.5px;
    color: #7f848e;
    font-family: 'IBM Plex Mono', monospace;
    margin-bottom: 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.sbar-status {
    color: #8a8f99;
    background: rgba(255, 255, 255, .05);
    border-color: rgba(255, 255, 255, .12);
}
.sbar-status.ok {
    color: #37d27a;
    background: rgba(55, 210, 122, .12);
    border-color: rgba(55, 210, 122, .3);
}
.sbar-status.warn {
    color: #f5b53d;
    background: rgba(245, 181, 61, .12);
    border-color: rgba(245, 181, 61, .3);
}
.sbar-status.bad {
    color: #f2545b;
    background: rgba(242, 84, 91, .13);
    border-color: rgba(242, 84, 91, .4);
}
.sbar-status.blue,
.sbar-status.projecting {
    color: #7fa7ff;
    background: rgba(61, 102, 240, .14);
    border-color: rgba(61, 102, 240, .4);
}
.sbar-detail :deep(.muted) {
    color: #5b606b;
}

/* ---------- CAD MAIN ---------- */
.cad-main {
    flex: 1;
    min-height: 0;
    display: flex;
}

/* CAD VIEWPORT */
.cad-area {
    flex: 1;
    min-width: 0;
    position: relative;
    background: radial-gradient(130% 130% at 50% 30%, #171a1f 0%, #0a0b0e 80%);
    overflow: hidden;
}
.cad-host {
    position: absolute;
    inset: 0;
}
.cad-host :deep(canvas) {
    width: 100%;
    height: 100%;
    display: block;
}
.cad-empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #5b606b;
    font-size: 13px;
}

/* TOP CONTROL STRIP */
.cad-toolbar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 48px;
    z-index: 8;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    background: rgba(9, 10, 13, .92);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, .08);
    overflow-x: auto;
}
.tb-group {
    display: flex;
    gap: 4px;
    flex: none;
}
.tb-group:nth-of-type(2) {
    gap: 3px;
}
.tb-sep {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, .1);
    flex: none;
}
.tb-spacer {
    flex: 1;
    min-width: 8px;
}
.tool-btn {
    width: 32px;
    height: 32px;
    border-radius: 7px;
    border: 1px solid rgba(255, 255, 255, .08);
    background: #191c21;
    color: #c4c8d0;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.tool-btn.active {
    background: #3d66f0;
    border-color: #3d66f0;
    color: #fff;
}
.view-btn {
    padding: 6px 10px;
    border-radius: 7px;
    border: none;
    cursor: pointer;
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
    color: #aeb2bb;
    background: transparent;
}
.view-btn.active {
    color: #fff;
    background: #3d66f0;
}
.icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 7px;
    border: 1px solid rgba(255, 255, 255, .08);
    background: #191c21;
    color: #c4c8d0;
    font-size: 17px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.rot-btn {
    font-size: 14px;
}
.rot-btn.active {
    background: #3d66f0;
    border-color: #3d66f0;
    color: #fff;
}

/* preview toggle (P5) */
.prev-toggle {
    display: flex;
    flex: none;
    background: rgba(0, 0, 0, .28);
    border: 1px solid rgba(255, 255, 255, .1);
    border-radius: 8px;
    padding: 2px;
}
.prev-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 13px;
    border: none;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    color: #aeb2bb;
    background: transparent;
    white-space: nowrap;
}
.prev-btn.proj.active {
    color: #0c0d10;
    background: #37d27a;
}
.prev-btn.done.active {
    color: #fff;
    background: #3d66f0;
}

/* context stack (top-left) */
.cad-context {
    position: absolute;
    top: 58px;
    left: 14px;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
    max-width: 62%;
}
.ctx-row {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: nowrap;
    white-space: nowrap;
    background: rgba(12, 13, 16, .74);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, .1);
    border-radius: 9px;
    padding: 8px 13px;
}
.ctx-label {
    font-size: 10px;
    letter-spacing: .6px;
    color: #7f848e;
    font-weight: 600;
    white-space: nowrap;
}
.ctx-slot {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    color: #3d66f0;
}
.ctx-sep {
    color: #3a3e46;
}
.ctx-spec,
.ctx-len {
    font-size: 12px;
    color: #aeb2bb;
    font-family: 'IBM Plex Mono', monospace;
    white-space: nowrap;
}
.ctx-face {
    font-size: 12px;
    color: #7fa7ff;
    white-space: nowrap;
}
.ctx-ifc {
    display: flex;
    align-items: center;
    gap: 7px;
    background: rgba(12, 13, 16, .74);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, .1);
    border-radius: 8px;
    padding: 6px 11px;
}
.ctx-ifc-ic {
    color: #7fa7ff;
    font-size: 13px;
}
.ctx-ifc-name {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11.5px;
    color: #c4c8d0;
}
.ctx-ifc-badge {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .5px;
    color: #7fa7ff;
    background: rgba(61, 102, 240, .16);
    border: 1px solid rgba(61, 102, 240, .35);
    padding: 1px 6px;
    border-radius: 4px;
}

/* viewcube + view name (top-right) */
.cad-cube {
    position: absolute;
    top: 56px;
    right: 14px;
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
}
.cube-box {
    background: rgba(12, 13, 16, .72);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, .1);
    border-radius: 10px;
    padding: 5px;
    line-height: 0;
}
.cube-box polygon {
    cursor: pointer;
}
.cube-name {
    font-size: 11px;
    font-weight: 600;
    color: #aeb2bb;
    background: rgba(12, 13, 16, .6);
    padding: 2px 9px;
    border-radius: 6px;
    white-space: nowrap;
}

/* rotation-center hint */
.cad-rot-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -130px);
    z-index: 7;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(61, 102, 240, .16);
    border: 1px solid rgba(61, 102, 240, .5);
    border-radius: 9px;
    padding: 9px 14px;
    animation: cad-pulse 1.6s infinite;
}
.cad-rot-hint span {
    font-size: 13px;
    color: #9db6ff;
    font-weight: 600;
}

/* tool banner (measure / pan) */
.cad-tool-banner {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 7;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(245, 181, 61, .15);
    border: 1px solid rgba(245, 181, 61, .45);
    border-radius: 9px;
    padding: 7px 13px;
    backdrop-filter: blur(8px);
}
.cad-tool-banner span {
    font-size: 12.5px;
    color: #f5d089;
    font-weight: 600;
}

/* ---------- RIGHT OPERATION PANEL ---------- */
.cad-side {
    width: 330px;
    flex: none;
    border-left: 1px solid rgba(255, 255, 255, .07);
    background: #101115;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.cad-side.pose {
    width: 232px;
}
.cad-side.projection,
.cad-side.proj {
    width: 412px;
}
.cad-side.deviation {
    width: 330px;
}
.op-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: auto;
}

/* ---------- BOM PANEL ---------- */
.bom-panel {
    flex: none;
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: 46%;
    background: #0d0e12;
    border-top: 1px solid rgba(255, 255, 255, .07);
}
.bom-head {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
}
.bom-title {
    font-size: 11px;
    letter-spacing: 1px;
    color: #7f848e;
    font-weight: 600;
}
.bom-count {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #aeb2bb;
    background: #1a1d22;
    border: 1px solid rgba(255, 255, 255, .08);
    border-radius: 6px;
    padding: 1px 7px;
}
.bom-cols {
    flex: none;
    display: grid;
    grid-template-columns: 92px 1fr 40px 46px 46px 20px;
    gap: 5px;
    padding: 6px 14px;
    font-size: 10px;
    letter-spacing: .4px;
    color: #5b606b;
    font-weight: 600;
    border-bottom: 1px solid rgba(255, 255, 255, .06);
}
.bom-cols .r {
    text-align: right;
}
.bom-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
}
.bom-row {
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
    transition: background .14s ease;
    background: transparent;
}
.bom-row.active {
    background: rgba(61, 102, 240, .16);
    box-shadow: inset 2px 0 0 #3d66f0;
}
.bom-id {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12.5px;
    font-weight: 700;
    color: #eef0f4;
}
.bom-row.primary .bom-id,
.bom-row.active .bom-id {
    color: #7fa7ff;
}
.primary-tag {
    flex: none;
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
.bom-spec {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #8a8f99;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.bom-len {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11.5px;
    color: #dfe2e8;
    text-align: right;
}
.bom-mat {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #8a8f99;
}
.bom-unit {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11.5px;
    color: #aeb2bb;
    text-align: right;
}
.bom-qty {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11.5px;
    color: #dfe2e8;
    text-align: right;
}
.bom-total {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px;
    border-top: 1px solid rgba(255, 255, 255, .07);
    font-size: 12px;
    color: #aeb2bb;
}
.bom-total b {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    color: #7bf3b0;
}
</style>
