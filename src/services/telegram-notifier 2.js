// src/services/telegram-notifier.js
const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Сервис для отправки уведомлений в Telegram
 * Отправляет критические события администратору
 */
class TelegramNotifier {
  constructor() {
    // Эти значения нужно добавить в .env файл:
    // TELEGRAM_BOT_TOKEN=your_bot_token
    // TELEGRAM_CHAT_ID=your_chat_id
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.enabled = !!(this.botToken && this.chatId);

    if (!this.enabled) {
      logger.warn('Telegram notifications disabled - missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    }

    // Защита от спама - не более 1 сообщения в минуту для одного типа
    this.lastNotifications = new Map();
    this.notificationCooldown = 60000; // 1 минута
  }

  /**
   * Отправка сообщения в Telegram
   */
  async send(message, options = {}) {
    if (!this.enabled) {
      logger.debug('Telegram notification skipped (disabled):', message);
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

      const payload = {
        chat_id: this.chatId,
        text: message,
        parse_mode: options.parseMode || 'HTML',
        disable_notification: options.silent || false
      };

      const response = await axios.post(url, payload, {
        timeout: 5000
      });

      if (response.data.ok) {
        logger.debug('Telegram notification sent successfully');
        return true;
      } else {
        logger.error('Telegram API error:', response.data);
        return false;
      }
    } catch (error) {
      logger.error('Failed to send Telegram notification:', error.message);
      return false;
    }
  }

  /**
   * Проверка на спам - не отправляем одинаковые уведомления слишком часто
   */
  shouldSend(type, key = '') {
    const notificationKey = `${type}:${key}`;
    const lastSent = this.lastNotifications.get(notificationKey);

    if (!lastSent) {
      this.lastNotifications.set(notificationKey, Date.now());
      return true;
    }

    const timeSinceLastSent = Date.now() - lastSent;

    if (timeSinceLastSent >= this.notificationCooldown) {
      this.lastNotifications.set(notificationKey, Date.now());
      return true;
    }

    return false;
  }

  /**
   * Уведомление о критической ошибке
   */
  async notifyError(error, context = {}) {
    if (!this.shouldSend('error', error.message)) {
      return;
    }

    const companyInfo = context.companyId ? `\nКомпания: ${context.companyId}` : '';
    const phoneInfo = context.phone ? `\nТелефон: ${context.phone}` : '';

    const message = `
🚨 <b>ОШИБКА В AI ADMIN</b>

<code>${error.message}</code>

📍 Модуль: ${context.module || 'unknown'}${companyInfo}${phoneInfo}
🕐 Время: ${new Date().toLocaleString('ru-RU')}

${error.stack ? `<pre>${error.stack.slice(0, 500)}</pre>` : ''}

Используйте: <code>./recovery.sh</code> для восстановления
`;

    await this.send(message);
  }

  /**
   * Уведомление о проблемах с WhatsApp
   */
  async notifyWhatsAppIssue(companyId, issue) {
    if (!this.shouldSend('whatsapp', companyId)) {
      return;
    }

    const message = `
📱 <b>Проблема с WhatsApp</b>

Компания: ${companyId}
Проблема: ${issue}
Время: ${new Date().toLocaleString('ru-RU')}

Действия:
1. Проверьте: <code>curl http://localhost:3000/health/company/${companyId}</code>
2. Восстановите: <code>./recovery.sh whatsapp</code>
3. Проверьте QR-код в логах
`;

    await this.send(message);
  }

  /**
   * Уведомление о высокой нагрузке
   */
  async notifyHighLoad(metrics) {
    if (!this.shouldSend('load', '')) {
      return;
    }

    const message = `
⚠️ <b>Высокая нагрузка системы</b>

📊 Метрики:
• Очередь сообщений: ${metrics.queueSize || 0}
• Использование памяти: ${metrics.memoryMB || 0} MB
• CPU: ${metrics.cpu || 0}%
• Активных чатов: ${metrics.activeChats || 0}

Рекомендации:
• Проверьте процессы: <code>pm2 status</code>
• При необходимости: <code>./recovery.sh soft</code>
`;

    await this.send(message, { silent: true });
  }

  /**
   * Уведомление об успешном восстановлении
   */
  async notifyRecovery(what) {
    const message = `
✅ <b>Система восстановлена</b>

Что восстановлено: ${what}
Время: ${new Date().toLocaleString('ru-RU')}

Статус: <code>curl http://localhost:3000/health</code>
`;

    await this.send(message);
  }

  /**
   * Уведомление о новой компании
   */
  async notifyNewCompany(companyId, companyName) {
    const message = `
🎉 <b>Подключена новая компания!</b>

ID: ${companyId}
Название: ${companyName || 'Не указано'}
Время: ${new Date().toLocaleString('ru-RU')}

Проверьте статус:
<code>curl http://localhost:3000/health/company/${companyId}</code>
`;

    await this.send(message);
  }

  /**
   * Ежедневная сводка
   */
  async sendDailySummary(stats) {
    const message = `
📈 <b>Ежедневная сводка AI Admin</b>

📊 За последние 24 часа:
• Обработано сообщений: ${stats.messagesProcessed || 0}
• Создано записей: ${stats.bookingsCreated || 0}
• Ошибок: ${stats.errors || 0}
• Среднее время ответа: ${stats.avgResponseTime || 0}ms

🏢 Активные компании: ${stats.activeCompanies || 1}
💬 Уникальных пользователей: ${stats.uniqueUsers || 0}

🔧 Состояние системы:
• Uptime: ${stats.uptime || '0h'}
• Память: ${stats.memoryUsage || 0}MB
• Размер БД Redis: ${stats.redisKeys || 0} ключей

${stats.errors > 10 ? '\n⚠️ Внимание: Высокое количество ошибок!' : '✅ Система работает стабильно'}
`;

    await this.send(message, { silent: true });
  }
}

// Создаём singleton
const telegramNotifier = new TelegramNotifier();

module.exports = telegramNotifier;