#!/usr/bin/env node

/**
 * WhatsApp Credentials Backup Manager
 * Maintains backups of critical auth files to prevent data loss
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const logger = require('../src/utils/logger');

class BackupManager {
    constructor() {
        this.backupDir = '/opt/ai-admin/whatsapp-backups';
        this.maxBackups = 5; // Keep last 5 backups per company
    }

    /**
     * Initialize backup directory
     */
    async init() {
        await fs.ensureDir(this.backupDir);
    }

    /**
     * Create backup of critical auth files
     */
    async createBackup(companyId) {
        const authPath = `/opt/ai-admin/baileys_sessions/company_${companyId}`;
        const credsFile = path.join(authPath, 'creds.json');

        // Check if creds.json exists
        if (!await fs.pathExists(credsFile)) {
            console.warn(`No creds.json found for company ${companyId}, skipping backup`);
            return null;
        }

        // Create backup directory for company
        const companyBackupDir = path.join(this.backupDir, `company_${companyId}`);
        await fs.ensureDir(companyBackupDir);

        // Generate backup name with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `backup_${timestamp}`;
        const backupPath = path.join(companyBackupDir, backupName);

        await fs.ensureDir(backupPath);

        try {
            // Backup critical files
            const filesToBackup = [
                'creds.json',
                'app-state-sync-key-AAAAAFnz.json',
                'app-state-sync-version-critical_block.json'
            ];

            let backedUpFiles = [];

            for (const file of filesToBackup) {
                const srcFile = path.join(authPath, file);
                if (await fs.pathExists(srcFile)) {
                    const destFile = path.join(backupPath, file);
                    await fs.copy(srcFile, destFile);
                    backedUpFiles.push(file);
                }
            }

            // Create backup metadata
            const metadata = {
                companyId,
                timestamp: new Date().toISOString(),
                files: backedUpFiles,
                fileCount: backedUpFiles.length
            };

            await fs.writeJson(path.join(backupPath, 'metadata.json'), metadata, { spaces: 2 });

            console.log(`✅ Backup created for company ${companyId}: ${backupName}`);
            console.log(`   Backed up ${backedUpFiles.length} critical files`);

            // Cleanup old backups
            await this.cleanupOldBackups(companyId);

            return backupPath;

        } catch (error) {
            console.error(`Failed to create backup for company ${companyId}:`, error);
            throw error;
        }
    }

    /**
     * Restore from backup
     */
    async restoreBackup(companyId, backupName = null) {
        const companyBackupDir = path.join(this.backupDir, `company_${companyId}`);

        if (!await fs.pathExists(companyBackupDir)) {
            throw new Error(`No backups found for company ${companyId}`);
        }

        let backupPath;

        if (backupName) {
            // Use specified backup
            backupPath = path.join(companyBackupDir, backupName);
        } else {
            // Use latest backup
            const backups = await this.listBackups(companyId);
            if (backups.length === 0) {
                throw new Error(`No backups available for company ${companyId}`);
            }
            backupPath = backups[0].path;
            console.log(`Using latest backup: ${backups[0].name}`);
        }

        if (!await fs.pathExists(backupPath)) {
            throw new Error(`Backup not found: ${backupPath}`);
        }

        // Read metadata
        const metadata = await fs.readJson(path.join(backupPath, 'metadata.json'));
        const authPath = `/opt/ai-admin/baileys_sessions/company_${companyId}`;

        await fs.ensureDir(authPath);

        console.log(`🔄 Restoring backup for company ${companyId}`);
        console.log(`   Backup date: ${metadata.timestamp}`);
        console.log(`   Files to restore: ${metadata.files.length}`);

        // Restore files
        for (const file of metadata.files) {
            const srcFile = path.join(backupPath, file);
            const destFile = path.join(authPath, file);

            if (await fs.pathExists(srcFile)) {
                await fs.copy(srcFile, destFile, { overwrite: true });
                console.log(`   ✅ Restored: ${file}`);
            }
        }

        console.log(`✅ Backup restored successfully for company ${companyId}`);
        return metadata;
    }

    /**
     * List available backups for a company
     */
    async listBackups(companyId) {
        const companyBackupDir = path.join(this.backupDir, `company_${companyId}`);

        if (!await fs.pathExists(companyBackupDir)) {
            return [];
        }

        const backupDirs = await fs.readdir(companyBackupDir);
        const backups = [];

        for (const dir of backupDirs) {
            if (dir.startsWith('backup_')) {
                const backupPath = path.join(companyBackupDir, dir);
                const metadataFile = path.join(backupPath, 'metadata.json');

                if (await fs.pathExists(metadataFile)) {
                    const metadata = await fs.readJson(metadataFile);
                    backups.push({
                        name: dir,
                        path: backupPath,
                        timestamp: metadata.timestamp,
                        fileCount: metadata.fileCount
                    });
                }
            }
        }

        // Sort by timestamp (newest first)
        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return backups;
    }

    /**
     * Cleanup old backups (keep only last N)
     */
    async cleanupOldBackups(companyId) {
        const backups = await this.listBackups(companyId);

        if (backups.length <= this.maxBackups) {
            return;
        }

        // Remove old backups
        const toRemove = backups.slice(this.maxBackups);

        for (const backup of toRemove) {
            try {
                await fs.remove(backup.path);
                console.log(`   🗑️  Removed old backup: ${backup.name}`);
            } catch (error) {
                console.error(`Failed to remove old backup: ${backup.name}`, error);
            }
        }
    }

    /**
     * Verify backup integrity
     */
    async verifyBackup(companyId, backupName = null) {
        const companyBackupDir = path.join(this.backupDir, `company_${companyId}`);

        let backupPath;
        if (backupName) {
            backupPath = path.join(companyBackupDir, backupName);
        } else {
            const backups = await this.listBackups(companyId);
            if (backups.length === 0) {
                console.log('No backups found');
                return false;
            }
            backupPath = backups[0].path;
        }

        try {
            const metadata = await fs.readJson(path.join(backupPath, 'metadata.json'));

            // Check if creds.json exists and is valid JSON
            const credsPath = path.join(backupPath, 'creds.json');
            if (await fs.pathExists(credsPath)) {
                const creds = await fs.readJson(credsPath);
                if (creds && typeof creds === 'object') {
                    console.log(`✅ Backup verified: ${backupName || 'latest'}`);
                    return true;
                }
            }

            console.log(`❌ Backup invalid: ${backupName || 'latest'}`);
            return false;

        } catch (error) {
            console.error('Backup verification failed:', error);
            return false;
        }
    }

    /**
     * Auto-backup all companies
     */
    async backupAllCompanies() {
        const baseAuthPath = '/opt/ai-admin/baileys_sessions';

        if (!await fs.pathExists(baseAuthPath)) {
            console.warn('No auth sessions directory found');
            return;
        }

        const dirs = await fs.readdir(baseAuthPath);
        const companies = [];

        for (const dir of dirs) {
            if (dir.startsWith('company_')) {
                const companyId = dir.replace('company_', '');
                companies.push(companyId);
            }
        }

        console.log(`📦 Creating backups for ${companies.length} companies...`);

        for (const companyId of companies) {
            try {
                await this.createBackup(companyId);
            } catch (error) {
                console.error(`Failed to backup company ${companyId}:`, error.message);
            }
        }

        console.log('✅ Backup process completed');
    }
}

// CLI interface
if (require.main === module) {
    const manager = new BackupManager();
    const command = process.argv[2];
    const companyId = process.argv[3];
    const backupName = process.argv[4];

    (async () => {
        await manager.init();

        switch (command) {
            case 'backup':
                if (!companyId) {
                    console.error('Usage: node whatsapp-backup-manager.js backup <companyId>');
                    process.exit(1);
                }
                await manager.createBackup(companyId);
                break;

            case 'restore':
                if (!companyId) {
                    console.error('Usage: node whatsapp-backup-manager.js restore <companyId> [backupName]');
                    process.exit(1);
                }
                await manager.restoreBackup(companyId, backupName);
                break;

            case 'list':
                if (!companyId) {
                    console.error('Usage: node whatsapp-backup-manager.js list <companyId>');
                    process.exit(1);
                }
                const backups = await manager.listBackups(companyId);
                console.log(`\nAvailable backups for company ${companyId}:`);
                backups.forEach(b => {
                    console.log(`  - ${b.name} (${b.timestamp}, ${b.fileCount} files)`);
                });
                break;

            case 'verify':
                if (!companyId) {
                    console.error('Usage: node whatsapp-backup-manager.js verify <companyId> [backupName]');
                    process.exit(1);
                }
                await manager.verifyBackup(companyId, backupName);
                break;

            case 'backup-all':
                await manager.backupAllCompanies();
                break;

            default:
                console.log(`
WhatsApp Backup Manager

Commands:
  backup <companyId>              - Create backup for company
  restore <companyId> [backup]    - Restore from backup (latest if not specified)
  list <companyId>               - List available backups
  verify <companyId> [backup]    - Verify backup integrity
  backup-all                     - Backup all companies

Examples:
  node whatsapp-backup-manager.js backup 962302
  node whatsapp-backup-manager.js restore 962302
  node whatsapp-backup-manager.js list 962302
                `);
        }
    })().catch(console.error);
}

module.exports = BackupManager;