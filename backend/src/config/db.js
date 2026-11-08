const { Pool } = require('pg');
const { AsyncLocalStorage } = require('node:async_hooks');
require('dotenv').config();

// Choose one database for the lifetime of the process. Never replay failed SQL
// against a different database. SQLite is the existing local installation.
const engine = process.env.DB_CLIENT || 'sqlite';
if (!['sqlite', 'postgres'].includes(engine)) throw new Error('DB_CLIENT must be sqlite or postgres');
const sqliteDb = engine === 'sqlite' ? require('./sqliteDb') : null;
const pool = engine === 'postgres' ? new Pool(process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 }
  : { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'bakery_db', user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 }) : null;
const context = new AsyncLocalStorage();
let queue = Promise.resolve();
let connected = engine === 'sqlite';
if (pool) pool.on('error', () => { connected = false; });
function serialize(fn) {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
}
async function query(sql, params = []) {
  const client = context.getStore();
  if (client) return client.query(sql, params);
  if (sqliteDb) return serialize(() => sqliteDb.query(sql, params));
  return pool.query(sql, params);
}
async function transaction(work) {
  if (context.getStore()) return work();
  if (sqliteDb) return serialize(async () => {
    sqliteDb.db.exec('BEGIN IMMEDIATE');
    try {
      const result = await context.run({ query: sqliteDb.query }, work);
      sqliteDb.db.exec('COMMIT');
      return result;
    } catch (error) { sqliteDb.db.exec('ROLLBACK'); throw error; }
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await context.run(client, work);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function checkConnection() {
  try { await query('SELECT 1'); connected = true; } catch { connected = false; }
  return connected;
}
module.exports = { query, transaction, pool, sqlite: sqliteDb?.db, engine,
  isConnected: () => connected, isPostgresConnected: () => engine === 'postgres' && connected,
  checkConnection, getDbStatus: () => ({ connected, mode: engine, engine,
    database: engine === 'sqlite' ? 'bakery.sqlite' : process.env.DB_NAME || 'bakery_db' }),
  close: async () => { if (pool) await pool.end(); if (sqliteDb) sqliteDb.db.close(); },
};
