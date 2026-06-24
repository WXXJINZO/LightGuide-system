import { CmdBase } from '@/common';
import { BeamCanvas } from '../view/beam_canvas';
import { Deviation, Pose, PreviewMode } from '../model/types';

/** 设置位姿（头尾翻转 + 装配面），靶标与投影随之重建并随梁变换。 */
export class CmdSetPose extends CmdBase<{ pose: Pose }, BeamCanvas> {
    async commit() {
        if (this._params?.pose) this._view.applyPose(this._params.pose);
        super.commit();
    }
}

/** 切换预览模式（投影视图 / 完成视图）。 */
export class CmdSetPreview extends CmdBase<{ mode: PreviewMode }, BeamCanvas> {
    async commit() {
        this._view.setPreviewMode(this._params?.mode ?? 'projection');
        super.commit();
    }
}

/** 选中次零件（BOM ↔ CAD 联动）。 */
export class CmdSelect extends CmdBase<{ id: string | null }, BeamCanvas> {
    async commit() {
        this._view.selectSecondary(this._params?.id ?? null);
        super.commit();
    }
}

/** 设置偏差可视化。 */
export class CmdSetDeviation extends CmdBase<{ deviation: Deviation | null }, BeamCanvas> {
    async commit() {
        this._view.applyDeviation(this._params?.deviation ?? null);
        super.commit();
    }
}
