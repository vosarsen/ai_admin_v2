#!/usr/bin/env node

/**
 * Emergency File-Based Session Restore Script
 *
 * PURPOSE: Quickly restore file-based Baileys sessions when PostgreSQL is unavailable
 *
 * USAGE:
 *   node scripts/emergency/restore-file-sessions.js [options]
 *
 * OPTIONS:
 *   --dry-run          Simulate restore without making changes
 *   --skip-export      Skip PostgreSQL export (use existing files)
 *   --skip-restart     Skip service restart (manual restart)
 *   --company-id <id>  Restore specific company only (default: all)
 *
 * EXPECTED RTO: <10 minutes
 *
 * STEPS:
 *   1. Export PostgreSQL session data to files (baileys_sessions/)
 *   2. Restore file-based code from git tag (emergency-file-fallback-v1)
 *   3. Update .env to use file-based auth (USE_REPOSITORY_PATTERN=false)
 *   4. Restart baileys-whatsapp-service via PM2
 *   5. Verify WhatsApp connection
 *
 * PREREQUISITES:
 *   - PostgreSQL connection (for data export)
 *   - Git repository access
 *   - PM2 installed and configured
 *   - Sufficient disk space (~5MB per company)
 *
 * ROLLBACK:
 *   To return to PostgreSQL:
 *   1. git checkout main
 *   2. Set USE_REPOSITORY_PATTERN=true in .env
 *   3. pm2 restart baileys-whatsapp-service
 *
 * Created: 2025-11-19
 * Reference: dev/active/baileys-resilience-improvements/
 */

const { Pool } = require('pg');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const Sentry = require('@sentry/node');

// Configuration
const CONFIG = {
    EMERGENCY_TAG: 'emergency-file-fallback-v1',
    BASE_AUTH_PATH: path.join(__dirname, '../../baileys_sessions'),
    ENV_FILE: path.join(__dirname, '../../.env'),
    SERVICE_NAME: 'baileys-whatsapp-service',
    POSTGRES: {
        connectionString: process.env.DATABASE_URL ||
            'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full'
    }
};

// ANSI colors for console output
const COLORS = {
    RESET: '\x1b[0m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    dryRun: args.includes('--dry-run'),
    skipExport: args.includes('--skip-export'),
    skipRestart: args.includes('--skip-restart'),
    companyId: args.includes('--company-id') ? args[args.indexOf('--company-id') + 1] : null
};

// Logger utility
const logger = {
    info: (msg) => console.log(`${COLORS.CYAN}ℹ ${msg}${COLORS.RESET}`),
    success: (msg) => console.log(`${COLORS.GREEN}✓ ${msg}${COLORS.RESET}`),
    error: (msg) => console.error(`${COLORS.RED}✗ ${msg}${COLORS.RESET}`),
    warn: (msg) => console.warn(`${COLORS.YELLOW}⚠ ${msg}${COLORS.RESET}`),
    step: (msg) => console.log(`${COLORS.MAGENTA}▸ ${msg}${COLORS.RESET}`),
    header: (msg) => console.log(`\n${COLORS.BLUE}━━━ ${msg} ━━━${COLORS.RESET}\n`)
};

// Prompt user for confirmation
async function promptConfirmation(message) {
    if (options.dryRun) {
        logger.info('[DRY RUN] Skipping confirmation');
        return true;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${COLORS.YELLOW}${message} (yes/no): ${COLORS.RESET}`, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

// Check prerequisites
async function checkPrerequisites() {
    logger.header('Checking Prerequisites');

    const checks = [];

    // Check PostgreSQL connection
    try {
        const pool = new Pool(CONFIG.POSTGRES);
        await pool.query('SELECT 1');
        await pool.end();
        logger.success('PostgreSQL connection available');
        checks.push(true);
    } catch (error) {
        logger.warn(`PostgreSQL unavailable: ${error.message}`);
        logger.info('Will skip data export (use existing files if available)');
        checks.push(false);
    }

    // Check git repository
    try {
        execSync('git status', { stdio: 'pipe' });
        logger.success('Git repository available');
        checks.push(true);
    } catch (error) {
        logger.error('Git repository not found or not initialized');
        checks.push(false);
    }

    // Check emergency git tag exists
    try {
        execSync(`git tag -l ${CONFIG.EMERGENCY_TAG}`, { stdio: 'pipe' });
        logger.success(`Emergency tag '${CONFIG.EMERGENCY_TAG}' exists`);
        checks.push(true);
    } catch (error) {
        logger.error(`Emergency tag '${CONFIG.EMERGENCY_TAG}' not found`);
        checks.push(false);
    }

    // Check PM2 installed
    try {
        execSync('pm2 -v', { stdio: 'pipe' });
        logger.success('PM2 is installed');
        checks.push(true);
    } catch (error) {
        logger.warn('PM2 not found (will skip automatic restart)');
        checks.push(false);
    }

    // Check disk space
    try {
        const diskUsage = execSync('df -h .', { encoding: 'utf-8' });
        logger.info(`Disk space:\n${diskUsage}`);
        checks.push(true);
    } catch (error) {
        logger.warn('Could not check disk space');
        checks.push(true);
    }

    return {
        allPassed: checks.every(c => c),
        postgresAvailable: checks[0],
        gitAvailable: checks[1],
        tagAvailable: checks[2],
        pm2Available: checks[3]
    };
}

// Step 1: Export PostgreSQL data to files
async function exportPostgreSQLToFiles() {
    logger.header('Step 1: Export PostgreSQL Data to Files');

    if (options.skipExport) {
        logger.info('Skipping export (--skip-export flag)');
        return;
    }

    const pool = new Pool(CONFIG.POSTGRES);

    try {
        // Get auth data
        const authQuery = options.companyId
            ? 'SELECT * FROM whatsapp_auth WHERE company_id = $1'
            : 'SELECT * FROM whatsapp_auth';
        const authParams = options.companyId ? [options.companyId] : [];
        const authResult = await pool.query(authQuery, authParams);

        logger.info(`Found ${authResult.rows.length} auth record(s)`);

        for (const auth of authResult.rows) {
            const companyId = auth.company_id;
            const authDir = path.join(CONFIG.BASE_AUTH_PATH, `company_${companyId}`);

            if (options.dryRun) {
                logger.info(`[DRY RUN] Would create directory: ${authDir}`);
            } else {
                await fs.ensureDir(authDir);
                logger.success(`Created directory: ${authDir}`);
            }

            // Export creds.json
            if (auth.creds) {
                const credsPath = path.join(authDir, 'creds.json');
                if (options.dryRun) {
                    logger.info(`[DRY RUN] Would write creds.json (${JSON.stringify(auth.creds).length} bytes)`);
                } else {
                    await fs.writeJSON(credsPath, auth.creds, { spaces: 2 });
                    logger.success(`Exported creds.json for company ${companyId}`);
                }
            }

            // Export session keys
            const keysQuery = 'SELECT * FROM whatsapp_keys WHERE company_id = $1';
            const keysResult = await pool.query(keysQuery, [companyId]);

            logger.info(`Found ${keysResult.rows.length} session keys for company ${companyId}`);

            for (const key of keysResult.rows) {
                const keyPath = path.join(authDir, `${key.key_id}.json`);
                const keyData = key.key_data;

                if (options.dryRun) {
                    logger.info(`[DRY RUN] Would write ${key.key_id}.json`);
                } else {
                    await fs.writeJSON(keyPath, keyData, { spaces: 2 });
                }
            }

            logger.success(`Exported ${keysResult.rows.length} keys for company ${companyId}`);
        }

        await pool.end();
        logger.success('PostgreSQL export complete');
    } catch (error) {
        await pool.end();
        logger.error(`Export failed: ${error.message}`);

        Sentry.captureException(error, {
            tags: {
                component: 'emergency_restore',
                operation: 'export_postgresql_to_files',
                emergency: 'true'
            },
            extra: {
                companyId: options.companyId || 'all',
                dryRun: options.dryRun
            }
        });

        throw error;
    }
}

// Step 2: Restore file-based code from git
async function restoreArchivedCode() {
    logger.header('Step 2: Restore File-Based Code from Git');

    try {
        // Check current branch
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
        logger.info(`Current branch: ${currentBranch}`);

        // Checkout emergency tag
        const checkoutCmd = `git checkout ${CONFIG.EMERGENCY_TAG}`;

        if (options.dryRun) {
            logger.info(`[DRY RUN] Would execute: ${checkoutCmd}`);
        } else {
            logger.step(`Checking out: ${CONFIG.EMERGENCY_TAG}`);
            execSync(checkoutCmd, { stdio: 'inherit' });
            logger.success(`Checked out emergency tag: ${CONFIG.EMERGENCY_TAG}`);
        }

        // Verify file-based code exists
        const sessionPoolPath = path.join(__dirname, '../../src/integrations/whatsapp/session-pool.js');

        if (options.dryRun) {
            logger.info(`[DRY RUN] Would verify: ${sessionPoolPath}`);
        } else {
            const sessionPoolContent = await fs.readFile(sessionPoolPath, 'utf-8');

            if (sessionPoolContent.includes('useMultiFileAuthState')) {
                logger.success('File-based code verified (useMultiFileAuthState found)');
            } else {
                logger.error('File-based code NOT found in session-pool.js');
                throw new Error('Emergency tag does not contain file-based code');
            }
        }
    } catch (error) {
        logger.error(`Code restore failed: ${error.message}`);

        Sentry.captureException(error, {
            tags: {
                component: 'emergency_restore',
                operation: 'restore_archived_code',
                emergency: 'true'
            },
            extra: {
                emergencyTag: CONFIG.EMERGENCY_TAG,
                dryRun: options.dryRun
            }
        });

        throw error;
    }
}

// Step 3: Update .env configuration
async function updateEnv() {
    logger.header('Step 3: Update Environment Configuration');

    try {
        if (!await fs.pathExists(CONFIG.ENV_FILE)) {
            logger.warn('.env file not found, creating new one');
        }

        let envContent = '';
        if (await fs.pathExists(CONFIG.ENV_FILE)) {
            envContent = await fs.readFile(CONFIG.ENV_FILE, 'utf-8');
        }

        // Update multiple environment variables for file-based auth
        const updatedEnv = envContent
            .split('\n')
            .map(line => {
                if (line.startsWith('USE_REPOSITORY_PATTERN=')) {
                    return 'USE_REPOSITORY_PATTERN=false';
                }
                if (line.startsWith('USE_DATABASE_AUTH_STATE=')) {
                    return 'USE_DATABASE_AUTH_STATE=false';
                }
                if (line.startsWith('USE_LEGACY_SUPABASE=')) {
                    return 'USE_LEGACY_SUPABASE=false';
                }
                return line;
            })
            .join('\n');

        // Add missing variables if not found
        let finalEnv = updatedEnv;
        if (!finalEnv.includes('USE_REPOSITORY_PATTERN=')) {
            finalEnv += '\nUSE_REPOSITORY_PATTERN=false';
        }
        if (!finalEnv.includes('USE_DATABASE_AUTH_STATE=')) {
            finalEnv += '\nUSE_DATABASE_AUTH_STATE=false';
        }
        if (!finalEnv.includes('USE_LEGACY_SUPABASE=')) {
            finalEnv += '\nUSE_LEGACY_SUPABASE=false';
        }

        // Add emergency rollback header comment if not present
        if (!finalEnv.includes('# Emergency rollback')) {
            finalEnv = finalEnv.replace(
                /USE_REPOSITORY_PATTERN=false/,
                '# Emergency rollback - use file-based auth\nUSE_REPOSITORY_PATTERN=false'
            );
        }

        if (options.dryRun) {
            logger.info('[DRY RUN] Would update .env file');
            logger.info('[DRY RUN] USE_REPOSITORY_PATTERN=false');
            logger.info('[DRY RUN] USE_DATABASE_AUTH_STATE=false');
            logger.info('[DRY RUN] USE_LEGACY_SUPABASE=false');
        } else {
            await fs.writeFile(CONFIG.ENV_FILE, finalEnv, 'utf-8');
            logger.success('Updated .env: USE_REPOSITORY_PATTERN=false');
            logger.success('Updated .env: USE_DATABASE_AUTH_STATE=false');
            logger.success('Updated .env: USE_LEGACY_SUPABASE=false');
        }
    } catch (error) {
        logger.error(`Environment update failed: ${error.message}`);

        Sentry.captureException(error, {
            tags: {
                component: 'emergency_restore',
                operation: 'update_env',
                emergency: 'true'
            },
            extra: {
                envFile: CONFIG.ENV_FILE,
                dryRun: options.dryRun
            }
        });

        throw error;
    }
}

// Step 4: Restart Baileys service
async function restartBaileysService() {
    logger.header('Step 4: Restart Baileys Service');

    if (options.skipRestart) {
        logger.info('Skipping restart (--skip-restart flag)');
        logger.warn('You must manually restart the service:');
        logger.info(`  pm2 restart ${CONFIG.SERVICE_NAME}`);
        return;
    }

    try {
        const restartCmd = `pm2 restart ${CONFIG.SERVICE_NAME}`;

        if (options.dryRun) {
            logger.info(`[DRY RUN] Would execute: ${restartCmd}`);
        } else {
            logger.step(`Restarting ${CONFIG.SERVICE_NAME}...`);
            execSync(restartCmd, { stdio: 'inherit' });
            logger.success(`Service restarted: ${CONFIG.SERVICE_NAME}`);

            // Wait for service to initialize
            logger.step('Waiting 10 seconds for service initialization...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    } catch (error) {
        logger.error(`Service restart failed: ${error.message}`);

        Sentry.captureException(error, {
            tags: {
                component: 'emergency_restore',
                operation: 'restart_service',
                emergency: 'true'
            },
            extra: {
                serviceName: CONFIG.SERVICE_NAME,
                dryRun: options.dryRun
            }
        });

        throw error;
    }
}

// Step 5: Verify WhatsApp connection
async function verifyWhatsAppConnection() {
    logger.header('Step 5: Verify WhatsApp Connection');

    if (options.dryRun) {
        logger.info('[DRY RUN] Would verify WhatsApp connection');
        logger.info('[DRY RUN] Check PM2 logs: pm2 logs baileys-whatsapp-service --lines 50');
        return;
    }

    try {
        logger.step('Checking PM2 logs for connection status...');

        const logs = execSync(`pm2 logs ${CONFIG.SERVICE_NAME} --lines 20 --nostream`, {
            encoding: 'utf-8'
        });

        logger.info('Recent logs:');
        console.log(logs);

        if (logs.includes('connection open') || logs.includes('Connected to WhatsApp')) {
            logger.success('WhatsApp connection verified ✓');
        } else if (logs.includes('connection close') || logs.includes('error')) {
            logger.warn('Connection status unclear - check logs manually');
            logger.info(`Run: pm2 logs ${CONFIG.SERVICE_NAME} --lines 50`);
        } else {
            logger.info('Connection status unknown - manual verification required');
        }
    } catch (error) {
        logger.warn(`Could not verify connection: ${error.message}`);
        logger.info('Please verify manually using PM2 logs');
    }
}

// Main execution
async function main() {
    const startTime = Date.now();

    console.log(`
${COLORS.MAGENTA}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   EMERGENCY FILE-BASED SESSION RESTORE                    ║
║                                                           ║
║   ⚠️  WARNING: This will switch from PostgreSQL to files  ║
║   ⏱️  Expected RTO: <10 minutes                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${COLORS.RESET}
`);

    if (options.dryRun) {
        logger.warn('DRY RUN MODE - No changes will be made');
    }

    logger.info(`Options: ${JSON.stringify(options, null, 2)}`);

    // Step 0: Check prerequisites
    const prereqs = await checkPrerequisites();

    if (!prereqs.gitAvailable || !prereqs.tagAvailable) {
        logger.error('FATAL: Git or emergency tag not available');
        logger.error('Cannot proceed with restore');
        process.exit(1);
    }

    if (!prereqs.postgresAvailable && !options.skipExport) {
        logger.warn('PostgreSQL not available - will skip data export');
        const proceed = await promptConfirmation('Continue without data export?');
        if (!proceed) {
            logger.info('Restore cancelled by user');
            process.exit(0);
        }
        options.skipExport = true;
    }

    // Confirm restore
    if (!options.dryRun) {
        const confirmed = await promptConfirmation('Proceed with emergency restore?');
        if (!confirmed) {
            logger.info('Restore cancelled by user');
            process.exit(0);
        }
    }

    try {
        // Execute restore steps
        if (!options.skipExport) {
            await exportPostgreSQLToFiles();
        }

        await restoreArchivedCode();
        await updateEnv();
        await restartBaileysService();
        await verifyWhatsAppConnection();

        // Summary
        const duration = Math.round((Date.now() - startTime) / 1000);

        logger.header('Restore Complete');
        logger.success(`Total time: ${duration} seconds (RTO target: <600 seconds)`);

        if (duration < 600) {
            logger.success('✓ RTO target achieved (<10 minutes)');
        } else {
            logger.warn(`⚠ RTO target missed (${duration}s > 600s)`);
        }

        console.log(`
${COLORS.GREEN}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✓ EMERGENCY RESTORE SUCCESSFUL                          ║
║                                                           ║
║   System is now using file-based session storage          ║
║                                                           ║
║   To rollback to PostgreSQL:                              ║
║   1. git checkout main                                    ║
║   2. Set USE_REPOSITORY_PATTERN=true in .env              ║
║   3. pm2 restart baileys-whatsapp-service                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${COLORS.RESET}
`);

    } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000);

        logger.header('Restore Failed');
        logger.error(`Error after ${duration} seconds: ${error.message}`);
        logger.error('Stack trace:');
        console.error(error.stack);

        // Capture critical failure to Sentry
        Sentry.captureException(error, {
            level: 'fatal',
            tags: {
                component: 'emergency_restore',
                operation: 'main',
                emergency: 'true',
                restore_failed: 'true'
            },
            extra: {
                duration,
                dryRun: options.dryRun,
                skipExport: options.skipExport,
                skipRestart: options.skipRestart,
                companyId: options.companyId,
                rtoTarget: 600,
                rtoPassed: duration < 600
            }
        });

        console.log(`
${COLORS.RED}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✗ EMERGENCY RESTORE FAILED                              ║
║                                                           ║
║   System may be in inconsistent state                     ║
║   Manual intervention required                            ║
║                                                           ║
║   See error details above                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${COLORS.RESET}
`);

        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);

        // Capture unhandled errors to Sentry
        Sentry.captureException(error, {
            level: 'fatal',
            tags: {
                component: 'emergency_restore',
                operation: 'unhandled',
                emergency: 'true'
            }
        });

        process.exit(1);
    });
}

module.exports = {
    checkPrerequisites,
    exportPostgreSQLToFiles,
    restoreArchivedCode,
    updateEnv,
    restartBaileysService,
    verifyWhatsAppConnection
};
