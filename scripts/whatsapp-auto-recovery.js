#!/usr/bin/env node
// scripts/whatsapp-auto-recovery.js

/**
 * WhatsApp Auto-Recovery Script
 * Monitors WhatsApp connection and automatically recovers if disconnected
 */

const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const CONFIG = {
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    companyId: process.env.COMPANY_ID || '962302',
    checkInterval: 60000, // Check every minute
    maxRetries: 3,
    authPath: '/opt/ai-admin/baileys_sessions/company_962302'
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
            console.log('🧹 Cleaning up old auth data...');
            await execAsync(`rm -rf ${CONFIG.authPath}/*`);
            console.log('✅ Auth data cleaned');
            return true;
        } catch (error) {
            console.error('Failed to cleanup auth:', error.message);
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
            await this.sendAlert('WhatsApp recovery failed. Manual intervention required.');
            return false;
        }

        // Step 1: Clean up auth data
        await this.cleanupAuth();

        // Step 2: Restart API
        await this.restartAPI();

        // Step 3: Initialize new session
        const init = await this.initializeSession();
        if (!init) {
            console.error('Failed to initialize session');
            return false;
        }

        // Step 4: Wait for QR code generation
        console.log('Waiting for QR code...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 5: Notify about QR code
        await this.generateQRCode();

        return true;
    }

    async sendAlert(message) {
        // You can implement Telegram/email alerts here
        console.log(`🚨 ALERT: ${message}`);

        // If Telegram bot is configured
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            try {
                await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: process.env.TELEGRAM_CHAT_ID,
                    text: `🚨 WhatsApp Alert: ${message}`
                });
            } catch (error) {
                console.error('Failed to send Telegram alert:', error.message);
            }
        }
    }

    async monitor() {
        console.log('👁️  Starting WhatsApp connection monitor...');

        setInterval(async () => {
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

            if (fileCount > 100) {
                console.warn(`⚠️  Too many auth files (${fileCount}). Cleanup recommended.`);
                await this.sendAlert(`Auth directory has ${fileCount} files. Automatic cleanup initiated.`);
                await this.cleanupAuth();
                await this.recover();
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