#!/usr/bin/env node

/**
 * Baileys Multitenancy Cleanup Script
 * Безопасная очистка файлов для всех компаний
 *
 * ВАЖНО: НЕ удаляет критичные файлы:
 * - creds.json
 * - app-state-sync-*.json
 * - lid-mapping-*.json
 *
 * Версия: 1.0.0
 * Дата: 24.09.2025
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('../src/utils/logger');

// Конфигурация путей и параметров очистки
const BAILEYS_SESSIONS_PATH = process.env.BAILEYS_SESSIONS_PATH || '/opt/ai-admin/baileys_sessions';
const SESSION_MAX_AGE_DAYS = 14;     // Максимальный возраст session файлов
const SENDER_KEY_MAX_AGE_DAYS = 3;   // Максимальный возраст sender-key файлов
const MAX_PRE_KEYS = 50;              // Максимальное количество pre-key файлов
const MIN_PRE_KEYS = 30;              // Минимальное количество pre-key файлов

// Критические пороги для алертов
const WARNING_THRESHOLD = 150;        // Предупреждение при превышении
const CRITICAL_THRESHOLD = 170;       // Критический порог
const EMERGENCY_THRESHOLD = 180;      // Аварийный порог (риск device_removed)

class BaileysMultitenancyCleanup {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.stats = {
      companies: 0,
      totalFilesProcessed: 0,
      totalFilesRemoved: 0,
      totalBytesFreed: 0,
      warnings: [],
      errors: [],
      companyStats: []
    };
  }

  log(level, message, ...args) {
    if (this.verbose || level !== 'debug') {
      logger[level](message, ...args);
    }
  }

  /**
   * Получить список всех компаний из папки sessions
   */
  async getCompanies(targetCompanyId = null) {
    try {
      // Для локального тестирования используем текущую директорию
      const sessionsPath = this.dryRun && !fs.existsSync(BAILEYS_SESSIONS_PATH)
        ? path.join(__dirname, '../baileys_sessions')
        : BAILEYS_SESSIONS_PATH;

      if (!fs.existsSync(sessionsPath)) {
        this.log('warn', `Sessions directory not found: ${sessionsPath}`);
        return [];
      }

      const dirs = await fs.readdir(sessionsPath);
      let companies = dirs
        .filter(dir => dir.startsWith('company_'))
        .map(dir => ({
          name: dir,
          path: path.join(sessionsPath, dir),
          id: dir.replace('company_', '')
        }));

      // Если указана конкретная компания, фильтруем
      if (targetCompanyId) {
        companies = companies.filter(c => c.id === targetCompanyId);
        if (companies.length === 0) {
          this.log('warn', `Company ${targetCompanyId} not found`);
        }
      }

      return companies;
    } catch (error) {
      this.log('error', 'Failed to read baileys sessions directory:', error);
      return [];
    }
  }

  /**
   * Получить размер файла
   */
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Проверить, нужно ли сохранить файл
   */
  shouldPreserve(filename, stats) {
    // КРИТИЧНЫЕ файлы - ВСЕГДА сохраняем
    if (filename === 'creds.json') {
      this.log('debug', `  ✅ Preserving critical file: ${filename}`);
      return true;
    }
    if (filename.startsWith('app-state-sync-')) {
      this.log('debug', `  ✅ Preserving app state sync: ${filename}`);
      return true;
    }
    if (filename.startsWith('lid-mapping-')) {
      this.log('debug', `  ✅ Preserving LID mapping: ${filename}`);
      return true;
    }

    // Session файлы - удаляем старше 14 дней
    if (filename.startsWith('session-')) {
      const ageInDays = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
      const preserve = ageInDays < SESSION_MAX_AGE_DAYS;
      this.log('debug', `  ${preserve ? '✅' : '🗑️'} Session ${filename}: age ${Math.round(ageInDays)} days`);
      return preserve;
    }

    // Sender-key файлы - удаляем старше 3 дней
    if (filename.startsWith('sender-key-')) {
      const ageInDays = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
      const preserve = ageInDays < SENDER_KEY_MAX_AGE_DAYS;
      this.log('debug', `  ${preserve ? '✅' : '🗑️'} Sender-key ${filename}: age ${Math.round(ageInDays)} days`);
      return preserve;
    }

    // Pre-keys обработаем отдельно
    if (filename.startsWith('pre-key-')) {
      return null; // Специальная обработка
    }

    // Неизвестные файлы сохраняем для безопасности
    this.log('debug', `  ⚠️ Unknown file preserved: ${filename}`);
    return true;
  }

  /**
   * Очистить pre-keys, оставив только нужное количество
   */
  async cleanupPreKeys(companyPath, files) {
    const preKeys = files
      .filter(f => f.name.startsWith('pre-key-'))
      .sort((a, b) => {
        const numA = parseInt(a.name.match(/pre-key-(\d+)\.json/)?.[1] || '0');
        const numB = parseInt(b.name.match(/pre-key-(\d+)\.json/)?.[1] || '0');
        return numB - numA; // Новые первые
      });

    this.log('debug', `  Pre-keys found: ${preKeys.length}`);

    if (preKeys.length <= MAX_PRE_KEYS) {
      this.log('debug', `  ✅ Pre-keys within limit (${preKeys.length}/${MAX_PRE_KEYS})`);
      return 0;
    }

    // Удаляем старые, оставляя MAX_PRE_KEYS новейших
    const toRemove = preKeys.slice(MAX_PRE_KEYS);
    let removed = 0;
    let bytesFreed = 0;

    this.log('info', `  🔧 Cleaning pre-keys: ${toRemove.length} to remove (keeping ${MAX_PRE_KEYS})`);

    for (const file of toRemove) {
      const filePath = path.join(companyPath, file.name);

      try {
        const fileSize = await this.getFileSize(filePath);

        if (this.dryRun) {
          this.log('info', `  [DRY-RUN] Would remove: ${file.name} (${fileSize} bytes)`);
        } else {
          await fs.unlink(filePath);
          this.log('debug', `  🗑️ Removed pre-key: ${file.name}`);
        }

        removed++;
        bytesFreed += fileSize;
        this.stats.totalFilesRemoved++;
        this.stats.totalBytesFreed += fileSize;
      } catch (error) {
        this.stats.errors.push({
          company: path.basename(companyPath),
          file: file.name,
          error: error.message
        });
      }
    }

    return removed;
  }

  /**
   * Анализ типов файлов для статистики
   */
  analyzeFileTypes(files) {
    const types = {
      'creds': 0,
      'app-state-sync': 0,
      'lid-mapping': 0,
      'pre-key': 0,
      'session': 0,
      'sender-key': 0,
      'unknown': 0
    };

    for (const file of files) {
      if (file.name === 'creds.json') types['creds']++;
      else if (file.name.startsWith('app-state-sync-')) types['app-state-sync']++;
      else if (file.name.startsWith('lid-mapping-')) types['lid-mapping']++;
      else if (file.name.startsWith('pre-key-')) types['pre-key']++;
      else if (file.name.startsWith('session-')) types['session']++;
      else if (file.name.startsWith('sender-key-')) types['sender-key']++;
      else types['unknown']++;
    }

    return types;
  }

  /**
   * Очистить файлы для одной компании
   */
  async cleanupCompany(company) {
    const companyPath = company.path;
    const companyId = company.id;

    try {
      // Получаем все файлы
      const fileNames = await fs.readdir(companyPath);
      const files = [];

      for (const name of fileNames) {
        const filePath = path.join(companyPath, name);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          files.push({ name, stats });
          this.stats.totalFilesProcessed++;
        }
      }

      this.log('info', `\n📁 Processing company ${companyId}: ${files.length} files`);

      // Анализ типов файлов
      const fileTypes = this.analyzeFileTypes(files);
      this.log('debug', '  File types:', fileTypes);

      // Проверка критических порогов
      if (files.length > EMERGENCY_THRESHOLD) {
        this.log('error', `  🔴 EMERGENCY: ${files.length} files! Risk of device_removed!`);
        this.stats.warnings.push({
          company: companyId,
          level: 'emergency',
          message: `${files.length} files - immediate action required!`
        });
      } else if (files.length > CRITICAL_THRESHOLD) {
        this.log('warn', `  ⚠️ CRITICAL: ${files.length} files approaching danger zone!`);
        this.stats.warnings.push({
          company: companyId,
          level: 'critical',
          message: `${files.length} files - cleanup recommended`
        });
      } else if (files.length > WARNING_THRESHOLD) {
        this.log('warn', `  ⚠️ WARNING: ${files.length} files - monitor closely`);
        this.stats.warnings.push({
          company: companyId,
          level: 'warning',
          message: `${files.length} files - approaching threshold`
        });
      }

      // Обрабатываем обычные файлы
      let removedCount = 0;
      let bytesFreed = 0;

      for (const file of files) {
        if (file.name.startsWith('pre-key-')) continue; // Pre-keys отдельно

        const preserve = this.shouldPreserve(file.name, file.stats);
        if (preserve === false) {
          const filePath = path.join(companyPath, file.name);

          try {
            const fileSize = await this.getFileSize(filePath);

            if (this.dryRun) {
              this.log('info', `  [DRY-RUN] Would remove: ${file.name} (${fileSize} bytes)`);
            } else {
              await fs.unlink(filePath);
              this.log('debug', `  🗑️ Removed: ${file.name}`);
            }

            removedCount++;
            bytesFreed += fileSize;
            this.stats.totalFilesRemoved++;
            this.stats.totalBytesFreed += fileSize;
          } catch (error) {
            this.stats.errors.push({
              company: companyId,
              file: file.name,
              error: error.message
            });
          }
        }
      }

      // Очищаем избыточные pre-keys
      const preKeysRemoved = await this.cleanupPreKeys(companyPath, files);
      removedCount += preKeysRemoved;

      const filesRemaining = files.length - removedCount;

      this.log('info', `  ✨ Company ${companyId}: removed ${removedCount} files, ${filesRemaining} remaining`);

      const companyStat = {
        companyId,
        filesProcessed: files.length,
        filesRemoved: removedCount,
        filesRemaining,
        bytesFreed,
        fileTypes,
        status: filesRemaining > CRITICAL_THRESHOLD ? 'critical' :
                filesRemaining > WARNING_THRESHOLD ? 'warning' : 'ok'
      };

      this.stats.companyStats.push(companyStat);
      return companyStat;

    } catch (error) {
      this.log('error', `Failed to cleanup company ${companyId}:`, error);
      this.stats.errors.push({
        company: companyId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Форматировать размер файла
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Главная функция очистки
   */
  async cleanup(targetCompanyId = null) {
    const startTime = Date.now();

    this.log('info', '=' .repeat(60));
    this.log('info', '🧹 Baileys Multitenancy Cleanup Script v1.0.0');
    this.log('info', '=' .repeat(60));

    if (this.dryRun) {
      this.log('warn', '🔍 DRY-RUN MODE - No files will be deleted');
    }

    if (targetCompanyId) {
      this.log('info', `🎯 Target company: ${targetCompanyId}`);
    }

    this.log('info', `📅 Date: ${new Date().toISOString()}`);
    this.log('info', `📁 Sessions path: ${BAILEYS_SESSIONS_PATH}`);
    this.log('info', `⚙️ Settings:`);
    this.log('info', `  - Session max age: ${SESSION_MAX_AGE_DAYS} days`);
    this.log('info', `  - Sender-key max age: ${SENDER_KEY_MAX_AGE_DAYS} days`);
    this.log('info', `  - Pre-keys to keep: ${MAX_PRE_KEYS}`);
    this.log('info', '');

    // Получаем список компаний (или конкретную компанию)
    const companies = await this.getCompanies(targetCompanyId);
    this.stats.companies = companies.length;

    if (companies.length === 0) {
      this.log('warn', '❌ No companies found for cleanup');
      return this.stats;
    }

    this.log('info', `🏢 Found ${companies.length} companies to process`);

    // Обрабатываем каждую компанию
    for (const company of companies) {
      await this.cleanupCompany(company);
    }

    // Итоговая статистика
    const duration = Date.now() - startTime;

    this.log('info', '\n' + '=' .repeat(60));
    this.log('info', '📊 CLEANUP SUMMARY');
    this.log('info', '=' .repeat(60));
    this.log('info', `⏱️ Duration: ${duration}ms`);
    this.log('info', `🏢 Companies processed: ${this.stats.companies}`);
    this.log('info', `📁 Total files processed: ${this.stats.totalFilesProcessed}`);
    this.log('info', `🗑️ Total files removed: ${this.stats.totalFilesRemoved}`);
    this.log('info', `💾 Space freed: ${this.formatBytes(this.stats.totalBytesFreed)}`);

    if (this.stats.warnings.length > 0) {
      this.log('warn', `⚠️ Warnings: ${this.stats.warnings.length}`);
    }

    if (this.stats.errors.length > 0) {
      this.log('error', `❌ Errors: ${this.stats.errors.length}`);
    }

    // Детали по компаниям
    this.log('info', '\n📋 Company Details:');
    for (const stat of this.stats.companyStats) {
      const emoji = stat.status === 'critical' ? '🔴' :
                   stat.status === 'warning' ? '⚠️' : '✅';

      this.log('info', `  ${emoji} Company ${stat.companyId}:`);
      this.log('info', `     Files: ${stat.filesRemaining} remaining (removed ${stat.filesRemoved})`);
      this.log('info', `     Space freed: ${this.formatBytes(stat.bytesFreed)}`);
      this.log('info', `     Types: LID=${stat.fileTypes['lid-mapping']}, ` +
                       `Session=${stat.fileTypes['session']}, ` +
                       `PreKey=${stat.fileTypes['pre-key']}`);
    }

    // Предупреждения
    if (this.stats.warnings.length > 0) {
      this.log('warn', '\n⚠️ Warnings:');
      for (const warning of this.stats.warnings) {
        this.log('warn', `  [${warning.level.toUpperCase()}] Company ${warning.company}: ${warning.message}`);
      }
    }

    // Ошибки
    if (this.stats.errors.length > 0) {
      this.log('error', '\n❌ Errors:');
      for (const error of this.stats.errors) {
        this.log('error', `  Company ${error.company}: ${error.error}`);
        if (error.file) {
          this.log('error', `    File: ${error.file}`);
        }
      }
    }

    // Рекомендации
    this.log('info', '\n💡 Recommendations:');

    const criticalCompanies = this.stats.companyStats.filter(s => s.status === 'critical');
    if (criticalCompanies.length > 0) {
      this.log('warn', `  🔴 ${criticalCompanies.length} companies need immediate attention!`);
      for (const company of criticalCompanies) {
        this.log('warn', `     - Company ${company.companyId}: ${company.filesRemaining} files`);
      }
    }

    const warningCompanies = this.stats.companyStats.filter(s => s.status === 'warning');
    if (warningCompanies.length > 0) {
      this.log('warn', `  ⚠️ ${warningCompanies.length} companies approaching threshold`);
    }

    if (this.dryRun) {
      this.log('info', '\n📌 This was a DRY-RUN. To actually remove files, run without --dry-run flag');
    }

    this.log('info', '\n' + '=' .repeat(60));
    this.log('info', '✨ Cleanup process completed!');
    this.log('info', '=' .repeat(60));

    return this.stats;
  }
}

// Запуск если вызван напрямую
if (require.main === module) {
  const args = process.argv.slice(2);

  // Парсинг опций
  const options = {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h')
  };

  // Парсинг целевой компании
  const companyIndex = args.indexOf('--company');
  const targetCompanyId = companyIndex > -1 && args[companyIndex + 1]
    ? args[companyIndex + 1]
    : null;

  if (options.help) {
    console.log(`
Baileys Multitenancy Cleanup Script

Usage: node baileys-multitenancy-cleanup.js [options]

Options:
  --company ID     Clean specific company only
  --dry-run, -d    Simulate cleanup without deleting files
  --verbose, -v    Show detailed debug information
  --help, -h       Show this help message

Examples:
  node baileys-multitenancy-cleanup.js --dry-run         # Test cleanup for all companies
  node baileys-multitenancy-cleanup.js --company 962302  # Clean specific company
  node baileys-multitenancy-cleanup.js -d -v             # Dry-run with verbose output
  node baileys-multitenancy-cleanup.js --company 962302 --dry-run  # Test specific company

Critical thresholds:
  < 150 files  - OK
  150-170      - Warning
  170-180      - Critical
  > 180        - Emergency (risk of device_removed)
    `);
    process.exit(0);
  }

  const cleanup = new BaileysMultitenancyCleanup(options);

  cleanup.cleanup(targetCompanyId)
    .then(stats => {
      const exitCode = stats.errors.length > 0 ? 1 : 0;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = BaileysMultitenancyCleanup;