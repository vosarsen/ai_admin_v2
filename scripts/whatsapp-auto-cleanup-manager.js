#!/usr/bin/env node

/**
 * WhatsApp Auto Cleanup Manager
 * Fully automated cleanup with temporary WhatsApp disconnection
 *
 * Strategy:
 * 1. Monitor file counts
 * 2. At 150+ files, schedule cleanup
 * 3. Temporarily disconnect WhatsApp (30 seconds)
 * 4. Run cleanup
 * 5. Reconnect WhatsApp
 * 6. Verify success
 */

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class AutoCleanupManager {
    constructor() {
        this.isCleaningInProgress = new Map(); // Track per-company cleanup
        this.lastCleanupTime = new Map();
        this.baseAuthPath = '/opt/ai-admin/baileys_sessions';
        this.apiUrl = 'http://localhost:3000';
    }

    /**
     * Load company thresholds
     */
    async getCompanyThresholds(companyId) {
        try {
            const configPath = path.join(__dirname, '../config/company-thresholds.json');
            if (await fs.pathExists(configPath)) {
                const config = await fs.readJson(configPath);
                return config.companies[companyId] || config.default;
            }
        } catch (error) {
            console.warn('Using default thresholds');
        }

        return {
            monitor: 100,
            warning: 120,
            cleanup: 150,
            critical: 180,
            fatal: 200
        };
    }

    /**
     * Check if company needs cleanup
     */
    async checkCompany(companyId) {
        const authPath = path.join(this.baseAuthPath, `company_${companyId}`);

        if (!await fs.pathExists(authPath)) {
            return null;
        }

        const files = await fs.readdir(authPath);
        const fileCount = files.length;
        const thresholds = await this.getCompanyThresholds(companyId);

        return {
            companyId,
            fileCount,
            thresholds,
            needsCleanup: fileCount >= thresholds.cleanup,
            isCritical: fileCount >= thresholds.critical,
            authPath
        };
    }

    /**
     * Check WhatsApp connection status
     */
    async isWhatsAppConnected(companyId) {
        try {
            const response = await axios.get(`${this.apiUrl}/webhook/whatsapp/baileys/status/${companyId}`);
            return response.data?.status?.connected || false;
        } catch (error) {
            console.error(`Failed to check status for ${companyId}:`, error.message);
            return null;
        }
    }

    /**
     * Temporarily disconnect WhatsApp for cleanup
     */
    async temporarilyDisconnectWhatsApp(companyId) {
        console.log(`🔌 Temporarily disconnecting WhatsApp for company ${companyId}...`);

        try {
            // Try graceful disconnect through API
            await axios.post(`${this.apiUrl}/api/whatsapp/sessions/${companyId}/disconnect`);
            console.log(`✅ WhatsApp disconnected for ${companyId}`);

            // Wait for disconnect to take effect
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
        } catch (error) {
            console.warn(`Could not disconnect via API, trying session removal...`);

            // Alternative: Remove from session pool (will auto-reconnect)
            try {
                const { stdout } = await execAsync(`pm2 list | grep ai-admin-api | awk '{print $2}'`);
                const apiProcessId = stdout.trim();

                if (apiProcessId) {
                    // Send signal to API to remove session
                    await execAsync(`pm2 trigger ${apiProcessId} remove-session ${companyId}`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    return true;
                }
            } catch (err) {
                console.error(`Failed to disconnect: ${err.message}`);
            }
        }

        return false;
    }

    /**
     * Reconnect WhatsApp after cleanup
     */
    async reconnectWhatsApp(companyId) {
        console.log(`🔄 Reconnecting WhatsApp for company ${companyId}...`);

        try {
            // Initialize session through API
            await axios.post(`${this.apiUrl}/webhook/whatsapp/baileys/init/${companyId}`);

            // Wait for connection
            let attempts = 0;
            while (attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const connected = await this.isWhatsAppConnected(companyId);
                if (connected) {
                    console.log(`✅ WhatsApp reconnected for ${companyId}`);
                    return true;
                }
                attempts++;
            }
        } catch (error) {
            console.error(`Failed to reconnect: ${error.message}`);
        }

        return false;
    }

    /**
     * Run cleanup for a company
     */
    async runCleanup(companyId, authPath) {
        console.log(`🧹 Running smart cleanup for company ${companyId}...`);

        try {
            const { stdout } = await execAsync(
                `cd /opt/ai-admin && COMPANY_ID=${companyId} AUTH_PATH=${authPath} node scripts/whatsapp-smart-cleanup.js`,
                { timeout: 30000 }
            );

            // Parse cleanup results
            const removedMatch = stdout.match(/Removed: (\d+)/);
            const finalMatch = stdout.match(/Final count: (\d+)/);

            return {
                success: true,
                filesRemoved: removedMatch ? parseInt(removedMatch[1]) : 0,
                finalCount: finalMatch ? parseInt(finalMatch[1]) : 0,
                output: stdout
            };
        } catch (error) {
            console.error(`Cleanup failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send alert via Telegram
     */
    async sendAlert(message, critical = false) {
        console.log(`${critical ? '🚨' : '📢'} ${message}`);

        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            try {
                await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: process.env.TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: 'HTML'
                });
            } catch (error) {
                console.error('Failed to send Telegram alert:', error.message);
            }
        }
    }

    /**
     * Perform automated cleanup process
     */
    async performAutomatedCleanup(company) {
        const { companyId, fileCount, authPath, isCritical } = company;

        // Check if cleanup already in progress
        if (this.isCleaningInProgress.get(companyId)) {
            console.log(`⏳ Cleanup already in progress for ${companyId}`);
            return;
        }

        // Check cooldown (don't clean same company more than once per hour)
        const lastCleanup = this.lastCleanupTime.get(companyId) || 0;
        if (Date.now() - lastCleanup < 3600000) {
            console.log(`⏰ Cleanup cooldown active for ${companyId}`);
            return;
        }

        this.isCleaningInProgress.set(companyId, true);

        try {
            await this.sendAlert(
                `🤖 Auto Cleanup Starting\n\n` +
                `Company: ${companyId}\n` +
                `Files: ${fileCount}\n` +
                `Status: ${isCritical ? 'CRITICAL' : 'Warning'}\n\n` +
                `WhatsApp will be briefly disconnected (30 seconds)`,
                isCritical
            );

            // Step 1: Check if connected
            const isConnected = await this.isWhatsAppConnected(companyId);

            // Step 2: Disconnect if needed
            let wasDisconnected = false;
            if (isConnected) {
                wasDisconnected = await this.temporarilyDisconnectWhatsApp(companyId);
                if (!wasDisconnected) {
                    throw new Error('Could not disconnect WhatsApp for cleanup');
                }

                // Wait for disconnect to complete
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Step 3: Run cleanup
            const cleanupResult = await this.runCleanup(companyId, authPath);

            if (!cleanupResult.success) {
                throw new Error(`Cleanup failed: ${cleanupResult.error}`);
            }

            // Step 4: Reconnect if we disconnected
            if (wasDisconnected) {
                const reconnected = await this.reconnectWhatsApp(companyId);
                if (!reconnected) {
                    await this.sendAlert(
                        `⚠️ Cleanup completed but reconnection failed!\n\n` +
                        `Company: ${companyId}\n` +
                        `Files removed: ${cleanupResult.filesRemoved}\n` +
                        `Final count: ${cleanupResult.finalCount}\n\n` +
                        `Please check WhatsApp connection manually!`,
                        true
                    );
                }
            }

            // Step 5: Report success
            await this.sendAlert(
                `✅ Auto Cleanup Completed!\n\n` +
                `Company: ${companyId}\n` +
                `Files: ${fileCount} → ${cleanupResult.finalCount}\n` +
                `Removed: ${cleanupResult.filesRemoved} files\n` +
                `WhatsApp: ${wasDisconnected ? 'Reconnected' : 'Was already disconnected'}\n\n` +
                `System is healthy again!`
            );

            this.lastCleanupTime.set(companyId, Date.now());

        } catch (error) {
            console.error(`Auto cleanup failed for ${companyId}:`, error);

            await this.sendAlert(
                `❌ Auto Cleanup Failed!\n\n` +
                `Company: ${companyId}\n` +
                `Error: ${error.message}\n\n` +
                `MANUAL INTERVENTION REQUIRED!\n` +
                `Files: ${fileCount}`,
                true
            );

        } finally {
            this.isCleaningInProgress.set(companyId, false);
        }
    }

    /**
     * Monitor all companies
     */
    async monitorAllCompanies() {
        try {
            // Discover all companies
            if (!await fs.pathExists(this.baseAuthPath)) {
                console.warn('Base auth path does not exist');
                return;
            }

            const dirs = await fs.readdir(this.baseAuthPath);
            const companies = [];

            for (const dir of dirs) {
                if (dir.startsWith('company_')) {
                    const companyId = dir.replace('company_', '');
                    const company = await this.checkCompany(companyId);

                    if (company && company.needsCleanup) {
                        companies.push(company);
                    }
                }
            }

            // Process companies that need cleanup
            if (companies.length > 0) {
                console.log(`📊 ${companies.length} companies need cleanup`);

                // Sort by file count (most critical first)
                companies.sort((a, b) => b.fileCount - a.fileCount);

                // Process each company
                for (const company of companies) {
                    if (company.fileCount >= company.thresholds.cleanup) {
                        console.log(`Company ${company.companyId}: ${company.fileCount} files - needs cleanup`);
                        await this.performAutomatedCleanup(company);

                        // Wait between cleanups to avoid overload
                        if (companies.length > 1) {
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Monitor error:', error);
        }
    }

    /**
     * Start the automated cleanup manager
     */
    async start() {
        console.log('🚀 WhatsApp Auto Cleanup Manager Started');
        console.log('📊 Will automatically clean companies at 150+ files');
        console.log('⏱️  Check interval: 5 minutes\n');

        // Initial check
        await this.monitorAllCompanies();

        // Schedule regular checks every 5 minutes
        setInterval(() => {
            console.log(`🔄 Running cleanup check at ${new Date().toLocaleTimeString()}...`);
            this.monitorAllCompanies();
        }, 300000); // 5 minutes
    }
}

// Start the manager
const manager = new AutoCleanupManager();
manager.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Auto Cleanup Manager stopped');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Auto Cleanup Manager stopped');
    process.exit(0);
});