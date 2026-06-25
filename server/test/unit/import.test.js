// Import pipeline tests (V3 §15 / [REQ-DATA-*]) — real IFC (full geometry) +
// real STEP (simplified bbox), plus the HTTP import endpoint, against the
// bundled fixture models.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importModel, parseHSection } from '../../src/lib/cad-import.js';
import { startTestServer } from '../helpers/server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(here, '..', 'fixtures');
const ifcText = fs.readFileSync(path.join(FIX, 'T4-B-XG27_x1.ifc'), 'utf8');
const stpText = fs.readFileSync(path.join(FIX, 'Y7GL58.stp'), 'utf8');

test('parseHSection parses 4-number and 2-number specs', () => {
  assert.deepEqual(parseHSection('HN900*300*16*28'), { h: 900, b: 300, tw: 16, tf: 28 });
  assert.deepEqual(parseHSection('HW400×400×10×10'), { h: 400, b: 400, tw: 10, tf: 10 });
  const hm = parseHSection('HM250*175');
  assert.equal(hm.h, 250); assert.equal(hm.b, 175); assert.ok(hm.tw > 0 && hm.tf > 0);
});

test('IFC import identifies the main H-beam + secondary parts (real geometry)', () => {
  const m = importModel(ifcText, 'T4-B-XG27_x1.ifc');
  assert.equal(m.source_format, 'ifc');
  assert.equal(m.mark, 'T4-B-XG27');
  assert.equal(m.spec, 'HN900*300*16*28');
  assert.deepEqual(m.hbeam, { h: 900, b: 300, tw: 16, tf: 28, length: m.hbeam.length });
  assert.ok(m.hbeam.length > 9000 && m.hbeam.length < 9500, `length ${m.hbeam.length}`);
  assert.ok(m.secondaries.length >= 10, `secondaries ${m.secondaries.length}`);
  assert.equal(m.targets.length, 12);
  // BOM has the primary first and real Tekla part positions
  assert.equal(m.bom[0].is_primary, 1);
  assert.ok(m.bom.length >= 10);
  // every secondary is placed on a real face with a station within the beam
  for (const s of m.secondaries) {
    assert.ok(['top_flange', 'bottom_flange', 'left_web', 'right_web'].includes(s.face));
    assert.ok(s.near >= 0 && s.near <= m.hbeam.length + 1);
    assert.ok(s.w > 0 && s.h > 0 && s.t > 0);
  }
});

test('STEP import is simplified (bbox) but produces a sane H-beam + parts', () => {
  const m = importModel(stpText, 'Y7GL58.stp');
  assert.equal(m.source_format, 'step');
  assert.ok(m.stats.simplified === true);
  assert.ok(m.stats.warnings.some((w) => /B-rep/i.test(w)), 'flags the B-rep limitation');
  // vertex-only bbox → realistic beam (not the tens-of-metres model envelope)
  assert.ok(m.hbeam.h > 100 && m.hbeam.h < 2000, `h ${m.hbeam.h}`);
  assert.ok(m.hbeam.length > 1000 && m.hbeam.length < 30000, `length ${m.hbeam.length}`);
  assert.ok(m.secondaries.length >= 5);
  assert.equal(m.targets.length, 12);
});

test('unrecognized content is rejected', () => {
  assert.throws(() => importModel('hello world', 'x.txt'), /format/i);
});

// ── HTTP endpoint ──────────────────────────────────────────────────────────
let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('POST /api/import creates a component in the 导入模型 project', async () => {
  const r = await srv.api('POST', '/api/import', { filename: 'T4-B-XG27_x1.ifc', content: ifcText });
  assert.equal(r.status, 201);
  assert.equal(r.body.project.code, 'IMPORT');
  assert.equal(r.body.component.mark, 'T4-B-XG27');
  assert.ok(r.body.component.parts.length >= 10);
  assert.equal(r.body.component.targets.length, 12);

  // it now shows up in the project list and is bindable like any component
  const projects = await srv.api('GET', '/api/projects');
  assert.ok(projects.body.items.some((p) => p.code === 'IMPORT'));

  // a second import accumulates into the same project
  const r2 = await srv.api('POST', '/api/import', { filename: 'Y7GL58.stp', content: stpText });
  assert.equal(r2.status, 201);
  assert.equal(r2.body.project.code, 'IMPORT');
  assert.ok(r2.body.project.total_components >= 2);

  // missing fields → 400
  const bad = await srv.api('POST', '/api/import', { filename: 'x.ifc' });
  assert.equal(bad.status, 400);
});
