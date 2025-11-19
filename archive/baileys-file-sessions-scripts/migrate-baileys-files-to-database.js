#!/usr/bin/env node

/**
 * Migrate Baileys auth state from files to database
 *
 * Usage:
 *   node scripts/migrate-baileys-files-to-database.js [companyId]
 *   node scripts/migrate-baileys-files-to-database.js 962302
 *   node scripts/migrate-baileys-files-to-database.js all  # Migrate all companies
 */

const fs = require('fs-extra');
const path = require('path');
const { supabase } = require('../src/database/supabase');
const logger = require('../src/utils/logger');

// Configuration
const SESSIONS_DIR = process.env.BAILEYS_SESSIONS_DIR || '/opt/ai-admin/baileys_sessions';
const BACKUP_DIR = process.env.BAILEYS_BACKUP_DIR || '/opt/ai-admin/baileys_sessions_backup';
const LID_MAPPING_TTL_DAYS = 7;

/**
 * Migrate auth state for a single company
 */
async function migrateCompany(companyId) {
  const sessionDir = path.join(SESSIONS_DIR, `company_${companyId}`);

  logger.info(`\n${'='.repeat(80)}`);
  logger.info(`🔄 Migrating company ${companyId}...`);
  logger.info(`${'='.repeat(80)}`);

  // Check if session directory exists
  if (!await fs.pathExists(sessionDir)) {
    logger.warn(`⚠️  Session directory not found: ${sessionDir}`);
    return { success: false, reason: 'directory_not_found' };
  }

  try {
    // ========================================================================
    // 1. Create backup
    // ========================================================================

    logger.info(`📦 Creating backup...`);
    const backupDir = path.join(BACKUP_DIR, `company_${companyId}`);
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup_${backupTimestamp}`);

    await fs.ensureDir(backupDir);
    await fs.copy(sessionDir, backupPath);

    logger.info(`✅ Backup created: ${backupPath}`);

    // ========================================================================
    // 2. Migrate creds.json
    // ========================================================================

    logger.info(`📝 Migrating credentials...`);

    const credsPath = path.join(sessionDir, 'creds.json');

    if (await fs.pathExists(credsPath)) {
      const creds = await fs.readJson(credsPath);

      const { error: credsError } = await supabase
        .from('whatsapp_auth')
        .upsert({
          company_id: companyId,
          creds: creds,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'company_id'
        });

      if (credsError) {
        logger.error(`❌ Failed to migrate credentials:`, credsError);
        throw credsError;
      }

      logger.info(`✅ Credentials migrated`);
    } else {
      logger.warn(`⚠️  creds.json not found - skipping`);
    }

    // ========================================================================
    // 3. Migrate all keys (app-state-sync, lid-mapping, etc.)
    // ========================================================================

    logger.info(`🔑 Migrating keys...`);

    const files = await fs.readdir(sessionDir);
    const keyRecords = [];
    let skippedOldLidMappings = 0;

    for (const file of files) {
      // Skip creds.json (already migrated)
      if (file === 'creds.json') continue;

      // Skip backup files
      if (file.includes('.backup.')) continue;

      // Parse filename: <key_type>-<key_id>.json
      const match = file.match(/^(.+?)-(.+)\.json$/);
      if (!match) {
        logger.debug(`⏭️  Skipping non-key file: ${file}`);
        continue;
      }

      const [, keyType, keyId] = match;
      const filePath = path.join(sessionDir, file);

      try {
        const value = await fs.readJson(filePath);
        const stats = await fs.stat(filePath);

        const record = {
          company_id: companyId,
          key_type: keyType,
          key_id: keyId,
          value: value,
          created_at: stats.birthtime.toISOString(),
          updated_at: stats.mtime.toISOString()
        };

        // Handle TTL for lid-mapping files
        if (keyType.includes('lid-mapping')) {
          const fileAge = Date.now() - stats.mtimeMs;
          const daysOld = fileAge / (1000 * 60 * 60 * 24);

          if (daysOld < LID_MAPPING_TTL_DAYS) {
            // Keep this lid-mapping with TTL
            const expiryDate = new Date(stats.mtime);
            expiryDate.setDate(expiryDate.getDate() + LID_MAPPING_TTL_DAYS);
            record.expires_at = expiryDate.toISOString();
            keyRecords.push(record);
          } else {
            // Skip old lid-mappings (will be recreated if needed)
            skippedOldLidMappings++;
          }
        } else {
          // Keep all non-lid-mapping keys
          keyRecords.push(record);
        }
      } catch (err) {
        logger.warn(`⚠️  Failed to read ${file}:`, err.message);
      }
    }

    logger.info(`📊 Found ${keyRecords.length} keys to migrate (skipped ${skippedOldLidMappings} old lid-mappings)`);

    // Migrate keys in batches
    const BATCH_SIZE = 100;
    let migratedCount = 0;

    for (let i = 0; i < keyRecords.length; i += BATCH_SIZE) {
      const batch = keyRecords.slice(i, i + BATCH_SIZE);

      const { error: keysError } = await supabase
        .from('whatsapp_keys')
        .upsert(batch, {
          onConflict: 'company_id,key_type,key_id'
        });

      if (keysError) {
        logger.error(`❌ Failed to migrate batch ${i}-${i + batch.length}:`, keysError);
        throw keysError;
      }

      migratedCount += batch.length;
      logger.info(`   Migrated ${migratedCount}/${keyRecords.length} keys...`);
    }

    logger.info(`✅ All keys migrated`);

    // ========================================================================
    // 4. Verify migration
    // ========================================================================

    logger.info(`🔍 Verifying migration...`);

    // Check credentials
    const { data: authData, error: authCheckError } = await supabase
      .from('whatsapp_auth')
      .select('company_id')
      .eq('company_id', companyId)
      .single();

    if (authCheckError || !authData) {
      logger.error(`❌ Verification failed: credentials not found in database`);
      return { success: false, reason: 'verification_failed' };
    }

    // Check keys count
    const { count: keysCount, error: keysCheckError } = await supabase
      .from('whatsapp_keys')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (keysCheckError) {
      logger.error(`❌ Verification failed: ${keysCheckError.message}`);
      return { success: false, reason: 'verification_failed' };
    }

    logger.info(`✅ Verification passed:`);
    logger.info(`   - Credentials: ✓`);
    logger.info(`   - Keys in database: ${keysCount}`);

    // ========================================================================
    // 5. Summary
    // ========================================================================

    logger.info(`\n${'='.repeat(80)}`);
    logger.info(`✅ Migration completed successfully for company ${companyId}`);
    logger.info(`${'='.repeat(80)}`);
    logger.info(`Summary:`);
    logger.info(`  - Backup: ${backupPath}`);
    logger.info(`  - Migrated keys: ${migratedCount}`);
    logger.info(`  - Skipped old lid-mappings: ${skippedOldLidMappings}`);
    logger.info(`  - Total keys in database: ${keysCount}`);
    logger.info(`\n⚠️  IMPORTANT: Do NOT delete session files yet!`);
    logger.info(`   Wait 7 days to ensure everything works correctly.`);
    logger.info(`\n💡 To enable database auth state:`);
    logger.info(`   Set USE_DATABASE_AUTH_STATE=true in .env`);
    logger.info(`   Then restart: pm2 restart ai-admin-worker-v2`);

    return { success: true, migratedKeys: migratedCount, skippedKeys: skippedOldLidMappings };

  } catch (error) {
    logger.error(`❌ Migration failed for company ${companyId}:`, error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Discover all companies in sessions directory
 */
async function discoverCompanies() {
  if (!await fs.pathExists(SESSIONS_DIR)) {
    logger.warn(`Sessions directory not found: ${SESSIONS_DIR}`);
    return [];
  }

  const dirs = await fs.readdir(SESSIONS_DIR);
  const companies = [];

  for (const dir of dirs) {
    if (dir.startsWith('company_')) {
      const companyId = dir.replace('company_', '');
      companies.push(companyId);
    }
  }

  return companies;
}

/**
 * Migrate all companies
 */
async function migrateAll() {
  logger.info(`🔍 Discovering companies...`);

  const companies = await discoverCompanies();

  if (companies.length === 0) {
    logger.warn(`No companies found in ${SESSIONS_DIR}`);
    return;
  }

  logger.info(`📦 Found ${companies.length} companies: ${companies.join(', ')}`);

  const results = [];

  for (const companyId of companies) {
    const result = await migrateCompany(companyId);
    results.push({ companyId, ...result });
  }

  // Print summary
  logger.info(`\n${'='.repeat(80)}`);
  logger.info(`📊 MIGRATION SUMMARY`);
  logger.info(`${'='.repeat(80)}`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  logger.info(`Total companies: ${results.length}`);
  logger.info(`✅ Successful: ${successful.length}`);
  logger.info(`❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    logger.warn(`\nFailed companies:`);
    failed.forEach(r => {
      logger.warn(`  - ${r.companyId}: ${r.reason}`);
    });
  }
}

// ============================================================================
// CLI
// ============================================================================

if (require.main === module) {
  const companyId = process.argv[2];

  (async () => {
    try {
      if (!companyId) {
        console.error('Usage: node migrate-baileys-files-to-database.js [companyId|all]');
        console.error('Example: node migrate-baileys-files-to-database.js 962302');
        console.error('Example: node migrate-baileys-files-to-database.js all');
        process.exit(1);
      }

      if (companyId === 'all') {
        await migrateAll();
      } else {
        await migrateCompany(companyId);
      }

      logger.info(`\n✅ Migration process completed!`);
      process.exit(0);

    } catch (error) {
      logger.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}

module.exports = { migrateCompany, migrateAll, discoverCompanies };
