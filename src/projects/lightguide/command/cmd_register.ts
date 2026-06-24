import { CommandClass, CmdParamTypesOf, registerCmds } from '@/common/command/cmd_types';
import { BeamCanvas } from '../view/beam_canvas';
import { CMD_TYPES } from './cmd_types';
import { CmdLoadBeam } from './cmd_load_beam';
import {
    CmdFit,
    CmdResetRotCenter,
    CmdSetRotCenter,
    CmdSetRotCenterMode,
    CmdSetTool,
    CmdSetView,
    CmdZoom
} from './cmd_view_ops';
import { CmdSelect, CmdSetDeviation, CmdSetPose, CmdSetPreview } from './cmd_model_ops';

export const LIGHTGUIDE_CMD_CLASS_MAP = {
    [CMD_TYPES.LOAD_BEAM]: CmdLoadBeam,
    [CMD_TYPES.SET_TOOL]: CmdSetTool,
    [CMD_TYPES.SET_VIEW]: CmdSetView,
    [CMD_TYPES.ZOOM]: CmdZoom,
    [CMD_TYPES.FIT]: CmdFit,
    [CMD_TYPES.SET_ROTCENTER_MODE]: CmdSetRotCenterMode,
    [CMD_TYPES.SET_ROTCENTER]: CmdSetRotCenter,
    [CMD_TYPES.RESET_ROTCENTER]: CmdResetRotCenter,
    [CMD_TYPES.SET_POSE]: CmdSetPose,
    [CMD_TYPES.SET_PREVIEW]: CmdSetPreview,
    [CMD_TYPES.SELECT]: CmdSelect,
    [CMD_TYPES.SET_DEVIATION]: CmdSetDeviation
} satisfies Record<CMD_TYPES, CommandClass<any>>;

export type LightGuideCmdParamTypes = CmdParamTypesOf<typeof LIGHTGUIDE_CMD_CLASS_MAP>;

export function registerCmd(view: BeamCanvas) {
    registerCmds(view, LIGHTGUIDE_CMD_CLASS_MAP);
}
