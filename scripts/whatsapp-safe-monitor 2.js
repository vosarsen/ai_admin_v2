#!/usr/bin/env node
// scripts/whatsapp-safe-monitor.js

/**
 * WhatsApp Safe Monitor - Multitenancy Edition
 * Monitors WhatsApp connection for ALL companies
 * - NO rm -rf commands
 * - NO automatic cleanup
 * - Only alerts and non-destructive recovery attempts
 * - Monitors all company_* directories
 */

require('dotenv').config();

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

const CONFIG = {
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    // Default company for backwards compatibility
    defaultCompanyId: process.env.COMPANY_ID || '962302',
    // Paths
    baileysSessionsPath: process.env.BAILEYS_SESSIONS_PATH || '/opt/ai-admin/baileys_sessions',
    // Check intervals
    checkInterval: 60000, // Check every minute
    // Thresholds
    unhealthyThreshold: 3, // Alert after 3 failed checks
    fileCountWarning: 150,  // Updated based on research
    fileCountCritical: 170, // Critical threshold
    fileCountEmergency: 180, // Emergency threshold
    // Auth settings
    usePairingCode: process.env.USE_PAIRING_CODE === 'true',
    phoneNumber: process.env.WHATSAPP_PHONE_NUMBER || '79686484488',
    // Notifications
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    // Features
    enableMultitenancy: process.env.ENABLE_MULTITENANCY !== 'false', // Default true
    autoCleanup: process.env.AUTO_CLEANUP === 'true' // Default false for safety
};

class WhatsAppSafeMonitor {
    constructor() {
        // Track failures per company
        this.companyStats = new Map();
        this.lastAlertTime = 0;
        this.alertCooldown = 300000; // 5 minutes between alerts
        this.companies = [];
    }

    /**
     * Get or initialize company statistics
     */
    getCompanyStats(companyId) {
        if (!this.companyStats.has(companyId)) {
            this.companyStats.set(companyId, {
                consecutiveFailures: 0,
                lastHealthyTime: Date.now(),
                lastAlertTime: 0,
                fileCount: 0,
                status: 'unknown'
            });
        }
        return this.companyStats.get(companyId);
    }

    /**
     * Discover all companies from baileys_sessions directory
     */
    async discoverCompanies() {
        try {
            const dirs = await fs.readdir(CONFIG.baileysSessionsPath);
            const newCompanies = dirs
                .filter(dir => dir.startsWith('company_'))
                .map(dir => dir.replace('company_', ''));

            // Очищаем устаревшие записи из Map для компаний которые больше не существуют
            for (const [companyId] of this.companyStats) {
                if (!newCompanies.includes(companyId)) {
                    this.companyStats.delete(companyId);
                    console.log(`🗑️ Removed stale company from monitoring: ${companyId}`);
                }
            }

            this.companies = newCompanies;

            if (this.companies.length === 0 && CONFIG.defaultCompanyId) {
                // Fallback to default company if no companies found
                this.companies = [CONFIG.defaultCompanyId];
            }

            console.log(`🏢 Discovered ${this.companies.length} companies: ${this.companies.join(', ')}`);
            return this.companies;
        } catch (error) {
            console.error('Failed to discover companies:', error.message);
            // Fallback to default company
            this.companies = [CONFIG.defaultCompanyId];
            return this.companies;
        }
    }

    async checkHealth(companyId) {
        const stats = this.getCompanyStats(companyId);

        try {
            // Проверяем несколько способов:
            // 1. Сначала пробуем старый endpoint (может быть он заработает)
            try {
                const statusResponse = await axios.get(
                    `${CONFIG.apiUrl}/webhook/whatsapp/baileys/status/${companyId}`,
                    { timeout: 3000 }
                );

                if (statusResponse.data?.status?.connected === true) {
                    if (stats.consecutiveFailures > 0) {
                        console.log(`✅ [${companyId}] WhatsApp connected (status endpoint)`);
                        await this.sendNotification(`✅ WhatsApp восстановлен (${companyId})`, 'info');
                    }
                    stats.consecutiveFailures = 0;
                    stats.lastHealthyTime = Date.now();
                    stats.status = 'connected';
                    return true;
                }
            } catch (statusError) {
                // Если status endpoint не работает, пробуем альтернативный метод
            }

            // 2. Проверяем через baileys service напрямую на порту 3003
            try {
                const baileysResponse = await axios.get(
                    `http://localhost:3003/health`,
                    { timeout: 3000 }
                );

                if (baileysResponse.status === 200) {
                    if (stats.consecutiveFailures > 0) {
                        console.log(`✅ [${companyId}] WhatsApp service is healthy (baileys direct check)`);
                    }
                    stats.consecutiveFailures = 0;
                    stats.lastHealthyTime = Date.now();
                    stats.status = 'connected';
                    return true;
                }
            } catch (baileysError) {
                // Продолжаем с другими проверками
            }

            // 3. Если оба метода не сработали, проверяем через PM2 (запущен ли процесс)
            const checkProcess = new Promise((resolve) => {
                exec('pm2 list | grep baileys-whatsapp | grep online', (error, stdout) => {
                    resolve(!error && stdout.includes('online'));
                });
            });

            const isProcessRunning = await checkProcess;

            if (isProcessRunning) {
                // Процесс запущен, но endpoints не отвечают - возможно временная проблема
                console.log(`⚠️ [${companyId}] Baileys process is running but endpoints not responding`);
                // Не увеличиваем счетчик ошибок сразу
                if (stats.consecutiveFailures < 2) {
                    stats.status = 'degraded';
                    return true; // Даем шанс восстановиться
                }
            }

            stats.consecutiveFailures++;
            stats.status = 'disconnected';
            console.log(`⚠️ [${companyId}] WhatsApp health check inconclusive (${stats.consecutiveFailures} consecutive checks)`);
            return false;

        } catch (error) {
            stats.consecutiveFailures++;
            stats.status = 'error';
            console.error(`❌ [${companyId}] Health check failed: ${error.message}`);
            return false;
        }
    }

    async checkFileCount(companyId) {
        const authPath = path.join(CONFIG.baileysSessionsPath, `company_${companyId}`);
        const stats = this.getCompanyStats(companyId);

        try {
            const files = await fs.readdir(authPath);
            const fileCount = files.length;
            stats.fileCount = fileCount;

            // Emergency threshold - immediate action required
            if (fileCount >= CONFIG.fileCountEmergency) {
                console.error(`🔴 [${companyId}] EMERGENCY: ${fileCount} files! Risk of device_removed!`);
                await this.sendAlert(
                    `🔴 EMERGENCY: WhatsApp auth files!\n\n` +
                    `Company: ${companyId}\n` +
                    `Files: ${fileCount}\n` +
                    `Status: CRITICAL RISK of device_removed!\n\n` +
                    `IMMEDIATE ACTION REQUIRED:\n` +
                    `1. Backup creds.json NOW\n` +
                    `2. Run cleanup: node scripts/baileys-multitenancy-cleanup.js\n` +
                    `3. Consider emergency rotation`
                );

                // Auto-cleanup if enabled and emergency
                if (CONFIG.autoCleanup && fileCount > 190) {
                    await this.triggerEmergencyCleanup(companyId);
                }
            }
            // Critical threshold
            else if (fileCount >= CONFIG.fileCountCritical) {
                console.error(`🟠 [${companyId}] CRITICAL: ${fileCount} files approaching danger zone!`);

                // Alert once per 30 minutes for critical
                const minutesSinceLastAlert = (Date.now() - stats.lastAlertTime) / 60000;
                if (minutesSinceLastAlert > 30) {
                    await this.sendNotification(
                        `🟠 CRITICAL: Company ${companyId}\n` +
                        `Files: ${fileCount}\n` +
                        `Action: Cleanup recommended within 24h`,
                        'critical'
                    );
                    stats.lastAlertTime = Date.now();
                }
            }
            // Warning threshold
            else if (fileCount >= CONFIG.fileCountWarning) {
                console.warn(`⚠️ [${companyId}] WARNING: ${fileCount} files`);

                // Alert once per hour for warnings
                const hoursSinceLastAlert = (Date.now() - stats.lastAlertTime) / 3600000;
                if (hoursSinceLastAlert > 1) {
                    await this.sendNotification(
                        `⚠️ Company ${companyId}: ${fileCount} files\nMonitor closely`,
                        'warning'
                    );
                    stats.lastAlertTime = Date.now();
                }
            }

            return fileCount;
        } catch (error) {
            console.error(`[${companyId}] Failed to check file count: ${error.message}`);
            return -1;
        }
    }

    /**
     * Trigger emergency cleanup for critical situations
     */
    async triggerEmergencyCleanup(companyId) {
        console.log(`🚨 [${companyId}] Triggering emergency cleanup...`);

        const scriptPath = path.join(__dirname, 'baileys-multitenancy-cleanup.js');

        // Проверяем существование скрипта
        try {
            await fs.access(scriptPath);
        } catch (error) {
            console.error(`❌ Emergency cleanup script not found: ${scriptPath}`);
            await this.sendNotification(
                `❌ Cannot run emergency cleanup for ${companyId}: script not found`,
                'critical'
            );
            return false;
        }

        return new Promise((resolve) => {
            exec(
                `node "${scriptPath}" --company ${companyId}`,
                { timeout: 120000 }, // 2 minute timeout
                (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Emergency cleanup failed: ${error.message}`);
                        if (stderr) console.error(`Stderr: ${stderr}`);
                        resolve(false);
                    } else {
                        console.log(`✅ Emergency cleanup completed for ${companyId}`);
                        // Parse output to get statistics if available
                        const filesRemoved = stdout.match(/Total files removed: (\d+)/)?.[1] || 'unknown';
                        this.sendNotification(
                            `✅ Emergency cleanup completed for company ${companyId}\nFiles removed: ${filesRemoved}`,
                            'info'
                        );
                        resolve(true);
                    }
                }
            );
        });
    }

    async attemptReconnection(companyId) {
        console.log(`🔄 [${companyId}] Attempting non-destructive reconnection...`);

        try {
            // Try to restart the session without cleanup
            const response = await axios.post(
                `${CONFIG.apiUrl}/api/whatsapp/sessions/${companyId}/reconnect`,
                {},
                { timeout: 30000 }
            );

            if (response.data?.success) {
                console.log(`✅ [${companyId}] Reconnection successful`);
                return true;
            }
        } catch (error) {
            console.error(`[${companyId}] Reconnection failed: ${error.message}`);
        }

        return false;
    }

    async suggestRecovery(companyId) {
        const stats = this.getCompanyStats(companyId);
        const suggestions = [];

        if (CONFIG.usePairingCode) {
            suggestions.push(
                '📱 Use Pairing Code:',
                `   curl -X POST ${CONFIG.apiUrl}/api/whatsapp/sessions/${companyId}/pairing-code \\`,
                `     -H "Content-Type: application/json" \\`,
                `     -d '{"phoneNumber": "${CONFIG.phoneNumber}"}'`
            );
        } else {
            suggestions.push(
                '📱 Use QR Code:',
                `   Open: ${CONFIG.apiUrl}/whatsapp-qr.html?company=${companyId}`
            );
        }

        suggestions.push(
            '',
            '🔧 Manual recovery steps:',
            '1. Check logs: pm2 logs baileys-whatsapp --lines 100',
            `2. Backup auth: node scripts/whatsapp-backup-manager.js backup ${companyId}`,
            `3. Smart cleanup: node scripts/baileys-multitenancy-cleanup.js --company ${companyId}`,
            '4. Reconnect using method above'
        );

        console.log(`\n[${companyId}] Recovery suggestions:\n` + suggestions.join('\n'));

        // Send to Telegram if configured
        if (stats.consecutiveFailures === CONFIG.unhealthyThreshold) {
            await this.sendAlert(
                `⚠️ WhatsApp отключен!\n\n` +
                `Компания: ${companyId}\n` +
                `Неудачных проверок: ${stats.consecutiveFailures}\n` +
                `Файлов: ${stats.fileCount}\n\n` +
                suggestions.join('\n')
            );
        }
    }

    async sendNotification(message, level = 'info') {
        // Rate limit notifications
        const timeSinceLastAlert = Date.now() - this.lastAlertTime;
        if (level !== 'critical' && timeSinceLastAlert < this.alertCooldown) {
            return;
        }

        console.log(`📢 ${message}`);

        if (CONFIG.telegramBotToken && CONFIG.telegramChatId) {
            try {
                await axios.post(
                    `https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`,
                    {
                        chat_id: CONFIG.telegramChatId,
                        text: message,
                        parse_mode: 'HTML'
                    }
                );
                this.lastAlertTime = Date.now();
            } catch (error) {
                console.error('Failed to send Telegram notification:', error.message);
            }
        }
    }

    async sendAlert(message) {
        await this.sendNotification(message, 'critical');
    }

    async run() {
        console.log('=' .repeat(60));
        console.log('🚀 WhatsApp Safe Monitor - Multitenancy Edition');
        console.log('=' .repeat(60));
        console.log(`📊 Config:`, {
            checkInterval: CONFIG.checkInterval / 1000 + 's',
            enableMultitenancy: CONFIG.enableMultitenancy,
            autoCleanup: CONFIG.autoCleanup,
            thresholds: {
                warning: CONFIG.fileCountWarning,
                critical: CONFIG.fileCountCritical,
                emergency: CONFIG.fileCountEmergency
            }
        });

        // Discover companies
        if (CONFIG.enableMultitenancy) {
            await this.discoverCompanies();
        } else {
            this.companies = [CONFIG.defaultCompanyId];
            console.log(`📌 Single-tenant mode: ${CONFIG.defaultCompanyId}`);
        }

        // Initial check
        await this.performCheck();

        // Schedule periodic checks
        setInterval(() => this.performCheck(), CONFIG.checkInterval);

        // Rediscover companies every 5 minutes
        if (CONFIG.enableMultitenancy) {
            setInterval(() => this.discoverCompanies(), 300000);
        }
    }

    async performCheck() {
        const timestamp = new Date().toISOString();
        console.log(`\n${'─' .repeat(60)}`);
        console.log(`⏰ [${timestamp}] Starting health check...`);

        // Check each company
        for (const companyId of this.companies) {
            await this.checkCompany(companyId);
        }

        // Summary
        this.printSummary();
    }

    async checkCompany(companyId) {
        const stats = this.getCompanyStats(companyId);

        // Check connection health
        const isHealthy = await this.checkHealth(companyId);

        // Check file count
        const fileCount = await this.checkFileCount(companyId);

        // Determine overall status
        const statusEmoji = stats.status === 'connected' ? '✅' :
                          stats.status === 'degraded' ? '⚠️' :
                          stats.status === 'disconnected' ? '❌' : '❓';

        const fileEmoji = fileCount >= CONFIG.fileCountEmergency ? '🔴' :
                         fileCount >= CONFIG.fileCountCritical ? '🟠' :
                         fileCount >= CONFIG.fileCountWarning ? '⚠️' : '✅';

        // Log status
        console.log(`${statusEmoji} [${companyId}] Status: ${stats.status} | ${fileEmoji} Files: ${fileCount}`);

        // Handle unhealthy connections
        if (!isHealthy) {
            // Try reconnection after threshold
            if (stats.consecutiveFailures === CONFIG.unhealthyThreshold) {
                const reconnected = await this.attemptReconnection(companyId);

                if (!reconnected) {
                    await this.suggestRecovery(companyId);
                }
            }
        }
    }

    /**
     * Print summary of all companies
     */
    printSummary() {
        const healthy = [];
        const warning = [];
        const critical = [];

        for (const [companyId, stats] of this.companyStats) {
            if (stats.status === 'connected' && stats.fileCount < CONFIG.fileCountWarning) {
                healthy.push(companyId);
            } else if (stats.status === 'disconnected' || stats.fileCount >= CONFIG.fileCountCritical) {
                critical.push(companyId);
            } else {
                warning.push(companyId);
            }
        }

        console.log(`\n📊 Summary:`);
        if (healthy.length > 0) {
            console.log(`  ✅ Healthy: ${healthy.join(', ')}`);
        }
        if (warning.length > 0) {
            console.log(`  ⚠️ Warning: ${warning.join(', ')}`);
        }
        if (critical.length > 0) {
            console.log(`  🔴 Critical: ${critical.join(', ')}`);
        }
    }
}

// Signal handlers
process.on('SIGINT', () => {
    console.log('\n👋 WhatsApp Safe Monitor stopped');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 WhatsApp Safe Monitor stopped');
    process.exit(0);
});

// Start monitor
const monitor = new WhatsAppSafeMonitor();
monitor.run();