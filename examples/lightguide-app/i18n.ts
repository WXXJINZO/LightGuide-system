/* i18n — EN / 中文. Reactive port of the reference SPA's public/js/i18n.js.
   `t(key, ...args)` reads `state.lang` so any template/computed that calls it
   re-evaluates when the language is switched. */
import { reactive } from 'vue';

type Dict = Record<string, string>;

const DICT: Record<'zh' | 'en', Dict> = {
    zh: {
        // Brand / chrome (kept EXACTLY per spec)
        'appName': '钢构装配激光投影系统',
        'appSub': '现场投影操作软件 V3',
        'role': '当前角色', 'worker': '装配工人',
        'lang.zh': '中文', 'lang.en': 'EN',
        'nav.home': '示例首页',

        // Stepper labels (5-step workflow)
        'step': '步骤',
        'step.1': '选择工程', 'step.2': '工位绑定', 'step.3': '位姿选择',
        'step.4': '偏差校验', 'step.5': '投影预览',

        // Header status badge (per current step)
        'header.ready': '工程可用', 'header.binding': '工位绑定中',
        'header.poseSet': '位姿设置中', 'header.checkPass': '校验通过',
        'header.alarm': '超差报警', 'header.projecting': '投影中',
        'header.paused': '投影已暂停', 'header.readyProject': '准备投影',

        // Generic / shared
        'slot': '工位', 'face': '装配面', 'current': '当前选择',
        'targets': '编码靶点', 'comps': '构件数',
        'createdBy': '编制', 'createdAt': '编制时间', 'viewInfo': '查看工程详情', 'refresh': '刷新',
        'loading': '加载中…', 'checking': '校验中…',
        'cancel': '取消', 'confirm': '确认', 'close': '关闭',
        'common.kg': 'kg', 'common.m': 'm', 'common.items': '件', 'common.count': '数量',

        // Page 1 — Select project
        'p1.title': '选择工程',
        'p1.desc': '办公室已为整个工程预先准备全部构件并上传至云端 —— 一个工程可能包含数千个构件。现场工人首先选择工程,再进入工位绑定,为当前正在装配的 6 个构件分配工位。',
        'p1.search': '按工程名称或编号搜索…',
        'p1.projInfo': '工程信息', 'p1.projCode': '工程编号',
        'p1.totalComps': '构件总数', 'p1.currentBatch': '当前批次',
        'p1.continueBind': '进入工位绑定',
        'p1.detailTitle': '工程详情',
        'p1.selectFirst': '请先选择一个工程',
        'p1.import': '导入模型', 'p1.imported': '已导入 {0}（{1} 次件）', 'p1.importFail': '导入失败：{0}',
        'p1.importing': '正在导入…', 'p1.importHint': 'IFC / STEP / STP',
        'p1.refreshed': '工程列表已刷新',

        // Project status pills
        'status.available': '可用', 'status.pending': '待确认', 'status.expired': '已过期',
        'status.prepared': '工程数据已准备完成',

        // Page 2 — Slot binding
        'p2.title': '工位绑定',
        'p2.desc': '工人将 6 个主件放入工作区。请为每个物理工位绑定对应的构件 / 投影文件 —— 物理摆放顺序可能与模型顺序不同。',
        'p2.chooseForSlot': '点击右侧候选构件进行绑定',
        'p2.candidates': '候选构件',
        'p2.searchComp': '搜索构件号 / 规格…',
        'p2.noMatch': '未找到匹配的构件',
        'p2.clearSearch': '清除搜索',
        'p2.bound': '已绑定', 'p2.unbound': '未绑定',
        'p2.bindingTo': '绑定到', 'p2.clearBind': '清除', 'p2.replace': '替换',
        'p2.pickSlot': '选择工位', 'p2.duplicate': '重复使用',
        'p2.completion': '已绑定 {0} / 6 个工位',
        'p2.toPose': '进入位姿选择', 'p2.needAll': '需绑定全部 6 个工位',
        'p2.usedIn': '已用于工位 {0}',

        // Recognition (merged into pose lane)
        'recog.startRecog': '开始识别', 'recog.recogPanel': '识别详情', 'recog.recogOk': '身份识别成功',
        'recog.noteTitle': '关键提示',
        'recog.note': '系统已根据编码靶点识别构件身份。下一步请为每根梁手动选择头尾方向并绕轴旋转确定装配面。靶点不能自动识别位姿。',
        'recog.confirm': '确认识别结果', 'recog.again': '重新识别',
        'header.recognized': '识别完成',

        // Faces
        'face.top': '顶翼缘', 'face.bottom': '底翼缘', 'face.left': '左腹板', 'face.right': '右腹板',

        // Workspace context (CAD overlays)
        'ws.current': '当前选择', 'ws.assemblyFace': '装配面', 'ws.ready': '待投影',
        'ws.pickBeam': '请选择一个已绑定的工位', 'ws.unboundBeam': '该工位尚未绑定构件',
        'ws.measured': '测量距离 {0} mm', 'ws.projView': '投影视图', 'ws.completedView': '完成装配视图',
        'ws.viewLabel': '视图', 'ws.viewport': '视口', 'ws.structure': '模型结构',
        'ws.rotHint': '点按模型设置旋转中心',

        // Tools / view presets
        'tool.fit': '适应窗口', 'tool.zoomIn': '放大', 'tool.zoomOut': '缩小', 'tool.pan': '平移',
        'tool.rotate': '三维旋转', 'tool.measure': '测量',
        'tool.rotCenter': '设置旋转中心 (Ctrl+R)', 'tool.rotCenterReset': '重置旋转中心',
        'view.front': '前视', 'view.top': '俯视', 'view.side': '侧视', 'view.iso': '等轴', 'view.assembly': '装配面',
        'view.frontFull': '前视图', 'view.topFull': '俯视图', 'view.sideFull': '侧视图',
        'view.isoFull': '等轴测', 'view.faceFull': '装配面视图', 'view.freeFull': '自由视角',
        'cube.top': '顶', 'cube.front': '前', 'cube.side': '侧',

        // BOM
        'bom.title': '构件材料清单', 'bom.primary': '主件', 'bom.total': '装配总重',
        'bom.col.id': '构件号', 'bom.col.spec': '规格', 'bom.col.length': '长度',
        'bom.col.material': '材质', 'bom.col.unit': '单重 KG', 'bom.col.qty': '数量',

        // Page 3 — Pose
        'pose.title': '位姿选择', 'pose.headTail': '头尾方向', 'pose.normal': '正向', 'pose.reversed': '反向',
        'pose.face': '当前装配面',
        'pose.reverse': '头尾翻转', 'pose.reverseSub': '沿长度方向调头',
        'pose.rotateAxis': '绕轴旋转 90°', 'pose.rotateSub': '切换当前装配面',
        'pose.hint': '调整后,三维模型实时更新当前装配位姿。',
        'pose.saveNext': '保存并设置下一根', 'pose.allSetCheck': '全部确认,进入校验',
        'pose.faceProgress': '装配面进度',
        'pose.faceAssembled': '已装配', 'pose.facePending': '未装配', 'pose.faceCurrent': '当前准备',
        'pose.saved': '已保存,已切换到下一根',
        'pose.needAllSet': '需完成全部 6 个工位的位姿', 'pose.allSetGo': '全部位姿已设置,可进入偏差校验',

        // Page 4 — Deviation check
        'check.title': '偏差校验', 'check.maxDev': '最大偏差', 'check.threshold': '阈值',
        'check.demoToggle': '演示:超差/正常',
        'check.alarmTitle': '超差报警 · 投影已阻止',
        'check.alarmDesc': '该梁几何偏差超过 3 mm 阈值,系统已阻止投影。请复核构件或放置情况。',
        'check.enterProj': '进入投影预览', 'check.checkAgain': '重新校验',
        'check.rechecked': '校验完成',
        'check.pass': '通过', 'check.near': '接近阈值', 'check.out': '超差',
        'check.needPose': '需完成全部 6 个工位的位姿', 'check.allPass': '校验通过,可进入投影预览',
        'check.blocked': '存在超差工位,已阻止投影',

        // Page 5 — Projection
        'proj.title': '投影预览', 'proj.partsList': '次构件清单', 'proj.parts': '个',
        'proj.projView': '投影视图', 'proj.doneView': '完成装配视图',
        'proj.allChecked': '6/6 已校验 · 可批量投影',
        'proj.pause': '暂停', 'proj.backPose': '返回修改位姿',
        'proj.startProj': '开始 6 梁批量投影', 'proj.pauseProj': '暂停投影', 'proj.continueProj': '继续投影',
        'proj.completeProj': '完成本次投影',
        'proj.completeHint': '完成后系统将停止投影,标记本装配面为已完成,并返回位姿选择设置下一装配面。',
        'proj.confirmCompleteTitle': '完成本次投影?',
        'proj.ready': '待投影', 'proj.projecting': '投影中', 'proj.paused': '已暂停', 'proj.completed': '已完成',
        'proj.started': '开始批量投影', 'proj.paused2': '投影已暂停', 'proj.resumed': '继续投影',
        'proj.faceCompleted': '装配面已完成',
        'proj.location': '位置', 'proj.type': '类型',
        'type.stiffener': '加劲板', 'type.connection_plate': '连接板', 'type.diaphragm': '隔板', 'type.other': '其他'
    },
    en: {
        'appName': 'Steel Assembly Laser Projection',
        'appSub': 'On-site Projection Operation · V3',
        'role': 'ROLE', 'worker': 'Assembly worker',
        'lang.zh': '中文', 'lang.en': 'EN',
        'nav.home': 'Examples',

        'step': 'STEP',
        'step.1': 'Select project', 'step.2': 'Slot binding', 'step.3': 'Pose',
        'step.4': 'Deviation', 'step.5': 'Projection',

        'header.ready': 'Project ready', 'header.binding': 'Binding slots',
        'header.poseSet': 'Setting pose', 'header.checkPass': 'Check passed',
        'header.alarm': 'Out of tolerance', 'header.projecting': 'Projecting',
        'header.paused': 'Paused', 'header.readyProject': 'Ready to project',

        'slot': 'Slot', 'face': 'Face', 'current': 'CURRENT',
        'targets': 'Targets', 'comps': 'Components',
        'createdBy': 'By', 'createdAt': 'Created', 'viewInfo': 'View project details', 'refresh': 'Refresh',
        'loading': 'Loading…', 'checking': 'Checking…',
        'cancel': 'Cancel', 'confirm': 'Confirm', 'close': 'Close',
        'common.kg': 'kg', 'common.m': 'm', 'common.items': 'pcs', 'common.count': 'Qty',

        'p1.title': 'Select project',
        'p1.desc': 'The office prepares every component for a whole project in advance and uploads them to the cloud — a project may contain thousands of components. On-site, you first choose a project, then continue to slot binding for the 6 components being assembled now.',
        'p1.search': 'Search by project name or code…',
        'p1.projInfo': 'Project information', 'p1.projCode': 'Project code',
        'p1.totalComps': 'Total components', 'p1.currentBatch': 'Current batch',
        'p1.continueBind': 'Continue to slot binding',
        'p1.detailTitle': 'Project details',
        'p1.selectFirst': 'Select a project first',
        'p1.import': 'Import model', 'p1.imported': 'Imported {0} ({1} parts)', 'p1.importFail': 'Import failed: {0}',
        'p1.importing': 'Importing…', 'p1.importHint': 'IFC / STEP / STP',
        'p1.refreshed': 'Project list refreshed',

        'status.available': 'Available', 'status.pending': 'Pending', 'status.expired': 'Expired',
        'status.prepared': 'Project data prepared',

        'p2.title': 'Slot binding',
        'p2.desc': 'The worker places 6 main parts in the work area. Bind each physical slot to its component / projection file — the placement order may differ from the model order.',
        'p2.chooseForSlot': 'Pick a candidate on the right to bind',
        'p2.candidates': 'Candidate components',
        'p2.searchComp': 'Search component / spec…',
        'p2.noMatch': 'No matching components',
        'p2.clearSearch': 'Clear search',
        'p2.bound': 'Bound', 'p2.unbound': 'Empty',
        'p2.bindingTo': 'Binding to', 'p2.clearBind': 'Clear', 'p2.replace': 'Replace',
        'p2.pickSlot': 'Pick slot', 'p2.duplicate': 'Used in multiple',
        'p2.completion': '{0} / 6 slots bound',
        'p2.toPose': 'Continue to pose', 'p2.needAll': 'Bind all 6 slots first',
        'p2.usedIn': 'Used in slot {0}',

        'recog.startRecog': 'Start recognition', 'recog.recogPanel': 'Recognition detail', 'recog.recogOk': 'Identity recognized',
        'recog.noteTitle': 'Note',
        'recog.note': 'Identity is recognized from coded targets. Next, manually reverse head-tail and rotate around the axis to set the assembly face. Targets cannot recognize pose.',
        'recog.confirm': 'Confirm result', 'recog.again': 'Recognize again',
        'header.recognized': 'Recognized',

        'face.top': 'Top flange', 'face.bottom': 'Bottom flange', 'face.left': 'Left web', 'face.right': 'Right web',

        'ws.current': 'Current', 'ws.assemblyFace': 'Assembly face', 'ws.ready': 'Ready',
        'ws.pickBeam': 'Select a bound slot', 'ws.unboundBeam': 'This slot is not bound',
        'ws.measured': 'Distance {0} mm', 'ws.projView': 'Projection', 'ws.completedView': 'Completed',
        'ws.viewLabel': 'VIEW', 'ws.viewport': 'Viewport', 'ws.structure': 'Structure',
        'ws.rotHint': 'Tap the model to set rotation center',

        'tool.fit': 'Fit to window', 'tool.zoomIn': 'Zoom in', 'tool.zoomOut': 'Zoom out', 'tool.pan': 'Pan',
        'tool.rotate': '3D rotate', 'tool.measure': 'Measure',
        'tool.rotCenter': 'Set rotation center (Ctrl+R)', 'tool.rotCenterReset': 'Reset rotation center',
        'view.front': 'Front', 'view.top': 'Top', 'view.side': 'Side', 'view.iso': 'Iso', 'view.assembly': 'Face',
        'view.frontFull': 'Front', 'view.topFull': 'Top', 'view.sideFull': 'Side',
        'view.isoFull': 'Isometric', 'view.faceFull': 'Assembly face', 'view.freeFull': 'Free orbit',
        'cube.top': 'T', 'cube.front': 'F', 'cube.side': 'R',

        'bom.title': 'Component Bill of Materials', 'bom.primary': 'PRIMARY', 'bom.total': 'Assembly total',
        'bom.col.id': 'PART ID', 'bom.col.spec': 'SPECIFICATION', 'bom.col.length': 'LENGTH',
        'bom.col.material': 'MATERIAL', 'bom.col.unit': 'UNIT KG', 'bom.col.qty': 'QTY',

        'pose.title': 'Pose selection', 'pose.headTail': 'Head-tail', 'pose.normal': 'Normal', 'pose.reversed': 'Reversed',
        'pose.face': 'Assembly face',
        'pose.reverse': 'Head-Tail Reverse', 'pose.reverseSub': 'Flip along length',
        'pose.rotateAxis': 'Rotate 90° around axis', 'pose.rotateSub': 'Cycle the assembly face',
        'pose.hint': 'The 3D model updates live as you change the pose.',
        'pose.saveNext': 'Save & set next', 'pose.allSetCheck': 'All set, go to check',
        'pose.faceProgress': 'Face progress',
        'pose.faceAssembled': 'Assembled', 'pose.facePending': 'Pending', 'pose.faceCurrent': 'Preparing',
        'pose.saved': 'Saved · moved to next',
        'pose.needAllSet': 'Set the pose for all 6 slots', 'pose.allSetGo': 'All poses set — you can go to the deviation check',

        'check.title': 'Deviation check', 'check.maxDev': 'Max deviation', 'check.threshold': 'Threshold',
        'check.demoToggle': 'demo: alarm',
        'check.alarmTitle': 'Out of tolerance · blocked',
        'check.alarmDesc': 'This beam exceeds the 3 mm threshold. Projection is blocked. Review the part or placement.',
        'check.enterProj': 'Enter projection preview', 'check.checkAgain': 'Check again',
        'check.rechecked': 'Re-check complete',
        'check.pass': 'Pass', 'check.near': 'Near threshold', 'check.out': 'Out of tolerance',
        'check.needPose': 'Set the pose for all 6 slots', 'check.allPass': 'Check passed — enter projection preview',
        'check.blocked': 'A slot is out of tolerance — projection blocked',

        'proj.title': 'Projection preview', 'proj.partsList': 'Secondary parts', 'proj.parts': 'parts',
        'proj.projView': 'Projection', 'proj.doneView': 'Completed',
        'proj.allChecked': '6/6 checked · ready for batch projection',
        'proj.pause': 'Pause', 'proj.backPose': 'Back to pose',
        'proj.startProj': 'Start batch projection · 6 beams', 'proj.pauseProj': 'Pause projection', 'proj.continueProj': 'Continue projection',
        'proj.completeProj': 'Complete this projection',
        'proj.completeHint': 'On completion the system stops projection, marks this face complete, and returns to pose selection for the next face.',
        'proj.confirmCompleteTitle': 'Complete this projection?',
        'proj.ready': 'Ready', 'proj.projecting': 'Projecting', 'proj.paused': 'Paused', 'proj.completed': 'Completed',
        'proj.started': 'Batch projection started', 'proj.paused2': 'Projection paused', 'proj.resumed': 'Projection resumed',
        'proj.faceCompleted': 'Assembly face completed',
        'proj.location': 'Location', 'proj.type': 'Type',
        'type.stiffener': 'Stiffener', 'type.connection_plate': 'Connection plate', 'type.diaphragm': 'Diaphragm', 'type.other': 'Other'
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
