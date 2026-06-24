import { describe, expect, it } from 'vitest';
import {
    assemblyPreset,
    faceNormal,
    hBeamBoxes,
    memberCenter,
    orbitDirection,
    originPoint,
    secondaryPlacement,
    targetLayout
} from './beam_geometry';
import { BeamSection } from '../model/types';

const SEC: BeamSection = { h: 700, b: 300, tw: 13, tf: 24, length: 9000 };

describe('beam_geometry', () => {
    it('H 型钢梁由腹板 + 上下翼缘三个长方体组成', () => {
        const boxes = hBeamBoxes(SEC);
        expect(boxes).toHaveLength(3);
        const web = boxes.find((b) => b.part === 'web')!;
        expect(web.size).toEqual([9000, 13, 700]);
        expect(web.center).toEqual([4500, 0, 350]);
        const top = boxes.find((b) => b.part === 'top_flange')!;
        expect(top.center[2]).toBeCloseTo(700 - 24 / 2);
    });

    it('坐标系原点在左端左下角，质心在几何中心', () => {
        expect(originPoint(SEC)).toEqual([0, -150, 0]);
        expect(memberCenter(SEC)).toEqual([4500, 0, 350]);
    });

    it('靶标布局为 12 个：长边各 4 + 头尾各 2', () => {
        const targets = targetLayout(SEC, 'top_flange', 'normal');
        expect(targets).toHaveLength(12);
        expect(targets.filter((t) => t.edge === 'long_a')).toHaveLength(4);
        expect(targets.filter((t) => t.edge === 'long_b')).toHaveLength(4);
        expect(targets.filter((t) => t.edge === 'head')).toHaveLength(2);
        expect(targets.filter((t) => t.edge === 'tail')).toHaveLength(2);
        // 上翼缘靶标都贴在 z = h 上
        targets.filter((t) => t.edge.startsWith('long')).forEach((t) => expect(t.pos[2]).toBe(700));
    });

    it('头尾翻转交换头/尾标记沿梁长的位置', () => {
        const normal = targetLayout(SEC, 'top_flange', 'normal');
        const reversed = targetLayout(SEC, 'top_flange', 'reversed');
        expect(normal.find((t) => t.edge === 'head')!.pos[0]).toBe(0);
        expect(reversed.find((t) => t.edge === 'head')!.pos[0]).toBe(9000);
    });

    it('靶标随装配面重新夹取（腹板面靶标贴在翼缘端）', () => {
        const left = targetLayout(SEC, 'left_web', 'normal');
        left.filter((t) => t.edge.startsWith('long')).forEach((t) => expect(t.pos[1]).toBe(-150));
        expect(faceNormal('left_web')).toEqual([0, -1, 0]);
    });

    it('次零件放置在所在面、对应法线与基底', () => {
        const p = secondaryPlacement(SEC, { face: 'top_flange', position_mm: 1200 });
        expect(p.center).toEqual([1200, 0, 700]);
        expect(p.normal).toEqual([0, 0, 1]);
        const wp = secondaryPlacement(SEC, { face: 'left_web', position_mm: 1200 });
        expect(wp.normal).toEqual([0, -1, 0]);
        expect(wp.center).toEqual([1200, -SEC.tw / 2, 350]);
    });

    it('装配面正视预设朝向所选面，orbit 方向为单位向量', () => {
        const top = assemblyPreset('top_flange');
        const dir = orbitDirection(top);
        const len = Math.hypot(dir[0], dir[1], dir[2]);
        expect(len).toBeCloseTo(1, 5);
        expect(dir[2]).toBeCloseTo(1, 3); // 俯视，方向近 +Z
    });
});
