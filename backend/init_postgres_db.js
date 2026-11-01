/**
 * Database Initializer & Migration Runner for Bakery Management System
 * Target Database: bakery_db
 */

const fs = require('fs');
const path = require('path');
const { Client, Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '5432', 10);
const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD || 'Pranav';
const targetDb = process.env.DB_NAME || 'bakery_db';

async function initPostgresDatabase() {
  console.log('================================================================');
  console.log(`[DB SETUP] Initializing PostgreSQL for Bakery Management System`);
  console.log(`[DB SETUP] Host: ${host}:${port} | User: ${user} | Database: ${targetDb}`);
  console.log('================================================================');

  // Step 1: Connect to root 'postgres' database to ensure 'bakery_db' exists
  const rootClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });

  try {
    await rootClient.connect();
    console.log(`[DB SETUP] Successfully connected to PostgreSQL maintenance database.`);

    const checkRes = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb]
    );

    if (checkRes.rowCount === 0) {
      console.log(`[DB SETUP] Database "${targetDb}" does not exist. Creating now...`);
      await rootClient.query(`CREATE DATABASE "${targetDb}" WITH OWNER = "${user}" ENCODING = 'UTF8'`);
      console.log(`[DB SETUP] Database "${targetDb}" created successfully.`);
    } else {
      console.log(`[DB SETUP] Target database "${targetDb}" already exists.`);
    }
  } catch (err) {
    console.error(`[DB SETUP ERROR] Connection to root postgres failed:`, err.message);
    process.exit(1);
  } finally {
    await rootClient.end();
  }

  // Step 2: Connect to target database 'bakery_db'
  const targetPool = new Pool({
    host,
    port,
    user,
    password,
    database: targetDb,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await targetPool.connect();
    console.log(`[DB SETUP] Connected directly to "${targetDb}".`);

    // Step 3: Execute schema.sql
    const schemaPath = path.resolve(__dirname, '..', 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
    console.log(`[DB SETUP] Applying DDL from schema.sql...`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log(`[DB SETUP] Schema created successfully! All tables, constraints, and indexes built.`);

    // Step 4: Execute seed.sql
    const seedPath = path.resolve(__dirname, '..', 'database', 'seed.sql');
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Seed file not found at ${seedPath}`);
    }
    console.log(`[DB SETUP] Inserting realistic dataset from seed.sql...`);
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.query(seedSql);
    console.log(`[DB SETUP] Realistic seed data inserted and sequences synchronized!`);

    // Step 5: Verification & Table Summary
    console.log('\n================================================================');
    console.log(`[DB VERIFICATION] Table Row Counts in "${targetDb}":`);
    console.log('================================================================');

    const tables = [
      'businesses',
      'users',
      'qr_codes',
      'customer_addresses',
      'categories',
      'products',
      'product_variants',
      'suppliers',
      'raw_materials',
      'raw_material_lots',
      'stock_requisitions',
      'recipes',
      'recipe_ingredients',
      'production_batches',
      'batch_workers',
      'batch_materials_consumed',
      'production_logs',
      'orders',
      'order_items',
      'batch_orders',
      'order_status_history',
      'payments',
      'wastage_logs',
      'quality_checks',
      'customer_feedback',
    ];

    const counts = {};
    for (const table of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = parseInt(res.rows[0].count, 10);
        console.log(` - ${table.padEnd(26)} : ${counts[table]} rows`);
      } catch (e) {
        console.log(` - ${table.padEnd(26)} : [ERROR: ${e.message}]`);
      }
    }

    client.release();
    console.log('================================================================');
    console.log(`[DB SETUP COMPLETE] PostgreSQL "${targetDb}" is fully ready!`);
    console.log('================================================================');
    return counts;
  } catch (err) {
    console.error(`[DB SETUP ERROR] Failed during schema/seed application:`, err.message);
    process.exit(1);
  } finally {
    await targetPool.end();
  }
}

if (require.main === module) {
  initPostgresDatabase().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { initPostgresDatabase };
