/* i18n — EN / 中文. Reactive port of the reference SPA's public/js/i18n.js.
   `t(key, ...args)` reads `state.lang` so any template/computed that calls it
   re-evaluates when the language is switched. */
import { reactive } from 'vue';

type Dict = Record<string, string>;

const DICT: Record<'zh' | 'en', Dict> = {
    zh: {
        'brand.title': '钢构装配激光投影系统',
        'brand.subtitle': '现场投影操作软件 V4',
        'role.worker': '装配工人',
        'role.label': '当前角色',
        'lang.zh': '中文', 'lang.en': 'EN',
        'nav.home': '示例首页',

        'step.1': '选择工程', 'step.2': '工位绑定', 'step.3': '位姿选择',
        'step.4': '偏差校验', 'step.5': '投影预览',

        'status.available': '可用', 'status.pending': '待确认', 'status.expired': '已过期',
        'status.prepared': '工程数据已准备完成',

        // Page 1
        'p1.title': '选择工程',
        'p1.subtitle': '从云端选择一个已由办公室准备好的工程',
        'p1.search': '搜索工程名称、工程编号或构件编号',
        'p1.col.total': '构件总数', 'p1.col.prepared': '已准备',
        'p1.col.by': '编制人', 'p1.col.time': '编制时间',
        'p1.detail': '工程详情', 'p1.detail.empty': '请选择一个工程查看详情',
        'p1.components': '构件清单', 'p1.enterBinding': '进入工位绑定',
        'p1.selectFirst': '请先选择一个工程',
        'p1.import': '导入模型', 'p1.imported': '已导入 {0}（{1} 次件）', 'p1.importFail': '导入失败：{0}',
        'p1.importing': '正在导入…', 'p1.importHint': 'IFC / STEP / STP',

        // Page 2
        'p2.title': '工位绑定',
        'p2.subtitle': '将 6 个现场工位绑定到工程中的构件文件',
        'p2.search': '搜索构件文件（编号 / 规格）',
        'p2.slot': '工位', 'p2.unbound': '未绑定', 'p2.bound': '已绑定',
        'p2.bindHere': '绑定到此工位', 'p2.replace': '替换', 'p2.clear': '清除绑定',
        'p2.pickSlot': '选择工位', 'p2.duplicate': '重复使用',
        'p2.completion': '已绑定 {0} / 6 个工位',
        'p2.toPose': '手动位姿选择', 'p2.needAll': '需绑定全部 6 个工位',
        'p2.selectComponent': '从右侧构件列表选择，再点工位绑定',
        'p2.componentList': '可用构件文件',
        'p2.usedIn': '已用于工位 {0}',

        'face.top': '顶翼缘', 'face.bottom': '底翼缘', 'face.left': '左腹板', 'face.right': '右腹板',
        'ws.current': '当前选择', 'ws.assemblyFace': '装配面', 'ws.ready': '待投影',
        'ws.pickBeam': '请选择一个已绑定的工位', 'ws.unboundBeam': '该工位尚未绑定构件',
        'ws.measured': '测量距离 {0} mm', 'ws.projView': '投影视图', 'ws.completedView': '完成装配视图',

        'tool.fit': '适应窗口', 'tool.zoomIn': '放大', 'tool.zoomOut': '缩小', 'tool.pan': '平移',
        'tool.rotate': '三维旋转', 'tool.measure': '测量', 'tool.rotCenter': '设置旋转中心 (Ctrl+R)', 'tool.rotCenterReset': '重置旋转中心',
        'view.front': '前视', 'view.top': '俯视', 'view.side': '侧视', 'view.iso': '等轴', 'view.assembly': '装配面',

        'bom.title': '构件材料清单', 'bom.primary': '主件', 'bom.total': '装配总重',
        'bom.col.id': '构件号', 'bom.col.spec': '规格', 'bom.col.length': '长度',
        'bom.col.material': '材质', 'bom.col.unit': '单重 KG', 'bom.col.qty': '数量',

        'pose.title': '位姿选择', 'pose.headTail': '头尾方向', 'pose.normal': '正常', 'pose.reversed': '反转',
        'pose.face': '当前装配面', 'pose.save': '保存当前位姿', 'pose.saveNext': '保存并设置下一个',
        'pose.allConfirmed': '全部确认，进入校验', 'pose.set': '已设置', 'pose.notSet': '位姿未设置',
        'pose.status': '位姿状态', 'pose.completedFaces': '已完成面', 'pose.none': '无',
        'pose.hint': '逐个调整每根 H 钢的头尾方向与当前装配面；构件本身会真实翻转/旋转',
        'pose.needAllSet': '需完成全部 6 个工位的位姿', 'pose.saved': '工位 {0} 位姿已保存',
        'pose.allSetGo': '全部位姿已设置，可进入偏差校验',

        'check.title': '偏差校验', 'check.subtitle': '靶点拟合的实测边缘与模型边缘配准，计算几何偏差（阈值 3.0 mm）',
        'check.recheck': '重新校验', 'check.toPreview': '进入投影预览',
        'check.threshold': '阈值', 'check.maxDev': '最大偏差', 'check.result': '判定结果',
        'check.registered': '已配准', 'check.targetCount': '靶点数', 'check.status': '配准状态',
        'check.pass': '通过', 'check.near': '接近阈值', 'check.out': '超差',
        'check.alarm': '超差报警 · 投影已阻止', 'check.checking': '校验中…', 'check.done': '校验完成',
        'check.needPose': '需完成全部 6 个工位的位姿', 'check.allPass': '校验通过，可进入投影预览',
        'check.blocked': '存在超差工位，已阻止投影',

        'proj.title': '投影预览', 'proj.start': '开始 6 梁批量投影', 'proj.pause': '暂停投影',
        'proj.resume': '继续投影', 'proj.complete': '完成本次投影', 'proj.partList': '次零件清单',
        'proj.ready': '待投影', 'proj.projecting': '投影中', 'proj.paused': '已暂停', 'proj.completed': '已完成',
        'proj.started': '开始批量投影', 'proj.paused2': '投影已暂停', 'proj.resumed': '继续投影',
        'proj.faceDone': '装配面已完成', 'proj.confirmTitle': '完成本次投影', 'proj.parts': '次件',
        'proj.confirmBody': '将停止当前投影，把本装配面标记为已完成，并返回位姿选择设置下一个装配面。',
        'proj.confirm': '确认完成', 'proj.needCheck': '需通过偏差校验',
        'proj.viewProjection': '投影视图', 'proj.viewCompleted': '完成装配视图', 'proj.location': '位置', 'proj.type': '类型',
        'type.stiffener': '加劲板', 'type.connection_plate': '连接板', 'type.diaphragm': '隔板', 'type.other': '其他',

        'common.length': '长度', 'common.weight': '总重', 'common.spec': '规格',
        'common.kg': 'kg', 'common.m': 'm', 'common.cancel': '取消',
        'common.items': '件', 'common.count': '数量'
    },
    en: {
        'brand.title': 'Steel Assembly Laser Projection',
        'brand.subtitle': 'On-site Projection Software V4',
        'role.worker': 'Assembly Worker',
        'role.label': 'Current role',
        'lang.zh': '中文', 'lang.en': 'EN',
        'nav.home': 'Examples',

        'step.1': 'Select Project', 'step.2': 'Slot Binding', 'step.3': 'Pose Selection',
        'step.4': 'Deviation Check', 'step.5': 'Projection',

        'status.available': 'Available', 'status.pending': 'Pending', 'status.expired': 'Expired',
        'status.prepared': 'Project data prepared',

        'p1.title': 'Select Project',
        'p1.subtitle': 'Pick a cloud project prepared by office staff',
        'p1.search': 'Search project name, code or component number',
        'p1.col.total': 'Components', 'p1.col.prepared': 'Prepared',
        'p1.col.by': 'Prepared by', 'p1.col.time': 'Prepared at',
        'p1.detail': 'Project details', 'p1.detail.empty': 'Select a project to see details',
        'p1.components': 'Component files', 'p1.enterBinding': 'Continue to Slot Binding',
        'p1.selectFirst': 'Select a project first',
        'p1.import': 'Import model', 'p1.imported': 'Imported {0} ({1} parts)', 'p1.importFail': 'Import failed: {0}',
        'p1.importing': 'Importing…', 'p1.importHint': 'IFC / STEP / STP',

        'p2.title': 'Slot Binding',
        'p2.subtitle': 'Bind the 6 work slots to component files',
        'p2.search': 'Search component files (mark / spec)',
        'p2.slot': 'Slot', 'p2.unbound': 'Not bound', 'p2.bound': 'Bound',
        'p2.bindHere': 'Bind to this slot', 'p2.replace': 'Replace', 'p2.clear': 'Clear',
        'p2.pickSlot': 'Pick slot', 'p2.duplicate': 'Used in multiple',
        'p2.completion': '{0} / 6 slots bound',
        'p2.toPose': 'Manual Pose Selection', 'p2.needAll': 'Bind all 6 slots first',
        'p2.selectComponent': 'Pick a component on the right, then a slot',
        'p2.componentList': 'Available component files',
        'p2.usedIn': 'Used in slot {0}',

        'face.top': 'Top flange', 'face.bottom': 'Bottom flange', 'face.left': 'Left web', 'face.right': 'Right web',
        'ws.current': 'Current', 'ws.assemblyFace': 'Assembly face', 'ws.ready': 'Ready',
        'ws.pickBeam': 'Select a bound slot', 'ws.unboundBeam': 'This slot is not bound',
        'ws.measured': 'Distance {0} mm', 'ws.projView': 'Projection View', 'ws.completedView': 'Completed View',

        'tool.fit': 'Fit to window', 'tool.zoomIn': 'Zoom in', 'tool.zoomOut': 'Zoom out', 'tool.pan': 'Pan',
        'tool.rotate': '3D rotate', 'tool.measure': 'Measure', 'tool.rotCenter': 'Set rotation center (Ctrl+R)', 'tool.rotCenterReset': 'Reset rotation center',
        'view.front': 'Front', 'view.top': 'Top', 'view.side': 'Side', 'view.iso': 'Iso', 'view.assembly': 'Face',

        'bom.title': 'Component BOM', 'bom.primary': 'PRIMARY', 'bom.total': 'Assembly total',
        'bom.col.id': 'PART ID', 'bom.col.spec': 'SPECIFICATION', 'bom.col.length': 'LENGTH',
        'bom.col.material': 'MATERIAL', 'bom.col.unit': 'UNIT KG', 'bom.col.qty': 'QTY',

        'pose.title': 'Pose Selection', 'pose.headTail': 'Head / Tail', 'pose.normal': 'Normal', 'pose.reversed': 'Reversed',
        'pose.face': 'Assembly face', 'pose.save': 'Save pose', 'pose.saveNext': 'Save & set next',
        'pose.allConfirmed': 'All confirmed — go to check', 'pose.set': 'Set', 'pose.notSet': 'Pose not set',
        'pose.status': 'Pose status', 'pose.completedFaces': 'Completed faces', 'pose.none': 'none',
        'pose.hint': 'Set each H-beam’s head/tail direction and current face; the beam itself really flips/rotates',
        'pose.needAllSet': 'Set the pose for all 6 slots', 'pose.saved': 'Slot {0} pose saved',
        'pose.allSetGo': 'All poses set — you can go to the deviation check',

        'check.title': 'Deviation Check', 'check.subtitle': 'Register target-fitted actual edges to model edges; compute deviation (threshold 3.0 mm)',
        'check.recheck': 'Check again', 'check.toPreview': 'Enter Projection Preview',
        'check.threshold': 'Threshold', 'check.maxDev': 'Max deviation', 'check.result': 'Result',
        'check.registered': 'Registered', 'check.targetCount': 'Targets', 'check.status': 'Registration',
        'check.pass': 'Pass', 'check.near': 'Near threshold', 'check.out': 'Out of tolerance',
        'check.alarm': 'Out of tolerance · projection blocked', 'check.checking': 'Checking…', 'check.done': 'Check complete',
        'check.needPose': 'Set the pose for all 6 slots', 'check.allPass': 'Check passed — enter projection preview',
        'check.blocked': 'A slot is out of tolerance — projection blocked',

        'proj.title': 'Projection Preview', 'proj.start': 'Start 6-beam batch projection', 'proj.pause': 'Pause projection',
        'proj.resume': 'Continue projection', 'proj.complete': 'Complete this projection', 'proj.partList': 'Secondary parts',
        'proj.ready': 'Ready', 'proj.projecting': 'Projecting', 'proj.paused': 'Paused', 'proj.completed': 'Completed',
        'proj.started': 'Batch projection started', 'proj.paused2': 'Projection paused', 'proj.resumed': 'Projection resumed',
        'proj.faceDone': 'Assembly face completed', 'proj.confirmTitle': 'Complete this projection', 'proj.parts': 'parts',
        'proj.confirmBody': 'This stops the current projection, marks this assembly face as completed and returns to pose selection for the next face.',
        'proj.confirm': 'Confirm', 'proj.needCheck': 'Pass the deviation check first',
        'proj.viewProjection': 'Projection View', 'proj.viewCompleted': 'Completed View', 'proj.location': 'Location', 'proj.type': 'Type',
        'type.stiffener': 'Stiffener', 'type.connection_plate': 'Connection plate', 'type.diaphragm': 'Diaphragm', 'type.other': 'Other',

        'common.length': 'Length', 'common.weight': 'Weight', 'common.spec': 'Spec',
        'common.kg': 'kg', 'common.m': 'm', 'common.cancel': 'Cancel',
        'common.items': 'pcs', 'common.count': 'Qty'
    }
};

const state = reactive<{ lang: 'zh' | 'en' }>({
    lang: (localStorage.getItem('lg_lang') as 'zh' | 'en') || 'zh'
});

export function t(key: string, ...args: (string | number)[]): string {
    let s = (DICT[state.lang] && DICT[state.lang][key]) || DICT.zh[key] || key;
    args.forEach((a, i) => { s = s.replace(`{${i}}`, String(a)); });
    return s;
}

export function setLang(lang: string): void {
    state.lang = lang === 'en' ? 'en' : 'zh';
    localStorage.setItem('lg_lang', state.lang);
    document.documentElement.lang = state.lang;
}

export function useI18n() {
    return { state, t, setLang };
}
