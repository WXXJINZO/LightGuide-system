// On-site session workflow engine — the 5-step state machine that drives
// slot binding (页2), manual pose (页3), deviation check (页4) and projection
// (页5). All business rules live here so they are unit-testable without HTTP.
import { getDb } from '../db/index.js';
import { notFound, badRequest, conflict } from '../lib/errors.js';
import { faceCounts } from './components.service.js';

export const FACES = ['top_flange', 'bottom_flange', 'left_web', 'right_web'];
export const HEAD_TAIL = ['normal', 'reversed'];

// Deviation decision thresholds (mm), per V3 §08:
//   pass ≤ 2.4 (green) · near 2.4–3.0 (yellow, still projectable) · out > 3.0 (red, blocked).
const PASS_MAX = 2.4;
const TOLERANCE = 3.0;

export function classifyDeviation(mm) {
  if (mm > TOLERANCE) return 'out';   // > 3.0 mm  → blocked
  if (mm > PASS_MAX) return 'near';   // 2.4–3.0 mm → yellow (still projectable)
  return 'pass';                      // ≤ 2.4 mm  → green
}

/** Create a session for a project with six empty slots. */
export function createSession(projectId) {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) throw notFound('Project not found');
  const insSession = db.prepare('INSERT INTO sessions (project_id) VALUES (?)');
  const insSlot = db.prepare('INSERT INTO slots (session_id, slot_no) VALUES (?, ?)');
  const tx = db.transaction(() => {
    const sid = insSession.run(projectId).lastInsertRowid;
    for (let n = 1; n <= 6; n++) insSlot.run(sid, n);
    return sid;
  });
  return getSession(tx());
}

/** Full session DTO: project, slots (with bound-component summary), progress. */
export function getSession(id) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) throw notFound('Session not found');
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(session.project_id);
  const slots = db.prepare('SELECT * FROM slots WHERE session_id = ? ORDER BY slot_no').all(id)
    .map((s) => decorateSlot(db, id, s));
  const progress = db.prepare(
    'SELECT slot_no, face, status, completed_at FROM face_progress WHERE session_id = ? ORDER BY slot_no, face'
  ).all(id);
  return {
    id: session.id,
    project_id: session.project_id,
    project: project ? { id: project.id, name: project.name, code: project.code } : null,
    current_step: session.current_step,
    projection_state: session.projection_state,
    slots,
    progress,
    bound_count: slots.filter((s) => s.component_id != null).length,
    all_bound: slots.every((s) => s.component_id != null),
    all_pose_set: slots.every((s) => s.pose_set === 1),
    all_checked: slots.every((s) => s.checked === 1),
    has_out_of_tolerance: slots.some((s) => s.check_result === 'out'),
  };
}

function decorateSlot(db, sessionId, s) {
  let component = null;
  if (s.component_id != null) {
    const c = db.prepare(
      'SELECT id, mark, spec, length_mm, total_weight, nominal_deviation FROM component_files WHERE id = ?'
    ).get(s.component_id);
    if (c) {
      const counts = faceCounts(c.id);
      component = { ...c, faceCounts: counts, faceCount: counts[s.assembly_face] || 0 };
    }
  }
  const completedFaces = db.prepare(
    "SELECT face FROM face_progress WHERE session_id = ? AND slot_no = ? AND status = 'completed'"
  ).all(sessionId, s.slot_no).map((r) => r.face);
  // How many other slots share this component (the "重复使用" hint).
  const duplicate = s.component_id != null
    ? db.prepare('SELECT COUNT(*) AS n FROM slots WHERE session_id = ? AND component_id = ?')
        .get(sessionId, s.component_id).n > 1
    : false;
  return { ...s, component, completedFaces, duplicate };
}

function loadSlot(db, sessionId, slotNo) {
  const slot = db.prepare('SELECT * FROM slots WHERE session_id = ? AND slot_no = ?').get(sessionId, slotNo);
  if (!slot) throw notFound('Slot not found');
  return slot;
}

/** Bind (or replace) a slot's component file. Duplicate bindings are allowed. */
export function bindSlot(sessionId, slotNo, componentId) {
  const db = getDb();
  loadSlot(db, sessionId, slotNo);
  const session = db.prepare('SELECT project_id FROM sessions WHERE id = ?').get(sessionId);
  if (!session) throw notFound('Session not found');
  const comp = db.prepare('SELECT id FROM component_files WHERE id = ? AND project_id = ?')
    .get(componentId, session.project_id);
  if (!comp) throw badRequest('Component not found in this project');
  // Re-binding invalidates any pose/check the slot had.
  db.prepare(
    `UPDATE slots SET component_id = ?, pose_set = 0, checked = 0, max_deviation = 0,
       check_result = 'pending', projection_status = 'idle'
       WHERE session_id = ? AND slot_no = ?`
  ).run(componentId, sessionId, slotNo);
  return getSession(sessionId);
}

/** Clear a slot's binding. */
export function clearSlot(sessionId, slotNo) {
  const db = getDb();
  loadSlot(db, sessionId, slotNo);
  db.prepare(
    `UPDATE slots SET component_id = NULL, pose_set = 0, checked = 0, max_deviation = 0,
       check_result = 'pending', projection_status = 'idle'
       WHERE session_id = ? AND slot_no = ?`
  ).run(sessionId, slotNo);
  return getSession(sessionId);
}

/** Set a slot's manual pose (head/tail + current assembly face). */
export function setPose(sessionId, slotNo, { headTail, assemblyFace }) {
  const db = getDb();
  const slot = loadSlot(db, sessionId, slotNo);
  if (slot.component_id == null) throw badRequest('Slot is not bound to a component');
  if (!HEAD_TAIL.includes(headTail)) throw badRequest('Invalid head/tail direction', { headTail });
  if (!FACES.includes(assemblyFace)) throw badRequest('Invalid assembly face', { assemblyFace });
  db.prepare(
    `UPDATE slots SET head_tail = ?, assembly_face = ?, pose_set = 1,
       checked = 0, max_deviation = 0, check_result = 'pending'
       WHERE session_id = ? AND slot_no = ?`
  ).run(headTail, assemblyFace, sessionId, slotNo);
  return getSession(sessionId);
}

/** Reset a slot's pose to "not set". */
export function resetPose(sessionId, slotNo) {
  const db = getDb();
  loadSlot(db, sessionId, slotNo);
  db.prepare(
    `UPDATE slots SET pose_set = 0, checked = 0, max_deviation = 0, check_result = 'pending'
       WHERE session_id = ? AND slot_no = ?`
  ).run(sessionId, slotNo);
  return getSession(sessionId);
}

/**
 * Run edge-registration deviation check for every bound slot. Deviation is the
 * bound component's deterministic nominal value (so demo + tests are stable).
 */
export function runCheck(sessionId) {
  const db = getDb();
  const slots = db.prepare('SELECT * FROM slots WHERE session_id = ? ORDER BY slot_no').all(sessionId);
  if (!slots.length) throw notFound('Session not found');
  const upd = db.prepare(
    'UPDATE slots SET checked = 1, max_deviation = ?, check_result = ? WHERE id = ?'
  );
  const tx = db.transaction(() => {
    for (const s of slots) {
      if (s.component_id == null) continue;
      const c = db.prepare('SELECT nominal_deviation FROM component_files WHERE id = ?').get(s.component_id);
      const dev = Math.round((c?.nominal_deviation || 0) * 10) / 10;
      upd.run(dev, classifyDeviation(dev), s.id);
    }
  });
  tx();
  return getSession(sessionId);
}

/** Start batch projection. Blocked if any slot is out of tolerance. */
export function startProjection(sessionId) {
  const db = getDb();
  const session = getSession(sessionId);
  if (!session.all_bound) throw conflict('All 6 slots must be bound before projection');
  if (!session.all_checked) throw conflict('All slots must pass the deviation check first');
  if (session.has_out_of_tolerance) throw conflict('Projection blocked: a slot is out of tolerance (> 3 mm)');
  const tx = db.transaction(() => {
    db.prepare("UPDATE sessions SET projection_state = 'projecting' WHERE id = ?").run(sessionId);
    db.prepare("UPDATE slots SET projection_status = 'projecting' WHERE session_id = ? AND component_id IS NOT NULL").run(sessionId);
  });
  tx();
  return getSession(sessionId);
}

export function pauseProjection(sessionId) {
  const db = getDb();
  const session = db.prepare('SELECT projection_state FROM sessions WHERE id = ?').get(sessionId);
  if (!session) throw notFound('Session not found');
  if (session.projection_state !== 'projecting') throw conflict('Projection is not running');
  const tx = db.transaction(() => {
    db.prepare("UPDATE sessions SET projection_state = 'paused' WHERE id = ?").run(sessionId);
    db.prepare("UPDATE slots SET projection_status = 'paused' WHERE session_id = ? AND projection_status = 'projecting'").run(sessionId);
  });
  tx();
  return getSession(sessionId);
}

export function resumeProjection(sessionId) {
  const db = getDb();
  const session = db.prepare('SELECT projection_state FROM sessions WHERE id = ?').get(sessionId);
  if (!session) throw notFound('Session not found');
  if (session.projection_state !== 'paused') throw conflict('Projection is not paused');
  const tx = db.transaction(() => {
    db.prepare("UPDATE sessions SET projection_state = 'projecting' WHERE id = ?").run(sessionId);
    db.prepare("UPDATE slots SET projection_status = 'projecting' WHERE session_id = ? AND projection_status = 'paused'").run(sessionId);
  });
  tx();
  return getSession(sessionId);
}

/**
 * 完成本次投影 / Complete this projection:
 *   1. stop projecting,
 *   2. mark each bound slot's current assembly face as completed,
 *   3. reset all 6 slot poses to "not set" (+ clear check/projection state),
 *   4. return to step 3 (manual pose selection) for the next face.
 */
export function completeProjection(sessionId) {
  const db = getDb();
  const slots = db.prepare('SELECT * FROM slots WHERE session_id = ?').all(sessionId);
  if (!slots.length) throw notFound('Session not found');
  const markFace = db.prepare(
    `INSERT INTO face_progress (session_id, slot_no, face, status)
       VALUES (?, ?, ?, 'completed')
       ON CONFLICT(session_id, slot_no, face) DO UPDATE SET status='completed', completed_at=datetime('now')`
  );
  const tx = db.transaction(() => {
    for (const s of slots) {
      if (s.component_id != null && s.pose_set === 1) markFace.run(sessionId, s.slot_no, s.assembly_face);
    }
    // Reset poses for the next face; keep bindings.
    db.prepare(
      `UPDATE slots SET pose_set = 0, checked = 0, max_deviation = 0,
         check_result = 'pending', projection_status = 'idle' WHERE session_id = ?`
    ).run(sessionId);
    db.prepare("UPDATE sessions SET projection_state = 'idle', current_step = 3 WHERE id = ?").run(sessionId);
  });
  tx();
  return getSession(sessionId);
}

/** Navigate the workflow step (1..5). */
export function setStep(sessionId, step) {
  const db = getDb();
  const n = Number(step);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw badRequest('Step must be 1..5', { step });
  const r = db.prepare('UPDATE sessions SET current_step = ? WHERE id = ?').run(n, sessionId);
  if (r.changes === 0) throw notFound('Session not found');
  return getSession(sessionId);
}
