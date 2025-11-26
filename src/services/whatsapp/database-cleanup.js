/**
 * Automatic cleanup of expired WhatsApp keys from database
 * Removes lid-mappings and other keys that have expired
 * Migrated from Supabase to PostgreSQL (2025-11-26)
 */

const postgres = require('../../database/postgres');
const logger = require('../../utils/logger');

// Cleanup interval: every 6 hours
const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in ms

/**
 * Clean up expired keys from whatsapp_keys table
 * @returns {Promise<number>} Number of deleted keys
 */
async function cleanupExpiredKeys() {
  try {
    logger.info('Starting automatic cleanup of expired WhatsApp keys...');

    // Delete expired keys and return them for logging
    const result = await postgres.query(
      `DELETE FROM whatsapp_keys
       WHERE expires_at < $1
       RETURNING company_id, key_type`,
      [new Date().toISOString()]
    );

    const count = result.rowCount || 0;
    const data = result.rows || [];

    if (count > 0) {
      logger.info(`Cleaned up ${count} expired keys from database`);

      // Log breakdown by key type
      if (data.length > 0) {
        const breakdown = data.reduce((acc, row) => {
          acc[row.key_type] = (acc[row.key_type] || 0) + 1;
          return acc;
        }, {});

        logger.info(`   Breakdown: ${JSON.stringify(breakdown)}`);
      }
    } else {
      logger.debug('No expired keys to cleanup');
    }

    return count;
  } catch (error) {
    logger.error('Error during cleanup:', error);
    return 0;
  }
}

/**
 * Get statistics about database storage
 */
async function getStorageStats() {
  try {
    // Get auth count
    const authResult = await postgres.query(
      'SELECT COUNT(*) as count FROM whatsapp_auth'
    );
    const authCount = parseInt(authResult.rows[0]?.count) || 0;

    // Get keys count (total)
    const keysResult = await postgres.query(
      'SELECT COUNT(*) as count FROM whatsapp_keys'
    );
    const keysCount = parseInt(keysResult.rows[0]?.count) || 0;

    // Get expired count
    const expiredResult = await postgres.query(
      'SELECT COUNT(*) as count FROM whatsapp_keys WHERE expires_at < $1',
      [new Date().toISOString()]
    );
    const expiredCount = parseInt(expiredResult.rows[0]?.count) || 0;

    return {
      companies: authCount,
      keys: keysCount,
      expired: expiredCount
    };
  } catch (error) {
    logger.error('Error getting storage stats:', error);
    return null;
  }
}

/**
 * Log storage statistics
 */
async function logStorageStats() {
  const stats = await getStorageStats();

  if (stats) {
    logger.info(`WhatsApp Auth Storage Stats:`);
    logger.info(`   Companies: ${stats.companies}`);
    logger.info(`   Keys (total): ${stats.keys}`);
    logger.info(`   Keys (expired): ${stats.expired}`);
  }
}

/**
 * Start automatic cleanup service
 * Runs cleanup every 6 hours
 */
function startAutomaticCleanup() {
  logger.info(`Starting automatic WhatsApp keys cleanup service`);
  logger.info(`   Interval: every ${CLEANUP_INTERVAL / (60 * 60 * 1000)} hours`);

  // Run cleanup immediately on start
  setTimeout(async () => {
    await cleanupExpiredKeys();
    await logStorageStats();
  }, 5000); // Wait 5 seconds after startup

  // Schedule cleanup every 6 hours
  setInterval(async () => {
    await cleanupExpiredKeys();
    await logStorageStats();
  }, CLEANUP_INTERVAL);

  logger.info(`Automatic cleanup service started`);
}

/**
 * Stop automatic cleanup (for graceful shutdown)
 */
function stopAutomaticCleanup() {
  // Cleanup intervals are handled by process exit
  logger.info('Stopping automatic cleanup service');
}

module.exports = {
  cleanupExpiredKeys,
  getStorageStats,
  logStorageStats,
  startAutomaticCleanup,
  stopAutomaticCleanup
};
