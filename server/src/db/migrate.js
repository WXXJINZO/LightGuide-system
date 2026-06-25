// Apply the schema DDL to the configured database (idempotent).
import { getDb, applySchema } from './index.js';

const db = getDb();
applySchema(db);
console.log('[migrate] schema applied to', db.name);
