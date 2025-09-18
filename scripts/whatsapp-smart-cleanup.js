#!/usr/bin/env node

/**
 * Smart WhatsApp Auth Cleanup Script
 * Removes only old/unused files while preserving critical auth data
 *
 * PRESERVES:
 * - creds.json (always)
 * - app-state-sync-* (always)
 * - Active session files (modified in last 7 days)
 * - Recent pre-keys (last 30 files)
 *
 * REMOVES:
 * - Old session files (not modified in 7+ days)
 * - Excessive pre-keys (keeping only last 30)
 * - Orphaned sender-key files
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('../src/utils/logger');

// Configuration
const AUTH_PATH = process.env.AUTH_PATH || '/opt/ai-admin/baileys_sessions/company_962302';
const MAX_PRE_KEYS = 30; // WhatsApp needs some pre-keys for new connections
const SESSION_MAX_AGE_DAYS = 7; // Remove sessions older than 7 days
const DRY_RUN = process.argv.includes('--dry-run');

class SmartCleanup {
    constructor() {
        this.stats = {
            totalFiles: 0,
            preserved: 0,
            removed: 0,
            errors: 0
        };
    }

    /**
     * Check if file should be preserved
     */
    shouldPreserve(filename, stats) {
        // Always preserve critical files
        if (filename === 'creds.json') {
            console.log(`✅ PRESERVE: ${filename} (critical auth file)`);
            return true;
        }

        if (filename.startsWith('app-state-sync-')) {
            console.log(`✅ PRESERVE: ${filename} (app state sync)`);
            return true;
        }

        // Check session files age
        if (filename.startsWith('session-')) {
            const ageInDays = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
            if (ageInDays < SESSION_MAX_AGE_DAYS) {
                console.log(`✅ PRESERVE: ${filename} (active session, ${ageInDays.toFixed(1)} days old)`);
                return true;
            } else {
                console.log(`❌ REMOVE: ${filename} (old session, ${ageInDays.toFixed(1)} days old)`);
                return false;
            }
        }

        // For pre-keys, we'll handle them separately
        if (filename.startsWith('pre-key-')) {
            return null; // Special handling
        }

        // Remove sender-key files (they regenerate as needed)
        if (filename.startsWith('sender-key-')) {
            const ageInDays = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
            if (ageInDays > 1) {
                console.log(`❌ REMOVE: ${filename} (old sender key)`);
                return false;
            }
        }

        // Default: preserve unknown files
        console.log(`⚠️  PRESERVE: ${filename} (unknown type, keeping for safety)`);
        return true;
    }

    /**
     * Clean up pre-key files (keep only recent ones)
     */
    async cleanupPreKeys(files) {
        const preKeys = files
            .filter(f => f.name.startsWith('pre-key-'))
            .sort((a, b) => {
                // Sort by number in filename
                const numA = parseInt(a.name.match(/pre-key-(\d+)\.json/)?.[1] || '0');
                const numB = parseInt(b.name.match(/pre-key-(\d+)\.json/)?.[1] || '0');
                return numB - numA; // Descending order (newest first)
            });

        console.log(`\n📊 Found ${preKeys.length} pre-key files`);

        if (preKeys.length <= MAX_PRE_KEYS) {
            console.log(`✅ Pre-keys within limit (${preKeys.length}/${MAX_PRE_KEYS})`);
            return 0;
        }

        // Keep newest MAX_PRE_KEYS, remove the rest
        const toRemove = preKeys.slice(MAX_PRE_KEYS);
        console.log(`⚠️  Removing ${toRemove.length} old pre-keys (keeping newest ${MAX_PRE_KEYS})`);

        let removed = 0;
        for (const file of toRemove) {
            if (!DRY_RUN) {
                try {
                    await fs.unlink(path.join(AUTH_PATH, file.name));
                    console.log(`  ❌ Removed: ${file.name}`);
                    removed++;
                } catch (err) {
                    console.error(`  ⚠️  Failed to remove ${file.name}: ${err.message}`);
                }
            } else {
                console.log(`  🔍 Would remove: ${file.name}`);
                removed++;
            }
        }

        return removed;
    }

    /**
     * Main cleanup function
     */
    async cleanup() {
        console.log('🧹 WhatsApp Smart Cleanup Started');
        console.log(`📁 Auth path: ${AUTH_PATH}`);
        console.log(`🔍 Mode: ${DRY_RUN ? 'DRY RUN (no files will be deleted)' : 'LIVE'}\n`);

        try {
            // Check if directory exists
            if (!await fs.pathExists(AUTH_PATH)) {
                console.log('❌ Auth directory does not exist');
                return;
            }

            // Get all files with stats
            const fileNames = await fs.readdir(AUTH_PATH);
            const files = [];

            for (const name of fileNames) {
                const filePath = path.join(AUTH_PATH, name);
                const stats = await fs.stat(filePath);
                if (stats.isFile()) {
                    files.push({ name, stats });
                }
            }

            this.stats.totalFiles = files.length;
            console.log(`📊 Total files: ${this.stats.totalFiles}\n`);

            // Process each file (except pre-keys)
            for (const file of files) {
                if (file.name.startsWith('pre-key-')) continue; // Handle separately

                const preserve = this.shouldPreserve(file.name, file.stats);

                if (preserve === false && !DRY_RUN) {
                    try {
                        await fs.unlink(path.join(AUTH_PATH, file.name));
                        this.stats.removed++;
                    } catch (err) {
                        console.error(`Failed to remove ${file.name}: ${err.message}`);
                        this.stats.errors++;
                    }
                } else if (preserve === false && DRY_RUN) {
                    this.stats.removed++;
                } else {
                    this.stats.preserved++;
                }
            }

            // Handle pre-keys separately
            const preKeysRemoved = await this.cleanupPreKeys(files);
            this.stats.removed += preKeysRemoved;

            // Summary
            console.log('\n' + '='.repeat(50));
            console.log('📈 Cleanup Summary:');
            console.log(`  Total files: ${this.stats.totalFiles}`);
            console.log(`  Preserved: ${this.stats.preserved} (critical & active)`);
            console.log(`  Removed: ${this.stats.removed} (old & excessive)`);
            console.log(`  Errors: ${this.stats.errors}`);
            console.log(`  Final count: ${this.stats.totalFiles - this.stats.removed} files`);

            // Alert if still too many files
            const finalCount = this.stats.totalFiles - this.stats.removed;
            if (finalCount > 80) {
                console.log('\n⚠️  WARNING: Still have many files after cleanup.');
                console.log('  This might indicate active issues with connection cycling.');
            } else if (finalCount < 10) {
                console.log('\n⚠️  WARNING: Very few files remaining.');
                console.log('  Monitor for connection issues.');
            } else {
                console.log('\n✅ File count is healthy');
            }

            return this.stats;

        } catch (error) {
            console.error('❌ Cleanup failed:', error);
            throw error;
        }
    }

    /**
     * Get cleanup report without deleting files
     */
    async analyze() {
        console.log('📊 Analyzing auth directory (no files will be deleted)...\n');

        const originalDryRun = DRY_RUN;
        DRY_RUN = true;

        const stats = await this.cleanup();

        DRY_RUN = originalDryRun;
        return stats;
    }
}

// Export for use in other scripts
module.exports = SmartCleanup;

// Run if called directly
if (require.main === module) {
    const cleanup = new SmartCleanup();

    if (process.argv.includes('--help')) {
        console.log(`
WhatsApp Smart Cleanup Script

Usage:
  node whatsapp-smart-cleanup.js [options]

Options:
  --dry-run    Simulate cleanup without deleting files
  --analyze    Same as --dry-run
  --help       Show this help message

Examples:
  node whatsapp-smart-cleanup.js --dry-run   # See what would be deleted
  node whatsapp-smart-cleanup.js              # Perform actual cleanup

Environment:
  AUTH_PATH    Path to auth directory (default: /opt/ai-admin/baileys_sessions/company_962302)
        `);
        process.exit(0);
    }

    const method = process.argv.includes('--analyze') ? 'analyze' : 'cleanup';

    cleanup[method]()
        .then(() => {
            console.log('\n✅ Cleanup completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('\n❌ Cleanup failed:', err);
            process.exit(1);
        });
}