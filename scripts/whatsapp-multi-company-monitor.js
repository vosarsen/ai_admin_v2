#!/usr/bin/env node

/**
 * Multi-Company WhatsApp Monitor
 * Monitors all connected companies for auth file accumulation
 */

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const CONFIG = {
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    checkInterval: 60000, // Check every minute
    baseAuthPath: '/opt/ai-admin/baileys_sessions',
    maxRetries: 3
};

class MultiCompanyMonitor {
    constructor() {
        this.companies = new Map();
        this.retryCount = new Map();
    }

    /**
     * Discover all companies with auth directories
     */
    async discoverCompanies() {
        try {
            const companies = [];

            if (!await fs.pathExists(CONFIG.baseAuthPath)) {
                console.error('❌ Base auth path does not exist:', CONFIG.baseAuthPath);
                return companies;
            }

            const dirs = await fs.readdir(CONFIG.baseAuthPath);

            for (const dir of dirs) {
                if (dir.startsWith('company_')) {
                    const companyId = dir.replace('company_', '');
                    const fullPath = path.join(CONFIG.baseAuthPath, dir);

                    const stats = await fs.stat(fullPath);
                    if (stats.isDirectory()) {
                        companies.push({
                            id: companyId,
                            path: fullPath,
                            directory: dir
                        });
                    }
                }
            }

            console.log(`📊 Discovered ${companies.length} companies:`, companies.map(c => c.id).join(', '));
            return companies;

        } catch (error) {
            console.error('Failed to discover companies:', error);
            return [];
        }
    }

    /**
     * Check auth files for a specific company
     */
    async checkCompanyAuthFiles(company) {
        try {
            const files = await fs.readdir(company.path);
            const fileCount = files.length;

            // Count specific file types
            const stats = {
                total: fileCount,
                preKeys: files.filter(f => f.startsWith('pre-key-')).length,
                sessions: files.filter(f => f.startsWith('session-')).length,
                senderKeys: files.filter(f => f.startsWith('sender-key-')).length,
                critical: files.filter(f => f === 'creds.json' || f.startsWith('app-state-sync-')).length
            };

            return stats;
        } catch (error) {
            console.error(`Failed to check files for ${company.id}:`, error.message);
            return null;
        }
    }

    /**
     * Check WhatsApp status for a company
     */
    async checkCompanyStatus(companyId) {
        try {
            const response = await axios.get(`${CONFIG.apiUrl}/webhook/whatsapp/baileys/status/${companyId}`);
            return response.data?.status?.connected || false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Send alert for company issues
     */
    async sendAlert(message, severity = 'warning') {
        console.log(`${severity === 'critical' ? '🚨' : '⚠️'} Alert: ${message}`);

        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            try {
                await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: process.env.TELEGRAM_CHAT_ID,
                    text: `${severity === 'critical' ? '🚨' : '⚠️'} Multi-Company Monitor\n\n${message}`,
                    parse_mode: 'HTML'
                });
            } catch (error) {
                console.error('Failed to send Telegram alert:', error.message);
            }
        }
    }

    /**
     * Process monitoring for a single company
     */
    async monitorCompany(company) {
        const stats = await this.checkCompanyAuthFiles(company);
        if (!stats) return;

        const isConnected = await this.checkCompanyStatus(company.id);

        // Store company state
        this.companies.set(company.id, {
            ...company,
            stats,
            isConnected,
            lastCheck: Date.now()
        });

        // Evaluate health
        const health = this.evaluateHealth(stats);

        // Log status
        console.log(`Company ${company.id}: ${stats.total} files, ${isConnected ? '✅ Connected' : '❌ Disconnected'}, Health: ${health.status}`);

        // Send alerts based on thresholds
        if (stats.total >= 180) {
            await this.sendAlert(
                `CRITICAL: Company ${company.id}\n` +
                `Files: ${stats.total} (${stats.preKeys} pre-keys, ${stats.sessions} sessions)\n` +
                `Status: ${isConnected ? 'Connected' : 'Disconnected'}\n` +
                `Risk of device_removed! Immediate action required!`,
                'critical'
            );
        } else if (stats.total >= 150) {
            await this.sendAlert(
                `Warning: Company ${company.id}\n` +
                `Files: ${stats.total} (${stats.preKeys} pre-keys, ${stats.sessions} sessions)\n` +
                `Cleanup needed within 24 hours`
            );
        } else if (stats.total >= 120) {
            // Log but don't alert yet
            console.warn(`⚠️  Company ${company.id} approaching threshold: ${stats.total} files`);
        }

        return health;
    }

    /**
     * Evaluate health status based on file stats
     */
    evaluateHealth(stats) {
        if (stats.total < 50) {
            return { status: '✅ Excellent', risk: 'minimal' };
        } else if (stats.total < 100) {
            return { status: '✅ Healthy', risk: 'low' };
        } else if (stats.total < 120) {
            return { status: '⚠️  Monitor', risk: 'moderate' };
        } else if (stats.total < 150) {
            return { status: '⚠️  Warning', risk: 'elevated' };
        } else if (stats.total < 180) {
            return { status: '🔴 Critical', risk: 'high' };
        } else {
            return { status: '💀 DANGER', risk: 'extreme' };
        }
    }

    /**
     * Generate monitoring report
     */
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Multi-Company WhatsApp Monitoring Report');
        console.log('='.repeat(60));

        const companies = Array.from(this.companies.values());

        if (companies.length === 0) {
            console.log('No companies being monitored');
            return;
        }

        // Sort by file count (worst first)
        companies.sort((a, b) => b.stats.total - a.stats.total);

        for (const company of companies) {
            const health = this.evaluateHealth(company.stats);
            console.log(`\nCompany: ${company.id}`);
            console.log(`  Status: ${company.isConnected ? '✅ Connected' : '❌ Disconnected'}`);
            console.log(`  Health: ${health.status}`);
            console.log(`  Files: ${company.stats.total} total`);
            console.log(`    - Pre-keys: ${company.stats.preKeys}`);
            console.log(`    - Sessions: ${company.stats.sessions}`);
            console.log(`    - Sender-keys: ${company.stats.senderKeys}`);
            console.log(`    - Critical: ${company.stats.critical}`);

            if (company.stats.total >= 120) {
                console.log(`  ⚠️  ACTION: ${
                    company.stats.total >= 180 ? 'IMMEDIATE cleanup required!' :
                    company.stats.total >= 150 ? 'Schedule cleanup within 24h' :
                    'Monitor closely'
                }`);
            }
        }

        // Summary
        console.log('\n' + '-'.repeat(60));
        const criticalCompanies = companies.filter(c => c.stats.total >= 150);
        const warningCompanies = companies.filter(c => c.stats.total >= 120 && c.stats.total < 150);

        console.log('Summary:');
        console.log(`  Total companies: ${companies.length}`);
        console.log(`  Critical (>150 files): ${criticalCompanies.length}`);
        console.log(`  Warning (120-150 files): ${warningCompanies.length}`);
        console.log(`  Healthy (<120 files): ${companies.length - criticalCompanies.length - warningCompanies.length}`);

        if (criticalCompanies.length > 0) {
            console.log('\n🚨 CRITICAL Companies requiring immediate attention:');
            criticalCompanies.forEach(c => {
                console.log(`  - ${c.id}: ${c.stats.total} files`);
            });
        }

        console.log('='.repeat(60) + '\n');
    }

    /**
     * Run cleanup for a specific company (if safe)
     */
    async runCleanupForCompany(companyId) {
        const company = this.companies.get(companyId);
        if (!company) {
            console.error(`Company ${companyId} not found`);
            return;
        }

        if (company.isConnected) {
            console.error(`Cannot cleanup ${companyId} while connected`);
            return;
        }

        console.log(`🧹 Running cleanup for company ${companyId}...`);

        try {
            const { stdout } = await execAsync(`cd /opt/ai-admin && AUTH_PATH=${company.path} node scripts/whatsapp-smart-cleanup.js`);
            console.log(stdout);

            // Re-check after cleanup
            await this.monitorCompany(company);

        } catch (error) {
            console.error(`Cleanup failed for ${companyId}:`, error.message);
        }
    }

    /**
     * Main monitoring loop
     */
    async start() {
        console.log('🚀 Multi-Company WhatsApp Monitor Started');
        console.log(`📊 Config: API=${CONFIG.apiUrl}`);
        console.log(`📁 Base path: ${CONFIG.baseAuthPath}`);
        console.log(`⏱️  Check interval: ${CONFIG.checkInterval / 1000}s\n`);

        // Initial discovery and check
        const companies = await this.discoverCompanies();

        for (const company of companies) {
            await this.monitorCompany(company);
        }

        this.generateReport();

        // Schedule regular checks
        setInterval(async () => {
            console.log(`\n🔄 Running scheduled check at ${new Date().toLocaleTimeString()}...`);

            // Re-discover companies (in case new ones added)
            const companies = await this.discoverCompanies();

            const alerts = [];
            for (const company of companies) {
                const health = await this.monitorCompany(company);
                if (health.risk === 'high' || health.risk === 'extreme') {
                    alerts.push(company);
                }
            }

            // Generate report every hour
            if (new Date().getMinutes() === 0) {
                this.generateReport();
            }

            // Send summary alert if multiple companies have issues
            if (alerts.length > 1) {
                await this.sendAlert(
                    `Multiple companies need attention:\n` +
                    alerts.map(c => `- ${c.id}: ${c.stats.total} files`).join('\n')
                );
            }

        }, CONFIG.checkInterval);
    }
}

// Start the monitor
const monitor = new MultiCompanyMonitor();
monitor.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Multi-Company Monitor stopped');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Multi-Company Monitor stopped');
    process.exit(0);
});