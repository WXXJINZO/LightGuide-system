// HTTP API integration tests — every endpoint, success + error envelopes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from '../helpers/server.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

const api = (...a) => srv.api(...a);

test('GET /api/health', async () => {
  const r = await api('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

test('GET /api/projects + search', async () => {
  const all = await api('GET', '/api/projects');
  assert.equal(all.status, 200);
  assert.equal(all.body.total, 3);
  const search = await api('GET', '/api/projects?q=GZ-103');
  assert.equal(search.body.total, 1);
  assert.equal(search.body.items[0].code, 'A-001');
});

test('GET /api/projects/:id and 404', async () => {
  const ok = await api('GET', '/api/projects/1');
  assert.equal(ok.body.components.length, 8);
  const miss = await api('GET', '/api/projects/9999');
  assert.equal(miss.status, 404);
  assert.equal(miss.body.error.code, 'not_found');
});

test('GET /api/components/:id full payload', async () => {
  const r = await api('GET', '/api/components/1');
  assert.equal(r.body.mark, 'GZ-101');
  assert.equal(r.body.targets.length, 12);
  assert.equal(r.body.parts[0].is_primary, 1);
});

test('full workflow over HTTP: session → bind → pose → check → projection', async () => {
  const create = await api('POST', '/api/sessions', { projectId: 1 });
  assert.equal(create.status, 201);
  const sid = create.body.id;
  assert.equal(create.body.slots.length, 6);

  // bind 6 slots to the six passing components (component ids 1..6 = GZ-101..106)
  for (let n = 1; n <= 6; n++) {
    const r = await api('PUT', `/api/sessions/${sid}/slots/${n}/binding`, { componentId: n });
    assert.equal(r.status, 200);
  }
  let s = (await api('GET', `/api/sessions/${sid}`)).body;
  assert.equal(s.all_bound, true);

  // missing componentId → 400
  const bad = await api('PUT', `/api/sessions/${sid}/slots/1/binding`, {});
  assert.equal(bad.status, 400);

  // poses
  for (let n = 1; n <= 6; n++) {
    const r = await api('PUT', `/api/sessions/${sid}/slots/${n}/pose`, { headTail: 'normal', assemblyFace: 'top_flange' });
    assert.equal(r.status, 200);
  }
  // invalid face → 400
  const badPose = await api('PUT', `/api/sessions/${sid}/slots/1/pose`, { headTail: 'normal', assemblyFace: 'x' });
  assert.equal(badPose.status, 400);

  // check
  const checked = await api('POST', `/api/sessions/${sid}/check`);
  assert.equal(checked.body.all_checked, true);
  assert.equal(checked.body.has_out_of_tolerance, false);

  // projection lifecycle
  assert.equal((await api('POST', `/api/sessions/${sid}/projection/start`)).body.projection_state, 'projecting');
  assert.equal((await api('POST', `/api/sessions/${sid}/projection/pause`)).body.projection_state, 'paused');
  assert.equal((await api('POST', `/api/sessions/${sid}/projection/resume`)).body.projection_state, 'projecting');
  const done = await api('POST', `/api/sessions/${sid}/projection/complete`);
  assert.equal(done.body.current_step, 3);
  assert.equal(done.body.progress.length, 6);
  assert.equal(done.body.all_pose_set, false);
});

test('projection blocked when a slot is out of tolerance', async () => {
  const sid = (await api('POST', '/api/sessions', { projectId: 1 })).body.id;
  for (let n = 1; n <= 5; n++) await api('PUT', `/api/sessions/${sid}/slots/${n}/binding`, { componentId: n });
  await api('PUT', `/api/sessions/${sid}/slots/6/binding`, { componentId: 8 }); // GZ-108 = 4.8 mm
  await api('POST', `/api/sessions/${sid}/check`);
  const blocked = await api('POST', `/api/sessions/${sid}/projection/start`);
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error.message, /out of tolerance/i);
});

test('step navigation + unknown route 404', async () => {
  const sid = (await api('POST', '/api/sessions', { projectId: 1 })).body.id;
  const step = await api('PATCH', `/api/sessions/${sid}/step`, { step: 4 });
  assert.equal(step.body.current_step, 4);
  const bad = await api('PATCH', `/api/sessions/${sid}/step`, { step: 9 });
  assert.equal(bad.status, 400);
  const nf = await api('GET', '/api/nope');
  assert.equal(nf.status, 404);
});
