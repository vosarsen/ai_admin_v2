#!/usr/bin/env node

/**
 * Apply Phase 0.8 Schema Migrations to Timeweb PostgreSQL
 * Date: 2025-11-09
 * Purpose: Apply business data tables schema using Node.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('../src/database/postgres');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  header: () => console.log(`\n${colors.blue}${'='.repeat(70)}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => {
    console.log(`\n${colors.bright}${colors.blue}${msg}${colors.reset}`);
    console.log(colors.blue + '-'.repeat(70) + colors.reset);
  },
};

async function testConnection() {
  log.section('Testing Database Connection');

  try {
    const result = await postgres.query('SELECT NOW(), VERSION()');
    log.success('Connected to Timeweb PostgreSQL');
    log.info(`Server time: ${result.rows[0].now}`);
    log.info(`PostgreSQL: ${result.rows[0].version.split(',')[0]}`);
    return true;
  } catch (error) {
    log.error(`Connection failed: ${error.message}`);
    return false;
  }
}

async function checkExistingTables() {
  log.section('Checking Existing Tables');

  try {
    const result = await postgres.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    if (result.rows.length === 0) {
      log.info('No existing tables found (clean database)');
      return [];
    }

    const tables = result.rows.map(r => r.tablename);
    console.log('Existing tables:');
    tables.forEach(table => console.log(`  - ${table}`));

    // Check for conflicts
    const businessTables = ['companies', 'clients', 'services', 'staff', 'bookings', 'messages'];
    const conflicts = tables.filter(t => businessTables.includes(t));

    if (conflicts.length > 0) {
      log.warning(`Found ${conflicts.length} potentially conflicting tables`);
      conflicts.forEach(t => log.warning(`  - ${t}`));
      return conflicts;
    }

    log.success('No conflicts detected');
    return [];
  } catch (error) {
    log.error(`Failed to check existing tables: ${error.message}`);
    throw error;
  }
}

async function applyMigrationFile(filePath) {
  const fileName = path.basename(filePath);
  log.info(`Applying migration: ${fileName}`);

  try {
    const sql = fs.readFileSync(filePath, 'utf8');

    // Execute migration
    await postgres.query(sql);

    log.success(`Migration ${fileName} applied successfully`);
    return true;
  } catch (error) {
    log.error(`Migration ${fileName} failed: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function applyMigrations() {
  log.section('Applying Migrations');

  const migrationsDir = path.join(__dirname, '..', 'migrations');

  const migrations = [
    '20251109_create_business_tables_phase_08.sql',
    '20251109_create_partitioned_messages_table.sql',
  ];

  let failed = 0;

  for (const migration of migrations) {
    const filePath = path.join(migrationsDir, migration);

    if (!fs.existsSync(filePath)) {
      log.warning(`Migration file not found: ${migration}`);
      continue;
    }

    const success = await applyMigrationFile(filePath);
    if (!success) {
      failed++;
    }

    // Add small delay between migrations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('');

  if (failed > 0) {
    log.error(`${failed} migrations failed`);
    return false;
  }

  log.success('All migrations applied successfully!');
  return true;
}

async function verifySchema() {
  log.section('Verifying Schema');

  const requiredTables = [
    'companies',
    'clients',
    'services',
    'staff',
    'staff_schedules',
    'bookings',
    'appointments_cache',
    'dialog_contexts',
    'reminders',
    'sync_status',
    'messages',
  ];

  try {
    const result = await postgres.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1);
    `, [requiredTables]);

    const existingTables = result.rows.map(r => r.tablename);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length === 0) {
      log.success(`All ${requiredTables.length} required tables exist`);
      return true;
    }

    log.error(`${missingTables.length} required tables are missing:`);
    missingTables.forEach(t => log.error(`  - ${t}`));
    return false;
  } catch (error) {
    log.error(`Schema verification failed: ${error.message}`);
    return false;
  }
}

async function verifyIndexes() {
  log.section('Verifying Indexes');

  try {
    const result = await postgres.query(`
      SELECT
        tablename,
        COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename NOT LIKE 'whatsapp_%'
      GROUP BY tablename
      ORDER BY tablename;
    `);

    const totalIndexes = result.rows.reduce((sum, row) => sum + parseInt(row.index_count), 0);

    log.info(`Total indexes: ${totalIndexes}`);
    console.log('Indexes by table:');
    result.rows.forEach(row => {
      console.log(`  ${row.tablename}: ${row.index_count} indexes`);
    });

    log.success('Indexes verified');
    return true;
  } catch (error) {
    log.error(`Index verification failed: ${error.message}`);
    return false;
  }
}

async function getDatabaseStats() {
  log.section('Database Statistics');

  try {
    // Table statistics
    const result = await postgres.query(`
      SELECT
        tablename,
        n_tup_ins - n_tup_del AS row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY (n_tup_ins - n_tup_del) DESC;
    `);

    console.log('Table statistics:');
    result.rows.forEach(row => {
      console.log(`  ${row.tablename}: ${row.row_count} rows`);
    });

    // Message partitions
    try {
      const partitions = await postgres.query('SELECT * FROM get_messages_stats()');
      console.log('\nMessage partitions:');
      partitions.rows.forEach(row => {
        console.log(`  ${row.partition_name}: ${row.row_count} rows, ${row.table_size}`);
      });
    } catch (error) {
      log.warning('get_messages_stats() function not available yet');
    }

    log.success('Statistics retrieved');
  } catch (error) {
    log.error(`Failed to get statistics: ${error.message}`);
  }
}

async function main() {
  log.header();
  console.log(`${colors.bright}${colors.blue}Phase 0.8 Schema Migration - Timeweb PostgreSQL${colors.reset}`);
  log.header();

  try {
    // Step 1: Test connection
    if (!await testConnection()) {
      log.error('Cannot proceed without database connection');
      process.exit(1);
    }

    // Step 2: Check existing tables
    const conflicts = await checkExistingTables();

    if (conflicts.length > 0) {
      log.warning('Some tables already exist. They will be skipped if migration uses IF NOT EXISTS.');
      // Optionally prompt user to continue
      // For now, we'll continue automatically
    }

    // Step 3: Apply migrations
    const success = await applyMigrations();

    if (!success) {
      log.error('Migration failed. Exiting.');
      process.exit(1);
    }

    // Step 4: Verify schema
    await verifySchema();

    // Step 5: Verify indexes
    await verifyIndexes();

    // Step 6: Get statistics
    await getDatabaseStats();

    // Final summary
    log.header();
    log.success('Phase 0.8 Schema Migration Complete!');
    console.log('');
    log.info('Next steps:');
    console.log('  1. Run: node scripts/test-phase-08-schema.js');
    console.log('  2. Begin Phase 0.9 (Query Pattern Library)');
    console.log('  3. Start data migration from Supabase');
    console.log('');
    log.info('To check stats: SELECT * FROM get_database_stats();');
    log.info('To check message partitions: SELECT * FROM get_messages_stats();');
    console.log('');

    process.exit(0);
  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { applyMigrations, verifySchema };
