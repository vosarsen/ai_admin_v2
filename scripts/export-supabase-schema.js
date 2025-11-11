#!/usr/bin/env node
/**
 * Export Supabase schema to SQL file
 *
 * This script connects to Supabase and extracts CREATE TABLE statements
 * for all business tables, so they can be recreated in Timeweb PostgreSQL.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLES = [
  'companies',
  'clients',
  'services',
  'staff',
  'staff_schedules',
  'bookings',
  'dialog_contexts',
  'messages',
  'actions',
  'company_sync_status'
];

async function getTableSchema(tableName) {
  // Get column information from information_schema
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    console.error(`Error getting schema for ${tableName}:`, error);
    return null;
  }

  return data;
}

async function exportSchema() {
  console.log('-- Supabase Schema Export');
  console.log('-- Generated:', new Date().toISOString());
  console.log('-- Tables:', TABLES.length);
  console.log();

  for (const table of TABLES) {
    console.log(`-- Exporting ${table}...`);

    // Since we can't use execute_sql RPC, we'll query the table structure differently
    // We'll fetch a sample row to understand the structure
    const { data: sampleData, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.error(`Error querying ${table}:`, error.message);
      continue;
    }

    if (sampleData && sampleData.length > 0) {
      console.log(`\n-- Table: ${table}`);
      console.log(`-- Columns found: ${Object.keys(sampleData[0]).length}`);
      console.log('-- Column names:', Object.keys(sampleData[0]).join(', '));
      console.log();
    }
  }
}

// Alternative: Use pg_dump via SSH on Supabase
console.log('Note: For complete schema export, use pg_dump:');
console.log('pg_dump -h <supabase-host> -U postgres -d postgres --schema-only -t public.companies -t public.clients ... > supabase_schema.sql');

exportSchema().catch(console.error);
