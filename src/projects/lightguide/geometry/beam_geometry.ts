/**
 * CAD-View 纯几何工具（不依赖 THREE / DOM，可独立单测）。
 *
 * 移植自参考实现 public/js/cadview/geometry.js，并补充 TypeScript 类型。
 * 约定见 ../model/types.ts。
 */
import { AssemblyFace, BeamSection, HeadTail, SecondaryPart } from '../model/types';

export type Vec3 = [number, number, number];

export const FACES: AssemblyFace[] = ['top_flange', 'bottom_flange', 'left_web', 'right_web'];

/** 装配面外法线（构件坐标系）。 */
export function faceNormal(face: AssemblyFace): Vec3 {
    switch (face) {
        case 'top_flange': return [0, 0, 1];

        case 'bottom_flange': return [0, 0, -1];

        case 'left_web': return [0, -1, 0];

        case 'right_web': return [0, 1, 0];

        default: return [0, 0, 1];
    }
}

export interface HBeamBox {
    part: 'bottom_flange' | 'top_flange' | 'web';
    /** [lx, ly, lz] */
    size: Vec3;
    /** [x, y, z] */
    center: Vec3;
}

/**
 * H 型钢梁 = 三个相互穿插的长方体（腹板贯穿全高，两翼缘贯穿全宽）。
 * 无重合面 z-fighting，外观正确。
 */
export function hBeamBoxes(sec: BeamSection): HBeamBox[] {
    const { h, b, tw, tf, length } = sec;
    const cx = length / 2;

    return [
        { part: 'bottom_flange', size: [length, b, tf], center: [cx, 0, tf / 2] },
        { part: 'top_flange', size: [length, b, tf], center: [cx, 0, h - tf / 2] },
        { part: 'web', size: [length, tw, h], center: [cx, 0, h / 2] }
    ];
}

/** 坐标系 gizmo 原点（左端左下角）。 */
export function originPoint(sec: BeamSection): Vec3 {
    return [0, -sec.b / 2, 0];
}

/** 构件质心（orbit 目标 / fit 中心）。 */
export function memberCenter(sec: BeamSection): Vec3 {
    return [sec.length / 2, 0, sec.h / 2];
}

export interface TargetPoint {
    idx: number;
    edge: 'long_a' | 'long_b' | 'head' | 'tail';
    pos: Vec3;
    normal: Vec3;
}

/**
 * 12 个编码靶标点（V3 §11.1）：当前装配面两条长边各 4 个（共 8）+ 头尾各 2。
 * 它们位于构件坐标系下，随梁位姿一起变换。
 */
export function targetLayout(sec: BeamSection, face: AssemblyFace = 'top_flange', headTail: HeadTail = 'normal'): TargetPoint[] {
    const { h, b, length } = sec;
    const n = faceNormal(face);
    let edgeA: (x: number) => Vec3;
    let edgeB: (x: number) => Vec3;
    let endOffsetAxis: (x: number, s: number) => Vec3;

    if (face === 'top_flange' || face === 'bottom_flange') {
        const z = face === 'top_flange' ? h : 0;
        edgeA = (x) => [x, -b / 2, z];
        edgeB = (x) => [x, b / 2, z];
        endOffsetAxis = (x, s) => [x, s * b / 4, z];
    } else {
        // 腹板面 —— 长边沿该侧翼缘端
        const y = face === 'left_web' ? -b / 2 : b / 2;
        edgeA = (x) => [x, y, 0];
        edgeB = (x) => [x, y, h];
        endOffsetAxis = (x, s) => [x, y, h / 2 + s * h / 4];
    }

    const out: TargetPoint[] = [];

    for (let i = 0; i < 4; i++) {
        const x = (length * (i + 0.5)) / 4;
        out.push({ idx: i, edge: 'long_a', pos: edgeA(x), normal: n });
        out.push({ idx: 4 + i, edge: 'long_b', pos: edgeB(x), normal: n });
    }
    const xL = headTail === 'reversed' ? length : 0;
    const xR = headTail === 'reversed' ? 0 : length;
    out.push({ idx: 8, edge: 'head', pos: endOffsetAxis(xL, -1), normal: n });
    out.push({ idx: 9, edge: 'head', pos: endOffsetAxis(xL, 1), normal: n });
    out.push({ idx: 10, edge: 'tail', pos: endOffsetAxis(xR, -1), normal: n });
    out.push({ idx: 11, edge: 'tail', pos: endOffsetAxis(xR, 1), normal: n });

    return out;
}

export interface SecondaryPlacement {
    center: Vec3;
    normal: Vec3;
    uAxis: Vec3;
    vAxis: Vec3;
}

/** 次零件接触矩形中心在所在面上的放置（位置 + 基底）。 */
export function secondaryPlacement(sec: BeamSection, secondary: Pick<SecondaryPart, 'face' | 'position_mm'>): SecondaryPlacement {
    const { h } = sec;
    const x = secondary.position_mm;

    switch (secondary.face) {
        case 'top_flange': return { center: [x, 0, h], normal: [0, 0, 1], uAxis: [1, 0, 0], vAxis: [0, 1, 0] };

        case 'bottom_flange': return { center: [x, 0, 0], normal: [0, 0, -1], uAxis: [1, 0, 0], vAxis: [0, 1, 0] };

        case 'left_web': return { center: [x, -sec.tw / 2, h / 2], normal: [0, -1, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1] };

        case 'right_web': return { center: [x, sec.tw / 2, h / 2], normal: [0, 1, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1] };

        default: return { center: [x, 0, h], normal: [0, 0, 1], uAxis: [1, 0, 0], vAxis: [0, 1, 0] };
    }
}

export interface OrbitPreset {
    /** 方位角（绕 Z-up） */
    theta: number;
    /** 极角（与 Z-up 夹角） */
    phi: number;
}

/**
 * 默认等轴测：theta≈-135°, phi≈60°，相机位于 (-X,-Y,+Z) 卦限，使左端投影到左下、
 * 右端投影到右上（§6.5）。
 */
export const ISO_DEFAULT: OrbitPreset = { theta: -2.36, phi: 1.0 };

export const PRESETS: Record<'iso' | 'front' | 'side' | 'top', OrbitPreset> = {
    iso: ISO_DEFAULT,
    front: { theta: Math.PI / 2, phi: Math.PI / 2 },
    side: { theta: 0, phi: Math.PI / 2 },
    top: { theta: 0, phi: 0.0001 }
};

/** 装配面正视：相机沿 +法线方向看向该面。 */
export function assemblyPreset(face: AssemblyFace): OrbitPreset {
    switch (face) {
        case 'top_flange': return { theta: 0, phi: 0.0001 };

        case 'bottom_flange': return { theta: 0, phi: Math.PI - 0.0001 };

        case 'left_web': return { theta: -Math.PI / 2, phi: Math.PI / 2 };

        case 'right_web': return { theta: Math.PI / 2, phi: Math.PI / 2 };

        default: return PRESETS.iso;
    }
}

/** orbit 球面角 → 相机相对 target 的偏移方向（单位向量分量）。 */
export function orbitDirection(p: OrbitPreset): Vec3 {
    return [
        Math.sin(p.phi) * Math.cos(p.theta),
        Math.sin(p.phi) * Math.sin(p.theta),
        Math.cos(p.phi)
    ];
}
