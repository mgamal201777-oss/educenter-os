const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Railway provides DATABASE_URL; local dev uses embedded-postgres defaults
const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5433/educenter';

const pool = new Pool({
  connectionString,
  max: 10,
  client_encoding: 'UTF8',
  ssl: /sslmode=require/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
});

const query = (text, params) => pool.query(text, params);

/** Run a query inside a transaction. fn(client) must return a promise. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction, connectionString };
