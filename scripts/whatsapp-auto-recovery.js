#!/usr/bin/env node
// scripts/whatsapp-auto-recovery.js

/**
 * WhatsApp Auto-Recovery Script
 * Monitors WhatsApp connection and automatically recovers if disconnected
 */

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const CONFIG = {
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    companyId: process.env.COMPANY_ID || '962302',
    checkInterval: 60000, // Check every minute
    maxRetries: 3,
    // Dynamic auth path based on company ID
    get authPath() {
        return `/opt/ai-admin/baileys_sessions/company_${this.companyId}`;
    }
};

class WhatsAppRecovery {
    constructor() {
        this.retryCount = 0;
        this.lastHealthyTime = Date.now();
    }

    async checkStatus() {
        try {
            const response = await axios.get(`${CONFIG.apiUrl}/webhook/whatsapp/baileys/status/${CONFIG.companyId}`);
            return response.data;
        } catch (error) {
            console.error('Failed to check status:', error.message);
            return { status: { connected: false } };
        }
    }

    async cleanupAuth() {
        try {
            console.log('🧹 Running smart cleanup instead of full deletion...');

            // Use smart cleanup that preserves creds.json
            const SmartCleanup = require('./whatsapp-smart-cleanup');
            const cleanup = new SmartCleanup();

            // Set environment for cleanup
            process.env.COMPANY_ID = CONFIG.companyId;
            process.env.AUTH_PATH = CONFIG.authPath;

            const stats = await cleanup.cleanup();
            console.log(`✅ Smart cleanup completed. Removed ${stats.removed} files`);
            return true;
        } catch (error) {
            console.error('Failed to cleanup auth:', error.message);
            return false;
        }
    }

    async fullCleanupAuth() {
        // Only for emergency - requires QR rescan
        try {
            console.log('🚨 FULL cleanup - will require QR rescan!');
            await execAsync(`rm -rf ${CONFIG.authPath}/*`);
            console.log('✅ Full auth data cleaned');
            return true;
        } catch (error) {
            console.error('Failed to full cleanup:', error.message);
            return false;
        }
    }

    async initializeSession() {
        try {
            console.log('🔄 Initializing new session...');
            const response = await axios.post(`${CONFIG.apiUrl}/webhook/whatsapp/baileys/init/${CONFIG.companyId}`);
            console.log('✅ Session initialized');
            return response.data;
        } catch (error) {
            console.error('Failed to initialize session:', error.message);
            return null;
        }
    }

    async restartAPI() {
        try {
            console.log('🔄 Restarting API...');
            await execAsync('pm2 restart ai-admin-api');
            // Wait for API to start
            await new Promise(resolve => setTimeout(resolve, 5000));
            console.log('✅ API restarted');
            return true;
        } catch (error) {
            console.error('Failed to restart API:', error.message);
            return false;
        }
    }

    async generateQRCode() {
        console.log('📱 QR Code needed. Please scan it:');
        console.log(`Open: http://${process.env.SERVER_IP || '46.149.70.219'}:3000/whatsapp-connect.html?company=${CONFIG.companyId}`);
        console.log('Or run: bash /opt/ai-admin/scripts/connect-whatsapp.sh 962302');
    }

    async recover() {
        console.log('🚨 WhatsApp disconnected. Starting recovery...');
        this.retryCount++;

        if (this.retryCount > CONFIG.maxRetries) {
            console.error('❌ Max retries exceeded. Manual intervention needed.');

            // Check file count before deciding on full cleanup
            const fileCount = await this.getFileCount();
            if (fileCount > 200) {
                console.error('💀 File count exceeds 200 - full cleanup required');
                await this.sendAlert(
                    `🚨 CRITICAL: WhatsApp recovery failed!\n\n` +
                    `Files: ${fileCount}\n` +
                    `Full cleanup required - QR rescan needed!\n\n` +
                    `Running emergency cleanup...`
                );
                await this.fullCleanupAuth();
                await this.initializeSession();
                await this.generateQRCode();
            } else {
                await this.sendAlert(
                    `⚠️ WhatsApp recovery failed after ${CONFIG.maxRetries} attempts.\n\n` +
                    `Files: ${fileCount}\n` +
                    `Please check connection manually.`
                );
            }
            return false;
        }

        try {
            // Step 1: Try to reconnect first WITHOUT cleanup
            console.log('Attempting to reconnect without cleanup...');
            const reconnected = await this.initializeSession();

            if (reconnected) {
                console.log('✅ Reconnected successfully without cleanup');
                this.retryCount = 0;
                return true;
            }

            // Step 2: If that fails, do smart cleanup (preserves creds.json)
            console.log('Reconnection failed, trying with smart cleanup...');
            const fileCount = await this.getFileCount();

            if (fileCount > 150) {
                console.log(`High file count (${fileCount}), running smart cleanup...`);
                await this.cleanupAuth(); // Smart cleanup, preserves creds.json
            }

            // Step 3: Try to reconnect again
            await this.restartAPI();
            const init = await this.initializeSession();

            if (init) {
                console.log('✅ Recovered successfully after cleanup');
                this.retryCount = 0;
                return true;
            }

            console.error('Recovery failed, may need manual intervention');
            return false;

        } catch (error) {
            console.error('Recovery error:', error);
            return false;
        }
    }

    async getFileCount() {
        try {
            const { stdout } = await execAsync(`ls -la ${CONFIG.authPath} 2>/dev/null | wc -l`);
            return parseInt(stdout.trim()) - 3; // Subtract . and .. and total line
        } catch (error) {
            return 0;
        }
    }

    async sendAlert(message) {
        console.log(`🚨 ALERT: ${message}`);

        // Check if Telegram bot is configured
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;

        console.log(`📱 Telegram config: Token=${telegramToken ? 'present' : 'missing'}, ChatID=${telegramChatId || 'missing'}`);

        if (telegramToken && telegramChatId) {
            try {
                const response = await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                    chat_id: telegramChatId,
                    text: `🚨 WhatsApp Alert\n\n${message}\n\nTime: ${new Date().toLocaleString('ru-RU', {timeZone: 'Europe/Moscow'})}`,
                    parse_mode: 'HTML'
                });
                console.log('✅ Telegram alert sent successfully');
            } catch (error) {
                console.error('❌ Failed to send Telegram alert:', error.message);
                if (error.response) {
                    console.error('Telegram API response:', error.response.data);
                }
            }
        } else {
            console.log('⚠️  Telegram notifications not configured');
        }
    }

    async monitor() {
        console.log('👁️  Starting WhatsApp connection monitor...');

        setInterval(async () => {
            // Check if cleanup is in progress (flag file exists)
            const flagFile = `/tmp/whatsapp-cleanup-${CONFIG.companyId}.flag`;
            try {
                await execAsync(`[ -f ${flagFile} ]`);
                console.log('🧹 Cleanup in progress, skipping recovery check...');
                return;
            } catch (err) {
                // Flag file doesn't exist, proceed with normal check
            }

            const status = await this.checkStatus();

            if (!status.status || !status.status.connected) {
                console.log(`❌ WhatsApp disconnected at ${new Date().toISOString()}`);

                // Check if it's a temporary disconnect
                const timeSinceHealthy = Date.now() - this.lastHealthyTime;
                if (timeSinceHealthy > 300000) { // 5 minutes
                    await this.recover();
                } else {
                    console.log('Waiting for auto-reconnect...');
                }
            } else {
                if (this.retryCount > 0) {
                    console.log('✅ WhatsApp reconnected successfully');
                    this.retryCount = 0;
                }
                this.lastHealthyTime = Date.now();
            }
        }, CONFIG.checkInterval);
    }

    async checkAuthFiles() {
        try {
            const { stdout } = await execAsync(`ls -la ${CONFIG.authPath} 2>/dev/null | wc -l`);
            const fileCount = parseInt(stdout.trim()) - 3; // Subtract . and .. and total line

            // New safer thresholds based on Signal Protocol research
            if (fileCount < 100) {
                // Everything is fine, just log for monitoring
                if (fileCount > 80) {
                    console.log(`📊 Auth files: ${fileCount} (healthy but monitoring)`);
                }
            } else if (fileCount < 150) {
                // Monitoring zone - alert but don't act yet
                console.warn(`⚠️  Auth files: ${fileCount} - Approaching threshold`);
                if (fileCount > 120) {
                    await this.sendAlert(`⚠️ WhatsApp auth files: ${fileCount}\nApproaching cleanup threshold (150).\nConsider manual cleanup soon.`);
                }
            } else if (fileCount < 180) {
                // Warning zone - try smart cleanup
                console.warn(`🔴 Auth files: ${fileCount} - Cleanup needed!`);
                await this.sendAlert(`🔴 WhatsApp auth files: ${fileCount}\nAttempting smart cleanup to prevent issues...`);

                try {
                    // IMPORTANT: Only cleanup if WhatsApp is disconnected
                    const status = await this.checkStatus();
                    if (status.status && status.status.connected) {
                        console.error('Cannot cleanup while connected! Will retry when disconnected.');
                        await this.sendAlert(`⚠️ Cannot cleanup while WhatsApp is connected.\nFiles: ${fileCount}\nWill retry when disconnected.`);
                        return;
                    }

                    const SmartCleanup = require('./whatsapp-smart-cleanup');
                    const cleanup = new SmartCleanup();
                    const stats = await cleanup.cleanup();

                    const newCount = fileCount - stats.removed;
                    console.log(`✅ Smart cleanup completed. Files: ${fileCount} → ${newCount}`);

                    if (newCount < 150) {
                        await this.sendAlert(`✅ WhatsApp cleanup successful!\nFiles: ${fileCount} → ${newCount}\nSystem healthy again.`);
                    } else {
                        await this.sendAlert(`⚠️ Cleanup partial success.\nFiles: ${fileCount} → ${newCount}\nStill above safe threshold. Manual intervention may be needed.`);
                    }
                } catch (cleanupError) {
                    console.error('Smart cleanup failed:', cleanupError.message);
                    await this.sendAlert(`❌ Smart cleanup failed: ${cleanupError.message}\nFiles: ${fileCount}\nManual intervention required!`);
                }
            } else {
                // CRITICAL - Risk of device_removed
                console.error(`💀 CRITICAL: ${fileCount} files! Risk of device_removed!`);
                await this.sendAlert(`🚨 CRITICAL WhatsApp Issue!\n\nFiles: ${fileCount}\nRisk of device_removed error!\n\nIMMediate action required:\n1. Stop WhatsApp\n2. Run manual cleanup\n3. Restart\n\nDo NOT wait or connection will be lost!`);

                // Only attempt full recovery if over 200 files (last resort)
                if (fileCount > 200) {
                    console.error('File count exceeds 200 - attempting emergency recovery');
                    await this.sendAlert(`💀 Emergency recovery initiated.\nFiles: ${fileCount}\nMay require QR code rescan.`);
                    await this.cleanupAuth();
                    await this.recover();
                }
            }
        } catch (error) {
            // Directory doesn't exist, which is fine
        }
    }

    async start() {
        console.log('🚀 WhatsApp Auto-Recovery Service Started');
        console.log(`📊 Config: API=${CONFIG.apiUrl}, Company=${CONFIG.companyId}`);

        // Initial status check
        const status = await this.checkStatus();
        if (status.status && status.status.connected) {
            console.log('✅ WhatsApp is connected');
        } else {
            console.log('❌ WhatsApp is not connected');
            await this.recover();
        }

        // Start monitoring
        this.monitor();

        // Check auth files periodically
        setInterval(() => this.checkAuthFiles(), 3600000); // Every hour
    }
}

// Start the recovery service
const recovery = new WhatsAppRecovery();
recovery.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down WhatsApp recovery service...');
    process.exit(0);
});