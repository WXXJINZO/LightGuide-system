import { CmdBase } from '@/common';
import { BeamCanvas } from '../view/beam_canvas';
import { ViewPreset } from '../model/types';

/** 切换工具。 */
export class CmdSetTool extends CmdBase<{ tool: string }, BeamCanvas> {
    async commit() {
        this._view.setTool(this._params?.tool ?? 'orbit');
        super.commit();
    }
}

/** 切换视图预设。 */
export class CmdSetView extends CmdBase<{ name: ViewPreset | string }, BeamCanvas> {
    async commit() {
        this._view.setViewPreset(this._params?.name ?? 'iso');
        super.commit();
    }
}

/** 缩放。 */
export class CmdZoom extends CmdBase<{ factor: number }, BeamCanvas> {
    async commit() {
        this._view.zoomBy(this._params?.factor ?? 1);
        super.commit();
    }
}

/** 适配视图。 */
export class CmdFit extends CmdBase<Record<string, never>, BeamCanvas> {
    async commit() {
        await this._view.fit();
        super.commit();
    }
}

/** 旋转中心拾取模式开关。 */
export class CmdSetRotCenterMode extends CmdBase<{ on: boolean }, BeamCanvas> {
    async commit() {
        this._view.setRotCenterMode(!!this._params?.on);
        super.commit();
    }
}

/** 设置旋转中心。 */
export class CmdSetRotCenter extends CmdBase<{ point: [number, number, number] }, BeamCanvas> {
    async commit() {
        if (this._params?.point) this._view.setRotCenter(this._params.point);
        super.commit();
    }
}

/** 复位旋转中心。 */
export class CmdResetRotCenter extends CmdBase<Record<string, never>, BeamCanvas> {
    async commit() {
        this._view.resetRotCenter();
        super.commit();
    }
}
