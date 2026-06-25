// Network entrypoint: open DB, ensure schema+seed exist, start listening.
import { createApp } from './app.js';
import { config } from './config.js';
import { getDb, applySchema } from './db/index.js';
import { ensureSeed } from './db/seed.js';

const db = getDb();
applySchema(db);
ensureSeed(db);

const app = createApp();
app.listen(config.port, config.host, () => {
  console.log(`[lightguide] listening on http://${config.host}:${config.port}`);
});
