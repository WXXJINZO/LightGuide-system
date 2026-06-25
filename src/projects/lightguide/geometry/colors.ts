/** CAD-View 配色 —— 对齐 Claude Design 高保真原型（buildCad 的内联取色）。 */
export const COL = {
    steel: 0x707885,      // 原型钢材基色 rgb(112,120,133)
    edge: 0x14171c,       // 原型描边 #14171c
    axisX: 0xf2545b,      // 原型坐标轴 X 红
    axisY: 0x37d27a,      // 原型坐标轴 Y 绿
    axisZ: 0x5a7df5,      // 原型坐标轴 Z 蓝
    target: 0xe9edf4,     // 原型靶点：白色圆盘
    targetRing: 0x3d66f0, // 原型靶点：蓝色圆环 + 圆心
    sel: 0x3d66f0,        // 选中：主色蓝
    secondary: 0xcdd1d8,  // 次零件实体板（完成装配视图）钢灰
    contact: 0x37d27a,    // 装配面高亮 / §11 投影脚印 绿
    rot: 0x3d66f0,        // 旋转中心 蓝
    head: 0x3d66f0,       // 头端标记 蓝（原型 head 面 #3d66f0）
    devModel: 0x5a7df5,   // 偏差：模型边 蓝
    devOut: 0xf2545b,     // 偏差：超差 红
    devNear: 0xf5b53d,    // 偏差：接近阈值 琥珀
    devPass: 0x37d27a     // 偏差：通过 绿
} as const;
