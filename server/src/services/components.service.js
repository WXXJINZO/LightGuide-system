// Component-file queries — the full payload the CAD View + BOM + projection need.
import { getDb } from '../db/index.js';
import { notFound } from '../lib/errors.js';

/** Count secondary parts per face for slot-card summaries ("顶翼缘 · N 件"). */
export function faceCounts(componentId) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT face, COUNT(*) AS n FROM secondary_parts WHERE component_id = ? GROUP BY face'
  ).all(componentId);
  const out = { top_flange: 0, bottom_flange: 0, left_web: 0, right_web: 0 };
  for (const r of rows) out[r.face] = r.n;
  return out;
}

/** Full component: H-beam geometry, BOM, secondary parts, target points. */
export function getComponent(id) {
  const db = getDb();
  const c = db.prepare('SELECT * FROM component_files WHERE id = ?').get(id);
  if (!c) throw notFound('Component not found');

  const parts = db.prepare(
    'SELECT * FROM parts WHERE component_id = ? ORDER BY is_primary DESC, sort_order, id'
  ).all(id);
  const secondary = db.prepare(
    'SELECT * FROM secondary_parts WHERE component_id = ? ORDER BY face, position_mm, id'
  ).all(id).map((s) => ({
    ...s,
    size: safeJson(s.size_json, {}),
    holes: safeJson(s.hole_json, []),
  }));
  const targets = db.prepare(
    'SELECT * FROM target_points WHERE component_id = ? ORDER BY idx'
  ).all(id);

  return {
    id: c.id,
    project_id: c.project_id,
    mark: c.mark,
    spec: c.spec,
    length_mm: c.length_mm,
    ifc_name: c.ifc_name,
    total_weight: c.total_weight,
    nominal_deviation: c.nominal_deviation,
    hbeam: safeJson(c.hbeam_json, {}),
    parts,
    secondary,
    targets,
    faceCounts: faceCounts(id),
  };
}

function safeJson(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}
