#!/usr/bin/env node

// scripts/health-monitor.js
// Мониторинг здоровья системы с уведомлениями в Telegram
// Запускать через cron каждые 5 минут:
// */5 * * * * /usr/bin/node /opt/ai-admin/scripts/health-monitor.js >> /opt/ai-admin/logs/health-monitor.log 2>&1

const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execAsync = promisify(exec);

// Устанавливаем правильный путь для require
const projectRoot = path.dirname(__dirname);

// Импортируем наш notifier
const telegramNotifier = require(path.join(projectRoot, 'src/services/telegram-notifier'));
const logger = require(path.join(projectRoot, 'src/utils/logger'));

const HEALTH_URL = 'http://localhost:3000/health';
const RECOVERY_SCRIPT = '/opt/ai-admin/scripts/recovery.sh';

class HealthMonitor {
  constructor() {
    this.lastHealthState = null;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 3;
  }

  async checkHealth() {
    try {
      const response = await axios.get(HEALTH_URL, { timeout: 10000 });
      return response.data;
    } catch (error) {
      logger.error('Failed to check health:', error.message);
      return null;
    }
  }

  async autoRecover(problem) {
    logger.info(`Attempting auto-recovery for: ${problem}`);

    try {
      let command;

      switch (problem) {
        case 'whatsapp':
          command = `${RECOVERY_SCRIPT} whatsapp`;
          break;
        case 'redis':
          command = `${RECOVERY_SCRIPT} redis`;
          break;
        case 'high_memory':
          command = `${RECOVERY_SCRIPT} soft`;
          break;
        default:
          logger.warn(`No auto-recovery action for: ${problem}`);
          return false;
      }

      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        logger.error(`Recovery stderr: ${stderr}`);
      }

      logger.info(`Recovery completed: ${stdout}`);
      await telegramNotifier.notifyRecovery(problem);
      return true;

    } catch (error) {
      logger.error(`Auto-recovery failed for ${problem}:`, error);
      await telegramNotifier.notifyError(error, { module: 'health-monitor', context: problem });
      return false;
    }
  }

  analyzeHealth(health) {
    const problems = [];

    if (!health) {
      problems.push({
        severity: 'critical',
        type: 'api_down',
        message: 'API не отвечает'
      });
      return problems;
    }

    // Проверяем критические компоненты
    if (health.checks?.whatsapp?.status === 'error') {
      problems.push({
        severity: 'high',
        type: 'whatsapp',
        message: 'WhatsApp отключен',
        autoRecover: true
      });
    }

    if (health.checks?.redis?.status === 'error') {
      problems.push({
        severity: 'critical',
        type: 'redis',
        message: 'Redis не доступен',
        autoRecover: true
      });
    }

    if (health.checks?.database?.status === 'error') {
      problems.push({
        severity: 'critical',
        type: 'database',
        message: 'База данных не доступна'
      });
    }

    // Проверяем предупреждения
    if (health.checks?.memory?.rssMB > 500) {
      problems.push({
        severity: 'warning',
        type: 'high_memory',
        message: `Высокое потребление памяти: ${health.checks.memory.rssMB}MB`,
        autoRecover: health.checks.memory.rssMB > 700
      });
    }

    if (health.checks?.queue?.pendingBatches > 10) {
      problems.push({
        severity: 'warning',
        type: 'queue_backlog',
        message: `Накопилось сообщений в очереди: ${health.checks.queue.pendingBatches}`
      });
    }

    if (health.checks?.lastActivity?.lastMessageMinutesAgo > 120) {
      problems.push({
        severity: 'info',
        type: 'no_activity',
        message: `Нет активности ${health.checks.lastActivity.lastMessageMinutesAgo} минут`
      });
    }

    return problems;
  }

  async handleProblems(problems) {
    // Сортируем по приоритету
    const critical = problems.filter(p => p.severity === 'critical');
    const high = problems.filter(p => p.severity === 'high');
    const warnings = problems.filter(p => p.severity === 'warning');

    // Обрабатываем критические проблемы
    if (critical.length > 0) {
      logger.error('Critical problems detected:', critical);

      // Отправляем уведомление
      const message = critical.map(p => p.message).join('\n');
      await telegramNotifier.notifyError(
        new Error(`Critical: ${message}`),
        { module: 'health-monitor' }
      );

      // Пытаемся автоматически исправить
      for (const problem of critical) {
        if (problem.autoRecover) {
          await this.autoRecover(problem.type);
        }
      }
    }

    // Обрабатываем высокоприоритетные проблемы
    if (high.length > 0) {
      logger.warn('High priority problems:', high);

      for (const problem of high) {
        if (problem.type === 'whatsapp') {
          await telegramNotifier.notifyWhatsAppIssue('962302', problem.message);
        }

        if (problem.autoRecover) {
          await this.autoRecover(problem.type);
        }
      }
    }

    // Логируем предупреждения
    if (warnings.length > 0) {
      logger.warn('Warnings:', warnings);

      // Авто-исправление для высокой памяти
      const memoryProblem = warnings.find(p => p.type === 'high_memory' && p.autoRecover);
      if (memoryProblem) {
        await this.autoRecover('high_memory');
      }
    }
  }

  async run() {
    logger.info('Starting health check...');

    try {
      // Получаем состояние здоровья
      const health = await this.checkHealth();

      // Анализируем проблемы
      const problems = this.analyzeHealth(health);

      if (problems.length === 0) {
        logger.info('✅ System is healthy');
        this.consecutiveErrors = 0;

        // Если система восстановилась после проблем
        if (this.lastHealthState === 'unhealthy') {
          await telegramNotifier.notifyRecovery('Система автоматически');
        }

        this.lastHealthState = 'healthy';
      } else {
        logger.warn(`Found ${problems.length} problems`);
        this.consecutiveErrors++;

        // Обрабатываем проблемы
        await this.handleProblems(problems);

        this.lastHealthState = 'unhealthy';

        // Если проблемы не решаются долго
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          logger.error('Too many consecutive errors, manual intervention required');
          await telegramNotifier.notifyError(
            new Error('Система требует ручного вмешательства - проблемы не решаются автоматически'),
            { module: 'health-monitor' }
          );
        }
      }

    } catch (error) {
      logger.error('Health monitor error:', error);
      await telegramNotifier.notifyError(error, { module: 'health-monitor' });
    }
  }
}

// Запускаем мониторинг
if (require.main === module) {
  const monitor = new HealthMonitor();
  monitor.run()
    .then(() => {
      logger.info('Health check completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Health monitor failed:', error);
      process.exit(1);
    });
}

module.exports = HealthMonitor;