/**
 * LightGuide 钢构装配激光投影系统 —— CAD-View 业务库入口。
 *
 * 基于本仓库 `src/common`（webcad-cli 镜像层）落到真实底座 `@fs/cadnginx`：
 * H 型钢梁 Entity/Display、12 编码靶标、次零件、坐标系 gizmo、位姿变换、视图预设、
 * 偏差着色、投影标注，全部经 Entity→Display / 命令 / 拾取注册链接入。
 */
export * from './model/types';
export * from './geometry/beam_geometry';
export { BeamEntity } from './model/beam_entity';
export { SecondaryEntity } from './model/secondary_entity';
export { LgDecorationEntity } from './model/decoration_entity';
export { BeamCanvas } from './view/beam_canvas';
export { BeamViewHandle } from './view/beam_view_handle';
export { LightGuideApp } from './view/lightguide_app';
export { CMD_TYPES as LIGHTGUIDE_CMD_TYPES } from './command/cmd_types';
export { LightGuideViewer, mountLightGuideViewer } from './viewer_facade';
export type { LightGuideViewerApi } from './viewer_facade';
