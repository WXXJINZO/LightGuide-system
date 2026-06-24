import { FSApp } from '@fs/cadnginx';
import * as THREE from 'three';
import { Base3DCanvas, SesNodeDisplay } from '@/common';
import { SELECTION_MODE } from '@/common/constants/canvas_constants';
import { PickPriority } from '@/common/core/pick_strategy/pick_strategy';
import { registerCmd } from '../command/cmd_register';
import {
    AssemblyFace,
    BeamSection,
    Deviation,
    LightGuideModel,
    LightGuideViewOptions,
    LightGuideViewState,
    Pose,
    PreviewMode,
    ViewPreset
} from '../model/types';
import { BeamEntity } from '../model/beam_entity';
import { SecondaryEntity } from '../model/secondary_entity';
import { LgDecorationEntity } from '../model/decoration_entity';
import {
    buildAxes,
    buildDeviation,
    buildFaceHighlight,
    buildProjection,
    buildTargets
} from '../geometry/beam_builders';
import { assemblyPreset, memberCenter, orbitDirection, OrbitPreset, PRESETS } from '../geometry/beam_geometry';

const DEFAULT_POSE: Pose = { headTail: 'normal', assemblyFace: 'top_flange' };

/**
 * LightGuide 业务 3D Canvas（替换参考实现中手搓 THREE 的 BeamCanvas，落到真实底座）。
 *
 * 继承 `Base3DCanvas (extends View.Cad3DCanvas)`：
 * - `_registerDisplay()`  注册 Beam/Secondary/Decoration → SesNodeDisplay 映射；
 * - `_registerCommands()` 把命令注册到 `app.cmdManager`（经 cmd_register）；
 * - `_registerPickHelper()` 注册工件拾取策略。
 *
 * 业务对象经 `addModel()` 接入 `nodeRoot` / view，位姿通过对每个"随位姿"实体施加
 * 局部矩阵实现（坐标轴 gizmo 留在世界系）。所有 UI 操作经 BeamViewHandle.executeCommand
 * 路由到本类方法，保持对外门面稳定。
 */
export class BeamCanvas extends Base3DCanvas {
    private _model: LightGuideModel | null = null;
    private _opts: LightGuideViewOptions = {};
    private _sec: BeamSection | null = null;

    // 业务实体
    private _beam: BeamEntity | null = null;
    private _axes: LgDecorationEntity | null = null;
    private _targets: LgDecorationEntity | null = null;
    private _faceHL: LgDecorationEntity | null = null;
    private _projection: LgDecorationEntity | null = null;
    private _deviationEntity: LgDecorationEntity | null = null;
    private _secondaries: SecondaryEntity[] = [];
    private _secondaryById = new Map<string, SecondaryEntity>();
    private _entityToSecondary = new Map<number, string>();

    // 视图状态
    private _tool = 'orbit';
    private _viewName: ViewPreset | string = 'iso';
    private _previewMode: PreviewMode = 'projection';
    private _rotMode = false;
    private _rotCenterSet = false;
    private _selected: string | null = null;
    private _deviationData: Deviation | null = null;
    private _projectionFootprints = 0;

    constructor(params: FSApp.View.Three.IThreeCanvasConstructorParams) {
        super({ domElement: params.domElement, app: params.app });
    }

    protected _registerCommands(): void {
        registerCmd(this);
    }

    protected _registerDisplay(): void {
        super._registerDisplay();
        this.registerDisplayType(BeamEntity, (e) => this.createDisplay(e, SesNodeDisplay));
        this.registerDisplayType(SecondaryEntity, (e) => this.createDisplay(e, SesNodeDisplay));
        this.registerDisplayType(LgDecorationEntity, (e) => this.createDisplay(e, SesNodeDisplay));
    }

    protected _registerPickHelper(): void {
        this.pickHelper.registerStrategy(
            SELECTION_MODE.WORKPIECE,
            SesNodeDisplay as unknown as new (...args: any[]) => FSApp.View.Three.ThreeDisplay,
            PickPriority.Default
        );
        this.pickHelper.use([this.selectionMode]);
    }

    public get model(): LightGuideModel | null {
        return this._model;
    }

    public get currentPose(): Pose {
        return (this._model && this._model.pose) || DEFAULT_POSE;
    }

    private get _section(): BeamSection {
        if (!this._sec) throw new Error('BeamCanvas: 模型尚未加载');

        return this._sec;
    }

    /** 随位姿变换的实体（不含世界系坐标轴）。 */
    private get _posed(): LgDecorationEntity[] {
        const list: LgDecorationEntity[] = [];
        if (this._targets) list.push(this._targets);
        if (this._faceHL) list.push(this._faceHL);
        if (this._projection) list.push(this._projection);
        if (this._deviationEntity) list.push(this._deviationEntity);

        return list;
    }

    // ── 加载 ─────────────────────────────────────────────────────────────
    /** 由 CmdLoadBeam 调用：构建并接入全部业务实体。 */
    public loadModel(model: LightGuideModel, opts: LightGuideViewOptions): void {
        this._clearEntities();
        this._model = model;
        this._opts = opts || {};
        this._sec = model.component.hbeam;
        this._previewMode = this._opts.previewMode || 'projection';
        if (!this._model.pose) this._model.pose = { ...DEFAULT_POSE };

        // 梁（拾取）+ 世界系坐标轴
        this._beam = new BeamEntity(this._sec);
        this.addModel(this._beam);
        this._axes = new LgDecorationEntity('axes', buildAxes(this._sec));
        this.addModel(this._axes);

        // 次零件（拾取 + BOM 联动）
        (model.component.secondary || []).forEach((s) => {
            const entity = new SecondaryEntity(this._section, s);
            this.addModel(entity);
            this._secondaries.push(entity);
            this._secondaryById.set(s.id, entity);
            this._entityToSecondary.set(entity.id, s.id);
        });

        // 随位姿装饰：靶标 / 面高亮 / 投影标注
        this._rebuildPosedDecorations();
        this._applyPoseMatrix();
        this.applyPreview();
        this.dirty();
        this.runInNewFrame(() => { void this.fit(); });
    }

    private _rebuildPosedDecorations(): void {
        const face = this.currentPose.assemblyFace;
        const headTail = this.currentPose.headTail;

        this._replaceDecoration('_targets', new LgDecorationEntity('targets', buildTargets(this._section, face, 'normal')));
        this._replaceDecoration('_faceHL', new LgDecorationEntity('faceHighlight', buildFaceHighlight(this._section, face)));

        if (this._opts.showProjection) {
            const { object, footprints } = buildProjection(this._section, this._model!.component.secondary || [], face);
            this._projectionFootprints = footprints;
            this._replaceDecoration('_projection', new LgDecorationEntity('projection', object));
        } else {
            this._projectionFootprints = 0;
            this._replaceDecoration('_projection', null);
        }
        void headTail; // 头尾由位姿矩阵处理，靶标用 normal 布局
    }

    private _replaceDecoration(field: '_targets' | '_faceHL' | '_projection' | '_deviationEntity', next: LgDecorationEntity | null): void {
        const prev = this[field];
        if (prev) prev.removeFromParent();
        this[field] = next;
        if (next) this.addModel(next);
    }

    // ── 位姿 ─────────────────────────────────────────────────────────────
    public applyPose(pose: Pose): void {
        if (!this._model) return;
        this._model.pose = pose || { ...DEFAULT_POSE };
        this._rebuildPosedDecorations();
        if (this._deviationData) this._buildDeviation(this._deviationData);
        this._applyPoseMatrix();
        this.applyPreview();
        this.dirty();
    }

    private _poseMatrix(): THREE.Matrix4 {
        const pose = this.currentPose;
        const faceAngle: Record<AssemblyFace, number> = {
            top_flange: 0,
            bottom_flange: Math.PI,
            left_web: -Math.PI / 2,
            right_web: Math.PI / 2
        };
        const c = new THREE.Vector3(...memberCenter(this._section));
        const T1 = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z);
        const Rx = new THREE.Matrix4().makeRotationX(faceAngle[pose.assemblyFace] || 0);
        const Rz = new THREE.Matrix4().makeRotationZ(pose.headTail === 'reversed' ? Math.PI : 0);
        const T2 = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z);

        return new THREE.Matrix4().multiply(T2).multiply(Rz).multiply(Rx).multiply(T1);
    }

    private _applyPoseMatrix(): void {
        const M = this._poseMatrix();

        const apply = (e: { setLocalMatrix(m: THREE.Matrix4): void; dirtyPosition(): void } | null) => {
            if (!e) return;
            e.setLocalMatrix(M.clone());
            e.dirtyPosition();
        };
        apply(this._beam);
        this._secondaries.forEach(apply);
        this._posed.forEach(apply);
    }

    // ── 相机 / 视图 ───────────────────────────────────────────────────────
    public setViewPreset(name: ViewPreset | string): void {
        this._viewName = name;

        if (name === 'fit') { void this.fit();

            return; }
        let preset: OrbitPreset | undefined;
        if (name === 'assembly') preset = assemblyPreset(this.currentPose.assemblyFace);
        else preset = (PRESETS as Record<string, OrbitPreset>)[name];
        if (!preset) return;

        const offset = orbitDirection(preset);
        const dir = new THREE.Vector3(-offset[0], -offset[1], -offset[2]).normalize();
        const up = Math.abs(dir.z) > 0.98 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
        const center = new THREE.Vector3(...memberCenter(this._section));

        if (this.controller) {
            this.controller.target = center.clone();
            void this.controller.resetCamera(up, dir).then(() => this.fit());
        }
    }

    public async fit(): Promise<void> {
        await this.fitView();
    }

    public zoomBy(factor: number): void {
        const cam = this.camera as THREE.OrthographicCamera;

        if (cam && typeof cam.zoom === 'number') {
            cam.zoom = Math.max(0.02, cam.zoom * factor);
            cam.updateProjectionMatrix();
            this.dirty();
        }
    }

    public setRotCenterMode(on: boolean): void {
        this._rotMode = !!on;
        this._tool = this._rotMode ? 'rotcenter' : 'orbit';
        if (this._opts.onRotMode) this._opts.onRotMode(this._rotMode);
        this.dirty();
    }

    public setRotCenter(point: [number, number, number]): void {
        if (!this.controller) return;
        const p = new THREE.Vector3(point[0], point[1], point[2]).applyMatrix4(this._poseMatrix());
        this.controller.setRotateCenter(p);
        this._rotCenterSet = true;
        this.setRotCenterMode(false);
        this.dirty();
    }

    public resetRotCenter(): void {
        if (!this.controller) return;
        this.controller.setRotateCenter(new THREE.Vector3(...memberCenter(this._section)));
        this._rotCenterSet = false;
        this.dirty();
    }

    public setTool(tool: string): void {
        this._tool = tool;
        this.dirty();
    }

    // ── 预览 / 选中 / 偏差 ─────────────────────────────────────────────────
    public applyPreview(): void {
        const completed = this._previewMode === 'completed';
        const proj = !!this._opts.showProjection;
        this._secondaries.forEach((e) => e.setSolidVisible(proj ? completed : false));
        if (this._projection) this._projection.setVisibility(proj && !completed);
        this.dirty();
    }

    public setPreviewMode(mode: PreviewMode): void {
        this._previewMode = mode;
        this.applyPreview();
    }

    public selectSecondary(id: string | null): void {
        this._selected = id;
        this._secondaries.forEach((e) => e.setHighlighted(e.secondary.id === id));

        if (this._rotMode && id) {
            const e = this._secondaryById.get(id);
            if (e) this.controller?.setRotateCenter(e.worldPosition.clone());
        }
        this.dirty();
    }

    /** 把底座选中实体 id 映射回次零件业务 id（供 BOM 联动）。 */
    public secondaryIdOfEntity(entityId: number): string | null {
        return this._entityToSecondary.get(entityId) ?? null;
    }

    public applyDeviation(dev: Deviation | null): void {
        this._deviationData = dev;
        this._buildDeviation(dev);
        this.dirty();
    }

    private _buildDeviation(dev: Deviation | null): void {
        if (!dev) {
            this._replaceDecoration('_deviationEntity', null);

            return;
        }
        const { object } = buildDeviation(this._section, this.currentPose.assemblyFace, dev.value, dev.result);
        this._replaceDecoration('_deviationEntity', new LgDecorationEntity('deviation', object));
        const e = this._deviationEntity;

        if (e) { e.setLocalMatrix(this._poseMatrix()); e.dirtyPosition(); }
    }

    // ── 查询 ─────────────────────────────────────────────────────────────
    /** 世界点（构件系）经位姿变换后的屏幕坐标。 */
    public screenOf(world: [number, number, number]): { x: number; y: number } {
        const p = new THREE.Vector3(world[0], world[1], world[2]).applyMatrix4(this._poseMatrix());
        const s = this.wcsToScreen(p);

        return { x: s.x, y: s.y };
    }

    public getViewState(): LightGuideViewState {
        return {
            tool: this._tool,
            view: this._viewName,
            previewMode: this._previewMode,
            rotMode: this._rotMode,
            rotCenterSet: this._rotCenterSet,
            selected: this._selected,
            pose: this.currentPose,
            deviation: this._deviationData,
            targetCount: this._targets ? 12 : 0,
            secondaryCount: this._secondaries.length,
            secondaryVisible: this._secondaries.filter((e) => e.pickMesh.visible).length,
            projectionFootprints: this._projectionFootprints,
            hasAxes: !!this._axes,
            faceHighlight: !!this._faceHL
        };
    }

    private _clearEntities(): void {
        [this._beam, this._axes, this._targets, this._faceHL, this._projection, this._deviationEntity, ...this._secondaries]
            .forEach((e) => e?.removeFromParent());
        this._beam = null;
        this._axes = null;
        this._targets = null;
        this._faceHL = null;
        this._projection = null;
        this._deviationEntity = null;
        this._secondaries = [];
        this._secondaryById.clear();
        this._entityToSecondary.clear();
        this._deviationData = null;
        this._selected = null;
    }
}
