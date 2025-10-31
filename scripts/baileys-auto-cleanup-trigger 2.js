#!/usr/bin/env node

/**
 * Baileys Auto Cleanup Trigger
 * Автоматически запускает очистку при превышении порога файлов
 * Запускается каждые 30 минут через cron
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Конфигурация
const CONFIG = {
  BAILEYS_SESSIONS_PATH: process.env.BAILEYS_SESSIONS_PATH || '/opt/ai-admin/baileys_sessions',
  TRIGGER_THRESHOLD: 175,     // Запускать очистку при 175+ файлах
  EMERGENCY_THRESHOLD: 185,    // Экстренная очистка при 185+ файлах
  CLEANUP_SCRIPT: '/opt/ai-admin/scripts/baileys-multitenancy-cleanup.js',
  LOG_FILE: '/opt/ai-admin/logs/auto-cleanup-trigger.log',
  LOCK_FILE: '/tmp/baileys-auto-cleanup.lock',
  LOCK_TIMEOUT: 3600000,      // 1 час
  NOTIFICATION_WEBHOOK: process.env.NOTIFICATION_WEBHOOK || '',
  DRY_RUN: process.env.DRY_RUN === 'true'
};

class AutoCleanupTrigger {
  constructor() {
    this.triggered = new Set(); // Компании, для которых уже запускалась очистка
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logMessage);

    // Append to log file
    fs.appendFile(CONFIG.LOG_FILE, logMessage + '\n').catch(err => {
      console.error('Failed to write to log file:', err);
    });
  }

  async checkLock() {
    try {
      const lockExists = await fs.access(CONFIG.LOCK_FILE).then(() => true).catch(() => false);

      if (lockExists) {
        const lockContent = await fs.readFile(CONFIG.LOCK_FILE, 'utf8');
        const lockData = JSON.parse(lockContent);
        const lockAge = Date.now() - lockData.timestamp;

        if (lockAge < CONFIG.LOCK_TIMEOUT) {
          this.log('info', `Lock file exists (${Math.round(lockAge / 1000)}s old), skipping run`);
          return false;
        } else {
          this.log('warn', `Removing stale lock file (${Math.round(lockAge / 1000)}s old)`);
        }
      }

      // Create new lock
      const lockData = {
        timestamp: Date.now(),
        pid: process.pid,
        hostname: require('os').hostname()
      };
      await fs.writeFile(CONFIG.LOCK_FILE, JSON.stringify(lockData));
      return true;

    } catch (error) {
      this.log('error', `Lock check failed: ${error.message}`);
      return false;
    }
  }

  async releaseLock() {
    try {
      await fs.unlink(CONFIG.LOCK_FILE);
    } catch (error) {
      // Ignore errors
    }
  }

  async getCompanyFileCounts() {
    const companies = [];

    try {
      const dirs = await fs.readdir(CONFIG.BAILEYS_SESSIONS_PATH);

      for (const dir of dirs) {
        if (!dir.startsWith('company_')) continue;

        const companyId = dir.replace('company_', '');
        const companyPath = path.join(CONFIG.BAILEYS_SESSIONS_PATH, dir);

        try {
          const files = await fs.readdir(companyPath);
          companies.push({
            id: companyId,
            path: companyPath,
            fileCount: files.length
          });
        } catch (error) {
          this.log('error', `Failed to read company ${companyId}: ${error.message}`);
        }
      }

      return companies;
    } catch (error) {
      this.log('error', `Failed to read sessions directory: ${error.message}`);
      return [];
    }
  }

  async runCleanup(companyId, emergency = false) {
    this.log('info', `🧹 Triggering ${emergency ? 'EMERGENCY' : 'automatic'} cleanup for company ${companyId}`);

    try {
      const command = `node ${CONFIG.CLEANUP_SCRIPT} --company ${companyId}`;

      if (CONFIG.DRY_RUN) {
        this.log('info', `[DRY-RUN] Would execute: ${command}`);
        return { success: true, dryRun: true };
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout: 120000 // 2 minutes timeout
      });

      // Parse results
      const filesRemoved = stdout.match(/Total files removed: (\d+)/)?.[1] || '0';
      const filesRemaining = stdout.match(/(\d+) remaining/)?.[1] || 'unknown';

      this.log('info', `✅ Cleanup completed for ${companyId}: removed ${filesRemoved} files, ${filesRemaining} remaining`);

      // Mark as triggered to avoid repeated cleanups
      this.triggered.add(companyId);

      // Clear trigger after 6 hours
      setTimeout(() => {
        this.triggered.delete(companyId);
      }, 6 * 60 * 60 * 1000);

      return {
        success: true,
        filesRemoved: parseInt(filesRemoved),
        filesRemaining
      };

    } catch (error) {
      this.log('error', `❌ Cleanup failed for ${companyId}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendNotification(message, level = 'info') {
    if (!CONFIG.NOTIFICATION_WEBHOOK) return;

    try {
      // Send to webhook (Telegram, Slack, etc.)
      await execAsync(`curl -X POST -H "Content-Type: application/json" -d '{"text":"${message}","level":"${level}"}' ${CONFIG.NOTIFICATION_WEBHOOK}`, {
        timeout: 5000
      });
    } catch (error) {
      this.log('error', `Failed to send notification: ${error.message}`);
    }
  }

  async checkAndTrigger() {
    this.log('info', '🔍 Starting automatic cleanup check...');

    // Get file counts for all companies
    const companies = await this.getCompanyFileCounts();

    if (companies.length === 0) {
      this.log('warn', 'No companies found');
      return;
    }

    this.log('info', `Found ${companies.length} companies to check`);

    let cleanupTriggered = false;

    for (const company of companies) {
      const { id, fileCount } = company;

      // Skip if already triggered recently
      if (this.triggered.has(id)) {
        this.log('debug', `Skipping ${id} (cleanup already triggered recently)`);
        continue;
      }

      // Emergency cleanup
      if (fileCount >= CONFIG.EMERGENCY_THRESHOLD) {
        this.log('warn', `🚨 EMERGENCY: Company ${id} has ${fileCount} files!`);

        await this.sendNotification(
          `🚨 EMERGENCY CLEANUP TRIGGERED\nCompany: ${id}\nFiles: ${fileCount}\nThreshold: ${CONFIG.EMERGENCY_THRESHOLD}`,
          'critical'
        );

        const result = await this.runCleanup(id, true);
        cleanupTriggered = true;

        if (result.success) {
          await this.sendNotification(
            `✅ Emergency cleanup completed for ${id}\nRemoved: ${result.filesRemoved} files\nRemaining: ${result.filesRemaining}`,
            'info'
          );
        }
      }
      // Regular triggered cleanup
      else if (fileCount >= CONFIG.TRIGGER_THRESHOLD) {
        this.log('warn', `⚠️ Company ${id} has ${fileCount} files (threshold: ${CONFIG.TRIGGER_THRESHOLD})`);

        await this.sendNotification(
          `⚠️ Auto cleanup triggered\nCompany: ${id}\nFiles: ${fileCount}\nThreshold: ${CONFIG.TRIGGER_THRESHOLD}`,
          'warning'
        );

        const result = await this.runCleanup(id, false);
        cleanupTriggered = true;

        if (result.success) {
          await this.sendNotification(
            `✅ Auto cleanup completed for ${id}\nRemoved: ${result.filesRemoved} files\nRemaining: ${result.filesRemaining}`,
            'info'
          );
        }
      }
      // OK status
      else if (fileCount < 150) {
        this.log('debug', `✅ Company ${id}: ${fileCount} files (OK)`);
      }
      // Warning status
      else {
        this.log('info', `⚠️ Company ${id}: ${fileCount} files (approaching threshold)`);
      }
    }

    if (!cleanupTriggered) {
      this.log('info', '✅ All companies within acceptable limits');
    }

    // Summary
    const summary = companies.map(c => `${c.id}:${c.fileCount}`).join(', ');
    this.log('info', `Summary: ${summary}`);
  }

  async run() {
    // Check lock to prevent parallel runs
    const canRun = await this.checkLock();
    if (!canRun) {
      return;
    }

    try {
      await this.checkAndTrigger();
    } catch (error) {
      this.log('error', `Fatal error: ${error.message}`);
      await this.sendNotification(
        `❌ Auto cleanup trigger failed: ${error.message}`,
        'error'
      );
    } finally {
      await this.releaseLock();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const trigger = new AutoCleanupTrigger();

  trigger.run()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = AutoCleanupTrigger;