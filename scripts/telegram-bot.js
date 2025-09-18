#!/usr/bin/env node

// scripts/telegram-bot.js
// Telegram бот для управления AI Admin
// Запускается как отдельный PM2 процесс

const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../src/utils/logger');

// Загружаем переменные из .env файла
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8301218575:AAFRhNPuARDnkiKY2aQKbDkUWPbaSiINPpc';
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '601999';
const HEALTH_URL = 'http://localhost:3000/health';

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  console.error('BOT_TOKEN:', BOT_TOKEN ? 'present' : 'missing');
  console.error('ADMIN_CHAT_ID:', ADMIN_CHAT_ID ? 'present' : 'missing');
  process.exit(1);
}

class TelegramBot {
  constructor() {
    this.offset = 0;
    this.isRunning = true;
  }

  async sendMessage(chatId, text, options = {}) {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      const response = await axios.post(url, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...options
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to send message:', error.message);
      return null;
    }
  }

  async getUpdates() {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`;
      const response = await axios.get(url, {
        params: {
          offset: this.offset,
          timeout: 30
        }
      });

      if (response.data.ok && response.data.result.length > 0) {
        return response.data.result;
      }
      return [];
    } catch (error) {
      logger.error('Failed to get updates:', error.message);
      return [];
    }
  }

  async handleCommand(message) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const fromId = message.from.id.toString();

    // Проверка доступа - только админ
    if (fromId !== ADMIN_CHAT_ID) {
      await this.sendMessage(chatId, '❌ Доступ запрещён');
      return;
    }

    // Обработка команд
    const command = text.toLowerCase().split(' ')[0];

    switch (command) {
      case '/start':
      case '/help':
        await this.handleHelp(chatId);
        break;

      case '/status':
        await this.handleStatus(chatId);
        break;

      case '/health':
        await this.handleHealth(chatId);
        break;

      case '/restart':
        await this.handleRestart(chatId, text);
        break;

      case '/recover':
        await this.handleRecover(chatId, text);
        break;

      case '/logs':
        await this.handleLogs(chatId);
        break;

      case '/queue':
        await this.handleQueue(chatId);
        break;

      case '/test':
        await this.handleTest(chatId);
        break;

      default:
        if (text.startsWith('/')) {
          await this.sendMessage(chatId, '❓ Неизвестная команда. Используйте /help');
        }
    }
  }

  async handleHelp(chatId) {
    const helpText = `
📚 <b>Команды AI Admin Bot</b>

/status - Общий статус системы
/health - Детальная проверка здоровья
/restart [service] - Перезапуск сервиса
/recover [type] - Восстановление системы
/logs - Последние ошибки
/queue - Состояние очереди
/test - Отправить тестовое сообщение

<b>Примеры:</b>
/restart api - перезапустить API
/restart all - перезапустить всё
/recover whatsapp - восстановить WhatsApp
/recover full - полное восстановление
`;
    await this.sendMessage(chatId, helpText);
  }

  async handleStatus(chatId) {
    await this.sendMessage(chatId, '🔍 Проверяю статус...');

    try {
      const { stdout } = await execAsync('pm2 jlist');
      const processes = JSON.parse(stdout);

      let statusText = '📊 <b>Статус процессов:</b>\n\n';

      for (const proc of processes) {
        const name = proc.name;
        const status = proc.pm2_env.status;
        const restarts = proc.pm2_env.restart_time;
        const memory = Math.round(proc.monit.memory / 1024 / 1024);
        const uptime = this.formatUptime(Date.now() - proc.pm2_env.pm_uptime);

        const statusIcon = status === 'online' ? '✅' : '❌';
        statusText += `${statusIcon} <b>${name}</b>\n`;
        statusText += `   Статус: ${status}\n`;
        statusText += `   Uptime: ${uptime}\n`;
        statusText += `   Память: ${memory}MB\n`;
        statusText += `   Рестарты: ${restarts}\n\n`;
      }

      await this.sendMessage(chatId, statusText);
    } catch (error) {
      await this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  }

  async handleHealth(chatId) {
    await this.sendMessage(chatId, '🏥 Проверяю здоровье системы...');

    try {
      const response = await axios.get(HEALTH_URL, { timeout: 10000 });
      const health = response.data;

      let healthText = `🏥 <b>Здоровье системы</b>\n\n`;
      healthText += `Общий статус: ${this.getStatusIcon(health.status)} ${health.status}\n\n`;

      // Проверки компонентов
      if (health.checks) {
        healthText += '<b>Компоненты:</b>\n';

        // Redis
        if (health.checks.redis) {
          const redis = health.checks.redis;
          healthText += `${this.getStatusIcon(redis.status)} Redis: ${redis.connected ? 'подключен' : 'отключен'}`;
          if (redis.keys) healthText += ` (${redis.keys} ключей)`;
          healthText += '\n';
        }

        // Database
        if (health.checks.database) {
          const db = health.checks.database;
          healthText += `${this.getStatusIcon(db.status)} База данных: ${db.connected ? 'подключена' : 'отключена'}\n`;
        }

        // WhatsApp
        if (health.checks.whatsapp) {
          const wa = health.checks.whatsapp;
          healthText += `${this.getStatusIcon(wa.status)} WhatsApp: ${wa.connected ? 'подключен' : 'отключен'}`;
          if (wa.phoneNumber) healthText += ` (${wa.phoneNumber})`;
          healthText += '\n';
        }

        // Queue
        if (health.checks.queue) {
          const queue = health.checks.queue;
          healthText += `${this.getStatusIcon(queue.status)} Очередь: ${queue.totalJobs} задач`;
          if (queue.pendingBatches) healthText += ` (${queue.pendingBatches} батчей)`;
          healthText += '\n';
        }

        // Memory
        if (health.checks.memory) {
          const mem = health.checks.memory;
          healthText += `${this.getStatusIcon(mem.status)} Память: ${mem.rssMB}MB (${mem.percentage}%)\n`;
        }

        // Last Activity
        if (health.checks.lastActivity) {
          const activity = health.checks.lastActivity;
          healthText += `${this.getStatusIcon(activity.status)} Последняя активность: ${activity.lastMessageMinutesAgo} мин назад`;
          if (activity.activeChats) healthText += ` (${activity.activeChats} чатов)`;
          healthText += '\n';
        }
      }

      await this.sendMessage(chatId, healthText);
    } catch (error) {
      await this.sendMessage(chatId, `❌ Не удалось проверить здоровье: ${error.message}`);
    }
  }

  async handleRestart(chatId, text) {
    const parts = text.split(' ');
    const service = parts[1] || 'all';

    await this.sendMessage(chatId, `🔄 Перезапускаю ${service}...`);

    try {
      const { stdout } = await execAsync(`pm2 restart ${service}`);
      await this.sendMessage(chatId, `✅ ${service} перезапущен успешно`);
    } catch (error) {
      await this.sendMessage(chatId, `❌ Ошибка перезапуска: ${error.message}`);
    }
  }

  async handleRecover(chatId, text) {
    const parts = text.split(' ');
    const type = parts[1] || 'status';

    const validTypes = ['status', 'soft', 'whatsapp', 'redis', 'full'];
    if (!validTypes.includes(type)) {
      await this.sendMessage(chatId, `❌ Неверный тип. Доступны: ${validTypes.join(', ')}`);
      return;
    }

    await this.sendMessage(chatId, `🔧 Запускаю восстановление (${type})...`);

    try {
      const { stdout, stderr } = await execAsync(`/opt/ai-admin/scripts/recovery.sh ${type}`);

      // Обрезаем вывод, если слишком длинный
      let output = stdout || stderr;
      if (output.length > 3000) {
        output = output.substring(0, 3000) + '\n... (обрезано)';
      }

      await this.sendMessage(chatId, `✅ Восстановление завершено:\n<pre>${output}</pre>`);
    } catch (error) {
      await this.sendMessage(chatId, `❌ Ошибка восстановления: ${error.message}`);
    }
  }

  async handleLogs(chatId) {
    await this.sendMessage(chatId, '📜 Получаю последние ошибки...');

    try {
      const { stdout } = await execAsync('pm2 logs --err --nostream --lines 20');

      // Обрезаем и форматируем логи
      let logs = stdout.substring(0, 2000);

      if (!logs.includes('error') && !logs.includes('Error')) {
        await this.sendMessage(chatId, '✅ Ошибок не найдено в последних логах');
      } else {
        await this.sendMessage(chatId, `📜 <b>Последние ошибки:</b>\n<pre>${logs}</pre>`);
      }
    } catch (error) {
      await this.sendMessage(chatId, `❌ Не удалось получить логи: ${error.message}`);
    }
  }

  async handleQueue(chatId) {
    await this.sendMessage(chatId, '📊 Проверяю очередь сообщений...');

    try {
      const response = await axios.get(HEALTH_URL);
      const queue = response.data.checks?.queue;

      if (!queue) {
        await this.sendMessage(chatId, '❌ Не удалось получить информацию об очереди');
        return;
      }

      let queueText = '📊 <b>Состояние очереди:</b>\n\n';
      queueText += `Всего задач: ${queue.totalJobs || 0}\n`;
      queueText += `Ожидающих батчей: ${queue.pendingBatches || 0}\n`;

      const status = queue.totalJobs > 20 ? '⚠️ Высокая нагрузка' : '✅ Нормальная нагрузка';
      queueText += `\nСтатус: ${status}`;

      await this.sendMessage(chatId, queueText);
    } catch (error) {
      await this.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  }

  async handleTest(chatId) {
    await this.sendMessage(chatId, '📱 Отправляю тестовое сообщение в WhatsApp...');

    try {
      const { stdout } = await execAsync('cd /opt/ai-admin && node test-direct-webhook.js');
      await this.sendMessage(chatId, '✅ Тестовое сообщение отправлено. Проверьте WhatsApp.');
    } catch (error) {
      await this.sendMessage(chatId, `❌ Ошибка отправки: ${error.message}`);
    }
  }

  getStatusIcon(status) {
    switch (status) {
      case 'ok':
      case 'healthy':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
      case 'unhealthy':
        return '❌';
      default:
        return '❓';
    }
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}д ${hours % 24}ч`;
    if (hours > 0) return `${hours}ч ${minutes % 60}м`;
    if (minutes > 0) return `${minutes}м ${seconds % 60}с`;
    return `${seconds}с`;
  }

  async run() {
    logger.info('Telegram bot started');
    logger.info(`Bot token: ${BOT_TOKEN.substring(0, 10)}...`);
    logger.info(`Admin chat ID: ${ADMIN_CHAT_ID}`);

    await this.sendMessage(ADMIN_CHAT_ID, '🤖 AI Admin Bot запущен и готов к работе!\nИспользуйте /help для списка команд');

    while (this.isRunning) {
      try {
        const updates = await this.getUpdates();

        for (const update of updates) {
          if (update.message) {
            logger.info(`Received message from ${update.message.from.id}: ${update.message.text}`);
            await this.handleCommand(update.message);
          }
          // Обновляем offset
          this.offset = update.update_id + 1;
        }

        // Небольшая пауза между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        logger.error('Bot error:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('Telegram bot stopped');
  }
}

// Запускаем бота
if (require.main === module) {
  const bot = new TelegramBot();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, stopping bot...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, stopping bot...');
    await bot.stop();
    process.exit(0);
  });

  bot.run().catch(error => {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  });
}

module.exports = TelegramBot;