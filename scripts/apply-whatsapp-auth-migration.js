#!/usr/bin/env node

/**
 * Apply WhatsApp Auth State migration to Supabase
 * Creates tables: whatsapp_auth, whatsapp_keys
 */

const fs = require('fs-extra');
const path = require('path');
const { supabase } = require('../src/database/supabase');
const logger = require('../src/utils/logger');

async function applyMigration() {
  try {
    logger.info('🚀 Starting WhatsApp Auth State migration...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/20251007_create_whatsapp_auth_tables.sql');
    const sql = await fs.readFile(migrationPath, 'utf-8');

    logger.info('📄 Migration file loaded');

    // Note: Supabase JS client doesn't support executing raw SQL directly
    // We need to use the Supabase Dashboard SQL Editor or PostgREST RPC

    logger.info('\n⚠️  IMPORTANT: This migration needs to be applied via Supabase Dashboard\n');
    logger.info('Follow these steps:');
    logger.info('1. Open Supabase Dashboard: https://app.supabase.com');
    logger.info('2. Select your project');
    logger.info('3. Go to SQL Editor');
    logger.info('4. Copy and paste the SQL from:');
    logger.info(`   ${migrationPath}`);
    logger.info('5. Click "Run" to execute the migration\n');

    logger.info('Alternatively, you can use Supabase CLI:');
    logger.info(`   supabase db execute --file ${migrationPath}\n`);

    // Show migration preview
    logger.info('Migration preview:');
    logger.info('─'.repeat(80));
    const preview = sql.split('\n').slice(0, 30).join('\n');
    console.log(preview);
    logger.info('...');
    logger.info('─'.repeat(80));

    // Verify if tables already exist
    logger.info('\n🔍 Checking if tables already exist...');

    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', ['whatsapp_auth', 'whatsapp_keys']);

    if (!error && tables && tables.length > 0) {
      logger.info('✅ Found existing tables:', tables.map(t => t.table_name).join(', '));
      logger.info('⚠️  Migration may have already been applied');
    } else {
      logger.info('❌ Tables not found - migration needs to be applied');
    }

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  applyMigration();
}

module.exports = { applyMigration };
