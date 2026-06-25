// Deterministic demo seed — the design's project A-001 (钢结构厂房项目) with
// eight component files GZ-101..GZ-108. Quantities are computed from real steel
// geometry so the BOM totals are self-consistent (GZ-101 = 747.0 kg, the V3 §11
// worked example: HW400×400×10×10 @ 8000 + 2×PL10-1(400×80×10) + 2×PL10-2(200×60×5)).
// These rows are source_format='synthetic'; real IFC/STEP imports (§15) are added
// by the import service with the same data model.
import { getDb, applySchema } from './index.js';

const DENSITY = 7850e-9; // kg per mm³ (steel)
const round1 = (n) => Math.round(n * 10) / 10;

function beamWeight({ h, b, tw, tf }, length) {
  return (2 * b * tf + (h - 2 * tf) * tw) * length * DENSITY;
}
function plateWeight(w, h, t) { return w * h * t * DENSITY; }

const FACES = ['top_flange', 'bottom_flange', 'left_web', 'right_web'];

// Per-component definitions. `sec` = H cross-section (mm); `length` mm;
// `deviation` = nominal max deviation (mm); secondary parts carry { w,h,t, near,
// holeRows, holeCols } (V3 §13).
const COMPONENTS = [
  {
    mark: 'GZ-101', sec: { h: 400, b: 400, tw: 10, tf: 10 }, length: 8000, deviation: 1.2,
    secondaries: [ // V3 §11 worked example, verbatim
      { number: 'PL10-1', type: 'stiffener', face: 'top_flange', near: 1000, w: 400, h: 80, t: 10, holeRows: 2, holeCols: 4 },
      { number: 'PL10-1', type: 'stiffener', face: 'top_flange', near: 2000, w: 400, h: 80, t: 10, holeRows: 2, holeCols: 4 },
      { number: 'PL10-2', type: 'stiffener', face: 'top_flange', near: 6000, w: 200, h: 60, t: 5, holeRows: 0, holeCols: 0 },
      { number: 'PL10-2', type: 'stiffener', face: 'top_flange', near: 6500, w: 200, h: 60, t: 5, holeRows: 0, holeCols: 0 },
    ],
  },
  { mark: 'GZ-102', sec: { h: 350, b: 350, tw: 12, tf: 12 }, length: 10000, deviation: 1.8 },
  { mark: 'GZ-103', sec: { h: 500, b: 200, tw: 10, tf: 16 }, length: 12600, deviation: 1.5 },
  { mark: 'GZ-104', sec: { h: 300, b: 300, tw: 10, tf: 15 }, length: 6000, deviation: 2.1 },
  { mark: 'GZ-105', sec: { h: 400, b: 200, tw: 8, tf: 13 }, length: 9000, deviation: 2.3 },
  { mark: 'GZ-106', sec: { h: 450, b: 450, tw: 12, tf: 12 }, length: 14000, deviation: 2.6 }, // near (2.4–3.0)
  { mark: 'GZ-107', sec: { h: 450, b: 200, tw: 9, tf: 14 }, length: 11000, deviation: 2.9 },  // near
  { mark: 'GZ-108', sec: { h: 400, b: 400, tw: 10, tf: 10 }, length: 8000, deviation: 4.8 },   // out-of-tolerance demo
];

// 柱/梁/支撑 from the section (square → column, slender → brace, else beam).
function kindOf(sec) {
  if (sec.h === sec.b) return 'column';
  if (sec.b <= 200 && sec.h >= 400) return 'beam';
  return 'beam';
}

function genSecondaries(comp) {
  if (comp.secondaries) return comp.secondaries;
  const out = [], L = comp.length;
  const types = ['stiffener', 'connection_plate', 'diaphragm'];
  FACES.forEach((face, fi) => {
    const count = 3 + ((fi + comp.length / 1000) % 3 | 0);
    for (let i = 0; i < count; i++) {
      const near = Math.round((L * (i + 1)) / (count + 1));
      const type = types[(fi + i) % types.length];
      const w = 200 + ((i * 40 + fi * 30) % 220);
      const h = 60 + ((i * 15) % 60);
      const t = [6, 8, 10, 12, 14][(i + fi) % 5];
      const holed = i % 2 === 1;
      out.push({
        number: `${type === 'stiffener' ? 'PL' : type === 'connection_plate' ? 'CP' : 'DG'}${t}-${fi + 1}${i + 1}`,
        type, face, near, w, h, t, holeRows: holed ? 2 : 0, holeCols: holed ? 3 : 0,
      });
    }
  });
  return out;
}

// 12 coded target points (V3 §11.1): 4 + 4 along the long sides, 2 + 2 head/tail.
function genTargets(length) {
  const t = [];
  for (let i = 0; i < 4; i++) {
    const station = Math.round((length * (i + 0.5)) / 4);
    t.push({ idx: i, edge: 'long_a', station_mm: station });
    t.push({ idx: 4 + i, edge: 'long_b', station_mm: station });
  }
  t.push({ idx: 8, edge: 'head', station_mm: 0 });
  t.push({ idx: 9, edge: 'head', station_mm: 0 });
  t.push({ idx: 10, edge: 'tail', station_mm: length });
  t.push({ idx: 11, edge: 'tail', station_mm: length });
  return t;
}

function buildBom(comp, secondaries) {
  const bom = [{
    part_id: comp.mark, spec: `HW${comp.sec.h}×${comp.sec.b}×${comp.sec.tw}×${comp.sec.tf}`,
    length_mm: comp.length, material: 'Q355C', unit_kg: round1(beamWeight(comp.sec, comp.length)),
    qty: 1, is_primary: 1, sort_order: 0,
  }];
  const groups = new Map();
  for (const s of secondaries) {
    const key = `${s.number}|${s.w}x${s.h}x${s.t}`;
    if (!groups.has(key)) {
      groups.set(key, {
        part_id: s.number, spec: `PL${s.t}`, length_mm: Math.max(s.w, s.h),
        material: s.t >= 10 ? 'Q355C' : 'Q235C', unit_kg: round1(plateWeight(s.w, s.h, s.t)),
        qty: 0, is_primary: 0,
      });
    }
    groups.get(key).qty += 1;
  }
  let order = 1;
  for (const g of groups.values()) bom.push({ ...g, sort_order: order++ });
  return bom;
}

export function ensureSeed(db = getDb()) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM projects').get();
  if (existing.n > 0) return false;
  seedAll(db);
  return true;
}

function seedAll(db) {
  const insProject = db.prepare(`INSERT INTO projects
    (name, code, total_components, prepared_components, prepared_by, prepared_at, status)
    VALUES (@name, @code, @total_components, @prepared_components, @prepared_by, @prepared_at, @status)`);
  const insComp = db.prepare(`INSERT INTO component_files
    (project_id, mark, spec, length_mm, ifc_name, kind, total_weight, hbeam_json, nominal_deviation, dev_alarm, source_format, sort_order)
    VALUES (@project_id, @mark, @spec, @length_mm, @ifc_name, @kind, @total_weight, @hbeam_json, @nominal_deviation, @dev_alarm, @source_format, @sort_order)`);
  const insPart = db.prepare(`INSERT INTO parts
    (component_id, part_id, spec, length_mm, material, unit_kg, qty, is_primary, sort_order)
    VALUES (@component_id, @part_id, @spec, @length_mm, @material, @unit_kg, @qty, @is_primary, @sort_order)`);
  const insSec = db.prepare(`INSERT INTO secondary_parts
    (component_id, number, type, face, position_mm, size_json, hole_json, sort_order)
    VALUES (@component_id, @number, @type, @face, @position_mm, @size_json, @hole_json, @sort_order)`);
  const insTarget = db.prepare(`INSERT INTO target_points
    (component_id, idx, edge, station_mm) VALUES (@component_id, @idx, @edge, @station_mm)`);

  const seed = db.transaction(() => {
    const projectId = insProject.run({
      name: '钢结构厂房项目', code: 'A-001', total_components: COMPONENTS.length,
      prepared_components: COMPONENTS.length, prepared_by: '办公室-张工', prepared_at: '2026-06-20', status: 'available',
    }).lastInsertRowid;
    insProject.run({ name: '管廊钢结构项目', code: 'B-204', total_components: 12, prepared_components: 12, prepared_by: '办公室-李工', prepared_at: '2026-05-12', status: 'pending' });
    insProject.run({ name: '旧厂房改造项目', code: 'C-077', total_components: 4, prepared_components: 4, prepared_by: '办公室-王工', prepared_at: '2025-11-03', status: 'expired' });

    COMPONENTS.forEach((comp, ci) => {
      const secondaries = genSecondaries(comp);
      const bom = buildBom(comp, secondaries);
      const totalWeight = round1(bom.reduce((sum, r) => sum + r.unit_kg * r.qty, 0));
      const compId = insComp.run({
        project_id: projectId, mark: comp.mark,
        spec: `H${comp.sec.h}×${comp.sec.b}×${comp.sec.tw}×${comp.sec.tf}`,
        length_mm: comp.length, ifc_name: `${comp.mark}.ifc`, kind: kindOf(comp.sec),
        total_weight: totalWeight, hbeam_json: JSON.stringify({ ...comp.sec, length: comp.length }),
        nominal_deviation: comp.deviation, dev_alarm: comp.deviation > 3 ? comp.deviation : 4.8,
        source_format: 'synthetic', sort_order: ci,
      }).lastInsertRowid;

      bom.forEach((row) => insPart.run({ component_id: compId, ...row }));
      secondaries.forEach((s, si) => insSec.run({
        component_id: compId, number: s.number, type: s.type, face: s.face, position_mm: s.near,
        size_json: JSON.stringify({ w: s.w, h: s.h, t: s.t }),
        hole_json: JSON.stringify({ rows: s.holeRows || 0, cols: s.holeCols || 0 }),
        sort_order: si,
      }));
      genTargets(comp.length).forEach((tp) => insTarget.run({ component_id: compId, ...tp }));
    });
  });
  seed();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = getDb();
  applySchema(db);
  const did = ensureSeed(db);
  console.log(did ? '[seed] demo data inserted.' : '[seed] data already present — left untouched.');
}
