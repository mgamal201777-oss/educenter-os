/**
 * Migration runner: applies every .sql file in server/sql in name order,
 * tracking applied migrations in the _migrations table.
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function run() {
  const dir = path.join(__dirname, '..', 'sql');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  const { rows } = await pool.query('SELECT name FROM _migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] skip  ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrate] apply ${file}`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`[migrate] FAILED ${file}:`, e.message);
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }
  }
  console.log('[migrate] done');
}

run()
  .catch((e) => {
    console.error('[migrate] error:', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
