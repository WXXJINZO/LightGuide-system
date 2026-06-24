# LightGuide-system · WebCAD 分支（CAD-View 真实底座集成）

本分支是钢构装配激光投影系统的 **CAD-View** 在真实 WebCAD 底座（`@fsdev/webcad-cli`
模板 + `@fs/cadnginx`）上的实现，对应 `dev` 分支 **BLANKS.md** 中留给 Codex 的那一处空白：
把参考实现里用 vendored Three.js 手搓的 `BeamCanvas`，替换为继承底座 `Base3DCanvas`
的真实业务 Canvas，且保持上层 UI / 对外门面不变。

> `dev` 分支：需求文档、PRD、高保真原型、参考实现（Node 后端 + 原生 JS 前端 +
> webcad 镜像层）。
> 本 `WebCAD` 分支：基于 `@fsdev/webcad-cli` 脚手架的 WebCAD 业务库实现。

## 实现位置

业务库代码全部在 `src/projects/lightguide/`，复用本仓库 `src/common/`（webcad-cli 镜像层）
落到底座 `@fs/cadnginx`：

| BLANKS.md 要求的层 | 本分支实现 | 文件 |
|---|---|---|
| `BaseApp extends CadApp` | `LightGuideApp extends WebCadApiBase` | `view/lightguide_app.ts` |
| `BaseViewHandle` | `BeamViewHandle extends BaseViewHandle` | `view/beam_view_handle.ts` |
| `Base3DCanvas extends Cad3DCanvas` | `BeamCanvas extends Base3DCanvas` | `view/beam_canvas.ts` |
| `Entity → Display` | `BeamEntity` / `SecondaryEntity` / `LgDecorationEntity` → `SesNodeDisplay` | `model/*` |
| `registerCmd(view) + executeCommand` | `command/cmd_register.ts` + 命令类 | `command/*` |
| 纯几何（可单测） | H 型钢梁盒体、12 靶标、次零件放置、视图预设 | `geometry/beam_geometry.ts` |

对外门面 `window.LightGuideViewer.mount(host, model, opts) -> api` 与参考实现对齐
（`viewer_facade.ts`），UI 与 E2E 只依赖该门面与 `BeamViewHandle`。

## 已实现能力

H 型钢梁几何（`{h,b,tw,tf,length}`）、左端左下角坐标系 gizmo（§6.4）、默认等轴测
（左端左下→右端右上，§6.5）、12 编码靶标点（随装配面重新夹取，§11.1）、前/俯/侧/等轴测/
装配面视图预设、缩放/适配/旋转中心、位姿变换（头尾翻转 + 绕轴旋转到 4 个面）、两种预览模式
（投影视图 / 完成视图）、次零件实体 + §11 投影标注（绿色脚印 + 编号 + 缩略图）、偏差着色
（pass/near/out）、BOM ↔ CAD 选中联动。

所有业务对象经 `Entity → Display` / 命令 / 拾取注册链接入 `CadApp` / `Cad3DCanvas`；
位姿对每个"随位姿"实体施加局部矩阵，坐标轴 gizmo 留在世界系。

## 运行

```bash
npm install        # 需可访问 @fscut / @fsdev 内网 registry（见 .npmrc）
npm run dev        # 本地 dev server，访问 #/lightguide 路由
npm run build      # 产出 SDK 到 lib/
```

> 本地 HTTPS 自签名证书 `key.pem` / `cert.pem` 不入库；缺失时 dev server 自动回退 HTTP。

## 测试

```bash
npx vitest run src/projects/lightguide/geometry/beam_geometry.spec.ts   # 纯几何单测
npm run lint                                                            # eslint
npm run build                                                           # 类型 + 打包
```

运行时已用 headless Chrome（SwiftShader WebGL）验证 `#/lightguide` 路由能在真实底座上
渲染 H 型钢梁、靶标、面高亮、投影标注与底座 ViewCube。
