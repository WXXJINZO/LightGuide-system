// Test DB helper — a fresh in-memory database, schema applied + demo seed,
// installed as the connection singleton so the services use it.
import Database from 'better-sqlite3';
import { setDb, applySchema, closeDb } from '../../src/db/index.js';
import { ensureSeed } from '../../src/db/seed.js';

export function freshDb() {
  closeDb();
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  setDb(db);
  applySchema(db);
  ensureSeed(db);
  return db;
}
