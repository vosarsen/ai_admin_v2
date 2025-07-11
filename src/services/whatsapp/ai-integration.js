// src/services/whatsapp/ai-integration.js
const aiAdmin = require('../ai-admin');
const logger = require('../../utils/logger');
const { getCompanyId } = require('../../utils/phone-utils');

/**
 * Простая интеграция AI администратора с WhatsApp
 */
class WhatsAppAIIntegration {
  /**
   * Обработка входящего сообщения WhatsApp
   */
  async handleMessage(message) {
    const { from, body, timestamp } = message;
    
    logger.info(`📨 WhatsApp сообщение от ${from}: "${body}"`);

    try {
      // Определяем компанию по номеру (если многокомпанийный режим)
      const companyId = await getCompanyId(from) || process.env.YCLIENTS_COMPANY_ID;

      // Передаем сообщение AI администратору
      const result = await aiAdmin.processMessage(body, from, companyId);

      if (result.success) {
        logger.info('✅ AI успешно обработал сообщение');
        return {
          success: true,
          response: result.response,
          booking: result.booking || null
        };
      } else {
        logger.error('❌ Ошибка обработки AI:', result.error);
        return {
          success: false,
          response: result.response || 'Извините, возникла ошибка. Попробуйте позже.'
        };
      }

    } catch (error) {
      logger.error('Критическая ошибка в AI интеграции:', error);
      return {
        success: false,
        response: 'Извините, сервис временно недоступен. Пожалуйста, позвоните нам напрямую.'
      };
    }
  }

  /**
   * Проверка, нужно ли обрабатывать сообщение через AI
   */
  shouldProcessWithAI(message) {
    // Пропускаем служебные сообщения
    if (message.isStatus || message.isMedia || message.isNotification) {
      return false;
    }

    // Пропускаем команды
    if (message.body && message.body.startsWith('/')) {
      return false;
    }

    return true;
  }

  /**
   * Форматирование ответа для WhatsApp
   */
  formatResponse(response) {
    // WhatsApp имеет ограничение на длину сообщения
    const maxLength = 4096;
    
    if (response.length <= maxLength) {
      return [response];
    }

    // Разбиваем длинные сообщения
    const messages = [];
    let currentMessage = '';
    
    const lines = response.split('\n');
    for (const line of lines) {
      if (currentMessage.length + line.length + 1 > maxLength) {
        messages.push(currentMessage.trim());
        currentMessage = line;
      } else {
        currentMessage += (currentMessage ? '\n' : '') + line;
      }
    }
    
    if (currentMessage) {
      messages.push(currentMessage.trim());
    }

    return messages;
  }

  /**
   * Отправка подтверждения о создании записи
   */
  async sendBookingConfirmation(booking, phone) {
    const { services, staff, datetime } = booking;
    
    const confirmationText = `
✅ *Ваша запись подтверждена!*

📅 Дата и время: ${this.formatDateTime(datetime)}
💇 Услуга: ${services.map(s => s.title).join(', ')}
👤 Мастер: ${staff.name}
📍 Адрес: ${booking.company.address}

💳 Стоимость: ${booking.cost}₽

_Мы отправим вам напоминание за день до визита._

Если нужно изменить или отменить запись, просто напишите нам!
    `.trim();

    return confirmationText;
  }

  /**
   * Форматирование даты и времени
   */
  formatDateTime(datetime) {
    const date = new Date(datetime);
    const options = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow'
    };
    
    return date.toLocaleString('ru-RU', options);
  }
}

module.exports = new WhatsAppAIIntegration();