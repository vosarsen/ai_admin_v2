#!/usr/bin/env node
/**
 * 🔧 SYNC CONFIG UPDATER
 * 
 * Динамическое обновление конфигурации синхронизации
 * для оптимальной работы с API лимитами YClients
 * 
 * USAGE:
 * node scripts/update-sync-config.js [command] [options]
 * 
 * COMMANDS:
 * preset <name>     Применить предустановленную конфигурацию
 * custom            Настроить параметры вручную
 * show              Показать текущую конфигурацию
 * reset             Сбросить к значениям по умолчанию
 * 
 * PRESETS:
 * aggressive        Быстрая синхронизация (высокий риск)
 * balanced          Сбалансированная синхронизация (рекомендуется)
 * conservative      Медленная синхронизация (низкий риск)
 * night             Ночная синхронизация (минимальный риск)
 */

const fs = require('fs');
const path = require('path');

class SyncConfigUpdater {
  constructor() {
    this.configPath = path.join(__dirname, '../src/config/sync-config.js');
    this.backupPath = path.join(__dirname, '../src/config/sync-config.backup.js');
  }

  /**
   * Предустановленные конфигурации
   */
  getPresets() {
    return {
      aggressive: {
        name: 'Aggressive',
        description: 'Быстрая синхронизация (высокий риск превышения лимитов)',
        config: {
          API_LIMITS: {
            REQUESTS_PER_MINUTE: 200,
            REQUESTS_PER_SECOND: 5,
            MIN_DELAY_MS: 200,
            VISIT_SYNC_DELAY_MS: 250,
            BATCH_SIZE: 200,
            MAX_RETRIES: 3
          },
          CLIENTS: {
            MAX_VISITS_SYNC_PER_RUN: 100,
            SYNC_RECENT_DAYS: 30
          }
        }
      },
      
      balanced: {
        name: 'Balanced (Recommended)',
        description: 'Сбалансированная синхронизация (80% от лимитов)',
        config: {
          API_LIMITS: {
            REQUESTS_PER_MINUTE: 160,
            REQUESTS_PER_SECOND: 4,
            MIN_DELAY_MS: 300,
            VISIT_SYNC_DELAY_MS: 400,
            BATCH_SIZE: 150,
            MAX_RETRIES: 3
          },
          CLIENTS: {
            MAX_VISITS_SYNC_PER_RUN: 75,
            SYNC_RECENT_DAYS: 60
          }
        }
      },
      
      conservative: {
        name: 'Conservative',
        description: 'Медленная синхронизация (50% от лимитов)',
        config: {
          API_LIMITS: {
            REQUESTS_PER_MINUTE: 100,
            REQUESTS_PER_SECOND: 3,
            MIN_DELAY_MS: 500,
            VISIT_SYNC_DELAY_MS: 600,
            BATCH_SIZE: 100,
            MAX_RETRIES: 5
          },
          CLIENTS: {
            MAX_VISITS_SYNC_PER_RUN: 50,
            SYNC_RECENT_DAYS: 90
          }
        }
      },
      
      night: {
        name: 'Night Mode',
        description: 'Ночная синхронизация (25% от лимитов)',
        config: {
          API_LIMITS: {
            REQUESTS_PER_MINUTE: 50,
            REQUESTS_PER_SECOND: 2,
            MIN_DELAY_MS: 1000,
            VISIT_SYNC_DELAY_MS: 1200,
            BATCH_SIZE: 50,
            MAX_RETRIES: 5
          },
          CLIENTS: {
            MAX_VISITS_SYNC_PER_RUN: 25,
            SYNC_RECENT_DAYS: 180
          }
        }
      }
    };
  }

  /**
   * Прочитать текущую конфигурацию
   */
  getCurrentConfig() {
    try {
      // Очищаем require cache
      delete require.cache[require.resolve(this.configPath)];
      return require(this.configPath);
    } catch (error) {
      console.error('❌ Failed to read current config:', error.message);
      return null;
    }
  }

  /**
   * Создать резервную копию конфигурации
   */
  createBackup() {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.copyFileSync(this.configPath, this.backupPath);
        console.log(`📦 Backup created: ${this.backupPath}`);
        return true;
      }
    } catch (error) {
      console.error('❌ Failed to create backup:', error.message);
      return false;
    }
  }

  /**
   * Показать текущую конфигурацию
   */
  showCurrentConfig() {
    console.log('📋 CURRENT SYNC CONFIGURATION');
    console.log('==============================\n');

    const config = this.getCurrentConfig();
    if (!config) return;

    console.log('API Limits:');
    console.log(`  Requests per minute: ${config.API_LIMITS.REQUESTS_PER_MINUTE}`);
    console.log(`  Requests per second: ${config.API_LIMITS.REQUESTS_PER_SECOND}`);
    console.log(`  Min delay: ${config.API_LIMITS.MIN_DELAY_MS}ms`);
    console.log(`  Visit sync delay: ${config.API_LIMITS.VISIT_SYNC_DELAY_MS}ms`);
    console.log(`  Batch size: ${config.API_LIMITS.BATCH_SIZE}`);
    console.log(`  Max retries: ${config.API_LIMITS.MAX_RETRIES}\n`);

    console.log('Client Sync:');
    console.log(`  Max visits sync per run: ${config.CLIENTS.MAX_VISITS_SYNC_PER_RUN}`);
    console.log(`  Sync recent days: ${config.CLIENTS.SYNC_RECENT_DAYS}`);
    console.log(`  Sync visit history: ${config.CLIENTS.SYNC_VISIT_HISTORY}\n`);
  }

  /**
   * Показать доступные пресеты
   */
  showPresets() {
    console.log('🎯 AVAILABLE PRESETS');
    console.log('====================\n');

    const presets = this.getPresets();
    Object.entries(presets).forEach(([key, preset]) => {
      console.log(`${key.toUpperCase()}: ${preset.name}`);
      console.log(`  ${preset.description}`);
      console.log(`  Max clients per run: ${preset.config.CLIENTS.MAX_VISITS_SYNC_PER_RUN}`);
      console.log(`  Min delay: ${preset.config.API_LIMITS.MIN_DELAY_MS}ms`);
      console.log(`  Command: node scripts/update-sync-config.js preset ${key}\n`);
    });
  }

  /**
   * Применить пресет
   */
  async applyPreset(presetName) {
    const presets = this.getPresets();
    const preset = presets[presetName];
    
    if (!preset) {
      console.error(`❌ Unknown preset: ${presetName}`);
      console.log('Available presets:', Object.keys(presets).join(', '));
      return false;
    }

    console.log(`🎯 Applying preset: ${preset.name}`);
    console.log(`   ${preset.description}\n`);

    // Создаем резервную копию
    if (!this.createBackup()) {
      console.error('❌ Failed to create backup, aborting');
      return false;
    }

    try {
      // Читаем текущую конфигурацию
      const currentConfig = this.getCurrentConfig();
      if (!currentConfig) {
        throw new Error('Failed to read current config');
      }

      // Обновляем настройки
      const updatedConfig = {
        ...currentConfig,
        API_LIMITS: {
          ...currentConfig.API_LIMITS,
          ...preset.config.API_LIMITS
        },
        CLIENTS: {
          ...currentConfig.CLIENTS,
          ...preset.config.CLIENTS
        }
      };

      // Генерируем новый файл конфигурации
      const configContent = this.generateConfigFile(updatedConfig);
      
      // Записываем файл
      fs.writeFileSync(this.configPath, configContent, 'utf8');
      
      console.log('✅ Configuration updated successfully!');
      console.log(`📁 Config file: ${this.configPath}`);
      console.log(`📦 Backup saved: ${this.backupPath}\n`);

      // Показываем обновленную конфигурацию
      this.showCurrentConfig();

      console.log('🔄 Next steps:');
      console.log('1. Restart any running sync processes');
      console.log('2. Test with: node scripts/incremental-client-sync.js --dry-run --max-batches=1');
      console.log('3. Run actual sync: node scripts/incremental-client-sync.js');

      return true;

    } catch (error) {
      console.error('❌ Failed to apply preset:', error.message);
      
      // Восстанавливаем из резервной копии
      if (fs.existsSync(this.backupPath)) {
        try {
          fs.copyFileSync(this.backupPath, this.configPath);
          console.log('🔙 Configuration restored from backup');
        } catch (restoreError) {
          console.error('❌ Failed to restore backup:', restoreError.message);
        }
      }
      
      return false;
    }
  }

  /**
   * Сгенерировать содержимое файла конфигурации
   */
  generateConfigFile(config) {
    return `/**
 * Конфигурация синхронизации данных из YClients
 * 
 * UPDATED: ${new Date().toISOString()}
 */
module.exports = {
  // Основные настройки
  COMPANY_ID: process.env.YCLIENTS_COMPANY_ID || ${config.COMPANY_ID},
  
  // Расписание синхронизации (время московское UTC+3)
  SCHEDULE: ${JSON.stringify(config.SCHEDULE, null, 4).replace(/"/g, "'")},
  
  // Настройки синхронизации клиентов
  CLIENTS: {
    // Синхронизировать историю визитов
    SYNC_VISIT_HISTORY: process.env.SYNC_CLIENT_VISITS === 'true' || ${config.CLIENTS.SYNC_VISIT_HISTORY},
    
    // Максимальное количество клиентов для синхронизации истории за раз
    // (для предотвращения превышения лимитов API)
    MAX_VISITS_SYNC_PER_RUN: parseInt(process.env.MAX_VISITS_SYNC_PER_RUN) || ${config.CLIENTS.MAX_VISITS_SYNC_PER_RUN},
    
    // Синхронизировать только клиентов с визитами за последние N дней
    // 0 = синхронизировать всех
    SYNC_RECENT_DAYS: parseInt(process.env.SYNC_RECENT_DAYS) || ${config.CLIENTS.SYNC_RECENT_DAYS},
    
    // Минимальное количество визитов для синхронизации
    MIN_VISITS_TO_SYNC: parseInt(process.env.MIN_VISITS_TO_SYNC) || ${config.CLIENTS.MIN_VISITS_TO_SYNC || 1}
  },
  
  // Настройки API лимитов
  API_LIMITS: {
    REQUESTS_PER_MINUTE: ${config.API_LIMITS.REQUESTS_PER_MINUTE},
    REQUESTS_PER_SECOND: ${config.API_LIMITS.REQUESTS_PER_SECOND},
    MIN_DELAY_MS: ${config.API_LIMITS.MIN_DELAY_MS},        // Минимум между запросами
    VISIT_SYNC_DELAY_MS: ${config.API_LIMITS.VISIT_SYNC_DELAY_MS}, // Задержка между синхронизацией визитов
    BATCH_SIZE: ${config.API_LIMITS.BATCH_SIZE},          // Максимум записей за раз
    MAX_RETRIES: ${config.API_LIMITS.MAX_RETRIES}
  },
  
  // Режимы синхронизации
  MODES: ${JSON.stringify(config.MODES, null, 4).replace(/"/g, "'")},
  
  // Приоритеты синхронизации
  PRIORITIES: ${JSON.stringify(config.PRIORITIES, null, 4).replace(/"/g, "'")}
};`;
  }

  /**
   * Сбросить конфигурацию к значениям по умолчанию
   */
  resetToDefault() {
    if (fs.existsSync(this.backupPath)) {
      try {
        fs.copyFileSync(this.backupPath, this.configPath);
        console.log('✅ Configuration reset to backup');
        this.showCurrentConfig();
        return true;
      } catch (error) {
        console.error('❌ Failed to reset configuration:', error.message);
        return false;
      }
    } else {
      console.error('❌ No backup file found');
      return false;
    }
  }
}

// Главная функция
async function main() {
  const command = process.argv[2];
  const option = process.argv[3];
  
  const updater = new SyncConfigUpdater();
  
  switch (command) {
    case 'preset':
      if (!option) {
        console.error('❌ Please specify preset name');
        updater.showPresets();
        return;
      }
      await updater.applyPreset(option);
      break;
      
    case 'show':
      updater.showCurrentConfig();
      break;
      
    case 'presets':
      updater.showPresets();
      break;
      
    case 'reset':
      updater.resetToDefault();
      break;
      
    default:
      console.log(`
🔧 SYNC CONFIG UPDATER

USAGE:
  node scripts/update-sync-config.js <command> [options]

COMMANDS:
  preset <name>     Apply preset configuration
  show              Show current configuration  
  presets           List available presets
  reset             Reset to backup

EXAMPLES:
  node scripts/update-sync-config.js presets
  node scripts/update-sync-config.js preset balanced
  node scripts/update-sync-config.js show
  node scripts/update-sync-config.js reset
`);
  }
}

// Запуск только если скрипт вызван напрямую
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SyncConfigUpdater };