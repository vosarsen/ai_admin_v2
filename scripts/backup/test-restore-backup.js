#!/usr/bin/env node

/**
 * PostgreSQL Backup Restoration Test Script
 * Phase 3 - Task 4.2: Baileys PostgreSQL Resilience Improvements
 *
 * Purpose:
 * - Tests backup restoration integrity
 * - Verifies all data can be recovered
 * - Measures RTO (Recovery Time Objective)
 * - Reports results to Sentry and Telegram
 *
 * Usage:
 *   node scripts/backup/test-restore-backup.js                    # Test latest backup
 *   node scripts/backup/test-restore-backup.js --backup <file>    # Test specific backup
 *   node scripts/backup/test-restore-backup.js --dry-run          # Show what would be done
 *   node scripts/backup/test-restore-backup.js --verbose          # Detailed output
 *
 * Safety:
 * - Uses separate test schema (test_restore_*) - never touches production data
 * - Automatically cleans up after test
 * - Can be run on production server safely
 *
 * Schedule:
 * - Manual: After major changes or monthly verification
 * - Automated: PM2 cron monthly (1st of month, 04:00 UTC)
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const Sentry = require('@sentry/node');
const logger = require('../../src/utils/logger');
const telegramNotifier = require('../../src/services/telegram-notifier');

const execAsync = promisify(exec);

// ====================================================================================
// Configuration
// ====================================================================================

const CONFIG = {
  // Database connection (from environment)
  DB_HOST: process.env.POSTGRES_HOST || 'a84c973324fdaccfc68d929d.twc1.net',
  DB_PORT: process.env.POSTGRES_PORT || '5432',
  DB_NAME: process.env.POSTGRES_DATABASE || 'default_db',
  DB_USER: process.env.POSTGRES_USER || 'gen_user',
  DB_PASSWORD: process.env.POSTGRES_PASSWORD,

  // Backup paths
  BACKUP_ROOT: process.env.BACKUP_ROOT || '/var/backups/postgresql',
  DAILY_DIR: 'daily',
  MONTHLY_DIR: 'monthly',

  // Test schema prefix (ensures no collision with production)
  TEST_SCHEMA: 'test_restore',

  // Expected tables to verify
  EXPECTED_TABLES: ['whatsapp_auth', 'whatsapp_keys'],

  // CLI flags
  DRY_RUN: process.argv.includes('--dry-run'),
  VERBOSE: process.argv.includes('--verbose'),
  BACKUP_FILE: getArgValue('--backup'),
};

/**
 * Get CLI argument value
 */
function getArgValue(arg) {
  const index = process.argv.indexOf(arg);
  if (index > -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return null;
}

// ====================================================================================
// Utility Functions
// ====================================================================================

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}m ${secs}s`;
}

/**
 * Get PostgreSQL connection string
 */
function getConnectionString(database = CONFIG.DB_NAME) {
  const encodedPassword = encodeURIComponent(CONFIG.DB_PASSWORD);
  return `postgresql://${CONFIG.DB_USER}:${encodedPassword}@${CONFIG.DB_HOST}:${CONFIG.DB_PORT}/${database}?sslmode=require`;
}

/**
 * Execute psql command
 */
async function psql(command, options = {}) {
  const connStr = getConnectionString(options.database);
  const psqlCmd = `psql "${connStr}" -t -A -c "${command.replace(/"/g, '\\"')}"`;

  if (CONFIG.VERBOSE) {
    const maskedCmd = psqlCmd.replace(encodeURIComponent(CONFIG.DB_PASSWORD), '****');
    logger.debug(`📝 psql: ${maskedCmd}`);
  }

  try {
    const { stdout, stderr } = await execAsync(psqlCmd, {
      shell: '/bin/bash',
      timeout: 60000
    });
    return stdout.trim();
  } catch (error) {
    if (options.ignoreErrors) {
      return null;
    }
    throw error;
  }
}

// ====================================================================================
// Backup Discovery
// ====================================================================================

/**
 * Find the latest backup file
 */
async function findLatestBackup() {
  const dailyDir = path.join(CONFIG.BACKUP_ROOT, CONFIG.DAILY_DIR);

  try {
    const files = await fs.readdir(dailyDir);
    const backups = files
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz'))
      .sort()
      .reverse();

    if (backups.length === 0) {
      throw new Error('No backup files found');
    }

    const latestBackup = path.join(dailyDir, backups[0]);
    const stats = await fs.stat(latestBackup);

    logger.info(`📦 Latest backup: ${backups[0]} (${formatBytes(stats.size)})`);
    return {
      path: latestBackup,
      name: backups[0],
      size: stats.size,
      mtime: stats.mtime
    };
  } catch (error) {
    logger.error(`❌ Failed to find backup: ${error.message}`);
    throw error;
  }
}

/**
 * Get specific backup file
 */
async function getBackupFile(filePath) {
  try {
    // If just filename, look in daily dir
    if (!filePath.includes('/')) {
      filePath = path.join(CONFIG.BACKUP_ROOT, CONFIG.DAILY_DIR, filePath);
    }

    const stats = await fs.stat(filePath);
    logger.info(`📦 Selected backup: ${path.basename(filePath)} (${formatBytes(stats.size)})`);

    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      mtime: stats.mtime
    };
  } catch (error) {
    logger.error(`❌ Backup file not found: ${filePath}`);
    throw error;
  }
}

// ====================================================================================
// Production Data Verification
// ====================================================================================

/**
 * Get current production row counts for comparison
 */
async function getProductionCounts() {
  logger.info('📊 Getting production data counts...');

  const counts = {};
  for (const table of CONFIG.EXPECTED_TABLES) {
    try {
      const result = await psql(`SELECT COUNT(*) FROM ${table}`);
      counts[table] = parseInt(result) || 0;
      logger.info(`   • ${table}: ${counts[table]} records`);
    } catch (error) {
      logger.warn(`   ⚠️  Could not count ${table}: ${error.message}`);
      counts[table] = null;
    }
  }

  return counts;
}

// ====================================================================================
// Restoration Testing
// ====================================================================================

/**
 * Create test schema for restoration
 */
async function createTestSchema() {
  logger.info(`🔧 Creating test schema: ${CONFIG.TEST_SCHEMA}`);

  if (CONFIG.DRY_RUN) {
    logger.info('🧪 DRY RUN: Would create test schema');
    return;
  }

  await psql(`DROP SCHEMA IF EXISTS ${CONFIG.TEST_SCHEMA} CASCADE`);
  await psql(`CREATE SCHEMA ${CONFIG.TEST_SCHEMA}`);
  logger.info(`✅ Test schema created`);
}

/**
 * Restore backup to test schema
 */
async function restoreToTestSchema(backup) {
  logger.info(`🔄 Restoring backup to test schema...`);

  if (CONFIG.DRY_RUN) {
    logger.info('🧪 DRY RUN: Would restore backup');
    return { duration: 0, dryRun: true };
  }

  const startTime = Date.now();
  const connStr = getConnectionString();

  // Create sed script to modify backup for test schema
  // We need to:
  // 1. Skip DROP/CREATE DATABASE commands
  // 2. Replace 'public.' with 'test_restore.'
  // 3. Set search_path to test_restore
  const restoreCmd = `
    gunzip -c "${backup.path}" | \\
    sed -e '/DROP DATABASE/d' \\
        -e '/CREATE DATABASE/d' \\
        -e '/\\\\connect/d' \\
        -e 's/public\\./${CONFIG.TEST_SCHEMA}./g' \\
        -e "s/search_path = ''/search_path = '${CONFIG.TEST_SCHEMA}'/g" | \\
    psql "${connStr}" 2>&1
  `;

  try {
    const { stdout, stderr } = await execAsync(restoreCmd, {
      shell: '/bin/bash',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      timeout: 300000 // 5 minutes
    });

    const duration = (Date.now() - startTime) / 1000;

    if (CONFIG.VERBOSE) {
      logger.debug(`Restore output: ${stdout.substring(0, 500)}`);
    }

    logger.info(`✅ Backup restored in ${formatDuration(duration)}`);
    return { duration };

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    logger.error(`❌ Restore failed after ${formatDuration(duration)}: ${error.message}`);
    throw error;
  }
}

/**
 * Verify restored data matches expected counts
 */
async function verifyRestoredData(productionCounts) {
  logger.info('🔍 Verifying restored data...');

  if (CONFIG.DRY_RUN) {
    logger.info('🧪 DRY RUN: Would verify data');
    return { verified: true, dryRun: true, counts: {} };
  }

  const restoredCounts = {};
  const issues = [];

  for (const table of CONFIG.EXPECTED_TABLES) {
    try {
      const result = await psql(`SELECT COUNT(*) FROM ${CONFIG.TEST_SCHEMA}.${table}`);
      const count = parseInt(result) || 0;
      restoredCounts[table] = count;

      const expected = productionCounts[table];
      const match = expected === null || count === expected;
      const status = match ? '✅' : '❌';

      logger.info(`   ${status} ${table}: ${count} records (expected: ${expected ?? 'unknown'})`);

      if (!match && expected !== null) {
        // Allow small discrepancy due to timing
        const diff = Math.abs(count - expected);
        const tolerance = Math.max(10, expected * 0.01); // 1% or 10 records

        if (diff > tolerance) {
          issues.push({
            table,
            expected,
            actual: count,
            difference: diff
          });
        } else {
          logger.info(`      ℹ️  Difference ${diff} within tolerance`);
        }
      }
    } catch (error) {
      logger.error(`   ❌ Failed to verify ${table}: ${error.message}`);
      issues.push({
        table,
        error: error.message
      });
    }
  }

  // Check for data integrity in whatsapp_auth
  try {
    const authCheck = await psql(
      `SELECT company_id, created_at IS NOT NULL as has_created, updated_at IS NOT NULL as has_updated
       FROM ${CONFIG.TEST_SCHEMA}.whatsapp_auth LIMIT 1`
    );
    if (authCheck) {
      logger.info(`   ✅ whatsapp_auth structure verified`);
    }
  } catch (error) {
    logger.warn(`   ⚠️  Could not verify whatsapp_auth structure`);
  }

  return {
    verified: issues.length === 0,
    counts: restoredCounts,
    issues
  };
}

/**
 * Clean up test schema
 */
async function cleanupTestSchema() {
  logger.info(`🧹 Cleaning up test schema...`);

  if (CONFIG.DRY_RUN) {
    logger.info('🧪 DRY RUN: Would drop test schema');
    return;
  }

  try {
    await psql(`DROP SCHEMA IF EXISTS ${CONFIG.TEST_SCHEMA} CASCADE`);
    logger.info(`✅ Test schema cleaned up`);
  } catch (error) {
    logger.warn(`⚠️  Cleanup failed: ${error.message}`);
  }
}

// ====================================================================================
// Reporting
// ====================================================================================

/**
 * Send test results to Telegram
 */
async function sendReport(result) {
  if (CONFIG.DRY_RUN) {
    logger.info('🧪 DRY RUN: Would send Telegram report');
    return;
  }

  const { backup, productionCounts, verification, rtoSeconds, success } = result;
  const icon = success ? '✅' : '❌';

  const message = `
${icon} <b>Backup Restoration Test ${success ? 'PASSED' : 'FAILED'}</b>

📦 <b>Backup Tested:</b>
• File: ${backup.name}
• Size: ${formatBytes(backup.size)}
• Age: ${Math.round((Date.now() - backup.mtime) / (1000 * 60 * 60))} hours

📊 <b>Data Verification:</b>
${CONFIG.EXPECTED_TABLES.map(t => {
  const prod = productionCounts[t];
  const rest = verification.counts[t];
  const match = prod === null || prod === rest;
  return `• ${t}: ${rest ?? '?'}/${prod ?? '?'} ${match ? '✅' : '❌'}`;
}).join('\n')}

⏱️ <b>Recovery Metrics:</b>
• RTO (actual): ${formatDuration(rtoSeconds)}
• RTO (target): <30 minutes
• Status: ${rtoSeconds < 1800 ? '✅ Within target' : '⚠️ Exceeded target'}

${verification.issues.length > 0 ? `
⚠️ <b>Issues Found:</b>
${verification.issues.map(i => `• ${i.table}: ${i.error || `diff ${i.difference}`}`).join('\n')}
` : ''}
`.trim();

  try {
    await telegramNotifier.send(message, { parseMode: 'HTML' });
    logger.info('✅ Test report sent to Telegram');
  } catch (error) {
    logger.error(`⚠️  Failed to send Telegram report: ${error.message}`);
  }
}

/**
 * Log results to Sentry
 */
function logToSentry(result) {
  if (CONFIG.DRY_RUN) return;

  const { backup, verification, rtoSeconds, success } = result;

  Sentry.captureMessage(`Backup restoration test ${success ? 'passed' : 'failed'}`, {
    level: success ? 'info' : 'error',
    tags: {
      component: 'postgresql_backup',
      operation: 'restoration_test',
      result: success ? 'passed' : 'failed'
    },
    extra: {
      backup: {
        name: backup.name,
        size: backup.size,
        age_hours: Math.round((Date.now() - backup.mtime) / (1000 * 60 * 60))
      },
      verification: {
        verified: verification.verified,
        counts: verification.counts,
        issues: verification.issues
      },
      metrics: {
        rto_seconds: rtoSeconds,
        rto_target_seconds: 1800
      }
    }
  });
}

// ====================================================================================
// Main Execution
// ====================================================================================

async function main() {
  const totalStartTime = Date.now();
  let backup = null;
  let success = false;

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🧪 PostgreSQL Backup Restoration Test');
  logger.info(`📅 Date: ${new Date().toISOString()}`);
  logger.info(`🎯 Mode: ${CONFIG.DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Step 1: Find backup to test
    backup = CONFIG.BACKUP_FILE
      ? await getBackupFile(CONFIG.BACKUP_FILE)
      : await findLatestBackup();

    // Step 2: Get production counts for comparison
    const productionCounts = await getProductionCounts();

    // Step 3: Create test schema
    await createTestSchema();

    // Step 4: Restore backup (this is the RTO measurement)
    const restoreStartTime = Date.now();
    await restoreToTestSchema(backup);
    const rtoSeconds = (Date.now() - restoreStartTime) / 1000;

    logger.info(`⏱️  RTO: ${formatDuration(rtoSeconds)} (target: <30 min)`);

    // Step 5: Verify data
    const verification = await verifyRestoredData(productionCounts);

    // Step 6: Cleanup
    await cleanupTestSchema();

    // Step 7: Report results
    success = verification.verified || CONFIG.DRY_RUN;

    const result = {
      backup,
      productionCounts,
      verification,
      rtoSeconds,
      success
    };

    await sendReport(result);
    logToSentry(result);

    // Final summary
    const totalDuration = (Date.now() - totalStartTime) / 1000;
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`${success ? '✅' : '❌'} Restoration Test ${success ? 'PASSED' : 'FAILED'}`);
    logger.info(`📦 Backup: ${backup.name}`);
    logger.info(`⏱️  RTO: ${formatDuration(rtoSeconds)}`);
    logger.info(`📊 Data: ${verification.verified ? 'Verified' : 'Issues found'}`);
    logger.info(`⏱️  Total: ${formatDuration(totalDuration)}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(success ? 0 : 1);

  } catch (error) {
    const totalDuration = (Date.now() - totalStartTime) / 1000;

    // Ensure cleanup on error
    try {
      await cleanupTestSchema();
    } catch (cleanupError) {
      logger.warn(`⚠️  Cleanup during error handling failed: ${cleanupError.message}`);
    }

    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.error('❌ Restoration Test FAILED');
    logger.error(`💥 Error: ${error.message}`);
    logger.error(`⏱️  Duration: ${formatDuration(totalDuration)}`);
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Log to Sentry
    Sentry.captureException(error, {
      level: 'error',
      tags: {
        component: 'postgresql_backup',
        operation: 'restoration_test'
      },
      extra: {
        backup: backup ? {
          name: backup.name,
          size: backup.size
        } : null,
        duration: totalDuration
      }
    });

    // Send error notification
    try {
      await telegramNotifier.send(
        `❌ <b>Backup Restoration Test FAILED</b>\n\n` +
        `Backup: ${backup?.name || 'unknown'}\n` +
        `Error: ${error.message}\n` +
        `Duration: ${formatDuration(totalDuration)}`,
        { parseMode: 'HTML' }
      );
    } catch (notifError) {
      logger.error(`⚠️  Failed to send error notification: ${notifError.message}`);
    }

    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };
