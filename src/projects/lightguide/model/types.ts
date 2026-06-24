/**
 * LightGuide CAD-View 业务数据模型类型。
 *
 * 钢构装配激光投影系统：每个工位绑定一个构件文件（H 型钢梁），现场工人手动设置
 * 位姿、做边缘配准偏差校验，最后批量投影当前装配面的次零件信息。
 *
 * 坐标约定（构件坐标系，与需求 §6.4 一致）：
 *   X = 梁长方向（左端面 x=0 → 右端面 x=length）
 *   Y = 翼缘宽度方向（居中：-b/2 .. +b/2）
 *   Z = 截面高度 / 向上（0 = 下翼缘外表面 .. h = 上翼缘）
 *   坐标系原点位于左端左下角 (x=0, y=-b/2, z=0)。
 */

/** 装配面（当前正在准备投影的面）。 */
export type AssemblyFace = 'top_flange' | 'bottom_flange' | 'left_web' | 'right_web';

/** 头尾方向（位姿步骤可整体翻转）。 */
export type HeadTail = 'normal' | 'reversed';

/** 视图预设。 */
export type ViewPreset = 'iso' | 'front' | 'top' | 'side' | 'assembly' | 'fit';

/** 投影预览模式：投影视图（绿色脚印 + 标注）/ 完成视图（实体次零件）。 */
export type PreviewMode = 'projection' | 'completed';

/** 偏差校验结果等级（V3 §08：≤2.4 pass · 2.4–3.0 near · >3.0 out）。 */
export type DeviationResult = 'pass' | 'near' | 'out';

/** H 型钢梁截面与长度（mm）。 */
export interface BeamSection {
    /** 截面高度 */
    h: number;
    /** 翼缘宽度 */
    b: number;
    /** 腹板厚度 */
    tw: number;
    /** 翼缘厚度 */
    tf: number;
    /** 梁长 */
    length: number;
}

/** 次零件尺寸（mm）。a/w 沿面内宽度，h 沿面法线高度，t 沿梁长厚度。 */
export interface SecondarySize {
    w: number;
    h: number;
    t: number;
}

/** 次零件孔阵。 */
export interface HoleGrid {
    rows: number;
    cols: number;
}

/** 次零件（钢板/连接件），驱动绿色脚印、编号、缩略图、实体。 */
export interface SecondaryPart {
    /** 业务唯一标识（用于 BOM ↔ CAD 联动） */
    id: string;
    /** 编号（投影时显示的白色文字） */
    number: string;
    /** 所在装配面 */
    face: AssemblyFace;
    /** 沿梁长方向的站位（近端坐标，mm） */
    position_mm: number;
    /** 尺寸 */
    size?: SecondarySize;
    /** 孔阵 */
    holes?: HoleGrid;
}

/** 当前位姿。 */
export interface Pose {
    headTail: HeadTail;
    assemblyFace: AssemblyFace;
}

/** 偏差校验数据。 */
export interface Deviation {
    /** 最大偏差值（mm） */
    value: number;
    /** 结果等级 */
    result: DeviationResult;
}

/** 构件文件（H 型钢梁 + 次零件）。 */
export interface ComponentModel {
    /** H 型钢梁几何参数 */
    hbeam: BeamSection;
    /** 次零件列表 */
    secondary?: SecondaryPart[];
}

/** CAD-View 挂载所需的完整业务模型。 */
export interface LightGuideModel {
    component: ComponentModel;
    pose?: Pose;
    deviation?: Deviation | null;
}

/** 挂载选项。 */
export interface LightGuideViewOptions {
    /** 初始预览模式 */
    previewMode?: PreviewMode;
    /** 是否显示 §11 投影标注（脚印 + 编号 + 缩略图） */
    showProjection?: boolean;
    /** 选中次零件回调（BOM 联动） */
    onSelect?: (secondaryId: string | null) => void;
    /** 测量结果回调（mm） */
    onMeasure?: (value: number) => void;
    /** 旋转中心拾取模式切换回调 */
    onRotMode?: (on: boolean) => void;
}

/** getState 返回的视图状态快照（E2E / UI 依赖）。 */
export interface LightGuideViewState {
    tool: string;
    view: string;
    previewMode: PreviewMode;
    rotMode: boolean;
    rotCenterSet: boolean;
    selected: string | null;
    pose: Pose;
    deviation: Deviation | null;
    targetCount: number;
    secondaryCount: number;
    secondaryVisible: number;
    projectionFootprints: number;
    hasAxes: boolean;
    faceHighlight: boolean;
}
