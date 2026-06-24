import { CmdBase } from '@/common';
import { BeamCanvas } from '../view/beam_canvas';
import { LightGuideModel, LightGuideViewOptions } from '../model/types';

export interface LoadBeamParams {
    model: LightGuideModel;
    opts?: LightGuideViewOptions;
}

/** 构建并接入 H 型钢梁及其全部业务实体。 */
export class CmdLoadBeam extends CmdBase<LoadBeamParams, BeamCanvas> {
    async commit() {
        const params = this._params;

        if (!params || !params.model || !params.model.component) {
            throw new Error('CmdLoadBeam: 缺少有效的模型数据');
        }
        this._view.loadModel(params.model, params.opts || {});
        super.commit();
    }
}
