#!/usr/bin/env node

/**
 * PostgreSQL Backup Script
 * Phase 3 - Task 4.1: Baileys PostgreSQL Resilience Improvements
 *
 * Purpose:
 * - Creates daily backups of WhatsApp session database (whatsapp_auth + whatsapp_keys)
 * - Maintains 7 daily backups + 4 monthly backups for point-in-time recovery
 * - Complements Timeweb server backups with granular database-level backups
 * - Enables fast recovery (1-2 min) without full server restore
 *
 * Schedule:
 * - Daily: 03:00 UTC (06:00 MSK) via PM2 cron
 * - Monthly: 1st of month (archives as monthly backup)
 *
 * Usage:
 *   node scripts/backup/backup-postgresql.js              # Production run
 *   node scripts/backup/backup-postgresql.js --dry-run    # Test mode (no backup created)
 *   node scripts/backup/backup-postgresql.js --verbose    # Show detailed output
 *   node scripts/backup/backup-postgresql.js --monthly    # Force monthly backup
 *
 * Backup Strategy:
 * - Daily backups: /var/backups/postgresql/daily/backup-YYYY-MM-DD.sql.gz
 * - Monthly backups: /var/backups/postgresql/monthly/backup-YYYY-MM.sql.gz
 * - Retention: 7 daily (rotating), 4 monthly (rotating)
 * - Format: gzip-compressed SQL dump
 *
 * Recovery Time Objective (RTO):
 * - Database restore: <2 minutes (vs 10-30 min for full server restore)
 * - Point-in-time recovery: Up to 7 days back (daily granularity)
 *
 * Multi-Datacenter Strategy:
 * - Primary: Timeweb SPb (PostgreSQL server) - daily backups
 * - Secondary: Timeweb Moscow (App server) - full server backups
 * - This script: Additional PostgreSQL-specific backups with retention
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
  DB_HOST: process.env.TIMEWEB_PG_HOST || 'a84c973324fdaccfc68d929d.twc1.net',
  DB_PORT: process.env.TIMEWEB_PG_PORT || '5432',
  DB_NAME: process.env.TIMEWEB_PG_DATABASE || 'default_db',
  DB_USER: process.env.TIMEWEB_PG_USER || 'gen_user',
  DB_PASSWORD: process.env.TIMEWEB_PG_PASSWORD,

  // Backup paths
  BACKUP_ROOT: process.env.BACKUP_ROOT || '/var/backups/postgresql',
  DAILY_DIR: 'daily',
  MONTHLY_DIR: 'monthly',

  // Retention policy
  DAILY_RETENTION: parseInt(process.env.BACKUP_DAILY_RETENTION) || 7,   // 7 daily backups
  MONTHLY_RETENTION: parseInt(process.env.BACKUP_MONTHLY_RETENTION) || 4, // 4 monthly backups

  // Tables to backup
  TABLES: ['whatsapp_auth', 'whatsapp_keys'],

  // CLI flags
  DRY_RUN: process.argv.includes('--dry-run'),
  VERBOSE: process.argv.includes('--verbose'),
  FORCE_MONTHLY: process.argv.includes('--monthly'),
};

// ====================================================================================
// Utility Functions
// ====================================================================================

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}m ${secs}s`;
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get current month in YYYY-MM format
 */
function getMonthString() {
  const now = new Date();
  return now.toISOString().substring(0, 7);
}

/**
 * Check if today is 1st of the month
 */
function isFirstDayOfMonth() {
  return new Date().getDate() === 1;
}

// ====================================================================================
// Backup Operations
// ====================================================================================

/**
 * Ensure backup directories exist
 */
async function ensureDirectories() {
  const dailyPath = path.join(CONFIG.BACKUP_ROOT, CONFIG.DAILY_DIR);
  const monthlyPath = path.join(CONFIG.BACKUP_ROOT, CONFIG.MONTHLY_DIR);

  try {
    await fs.mkdir(dailyPath, { recursive: true, mode: 0o700 });
    await fs.mkdir(monthlyPath, { recursive: true, mode: 0o700 });
    logger.info(`✅ Backup directories ensured: ${CONFIG.BACKUP_ROOT}`);
  } catch (error) {
    logger.error(`❌ Failed to create backup directories: ${error.message}`);
    throw error;
  }
}

/**
 * Create PostgreSQL backup using pg_dump
 * @param {string} backupPath - Full path to backup file
 * @returns {Promise<object>} Backup metadata
 */
async function createBackup(backupPath) {
  const startTime = Date.now();

  // Build pg_dump command
  const pgDumpCmd = [
    'pg_dump',
    `-h ${CONFIG.DB_HOST}`,
    `-p ${CONFIG.DB_PORT}`,
    `-U ${CONFIG.DB_USER}`,
    `-d ${CONFIG.DB_NAME}`,
    '--verbose',
    '--clean',
    '--if-exists',
    '--create',
    ...CONFIG.TABLES.flatMap(table => ['-t', table]),
    '|',
    'gzip',
    '>',
    backupPath
  ].join(' ');

  if (CONFIG.VERBOSE) {
    logger.info(`📝 Executing: ${pgDumpCmd} (with PGPASSWORD env)`);
  }

  try {
    if (CONFIG.DRY_RUN) {
      logger.info(`🧪 DRY RUN: Would create backup at ${backupPath}`);
      return {
        path: backupPath,
        size: 0,
        duration: 0,
        dryRun: true
      };
    }

    // Execute pg_dump with PGPASSWORD in environment
    const { stdout, stderr } = await execAsync(pgDumpCmd, {
      shell: '/bin/bash',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: {
        ...process.env,
        PGPASSWORD: CONFIG.DB_PASSWORD
      }
    });

    // Get backup file size
    const stats = await fs.stat(backupPath);
    const duration = (Date.now() - startTime) / 1000;

    logger.info(`✅ Backup created: ${backupPath} (${formatBytes(stats.size)}) in ${formatDuration(duration)}`);

    if (CONFIG.VERBOSE && stderr) {
      logger.debug(`pg_dump output: ${stderr.substring(0, 500)}`);
    }

    return {
      path: backupPath,
      size: stats.size,
      duration,
      tables: CONFIG.TABLES,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error(`❌ Backup failed: ${error.message}`);
    Sentry.captureException(error, {
      tags: {
        component: 'postgresql_backup',
        operation: 'create_backup'
      },
      extra: {
        backupPath,
        tables: CONFIG.TABLES
      }
    });
    throw error;
  }
}

/**
 * Clean up old backups based on retention policy
 * @param {string} directory - Daily or monthly directory
 * @param {number} retention - Number of backups to keep
 * @returns {Promise<number>} Number of backups deleted
 */
async function cleanupOldBackups(directory, retention) {
  const backupDir = path.join(CONFIG.BACKUP_ROOT, directory);

  try {
    const files = await fs.readdir(backupDir);
    const backups = files
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        stat: null
      }));

    // Get file stats
    for (const backup of backups) {
      backup.stat = await fs.stat(backup.path);
    }

    // Sort by modification time (newest first)
    backups.sort((a, b) => b.stat.mtime - a.stat.mtime);

    // Delete old backups beyond retention
    const toDelete = backups.slice(retention);
    let deletedCount = 0;

    for (const backup of toDelete) {
      if (CONFIG.DRY_RUN) {
        logger.info(`🧪 DRY RUN: Would delete ${backup.name}`);
      } else {
        await fs.unlink(backup.path);
        logger.info(`🗑️  Deleted old backup: ${backup.name}`);
      }
      deletedCount++;
    }

    return deletedCount;

  } catch (error) {
    logger.error(`⚠️  Cleanup failed for ${directory}: ${error.message}`);
    return 0;
  }
}

/**
 * Get backup statistics
 * @returns {Promise<object>} Backup stats
 */
async function getBackupStats() {
  const stats = {
    daily: { count: 0, totalSize: 0, oldest: null, newest: null },
    monthly: { count: 0, totalSize: 0, oldest: null, newest: null }
  };

  for (const type of ['daily', 'monthly']) {
    const dir = path.join(CONFIG.BACKUP_ROOT, type);
    try {
      const files = await fs.readdir(dir);
      const backups = files.filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz'));

      stats[type].count = backups.length;

      for (const file of backups) {
        const filePath = path.join(dir, file);
        const fileStat = await fs.stat(filePath);
        stats[type].totalSize += fileStat.size;

        if (!stats[type].oldest || fileStat.mtime < stats[type].oldest.mtime) {
          stats[type].oldest = { name: file, mtime: fileStat.mtime };
        }
        if (!stats[type].newest || fileStat.mtime > stats[type].newest.mtime) {
          stats[type].newest = { name: file, mtime: fileStat.mtime };
        }
      }
    } catch (error) {
      logger.warn(`⚠️  Could not read ${type} backups: ${error.message}`);
    }
  }

  return stats;
}

// ====================================================================================
// Notifications
// ====================================================================================

/**
 * Send Telegram notification about backup
 */
async function sendNotification(result) {
  if (CONFIG.DRY_RUN) {
    logger.info('🧪 DRY RUN: Skipping Telegram notification');
    return;
  }

  const { backup, stats, deleted, duration } = result;

  const message = `
🔄 <b>PostgreSQL Backup Complete</b>

📦 <b>Backup Created:</b>
• Type: ${backup.isMonthly ? 'Monthly' : 'Daily'}
• Size: ${formatBytes(backup.size)}
• Tables: ${backup.tables.join(', ')}
• Duration: ${formatDuration(backup.duration)}

📊 <b>Retention Status:</b>
• Daily: ${stats.daily.count}/${CONFIG.DAILY_RETENTION} backups (${formatBytes(stats.daily.totalSize)})
• Monthly: ${stats.monthly.count}/${CONFIG.MONTHLY_RETENTION} backups (${formatBytes(stats.monthly.totalSize)})

🗑️  <b>Cleanup:</b>
• Deleted ${deleted.daily} old daily backup(s)
• Deleted ${deleted.monthly} old monthly backup(s)

⏱️ <b>Total Duration:</b> ${formatDuration(duration)}

${stats.daily.oldest ? `📅 Oldest daily backup: ${stats.daily.oldest.name}` : ''}
`.trim();

  try {
    await telegramNotifier.send(message, { parseMode: 'HTML' });
    logger.info('✅ Telegram notification sent');
  } catch (error) {
    logger.error(`⚠️  Failed to send Telegram notification: ${error.message}`);
  }
}

// ====================================================================================
// Main Execution
// ====================================================================================

async function main() {
  const startTime = Date.now();

  logger.info('🚀 PostgreSQL Backup Job Starting...');
  logger.info(`📅 Date: ${getDateString()}`);
  logger.info(`🎯 Mode: ${CONFIG.DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
  logger.info(`📊 Retention: ${CONFIG.DAILY_RETENTION} daily, ${CONFIG.MONTHLY_RETENTION} monthly`);

  try {
    // Step 1: Ensure directories exist
    await ensureDirectories();

    // Step 2: Determine backup type (daily or monthly)
    const isMonthly = CONFIG.FORCE_MONTHLY || isFirstDayOfMonth();
    const backupType = isMonthly ? CONFIG.MONTHLY_DIR : CONFIG.DAILY_DIR;
    const backupName = isMonthly
      ? `backup-${getMonthString()}.sql.gz`
      : `backup-${getDateString()}.sql.gz`;
    const backupPath = path.join(CONFIG.BACKUP_ROOT, backupType, backupName);

    logger.info(`📦 Creating ${isMonthly ? 'MONTHLY' : 'DAILY'} backup: ${backupName}`);

    // Step 3: Create backup
    const backup = await createBackup(backupPath);
    backup.isMonthly = isMonthly;

    // Step 4: Cleanup old backups
    const deletedDaily = await cleanupOldBackups(CONFIG.DAILY_DIR, CONFIG.DAILY_RETENTION);
    const deletedMonthly = await cleanupOldBackups(CONFIG.MONTHLY_DIR, CONFIG.MONTHLY_RETENTION);

    logger.info(`🗑️  Cleanup: ${deletedDaily} daily, ${deletedMonthly} monthly backups removed`);

    // Step 5: Get backup statistics
    const stats = await getBackupStats();

    // Step 6: Log to Sentry
    const totalDuration = (Date.now() - startTime) / 1000;

    Sentry.captureMessage('PostgreSQL backup completed', {
      level: backup.size > 100 * 1024 * 1024 ? 'warning' : 'info', // Warn if >100 MB
      tags: {
        component: 'postgresql_backup',
        operation: 'backup_job',
        backup_type: isMonthly ? 'monthly' : 'daily'
      },
      extra: {
        backupSize: backup.size,
        backupSizeFormatted: formatBytes(backup.size),
        duration: totalDuration,
        tables: backup.tables,
        stats: {
          daily: {
            count: stats.daily.count,
            size: formatBytes(stats.daily.totalSize)
          },
          monthly: {
            count: stats.monthly.count,
            size: formatBytes(stats.monthly.totalSize)
          }
        },
        deleted: {
          daily: deletedDaily,
          monthly: deletedMonthly
        },
        dryRun: CONFIG.DRY_RUN
      }
    });

    // Step 7: Send Telegram notification
    await sendNotification({
      backup,
      stats,
      deleted: { daily: deletedDaily, monthly: deletedMonthly },
      duration: totalDuration
    });

    // Success summary
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('✅ PostgreSQL Backup Job Complete!');
    logger.info(`📦 Backup: ${formatBytes(backup.size)}`);
    logger.info(`📊 Daily: ${stats.daily.count}/${CONFIG.DAILY_RETENTION}, Monthly: ${stats.monthly.count}/${CONFIG.MONTHLY_RETENTION}`);
    logger.info(`⏱️  Duration: ${formatDuration(totalDuration)}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;

    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.error('❌ PostgreSQL Backup Job FAILED!');
    logger.error(`⏱️  Duration: ${formatDuration(duration)}`);
    logger.error(`💥 Error: ${error.message}`);
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Log fatal error to Sentry
    Sentry.captureException(error, {
      level: 'fatal',
      tags: {
        component: 'postgresql_backup',
        operation: 'backup_job'
      },
      extra: {
        duration,
        config: {
          host: CONFIG.DB_HOST,
          database: CONFIG.DB_NAME,
          tables: CONFIG.TABLES
        }
      }
    });

    // Send error notification to Telegram
    try {
      await telegramNotifier.send(
        `❌ <b>PostgreSQL Backup FAILED</b>\n\n` +
        `Error: ${error.message}\n` +
        `Duration: ${formatDuration(duration)}`,
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
