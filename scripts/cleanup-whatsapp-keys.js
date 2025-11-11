#!/usr/bin/env node
/**
 * Cleanup script for expired WhatsApp keys
 *
 * Removes expired keys from whatsapp_keys table to prevent accumulation.
 * Should be run periodically (e.g., every 6 hours via cron).
 *
 * Usage:
 *   node scripts/cleanup-whatsapp-keys.js           # Execute cleanup
 *   node scripts/cleanup-whatsapp-keys.js --dry-run # Preview what would be deleted
 */

require('dotenv').config();
const postgres = require('../src/database/postgres');
const Sentry = require('@sentry/node');
const logger = require('../src/utils/logger');

/**
 * Clean up expired WhatsApp keys
 * @param {boolean} dryRun - If true, only count expired keys without deleting
 */
async function cleanupExpiredKeys(dryRun = false) {
  const startTime = Date.now();

  try {
    logger.info('🧹 Starting WhatsApp keys cleanup...', { dryRun });

    // Count expired keys before deletion
    const countResult = await postgres.query(`
      SELECT COUNT(*) as count
      FROM whatsapp_keys
      WHERE expires_at < NOW()
    `);

    const expiredCount = parseInt(countResult.rows[0]?.count) || 0;

    if (expiredCount === 0) {
      logger.info('✅ No expired keys found - nothing to clean up');
      return {
        success: true,
        deleted: 0,
        duration: Date.now() - startTime,
        dryRun
      };
    }

    logger.info(`Found ${expiredCount} expired keys`);

    if (dryRun) {
      // Dry run - show what would be deleted
      const sampleResult = await postgres.query(`
        SELECT company_id, key_type, COUNT(*) as count
        FROM whatsapp_keys
        WHERE expires_at < NOW()
        GROUP BY company_id, key_type
        ORDER BY count DESC
        LIMIT 10
      `);

      logger.info('📊 Top expired keys by type (sample):');
      sampleResult.rows.forEach(row => {
        logger.info(`  - Company ${row.company_id}, Type ${row.key_type}: ${row.count} keys`);
      });

      logger.info(`[DRY RUN] Would delete ${expiredCount} expired keys`);

      return {
        success: true,
        deleted: 0,
        wouldDelete: expiredCount,
        duration: Date.now() - startTime,
        dryRun: true
      };
    }

    // Execute deletion
    const deleteResult = await postgres.query(`
      DELETE FROM whatsapp_keys
      WHERE expires_at < NOW()
    `);

    const deletedCount = deleteResult.rowCount || 0;
    const duration = Date.now() - startTime;

    logger.info(`✅ Cleanup completed: deleted ${deletedCount} expired keys in ${duration}ms`);

    // Log cleanup stats to Sentry (info level)
    Sentry.captureMessage('WhatsApp keys cleanup completed', {
      level: 'info',
      tags: {
        component: 'cleanup',
        operation: 'whatsapp_keys_cleanup'
      },
      extra: {
        deletedCount,
        duration,
        dryRun
      }
    });

    return {
      success: true,
      deleted: deletedCount,
      duration,
      dryRun: false
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('❌ Cleanup failed:', error);

    Sentry.captureException(error, {
      tags: {
        component: 'cleanup',
        operation: 'whatsapp_keys_cleanup'
      },
      extra: {
        duration,
        dryRun
      }
    });

    return {
      success: false,
      error: error.message,
      duration,
      dryRun
    };
  }
}

/**
 * Get cleanup statistics
 */
async function getCleanupStats() {
  try {
    const result = await postgres.query(`
      SELECT
        COUNT(*) as total_keys,
        COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_keys,
        COUNT(*) FILTER (WHERE expires_at >= NOW()) as active_keys,
        COUNT(DISTINCT company_id) as total_companies
      FROM whatsapp_keys
    `);

    return result.rows[0];
  } catch (error) {
    logger.error('Error getting cleanup stats:', error);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n🧹 WhatsApp Keys Cleanup Script\n');

  // Show current stats
  const statsBefore = await getCleanupStats();
  if (statsBefore) {
    console.log('📊 Current Statistics:');
    console.log(`  Total keys: ${statsBefore.total_keys}`);
    console.log(`  Active keys: ${statsBefore.active_keys}`);
    console.log(`  Expired keys: ${statsBefore.expired_keys}`);
    console.log(`  Companies: ${statsBefore.total_companies}`);
    console.log('');
  }

  // Run cleanup
  const result = await cleanupExpiredKeys(isDryRun);

  if (result.success) {
    if (result.dryRun) {
      console.log(`\n✅ Dry run completed in ${result.duration}ms`);
      console.log(`   Would delete: ${result.wouldDelete} keys`);
    } else {
      console.log(`\n✅ Cleanup completed in ${result.duration}ms`);
      console.log(`   Deleted: ${result.deleted} expired keys`);

      // Show updated stats
      const statsAfter = await getCleanupStats();
      if (statsAfter) {
        console.log('\n📊 Updated Statistics:');
        console.log(`  Total keys: ${statsAfter.total_keys} (${statsAfter.total_keys - statsBefore.total_keys} change)`);
        console.log(`  Active keys: ${statsAfter.active_keys}`);
        console.log(`  Expired keys: ${statsAfter.expired_keys}`);
      }
    }
  } else {
    console.log(`\n❌ Cleanup failed: ${result.error}`);
    process.exit(1);
  }

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { cleanupExpiredKeys, getCleanupStats };
