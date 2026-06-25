// Central configuration, sourced from environment with sensible defaults.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT) || 4178,
  host: process.env.HOST || '127.0.0.1',
  dbPath: process.env.LIGHTGUIDE_DB || path.join(root, 'data', 'lightguide.db'),
  publicDir: path.join(root, 'public'),
  root,
  // Cap on a JSON request body (geometry payloads can be sizeable).
  maxBodyBytes: Number(process.env.LIGHTGUIDE_MAX_BODY) || 12 * 1024 * 1024,
  isProd: process.env.NODE_ENV === 'production',
};
