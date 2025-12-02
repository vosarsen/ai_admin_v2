#!/usr/bin/env node

/**
 * Cleanup script for admin audit log
 *
 * Removes audit log records older than retention period (default 90 days).
 * Run via PM2 cron or manually.
 *
 * Usage:
 *   node scripts/cleanup-audit-log.js
 *   node scripts/cleanup-audit-log.js --retention-days 60
 *
 * PM2 cron example (ecosystem.config.js):
 *   {
 *     name: 'cleanup-audit-log',
 *     script: './scripts/cleanup-audit-log.js',
 *     cron_restart: '0 4 * * *',  // Daily at 4:00 AM
 *     autorestart: false,
 *     watch: false
 *   }
 */

require('dotenv').config();

const postgres = require('../src/database/postgres');
const { cleanupAuditLogs } = require('../src/utils/admin-audit');
const logger = require('../src/utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);
let retentionDays = 90;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--retention-days' && args[i + 1]) {
    retentionDays = parseInt(args[i + 1], 10);
    if (isNaN(retentionDays) || retentionDays < 1) {
      console.error('Invalid retention-days value. Must be a positive integer.');
      process.exit(1);
    }
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting audit log cleanup...`);
  console.log(`Retention period: ${retentionDays} days`);

  try {
    const deletedCount = await cleanupAuditLogs(postgres, retentionDays);

    console.log(`[${new Date().toISOString()}] Cleanup complete.`);
    console.log(`Deleted ${deletedCount} records older than ${retentionDays} days.`);

    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Cleanup failed:`, error.message);
    logger.error('Audit log cleanup failed:', error);
    process.exit(1);
  }
}

main();
