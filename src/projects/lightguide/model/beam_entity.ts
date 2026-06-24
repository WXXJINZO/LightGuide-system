import * as THREE from 'three';
import { SesNodeEntity } from '@/common';
import { buildBeam } from '../geometry/beam_builders';
import { BeamSection } from './types';

/**
 * H 型钢梁实体。
 *
 * 继承底座 `SesNodeEntity (extends Model.ObjectNode)`，几何为一个 THREE.Group
 * （三长方体 + 边线 + 头端标记）。Group 几何会被 `SesNodeDisplay` 原样返回渲染。
 * 通过 Entity→Display 注册链接入 `BeamCanvas`，并由 `addModel` 加入 document/view。
 */
export class BeamEntity extends SesNodeEntity {
    public readonly sec: BeamSection;
    /** 参与拾取的钢梁实体 mesh（腹板 + 两翼缘）。 */
    public readonly pickMeshes: THREE.Mesh[];

    constructor(sec: BeamSection) {
        const { object, meshes } = buildBeam(sec);
        super(object, 'lg-beam');
        this.sec = sec;
        this.pickMeshes = meshes;
    }
}
