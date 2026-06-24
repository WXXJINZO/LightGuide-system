import * as THREE from 'three';
import { SesNodeEntity } from '@/common';

/** 装饰实体类别。 */
export type DecorationKind = 'axes' | 'targets' | 'faceHighlight' | 'projection' | 'deviation';

/**
 * 不参与拾取的装饰实体（坐标轴、靶标、面高亮、投影标注、偏差线）。
 *
 * 几何为 THREE.Object3D（通常是 Group），经 `SesNodeDisplay` 原样渲染。
 * `axes` 始终位于世界坐标系；其余装饰随位姿变换（由 BeamCanvas 统一施加局部矩阵）。
 */
export class LgDecorationEntity extends SesNodeEntity {
    public readonly kind: DecorationKind;

    constructor(kind: DecorationKind, object: THREE.Object3D) {
        super(object, `lg-${kind}`);
        this.kind = kind;
        this.canPick = false;
    }
}
