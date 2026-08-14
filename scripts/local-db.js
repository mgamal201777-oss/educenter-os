/**
 * Local development PostgreSQL manager using embedded-postgres.
 * Downloads and runs a user-space PostgreSQL binary — no admin rights needed.
 * Production (Railway) uses a managed PostgreSQL; this is dev-only.
 *
 * Usage:
 *   node scripts/local-db.js start   (also initializes on first run)
 *   node scripts/local-db.js stop
 *   node scripts/local-db.js createdb
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '.pgdata');
const PORT = Number(process.env.PGPORT || 5433);
const USER = 'postgres';
const PASSWORD = 'postgres';
const DB_NAME = process.env.PGDATABASE || 'educenter';

async function main() {
  const action = process.argv[2] || 'start';
  const EmbeddedPostgres = require('embedded-postgres').default;
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  if (action === 'stop') {
    await pg.stop();
    console.log(`[local-db] PostgreSQL stopped (port ${PORT})`);
    return;
  }

  const fresh = !fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));

  if (action === 'createdb') {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase(DB_NAME);
    await pg.stop();
    console.log(`[local-db] Database "${DB_NAME}" created`);
    return;
  }

  // default: start
  if (fresh) {
    console.log('[local-db] First run — initializing database cluster...');
    await pg.initialise();
    await pg.start();
    await pg.createDatabase(DB_NAME).catch((e) => {
      if (!/already exists/.test(e.message)) throw e;
    });
  } else {
    await pg.start();
  }
  console.log(`[local-db] PostgreSQL running on port ${PORT}, database "${DB_NAME}" (user: postgres)`);
  // keep process alive — the postgres server runs as a child process
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error('[local-db] Error:', e.message);
  process.exit(1);
});
