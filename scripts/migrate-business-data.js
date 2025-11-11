#!/usr/bin/env node

/**
 * Business Data Migration: Supabase → Timeweb PostgreSQL
 * 
 * Phase 4 - Task 4.1: Data Migration Execution
 * 
 * Migrates all business data (companies, clients, services, etc.)
 * from Supabase to Timeweb PostgreSQL.
 * 
 * Run: node scripts/migrate-business-data.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

console.log('🚀 Business Data Migration: Supabase → Timeweb PostgreSQL\n');

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Timeweb PostgreSQL connection
const timewebPool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20
});

// Tables to migrate (order matters for foreign keys)
const TABLES = [
  'companies',
  'clients',
  'services',
  'staff',
  'staff_schedules',
  'bookings',
  'dialog_contexts'
];

const stats = {
  startTime: Date.now(),
  tables: {},
  totalRecords: 0,
  errors: []
};

async function fetchFromSupabase(tableName) {
  console.log(`\n📥 Fetching from Supabase: ${tableName}...`);
  
  const { data, error } = await supabase
    .from(tableName)
    .select('*');
  
  if (error) {
    throw new Error(`Supabase fetch error: ${error.message}`);
  }
  
  console.log(`   Found ${data.length} records`);
  return data;
}

function buildUpsertQuery(tableName, records) {
  if (records.length === 0) return null;
  
  const firstRecord = records[0];
  const columns = Object.keys(firstRecord);
  
  const valueRows = records.map((_, recordIdx) => {
    const placeholders = columns.map((_, colIdx) => {
      return `$${recordIdx * columns.length + colIdx + 1}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  
  const updateSet = columns
    .filter(col => col !== 'id')
    .map(col => `${col} = EXCLUDED.${col}`)
    .join(', ');
  
  const values = records.flatMap(record =>
    columns.map(col => record[col])
  );
  
  const query = `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES ${valueRows.join(', ')}
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
    RETURNING id
  `;
  
  return { query, values };
}

async function insertToTimeweb(tableName, records) {
  if (records.length === 0) {
    console.log(`   ⚠️  No records to insert`);
    return 0;
  }
  
  console.log(`\n📤 Inserting into Timeweb: ${tableName}...`);
  
  const client = await timewebPool.connect();
  
  try {
    await client.query('BEGIN');
    
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const upsert = buildUpsertQuery(tableName, batch);
      
      if (upsert) {
        const result = await client.query(upsert.query, upsert.values);
        totalInserted += result.rowCount;
        console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.rowCount} records`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`   ✅ Inserted ${totalInserted} records`);
    
    return totalInserted;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`   ❌ Insert failed: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

async function verifyTable(tableName) {
  console.log(`\n🔍 Verifying ${tableName}...`);
  
  const { count: supabaseCount, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    throw new Error(`Supabase count error: ${error.message}`);
  }
  
  const result = await timewebPool.query(`SELECT COUNT(*) FROM ${tableName}`);
  const timewebCount = parseInt(result.rows[0].count);
  
  const match = supabaseCount === timewebCount;
  
  console.log(`   Supabase: ${supabaseCount} | Timeweb: ${timewebCount} | ${match ? '✅' : '❌'}`);
  
  return { supabaseCount, timewebCount, match };
}

async function migrateTable(tableName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Migrating: ${tableName}`);
  console.log('='.repeat(60));
  
  const tableStart = Date.now();
  
  try {
    const records = await fetchFromSupabase(tableName);
    const inserted = await insertToTimeweb(tableName, records);
    const verification = await verifyTable(tableName);
    
    const duration = Date.now() - tableStart;
    stats.tables[tableName] = {
      fetched: records.length,
      inserted,
      verification,
      duration,
      success: verification.match
    };
    stats.totalRecords += inserted;
    
    console.log(`\n✅ ${tableName} migrated in ${(duration / 1000).toFixed(2)}s`);
    return true;
    
  } catch (error) {
    console.error(`\n❌ Failed: ${error.message}`);
    stats.errors.push({ table: tableName, error: error.message });
    return false;
  }
}

function printReport() {
  const totalDuration = Date.now() - stats.startTime;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 MIGRATION REPORT');
  console.log('='.repeat(60));
  
  console.log(`\nDuration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Total Records: ${stats.totalRecords}`);
  
  console.log(`\nTables:`);
  for (const [table, data] of Object.entries(stats.tables)) {
    const status = data.success ? '✅' : '❌';
    console.log(`  ${status} ${table}: ${data.inserted} records (${(data.duration / 1000).toFixed(2)}s)`);
  }
  
  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors: ${stats.errors.length}`);
    stats.errors.forEach(err => console.log(`  - ${err.table}: ${err.error}`));
  }
  
  console.log('\n' + '='.repeat(60));
}

async function migrate() {
  console.log(`Tables: ${TABLES.join(', ')}\n`);
  console.log('⚠️  WARNING: Will overwrite data in Timeweb!');
  console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('✅ Starting migration...');
  
  for (const table of TABLES) {
    await migrateTable(table);
  }
  
  printReport();
  await timewebPool.end();
  
  process.exit(stats.errors.length > 0 ? 1 : 0);
}

process.on('unhandledRejection', async (error) => {
  console.error('\n❌ Error:', error);
  await timewebPool.end();
  process.exit(1);
});

migrate().catch(async (error) => {
  console.error('\n❌ Failed:', error);
  await timewebPool.end();
  process.exit(1);
});
