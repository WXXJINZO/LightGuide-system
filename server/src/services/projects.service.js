// Project queries (页面1 选择工程). All SQL lives in the service layer.
import { getDb } from '../db/index.js';
import { notFound } from '../lib/errors.js';

/** List projects, optionally filtered by name/code or a contained component mark. */
export function listProjects(q = '') {
  const db = getDb();
  const term = String(q || '').trim();
  if (!term) {
    return db.prepare('SELECT * FROM projects ORDER BY created_at DESC, id DESC').all();
  }
  const like = `%${term}%`;
  return db.prepare(
    `SELECT DISTINCT p.* FROM projects p
       LEFT JOIN component_files c ON c.project_id = p.id
      WHERE p.name LIKE ? OR p.code LIKE ? OR c.mark LIKE ?
      ORDER BY p.created_at DESC, p.id DESC`
  ).all(like, like, like);
}

/** A project plus a lightweight summary of its component files. */
export function getProject(id) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) throw notFound('Project not found');
  const components = db.prepare(
    `SELECT id, mark, spec, length_mm, ifc_name, total_weight, nominal_deviation, sort_order
       FROM component_files WHERE project_id = ? ORDER BY sort_order, id`
  ).all(id);
  return { ...project, components };
}
