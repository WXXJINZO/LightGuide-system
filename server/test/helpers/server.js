// Spin up the real Express app against a fresh seeded in-memory DB on an
// ephemeral port, for HTTP-level integration tests.
import { createApp } from '../../src/app.js';
import { freshDb } from './db.js';

export async function startTestServer() {
  freshDb();
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const api = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
    return { status: res.status, body: json };
  };
  return { base, api, close: () => new Promise((r) => server.close(r)) };
}
