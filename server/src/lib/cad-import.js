// Projection-data generation from imported CAD models (V3 §15 / [REQ-DATA-*]).
// Turns an IFC / STEP / STP component model into the LightGuide data model
// (main H-beam geometry + secondary parts + BOM + targets) so the existing
// five-step flow and §11 projection rendering work unchanged.
//
//   IFC   — full parse (CypHub IFC4 kernel): real per-part geometry, the main
//           member identified by entity type/length, secondary parts placed by
//           their geometry relative to the main member.
//   STEP  — simplified: ISO-10303 lexer + B-rep vertex bounding boxes only
//           (full B-rep tessellation needs a native kernel — see BLANKS.md).
import { parseComponent, parseFilename } from './ifc/parser.js';
import { parseStep } from './ifc/step.js';

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// ── shared geometry helpers ───────────────────────────────────────────────
function frameOf(verts) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < verts.length; i += 3) for (let k = 0; k < 3; k++) { const x = verts[i + k]; if (x < mn[k]) mn[k] = x; if (x > mx[k]) mx[k] = x; }
  const span = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  const axis = span[0] >= span[1] && span[0] >= span[2] ? 0 : (span[1] >= span[2] ? 1 : 2);
  const cross = [0, 1, 2].filter((i) => i !== axis);
  const heightAx = span[cross[0]] >= span[cross[1]] ? cross[0] : cross[1];
  const widthAx = cross[0] === heightAx ? cross[1] : cross[0];
  const csCenter = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  return { axis, a0: mn[axis], a1: mx[axis], heightAx, widthAx, csCenter, span, mn, mx };
}
function centroid(verts) {
  let x = 0, y = 0, z = 0; const n = verts.length / 3 || 1;
  for (let i = 0; i < verts.length; i += 3) { x += verts[i]; y += verts[i + 1]; z += verts[i + 2]; }
  return [x / n, y / n, z / n];
}
// Which assembly face a secondary part sits on, from its centroid offset.
function faceOf(frame, c) {
  const nh = (c[frame.heightAx] - frame.csCenter[frame.heightAx]) / (frame.span[frame.heightAx] / 2 || 1);
  const nw = (c[frame.widthAx] - frame.csCenter[frame.widthAx]) / (frame.span[frame.widthAx] / 2 || 1);
  if (Math.abs(nh) >= Math.abs(nw)) return nh >= 0 ? 'top_flange' : 'bottom_flange';
  return nw >= 0 ? 'right_web' : 'left_web';
}
// "HN900*300*16*28" / "HW400×400×10×10" → { h, b, tw, tf }; 2-number specs estimate tw/tf.
export function parseHSection(spec = '') {
  let m = spec.match(/(\d+)\D+(\d+)\D+(\d+)\D+(\d+)/);
  if (m) return { h: +m[1], b: +m[2], tw: +m[3], tf: +m[4] };
  m = spec.match(/(\d+)\D+(\d+)/);
  if (m) { const h = +m[1], b = +m[2]; return { h, b, tw: Math.max(6, Math.round(h * 0.02)), tf: Math.max(8, Math.round(h * 0.035)) }; }
  return null;
}
function mapType(partType) {
  if (partType === 'end_plate') return 'connection_plate';
  if (partType === 'stiffener') return 'stiffener';
  if (partType === 'main_member') return 'stiffener';
  return 'other';
}
function kindOf(sec) { return sec && sec.h === sec.b ? 'column' : 'beam'; }
// 12 coded targets (V3 §11.1) for an imported beam.
function genTargets(length) {
  const t = [];
  for (let i = 0; i < 4; i++) { const s = Math.round((length * (i + 0.5)) / 4); t.push({ idx: i, edge: 'long_a', station_mm: s }); t.push({ idx: 4 + i, edge: 'long_b', station_mm: s }); }
  t.push({ idx: 8, edge: 'head', station_mm: 0 }); t.push({ idx: 9, edge: 'head', station_mm: 0 });
  t.push({ idx: 10, edge: 'tail', station_mm: length }); t.push({ idx: 11, edge: 'tail', station_mm: length });
  return t;
}

// ── IFC import (full) ─────────────────────────────────────────────────────
export function importIfc(text, filename) {
  const r = parseComponent(text, { filename });
  if (!r.parts || !r.parts.length) throw new Error('No parts found in IFC model');
  const primary = r.parts.find((p) => p.isPrimary) || r.parts[0];
  const frame = frameOf(primary.verts);
  const length = Math.round(frame.a1 - frame.a0) || Math.round(r.lengthMM || 0);
  const sec = parseHSection(primary.profile) || { h: Math.round(frame.span[frame.heightAx]), b: Math.round(frame.span[frame.widthAx]), tw: 12, tf: 16 };
  const hbeam = { ...sec, length };

  const secondaries = r.parts.filter((p) => !p.isPrimary).map((p, i) => {
    const c = centroid(p.verts);
    const dims = [p.length || 0, p.width || 0, p.height || 0].map(Math.round).sort((a, b) => b - a);
    return {
      number: p.partPosition || `P${i + 1}`, type: mapType(p.partType), face: faceOf(frame, c),
      near: clamp(Math.round(c[frame.axis] - frame.a0), 0, length),
      w: dims[0] || 100, h: dims[1] || 60, t: dims[2] || 10, holeRows: 0, holeCols: 0,
    };
  });
  const bom = r.parts.map((p, i) => ({
    part_id: p.partPosition || `P${i}`, spec: p.profile || '', length_mm: Math.round(p.length || 0),
    material: p.material || '', unit_kg: round1(p.unitWeight || 0), qty: p.qty || 1,
    is_primary: p.isPrimary ? 1 : 0, sort_order: i,
  }));
  return {
    mark: r.assemblyPosition || r.mark || parseFilename(filename).mark || 'IFC',
    spec: primary.profile || '', length_mm: length, hbeam, kind: kindOf(sec),
    total_weight: round1(r.totalWeight || bom.reduce((s, b) => s + b.unit_kg * b.qty, 0)),
    nominal_deviation: 1.6, dev_alarm: 4.8, source_format: 'ifc', ifc_name: filename,
    bom, secondaries, targets: genTargets(length),
    stats: { partCount: r.parts.length, secondaryCount: secondaries.length, warnings: r.warnings || [] },
  };
}

// ── STEP import (simplified: B-rep vertex bounding boxes only) ─────────────
// Collects the CARTESIAN_POINTs reachable from each MANIFOLD_SOLID_BREP to get a
// per-solid bounding box. The largest solid is the main member; the rest are
// secondary parts placed by their bbox. Full B-rep faces are NOT tessellated
// (see BLANKS.md) — this yields placement + dimensions, enough to drive the
// projection layout while the real kernel is wired in later.
export function importStep(text, filename) {
  const { entities } = parseStep(text);
  // Collect only the B-rep VERTEX_POINTs of a solid (not surface/axis origin
  // points, which sit at global placements and would inflate the bounding box).
  const pointsOf = (rootId) => {
    const pts = [], seen = new Set(), stack = [rootId];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue; seen.add(id);
      const e = entities.get(id); if (!e) continue;
      if (e.type === 'VERTEX_POINT') {
        const ref = e.params.find((p) => p && typeof p === 'object' && 'ref' in p);
        const cp = ref && entities.get(ref.ref);
        if (cp && cp.type === 'CARTESIAN_POINT' && Array.isArray(cp.params[1]) && cp.params[1].length === 3) pts.push(cp.params[1]);
        continue;
      }
      if (e.type === 'CARTESIAN_POINT') continue; // skip non-vertex points
      walkRefs(e.params, (rid) => stack.push(rid));
    }
    return pts;
  };
  const solids = [];
  for (const [id, e] of entities) {
    if (e.type !== 'MANIFOLD_SOLID_BREP') continue;
    const pts = pointsOf(id);
    if (pts.length < 3) continue;
    const verts = pts.flat();
    solids.push({ id, frame: frameOf(verts), centroidPt: centroid(verts), nPts: pts.length });
  }
  if (!solids.length) throw new Error('No solid bodies found in STEP model');
  // largest by long span = main member
  solids.sort((a, b) => Math.max(...b.frame.span) - Math.max(...a.frame.span));
  const main = solids[0], frame = main.frame;
  const length = Math.round(frame.a1 - frame.a0);
  const h = Math.round(frame.span[frame.heightAx]), b = Math.round(frame.span[frame.widthAx]);
  const hbeam = { h, b, tw: Math.max(8, Math.round(h * 0.02)), tf: Math.max(10, Math.round(h * 0.035)), length };
  const secondaries = solids.slice(1).map((s, i) => {
    const c = s.centroidPt, dims = [s.frame.span[0], s.frame.span[1], s.frame.span[2]].map(Math.round).sort((a, bb) => bb - a);
    return {
      number: `P${i + 1}`, type: 'stiffener', face: faceOf(frame, c),
      near: clamp(Math.round(c[frame.axis] - frame.a0), 0, length),
      w: dims[0] || 100, h: dims[1] || 60, t: dims[2] || 10, holeRows: 0, holeCols: 0,
    };
  });
  const bom = [{ part_id: 'M1', spec: `H${h}×${b}`, length_mm: length, material: '', unit_kg: 0, qty: 1, is_primary: 1, sort_order: 0 }]
    .concat(secondaries.map((s, i) => ({ part_id: s.number, spec: `PL${s.t}`, length_mm: s.w, material: '', unit_kg: 0, qty: 1, is_primary: 0, sort_order: i + 1 })));
  return {
    mark: parseFilename(filename).mark || 'STEP', spec: `H${h}×${b}`, length_mm: length, hbeam, kind: kindOf(hbeam),
    total_weight: 0, nominal_deviation: 1.8, dev_alarm: 4.8, source_format: 'step', ifc_name: filename,
    bom, secondaries, targets: genTargets(length),
    stats: { partCount: solids.length, secondaryCount: secondaries.length, simplified: true,
      warnings: ['STEP geometry is bounding-box only (B-rep tessellation requires a native kernel — see BLANKS.md).'] },
  };
}

function walkRefs(params, cb) {
  for (const p of params) {
    if (p && typeof p === 'object' && 'ref' in p) cb(p.ref);
    else if (Array.isArray(p)) walkRefs(p, cb);
  }
}

export function detectFormat(text, filename = '') {
  const f = filename.toLowerCase();
  if (/file_schema\s*\(\s*\(\s*'ifc/i.test(text) || f.endsWith('.ifc')) return 'ifc';
  if (/iso-10303-21/i.test(text) || f.endsWith('.step') || f.endsWith('.stp')) return 'step';
  throw new Error('Unrecognized model format (expected IFC / STEP / STP)');
}

export function importModel(text, filename) {
  const fmt = detectFormat(text, filename);
  return fmt === 'ifc' ? importIfc(text, filename) : importStep(text, filename);
}
