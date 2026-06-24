import * as THREE from 'three';
import { SesNodeEntity } from '@/common';
import { COL } from '../geometry/colors';
import { buildSecondary } from '../geometry/beam_builders';
import { BeamSection, SecondaryPart } from './types';

/**
 * 次零件实体（钢板/连接件），参与拾取与 BOM ↔ CAD 联动。
 *
 * 几何为包裹单块板 mesh 的 Group；选中高亮通过直接改写板材质颜色 + canvas.dirty 实现，
 * 不与底座选中材质缓存冲突。
 */
export class SecondaryEntity extends SesNodeEntity {
    public readonly secondary: SecondaryPart;
    public readonly pickMesh: THREE.Mesh;
    private readonly _plateMaterial: THREE.MeshStandardMaterial;

    constructor(sec: BeamSection, part: SecondaryPart) {
        const { mesh, material } = buildSecondary(sec, part);
        const group = new THREE.Group();
        group.add(mesh);
        super(group, `lg-secondary-${part.id}`);
        this.secondary = part;
        this.pickMesh = mesh;
        this._plateMaterial = material;
    }

    /** 选中高亮（蓝）/ 取消（钢板色）。 */
    public setHighlighted(on: boolean): void {
        this._plateMaterial.color.set(on ? COL.sel : COL.secondary);
    }

    /** 投影视图隐藏实体、完成视图显示实体。 */
    public setSolidVisible(visible: boolean): void {
        this.pickMesh.visible = visible;
    }
}
