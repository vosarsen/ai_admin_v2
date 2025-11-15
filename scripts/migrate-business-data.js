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

  let allData = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Supabase fetch error: ${error.message}`);
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      console.log(`   Page ${page + 1}: ${data.length} records`);

      // If we got less than PAGE_SIZE, we're done
      hasMore = data.length === PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`   Total: ${allData.length} records`);
  return allData;
}

// JSONB column names per table (need explicit ::jsonb cast and JSON.stringify)
const JSONB_COLUMNS = {
  companies: ['raw_data', 'whatsapp_config', 'whatsapp_session_data'],
  clients: ['visit_history', 'preferences', 'ai_context', 'goods_purchases'],
  services: ['raw_data', 'declensions'],
  staff: ['raw_data', 'declensions'],
  bookings: [],
  staff_schedules: [],
  dialog_contexts: ['data', 'messages', 'context_metadata'],
  messages: ['metadata'],
  actions: ['action_data']
};

/**
 * Prepare record for PostgreSQL insertion
 * Serialize JSONB columns, keep arrays as-is for pg driver
 */
function prepareRecord(record, tableName) {
  const prepared = {};
  const jsonbCols = JSONB_COLUMNS[tableName] || [];

  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) {
      prepared[key] = null;
    }
    // JSONB columns: serialize objects/arrays to JSON string
    else if (jsonbCols.includes(key) && typeof value === 'object') {
      prepared[key] = JSON.stringify(value);
    }
    // All other values: pass through (pg driver handles arrays, primitives, etc.)
    else {
      prepared[key] = value;
    }
  }

  return prepared;
}

function buildUpsertQuery(tableName, records) {
  if (records.length === 0) return null;

  // Prepare records: serialize JSONB fields
  const preparedRecords = records.map(r => prepareRecord(r, tableName));

  const firstRecord = preparedRecords[0];
  const columns = Object.keys(firstRecord);
  const jsonbCols = JSONB_COLUMNS[tableName] || [];

  const valueRows = preparedRecords.map((_, recordIdx) => {
    const placeholders = columns.map((col, colIdx) => {
      const placeholder = `$${recordIdx * columns.length + colIdx + 1}`;
      // Add ::jsonb cast for JSONB columns
      return jsonbCols.includes(col) ? `${placeholder}::jsonb` : placeholder;
    });
    return `(${placeholders.join(', ')})`;
  });

  const updateSet = columns
    .filter(col => col !== 'id')
    .map(col => `${col} = EXCLUDED.${col}`)
    .join(', ');

  const values = preparedRecords.flatMap(record =>
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
    const BATCH_SIZE = 100;
    let totalInserted = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const upsert = buildUpsertQuery(tableName, batch);

      if (upsert) {
        try {
          // Each batch in its own transaction
          await client.query('BEGIN');
          const result = await client.query(upsert.query, upsert.values);
          await client.query('COMMIT');

          totalInserted += result.rowCount;
          console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.rowCount} records`);
        } catch (batchError) {
          // Rollback this batch
          await client.query('ROLLBACK');

          console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${batchError.message}`);
          console.error(`   First record ID: ${batch[0].id}`);

          // Try inserting records one by one to find the culprit
          for (const record of batch) {
            try {
              await client.query('BEGIN');
              const singleUpsert = buildUpsertQuery(tableName, [record]);
              await client.query(singleUpsert.query, singleUpsert.values);
              await client.query('COMMIT');
              totalInserted++;
            } catch (singleError) {
              await client.query('ROLLBACK');
              console.error(`   ❌ Record ${record.id} failed: ${singleError.message}`);
              // Log problematic fields
              for (const [key, value] of Object.entries(record)) {
                if (value !== null && typeof value === 'object') {
                  const valuePreview = JSON.stringify(value).substring(0, 100);
                  console.error(`      Field "${key}": ${typeof value} ${Array.isArray(value) ? '[array]' : '[object]'} = ${valuePreview}...`);
                }
              }
              // Don't throw - continue with next record
            }
          }
        }
      }
    }

    console.log(`   ✅ Inserted ${totalInserted} records`);

    return totalInserted;

  } catch (error) {
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
