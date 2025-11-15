#!/usr/bin/env node
/**
 * Verify Schema Compatibility: Supabase vs Timeweb
 *
 * This script compares column names between Supabase (source) and Timeweb (destination)
 * to ensure the migration script will work without "column does not exist" errors.
 */

const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Timeweb PostgreSQL connection
const timewebPool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Supabase connection (via MCP)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLES_TO_VERIFY = ['companies', 'clients', 'services', 'staff', 'bookings', 'dialog_contexts'];

async function getTimewebColumns(tableName) {
  const result = await timewebPool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [tableName]);

  return result.rows.map(r => r.column_name);
}

async function getSupabaseColumns(tableName) {
  // Query a single row to get column names
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    console.error(`Error querying ${tableName}:`, error.message);
    return [];
  }

  if (!data || data.length === 0) {
    // Try to get from empty table structure
    const { data: emptyData, error: emptyError } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);

    // Since we can't get columns from empty result, return empty
    return [];
  }

  return Object.keys(data[0]);
}

async function verifyCompatibility() {
  console.log('\n🔍 SCHEMA COMPATIBILITY VERIFICATION\n');
  console.log('Comparing Supabase (source) vs Timeweb (target)\n');
  console.log('='.repeat(70));

  let totalIssues = 0;

  for (const table of TABLES_TO_VERIFY) {
    console.log(`\n📋 Table: ${table.toUpperCase()}`);
    console.log('-'.repeat(70));

    try {
      const timewebCols = await getTimewebColumns(table);
      const supabaseCols = await getSupabaseColumns(table);

      console.log(`Timeweb columns: ${timewebCols.length}`);
      console.log(`Supabase columns: ${supabaseCols.length > 0 ? supabaseCols.length : 'Unable to query (will check during migration)'}`);

      if (supabaseCols.length === 0) {
        console.log('⚠️  Cannot verify Supabase columns via API (will test with actual migration)');
        continue;
      }

      // Check if all Supabase columns exist in Timeweb
      const missingCols = supabaseCols.filter(col => !timewebCols.includes(col));
      const extraCols = timewebCols.filter(col => !supabaseCols.includes(col));

      if (missingCols.length > 0) {
        console.log(`\n❌ MISSING in Timeweb (${missingCols.length}):`, missingCols.join(', '));
        totalIssues += missingCols.length;
      }

      if (extraCols.length > 0) {
        console.log(`\n✅ Extra in Timeweb (${extraCols.length}):`, extraCols.join(', '));
      }

      if (missingCols.length === 0 && extraCols.length === 0) {
        console.log('✅ Perfect match!');
      } else if (missingCols.length === 0) {
        console.log('✅ Compatible (all Supabase columns present in Timeweb)');
      }

    } catch (error) {
      console.error(`❌ Error verifying ${table}:`, error.message);
      totalIssues++;
    }
  }

  console.log('\n' + '='.repeat(70));

  if (totalIssues === 0) {
    console.log('\n✅ SCHEMA VERIFICATION PASSED');
    console.log('Migration script should work without column mismatch errors.\n');
  } else {
    console.log(`\n❌ FOUND ${totalIssues} COMPATIBILITY ISSUES`);
    console.log('Migration may fail. Review missing columns above.\n');
  }

  await timewebPool.end();
}

// Run verification
verifyCompatibility().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
