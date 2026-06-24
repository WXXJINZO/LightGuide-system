export enum CMD_TYPES {
    /** 加载/重建梁模型 */
    LOAD_BEAM = 'lgLoadBeam',
    /** 切换工具（orbit/pan/measure/rotcenter） */
    SET_TOOL = 'lgSetTool',
    /** 切换视图预设（iso/front/top/side/assembly/fit） */
    SET_VIEW = 'lgSetView',
    /** 缩放 */
    ZOOM = 'lgZoom',
    /** 适配视图 */
    FIT = 'lgFit',
    /** 旋转中心拾取模式开关 */
    SET_ROTCENTER_MODE = 'lgSetRotCenterMode',
    /** 设置旋转中心 */
    SET_ROTCENTER = 'lgSetRotCenter',
    /** 复位旋转中心 */
    RESET_ROTCENTER = 'lgResetRotCenter',
    /** 设置位姿（头尾翻转 + 装配面） */
    SET_POSE = 'lgSetPose',
    /** 切换预览模式 */
    SET_PREVIEW = 'lgSetPreview',
    /** 选中次零件 */
    SELECT = 'lgSelect',
    /** 设置偏差可视化 */
    SET_DEVIATION = 'lgSetDeviation'
}
