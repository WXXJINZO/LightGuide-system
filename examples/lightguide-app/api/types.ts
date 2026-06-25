/* DTO shapes returned by the LightGuide backend (server/src/services/*.service.js),
   consumed by the workflow pages and the workspace. They mirror the REST payloads
   field for field. NOTE: `kind` is optional — the seed sets it but the real
   getComponent() does not return it, and no page reads it. */
import type { AssemblyFace, HeadTail } from '@/projects/lightguide';

export type { AssemblyFace, HeadTail };

export type ProjectStatus = 'available' | 'pending' | 'expired';
export type CheckResult = 'pass' | 'near' | 'out' | 'pending';
export type ProjectionState = 'idle' | 'projecting' | 'paused';
export type ProjectionStatus = 'idle' | 'projecting' | 'paused' | 'completed';
export type SecondaryType = 'stiffener' | 'connection_plate' | 'diaphragm' | 'other';

export interface Project {
    id: number;
    name: string;
    code: string;
    total_components: number;
    prepared_components: number;
    prepared_by: string;
    prepared_at: string;
    status: ProjectStatus;
}

export interface ComponentSummary {
    id: number;
    mark: string;
    spec: string;
    length_mm: number;
    ifc_name: string;
    total_weight: number;
    nominal_deviation: number;
    sort_order: number;
}

export interface ProjectDetail extends Project {
    components: ComponentSummary[];
}

export interface BomPart {
    part_id: string;
    spec: string;
    length_mm: number;
    material: string;
    unit_kg: number;
    qty: number;
    is_primary: 0 | 1;
    sort_order: number;
}

export interface SecondaryDTO {
    id: number;
    number: string;
    type: SecondaryType;
    face: AssemblyFace;
    position_mm: number;
    size: { w: number; h: number; t: number };
    holes: { rows: number; cols: number };
}

export interface TargetDTO {
    idx: number;
    edge: 'long_a' | 'long_b' | 'head' | 'tail';
    station_mm: number;
}

export type FaceCounts = Record<AssemblyFace, number>;

export interface ComponentFull {
    id: number;
    project_id: number;
    mark: string;
    spec: string;
    length_mm: number;
    ifc_name: string;
    total_weight: number;
    nominal_deviation: number;
    hbeam: { h: number; b: number; tw: number; tf: number; length: number };
    kind?: string;
    parts: BomPart[];
    secondary: SecondaryDTO[];
    targets: TargetDTO[];
    faceCounts: FaceCounts;
}

/** A slot as decorated by the session service (component summary + flags). */
export interface SlotDTO {
    slot_no: number;
    component_id: number | null;
    head_tail: HeadTail;
    assembly_face: AssemblyFace;
    pose_set: 0 | 1;
    checked: 0 | 1;
    max_deviation: number;
    check_result: CheckResult;
    projection_status: ProjectionStatus;
    component: {
        id: number;
        mark: string;
        spec: string;
        length_mm: number;
        total_weight: number;
        nominal_deviation: number;
        faceCounts: FaceCounts;
        faceCount: number;
    } | null;
    completedFaces: AssemblyFace[];
    duplicate: boolean;
}

export interface SessionDTO {
    id: number;
    project_id: number;
    project: { id: number; name: string; code: string } | null;
    current_step: number;
    projection_state: ProjectionState;
    slots: SlotDTO[];
    progress: { slot_no: number; face: AssemblyFace; status: string }[];
    bound_count: number;
    all_bound: boolean;
    all_pose_set: boolean;
    all_checked: boolean;
    has_out_of_tolerance: boolean;
}

/** Import endpoint result (V3 §15). The project is a partial summary; the
    component is the full payload (server/src/services/import.service.js). */
export interface ImportResult {
    project: { id: number; name: string; code: string; total_components: number };
    component: ComponentFull;
    stats?: { simplified?: boolean; warnings?: string[]; [k: string]: unknown };
}
