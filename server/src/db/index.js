// SQLite connection singleton. Uses better-sqlite3 (synchronous).
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';

let db = null;

/**
 * Open (once) and return the shared database handle.
 * Pass an explicit path for tests (e.g. ':memory:' or a temp file).
 */
export function getDb(dbPath = config.dbPath) {
  if (db) return db;
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/** Apply the schema DDL to a given handle. */
export function applySchema(handle) {
  const schemaPath = path.join(config.root, 'src', 'db', 'schema.sql');
  const ddl = fs.readFileSync(schemaPath, 'utf8');
  handle.exec(ddl);
  return handle;
}

/** Close and reset the singleton (used by tests). */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

/** Reset the singleton to a provided handle (used by tests). */
export function setDb(handle) {
  db = handle;
}
