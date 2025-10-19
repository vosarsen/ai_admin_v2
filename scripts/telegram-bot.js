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

  async answerCallbackQuery(callbackQueryId, text = '') {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
      await axios.post(url, {
        callback_query_id: callbackQueryId,
        text
      });
    } catch (error) {
      logger.error('Failed to answer callback query:', error.message);
    }
  }

  async setMyCommands() {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`;
      await axios.post(url, {
        commands: [
          { command: 'start', description: '🏠 Главное меню' },
          { command: 'status', description: '📊 Статус системы' },
          { command: 'health', description: '🏥 Проверка здоровья' },
          { command: 'db_health', description: '💾 Database Auth State' },
          { command: 'stats', description: '📈 Бизнес-аналитика' },
          { command: 'ai_metrics', description: '🤖 Метрики AI' },
          { command: 'queue', description: '📨 Очередь сообщений' },
          { command: 'logs', description: '📜 Последние ошибки' },
          { command: 'restart', description: '🔄 Перезапуск сервиса' },
          { command: 'test', description: '📱 Тестовое сообщение' }
        ]
      });
      logger.info('Bot commands menu configured');
    } catch (error) {
      logger.error('Failed to set bot commands:', error.message);
    }
  }

  // Inline keyboard helpers
  getMainMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '📊 Статус', callback_data: 'cmd_status' },
          { text: '🏥 Здоровье', callback_data: 'cmd_health' }
        ],
        [
          { text: '💾 DB Health', callback_data: 'cmd_db_health' },
          { text: '📈 Статистика', callback_data: 'cmd_stats' }
        ],
        [
          { text: '🤖 AI Метрики', callback_data: 'cmd_ai_metrics' },
          { text: '📨 Очередь', callback_data: 'cmd_queue' }
        ],
        [
          { text: '📜 Логи', callback_data: 'cmd_logs' },
          { text: '📱 Тест', callback_data: 'cmd_test' }
        ],
        [
          { text: '🔄 Перезапуск', callback_data: 'menu_restart' }
        ]
      ]
    };
  }

  getRestartMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🔄 API', callback_data: 'restart_api' },
          { text: '🔄 Worker', callback_data: 'restart_worker' }
        ],
        [
          { text: '🔄 WhatsApp', callback_data: 'restart_whatsapp' },
          { text: '🔄 Redis', callback_data: 'restart_redis' }
        ],
        [
          { text: '🔄 Всё', callback_data: 'restart_all' }
        ],
        [
          { text: '« Назад', callback_data: 'menu_main' }
        ]
      ]
    };
  }

  getStatsKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: 'Сегодня', callback_data: 'stats_today' },
          { text: 'Неделя', callback_data: 'stats_week' }
        ],
        [
          { text: 'Месяц', callback_data: 'stats_month' },
          { text: 'Всё время', callback_data: 'stats_all' }
        ],
        [
          { text: '« Назад', callback_data: 'menu_main' }
        ]
      ]
    };
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

      case '/db_health':
        await this.handleDatabaseHealth(chatId);
        break;

      case '/stats':
        await this.handleStats(chatId, 'today');
        break;

      case '/ai_metrics':
        await this.handleAIMetrics(chatId);
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

  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;

    // Answer callback query
    await this.answerCallbackQuery(callbackQuery.id);

    // Handle different callbacks
    if (data.startsWith('cmd_')) {
      const cmd = data.replace('cmd_', '');
      switch (cmd) {
        case 'status':
          await this.handleStatus(chatId);
          break;
        case 'health':
          await this.handleHealth(chatId);
          break;
        case 'db_health':
          await this.handleDatabaseHealth(chatId);
          break;
        case 'stats':
          await this.sendMessage(chatId, '📈 Выберите период:', {
            reply_markup: this.getStatsKeyboard()
          });
          break;
        case 'ai_metrics':
          await this.handleAIMetrics(chatId);
          break;
        case 'queue':
          await this.handleQueue(chatId);
          break;
        case 'logs':
          await this.handleLogs(chatId);
          break;
        case 'test':
          await this.handleTest(chatId);
          break;
      }
    } else if (data.startsWith('menu_')) {
      const menu = data.replace('menu_', '');
      switch (menu) {
        case 'main':
          await this.handleHelp(chatId);
          break;
        case 'restart':
          await this.sendMessage(chatId, '🔄 Выберите сервис для перезапуска:', {
            reply_markup: this.getRestartMenuKeyboard()
          });
          break;
      }
    } else if (data.startsWith('restart_')) {
      const service = data.replace('restart_', '');
      const serviceMap = {
        'api': 'ai-admin-api',
        'worker': 'ai-admin-worker-v2',
        'whatsapp': 'baileys-whatsapp-service',
        'redis': 'redis',
        'all': 'all'
      };
      await this.handleRestartService(chatId, serviceMap[service] || service);
    } else if (data.startsWith('stats_')) {
      const period = data.replace('stats_', '');
      await this.handleStats(chatId, period);
    }
  }

  async handleHelp(chatId) {
    const helpText = `🤖 <b>AI Admin Control Panel</b>

👋 Добро пожаловать в панель управления AI Admin!

Используйте кнопки ниже для быстрого доступа к функциям или команды из меню.

<b>Основные функции:</b>
📊 Мониторинг системы
📈 Бизнес-аналитика
🤖 Метрики AI
🔄 Управление сервисами

<i>Нажмите на кнопку для выполнения действия</i>`;

    await this.sendMessage(chatId, helpText, {
      reply_markup: this.getMainMenuKeyboard()
    });
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

  async handleDatabaseHealth(chatId) {
    await this.sendMessage(chatId, '💾 Проверяю Database Auth State...');

    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        await this.sendMessage(chatId, '❌ Supabase credentials не настроены');
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Count total keys
      const { count: totalKeys, error: countError } = await supabase
        .from('whatsapp_keys')
        .select('*', { count: 'exact', head: true });

      // Count expired keys
      const { count: expiredKeys, error: expiredError } = await supabase
        .from('whatsapp_keys')
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString());

      // Get recent activity
      const { data: recentKeys, error: recentError } = await supabase
        .from('whatsapp_keys')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      const lastActivity = recentKeys && recentKeys[0]
        ? new Date(recentKeys[0].created_at)
        : null;

      const minutesAgo = lastActivity
        ? Math.floor((Date.now() - lastActivity.getTime()) / 60000)
        : null;

      let healthText = '💾 <b>Database Auth State</b>\n\n';

      const statusIcon = totalKeys < 200 ? '✅' : totalKeys < 300 ? '⚠️' : '🔴';
      healthText += `${statusIcon} Всего ключей: ${totalKeys || 0}\n`;

      const expiredIcon = expiredKeys > 0 ? '⚠️' : '✅';
      healthText += `${expiredIcon} Истёкших ключей: ${expiredKeys || 0}\n`;

      if (lastActivity) {
        healthText += `🕐 Последняя активность: ${minutesAgo} мин назад\n`;
      }

      healthText += '\n<b>Статус:</b>\n';
      if (totalKeys < 100) {
        healthText += '✅ Отлично - размер БД оптимален';
      } else if (totalKeys < 200) {
        healthText += '✅ Нормально - автоочистка работает';
      } else if (totalKeys < 300) {
        healthText += '⚠️ Внимание - много ключей, проверьте TTL cleanup';
      } else {
        healthText += '🔴 Критично - TTL cleanup не работает!';
      }

      await this.sendMessage(chatId, healthText);
    } catch (error) {
      await this.sendMessage(chatId, `❌ Ошибка проверки БД: ${error.message}`);
    }
  }

  async handleStats(chatId, period = 'today') {
    await this.sendMessage(chatId, `📈 Загружаю статистику (${period})...`);

    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        await this.sendMessage(chatId, '❌ Supabase credentials не настроены');
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      switch (period) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(now.getDate() - 30);
          break;
        case 'all':
          startDate = new Date('2020-01-01');
          break;
      }

      // Count bookings in period
      const { count: bookingsCount, error: bookingsError } = await supabase
        .from('records')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .eq('company_id', 962302);

      // Count new clients
      const { count: newClientsCount, error: clientsError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .eq('company_id', 962302);

      // Get top services
      const { data: topServices, error: servicesError } = await supabase
        .from('records')
        .select('services')
        .gte('created_at', startDate.toISOString())
        .eq('company_id', 962302)
        .limit(100);

      let statsText = `📈 <b>Статистика за ${this.getPeriodName(period)}</b>\n\n`;
      statsText += `📅 Записей создано: ${bookingsCount || 0}\n`;
      statsText += `👤 Новых клиентов: ${newClientsCount || 0}\n`;

      if (topServices && topServices.length > 0) {
        statsText += '\n<b>Популярные услуги:</b>\n';
        // Simple service count (would need better processing in real scenario)
        statsText += `📊 Всего услуг: ${topServices.length}\n`;
      }

      await this.sendMessage(chatId, statsText, {
        reply_markup: this.getStatsKeyboard()
      });
    } catch (error) {
      await this.sendMessage(chatId, `❌ Ошибка получения статистики: ${error.message}`);
    }
  }

  async handleAIMetrics(chatId) {
    await this.sendMessage(chatId, '🤖 Собираю метрики AI...');

    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        await this.sendMessage(chatId, '❌ Supabase credentials не настроены');
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get conversation metrics (last 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: conversations, error } = await supabase
        .from('conversation_logs')
        .select('processing_time, stage, status')
        .gte('created_at', yesterday.toISOString())
        .limit(1000);

      let metricsText = '🤖 <b>AI Performance Metrics (24h)</b>\n\n';

      if (conversations && conversations.length > 0) {
        const avgTime = conversations.reduce((sum, c) => sum + (c.processing_time || 0), 0) / conversations.length;
        const successRate = (conversations.filter(c => c.status === 'success').length / conversations.length * 100).toFixed(1);

        metricsText += `⚡ Среднее время ответа: ${(avgTime / 1000).toFixed(2)}с\n`;
        metricsText += `✅ Успешных обработок: ${successRate}%\n`;
        metricsText += `📊 Всего сообщений: ${conversations.length}\n\n`;

        // Count by stage
        const stageCount = {};
        conversations.forEach(c => {
          stageCount[c.stage] = (stageCount[c.stage] || 0) + 1;
        });

        metricsText += '<b>По стадиям:</b>\n';
        for (const [stage, count] of Object.entries(stageCount)) {
          metricsText += `  ${stage}: ${count}\n`;
        }
      } else {
        metricsText += '📊 Нет данных за последние 24 часа\n';
        metricsText += '\n<i>Возможно, логирование не настроено или нет активности</i>';
      }

      await this.sendMessage(chatId, metricsText);
    } catch (error) {
      await this.sendMessage(chatId, `❌ Ошибка получения метрик: ${error.message}`);
    }
  }

  getPeriodName(period) {
    switch (period) {
      case 'today': return 'сегодня';
      case 'week': return 'неделю';
      case 'month': return 'месяц';
      case 'all': return 'всё время';
      default: return period;
    }
  }

  async handleRestart(chatId, text) {
    const parts = text.split(' ');
    const service = parts[1] || 'all';
    await this.handleRestartService(chatId, service);
  }

  async handleRestartService(chatId, service) {
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

    // Set bot commands menu
    await this.setMyCommands();

    await this.sendMessage(ADMIN_CHAT_ID, '🤖 AI Admin Bot запущен и готов к работе!\n\nИспользуйте /start для главного меню или команды из меню 👇');

    while (this.isRunning) {
      try {
        const updates = await this.getUpdates();

        for (const update of updates) {
          if (update.message) {
            logger.info(`Received message from ${update.message.from.id}: ${update.message.text}`);
            await this.handleCommand(update.message);
          } else if (update.callback_query) {
            logger.info(`Received callback from ${update.callback_query.from.id}: ${update.callback_query.data}`);
            await this.handleCallbackQuery(update.callback_query);
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

/**
 * Proactive Monitor
 * Автоматический мониторинг системы с алертами в Telegram
 */
class ProactiveMonitor {
  constructor(telegramBot) {
    this.bot = telegramBot;
    this.isRunning = false;
    this.intervals = [];

    // Последние алерты для каждого типа (для cooldown)
    this.lastAlerts = new Map();

    // Cooldown periods (в миллисекундах)
    this.cooldowns = {
      whatsapp_down: 5 * 60 * 1000,        // 5 минут
      database_down: 5 * 60 * 1000,        // 5 минут
      high_queue: 5 * 60 * 1000,           // 5 минут
      db_keys_overflow: 15 * 60 * 1000,    // 15 минут
      high_memory: 15 * 60 * 1000,         // 15 минут
      no_activity: 30 * 60 * 1000,         // 30 минут
      high_error_rate: 30 * 60 * 1000      // 30 минут
    };

    // Thresholds
    this.thresholds = {
      queueSize: 100,    // Increased from 50 to 100 to reduce false positives from temporary spikes
      dbKeys: 200,
      memory: 90,        // percent (было 80%, увеличено до 90% чтобы не спамить)
      noActivityMinutes: 30,
      errorsPerHour: 10
    };
  }

  /**
   * Start proactive monitoring
   */
  start() {
    if (this.isRunning) {
      logger.warn('Proactive monitor already running');
      return;
    }

    this.isRunning = true;
    logger.info('🔍 Starting Proactive Monitor...');

    // Critical checks every 1 minute
    const criticalInterval = setInterval(() => this.checkCritical(), 60 * 1000);
    this.intervals.push(criticalInterval);

    // Important checks every 5 minutes
    const importantInterval = setInterval(() => this.checkImportant(), 5 * 60 * 1000);
    this.intervals.push(importantInterval);

    // Daily summary at 9:00 AM Moscow time
    this.scheduleDailySummary();

    // Run initial check
    this.checkCritical();

    logger.info('✅ Proactive Monitor started');
  }

  /**
   * Stop proactive monitoring
   */
  stop() {
    this.isRunning = false;
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    logger.info('Proactive Monitor stopped');
  }

  /**
   * Check if we should send alert (cooldown logic)
   */
  shouldAlert(type) {
    const lastAlert = this.lastAlerts.get(type);
    const cooldown = this.cooldowns[type] || 5 * 60 * 1000;

    if (!lastAlert) {
      this.lastAlerts.set(type, Date.now());
      return true;
    }

    const timeSinceLastAlert = Date.now() - lastAlert;

    if (timeSinceLastAlert >= cooldown) {
      this.lastAlerts.set(type, Date.now());
      return true;
    }

    return false;
  }

  /**
   * Critical checks (every 1 minute)
   */
  async checkCritical() {
    try {
      await Promise.all([
        this.checkWhatsAppConnection(),
        this.checkDatabaseConnection(),
        this.checkHighQueue()
      ]);
    } catch (error) {
      logger.error('Critical check failed:', error);
    }
  }

  /**
   * Important checks (every 5 minutes)
   */
  async checkImportant() {
    try {
      await Promise.all([
        this.checkDatabaseKeys(),
        this.checkMemoryUsage(),
        this.checkActivity()
      ]);
    } catch (error) {
      logger.error('Important check failed:', error);
    }
  }

  /**
   * Check WhatsApp connection with retry logic to avoid false positives
   */
  async checkWhatsAppConnection() {
    try {
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      const whatsapp = response.data?.checks?.whatsapp;

      if (!whatsapp || !whatsapp.connected) {
        // First detection - wait 10 seconds and re-check to avoid false positives
        logger.warn('WhatsApp appears disconnected. Waiting 10s to confirm...', {
          status: whatsapp?.status,
          message: whatsapp?.message
        });

        await new Promise(resolve => setTimeout(resolve, 10000));

        // Retry check
        const retryResponse = await axios.get('http://localhost:3000/health', { timeout: 5000 });
        const retryWhatsapp = retryResponse.data?.checks?.whatsapp;

        // Only alert if still disconnected after retry
        if (!retryWhatsapp || !retryWhatsapp.connected) {
          if (this.shouldAlert('whatsapp_down')) {
            await this.bot.sendMessage(ADMIN_CHAT_ID, `
🚨 <b>КРИТИЧНО: WhatsApp отключен!</b>

Статус: ${retryWhatsapp?.status || 'unknown'}
Сообщение: ${retryWhatsapp?.message || 'неизвестно'}
Время: ${new Date().toLocaleString('ru-RU')}

<b>Действия:</b>
1. Проверьте логи: /logs
2. Проверьте статус: /health
3. При необходимости: /restart whatsapp

<i>Автоматический алерт (подтверждено через 10 сек)</i>
`);
          }
        } else {
          logger.info('WhatsApp reconnected after 10s. No alert sent.', {
            status: retryWhatsapp.status,
            message: retryWhatsapp.message
          });
        }
      }
    } catch (error) {
      logger.error('WhatsApp check failed:', error.message);
    }
  }

  /**
   * Check Database connection
   */
  async checkDatabaseConnection() {
    try {
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      const database = response.data?.checks?.database;

      if (!database || !database.connected) {
        if (this.shouldAlert('database_down')) {
          await this.bot.sendMessage(ADMIN_CHAT_ID, `
🔴 <b>КРИТИЧНО: База данных недоступна!</b>

Статус: ${database?.status || 'unknown'}
Время: ${new Date().toLocaleString('ru-RU')}

<b>Действия:</b>
1. Проверьте Supabase dashboard
2. Проверьте логи: /logs
3. Возможна проблема с сетью

<i>Автоматический алерт</i>
`);
        }
      }
    } catch (error) {
      logger.error('Database check failed:', error.message);
    }
  }

  /**
   * Check queue size
   * With 30-second delay to avoid false positives from temporary spikes
   */
  async checkHighQueue() {
    try {
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      const queue = response.data?.checks?.queue;

      if (queue && queue.totalJobs > this.thresholds.queueSize) {
        // Wait 30 seconds and check again to avoid false positives
        logger.info(`Queue spike detected: ${queue.totalJobs} jobs. Waiting 30s to confirm...`);

        await new Promise(resolve => setTimeout(resolve, 30000));

        // Re-check queue after delay
        const retryResponse = await axios.get('http://localhost:3000/health', { timeout: 5000 });
        const retryQueue = retryResponse.data?.checks?.queue;

        // Only alert if queue is still high after 30 seconds
        if (retryQueue && retryQueue.totalJobs > this.thresholds.queueSize) {
          if (this.shouldAlert('high_queue')) {
            await this.bot.sendMessage(ADMIN_CHAT_ID, `
⚠️ <b>Высокая нагрузка очереди!</b>

Сообщений в очереди: ${retryQueue.totalJobs}
Порог: ${this.thresholds.queueSize}
Время: ${new Date().toLocaleString('ru-RU')}

<b>Возможные причины:</b>
• Много входящих сообщений
• Медленная обработка AI
• Проблемы с worker

Проверьте: /queue

<i>Автоматический алерт (подтверждено через 30 сек)</i>
`);
          }
        } else {
          logger.info(`Queue cleared after 30s: ${retryQueue?.totalJobs || 0} jobs. No alert sent.`);
        }
      }
    } catch (error) {
      logger.error('Queue check failed:', error.message);
    }
  }

  /**
   * Check Database Auth State keys
   */
  async checkDatabaseKeys() {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY;

      if (!supabaseUrl || !supabaseKey) return;

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { count, error } = await supabase
        .from('whatsapp_keys')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      if (count > this.thresholds.dbKeys) {
        if (this.shouldAlert('db_keys_overflow')) {
          await this.bot.sendMessage(ADMIN_CHAT_ID, `
⚠️ <b>Database Auth State: Много ключей!</b>

Ключей в БД: ${count}
Порог: ${this.thresholds.dbKeys}
Время: ${new Date().toLocaleString('ru-RU')}

<b>Проблема:</b>
TTL cleanup возможно не работает!

<b>Действия:</b>
1. Проверьте: /db_health
2. Проверьте истёкшие ключи
3. Возможно нужна ручная очистка

<i>Автоматический алерт</i>
`);
        }
      }
    } catch (error) {
      logger.error('Database keys check failed:', error.message);
    }
  }

  /**
   * Check memory usage
   */
  async checkMemoryUsage() {
    try {
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      const memory = response.data?.checks?.memory;

      if (memory && parseFloat(memory.percentage) > this.thresholds.memory) {
        if (this.shouldAlert('high_memory')) {
          await this.bot.sendMessage(ADMIN_CHAT_ID, `
⚠️ <b>Высокое использование памяти!</b>

Использовано: ${memory.percentage}%
Порог: ${this.thresholds.memory}%
Heap: ${memory.heapUsedMB}MB / ${memory.heapTotalMB}MB
RSS: ${memory.rssMB}MB
Время: ${new Date().toLocaleString('ru-RU')}

<b>Действия:</b>
1. Проверьте статус: /status
2. Возможно нужен restart
3. Проверьте memory leaks

<i>Автоматический алерт</i>
`);
        }
      }
    } catch (error) {
      logger.error('Memory check failed:', error.message);
    }
  }

  /**
   * Check last activity (no messages processed)
   */
  async checkActivity() {
    try {
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      const activity = response.data?.checks?.lastActivity;

      if (activity && activity.lastMessageMinutesAgo > this.thresholds.noActivityMinutes) {
        if (this.shouldAlert('no_activity')) {
          await this.bot.sendMessage(ADMIN_CHAT_ID, `
⚠️ <b>Нет активности!</b>

Последнее сообщение: ${activity.lastMessageMinutesAgo} мин назад
Порог: ${this.thresholds.noActivityMinutes} мин
Время: ${new Date().toLocaleString('ru-RU')}

<b>Возможные причины:</b>
• Система зависла
• Нет входящих сообщений
• Проблемы с WhatsApp webhook

Проверьте: /health

<i>Автоматический алерт</i>
`, { silent: true });
        }
      }
    } catch (error) {
      logger.error('Activity check failed:', error.message);
    }
  }

  /**
   * Schedule daily summary at 9:00 AM Moscow time
   */
  scheduleDailySummary() {
    const checkDailySummary = () => {
      const now = new Date();
      const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));

      // Check if it's 9:00 AM
      if (moscowTime.getHours() === 9 && moscowTime.getMinutes() === 0) {
        this.sendDailySummary();
      }
    };

    // Check every minute
    const summaryInterval = setInterval(checkDailySummary, 60 * 1000);
    this.intervals.push(summaryInterval);
  }

  /**
   * Send daily summary
   */
  async sendDailySummary() {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY;

      if (!supabaseUrl || !supabaseKey) return;

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Count bookings
      const { count: bookings } = await supabase
        .from('records')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString())
        .eq('company_id', 962302);

      // Count new clients
      const { count: newClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString())
        .eq('company_id', 962302);

      // Get system uptime
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      const uptime = Math.floor(response.data.uptime / 3600); // hours

      await this.bot.sendMessage(ADMIN_CHAT_ID, `
📊 <b>Ежедневная сводка AI Admin</b>

📅 Вчера (${yesterday.toLocaleDateString('ru-RU')}):
• Создано записей: ${bookings || 0}
• Новых клиентов: ${newClients || 0}

🔧 Система:
• Uptime: ${uptime}ч
• Статус: ${response.data.status === 'ok' ? '✅ OK' : '⚠️ Warning'}

Для деталей: /stats yesterday

<i>Ежедневная автоматическая сводка</i>
`, { silent: true });

    } catch (error) {
      logger.error('Daily summary failed:', error.message);
    }
  }
}

// Запускаем бота
if (require.main === module) {
  const bot = new TelegramBot();
  const monitor = new ProactiveMonitor(bot);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, stopping bot and monitor...');
    monitor.stop();
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, stopping bot and monitor...');
    monitor.stop();
    await bot.stop();
    process.exit(0);
  });

  // Start bot (will run forever)
  bot.run().catch(error => {
    logger.error('Failed to start bot:', error);
    monitor.stop();
    process.exit(1);
  });

  // Start proactive monitor (after a short delay to let bot initialize)
  setTimeout(() => {
    monitor.start();
  }, 3000);
}

module.exports = TelegramBot;