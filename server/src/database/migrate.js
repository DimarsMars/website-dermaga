/**
 * Database Migration Runner
 *
 * Runs migration scripts against the configured PostgreSQL database in order:
 *   1. migration.sql  — baseline schema (creates all base tables)
 *   2. add_*.sql       — incremental schema changes (idempotent, uses IF [NOT] EXISTS)
 *   3. seed.sql        — initial master data (admin account)
 *
 * Usage:
 *   node src/database/migrate.js          # Run all migrations (baseline + addons) + seed
 *   node src/database/migrate.js --seed    # Run seed only
 *   node src/database/migrate.js --fresh   # Run all migrations (baseline drops tables first) + seed
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const BASELINE_FILE = path.join(__dirname, 'migration.sql');
const SEED_FILE = path.join(__dirname, 'seed.sql');

// Incremental addon migrations — order matters (every file MUST be idempotent
// using IF NOT EXISTS / IF EXISTS so it is safe to re-run).
const ADDON_FILES = [
  'add_ship_columns.sql',
  'add_notif_booking_ref.sql',
  'add_extend_columns.sql',
  'add_completed_status.sql',
  'add_auth_columns.sql',
  'add_refresh_tokens.sql',
  'add_token_version.sql',
].map((name) => path.join(__dirname, name));

async function runScript(filePath, label) {
  console.log(`Running ${label}: ${path.basename(filePath)} ...`);
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
  console.log(`  ✓ ${label} completed.`);
}

async function runBaseline() {
  await runScript(BASELINE_FILE, 'baseline');
}

async function runAddons() {
  for (const file of ADDON_FILES) {
    if (!fs.existsSync(file)) {
      console.warn(`  ! Addon migration not found, skipping: ${path.basename(file)}`);
      continue;
    }
    await runScript(file, 'addon');
  }
}

async function runSeed() {
  await runScript(SEED_FILE, 'seed');
}

async function main() {
  const args = process.argv.slice(2);
  const seedOnly = args.includes('--seed');
  const fresh = args.includes('--fresh');

  try {
    if (seedOnly) {
      await runSeed();
    } else if (fresh) {
      console.log('Fresh migration: dropping all tables and re-creating...');
      await runBaseline();
      await runAddons();
      await runSeed();
    } else {
      await runBaseline();
      await runAddons();
      await runSeed();
    }

    console.log('Database setup complete.');
  } catch (error) {
    console.error('Database migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();