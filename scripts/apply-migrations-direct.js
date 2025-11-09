#!/usr/bin/env node

/**
 * Apply Phase 0.8 Schema Migrations - Direct PostgreSQL Connection
 * Date: 2025-11-09
 * Purpose: Apply schema bypassing USE_LEGACY_SUPABASE flag
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bright: '\x1b[1m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => {
    console.log(`\n${colors.bright}${colors.blue}${msg}${colors.reset}`);
    console.log(colors.blue + '-'.repeat(70) + colors.reset);
  },
};

// Create PostgreSQL pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'a84c973324fdaccfc68d929d.twc1.net',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DATABASE || 'default_db',
  user: process.env.POSTGRES_USER || 'gen_user',
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.PGSSLROOTCERT ? {
    rejectUnauthorized: true,
    ca: fs.readFileSync(process.env.PGSSLROOTCERT),
  } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function testConnection() {
  log.section('Testing Database Connection');

  try {
    const result = await pool.query('SELECT NOW(), VERSION()');
    log.success('Connected to Timeweb PostgreSQL (direct connection)');
    log.info(`Server time: ${result.rows[0].now}`);
    log.info(`PostgreSQL: ${result.rows[0].version.split(',')[0]}`);
    return true;
  } catch (error) {
    log.error(`Connection failed: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function applyMigrationFile(filePath) {
  const fileName = path.basename(filePath);
  log.info(`Applying migration: ${fileName}`);

  try {
    const sql = fs.readFileSync(filePath, 'utf8');

    // Execute migration
    await pool.query(sql);

    log.success(`Migration ${fileName} applied successfully`);
    return true;
  } catch (error) {
    log.error(`Migration ${fileName} failed`);
    console.error(`Error: ${error.message}`);

    // Show more details for debugging
    if (error.position) {
      log.warning(`Error at position ${error.position} in SQL`);
    }

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
    const result = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1);
    `, [requiredTables]);

    const existingTables = result.rows.map(r => r.tablename);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    console.log('');
    console.log('Tables created:');
    existingTables.forEach(t => log.success(`  ${t}`));

    if (missingTables.length > 0) {
      console.log('');
      console.log('Tables missing:');
      missingTables.forEach(t => log.error(`  ${t}`));
      return false;
    }

    console.log('');
    log.success(`All ${requiredTables.length} required tables exist!`);
    return true;
  } catch (error) {
    log.error(`Schema verification failed: ${error.message}`);
    return false;
  }
}

async function getDatabaseStats() {
  log.section('Database Statistics');

  try {
    const result = await pool.query(`
      SELECT
        tablename,
        n_tup_ins - n_tup_del AS row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    console.log('Table statistics:');
    result.rows.forEach(row => {
      console.log(`  ${row.tablename}: ${row.row_count} rows`);
    });

    // Try to get message partition stats
    try {
      const partitions = await pool.query(`
        SELECT
          c.relname AS partition_name,
          COALESCE(s.n_tup_ins - s.n_tup_del, 0) AS row_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relname = c.relname
        WHERE c.relname LIKE 'messages_20%'
          AND n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY c.relname;
      `);

      if (partitions.rows.length > 0) {
        console.log('\nMessage partitions:');
        partitions.rows.forEach(row => {
          console.log(`  ${row.partition_name}: ${row.row_count} rows`);
        });
      }
    } catch (error) {
      log.warning('Could not retrieve partition stats (table may not exist yet)');
    }

    log.success('Statistics retrieved');
  } catch (error) {
    log.error(`Failed to get statistics: ${error.message}`);
  }
}

async function main() {
  console.log(`\n${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}Phase 0.8 Schema Migration (Direct Connection)${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);

  try {
    // Step 1: Test connection
    if (!await testConnection()) {
      log.error('Cannot proceed without database connection');
      await pool.end();
      process.exit(1);
    }

    // Step 2: Apply migrations
    const success = await applyMigrations();

    if (!success) {
      log.error('Migration failed');
      await pool.end();
      process.exit(1);
    }

    // Step 3: Verify schema
    await verifySchema();

    // Step 4: Get statistics
    await getDatabaseStats();

    // Final summary
    console.log(`\n${colors.blue}${'='.repeat(70)}${colors.reset}`);
    log.success('Phase 0.8 Schema Migration Complete!');
    console.log('');
    log.info('Next steps:');
    console.log('  1. Run: node scripts/test-phase-08-schema.js (after setting USE_LEGACY_SUPABASE=false)');
    console.log('  2. Begin Phase 0.9 (Query Pattern Library)');
    console.log('  3. Start data migration from Supabase');
    console.log('');

    await pool.end();
    process.exit(0);
  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main();
}
