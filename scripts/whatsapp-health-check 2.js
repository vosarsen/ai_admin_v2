#!/usr/bin/env node

/**
 * WhatsApp Health Check Dashboard
 * Quick status check for all WhatsApp components
 */

const axios = require('axios');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const chalk = require('chalk');

class HealthChecker {
    constructor() {
        this.baseAuthPath = '/opt/ai-admin/baileys_sessions';
        this.backupPath = '/opt/ai-admin/whatsapp-backups';
        this.apiUrl = 'http://localhost:3000';
    }

    async checkWhatsAppStatus(companyId) {
        try {
            const response = await axios.get(`${this.apiUrl}/webhook/whatsapp/baileys/status/${companyId}`, {
                timeout: 5000
            });
            return {
                connected: response.data?.status?.connected || false,
                details: response.data
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }

    async checkAuthFiles(companyId) {
        const authPath = `${this.baseAuthPath}/company_${companyId}`;

        if (!await fs.pathExists(authPath)) {
            return {
                exists: false,
                fileCount: 0
            };
        }

        const files = await fs.readdir(authPath);
        const credsExists = await fs.pathExists(`${authPath}/creds.json`);

        return {
            exists: true,
            fileCount: files.length,
            credsExists,
            status: this.getFileCountStatus(files.length)
        };
    }

    getFileCountStatus(count) {
        if (count < 50) return { level: 'excellent', emoji: '✅' };
        if (count < 100) return { level: 'healthy', emoji: '✅' };
        if (count < 120) return { level: 'monitor', emoji: '👀' };
        if (count < 150) return { level: 'warning', emoji: '⚠️' };
        if (count < 180) return { level: 'critical', emoji: '🔴' };
        return { level: 'danger', emoji: '💀' };
    }

    async checkBackups(companyId) {
        const backupDir = `${this.backupPath}/company_${companyId}`;

        if (!await fs.pathExists(backupDir)) {
            return {
                hasBackups: false,
                count: 0
            };
        }

        const backups = await fs.readdir(backupDir);
        const validBackups = backups.filter(b => b.startsWith('backup_'));

        let latestBackup = null;
        if (validBackups.length > 0) {
            // Sort backups by date (newest first)
            validBackups.sort().reverse();
            const latestPath = `${backupDir}/${validBackups[0]}/metadata.json`;

            if (await fs.pathExists(latestPath)) {
                const metadata = await fs.readJson(latestPath);
                latestBackup = {
                    name: validBackups[0],
                    timestamp: metadata.timestamp,
                    age: this.getAge(new Date(metadata.timestamp))
                };
            }
        }

        return {
            hasBackups: validBackups.length > 0,
            count: validBackups.length,
            latest: latestBackup
        };
    }

    getAge(date) {
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} days ago`;
        if (hours > 0) return `${hours} hours ago`;
        return 'just now';
    }

    async checkProcesses() {
        try {
            const { stdout } = await execAsync('pm2 jlist');
            const processes = JSON.parse(stdout);

            const relevantProcesses = [
                'ai-admin-api',
                'ai-admin-worker-v2',
                'whatsapp-monitor',
                'whatsapp-auto-cleanup'
            ];

            const result = {};
            relevantProcesses.forEach(name => {
                const proc = processes.find(p => p.name === name);
                if (proc) {
                    result[name] = {
                        status: proc.pm2_env.status,
                        uptime: proc.pm2_env.pm_uptime ? new Date(proc.pm2_env.pm_uptime).toISOString() : null,
                        restarts: proc.pm2_env.restart_time,
                        memory: Math.round(proc.monit.memory / 1024 / 1024) + 'MB'
                    };
                } else {
                    result[name] = { status: 'not_found' };
                }
            });

            return result;
        } catch (error) {
            return { error: error.message };
        }
    }

    async getCompanies() {
        if (!await fs.pathExists(this.baseAuthPath)) {
            return [];
        }

        const dirs = await fs.readdir(this.baseAuthPath);
        return dirs
            .filter(d => d.startsWith('company_'))
            .map(d => d.replace('company_', ''));
    }

    async generateReport() {
        console.clear();
        console.log(chalk.bold.blue('\n📊 WhatsApp Health Check Dashboard\n'));
        console.log(chalk.gray('Generated at: ' + new Date().toLocaleString()));
        console.log(chalk.gray('=' .repeat(60)));

        // Check processes
        console.log(chalk.bold.yellow('\n🔧 Process Status:'));
        const processes = await this.checkProcesses();

        for (const [name, info] of Object.entries(processes)) {
            if (info.error) {
                console.log(`  ${chalk.red('❌')} ${name}: ${chalk.red(info.error)}`);
            } else if (info.status === 'online') {
                console.log(`  ${chalk.green('✅')} ${name}: ${chalk.green('running')} (restarts: ${info.restarts}, mem: ${info.memory})`);
            } else if (info.status === 'not_found') {
                console.log(`  ${chalk.gray('⚪')} ${name}: ${chalk.gray('not running')}`);
            } else {
                console.log(`  ${chalk.red('❌')} ${name}: ${chalk.red(info.status)}`);
            }
        }

        // Check companies
        const companies = await this.getCompanies();
        console.log(chalk.bold.yellow(`\n🏢 Companies (${companies.length}):\n`));

        for (const companyId of companies) {
            console.log(chalk.bold.cyan(`Company ${companyId}:`));

            // WhatsApp status
            const whatsappStatus = await this.checkWhatsAppStatus(companyId);
            if (whatsappStatus.connected) {
                console.log(`  WhatsApp: ${chalk.green('✅ Connected')}`);
            } else {
                console.log(`  WhatsApp: ${chalk.red('❌ Disconnected')} ${whatsappStatus.error ? `(${whatsappStatus.error})` : ''}`);
            }

            // Auth files
            const authFiles = await this.checkAuthFiles(companyId);
            if (!authFiles.exists) {
                console.log(`  Auth Files: ${chalk.red('❌ Directory missing')}`);
            } else {
                const status = authFiles.status;
                const countColor = status.level === 'excellent' || status.level === 'healthy' ? 'green' :
                                 status.level === 'monitor' ? 'yellow' :
                                 status.level === 'warning' ? 'magenta' : 'red';

                console.log(`  Auth Files: ${status.emoji} ${chalk[countColor](`${authFiles.fileCount} files`)} (${status.level})`);

                if (!authFiles.credsExists) {
                    console.log(`  ${chalk.red('⚠️  creds.json MISSING - QR scan required!')}`);
                }
            }

            // Backups
            const backups = await this.checkBackups(companyId);
            if (!backups.hasBackups) {
                console.log(`  Backups: ${chalk.yellow('⚠️  No backups')}`);
            } else {
                console.log(`  Backups: ${chalk.green('✅')} ${backups.count} backups`);
                if (backups.latest) {
                    console.log(`    Latest: ${backups.latest.age}`);
                }
            }

            console.log();
        }

        // Recommendations
        console.log(chalk.bold.yellow('📝 Recommendations:\n'));

        let hasIssues = false;

        // Check for missing creds
        for (const companyId of companies) {
            const authFiles = await this.checkAuthFiles(companyId);
            if (authFiles.exists && !authFiles.credsExists) {
                console.log(chalk.red(`  🚨 Company ${companyId}: Scan QR code at http://46.149.70.219:3000/whatsapp-connect.html?company=${companyId}`));
                hasIssues = true;
            }
        }

        // Check for high file counts
        for (const companyId of companies) {
            const authFiles = await this.checkAuthFiles(companyId);
            if (authFiles.fileCount > 150) {
                console.log(chalk.yellow(`  ⚠️  Company ${companyId}: Run cleanup - node scripts/whatsapp-smart-cleanup.js`));
                hasIssues = true;
            }
        }

        // Check for missing processes
        if (processes['whatsapp-monitor']?.status !== 'online') {
            console.log(chalk.yellow('  ⚠️  Start monitoring: pm2 start scripts/whatsapp-auto-recovery.js --name whatsapp-monitor'));
            hasIssues = true;
        }

        if (!hasIssues) {
            console.log(chalk.green('  ✅ All systems healthy!'));
        }

        console.log(chalk.gray('\n' + '=' .repeat(60)));
    }
}

// Run health check
(async () => {
    const checker = new HealthChecker();
    await checker.generateReport();

    // Auto-refresh every 30 seconds if --watch flag is provided
    if (process.argv.includes('--watch')) {
        setInterval(async () => {
            await checker.generateReport();
        }, 30000);
    }
})().catch(console.error);