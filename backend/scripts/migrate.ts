import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { config } from '../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  const sql = readFileSync(path.join(__dirname, '../migrations/001_init.sql'), 'utf-8');
  await client.query(sql);
  await client.end();
  console.log('Migration applied.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
