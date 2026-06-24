/**
 * THREE 几何构建器 —— 把纯几何数据（beam_geometry.ts）落成 THREE.Object3D。
 *
 * 这些 Object3D 会作为业务 Entity 的 geometry，经 Entity→Display 注册链渲染。
 * 所有装饰对象（靶标、坐标轴、面高亮、投影标注、偏差线）的 raycast 都被禁用，
 * 仅梁与次零件参与拾取。
 */
import * as THREE from 'three';
import { COL } from './colors';
import {
    assemblyPreset,
    faceNormal,
    hBeamBoxes,
    memberCenter,
    originPoint,
    PRESETS,
    secondaryPlacement,
    targetLayout
} from './beam_geometry';
import { AssemblyFace, BeamSection, HeadTail, HoleGrid, SecondaryPart, SecondarySize } from '../model/types';

const Z = new THREE.Vector3(0, 0, 1);

function disableRaycast(obj: THREE.Object3D): void {
    obj.traverse((o) => { o.raycast = () => { /* 非拾取装饰 */ }; });
}

/** H 型钢梁实体几何：三个长方体 + 边线 + 头端标记。返回的 meshes 用于拾取。 */
export function buildBeam(sec: BeamSection): { object: THREE.Group; meshes: THREE.Mesh[] } {
    const group = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    const mat = new THREE.MeshStandardMaterial({ color: COL.steel, metalness: 0.25, roughness: 0.62, flatShading: true });
    const em = new THREE.LineBasicMaterial({ color: COL.edge, transparent: true, opacity: 0.55 });

    for (const box of hBeamBoxes(sec)) {
        const g = new THREE.BoxGeometry(box.size[0], box.size[1], box.size[2]);
        const m = new THREE.Mesh(g, mat);
        m.position.set(box.center[0], box.center[1], box.center[2]);
        m.userData.beam = true;
        meshes.push(m);
        group.add(m);

        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), em);
        edge.position.copy(m.position);

        edge.raycast = () => { /* 边线不拾取 */ };
        group.add(edge);
    }

    // 头端标记：H 型钢左右对称，加一个端帽让头尾翻转可见。
    const capR = Math.max(sec.b, sec.h) * 0.12;
    const cap = new THREE.Mesh(
        new THREE.SphereGeometry(capR, 16, 16),
        new THREE.MeshStandardMaterial({ color: COL.head, metalness: 0.2, roughness: 0.5, emissive: 0x4a2200 })
    );
    cap.position.set(0, 0, sec.h + capR);

    cap.raycast = () => { /* 标记不拾取 */ };
    group.add(cap);

    return { object: group, meshes };
}

/** 12 个编码靶标点（绿色圆盘 + 暗环），夹取到当前装配面。 */
export function buildTargets(sec: BeamSection, face: AssemblyFace, headTail: HeadTail): THREE.Group {
    const root = new THREE.Group();
    const r = Math.max(18, Math.max(sec.b, sec.h) * 0.05);
    const discMat = new THREE.MeshBasicMaterial({ color: COL.target, side: THREE.DoubleSide });
    const ringMat = new THREE.MeshBasicMaterial({ color: COL.targetRing, side: THREE.DoubleSide });

    for (const t of targetLayout(sec, face, headTail)) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CircleGeometry(r, 24), discMat));
        const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.55, r * 0.8, 24), ringMat);
        ring.position.z = 0.4;
        g.add(ring);
        g.quaternion.setFromUnitVectors(Z, new THREE.Vector3(t.normal[0], t.normal[1], t.normal[2]));
        g.position.set(t.pos[0], t.pos[1], t.pos[2]);
        root.add(g);
    }
    disableRaycast(root);

    return root;
}

/** 当前装配面的半透明绿色高亮平面（R-7.3 / R-11.1）。 */
export function buildFaceHighlight(sec: BeamSection, face: AssemblyFace): THREE.Mesh {
    const { h, b, length } = sec;
    const eps = 3;
    let geo: THREE.PlaneGeometry;
    let pos: [number, number, number];
    let euler: [number, number, number];

    if (face === 'top_flange' || face === 'bottom_flange') {
        geo = new THREE.PlaneGeometry(length, b);
        pos = [length / 2, 0, face === 'top_flange' ? h + eps : -eps];
        euler = [0, 0, 0];
    } else {
        geo = new THREE.PlaneGeometry(length, h);
        pos = [length / 2, face === 'left_web' ? -b / 2 - eps : b / 2 + eps, h / 2];
        euler = [face === 'left_web' ? Math.PI / 2 : -Math.PI / 2, 0, 0];
    }

    const mat = new THREE.MeshBasicMaterial({ color: COL.contact, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(euler[0], euler[1], euler[2]);
    m.renderOrder = 1;

    m.raycast = () => { /* 高亮不拾取 */ };

    return m;
}

/** 单个次零件实体板（钢板）。返回 mesh 及其材质用于拾取与选中高亮。 */
export function buildSecondary(sec: BeamSection, s: SecondaryPart): { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial } {
    const size: SecondarySize = s.size || { w: 200, h: 80, t: 10 };
    const p = secondaryPlacement(sec, s);
    const geo = new THREE.BoxGeometry(size.t, size.w, size.h);
    const material = new THREE.MeshStandardMaterial({ color: COL.secondary, metalness: 0.25, roughness: 0.55, flatShading: true });
    const m = new THREE.Mesh(geo, material);

    const u = new THREE.Vector3(...p.uAxis);
    const v = new THREE.Vector3(...p.vAxis);
    const n = new THREE.Vector3(...p.normal);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
    m.position.set(
        s.position_mm + n.x * size.h / 2,
        p.center[1] + n.y * size.h / 2,
        p.center[2] + n.z * size.h / 2
    );
    m.userData.secondaryId = s.id;

    return { mesh: m, material };
}

/** 左端左下角坐标系 gizmo（X 红 / Y 绿 / Z 蓝）。世界坐标系，不随位姿变换。 */
export function buildAxes(sec: BeamSection): THREE.Group {
    const o = originPoint(sec);
    const len = Math.max(sec.b, sec.h) * 0.8;
    const group = new THREE.Group();

    const axis = (dir: [number, number, number], color: number) => {
        const end: [number, number, number] = [o[0] + dir[0] * len, o[1] + dir[1] * len, o[2] + dir[2] * len];
        const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...o), new THREE.Vector3(...end)]);
        group.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color })));
        const cone = new THREE.Mesh(new THREE.ConeGeometry(len * 0.06, len * 0.18, 12), new THREE.MeshBasicMaterial({ color }));
        cone.position.set(...end);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir));
        group.add(cone);
    };
    axis([1, 0, 0], COL.axisX);
    axis([0, 1, 0], COL.axisY);
    axis([0, 0, 1], COL.axisZ);

    const ob = new THREE.Mesh(new THREE.SphereGeometry(len * 0.05, 12, 12), new THREE.MeshBasicMaterial({ color: 0xe6edf5 }));
    ob.position.set(...o);
    group.add(ob);
    disableRaycast(group);

    return group;
}

/** 白色文字平面（CanvasTexture），按 mm 尺寸（高度固定，宽度由文字决定）。 */
function makeTextPlane(text: string, heightMm: number): { mesh: THREE.Mesh; widthMm: number } {
    const pxH = 96;
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `700 ${Math.round(pxH * 0.66)}px Inter, sans-serif`;
    const tw = Math.ceil(ctx.measureText(text).width) + 18;
    const c = ctx.canvas;
    c.width = tw;
    c.height = pxH;
    ctx.font = `700 ${Math.round(pxH * 0.66)}px Inter, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, 9, pxH / 2 + 2);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    const widthMm = heightMm * (tw / pxH);
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(widthMm, heightMm),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );

    mesh.raycast = () => { /* 标注不拾取 */ };
    mesh.renderOrder = 3;

    return { mesh, widthMm };
}

/** 白色缩略图平面：零件外轮廓 + 孔阵。 */
function makeThumbPlane(holes: HoleGrid, alongMm: number, acrossMm: number): THREE.Mesh {
    const ratio = (alongMm > 0 && Number.isFinite(acrossMm / alongMm)) ? acrossMm / alongMm : 1;
    const pxW = 160;
    const pxH = Math.min(640, Math.max(40, Math.round(pxW * ratio)));
    const ctx = document.createElement('canvas').getContext('2d')!;
    const c = ctx.canvas;
    c.width = pxW;
    c.height = pxH;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 4;
    ctx.fillRect(4, 4, pxW - 8, pxH - 8);
    ctx.strokeRect(4, 4, pxW - 8, pxH - 8);

    if (holes.rows > 0 && holes.cols > 0) {
        ctx.fillStyle = '#0c1117';
        const r = Math.min(pxW / (holes.cols * 3), pxH / (holes.rows * 3));

        for (let i = 0; i < holes.rows; i++) {
            for (let j = 0; j < holes.cols; j++) {
                const x = pxW * (j + 1) / (holes.cols + 1);
                const y = pxH * (i + 1) / (holes.rows + 1);
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(alongMm, acrossMm),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );

    mesh.raycast = () => { /* 缩略图不拾取 */ };
    mesh.renderOrder = 3;

    return mesh;
}

/**
 * §11 投影标注：当前装配面上每个次零件画绿色脚印轮廓 + 白色编号 + 白色缩略图，
 * 三者与翼缘共面（3D 跟随透视，非 billboard）。返回携带脚印数的 group。
 */
export function buildProjection(sec: BeamSection, secondaries: SecondaryPart[], face: AssemblyFace): { object: THREE.Group; footprints: number } {
    const g = new THREE.Group();
    const onFace = secondaries.filter((s) => s.face === face).slice().sort((a, b) => a.position_mm - b.position_mm);
    if (!onFace.length) return { object: g, footprints: 0 };

    const { h, b } = sec;
    const flangeW = (face === 'top_flange' || face === 'bottom_flange') ? b : h;
    const p0 = secondaryPlacement(sec, { face, position_mm: 0 });
    const u = new THREE.Vector3(...p0.uAxis);
    const v = new THREE.Vector3(...p0.vAxis);
    const n = new THREE.Vector3(...p0.normal);
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
    const eps = 5;
    const greenMat = new THREE.LineBasicMaterial({ color: COL.contact });

    const facePoint = (xLen: number, across: number) => {
        const c = secondaryPlacement(sec, { face, position_mm: xLen }).center;

        return new THREE.Vector3(c[0], c[1], c[2]).addScaledVector(v, across).addScaledVector(n, eps);
    };

    let footprints = 0;

    for (const s of onFace) {
        const size: SecondarySize = s.size || { w: 200, h: 80, t: 10 };
        const holes: HoleGrid = s.holes || { rows: 0, cols: 0 };
        const near = s.position_mm;

        const fp = [[near, -size.w / 2], [near + size.t, -size.w / 2], [near + size.t, size.w / 2], [near, size.w / 2], [near, -size.w / 2]]
            .map(([x, a]) => facePoint(x, a));
        const loop = new THREE.Line(new THREE.BufferGeometry().setFromPoints(fp), greenMat);

        loop.raycast = () => { /* 脚印不拾取 */ };
        loop.userData.secondaryId = s.id;
        g.add(loop);
        footprints++;

        const dir = (near + size.t + 30 + 1200 > sec.length) ? -1 : 1;
        let cursor = near + (dir > 0 ? size.t + 30 : -30);

        const num = makeTextPlane(s.number, 80);
        num.mesh.position.copy(facePoint(cursor + dir * num.widthMm / 2, 0));
        num.mesh.quaternion.copy(quat);
        g.add(num.mesh);
        cursor += dir * (num.widthMm + 30);

        const longEdge = Math.max(size.w, size.h);
        const scale = (0.66 * flangeW) / longEdge;
        const across = size.w * scale;
        const along = size.h * scale;
        const thumb = makeThumbPlane(holes, along, across);
        thumb.position.copy(facePoint(cursor + dir * along / 2, 0));
        thumb.quaternion.copy(quat);
        g.add(thumb);
    }

    return { object: g, footprints };
}

/**
 * 边缘配准偏差可视化（页4）：装配面长边的模型边（蓝）、按偏差偏移的拟合"实测"边
 * （结果色虚线）、最大偏差处的标记。返回 group 及标记世界坐标。
 */
export function buildDeviation(sec: BeamSection, face: AssemblyFace, value: number, result: 'pass' | 'near' | 'out'): { object: THREE.Group; markerPos: [number, number, number]; color: number } {
    const { h, b, length } = sec;
    const col = result === 'out' ? COL.devOut : result === 'near' ? COL.devNear : COL.devPass;
    let a: [number, number, number];
    let bEnd: [number, number, number];
    let off: [number, number, number];

    if (face === 'top_flange' || face === 'bottom_flange') {
        const z = face === 'top_flange' ? h : 0;
        a = [0, -b / 2, z];
        bEnd = [length, -b / 2, z];
        off = [0, -Math.max(20, value * 12), 0];
    } else {
        const y = face === 'left_web' ? -b / 2 : b / 2;
        a = [0, y, 0];
        bEnd = [length, y, 0];
        off = [0, 0, -Math.max(20, value * 12)];
    }

    const g = new THREE.Group();
    const model = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...bEnd)]),
        new THREE.LineBasicMaterial({ color: COL.devModel })
    );
    const fitted = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(a[0] + off[0], a[1] + off[1], a[2] + off[2]),
            new THREE.Vector3(bEnd[0] + off[0], bEnd[1] + off[1], bEnd[2] + off[2])
        ]),
        new THREE.LineDashedMaterial({ color: col, dashSize: 120, gapSize: 80 })
    );
    fitted.computeLineDistances();
    [model, fitted].forEach((l) => { l.raycast = () => { /* 偏差线不拾取 */ }; g.add(l); });

    const markerPos: [number, number, number] = [length * 0.5, (a[1] + bEnd[1]) / 2 + off[1], (a[2] + bEnd[2]) / 2 + off[2]];
    const marker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(b, h) * 0.07, 14, 14), new THREE.MeshBasicMaterial({ color: col }));
    marker.position.set(...markerPos);

    marker.raycast = () => { /* 标记不拾取 */ };
    g.add(marker);

    return { object: g, markerPos, color: col };
}

/** 移植 viewer.js 中的视图预设方向工具（供 canvas 调用）。 */
export const VIEW_PRESETS = { PRESETS, assemblyPreset, memberCenter, faceNormal };
