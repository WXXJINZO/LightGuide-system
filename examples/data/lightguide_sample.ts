import type { LightGuideModel } from '@/projects/lightguide';

/**
 * 演示用样例构件：一根 HN700×300 H 型钢梁（9 m）+ 若干次零件（连接板）。
 * 对应钢构装配激光投影系统中"绑定到工位的构件文件"。
 */
export const LIGHTGUIDE_SAMPLE: LightGuideModel = {
    component: {
        hbeam: { h: 700, b: 300, tw: 13, tf: 24, length: 9000 },
        secondary: [
            { id: 'P1', number: 'LB-01', face: 'top_flange', position_mm: 1200, size: { w: 220, h: 90, t: 12 }, holes: { rows: 2, cols: 3 } },
            { id: 'P2', number: 'LB-02', face: 'top_flange', position_mm: 3600, size: { w: 260, h: 120, t: 14 }, holes: { rows: 3, cols: 3 } },
            { id: 'P3', number: 'LB-03', face: 'top_flange', position_mm: 6000, size: { w: 200, h: 80, t: 10 }, holes: { rows: 2, cols: 2 } },
            { id: 'P4', number: 'WB-01', face: 'left_web', position_mm: 4500, size: { w: 180, h: 100, t: 10 }, holes: { rows: 2, cols: 2 } }
        ]
    },
    pose: { headTail: 'normal', assemblyFace: 'top_flange' },
    deviation: null
};
