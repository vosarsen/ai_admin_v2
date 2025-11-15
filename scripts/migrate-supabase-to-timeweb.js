#!/usr/bin/env node

/**
 * Migration Script: Supabase → Timeweb PostgreSQL
 *
 * Purpose: Migrate Baileys WhatsApp sessions and other data from Supabase to Timeweb
 *
 * Usage:
 *   node scripts/migrate-supabase-to-timeweb.js [--dry-run] [--tables=table1,table2]
 *
 * Options:
 *   --dry-run          Don't actually write to Timeweb, just show what would be migrated
 *   --tables=X,Y,Z     Migrate only specific tables (default: all)
 *   --verify-only      Only verify data counts, don't migrate
 *
 * Requirements:
 *   - Supabase credentials in .env (SUPABASE_URL, SUPABASE_KEY)
 *   - Timeweb PostgreSQL credentials in .env (POSTGRES_* vars)
 *   - SSH tunnel to Timeweb PostgreSQL (if running locally)
 *
 * Critical Tables:
 *   1. whatsapp_auth - Baileys credentials (CRITICAL)
 *   2. whatsapp_keys - Baileys Signal Protocol keys (CRITICAL)
 *
 * Author: Claude Code
 * Date: 2025-11-06
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const readline = require('readline');

// =============================================================================
// Configuration
// =============================================================================

const TABLES_TO_MIGRATE = [
  'whatsapp_auth',  // CRITICAL: Baileys credentials
  'whatsapp_keys',  // CRITICAL: Baileys keys (335 records)
];

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerifyOnly = args.includes('--verify-only');
const tablesArg = args.find(arg => arg.startsWith('--tables='));
const tablesToProcess = tablesArg
  ? tablesArg.split('=')[1].split(',')
  : TABLES_TO_MIGRATE;

// =============================================================================
// Database Connections
// =============================================================================

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Timeweb PostgreSQL connection
const timewebConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433'),
  database: process.env.POSTGRES_DATABASE || 'default_db',
  user: process.env.POSTGRES_USER || 'gen_user',
  password: process.env.POSTGRES_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

if (!timewebConfig.password) {
  console.error('❌ ERROR: POSTGRES_PASSWORD must be set in .env');
  process.exit(1);
}

const timeweb = new Pool(timewebConfig);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Ask user for confirmation
 */
async function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(`${question} (yes/no): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Test Timeweb connection
 */
async function testTimewebConnection() {
  try {
    const result = await timeweb.query('SELECT NOW() as time, version() as version');
    return result.rows[0];
  } catch (error) {
    throw new Error(`Timeweb connection failed: ${error.message}`);
  }
}

/**
 * Get count from Supabase table
 */
async function getSupabaseCount(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count;
}

/**
 * Get count from Timeweb table
 */
async function getTimewebCount(tableName) {
  const result = await timeweb.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  return parseInt(result.rows[0].count);
}

// =============================================================================
// Migration Functions
// =============================================================================

/**
 * Migrate whatsapp_auth table (Baileys credentials)
 */
async function migrateWhatsappAuth() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Migrating: whatsapp_auth (Baileys credentials)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fetch from Supabase
  console.log('🔄 Fetching from Supabase...');
  const { data, error } = await supabase
    .from('whatsapp_auth')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch whatsapp_auth from Supabase: ${error.message}`);
  }

  console.log(`✅ Found ${data.length} record(s) in Supabase`);

  if (data.length === 0) {
    console.log('⚠️  No data to migrate');
    return { migrated: 0, skipped: 0 };
  }

  if (isDryRun) {
    console.log('\n🔍 DRY RUN - Would migrate:');
    data.forEach(record => {
      console.log(`   - company_id: ${record.company_id}`);
    });
    return { migrated: 0, skipped: data.length };
  }

  // Insert into Timeweb
  console.log('\n🔄 Inserting into Timeweb PostgreSQL...');
  let migrated = 0;

  for (const record of data) {
    try {
      await timeweb.query(
        `INSERT INTO whatsapp_auth (company_id, creds, created_at, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (company_id) DO UPDATE
         SET creds = EXCLUDED.creds, updated_at = EXCLUDED.updated_at`,
        [record.company_id, record.creds, record.created_at, record.updated_at]
      );
      console.log(`   ✅ Migrated company_id: ${record.company_id}`);
      migrated++;
    } catch (error) {
      console.error(`   ❌ Failed to migrate ${record.company_id}: ${error.message}`);
    }
  }

  console.log(`\n✅ whatsapp_auth migration complete: ${migrated}/${data.length} records`);
  return { migrated, skipped: data.length - migrated };
}

/**
 * Migrate whatsapp_keys table (Baileys keys)
 */
async function migrateWhatsappKeys() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Migrating: whatsapp_keys (Baileys keys)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fetch from Supabase (in batches for performance)
  console.log('🔄 Fetching from Supabase...');
  const batchSize = 100;
  let allData = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('whatsapp_keys')
      .select('*')
      .range(offset, offset + batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch whatsapp_keys from Supabase: ${error.message}`);
    }

    if (data.length === 0) break;

    allData = allData.concat(data);
    offset += batchSize;
    process.stdout.write(`\r   Fetched ${formatNumber(allData.length)} keys...`);
  }

  console.log(`\n✅ Found ${formatNumber(allData.length)} key(s) in Supabase`);

  if (allData.length === 0) {
    console.log('⚠️  No data to migrate');
    return { migrated: 0, skipped: 0 };
  }

  if (isDryRun) {
    console.log('\n🔍 DRY RUN - Would migrate:');
    const byType = allData.reduce((acc, record) => {
      acc[record.key_type] = (acc[record.key_type] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${formatNumber(count)} keys`);
    });
    return { migrated: 0, skipped: allData.length };
  }

  // Insert into Timeweb (in batches)
  console.log('\n🔄 Inserting into Timeweb PostgreSQL...');
  let migrated = 0;
  const totalKeys = allData.length;

  for (let i = 0; i < allData.length; i += batchSize) {
    const batch = allData.slice(i, i + batchSize);

    for (const record of batch) {
      try {
        await timeweb.query(
          `INSERT INTO whatsapp_keys (company_id, key_type, key_id, value, created_at, updated_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (company_id, key_type, key_id) DO UPDATE
           SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at`,
          [
            record.company_id,
            record.key_type,
            record.key_id,
            record.value,
            record.created_at,
            record.updated_at,
            record.expires_at
          ]
        );
        migrated++;
      } catch (error) {
        console.error(`\n   ❌ Failed to migrate key ${record.key_type}/${record.key_id}: ${error.message}`);
      }
    }

    // Progress update
    const progress = ((migrated / totalKeys) * 100).toFixed(1);
    process.stdout.write(`\r   Progress: ${formatNumber(migrated)}/${formatNumber(totalKeys)} (${progress}%)`);
  }

  console.log(`\n\n✅ whatsapp_keys migration complete: ${formatNumber(migrated)}/${formatNumber(totalKeys)} records`);
  return { migrated, skipped: totalKeys - migrated };
}

// =============================================================================
// Verification Functions
// =============================================================================

/**
 * Verify migrated data
 */
async function verifyMigration() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Verification: Comparing record counts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = [];

  for (const table of tablesToProcess) {
    try {
      const supabaseCount = await getSupabaseCount(table);
      const timewebCount = await getTimewebCount(table);
      const match = supabaseCount === timewebCount;

      results.push({
        table,
        supabase: supabaseCount,
        timeweb: timewebCount,
        match
      });

      const status = match ? '✅' : '❌';
      console.log(`${status} ${table}:`);
      console.log(`   Supabase: ${formatNumber(supabaseCount)}`);
      console.log(`   Timeweb:  ${formatNumber(timewebCount)}`);
      console.log(`   Status:   ${match ? 'MATCH' : 'MISMATCH'}\n`);
    } catch (error) {
      console.error(`❌ Failed to verify ${table}: ${error.message}\n`);
      results.push({
        table,
        supabase: null,
        timeweb: null,
        match: false,
        error: error.message
      });
    }
  }

  return results;
}

// =============================================================================
// Main Migration Flow
// =============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║   🔄  Supabase → Timeweb PostgreSQL Migration Script          ║');
  console.log('║                                                                ║');
  console.log('║   Purpose: Migrate Baileys WhatsApp sessions                  ║');
  console.log('║   Critical: whatsapp_auth, whatsapp_keys                      ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Show configuration
  console.log('📋 Configuration:');
  console.log(`   Mode: ${isDryRun ? '🔍 DRY RUN' : isVerifyOnly ? '🔍 VERIFY ONLY' : '✅ LIVE MIGRATION'}`);
  console.log(`   Tables: ${tablesToProcess.join(', ')}`);
  console.log(`   Supabase URL: ${supabaseUrl}`);
  console.log(`   Timeweb Host: ${timewebConfig.host}:${timewebConfig.port}`);
  console.log(`   Timeweb Database: ${timewebConfig.database}\n`);

  try {
    // Test connections
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔌 Testing database connections...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('1️⃣ Testing Supabase connection...');
    const { data: supabaseTest } = await supabase.from('whatsapp_auth').select('count', { count: 'exact', head: true });
    console.log('   ✅ Supabase connected\n');

    console.log('2️⃣ Testing Timeweb PostgreSQL connection...');
    const timewebTest = await testTimewebConnection();
    console.log('   ✅ Timeweb connected');
    console.log(`   Database: ${timewebConfig.database}`);
    console.log(`   Time: ${timewebTest.time}\n`);

    // If verify-only mode, just show counts and exit
    if (isVerifyOnly) {
      const verification = await verifyMigration();
      const allMatch = verification.every(r => r.match);

      if (allMatch) {
        console.log('✅ All tables verified successfully!');
        process.exit(0);
      } else {
        console.log('❌ Some tables have mismatches');
        process.exit(1);
      }
    }

    // Show pre-migration counts
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Pre-migration record counts:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const table of tablesToProcess) {
      const supabaseCount = await getSupabaseCount(table);
      const timewebCount = await getTimewebCount(table);
      console.log(`${table}:`);
      console.log(`   Supabase: ${formatNumber(supabaseCount)} records`);
      console.log(`   Timeweb:  ${formatNumber(timewebCount)} records\n`);
    }

    // Ask for confirmation unless dry-run
    if (!isDryRun) {
      console.log('⚠️  WARNING: This will write data to Timeweb PostgreSQL');
      console.log('⚠️  Existing records with same keys will be UPDATED\n');

      const confirmed = await askConfirmation('Do you want to proceed with migration?');

      if (!confirmed) {
        console.log('\n❌ Migration cancelled by user');
        process.exit(0);
      }
      console.log();
    }

    // Start migration
    const startTime = Date.now();
    const results = {};

    for (const table of tablesToProcess) {
      if (table === 'whatsapp_auth') {
        results.whatsapp_auth = await migrateWhatsappAuth();
      } else if (table === 'whatsapp_keys') {
        results.whatsapp_keys = await migrateWhatsappKeys();
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Show summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                ║');
    console.log('║   ✅  Migration Complete!                                      ║');
    console.log('║                                                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📊 Summary:');
    Object.entries(results).forEach(([table, stats]) => {
      console.log(`   ${table}:`);
      console.log(`     - Migrated: ${formatNumber(stats.migrated)} records`);
      if (stats.skipped > 0) {
        console.log(`     - Skipped:  ${formatNumber(stats.skipped)} records`);
      }
    });
    console.log(`\n⏱️  Duration: ${duration} seconds`);

    // Verify migration
    if (!isDryRun) {
      const verification = await verifyMigration();
      const allMatch = verification.every(r => r.match);

      if (allMatch) {
        console.log('✅ Verification: All record counts match!');
      } else {
        console.log('⚠️  Verification: Some mismatches found');
      }
    }

    console.log('\n📋 Next steps:');
    console.log('   1. Review migration results above');
    console.log('   2. Test application with Timeweb: USE_LEGACY_SUPABASE=false');
    console.log('   3. Verify WhatsApp sessions work correctly');
    console.log('   4. After 7 days of stability → switch production\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    // Close connections
    await timeweb.end();
    process.exit(0);
  }
}

// =============================================================================
// Run Migration
// =============================================================================

if (require.main === module) {
  main();
}

module.exports = { migrateWhatsappAuth, migrateWhatsappKeys, verifyMigration };
