// Import service — turn an uploaded IFC/STEP/STP model into a component file in
// a dedicated "导入模型 / Imported Models" project (V3 §15 / [REQ-DATA-*]). All
// imports share the same data model the synthetic seed uses, so the bind → pose
// → check → projection flow and §11 rendering work unchanged.
import { getDb } from '../db/index.js';
import { badRequest } from '../lib/errors.js';
import { importModel } from '../lib/cad-import.js';
import { getComponent } from './components.service.js';

const IMPORT_CODE = 'IMPORT';

function ensureImportProject(db) {
  let proj = db.prepare('SELECT * FROM projects WHERE code = ?').get(IMPORT_CODE);
  if (!proj) {
    const id = db.prepare(
      `INSERT INTO projects (name, code, prepared_by, prepared_at, status)
       VALUES ('导入模型', ?, '现场导入', date('now'), 'available')`
    ).run(IMPORT_CODE).lastInsertRowid;
    proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  }
  return proj;
}

export function importModelFile(filename, content) {
  if (!filename || !content) throw badRequest('filename and content are required');
  let data;
  try {
    data = importModel(String(content), String(filename));
  } catch (e) {
    throw badRequest(`Could not parse model: ${e.message}`);
  }
  const db = getDb();

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

  const tx = db.transaction(() => {
    const proj = ensureImportProject(db);
    const order = db.prepare('SELECT COUNT(*) AS n FROM component_files WHERE project_id = ?').get(proj.id).n;
    const compId = insComp.run({
      project_id: proj.id, mark: data.mark, spec: data.spec, length_mm: data.length_mm,
      ifc_name: data.ifc_name, kind: data.kind, total_weight: data.total_weight,
      hbeam_json: JSON.stringify(data.hbeam), nominal_deviation: data.nominal_deviation,
      dev_alarm: data.dev_alarm, source_format: data.source_format, sort_order: order,
    }).lastInsertRowid;
    data.bom.forEach((b) => insPart.run({ component_id: compId, ...b }));
    data.secondaries.forEach((s, i) => insSec.run({
      component_id: compId, number: s.number, type: s.type, face: s.face, position_mm: s.near,
      size_json: JSON.stringify({ w: s.w, h: s.h, t: s.t }),
      hole_json: JSON.stringify({ rows: s.holeRows || 0, cols: s.holeCols || 0 }), sort_order: i,
    }));
    data.targets.forEach((tp) => insTarget.run({ component_id: compId, ...tp }));

    const total = db.prepare('SELECT COUNT(*) AS n FROM component_files WHERE project_id = ?').get(proj.id).n;
    db.prepare('UPDATE projects SET total_components = ?, prepared_components = ? WHERE id = ?').run(total, total, proj.id);
    return { projectId: proj.id, compId };
  });
  const { projectId, compId } = tx();
  return {
    project: db.prepare('SELECT id, name, code, total_components FROM projects WHERE id = ?').get(projectId),
    component: getComponent(compId),
    stats: data.stats,
  };
}
