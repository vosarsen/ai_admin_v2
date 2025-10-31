/**
 * Automatic cleanup of expired WhatsApp keys from database
 * Removes lid-mappings and other keys that have expired
 */

const { supabase } = require('../../database/supabase');
const logger = require('../../utils/logger');

// Cleanup interval: every 6 hours
const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in ms

/**
 * Clean up expired keys from whatsapp_keys table
 * @returns {Promise<number>} Number of deleted keys
 */
async function cleanupExpiredKeys() {
  try {
    logger.info('🧹 Starting automatic cleanup of expired WhatsApp keys...');

    // Delete expired keys
    const { data, error, count } = await supabase
      .from('whatsapp_keys')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('company_id, key_type', { count: 'exact' });

    if (error) {
      logger.error('❌ Failed to cleanup expired keys:', error);
      return 0;
    }

    if (count > 0) {
      logger.info(`✅ Cleaned up ${count} expired keys from database`);

      // Log breakdown by key type
      if (data && data.length > 0) {
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
    logger.error('❌ Error during cleanup:', error);
    return 0;
  }
}

/**
 * Get statistics about database storage
 */
async function getStorageStats() {
  try {
    // Get auth count
    const { count: authCount, error: authError } = await supabase
      .from('whatsapp_auth')
      .select('*', { count: 'exact', head: true });

    if (authError) {
      logger.error('Failed to get auth count:', authError);
      return null;
    }

    // Get keys count (total and expired)
    const { count: keysCount, error: keysError } = await supabase
      .from('whatsapp_keys')
      .select('*', { count: 'exact', head: true });

    if (keysError) {
      logger.error('Failed to get keys count:', keysError);
      return null;
    }

    const { count: expiredCount, error: expiredError } = await supabase
      .from('whatsapp_keys')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', new Date().toISOString());

    if (expiredError) {
      logger.error('Failed to get expired count:', expiredError);
    }

    return {
      companies: authCount,
      keys: keysCount,
      expired: expiredCount || 0
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
    logger.info(`📊 WhatsApp Auth Storage Stats:`);
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
  logger.info(`🤖 Starting automatic WhatsApp keys cleanup service`);
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

  logger.info(`✅ Automatic cleanup service started`);
}

/**
 * Stop automatic cleanup (for graceful shutdown)
 */
function stopAutomaticCleanup() {
  // Cleanup intervals are handled by process exit
  logger.info('🛑 Stopping automatic cleanup service');
}

module.exports = {
  cleanupExpiredKeys,
  getStorageStats,
  logStorageStats,
  startAutomaticCleanup,
  stopAutomaticCleanup
};
