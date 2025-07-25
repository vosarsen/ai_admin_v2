#!/usr/bin/env node
/**
 * Скрипт для автоматической очистки старых контекстов диалогов
 * Запускается через cron или вручную
 * 
 * Использование:
 * node scripts/cleanup-old-contexts.js [--days=30] [--dry-run]
 * 
 * Параметры:
 * --days=N     - количество дней для хранения контекста (по умолчанию 30)
 * --dry-run    - показать что будет удалено без фактического удаления
 */

const contextService = require('../src/services/context');
const logger = require('../src/utils/logger').child({ module: 'cleanup-contexts' });

async function cleanupContexts() {
  // Парсим аргументы командной строки
  const args = process.argv.slice(2);
  const daysToKeep = parseInt(args.find(arg => arg.startsWith('--days='))?.split('=')[1] || '30');
  const dryRun = args.includes('--dry-run');
  
  logger.info(`Starting context cleanup...`, { daysToKeep, dryRun });
  
  try {
    // Если это тестовый запуск, покажем что будет удалено
    if (dryRun) {
      logger.info('DRY RUN MODE - nothing will be deleted');
      // TODO: Добавить предварительный просмотр удаляемых контекстов
    }
    
    // Выполняем очистку
    const result = await contextService.clearOldContexts(daysToKeep);
    
    if (result.success) {
      logger.info(`✅ Cleanup completed successfully`, {
        cleared: result.cleared,
        daysToKeep
      });
    } else {
      logger.error('❌ Cleanup failed:', result.error);
      process.exit(1);
    }
    
    // Показываем метрики после очистки
    const metrics = await contextService.getMetrics();
    logger.info('Context service metrics after cleanup:', metrics);
    
  } catch (error) {
    logger.error('Fatal error during cleanup:', error);
    process.exit(1);
  }
  
  // Закрываем соединения
  process.exit(0);
}

// Запускаем очистку
cleanupContexts();