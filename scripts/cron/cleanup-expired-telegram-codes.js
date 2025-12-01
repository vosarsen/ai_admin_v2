#!/usr/bin/env node
/**
 * Cleanup Expired Telegram Linking Codes
 *
 * Updates status of expired codes from 'pending' to 'expired' in PostgreSQL.
 * Redis keys auto-expire (15 min TTL), but DB audit table needs cleanup.
 *
 * Run daily via PM2 cron:
 * pm2 start scripts/cron/cleanup-expired-telegram-codes.js --cron "0 3 * * *" --name cleanup-telegram-codes
 *
 * Or manually:
 * node scripts/cron/cleanup-expired-telegram-codes.js
 */

const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const postgres = require('../../src/database/postgres');
const logger = require('../../src/utils/logger').child({ module: 'cleanup-telegram-codes' });

async function cleanupExpiredCodes() {
  const startTime = Date.now();

  try {
    logger.info('Starting cleanup of expired Telegram linking codes...');

    const sql = `
      UPDATE telegram_linking_codes
      SET status = 'expired'
      WHERE status = 'pending' AND expires_at < NOW()
      RETURNING id, code, company_id, expires_at
    `;

    const result = await postgres.query(sql);
    const duration = Date.now() - startTime;

    if (result.rowCount > 0) {
      logger.info(`Cleaned up ${result.rowCount} expired codes in ${duration}ms`, {
        count: result.rowCount,
        codes: result.rows.map(r => ({
          id: r.id,
          code: r.code.substring(0, 5) + '...',
          companyId: r.company_id,
          expiredAt: r.expires_at
        }))
      });
    } else {
      logger.info(`No expired codes to clean up (${duration}ms)`);
    }

    return result.rowCount;

  } catch (error) {
    logger.error('Failed to cleanup expired codes:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  cleanupExpiredCodes()
    .then((count) => {
      console.log(`Cleanup complete: ${count} codes updated`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanupExpiredCodes };
