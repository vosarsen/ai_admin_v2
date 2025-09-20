#!/usr/bin/env node

/**
 * Automated WhatsApp Backup Service
 * Runs periodic backups of critical WhatsApp auth files
 * Can be run as a PM2 service or cron job
 */

require('dotenv').config();

const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');
const logger = require('../src/utils/logger');
const BackupManager = require('./whatsapp-backup-manager');

class AutomatedBackupService {
  constructor() {
    this.backupManager = new BackupManager();
    this.config = {
      // Backup schedule (cron format)
      schedule: process.env.BACKUP_SCHEDULE || '0 */6 * * *', // Every 6 hours
      // Companies to backup
      companies: process.env.BACKUP_COMPANIES ?
        process.env.BACKUP_COMPANIES.split(',') :
        ['962302'], // Default company
      // Backup before risky operations
      beforeOperations: process.env.BACKUP_BEFORE_OPS !== 'false',
      // Send notifications
      notifications: process.env.BACKUP_NOTIFICATIONS === 'true',
      // Telegram settings for notifications
      telegramBot: process.env.TELEGRAM_BOT_TOKEN,
      telegramChat: process.env.TELEGRAM_CHAT_ID,
      // S3/Cloud backup (future feature)
      cloudBackup: process.env.BACKUP_TO_CLOUD === 'true',
      cloudBucket: process.env.BACKUP_S3_BUCKET,
      // Retention policy
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '7'),
      maxBackupsPerCompany: parseInt(process.env.MAX_BACKUPS_PER_COMPANY || '10')
    };

    this.stats = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      lastBackupTime: null,
      lastError: null
    };

    // Event hooks for before operations
    this.operationHooks = new Set();
  }

  /**
   * Start the automated backup service
   */
  async start() {
    logger.info('🚀 Starting Automated Backup Service');
    logger.info(`📅 Schedule: ${this.config.schedule}`);
    logger.info(`🏢 Companies: ${this.config.companies.join(', ')}`);

    // Initialize backup manager
    await this.backupManager.init();

    // Run initial backup
    await this.performScheduledBackup();

    // Setup scheduled backups
    this.setupSchedule();

    // Setup operation hooks if enabled
    if (this.config.beforeOperations) {
      this.setupOperationHooks();
    }

    // Setup signal handlers
    this.setupSignalHandlers();

    logger.info('✅ Automated Backup Service started successfully');
  }

  /**
   * Setup cron schedule for automatic backups
   */
  setupSchedule() {
    this.cronJob = cron.schedule(this.config.schedule, async () => {
      await this.performScheduledBackup();
    });

    logger.info(`⏰ Backup schedule configured: ${this.config.schedule}`);
  }

  /**
   * Perform scheduled backup for all companies
   */
  async performScheduledBackup() {
    const startTime = Date.now();
    logger.info('🔄 Starting scheduled backup...');

    const results = {
      successful: [],
      failed: []
    };

    for (const companyId of this.config.companies) {
      try {
        await this.backupCompany(companyId);
        results.successful.push(companyId);
      } catch (error) {
        logger.error(`Failed to backup company ${companyId}:`, error);
        results.failed.push({ companyId, error: error.message });
        this.stats.failedBackups++;
        this.stats.lastError = error.message;
      }
    }

    const duration = Date.now() - startTime;

    // Update stats
    this.stats.totalBackups++;
    this.stats.lastBackupTime = new Date();

    // Log results
    logger.info(`✅ Backup completed in ${duration}ms`);
    logger.info(`   Successful: ${results.successful.length}`);
    logger.info(`   Failed: ${results.failed.length}`);

    // Send notification
    if (this.config.notifications) {
      await this.sendNotification(results, duration);
    }

    // Clean old backups
    await this.cleanOldBackups();

    return results;
  }

  /**
   * Backup a single company
   */
  async backupCompany(companyId) {
    logger.info(`📦 Backing up company ${companyId}...`);

    const authPath = `/opt/ai-admin/baileys_sessions/company_${companyId}`;

    // Check if auth directory exists
    if (!await fs.pathExists(authPath)) {
      logger.warn(`No auth directory for company ${companyId}, skipping`);
      return null;
    }

    // Check for critical files
    const credsFile = path.join(authPath, 'creds.json');
    if (!await fs.pathExists(credsFile)) {
      logger.warn(`No creds.json for company ${companyId}, skipping`);
      return null;
    }

    // Create backup
    const backupPath = await this.backupManager.createBackup(companyId);

    // Upload to cloud if configured
    if (this.config.cloudBackup && backupPath) {
      await this.uploadToCloud(companyId, backupPath);
    }

    this.stats.successfulBackups++;

    return backupPath;
  }

  /**
   * Upload backup to cloud storage (S3)
   */
  async uploadToCloud(companyId, backupPath) {
    // TODO: Implement S3 upload
    logger.info(`☁️ Would upload ${companyId} backup to cloud (not implemented yet)`);
  }

  /**
   * Clean old backups based on retention policy
   */
  async cleanOldBackups() {
    logger.info('🧹 Cleaning old backups...');

    for (const companyId of this.config.companies) {
      try {
        const companyBackupDir = path.join(this.backupManager.backupDir, `company_${companyId}`);

        if (!await fs.pathExists(companyBackupDir)) {
          continue;
        }

        // Get all backups
        const backups = await fs.readdir(companyBackupDir);
        const backupStats = [];

        for (const backup of backups) {
          const backupPath = path.join(companyBackupDir, backup);
          const stat = await fs.stat(backupPath);
          backupStats.push({
            name: backup,
            path: backupPath,
            time: stat.mtime
          });
        }

        // Sort by time (newest first)
        backupStats.sort((a, b) => b.time - a.time);

        // Keep only recent backups
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

        let keptCount = 0;
        for (const backup of backupStats) {
          keptCount++;

          // Remove if exceeds max count or retention period
          if (keptCount > this.config.maxBackupsPerCompany || backup.time < cutoffDate) {
            logger.info(`🗑️ Removing old backup: ${backup.name}`);
            await fs.remove(backup.path);
          }
        }
      } catch (error) {
        logger.error(`Failed to clean backups for ${companyId}:`, error);
      }
    }
  }

  /**
   * Setup hooks for backup before risky operations
   */
  setupOperationHooks() {
    // Hook into session pool for risky operations
    try {
      const { getSessionPool } = require('../src/integrations/whatsapp/session-pool');
      const sessionPool = getSessionPool();

      if (sessionPool) {
        // Backup before session removal
        const originalRemoveSession = sessionPool.removeSession.bind(sessionPool);
        sessionPool.removeSession = async (companyId) => {
          logger.info(`🔒 Creating backup before removing session for ${companyId}`);
          await this.backupCompany(companyId);
          return originalRemoveSession(companyId);
        };

        logger.info('✅ Operation hooks configured');
      }
    } catch (error) {
      logger.warn('Could not setup operation hooks:', error.message);
    }
  }

  /**
   * Send notification about backup results
   */
  async sendNotification(results, duration) {
    const message = `📦 WhatsApp Backup Report\n\n` +
      `✅ Successful: ${results.successful.length}\n` +
      `❌ Failed: ${results.failed.length}\n` +
      `⏱️ Duration: ${duration}ms\n` +
      `🕐 Time: ${new Date().toLocaleString()}\n` +
      `\n` +
      `Companies: ${results.successful.join(', ')}` +
      (results.failed.length > 0 ? `\n\nFailed:\n${results.failed.map(f => `${f.companyId}: ${f.error}`).join('\n')}` : '');

    logger.info(`📢 ${message}`);

    // Send to Telegram if configured
    if (this.config.telegramBot && this.config.telegramChat) {
      try {
        const axios = require('axios');
        await axios.post(
          `https://api.telegram.org/bot${this.config.telegramBot}/sendMessage`,
          {
            chat_id: this.config.telegramChat,
            text: message,
            parse_mode: 'HTML'
          }
        );
      } catch (error) {
        logger.error('Failed to send Telegram notification:', error.message);
      }
    }
  }

  /**
   * Manual backup trigger
   */
  async triggerBackup(companyId = null) {
    if (companyId) {
      return await this.backupCompany(companyId);
    }
    return await this.performScheduledBackup();
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime(),
      nextBackup: this.cronJob?.nextDate(),
      config: {
        schedule: this.config.schedule,
        companies: this.config.companies,
        retentionDays: this.config.retentionDays
      }
    };
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const shutdown = async () => {
      logger.info('📛 Shutting down Automated Backup Service...');

      // Stop cron job
      if (this.cronJob) {
        this.cronJob.stop();
      }

      // Perform final backup
      logger.info('🔄 Performing final backup before shutdown...');
      await this.performScheduledBackup();

      logger.info('👋 Automated Backup Service stopped');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

// Command line interface
if (require.main === module) {
  const service = new AutomatedBackupService();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'start':
      // Start the service
      service.start().catch(error => {
        logger.error('Failed to start backup service:', error);
        process.exit(1);
      });
      break;

    case 'backup':
      // Perform single backup and exit
      const companyId = args[1];
      service.backupManager.init()
        .then(() => service.triggerBackup(companyId))
        .then(() => {
          logger.info('✅ Backup completed');
          process.exit(0);
        })
        .catch(error => {
          logger.error('Backup failed:', error);
          process.exit(1);
        });
      break;

    case 'stats':
      // Show statistics
      service.backupManager.init()
        .then(() => {
          console.log(JSON.stringify(service.getStats(), null, 2));
          process.exit(0);
        });
      break;

    default:
      console.log(`
Automated WhatsApp Backup Service

Usage:
  node automated-backup-service.js start       # Start the service
  node automated-backup-service.js backup [id] # Perform single backup
  node automated-backup-service.js stats       # Show statistics

Environment Variables:
  BACKUP_SCHEDULE          Cron schedule (default: "0 */6 * * *")
  BACKUP_COMPANIES         Comma-separated company IDs
  BACKUP_RETENTION_DAYS    Days to keep backups (default: 7)
  BACKUP_NOTIFICATIONS     Enable notifications (true/false)
  TELEGRAM_BOT_TOKEN       Telegram bot token for notifications
  TELEGRAM_CHAT_ID         Telegram chat ID for notifications

Run as PM2 service:
  pm2 start automated-backup-service.js --name whatsapp-backup -- start
      `);
      process.exit(0);
  }
}

module.exports = AutomatedBackupService;