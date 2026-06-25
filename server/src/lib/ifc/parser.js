// ============================================================
// IFC4 -> Assembly Bill of Materials parser.
//
// Reads one Tekla IFC4 assembly export and produces an Assembly BOM grouped by
// the *explicit* Part position (Reference) — never by kind|spec, and never with
// synthesized M1/P1 identifiers (different Parts that happen to share a plate
// thickness, e.g. P177 and P181, stay separate rows).
//
// Output (new field names preferred; legacy aliases kept for compatibility):
//   {
//     assemblyPosition, assemblyQuantity, totalWeight, material, occurrences,
//     warnings:[{code,message,...}],
//     // legacy/compat:
//     mark, module, qty, primaryKind, kindLabel, lengthMM, dim, sourceFilename,
//     parts:[{
//       partPosition, partQuantity, unitWeight, profile, material,
//       length, width, height, guids:[...], isPrimary, kind, kindLabel,
//       partType, color, verts,
//       // legacy/compat: pid (=partPosition), qty (=partQuantity), spec (=profile), guid
//     }]
//   }
//
// IFC data contract:
//  - Assembly position/quantity: IfcPropertySet "Tekla Assembly Identity"
//    (ASSEMBLY_POS preferred, then "Assembly Position"; "Export Quantity").
//  - Part position: "Reference" in Pset_PlateCommon / Pset_ColumnCommon
//    (any Pset_*Common), resolved per element via IfcRelDefinesByProperties.
//  - Length/Width/Height/Weight: IfcPropertySet "Tekla Quantity" (Weight is the
//    Unit weight; never estimated from a bounding box).
//  - Profile/section: the IFC element Description.
//  - Material grade: IfcRelAssociatesMaterial -> IfcMaterial (Tag is only a
//    legacy fallback).
//  - Filename (name_x{qty}) is used for assembly identity ONLY when the
//    "Tekla Assembly Identity" property set is absent.
// ============================================================
import { parseStep } from './step.js';
import { makeKernel, bbox, recenter } from './geometry.js';

const ELEMENT_TYPES = new Set(['IFCBEAM', 'IFCCOLUMN', 'IFCMEMBER', 'IFCPLATE', 'IFCBUILDINGELEMENTPROXY']);
const KIND = { IFCBEAM: 'beam', IFCCOLUMN: 'column', IFCMEMBER: 'member', IFCPLATE: 'plate', IFCBUILDINGELEMENTPROXY: 'other' };
const COLOR = { column: [0.6, 0.63, 0.68], plate: [0.72, 0.74, 0.77], beam: [0.56, 0.6, 0.66], member: [0.56, 0.6, 0.66], other: [0.62, 0.64, 0.68] };
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/** Unwrap an IfcPropertySingleValue nominal value (typed inline / list) to a scalar. */
function scalar(v) {
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (v.str !== undefined) return v.str;
  if (v.enum !== undefined) return v.enum;
  if (v.value !== undefined) return scalar(Array.isArray(v.value) ? v.value[0] : v.value);
  if (Array.isArray(v)) return scalar(v[0]);
  return null;
}

/** A steel grade (Q355C / S355 / Q235JR …) — a legacy Tag material fallback. */
function looksLikeGrade(s) { return /^(Q|S|SS|SM|A|GR|ST)\s?\d{2,4}[A-Z0-9]*$/i.test(s || ''); }

/** Derive mark + module + quantity from a CypWizard filename (e.g. T4-B-GKZ11_x1.ifc). */
export function parseFilename(filename = '') {
  let base = String(filename).replace(/\.[^.]+$/, '');
  let qty = null;
  const qm = base.match(/[ _\-]?[x×](\d+)\s*$/i);   // name_x12 / name×12 / name-x12
  if (qm) { qty = Number(qm[1]); base = base.slice(0, qm.index); }
  base = base.replace(/_ID\d+\s*$/i, '');           // Tekla object-id suffix
  base = base.replace(/[ _\-]+$/, '');
  let mark = base, module = '';
  const dash = base.lastIndexOf('-');
  if (dash > 0) { module = base.slice(0, dash); mark = base.slice(dash + 1); }
  return { mark: mark || base || 'Component', module, position: base || mark, qty };
}

function kindLabelOf(mark, primaryKind) {
  if (/^GKZ/i.test(mark)) return 'Box column';
  if (/^XG/i.test(mark)) return 'Brace girder';
  if (/CL/i.test(mark)) return 'Secondary beam';
  return cap(primaryKind) || 'Component';
}

function partTypeOf(kind, name, isPrimary) {
  if (isPrimary) return 'main_member';
  if (kind === 'plate') {
    if (/端板|end\s*plate|endplate/i.test(name || '')) return 'end_plate';
    return 'stiffener';
  }
  return 'other';
}

/**
 * Parse IFC text into a component / Assembly BOM object.
 * @param {string} text  IFC file contents
 * @param {object} opts  { filename, mark, module, qty } optional hints/overrides
 */
export function parseComponent(text, opts = {}) {
  const { entities, scale } = parseStep(text);
  const E = (ref) => (ref && ref.ref != null ? entities.get(ref.ref) : null);
  const kernel = makeKernel(entities, scale);
  const all = [...entities.values()];
  const warnings = [];
  const warn = (code, message, extra) => warnings.push({ code, message, ...(extra || {}) });

  const psetName = (ps) => ps && ps.params[2] && ps.params[2].str;
  function psetProps(ps) {
    const m = {};
    for (const ref of (ps.params[4] || [])) {
      const p = E(ref);
      if (p && p.type === 'IFCPROPERTYSINGLEVALUE') {
        const n = p.params[0] && p.params[0].str;
        if (n != null) m[n] = scalar(p.params[2]);
      }
    }
    return m;
  }

  // ---- 1) Assembly identity (IfcPropertySet "Tekla Assembly Identity") ----
  let assemblyPosition = null, assemblyQuantity = null;
  const posSet = new Set(), qtySet = new Set();
  for (const ps of all) {
    if (ps.type !== 'IFCPROPERTYSET' || psetName(ps) !== 'Tekla Assembly Identity') continue;
    const p = psetProps(ps);
    if (p.ASSEMBLY_POS != null && p['Assembly Position'] != null && String(p.ASSEMBLY_POS) !== String(p['Assembly Position'])) {
      warn('conflicting_assembly_position', `ASSEMBLY_POS "${p.ASSEMBLY_POS}" != Assembly Position "${p['Assembly Position']}"`);
    }
    const pos = p.ASSEMBLY_POS != null ? p.ASSEMBLY_POS : p['Assembly Position'];
    if (pos != null) { assemblyPosition = String(pos); posSet.add(String(pos)); }
    if (p['Export Quantity'] != null) { assemblyQuantity = Number(p['Export Quantity']); qtySet.add(Number(p['Export Quantity'])); }
  }
  if (posSet.size > 1) warn('conflicting_assembly_position', `multiple assembly positions: ${[...posSet].join(', ')}`);
  if (qtySet.size > 1) warn('conflicting_quantity', `multiple export quantities: ${[...qtySet].join(', ')}`);

  // Filename fallback ONLY when Tekla Assembly Identity is absent.
  const fileMeta = parseFilename(opts.filename || '');
  const identityPresent = assemblyPosition != null;
  if (assemblyPosition == null) assemblyPosition = opts.assemblyPosition || fileMeta.position || fileMeta.mark;
  if (assemblyQuantity == null) assemblyQuantity = (opts.qty != null ? Number(opts.qty) : (fileMeta.qty != null ? fileMeta.qty : 1));

  // ---- 2) per-element properties via IfcRelDefinesByProperties ----
  const props = new Map();                 // elemId -> { partPosition, length, width, height, unitWeight }
  const propFor = (id) => { let o = props.get(id); if (!o) { o = {}; props.set(id, o); } return o; };
  for (const rel of all) {
    if (rel.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const ps = E(rel.params[5]);
    if (!ps || ps.type !== 'IFCPROPERTYSET') continue;
    const name = psetName(ps), pv = psetProps(ps);
    for (const r of (rel.params[4] || [])) {
      if (!r || r.ref == null) continue;
      const o = propFor(r.ref);
      if (/^Pset_.*Common$/.test(name || '') && pv.Reference != null) o.partPosition = String(pv.Reference);
      if (name === 'Tekla Quantity') {
        if (pv.Length != null) o.length = Number(pv.Length);
        if (pv.Width != null) o.width = Number(pv.Width);
        if (pv.Height != null) o.height = Number(pv.Height);
        if (pv.Weight != null) o.unitWeight = Number(pv.Weight);
      }
    }
  }

  // ---- 3) material via IfcRelAssociatesMaterial -> IfcMaterial ----
  const materialOf = new Map();
  for (const rel of all) {
    if (rel.type !== 'IFCRELASSOCIATESMATERIAL') continue;
    const mat = E(rel.params[5]);
    let grade = null;
    if (mat && mat.type === 'IFCMATERIAL') grade = mat.params[0] && mat.params[0].str;
    else if (mat && mat.type === 'IFCMATERIALLIST') { const f = E((mat.params[0] || [])[0]); grade = f && f.params[0] && f.params[0].str; }
    if (!grade) continue;
    for (const r of (rel.params[4] || [])) if (r && r.ref != null) materialOf.set(r.ref, grade);
  }

  // ---- 4) collect element occurrences (geometry + metadata) ----
  const raw = [];
  for (const e of all) {
    if (!ELEMENT_TYPES.has(e.type)) continue;
    const verts = kernel.elementTriangles(e);
    if (!verts.length) continue;
    const o = props.get(e.id) || {};
    const guid = (e.params[0] && e.params[0].str) || '';
    const tag = (e.params[7] && e.params[7].str) || '';
    const span = bbox(verts).span;
    raw.push({
      id: e.id, kind: KIND[e.type] || 'other', guid,
      name: (e.params[2] && e.params[2].str) || '',
      profile: (e.params[3] && e.params[3].str) || '',     // Description = profile/section
      material: materialOf.get(e.id) || (looksLikeGrade(tag) ? tag : ''),   // Tag = legacy fallback
      partPosition: o.partPosition != null ? o.partPosition : null,
      length: o.length != null ? o.length : Math.round(Math.max(span[0], span[1], span[2])),
      width: o.width != null ? o.width : null,
      height: o.height != null ? o.height : null,
      unitWeight: o.unitWeight != null ? o.unitWeight : null,
      verts,
    });
  }
  if (!raw.length) throw new Error('No building elements with geometry found in IFC');
  const occurrences = raw.length;

  // material grade (report conflicts)
  const grades = new Set(raw.map((r) => r.material).filter(Boolean));
  if (grades.size > 1) warn('conflicting_material', `multiple material grades: ${[...grades].join(', ')}`);
  const material = grades.size ? [...grades][0] : '';

  // data-quality: missing Part position (never fabricate identifiers)
  const missing = raw.filter((r) => r.partPosition == null);
  if (missing.length) {
    warn('missing_part_position',
      `${missing.length} of ${occurrences} element occurrence(s) have no Part position (Reference); identifiers are not fabricated`,
      { count: missing.length, guids: missing.map((m) => m.guid) });
  }

  // ---- 5) group by the explicit Part position (never merge distinct positions) ----
  const groups = new Map();
  for (const el of raw) {
    const key = el.partPosition != null ? 'pos ' + el.partPosition : 'guid ' + el.guid;
    let g = groups.get(key);
    if (!g) {
      g = { partPosition: el.partPosition, kind: el.kind, name: el.name, profile: el.profile,
            material: el.material, unitWeight: el.unitWeight, length: el.length, width: el.width, height: el.height,
            guids: [], verts: [], maxLen: 0, weights: new Set() };
      groups.set(key, g);
    }
    g.guids.push(el.guid);
    g.maxLen = Math.max(g.maxLen, el.length || 0);
    if (el.unitWeight != null) g.weights.add(Math.round(el.unitWeight * 100));
    if (g.unitWeight == null && el.unitWeight != null) g.unitWeight = el.unitWeight;
    if (!g.material && el.material) g.material = el.material;
    for (let i = 0; i < el.verts.length; i++) g.verts.push(el.verts[i]);
  }
  let parts = [...groups.values()];
  for (const g of parts) if (g.weights.size > 1) warn('conflicting_quantity', `Part ${g.partPosition || '(unknown)'} has inconsistent unit weights`);

  // primary = the group whose representative element is the longest member
  let primary = parts[0];
  for (const p of parts) if (p.maxLen > primary.maxLen) primary = p;
  primary.isPrimary = true;
  parts.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || b.maxLen - a.maxLen);

  // recenter the whole assembly to its bbox centre (viewer also re-fits)
  const allV = [];
  for (const p of parts) for (let i = 0; i < p.verts.length; i++) allV.push(p.verts[i]);
  const bb = bbox(allV);
  const center = [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2];
  const dim = [Math.round(bb.span[0]), Math.round(bb.span[1]), Math.round(bb.span[2])];
  const assemblyLength = Math.round(Math.max(bb.span[0], bb.span[1], bb.span[2]));

  // ---- 6) build BOM rows + fixed-point total weight ----
  let weightCents = 0;
  const outParts = parts.map((p) => {
    recenter(p.verts, center);
    const partQuantity = p.guids.length;
    const unitWeight = p.unitWeight != null ? p.unitWeight : 0;
    weightCents += Math.round(unitWeight * 100) * partQuantity;
    const length = Math.round(p.length != null ? p.length : (p.isPrimary ? assemblyLength : p.maxLen));
    const partPosition = p.partPosition;                       // may be null (no fabrication)
    const pid = partPosition != null ? partPosition : p.guids[0];   // stable real id, never M1/P1
    return {
      partPosition, partQuantity, unitWeight,
      profile: p.profile, length, width: p.width, height: p.height,
      material: p.material || material || '',
      guids: p.guids.slice(),
      isPrimary: !!p.isPrimary, kind: p.kind, kindLabel: cap(p.kind),
      partType: partTypeOf(p.kind, p.name, !!p.isPrimary),
      color: COLOR[p.kind] || COLOR.other,
      name: p.name,
      verts: p.verts,
      // legacy/compat aliases
      pid, qty: partQuantity, spec: p.profile, guid: p.guids[0],
    };
  });
  const totalWeight = weightCents / 100;

  const mark = opts.mark || fileMeta.mark || assemblyPosition;
  return {
    // new field names
    assemblyPosition, assemblyQuantity, totalWeight, material, occurrences, warnings,
    identityFromProperties: identityPresent,
    // legacy/compat
    mark,
    module: opts.module != null ? opts.module : fileMeta.module,
    qty: assemblyQuantity,
    primaryKind: cap(primary.kind),
    kindLabel: kindLabelOf(mark, primary.kind),
    lengthMM: assemblyLength,
    dim,
    parts: outParts,
  };
}
