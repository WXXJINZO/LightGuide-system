/* Adapter: mock backend ComponentFull (+ slot pose) → the typed LightGuideModel
   the CAD-View facade consumes. The reference workspace.js passed the raw backend
   DTO straight to its vendored viewer; the real-base facade (mountLightGuideViewer)
   expects `LightGuideModel`, so we map the fields and stringify the secondary id
   (the facade's selection/BOM linkage is keyed by string id). */
import type { LightGuideModel, SecondaryPart } from '@/projects/lightguide';
import type { ComponentFull, SlotDTO } from './api/types';

export function componentToModel(comp: ComponentFull, slot?: SlotDTO | null): LightGuideModel {
    const secondary: SecondaryPart[] = (comp.secondary || []).map((s) => ({
        id: String(s.id),
        number: s.number,
        face: s.face,
        position_mm: s.position_mm,
        size: s.size,
        holes: s.holes
    }));
    return {
        component: { hbeam: comp.hbeam, secondary },
        pose: {
            headTail: slot?.head_tail ?? 'normal',
            assemblyFace: slot?.assembly_face ?? 'top_flange'
        },
        deviation: null
    };
}

/** Resolve the business secondary id (string) for a backend secondary number,
    used by the BOM ↔ CAD linkage (highlight the first part with that number). */
export function secondaryIdForNumber(comp: ComponentFull, number: string): string | null {
    const sec = (comp.secondary || []).find((s) => s.number === number);
    return sec ? String(sec.id) : null;
}

/** Reverse lookup: which secondary number owns a given business id. */
export function numberForSecondaryId(comp: ComponentFull, id: string | null): string | null {
    if (id == null) return null;
    const sec = (comp.secondary || []).find((s) => String(s.id) === id);
    return sec ? sec.number : null;
}
