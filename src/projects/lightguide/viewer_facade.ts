/**
 * LightGuideViewer 门面 —— 与参考实现 public/js/cadview/viewer.js 的
 * `window.LightGuideViewer.mount(host, model, opts) -> api` 对外契约对齐，
 * 但底层换成真实底座（LightGuideApp / BeamCanvas / BeamViewHandle）。
 *
 * 由于底座 createView 是异步的（await canvas.init()），内部真实挂载仍是 async。
 * 对外 `LightGuideViewer.mount(...)` 保持参考实现的同步契约：立即返回 api，
 * 在 view 就绪前调用的方法会进入队列，底座完成后顺序回放。
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
    loadModel: (model: LightGuideModel, opts?: LightGuideViewOptions) => void;
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

function viewKeyOf(host: HTMLElement): string {
    const key = host.dataset.lightguideViewKey || 'lg-main-view';
    host.dataset.lightguideViewKey = key;
    return key;
}

export async function mountLightGuideViewer(
    host: HTMLElement,
    model: LightGuideModel,
    opts: LightGuideViewOptions = {}
): Promise<LightGuideViewerApi> {
    const app = LightGuideApp.getInstance();
    let currentOpts = opts;
    const viewKey = viewKeyOf(host);
    const handle: BeamViewHandle = await app.createView(viewKey, host, { configOptions: { model, opts } });

    await handle.loadModel(model, opts);

    // 点击拾取 → BOM 联动：把底座选中实体映射回次零件业务 id。
    const unlisten = handle.onSelectionChange.listen((e) => {
        const entityId = e.selectedIds[0];
        const secId = entityId != null ? handle.secondaryIdOfEntity(entityId) : null;
        void handle.setSelected(secId);
        if (currentOpts.onSelect) currentOpts.onSelect(secId);
    });

    return {
        el: host,
        loadModel: (nextModel, nextOpts) => {
            currentOpts = nextOpts ?? currentOpts;
            void handle.loadModel(nextModel, currentOpts);
        },
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
            void app.detachViewRender(viewKey);
        }
    };
}

function defaultState(opts: LightGuideViewOptions = {}): LightGuideViewState {
    return {
        tool: 'orbit',
        view: 'iso',
        previewMode: opts.previewMode ?? 'projection',
        rotMode: false,
        rotCenterSet: false,
        selected: null,
        pose: { headTail: 'normal', assemblyFace: 'top_flange' },
        deviation: null,
        targetCount: 0,
        secondaryCount: 0,
        secondaryVisible: 0,
        projectionFootprints: 0,
        hasAxes: false,
        faceHighlight: false
    };
}

export function mountLightGuideViewerSync(
    host: HTMLElement,
    model: LightGuideModel,
    opts: LightGuideViewOptions = {}
): LightGuideViewerApi {
    let real: LightGuideViewerApi | null = null;
    let disposed = false;
    const queue: Array<(api: LightGuideViewerApi) => void> = [];
    const run = (fn: (api: LightGuideViewerApi) => void) => {
        if (disposed) return;
        if (real) fn(real);
        else queue.push(fn);
    };

    void mountLightGuideViewer(host, model, opts)
        .then((api) => {
            if (disposed) {
                api.dispose();
                return;
            }
            real = api;
            queue.forEach((fn) => fn(api));
            queue.length = 0;
        })
        .catch((err) => console.error('[LightGuideViewer] mount failed:', err));

    return {
        el: host,
        loadModel: (nextModel, nextOpts) => run((a) => a.loadModel(nextModel, nextOpts)),
        setTool: (tool) => run((a) => a.setTool(tool)),
        setView: (name) => run((a) => a.setView(name)),
        zoom: (factor) => run((a) => a.zoom(factor)),
        fit: () => run((a) => a.fit()),
        setRotationCenterMode: (on) => run((a) => a.setRotationCenterMode(on)),
        resetRotationCenter: () => run((a) => a.resetRotationCenter()),
        setPose: (pose) => run((a) => a.setPose(pose)),
        setPreviewMode: (mode) => run((a) => a.setPreviewMode(mode)),
        setSelected: (id) => run((a) => a.setSelected(id)),
        setDeviation: (deviation) => run((a) => a.setDeviation(deviation)),
        screenOf: (world) => (real ? real.screenOf(world) : { x: 0, y: 0 }),
        getState: () => (real ? real.getState() : defaultState(opts)),
        dispose: () => {
            disposed = true;
            queue.length = 0;
            if (real) real.dispose();
        }
    };
}

/** 与参考实现一致：挂到 window.LightGuideViewer，`mount` 为同步契约。 */
export const LightGuideViewer = { mount: mountLightGuideViewerSync, mountAsync: mountLightGuideViewer };

if (typeof window !== 'undefined') {
    (window as unknown as { LightGuideViewer?: typeof LightGuideViewer }).LightGuideViewer = LightGuideViewer;
}
