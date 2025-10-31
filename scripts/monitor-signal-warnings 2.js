#!/usr/bin/env node

/**
 * Monitor for Signal Protocol warnings in logs
 * Detects early signs of authentication issues before they become critical
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
require('dotenv').config();

// Configuration
const CHECK_INTERVAL = 60000; // Check every minute
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Warning patterns to monitor
const WARNING_PATTERNS = [
    {
        pattern: 'Closing stale open session',
        severity: 'high',
        message: 'Signal Protocol is closing stale sessions - may indicate key accumulation'
    },
    {
        pattern: 'device_removed',
        severity: 'critical',
        message: 'CRITICAL: WhatsApp has removed device authorization!'
    },
    {
        pattern: 'waiting for message',
        severity: 'medium',
        message: 'Messages stuck waiting - possible encryption issue'
    },
    {
        pattern: 'Decryption failed',
        severity: 'high',
        message: 'Message decryption failures detected'
    },
    {
        pattern: 'prekey bundle',
        severity: 'low',
        message: 'Pre-key bundle activity detected'
    },
    {
        pattern: 'Connection Closed',
        severity: 'medium',
        message: 'WhatsApp connection was closed'
    },
    {
        pattern: 'Connection replaced',
        severity: 'high',
        message: 'WhatsApp connection replaced - possible duplicate session'
    }
];

class SignalMonitor {
    constructor() {
        this.lastAlerts = new Map();
        this.alertCooldown = 300000; // 5 minutes between same alerts
    }

    async checkLogs() {
        try {
            // Check last 100 lines of logs
            const { stdout } = await execAsync('pm2 logs ai-admin-api --nostream --lines 100 2>&1');

            for (const warning of WARNING_PATTERNS) {
                if (stdout.includes(warning.pattern)) {
                    await this.handleWarning(warning, stdout);
                }
            }

            // Also check worker logs
            const { stdout: workerLogs } = await execAsync('pm2 logs ai-admin-worker-v2 --nostream --lines 100 2>&1');

            for (const warning of WARNING_PATTERNS) {
                if (workerLogs.includes(warning.pattern)) {
                    await this.handleWarning(warning, workerLogs);
                }
            }

        } catch (error) {
            console.error('Failed to check logs:', error.message);
        }
    }

    async handleWarning(warning, logContent) {
        // Check cooldown
        const lastAlert = this.lastAlerts.get(warning.pattern);
        if (lastAlert && Date.now() - lastAlert < this.alertCooldown) {
            return; // Skip if recently alerted
        }

        // Count occurrences
        const occurrences = (logContent.match(new RegExp(warning.pattern, 'g')) || []).length;

        console.warn(`⚠️  Detected: ${warning.pattern} (${occurrences} occurrences)`);

        // Send alert based on severity
        if (warning.severity === 'critical') {
            await this.sendAlert(
                `🚨 CRITICAL Signal Protocol Warning!\n\n` +
                `Pattern: ${warning.pattern}\n` +
                `${warning.message}\n` +
                `Occurrences: ${occurrences}\n\n` +
                `IMMEDIATE ACTION REQUIRED!`
            );
        } else if (warning.severity === 'high' && occurrences > 5) {
            await this.sendAlert(
                `⚠️ Signal Protocol Warning\n\n` +
                `Pattern: ${warning.pattern}\n` +
                `${warning.message}\n` +
                `Occurrences: ${occurrences}\n\n` +
                `Check auth files and consider cleanup.`
            );
        } else if (warning.severity === 'medium' && occurrences > 10) {
            await this.sendAlert(
                `📊 Signal Protocol Notice\n\n` +
                `Pattern: ${warning.pattern}\n` +
                `${warning.message}\n` +
                `Occurrences: ${occurrences}`
            );
        }

        this.lastAlerts.set(warning.pattern, Date.now());
    }

    async checkAuthFileCount() {
        try {
            const { stdout } = await execAsync('ls -la /opt/ai-admin/baileys_sessions/company_962302 2>/dev/null | wc -l');
            const fileCount = parseInt(stdout.trim()) - 3;

            // Alert on critical thresholds
            if (fileCount > 180) {
                await this.sendAlert(
                    `🚨 CRITICAL: Auth files count: ${fileCount}\n\n` +
                    `Risk of device_removed!\n` +
                    `Run cleanup immediately!`
                );
            }

            return fileCount;
        } catch (error) {
            return 0;
        }
    }

    async sendAlert(message) {
        console.log(`📢 Alert: ${message}`);

        if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
            try {
                const axios = require('axios');
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    chat_id: TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: 'HTML'
                });
            } catch (error) {
                console.error('Failed to send Telegram alert:', error.message);
            }
        }
    }

    async start() {
        console.log('🔍 Signal Protocol Monitor Started');
        console.log('Monitoring for authentication warnings...\n');

        // Initial check
        await this.checkLogs();
        const fileCount = await this.checkAuthFileCount();
        console.log(`📊 Current auth files: ${fileCount}`);

        // Schedule regular checks
        setInterval(async () => {
            await this.checkLogs();

            // Check file count every 5 minutes
            if (Date.now() % 300000 < CHECK_INTERVAL) {
                const count = await this.checkAuthFileCount();
                if (count > 100) {
                    console.log(`📊 Auth files: ${count}`);
                }
            }
        }, CHECK_INTERVAL);
    }
}

// Start monitor
const monitor = new SignalMonitor();
monitor.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Signal Protocol Monitor stopped');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Signal Protocol Monitor stopped');
    process.exit(0);
});