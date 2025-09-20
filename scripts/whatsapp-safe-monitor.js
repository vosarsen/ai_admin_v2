#!/usr/bin/env node
// scripts/whatsapp-safe-monitor.js

/**
 * WhatsApp Safe Monitor
 * Monitors WhatsApp connection WITHOUT destructive operations
 * - NO rm -rf commands
 * - NO automatic cleanup
 * - Only alerts and non-destructive recovery attempts
 */

require('dotenv').config();

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    companyId: process.env.COMPANY_ID || '962302',
    checkInterval: 60000, // Check every minute
    unhealthyThreshold: 3, // Alert after 3 failed checks
    fileCountWarning: 100,
    fileCountCritical: 150,
    usePairingCode: process.env.USE_PAIRING_CODE === 'true',
    phoneNumber: process.env.WHATSAPP_PHONE_NUMBER || '79686484488',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID
};

class WhatsAppSafeMonitor {
    constructor() {
        this.consecutiveFailures = 0;
        this.lastHealthyTime = Date.now();
        this.lastAlertTime = 0;
        this.alertCooldown = 300000; // 5 minutes between alerts
    }

    async checkHealth() {
        try {
            const response = await axios.get(
                `${CONFIG.apiUrl}/webhook/whatsapp/baileys/status/${CONFIG.companyId}`,
                { timeout: 5000 }
            );

            const isHealthy = response.data?.status?.connected === true;

            if (isHealthy) {
                if (this.consecutiveFailures > 0) {
                    console.log('✅ WhatsApp recovered');
                    await this.sendNotification('✅ WhatsApp восстановлен', 'info');
                }
                this.consecutiveFailures = 0;
                this.lastHealthyTime = Date.now();
            } else {
                this.consecutiveFailures++;
                console.log(`⚠️ WhatsApp disconnected (${this.consecutiveFailures} consecutive checks)`);
            }

            return isHealthy;
        } catch (error) {
            this.consecutiveFailures++;
            console.error(`❌ Health check failed: ${error.message}`);
            return false;
        }
    }

    async checkFileCount() {
        const authPath = process.env.WHATSAPP_AUTH_PATH ||
                        path.join(process.env.SERVER_PATH || '/opt/ai-admin',
                                 'baileys_sessions',
                                 `company_${CONFIG.companyId}`);

        try {
            const files = await fs.readdir(authPath);
            const fileCount = files.length;

            if (fileCount >= CONFIG.fileCountCritical) {
                console.error(`🚨 CRITICAL: ${fileCount} files in auth directory!`);
                await this.sendAlert(
                    `🚨 CRITICAL: WhatsApp auth files!\n\n` +
                    `Company: ${CONFIG.companyId}\n` +
                    `Files: ${fileCount}\n` +
                    `Status: Risk of device_removed!\n\n` +
                    `Action required:\n` +
                    `1. Backup creds.json\n` +
                    `2. Run smart cleanup\n` +
                    `3. Monitor closely`
                );
            } else if (fileCount >= CONFIG.fileCountWarning) {
                console.warn(`⚠️ WARNING: ${fileCount} files in auth directory`);

                // Alert once per hour for warnings
                const hoursSinceLastAlert = (Date.now() - this.lastAlertTime) / 3600000;
                if (hoursSinceLastAlert > 1) {
                    await this.sendNotification(
                        `⚠️ WhatsApp файлов: ${fileCount}\nТребуется профилактическая очистка`,
                        'warning'
                    );
                }
            }

            return fileCount;
        } catch (error) {
            console.error(`Failed to check file count: ${error.message}`);
            return -1;
        }
    }

    async attemptReconnection() {
        console.log('🔄 Attempting non-destructive reconnection...');

        try {
            // Try to restart the session without cleanup
            const response = await axios.post(
                `${CONFIG.apiUrl}/api/whatsapp/sessions/${CONFIG.companyId}/reconnect`,
                {},
                { timeout: 30000 }
            );

            if (response.data?.success) {
                console.log('✅ Reconnection successful');
                return true;
            }
        } catch (error) {
            console.error(`Reconnection failed: ${error.message}`);
        }

        return false;
    }

    async suggestRecovery() {
        const suggestions = [];

        if (CONFIG.usePairingCode) {
            suggestions.push(
                '📱 Use Pairing Code:',
                `   curl -X POST ${CONFIG.apiUrl}/api/whatsapp/sessions/${CONFIG.companyId}/pairing-code \\`,
                `     -H "Content-Type: application/json" \\`,
                `     -d '{"phoneNumber": "${CONFIG.phoneNumber}"}'`
            );
        } else {
            suggestions.push(
                '📱 Use QR Code:',
                `   Open: ${CONFIG.apiUrl}/whatsapp-qr.html?company=${CONFIG.companyId}`
            );
        }

        suggestions.push(
            '',
            '🔧 Manual recovery steps:',
            '1. Check logs: pm2 logs ai-admin-api --lines 100',
            '2. Backup auth: node scripts/whatsapp-backup-manager.js backup 962302',
            '3. Smart cleanup: node scripts/whatsapp-smart-cleanup.js',
            '4. Reconnect using method above'
        );

        console.log('\n' + suggestions.join('\n'));

        // Send to Telegram if configured
        if (this.consecutiveFailures === CONFIG.unhealthyThreshold) {
            await this.sendAlert(
                `⚠️ WhatsApp отключен!\n\n` +
                `Компания: ${CONFIG.companyId}\n` +
                `Неудачных проверок: ${this.consecutiveFailures}\n\n` +
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
        console.log('🚀 WhatsApp Safe Monitor started');
        console.log(`📊 Config:`, {
            companyId: CONFIG.companyId,
            checkInterval: CONFIG.checkInterval / 1000 + 's',
            usePairingCode: CONFIG.usePairingCode
        });

        // Initial check
        await this.performCheck();

        // Schedule periodic checks
        setInterval(() => this.performCheck(), CONFIG.checkInterval);
    }

    async performCheck() {
        const timestamp = new Date().toISOString();
        console.log(`\n[${timestamp}] Checking WhatsApp health...`);

        // Check connection health
        const isHealthy = await this.checkHealth();

        // Check file count
        const fileCount = await this.checkFileCount();

        // Log status
        if (isHealthy) {
            console.log(`✅ WhatsApp healthy (${fileCount} files)`);
        } else {
            console.log(`❌ WhatsApp unhealthy (${this.consecutiveFailures} failures)`);

            // Try reconnection after threshold
            if (this.consecutiveFailures === CONFIG.unhealthyThreshold) {
                const reconnected = await this.attemptReconnection();

                if (!reconnected) {
                    await this.suggestRecovery();
                }
            }
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