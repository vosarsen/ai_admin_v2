#!/usr/bin/env node

/**
 * Automated WhatsApp Session Keys Cleanup Job
 * Phase 2 - Task 3.2: Baileys PostgreSQL Resilience Improvements
 *
 * Purpose:
 * - Deletes expired WhatsApp session keys (>30 days old) from Timeweb PostgreSQL
 * - Prevents database bloat and maintains optimal performance
 * - Logs activity to Sentry and sends daily summary via Telegram
 *
 * Schedule:
 * - Runs daily at 3 AM UTC via PM2 cron
 * - Can be triggered manually anytime
 *
 * Usage:
 *   node scripts/cleanup/cleanup-expired-session-keys.js              # Production run
 *   node scripts/cleanup/cleanup-expired-session-keys.js --dry-run    # Test mode (no deletion)
 *   node scripts/cleanup/cleanup-expired-session-keys.js --verbose    # Show deleted keys
 *
 * Safety:
 * - 30-day retention ensures no active sessions are deleted
 * - Dry-run mode for testing without database changes
 * - Comprehensive logging to Sentry and Telegram
 * - Database size tracking over time
 */

const postgres = require('../../src/database/postgres');
const logger = require('../../src/utils/logger');
const Sentry = require('@sentry/node');
const telegramNotifier = require('../../src/services/telegram-notifier');

// ====================================================================================
// Configuration
// ====================================================================================

const CONFIG = {
  RETENTION_DAYS: parseInt(process.env.DB_CLEANUP_RETENTION_DAYS) || 30,  // From env or default 30 days
  RETENTION_INTERVAL: `${parseInt(process.env.DB_CLEANUP_RETENTION_DAYS) || 30} days`,  // PostgreSQL interval syntax
  DRY_RUN: process.argv.includes('--dry-run'),
  VERBOSE: process.argv.includes('--verbose'),
};

// ====================================================================================
// Database Size Tracking
// ====================================================================================

/**
 * Get current database size for whatsapp_keys table
 * @returns {Promise<object>} Size metrics
 */
async function getDatabaseSizeMetrics() {
  try {
    // Get table size
    const sizeQuery = `
      SELECT
        pg_size_pretty(pg_total_relation_size('whatsapp_keys')) as total_size,
        pg_total_relation_size('whatsapp_keys') as total_size_bytes,
        pg_size_pretty(pg_relation_size('whatsapp_keys')) as table_size,
        pg_relation_size('whatsapp_keys') as table_size_bytes,
        pg_size_pretty(pg_indexes_size('whatsapp_keys')) as indexes_size,
        pg_indexes_size('whatsapp_keys') as indexes_size_bytes
      FROM pg_class
      WHERE relname = 'whatsapp_keys'
    `;

    const sizeResult = await postgres.query(sizeQuery);

    // Get row counts
    const countQuery = `
      SELECT
        COUNT(*) as total_keys,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days') as keys_last_7d,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days') as keys_last_30d,
        COUNT(*) FILTER (WHERE updated_at <= NOW() - INTERVAL '30 days') as expired_keys
      FROM whatsapp_keys
    `;

    const countResult = await postgres.query(countQuery);

    return {
      ...sizeResult.rows[0],
      ...countResult.rows[0]
    };
  } catch (error) {
    logger.error('Failed to get database size metrics:', error);
    Sentry.captureException(error, {
      tags: { component: 'cleanup', operation: 'get_metrics' }
    });
    throw error;
  }
}

// ====================================================================================
// Key Age Distribution Analysis
// ====================================================================================

/**
 * Get distribution of keys by age
 * @returns {Promise<object>} Age distribution metrics
 */
async function getKeyAgeDistribution() {
  try {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '1 day') as age_1d,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days' AND updated_at <= NOW() - INTERVAL '1 day') as age_7d,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '14 days' AND updated_at <= NOW() - INTERVAL '7 days') as age_14d,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days' AND updated_at <= NOW() - INTERVAL '14 days') as age_30d,
        COUNT(*) FILTER (WHERE updated_at <= NOW() - INTERVAL '30 days') as age_expired,
        MIN(updated_at) as oldest_key,
        MAX(updated_at) as newest_key
      FROM whatsapp_keys
    `;

    const result = await postgres.query(query);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get key age distribution:', error);
    return null;
  }
}

// ====================================================================================
// Cleanup Execution
// ====================================================================================

/**
 * Delete expired session keys (>30 days old)
 * @param {boolean} dryRun - If true, only count without deletion
 * @returns {Promise<object>} Cleanup results
 */
async function cleanupExpiredKeys(dryRun = false) {
  const startTime = Date.now();

  try {
    logger.info(`🧹 Starting cleanup job (${dryRun ? 'DRY RUN' : 'PRODUCTION'})`);

    // Get metrics BEFORE cleanup
    const beforeMetrics = await getDatabaseSizeMetrics();
    const ageDistribution = await getKeyAgeDistribution();

    logger.info('📊 Database state before cleanup:', {
      totalKeys: beforeMetrics.total_keys,
      expiredKeys: beforeMetrics.expired_keys,
      tableSize: beforeMetrics.total_size,
      indexesSize: beforeMetrics.indexes_size
    });

    // Execute cleanup (or simulate)
    let deletedKeys = [];
    let deletedCount = 0;

    if (dryRun) {
      // DRY RUN: Just count and optionally list keys
      const dryRunQuery = CONFIG.VERBOSE
        ? `
          SELECT company_id, key_id, updated_at
          FROM whatsapp_keys
          WHERE updated_at < NOW() - INTERVAL '${CONFIG.RETENTION_INTERVAL}'
          ORDER BY updated_at ASC
        `
        : `
          SELECT COUNT(*) as count
          FROM whatsapp_keys
          WHERE updated_at < NOW() - INTERVAL '${CONFIG.RETENTION_INTERVAL}'
        `;

      const result = await postgres.query(dryRunQuery);

      if (CONFIG.VERBOSE) {
        deletedKeys = result.rows;
        deletedCount = deletedKeys.length;
      } else {
        deletedCount = parseInt(result.rows[0].count);
      }

      logger.info(`🔍 DRY RUN: Would delete ${deletedCount} expired keys`);

      if (CONFIG.VERBOSE && deletedKeys.length > 0) {
        logger.info('📋 Keys that would be deleted:');
        deletedKeys.forEach(key => {
          const age = Math.floor((Date.now() - new Date(key.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          logger.info(`  - ${key.company_id}:${key.key_id} (${age} days old)`);
        });
      }
    } else {
      // PRODUCTION: Actually delete expired keys
      const deleteQuery = CONFIG.VERBOSE
        ? `
          DELETE FROM whatsapp_keys
          WHERE updated_at < NOW() - INTERVAL '${CONFIG.RETENTION_INTERVAL}'
          RETURNING company_id, key_id, updated_at
        `
        : `
          DELETE FROM whatsapp_keys
          WHERE updated_at < NOW() - INTERVAL '${CONFIG.RETENTION_INTERVAL}'
        `;

      const result = await postgres.query(deleteQuery);

      if (CONFIG.VERBOSE) {
        deletedKeys = result.rows;
        deletedCount = deletedKeys.length;
      } else {
        deletedCount = result.rowCount;
      }

      logger.info(`✅ Deleted ${deletedCount} expired keys`);

      if (CONFIG.VERBOSE && deletedKeys.length > 0) {
        logger.info('🗑️  Deleted keys:');
        deletedKeys.slice(0, 10).forEach(key => {
          const age = Math.floor((Date.now() - new Date(key.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          logger.info(`  - ${key.company_id}:${key.key_id} (${age} days old)`);
        });
        if (deletedKeys.length > 10) {
          logger.info(`  ... and ${deletedKeys.length - 10} more`);
        }
      }
    }

    // Get metrics AFTER cleanup
    const afterMetrics = dryRun ? beforeMetrics : await getDatabaseSizeMetrics();

    // Calculate space saved
    const spaceSavedBytes = beforeMetrics.total_size_bytes - afterMetrics.total_size_bytes;
    const spaceSavedMB = (spaceSavedBytes / (1024 * 1024)).toFixed(2);

    const duration = Date.now() - startTime;

    const results = {
      mode: dryRun ? 'DRY_RUN' : 'PRODUCTION',
      deletedCount,
      duration,
      before: {
        totalKeys: parseInt(beforeMetrics.total_keys),
        expiredKeys: parseInt(beforeMetrics.expired_keys),
        totalSize: beforeMetrics.total_size,
        totalSizeBytes: parseInt(beforeMetrics.total_size_bytes),
        tableSize: beforeMetrics.table_size,
        indexesSize: beforeMetrics.indexes_size
      },
      after: {
        totalKeys: parseInt(afterMetrics.total_keys),
        expiredKeys: parseInt(afterMetrics.expired_keys),
        totalSize: afterMetrics.total_size,
        totalSizeBytes: parseInt(afterMetrics.total_size_bytes),
        tableSize: afterMetrics.table_size,
        indexesSize: afterMetrics.indexes_size
      },
      spaceFreed: {
        bytes: spaceSavedBytes,
        mb: spaceSavedMB,
        pretty: spaceSavedBytes > 0 ? `${spaceSavedMB} MB` : '0 MB'
      },
      ageDistribution
    };

    logger.info('📊 Cleanup results:', results);

    return results;
  } catch (error) {
    logger.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// ====================================================================================
// Logging & Notifications
// ====================================================================================

/**
 * Send cleanup results to Sentry
 * @param {object} results - Cleanup results
 */
function logToSentry(results) {
  try {
    const level = results.mode === 'DRY_RUN' ? 'info' :
                  results.deletedCount > 1000 ? 'warning' : 'info';

    Sentry.captureMessage('WhatsApp session keys cleanup completed', {
      level,
      tags: {
        component: 'cleanup',
        operation: 'session_keys_cleanup',
        mode: results.mode
      },
      extra: {
        deletedCount: results.deletedCount,
        duration: `${results.duration}ms`,
        before: results.before,
        after: results.after,
        spaceFreed: results.spaceFreed.pretty,
        ageDistribution: results.ageDistribution
      }
    });

    logger.info('📤 Results logged to Sentry');
  } catch (error) {
    logger.error('Failed to log to Sentry:', error);
  }
}

/**
 * Send cleanup summary to Telegram
 * @param {object} results - Cleanup results
 */
async function sendTelegramNotification(results) {
  try {
    const emoji = results.mode === 'DRY_RUN' ? '🔍' :
                  results.deletedCount === 0 ? '✅' :
                  results.deletedCount > 1000 ? '⚠️' : '🧹';

    const mode = results.mode === 'DRY_RUN' ? ' (DRY RUN)' : '';

    const message = `
${emoji} <b>WhatsApp Keys Cleanup${mode}</b>

📊 <b>Results:</b>
• Deleted: <code>${results.deletedCount}</code> expired keys
• Duration: <code>${results.duration}ms</code>
• Space freed: <code>${results.spaceFreed.pretty}</code>

📈 <b>Database State:</b>
• Total keys: <code>${results.after.totalKeys}</code> (was ${results.before.totalKeys})
• Expired keys: <code>${results.after.expiredKeys}</code> (was ${results.before.expiredKeys})
• Total size: <code>${results.after.totalSize}</code> (was ${results.before.totalSize})

📅 <b>Age Distribution:</b>
• &lt;1 day: <code>${results.ageDistribution.age_1d || 0}</code>
• 1-7 days: <code>${results.ageDistribution.age_7d || 0}</code>
• 7-14 days: <code>${results.ageDistribution.age_14d || 0}</code>
• 14-30 days: <code>${results.ageDistribution.age_30d || 0}</code>
• &gt;30 days: <code>${results.ageDistribution.age_expired || 0}</code>

🕐 <b>Time:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'UTC' })} UTC
    `.trim();

    await telegramNotifier.send(message, { parseMode: 'HTML' });

    logger.info('📤 Summary sent to Telegram');
  } catch (error) {
    logger.error('Failed to send Telegram notification:', error);
  }
}

// ====================================================================================
// Main Execution
// ====================================================================================

/**
 * Main cleanup orchestrator
 */
async function main() {
  const startTime = Date.now();

  try {
    // Initialize Sentry for error tracking
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production'
    });

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🧹 WhatsApp Session Keys Cleanup Job');
    logger.info(`📅 Started: ${new Date().toISOString()}`);
    logger.info(`⚙️  Mode: ${CONFIG.DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
    logger.info(`📦 Retention: ${CONFIG.RETENTION_DAYS} days`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Execute cleanup
    const results = await cleanupExpiredKeys(CONFIG.DRY_RUN);

    // Log to Sentry
    logToSentry(results);

    // Send Telegram notification (only in production mode)
    if (!CONFIG.DRY_RUN) {
      await sendTelegramNotification(results);
    }

    const totalDuration = Date.now() - startTime;
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`✅ Cleanup job completed in ${totalDuration}ms`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Cleanup job failed:', error);

    // Log to Sentry
    Sentry.captureException(error, {
      tags: {
        component: 'cleanup',
        operation: 'session_keys_cleanup',
        fatal: true
      }
    });

    // Send error notification to Telegram
    await telegramNotifier.notifyError(error, {
      module: 'cleanup-expired-session-keys'
    });

    process.exit(1);
  }
}

// Run if executed directly (not imported)
if (require.main === module) {
  main();
}

module.exports = {
  cleanupExpiredKeys,
  getDatabaseSizeMetrics,
  getKeyAgeDistribution
};
