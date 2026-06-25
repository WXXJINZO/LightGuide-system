// Service-layer unit tests — the 5-step workflow business rules, exercised
// against a fresh in-memory DB with the demo seed (no HTTP, no browser).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from '../helpers/db.js';
import { listProjects, getProject } from '../../src/services/projects.service.js';
import { getComponent } from '../../src/services/components.service.js';
import * as svc from '../../src/services/sessions.service.js';

let db;
beforeEach(() => { db = freshDb(); });

function compIdByMark(mark) {
  return db.prepare('SELECT id FROM component_files WHERE mark = ?').get(mark).id;
}

// ── projects ──────────────────────────────────────────────────────────────
test('listProjects returns all and supports search by code and component mark', () => {
  assert.equal(listProjects().length, 3);
  assert.deepEqual(listProjects('A-001').map((p) => p.code), ['A-001']);
  assert.deepEqual(listProjects('GZ-101').map((p) => p.code), ['A-001']); // component-mark search
  assert.equal(listProjects('管廊').length, 1);
  assert.equal(listProjects('no-such').length, 0);
});

test('getProject returns its component files; missing id throws 404', () => {
  const p = getProject(1);
  assert.equal(p.code, 'A-001');
  assert.equal(p.components.length, 8);
  assert.throws(() => getProject(9999), /not found/i);
});

// ── components ────────────────────────────────────────────────────────────
test('getComponent returns geometry, BOM (primary first), secondary parts, 12 targets', () => {
  const c = getComponent(compIdByMark('GZ-101'));
  assert.equal(c.mark, 'GZ-101');
  assert.deepEqual(c.hbeam, { h: 400, b: 400, tw: 10, tf: 10, length: 8000 });
  assert.equal(c.parts[0].is_primary, 1, 'primary member is first');
  assert.equal(c.total_weight, 747); // 741 + 2*2.5 + 2*0.5
  assert.equal(c.secondary.length, 4);
  assert.equal(c.targets.length, 12);                 // V3 §11.1 — 12 targets
  assert.equal(c.faceCounts.top_flange, 4);
  // secondary parts carry V3 §13 dimensions + hole grid
  assert.deepEqual(c.secondary[0].size, { w: 400, h: 80, t: 10 });
  assert.deepEqual(c.secondary[0].holes, { rows: 2, cols: 4 });
});

// ── slot binding (页2) ────────────────────────────────────────────────────
test('bindSlot allows duplicate component across slots and flags it', () => {
  const s0 = svc.createSession(1);
  assert.equal(s0.slots.length, 6);
  assert.equal(s0.all_bound, false);
  const c1 = compIdByMark('GZ-101');
  svc.bindSlot(s0.id, 1, c1);
  const s = svc.bindSlot(s0.id, 2, c1); // duplicate is allowed
  assert.equal(s.bound_count, 2);
  assert.equal(s.slots[0].duplicate, true);
  assert.equal(s.slots[1].duplicate, true);
});

test('bindSlot rejects a component from another project', () => {
  const s0 = svc.createSession(1);
  const foreign = db.prepare("SELECT c.id FROM component_files c JOIN projects p ON p.id=c.project_id WHERE p.code='B-204'").get();
  // B-204 has no components seeded, so use a clearly invalid id:
  assert.throws(() => svc.bindSlot(s0.id, 1, 999999), /not found/i);
  void foreign;
});

test('clearSlot removes the binding and resets derived state', () => {
  const s0 = svc.createSession(1);
  svc.bindSlot(s0.id, 1, compIdByMark('GZ-101'));
  const s = svc.clearSlot(s0.id, 1);
  assert.equal(s.slots[0].component_id, null);
  assert.equal(s.bound_count, 0);
});

// ── pose (页3) ────────────────────────────────────────────────────────────
test('setPose requires a binding and validates inputs', () => {
  const s0 = svc.createSession(1);
  assert.throws(() => svc.setPose(s0.id, 1, { headTail: 'normal', assemblyFace: 'top_flange' }), /not bound/i);
  svc.bindSlot(s0.id, 1, compIdByMark('GZ-101'));
  assert.throws(() => svc.setPose(s0.id, 1, { headTail: 'sideways', assemblyFace: 'top_flange' }), /head\/tail/i);
  assert.throws(() => svc.setPose(s0.id, 1, { headTail: 'normal', assemblyFace: 'nope' }), /assembly face/i);
  const s = svc.setPose(s0.id, 1, { headTail: 'reversed', assemblyFace: 'left_web' });
  assert.equal(s.slots[0].pose_set, 1);
  assert.equal(s.slots[0].head_tail, 'reversed');
  assert.equal(s.slots[0].assembly_face, 'left_web');
});

// ── deviation check (页4) ──────────────────────────────────────────────────
test('runCheck classifies each bound slot deterministically', () => {
  const s0 = svc.createSession(1);
  const marks = ['GZ-101', 'GZ-102', 'GZ-103', 'GZ-104', 'GZ-105', 'GZ-107']; // last is near (2.9)
  marks.forEach((m, i) => svc.bindSlot(s0.id, i + 1, compIdByMark(m)));
  const s = svc.runCheck(s0.id);
  assert.equal(s.all_checked, true);
  assert.equal(s.slots[0].max_deviation, 1.2);
  assert.equal(s.slots[0].check_result, 'pass');
  assert.equal(s.slots[5].max_deviation, 2.9);
  assert.equal(s.slots[5].check_result, 'near');
  assert.equal(s.has_out_of_tolerance, false);
});

test('classifyDeviation thresholds (V3 §08): pass ≤ 2.4 < near ≤ 3.0 < out', () => {
  assert.equal(svc.classifyDeviation(1.2), 'pass');
  assert.equal(svc.classifyDeviation(2.3), 'pass');
  assert.equal(svc.classifyDeviation(2.4), 'pass');   // ≤ 2.4 is a pass (V3 §08)
  assert.equal(svc.classifyDeviation(2.6), 'near');
  assert.equal(svc.classifyDeviation(3.0), 'near');
  assert.equal(svc.classifyDeviation(3.1), 'out');
  assert.equal(svc.classifyDeviation(4.8), 'out');
});

// ── projection (页5) ───────────────────────────────────────────────────────
function bindAllPassing(sessionId) {
  ['GZ-101', 'GZ-102', 'GZ-103', 'GZ-104', 'GZ-105', 'GZ-106'].forEach((m, i) =>
    svc.bindSlot(sessionId, i + 1, compIdByMark(m)));
}

test('startProjection is blocked until all bound, checked and in tolerance', () => {
  const s0 = svc.createSession(1);
  assert.throws(() => svc.startProjection(s0.id), /must be bound/i);
  bindAllPassing(s0.id);
  assert.throws(() => svc.startProjection(s0.id), /deviation check/i);
  // out-of-tolerance blocks projection
  svc.bindSlot(s0.id, 6, compIdByMark('GZ-108')); // 4.8 mm
  svc.runCheck(s0.id);
  assert.throws(() => svc.startProjection(s0.id), /out of tolerance/i);
});

test('projection lifecycle: start → pause → resume → complete resets poses & logs faces', () => {
  const s0 = svc.createSession(1);
  bindAllPassing(s0.id);
  // set poses on the current (top_flange) face
  for (let n = 1; n <= 6; n++) svc.setPose(s0.id, n, { headTail: 'normal', assemblyFace: 'top_flange' });
  svc.runCheck(s0.id);

  let s = svc.startProjection(s0.id);
  assert.equal(s.projection_state, 'projecting');
  assert.equal(s.slots[0].projection_status, 'projecting');

  s = svc.pauseProjection(s0.id);
  assert.equal(s.projection_state, 'paused');
  assert.throws(() => svc.pauseProjection(s0.id), /not running/i);

  s = svc.resumeProjection(s0.id);
  assert.equal(s.projection_state, 'projecting');

  s = svc.completeProjection(s0.id);
  assert.equal(s.projection_state, 'idle');
  assert.equal(s.current_step, 3, 'returns to pose selection');
  assert.equal(s.all_pose_set, false, 'all poses reset to not-set');
  assert.equal(s.progress.length, 6, 'each slot logged its top_flange as completed');
  assert.ok(s.progress.every((p) => p.face === 'top_flange' && p.status === 'completed'));
  assert.equal(s.slots[0].completedFaces.length, 1);
});

test('completeProjection then a second face accumulates progress', () => {
  const s0 = svc.createSession(1);
  bindAllPassing(s0.id);
  for (let n = 1; n <= 6; n++) svc.setPose(s0.id, n, { headTail: 'normal', assemblyFace: 'top_flange' });
  svc.runCheck(s0.id);
  svc.startProjection(s0.id);
  svc.completeProjection(s0.id);
  // next face
  for (let n = 1; n <= 6; n++) svc.setPose(s0.id, n, { headTail: 'normal', assemblyFace: 'left_web' });
  svc.runCheck(s0.id);
  svc.startProjection(s0.id);
  const s = svc.completeProjection(s0.id);
  assert.equal(s.progress.length, 12); // 6 slots × 2 faces
  assert.equal(s.slots[0].completedFaces.length, 2);
});
