#!/usr/bin/env node

/**
 * PostgreSQL Backup Validation Script
 * Phase 3 - Task 4.4: Baileys PostgreSQL Resilience Improvements
 *
 * Purpose:
 * - Validates backup file integrity (checksums, size)
 * - Verifies backup contains expected data (row counts)
 * - Detects corrupted or incomplete backups
 * - Alerts on validation failures
 *
 * Usage:
 *   node scripts/backup/validate-backup.js                    # Validate latest backup
 *   node scripts/backup/validate-backup.js --backup <file>    # Validate specific backup
 *   node scripts/backup/validate-backup.js --all              # Validate all backups
 *   node scripts/backup/validate-backup.js --verbose          # Detailed output
 *
 * Validation Checks:
 * 1. File exists and is readable
 * 2. File size is reasonable (>1 KB, <500 MB)
 * 3. Gzip decompression succeeds
 * 4. SQL structure is valid (contains expected tables)
 * 5. Row counts match expected minimums
 * 6. SHA256 checksum computed and stored
 *
 * Schedule:
 * - Runs automatically after each backup (via backup script hook)
 * - Can be triggered manually for verification
 */

const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const Sentry = require('@sentry/node');
const logger = require('../../src/utils/logger');
const telegramNotifier = require('../../src/services/telegram-notifier');

const execAsync = promisify(exec);

// ====================================================================================
// Configuration
// ====================================================================================

const CONFIG = {
  // Backup paths
  BACKUP_ROOT: process.env.BACKUP_ROOT || '/var/backups/postgresql',
  DAILY_DIR: 'daily',
  MONTHLY_DIR: 'monthly',
  CHECKSUM_FILE: 'checksums.json',

  // Validation thresholds
  MIN_BACKUP_SIZE: 1024,           // 1 KB minimum (anything smaller is empty)
  MAX_BACKUP_SIZE: 500 * 1024 * 1024, // 500 MB maximum (sanity check)
  MIN_AUTH_RECORDS: 1,             // At least 1 company should exist
  MIN_KEYS_RECORDS: 100,           // At least 100 keys (active session has ~1500+)

  // Expected tables
  EXPECTED_TABLES: ['whatsapp_auth', 'whatsapp_keys'],

  // CLI flags
  VALIDATE_ALL: process.argv.includes('--all'),
  VERBOSE: process.argv.includes('--verbose'),
  BACKUP_FILE: getArgValue('--backup'),
};

function getArgValue(arg) {
  const index = process.argv.indexOf(arg);
  if (index > -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return null;
}

// ====================================================================================
// Utility Functions
// ====================================================================================

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Calculate SHA256 checksum of a file
 */
async function calculateChecksum(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Load stored checksums
 */
async function loadChecksums() {
  const checksumPath = path.join(CONFIG.BACKUP_ROOT, CONFIG.CHECKSUM_FILE);
  try {
    const data = await fs.readFile(checksumPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

/**
 * Save checksums
 */
async function saveChecksums(checksums) {
  const checksumPath = path.join(CONFIG.BACKUP_ROOT, CONFIG.CHECKSUM_FILE);
  await fs.writeFile(checksumPath, JSON.stringify(checksums, null, 2), { mode: 0o600 });
}

// ====================================================================================
// Validation Functions
// ====================================================================================

/**
 * Validate file exists and has reasonable size
 */
async function validateFileBasics(backupPath) {
  const issues = [];

  try {
    const stats = await fs.stat(backupPath);

    if (!stats.isFile()) {
      issues.push({ type: 'error', message: 'Not a regular file' });
      return { valid: false, issues, stats: null };
    }

    if (stats.size < CONFIG.MIN_BACKUP_SIZE) {
      issues.push({
        type: 'error',
        message: `File too small: ${formatBytes(stats.size)} (min: ${formatBytes(CONFIG.MIN_BACKUP_SIZE)})`
      });
    }

    if (stats.size > CONFIG.MAX_BACKUP_SIZE) {
      issues.push({
        type: 'warning',
        message: `File unusually large: ${formatBytes(stats.size)} (max expected: ${formatBytes(CONFIG.MAX_BACKUP_SIZE)})`
      });
    }

    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      issues,
      stats
    };

  } catch (error) {
    issues.push({ type: 'error', message: `Cannot access file: ${error.message}` });
    return { valid: false, issues, stats: null };
  }
}

/**
 * Validate gzip decompression works
 */
async function validateDecompression(backupPath) {
  try {
    await execAsync(`gunzip -t "${backupPath}"`, { timeout: 60000 });
    return { valid: true, issues: [] };
  } catch (error) {
    return {
      valid: false,
      issues: [{ type: 'error', message: `Decompression failed: ${error.message}` }]
    };
  }
}

/**
 * Validate backup contains expected SQL structure
 */
async function validateSqlStructure(backupPath) {
  const issues = [];

  try {
    // Extract first 1000 lines to check structure
    const { stdout } = await execAsync(`gunzip -c "${backupPath}" | head -1000`, {
      timeout: 30000,
      maxBuffer: 5 * 1024 * 1024
    });

    // Check for PostgreSQL dump marker
    if (!stdout.includes('PostgreSQL database dump')) {
      issues.push({ type: 'error', message: 'Not a valid PostgreSQL dump file' });
    }

    // Check for expected tables
    for (const table of CONFIG.EXPECTED_TABLES) {
      if (!stdout.includes(`CREATE TABLE`) || !stdout.includes(table)) {
        // Check deeper in the file
        const { stdout: fullSearch } = await execAsync(
          `gunzip -c "${backupPath}" | grep -c "CREATE TABLE.*${table}" || true`,
          { timeout: 30000 }
        );
        if (parseInt(fullSearch.trim()) === 0) {
          issues.push({ type: 'warning', message: `Table ${table} structure not found` });
        }
      }
    }

    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      issues
    };

  } catch (error) {
    issues.push({ type: 'error', message: `SQL structure check failed: ${error.message}` });
    return { valid: false, issues };
  }
}

/**
 * Count records in backup file
 */
async function countRecordsInBackup(backupPath) {
  const counts = {};

  for (const table of CONFIG.EXPECTED_TABLES) {
    try {
      // Count COPY data rows for the table
      // Pattern: COPY public.tablename (columns) FROM stdin; then data until \.
      const { stdout } = await execAsync(
        `gunzip -c "${backupPath}" | sed -n '/COPY.*${table}/,/^\\\\\\./p' | wc -l`,
        { timeout: 60000 }
      );
      // Subtract 2 for COPY line and \. line
      counts[table] = Math.max(0, parseInt(stdout.trim()) - 2);
    } catch (error) {
      counts[table] = null;
    }
  }

  return counts;
}

/**
 * Validate record counts meet minimums
 */
async function validateRecordCounts(backupPath) {
  const issues = [];
  const counts = await countRecordsInBackup(backupPath);

  // Check whatsapp_auth
  if (counts.whatsapp_auth === null) {
    issues.push({ type: 'warning', message: 'Could not count whatsapp_auth records' });
  } else if (counts.whatsapp_auth < CONFIG.MIN_AUTH_RECORDS) {
    issues.push({
      type: 'error',
      message: `whatsapp_auth has ${counts.whatsapp_auth} records (min: ${CONFIG.MIN_AUTH_RECORDS})`
    });
  }

  // Check whatsapp_keys
  if (counts.whatsapp_keys === null) {
    issues.push({ type: 'warning', message: 'Could not count whatsapp_keys records' });
  } else if (counts.whatsapp_keys < CONFIG.MIN_KEYS_RECORDS) {
    issues.push({
      type: 'warning',
      message: `whatsapp_keys has only ${counts.whatsapp_keys} records (expected: >${CONFIG.MIN_KEYS_RECORDS})`
    });
  }

  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues,
    counts
  };
}

/**
 * Validate and update checksum
 */
async function validateChecksum(backupPath) {
  const issues = [];
  const checksums = await loadChecksums();
  const fileName = path.basename(backupPath);

  const currentChecksum = await calculateChecksum(backupPath);

  if (checksums[fileName]) {
    // Existing checksum - verify it matches
    if (checksums[fileName].sha256 !== currentChecksum) {
      issues.push({
        type: 'error',
        message: `Checksum mismatch! File may have been corrupted or modified.`
      });
    } else if (CONFIG.VERBOSE) {
      logger.debug(`✅ Checksum verified: ${currentChecksum.substring(0, 16)}...`);
    }
  } else {
    // New file - store checksum
    checksums[fileName] = {
      sha256: currentChecksum,
      created: new Date().toISOString()
    };
    await saveChecksums(checksums);
    if (CONFIG.VERBOSE) {
      logger.debug(`📝 New checksum stored: ${currentChecksum.substring(0, 16)}...`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    checksum: currentChecksum
  };
}

// ====================================================================================
// Main Validation
// ====================================================================================

/**
 * Run all validations on a single backup
 */
async function validateBackup(backupPath) {
  const fileName = path.basename(backupPath);
  logger.info(`🔍 Validating: ${fileName}`);

  const results = {
    file: fileName,
    path: backupPath,
    valid: true,
    issues: [],
    metrics: {}
  };

  // Step 1: Basic file validation
  const fileResult = await validateFileBasics(backupPath);
  results.issues.push(...fileResult.issues);
  if (fileResult.stats) {
    results.metrics.size = fileResult.stats.size;
    results.metrics.mtime = fileResult.stats.mtime;
  }
  if (!fileResult.valid) {
    results.valid = false;
    return results;
  }

  // Step 2: Decompression check
  const decompResult = await validateDecompression(backupPath);
  results.issues.push(...decompResult.issues);
  if (!decompResult.valid) {
    results.valid = false;
    return results;
  }

  // Step 3: SQL structure validation
  const sqlResult = await validateSqlStructure(backupPath);
  results.issues.push(...sqlResult.issues);
  if (!sqlResult.valid) {
    results.valid = false;
    return results;
  }

  // Step 4: Record counts
  const countResult = await validateRecordCounts(backupPath);
  results.issues.push(...countResult.issues);
  results.metrics.counts = countResult.counts;
  if (!countResult.valid) {
    results.valid = false;
  }

  // Step 5: Checksum validation
  const checksumResult = await validateChecksum(backupPath);
  results.issues.push(...checksumResult.issues);
  results.metrics.checksum = checksumResult.checksum;
  if (!checksumResult.valid) {
    results.valid = false;
  }

  // Log results
  const errorCount = results.issues.filter(i => i.type === 'error').length;
  const warnCount = results.issues.filter(i => i.type === 'warning').length;

  if (results.valid) {
    logger.info(`   ✅ Valid (${formatBytes(results.metrics.size)}, ${results.metrics.counts?.whatsapp_keys || '?'} keys)`);
  } else {
    logger.error(`   ❌ Invalid: ${errorCount} errors, ${warnCount} warnings`);
  }

  if (CONFIG.VERBOSE) {
    for (const issue of results.issues) {
      const icon = issue.type === 'error' ? '❌' : '⚠️';
      logger.info(`      ${icon} ${issue.message}`);
    }
  }

  return results;
}

/**
 * Find all backup files
 */
async function findAllBackups() {
  const backups = [];

  for (const dir of [CONFIG.DAILY_DIR, CONFIG.MONTHLY_DIR]) {
    const dirPath = path.join(CONFIG.BACKUP_ROOT, dir);
    try {
      const files = await fs.readdir(dirPath);
      const backupFiles = files
        .filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz'))
        .map(f => ({
          name: f,
          path: path.join(dirPath, f),
          type: dir
        }));
      backups.push(...backupFiles);
    } catch (error) {
      logger.warn(`⚠️  Could not read ${dir} directory`);
    }
  }

  return backups.sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * Find latest backup
 */
async function findLatestBackup() {
  const backups = await findAllBackups();
  if (backups.length === 0) {
    throw new Error('No backup files found');
  }
  return backups[0];
}

// ====================================================================================
// Reporting
// ====================================================================================

/**
 * Send validation report
 */
async function sendReport(results) {
  const allValid = results.every(r => r.valid);
  const totalErrors = results.reduce((sum, r) => sum + r.issues.filter(i => i.type === 'error').length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.issues.filter(i => i.type === 'warning').length, 0);

  const icon = allValid ? '✅' : '❌';

  const message = `
${icon} <b>Backup Validation ${allValid ? 'Passed' : 'Failed'}</b>

📊 <b>Summary:</b>
• Files checked: ${results.length}
• Valid: ${results.filter(r => r.valid).length}
• Errors: ${totalErrors}
• Warnings: ${totalWarnings}

📦 <b>Backups:</b>
${results.slice(0, 5).map(r => {
  const status = r.valid ? '✅' : '❌';
  const size = r.metrics.size ? formatBytes(r.metrics.size) : '?';
  const keys = r.metrics.counts?.whatsapp_keys ?? '?';
  return `• ${status} ${r.file} (${size}, ${keys} keys)`;
}).join('\n')}
${results.length > 5 ? `\n... and ${results.length - 5} more` : ''}

${totalErrors > 0 ? `
⚠️ <b>Issues:</b>
${results.flatMap(r => r.issues.filter(i => i.type === 'error').map(i => `• ${r.file}: ${i.message}`)).slice(0, 5).join('\n')}
` : ''}
`.trim();

  try {
    await telegramNotifier.send(message, { parseMode: 'HTML' });
    logger.info('✅ Validation report sent to Telegram');
  } catch (error) {
    logger.error(`⚠️  Failed to send report: ${error.message}`);
  }
}

/**
 * Log to Sentry
 */
function logToSentry(results) {
  const allValid = results.every(r => r.valid);
  const totalErrors = results.reduce((sum, r) => sum + r.issues.filter(i => i.type === 'error').length, 0);

  Sentry.captureMessage(`Backup validation ${allValid ? 'passed' : 'failed'}`, {
    level: allValid ? 'info' : 'error',
    tags: {
      component: 'postgresql_backup',
      operation: 'validation',
      result: allValid ? 'passed' : 'failed'
    },
    extra: {
      files_checked: results.length,
      valid_count: results.filter(r => r.valid).length,
      error_count: totalErrors,
      results: results.map(r => ({
        file: r.file,
        valid: r.valid,
        size: r.metrics.size,
        keys: r.metrics.counts?.whatsapp_keys
      }))
    }
  });
}

// ====================================================================================
// Main Execution
// ====================================================================================

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🔍 PostgreSQL Backup Validation');
  logger.info(`📅 Date: ${new Date().toISOString()}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    let backupsToValidate = [];

    if (CONFIG.BACKUP_FILE) {
      // Validate specific file
      const filePath = CONFIG.BACKUP_FILE.includes('/')
        ? CONFIG.BACKUP_FILE
        : path.join(CONFIG.BACKUP_ROOT, CONFIG.DAILY_DIR, CONFIG.BACKUP_FILE);
      backupsToValidate = [{ name: path.basename(filePath), path: filePath }];
    } else if (CONFIG.VALIDATE_ALL) {
      // Validate all backups
      backupsToValidate = await findAllBackups();
      logger.info(`📦 Found ${backupsToValidate.length} backup files`);
    } else {
      // Validate latest
      const latest = await findLatestBackup();
      backupsToValidate = [latest];
    }

    const results = [];
    for (const backup of backupsToValidate) {
      const result = await validateBackup(backup.path);
      results.push(result);
    }

    // Report results
    const allValid = results.every(r => r.valid);
    const totalErrors = results.reduce((sum, r) => sum + r.issues.filter(i => i.type === 'error').length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.issues.filter(i => i.type === 'warning').length, 0);

    // Send reports if there are issues or if validating all
    if (!allValid || CONFIG.VALIDATE_ALL) {
      await sendReport(results);
      logToSentry(results);
    }

    // Final summary
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`${allValid ? '✅' : '❌'} Validation ${allValid ? 'PASSED' : 'FAILED'}`);
    logger.info(`📦 Files: ${results.length} checked, ${results.filter(r => r.valid).length} valid`);
    logger.info(`⚠️  Issues: ${totalErrors} errors, ${totalWarnings} warnings`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(allValid ? 0 : 1);

  } catch (error) {
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.error('❌ Validation FAILED');
    logger.error(`💥 Error: ${error.message}`);
    logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    Sentry.captureException(error, {
      level: 'error',
      tags: {
        component: 'postgresql_backup',
        operation: 'validation'
      }
    });

    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, validateBackup };
