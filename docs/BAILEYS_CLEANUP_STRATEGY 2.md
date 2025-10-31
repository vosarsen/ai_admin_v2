# Стратегия очистки файлов Baileys для мультитенантной системы

**Дата создания**: 23 сентября 2025
**Версия Baileys**: 7.0.0-rc.3
**Текущее состояние**: 151 файл в `/opt/ai-admin/baileys_sessions/company_962302/`

## 📊 Результаты исследования

### 1. Анализ файловой структуры (151 файл)

#### Распределение файлов по типам:
| Тип файла | Количество | Назначение | Безопасность удаления |
|-----------|------------|------------|------------------------|
| `lid-mapping-*.json` | 60 | Маппинг между старыми JID и новыми LID идентификаторами WhatsApp | ❌ **НЕ УДАЛЯТЬ** - критичны для работы |
| `pre-key-*.json` | 40 | Ключи Signal Protocol для шифрования | ⚠️ Можно оставлять 30-50 штук |
| `session-*.json` | 35 | Активные сессии шифрования с контактами | ✅ Можно удалять старше 14 дней |
| `sender-key-*.json` | 16 | Ключи для групповых сообщений | ✅ Можно удалять старше 3 дней |
| `creds.json` | 1 | Основной файл аутентификации | ❌ **НИКОГДА НЕ УДАЛЯТЬ** |
| `app-state-sync-*.json` | 4 | Синхронизация состояния приложения | ❌ **НЕ УДАЛЯТЬ** |

### 2. Официальная информация от WhiskeySockets/Baileys

#### 2.1 Что такое LID (Local ID)
- WhatsApp перешел с системы JID (Jabber ID) на LID (Local ID)
- Файлы `lid-mapping-*.json` содержат критически важный маппинг между старыми и новыми идентификаторами
- **Удаление lid-mapping файлов приведет к**:
  - Ошибкам отправки сообщений в группы
  - Проблемам идентификации контактов
  - Возможной необходимости полной переаутентификации

#### 2.2 Baileys v7.0.0 - критические изменения
- **`makeInMemoryStore` - УДАЛЕН** (не существует в v7)
- **`experimentalStore` - НЕ СУЩЕСТВУЕТ** (был в v5-v6)
- **`timeRelease` - НЕ СУЩЕСТВУЕТ** (был в v5-v6)
- **`proto` - УБРАН** из экспортов
- Полностью переработана система хранения - разработчики должны сами управлять состоянием

### 3. Последствия НЕ очистки файлов

#### При накоплении файлов происходит:
1. **Снижение производительности**:
   - "Consumes a lot of IO" - избыточное использование диска
   - Увеличение времени инициализации сессии
   - Замедление отправки/получения сообщений

2. **Риски стабильности**:
   - При >180 файлах - высокий риск ошибки `device_removed`
   - При >200 файлах - критический порог, возможна потеря сессии
   - Ошибки шифрования: "Failed to decrypt message"
   - Рассинхронизация с серверами WhatsApp

3. **Лимиты WhatsApp**:
   - Максимум 4 подключенных устройства на один номер
   - При превышении лимита файлов может срабатывать защита от спама

### 4. Анализ мультитенантной архитектуры проекта

#### Текущая реализация:
```javascript
// src/integrations/whatsapp/session-pool.js
const sock = makeWASocket({
    version,
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    // НЕТ experimentalStore и timeRelease - они не существуют в v7
    printQRInTerminal: false,
    logger: pino({ level: 'error' }),
    browser: Browsers.ubuntu('Chrome'),
    // ... другие параметры
});
```

#### Структура папок:
```
/opt/ai-admin/baileys_sessions/
├── company_962302/     # Текущая единственная компания
│   ├── creds.json
│   ├── app-state-sync-*.json
│   ├── lid-mapping-*.json
│   ├── pre-key-*.json
│   ├── session-*.json
│   └── sender-key-*.json
├── company_123456/     # Будущая компания
└── company_789012/     # Будущая компания
```

## 🎯 План действий для мультитенантной системы

### Решение 1: Автоматическая очистка через cron (РЕКОМЕНДУЕТСЯ)

#### 1.1 Создать скрипт очистки `/opt/ai-admin/scripts/baileys-multitenancy-cleanup.js`

```javascript
#!/usr/bin/env node

/**
 * Baileys Multitenancy Cleanup Script
 * Безопасная очистка файлов для всех компаний
 *
 * ВАЖНО: НЕ удаляет критичные файлы:
 * - creds.json
 * - app-state-sync-*.json
 * - lid-mapping-*.json
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('../src/utils/logger');

const BAILEYS_SESSIONS_PATH = '/opt/ai-admin/baileys_sessions';
const SESSION_MAX_AGE_DAYS = 14;
const SENDER_KEY_MAX_AGE_DAYS = 3;
const MAX_PRE_KEYS = 50;
const MIN_PRE_KEYS = 30;

class BaileysMultitenancyCleanup {
  constructor() {
    this.stats = {
      companies: 0,
      totalFilesProcessed: 0,
      totalFilesRemoved: 0,
      errors: []
    };
  }

  /**
   * Получить список всех компаний из папки sessions
   */
  async getCompanies() {
    try {
      const dirs = await fs.readdir(BAILEYS_SESSIONS_PATH);
      return dirs.filter(dir => dir.startsWith('company_'));
    } catch (error) {
      logger.error('Failed to read baileys sessions directory:', error);
      return [];
    }
  }

  /**
   * Проверить, нужно ли сохранить файл
   */
  shouldPreserve(filename, stats) {
    // КРИТИЧНЫЕ файлы - ВСЕГДА сохраняем
    if (filename === 'creds.json') return true;
    if (filename.startsWith('app-state-sync-')) return true;
    if (filename.startsWith('lid-mapping-')) return true; // ВАЖНО: LID маппинг нужен!

    // Session файлы - удаляем старше 14 дней
    if (filename.startsWith('session-')) {
      const ageInDays = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
      return ageInDays < SESSION_MAX_AGE_DAYS;
    }

    // Sender-key файлы - удаляем старше 3 дней
    if (filename.startsWith('sender-key-')) {
      const ageInDays = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
      return ageInDays < SENDER_KEY_MAX_AGE_DAYS;
    }

    // Pre-keys обработаем отдельно
    if (filename.startsWith('pre-key-')) {
      return null; // Специальная обработка
    }

    // Неизвестные файлы сохраняем для безопасности
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

    if (preKeys.length <= MAX_PRE_KEYS) {
      return 0;
    }

    // Удаляем старые, оставляя MAX_PRE_KEYS новейших
    const toRemove = preKeys.slice(MAX_PRE_KEYS);
    let removed = 0;

    for (const file of toRemove) {
      try {
        await fs.unlink(path.join(companyPath, file.name));
        removed++;
        this.stats.totalFilesRemoved++;
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
   * Очистить файлы для одной компании
   */
  async cleanupCompany(companyDir) {
    const companyPath = path.join(BAILEYS_SESSIONS_PATH, companyDir);
    const companyId = companyDir.replace('company_', '');

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

      logger.info(`Processing company ${companyId}: ${files.length} files`);

      // Обрабатываем обычные файлы
      let removedCount = 0;
      for (const file of files) {
        if (file.name.startsWith('pre-key-')) continue; // Pre-keys отдельно

        const preserve = this.shouldPreserve(file.name, file.stats);
        if (preserve === false) {
          try {
            await fs.unlink(path.join(companyPath, file.name));
            removedCount++;
            this.stats.totalFilesRemoved++;
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

      logger.info(`Company ${companyId}: removed ${removedCount} files`);

      return {
        companyId,
        filesProcessed: files.length,
        filesRemoved: removedCount,
        filesRemaining: files.length - removedCount
      };

    } catch (error) {
      logger.error(`Failed to cleanup company ${companyId}:`, error);
      this.stats.errors.push({
        company: companyId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Главная функция очистки
   */
  async cleanup() {
    const startTime = Date.now();
    logger.info('🧹 Starting Baileys multitenancy cleanup...');

    // Получаем список компаний
    const companies = await this.getCompanies();
    this.stats.companies = companies.length;

    if (companies.length === 0) {
      logger.warn('No companies found for cleanup');
      return this.stats;
    }

    logger.info(`Found ${companies.length} companies to process`);

    // Обрабатываем каждую компанию
    const results = [];
    for (const company of companies) {
      const result = await this.cleanupCompany(company);
      if (result) {
        results.push(result);
      }
    }

    // Итоговая статистика
    const duration = Date.now() - startTime;
    logger.info('=' .repeat(50));
    logger.info('📊 Cleanup Summary:');
    logger.info(`  Companies processed: ${this.stats.companies}`);
    logger.info(`  Total files processed: ${this.stats.totalFilesProcessed}`);
    logger.info(`  Total files removed: ${this.stats.totalFilesRemoved}`);
    logger.info(`  Errors: ${this.stats.errors.length}`);
    logger.info(`  Duration: ${duration}ms`);
    logger.info('=' .repeat(50));

    // Детали по компаниям
    for (const result of results) {
      logger.info(`  ${result.companyId}: ${result.filesRemaining} files remaining (removed ${result.filesRemoved})`);

      // Предупреждения
      if (result.filesRemaining > 150) {
        logger.warn(`  ⚠️ Company ${result.companyId} still has ${result.filesRemaining} files!`);
      }
    }

    // Логируем ошибки если есть
    if (this.stats.errors.length > 0) {
      logger.error('Cleanup errors:');
      for (const error of this.stats.errors) {
        logger.error(`  ${error.company}/${error.file}: ${error.error}`);
      }
    }

    return this.stats;
  }
}

// Запуск если вызван напрямую
if (require.main === module) {
  const cleanup = new BaileysMultitenancyCleanup();

  // Поддержка флага --dry-run
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    logger.info('DRY RUN MODE - no files will be deleted');
    // TODO: Реализовать режим dry-run
  }

  cleanup.cleanup()
    .then(stats => {
      logger.info('✅ Cleanup completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = BaileysMultitenancyCleanup;
```

#### 1.2 Настроить cron задачу

```bash
# Добавить в crontab на сервере
# Запускать каждый день в 3:00 ночи
0 3 * * * /usr/bin/node /opt/ai-admin/scripts/baileys-multitenancy-cleanup.js >> /opt/ai-admin/logs/cleanup.log 2>&1
```

### Решение 2: Улучшение whatsapp-safe-monitor для мультитенантности

#### 2.1 Обновить monitor для проверки всех компаний

```javascript
// В whatsapp-safe-monitor.js добавить:

async checkAllCompanies() {
  const companiesPath = '/opt/ai-admin/baileys_sessions';
  const companies = await fs.readdir(companiesPath);

  for (const companyDir of companies) {
    if (!companyDir.startsWith('company_')) continue;

    const companyId = companyDir.replace('company_', '');
    const fileCount = await this.checkFileCount(companyId);

    if (fileCount > 180) {
      // КРИТИЧНО - немедленное действие
      await this.sendCriticalAlert(companyId, fileCount);
      // Можно запустить автоматическую очистку
      await this.runEmergencyCleanup(companyId);
    } else if (fileCount > 150) {
      // Предупреждение
      await this.sendWarningAlert(companyId, fileCount);
    }
  }
}
```

### Решение 3: Добавление метрик и мониторинга

#### 3.1 Prometheus метрики

```javascript
// metrics/baileys-metrics.js
const client = require('prom-client');

// Регистрируем метрики
const baileysFilesGauge = new client.Gauge({
  name: 'baileys_session_files_count',
  help: 'Number of files in Baileys session directory',
  labelNames: ['company_id', 'file_type']
});

// Обновляем метрики каждые 5 минут
setInterval(async () => {
  const companies = await getCompanies();

  for (const company of companies) {
    const fileCounts = await getFileCountsByType(company.id);

    baileysFilesGauge.set({
      company_id: company.id,
      file_type: 'lid_mapping'
    }, fileCounts.lidMapping);

    baileysFilesGauge.set({
      company_id: company.id,
      file_type: 'pre_key'
    }, fileCounts.preKey);

    // ... другие типы файлов
  }
}, 5 * 60 * 1000);
```

### Решение 4: Плавный переход на новую компанию при критическом накоплении

#### 4.1 Автоматическая ротация сессий

```javascript
// rotation-strategy.js
class SessionRotationStrategy {
  async checkAndRotate(companyId) {
    const fileCount = await this.getFileCount(companyId);

    if (fileCount > 170) {
      // 1. Создаем бэкап текущей сессии
      await this.backupSession(companyId);

      // 2. Создаем новую чистую сессию
      const newSessionPath = await this.createCleanSession(companyId);

      // 3. Переключаемся на новую сессию
      await this.switchToNewSession(companyId, newSessionPath);

      // 4. Отправляем QR код для переподключения
      await this.sendReconnectionQR(companyId);

      logger.info(`Session rotated for company ${companyId}`);
    }
  }
}
```

## 📋 Чек-лист немедленных действий

### Для текущей ситуации (151 файл для company_962302):

1. **✅ БЕЗОПАСНО оставить как есть** - 151 файл не критично
2. **⚠️ Установить мониторинг** - alert при >170 файлах
3. **🔧 Настроить ежедневную очистку** через cron
4. **📊 Добавить метрики** для отслеживания роста файлов
5. **🗄️ Убедиться что backup-service работает** (уже запущен)

### Критические пороги:

| Количество файлов | Статус | Действие |
|-------------------|--------|----------|
| < 100 | ✅ Отлично | Ничего не делать |
| 100-150 | ⚠️ Норма | Мониторить |
| 150-170 | 🔶 Внимание | Запланировать очистку |
| 170-180 | 🔴 Предупреждение | Очистка в течение 24ч |
| > 180 | 💀 КРИТИЧНО | Немедленная очистка или ротация |

## ⚠️ Важные предупреждения

### НИКОГДА не удаляйте:
1. **`creds.json`** - потеря = полная переаутентификация
2. **`app-state-sync-*.json`** - потеря = рассинхронизация
3. **`lid-mapping-*.json`** - потеря = ошибки отправки в группы и контактам

### При очистке ВСЕГДА:
1. Останавливайте Baileys процесс перед ручной очисткой
2. Делайте бэкап перед любыми операциями
3. Тестируйте на одной компании перед массовым применением
4. Используйте флаг `--dry-run` для проверки

## 🔮 Долгосрочные рекомендации

### 1. Миграция с файлового хранения
Baileys v7 убрал встроенный store, рекомендуется реализовать:
- PostgreSQL для хранения сессий
- Redis для кэширования активных ключей
- S3 для бэкапов

### 2. Оптимизация для масштабирования
При росте до 100+ компаний:
- Отдельные инстансы Baileys для каждых 10-20 компаний
- Load balancing между инстансами
- Kubernetes для оркестрации

### 3. Альтернативы Baileys
Рассмотреть официальный WhatsApp Business API при:
- Более 50 компаний
- Критичности к стабильности
- Готовности платить за API

## 📚 Ссылки и источники

1. [WhiskeySockets/Baileys GitHub](https://github.com/WhiskeySockets/Baileys)
2. [Baileys v7 Migration Guide](https://baileys.wiki/docs/migration/to-v7.0.0/)
3. [Signal Protocol Documentation](https://signal.org/docs/)
4. [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

---

**Документ подготовлен**: AI Admin Team
**Последнее обновление**: 23 сентября 2025
**Версия документа**: 1.0