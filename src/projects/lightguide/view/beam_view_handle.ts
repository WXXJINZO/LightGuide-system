import { BaseViewHandle } from '@/common';
import { BeamCanvas } from './beam_canvas';
import { CMD_TYPES } from '../command/cmd_types';
import {
    Deviation,
    LightGuideModel,
    LightGuideViewOptions,
    LightGuideViewState,
    Pose,
    PreviewMode,
    ViewPreset
} from '../model/types';

/**
 * 对外稳定的 UI 句柄（替换参考实现的 BeamViewHandle，落到底座 BaseViewHandle）。
 *
 * 所有写操作都经 `executeCommand` → `app.executeAsyncCmd` 路由到命令系统，
 * 与 webcad-cli 的命令驱动一致；查询（screenOf/getState）直接读 canvas。
 */
export class BeamViewHandle extends BaseViewHandle<BeamCanvas> {
    public get canvas(): BeamCanvas {
        return this._canvas;
    }

    public loadModel(model: LightGuideModel, opts?: LightGuideViewOptions): Promise<any> {
        return this.executeCommand(CMD_TYPES.LOAD_BEAM, { model, opts });
    }

    public setTool(tool: string): Promise<any> {
        return this.executeCommand(CMD_TYPES.SET_TOOL, { tool });
    }

    public setView(name: ViewPreset | string): Promise<any> {
        return this.executeCommand(CMD_TYPES.SET_VIEW, { name });
    }

    public zoom(factor: number): Promise<any> {
        return this.executeCommand(CMD_TYPES.ZOOM, { factor });
    }

    public fit(): Promise<any> {
        return this.executeCommand(CMD_TYPES.FIT, {});
    }

    public setRotationCenterMode(on: boolean): Promise<any> {
        return this.executeCommand(CMD_TYPES.SET_ROTCENTER_MODE, { on });
    }

    public setRotationCenter(point: [number, number, number]): Promise<any> {
        return this.executeCommand(CMD_TYPES.SET_ROTCENTER, { point });
    }

    public resetRotationCenter(): Promise<any> {
        return this.executeCommand(CMD_TYPES.RESET_ROTCENTER, {});
    }

    public setPose(pose: Pose): Promise<any> {
        return this.executeCommand(CMD_TYPES.SET_POSE, { pose });
    }

    public setPreviewMode(mode: PreviewMode): Promise<any> {
        return this.executeCommand(CMD_TYPES.SET_PREVIEW, { mode });
    }

    public setSelected(id: string | null): Promise<any> {
        return this.executeCommand(CMD_TYPES.SELECT, { id });
    }

    public setDeviation(deviation: Deviation | null): Promise<any> {
        return this.executeCommand(CMD_TYPES.SET_DEVIATION, { deviation });
    }

    public screenOf(world: [number, number, number]): { x: number; y: number } {
        return this._canvas.screenOf(world);
    }

    public getState(): LightGuideViewState {
        return this._canvas.getViewState();
    }

    /** 把底座选中实体映射回次零件业务 id（BOM 联动用）。 */
    public secondaryIdOfEntity(entityId: number): string | null {
        return this._canvas.secondaryIdOfEntity(entityId);
    }
}
