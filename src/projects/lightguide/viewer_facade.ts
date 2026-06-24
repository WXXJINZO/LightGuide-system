/**
 * LightGuideViewer 门面 —— 与参考实现 public/js/cadview/viewer.js 的
 * `window.LightGuideViewer.mount(host, model, opts) -> api` 对外契约对齐，
 * 但底层换成真实底座（LightGuideApp / BeamCanvas / BeamViewHandle）。
 *
 * 由于底座 createView 是异步的（await canvas.init()），mount 返回 Promise<api>。
 * api 暴露与参考实现一致的方法集：
 *   setTool/setView/zoom/fit/setRotationCenterMode/resetRotationCenter/
 *   setPose/setPreviewMode/setSelected/setDeviation/screenOf/getState/dispose
 */
import { LightGuideApp } from './view/lightguide_app';
import { BeamViewHandle } from './view/beam_view_handle';
import {
    Deviation,
    LightGuideModel,
    LightGuideViewOptions,
    LightGuideViewState,
    Pose,
    PreviewMode,
    ViewPreset
} from './model/types';

export interface LightGuideViewerApi {
    el: HTMLElement;
    setTool: (tool: string) => void;
    setView: (name: ViewPreset | string) => void;
    zoom: (factor: number) => void;
    fit: () => void;
    setRotationCenterMode: (on: boolean) => void;
    resetRotationCenter: () => void;
    setPose: (pose: Pose) => void;
    setPreviewMode: (mode: PreviewMode) => void;
    setSelected: (id: string | null) => void;
    setDeviation: (deviation: Deviation | null) => void;
    screenOf: (world: [number, number, number]) => { x: number; y: number };
    getState: () => LightGuideViewState;
    dispose: () => void;
}

let _seq = 0;

export async function mountLightGuideViewer(
    host: HTMLElement,
    model: LightGuideModel,
    opts: LightGuideViewOptions = {}
): Promise<LightGuideViewerApi> {
    const app = LightGuideApp.getInstance();
    const viewKey = `lg-view-${++_seq}`;
    const handle: BeamViewHandle = await app.createView(viewKey, host, { configOptions: { model, opts } });

    await handle.loadModel(model, opts);

    // 点击拾取 → BOM 联动：把底座选中实体映射回次零件业务 id。
    const unlisten = handle.onSelectionChange.listen((e) => {
        const entityId = e.selectedIds[0];
        const secId = entityId != null ? handle.secondaryIdOfEntity(entityId) : null;
        void handle.setSelected(secId);
        if (opts.onSelect) opts.onSelect(secId);
    });

    return {
        el: host,
        setTool: (tool) => { void handle.setTool(tool); },
        setView: (name) => { void handle.setView(name); },
        zoom: (factor) => { void handle.zoom(factor); },
        fit: () => { void handle.fit(); },
        setRotationCenterMode: (on) => { void handle.setRotationCenterMode(on); },
        resetRotationCenter: () => { void handle.resetRotationCenter(); },
        setPose: (pose) => { void handle.setPose(pose); },
        setPreviewMode: (mode) => { void handle.setPreviewMode(mode); },
        setSelected: (id) => { void handle.setSelected(id); },
        setDeviation: (deviation) => { void handle.setDeviation(deviation); },
        screenOf: (world) => handle.screenOf(world),
        getState: () => handle.getState(),
        dispose: () => {
            unlisten();
            void app.destroyView(viewKey);
        }
    };
}

/** 与参考实现一致：挂到 window.LightGuideViewer。 */
export const LightGuideViewer = { mount: mountLightGuideViewer };

if (typeof window !== 'undefined') {
    (window as unknown as { LightGuideViewer?: typeof LightGuideViewer }).LightGuideViewer = LightGuideViewer;
}
