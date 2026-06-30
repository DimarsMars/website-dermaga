/**
 * Database Migration Runner
 * 
 * Runs the migration.sql and seed.sql scripts against the configured PostgreSQL database.
 * 
 * Usage:
 *   node src/database/migrate.js          # Run migration + seed
 *   node src/database/migrate.js --seed   # Run seed only
 *   node src/database/migrate.js --fresh  # Drop all tables and re-run migration + seed
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const MIGRATION_FILE = path.join(__dirname, 'migration.sql');
const SEED_FILE = path.join(__dirname, 'seed.sql');

async function runMigration() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  console.log('Running migration...');
  await pool.query(sql);
  console.log('Migration completed successfully.');
}

async function runSeed() {
  const sql = fs.readFileSync(SEED_FILE, 'utf8');
  console.log('Running seed...');
  await pool.query(sql);
  console.log('Seed completed successfully.');
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
      await runMigration();
      await runSeed();
    } else {
      await runMigration();
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
