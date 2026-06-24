<template>
    <div class="lg-page">
        <div ref="hostRef" class="lg-host"></div>

        <div class="lg-panel">
            <div class="lg-title">钢构装配激光投影 · CAD View</div>

            <div class="lg-group">
                <span class="lg-label">视图</span>
                <button v-for="v in views" :key="v.name" @click="setView(v.name)">{{ v.label }}</button>
            </div>

            <div class="lg-group">
                <span class="lg-label">装配面</span>
                <button v-for="f in faces" :key="f.value" :class="{ active: pose.assemblyFace === f.value }" @click="setFace(f.value)">{{ f.label }}</button>
            </div>

            <div class="lg-group">
                <span class="lg-label">头尾</span>
                <button :class="{ active: pose.headTail === 'reversed' }" @click="toggleHeadTail">翻转头尾</button>
            </div>

            <div class="lg-group">
                <span class="lg-label">预览</span>
                <button :class="{ active: previewMode === 'projection' }" @click="setPreview('projection')">投影视图</button>
                <button :class="{ active: previewMode === 'completed' }" @click="setPreview('completed')">完成视图</button>
            </div>

            <div class="lg-group">
                <span class="lg-label">偏差</span>
                <button @click="setDeviation('pass')">合格 2.0</button>
                <button @click="setDeviation('near')">临界 2.7</button>
                <button @click="setDeviation('out')">超差 3.6</button>
                <button @click="clearDeviation">清除</button>
            </div>

            <div class="lg-group">
                <span class="lg-label">次零件</span>
                <button v-for="s in secondaries" :key="s.id" :class="{ active: selected === s.id }" @click="select(s.id)">{{ s.number }}</button>
            </div>

            <div class="lg-group">
                <span class="lg-label">操作</span>
                <button @click="api?.fit()">适配</button>
                <button @click="api?.zoom(1.2)">放大</button>
                <button @click="api?.zoom(0.8)">缩小</button>
                <button @click="toggleRot">旋转中心</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { mountLightGuideViewer } from '@/projects/lightguide';
import type { AssemblyFace, DeviationResult, LightGuideViewerApi, PreviewMode } from '@/projects/lightguide';
import { LIGHTGUIDE_SAMPLE } from '../data/lightguide_sample';

const hostRef = ref<HTMLElement | null>(null);
const api = ref<LightGuideViewerApi | null>(null);

const pose = reactive({ headTail: 'normal' as 'normal' | 'reversed', assemblyFace: 'top_flange' as AssemblyFace });
const previewMode = ref<PreviewMode>('projection');
const selected = ref<string | null>(null);
const rotMode = ref(false);

const views = [
    { name: 'iso', label: '等轴测' },
    { name: 'front', label: '前视' },
    { name: 'top', label: '俯视' },
    { name: 'side', label: '侧视' },
    { name: 'assembly', label: '装配面' }
];
const faces: { value: AssemblyFace; label: string }[] = [
    { value: 'top_flange', label: '上翼缘' },
    { value: 'bottom_flange', label: '下翼缘' },
    { value: 'left_web', label: '左腹板' },
    { value: 'right_web', label: '右腹板' }
];
const secondaries = LIGHTGUIDE_SAMPLE.component.secondary ?? [];

onMounted(async () => {
    if (!hostRef.value) return;
    api.value = await mountLightGuideViewer(hostRef.value, LIGHTGUIDE_SAMPLE, {
        showProjection: true,
        previewMode: 'projection',
        onSelect: (id) => { selected.value = id; },
        onRotMode: (on) => { rotMode.value = on; }
    });
});

onBeforeUnmount(() => {
    api.value?.dispose();
    api.value = null;
});

function setView(name: string) {
    api.value?.setView(name);
}
function applyPose() {
    api.value?.setPose({ headTail: pose.headTail, assemblyFace: pose.assemblyFace });
}
function setFace(face: AssemblyFace) {
    pose.assemblyFace = face;
    applyPose();
}
function toggleHeadTail() {
    pose.headTail = pose.headTail === 'reversed' ? 'normal' : 'reversed';
    applyPose();
}
function setPreview(mode: PreviewMode) {
    previewMode.value = mode;
    api.value?.setPreviewMode(mode);
}
function setDeviation(result: DeviationResult) {
    const value = result === 'pass' ? 2.0 : result === 'near' ? 2.7 : 3.6;
    api.value?.setDeviation({ value, result });
}
function clearDeviation() {
    api.value?.setDeviation(null);
}
function select(id: string) {
    selected.value = id;
    api.value?.setSelected(id);
}
function toggleRot() {
    rotMode.value = !rotMode.value;
    api.value?.setRotationCenterMode(rotMode.value);
}
</script>

<style scoped>
.lg-page {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
    background: #0c1117;
}
.lg-host {
    position: absolute;
    inset: 0;
}
.lg-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 280px;
    background: rgba(18, 24, 33, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px 16px;
    color: #e6edf5;
    font-size: 13px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}
.lg-title {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.lg-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
}
.lg-label {
    width: 48px;
    color: #8aa0b6;
    font-size: 12px;
}
.lg-panel button {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e6edf5;
    border-radius: 6px;
    padding: 4px 9px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s ease;
}
.lg-panel button:hover {
    background: rgba(59, 158, 255, 0.25);
}
.lg-panel button.active {
    background: #3b9eff;
    border-color: #3b9eff;
    color: #fff;
}
</style>
