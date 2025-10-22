// src/services/reminder/reminder-response-handler.js
/**
 * Обработчик ответов на напоминания
 * Автоматически подтверждает визиты когда клиент отвечает положительно
 */

const logger = require('../../utils/logger');
const reminderContextTracker = require('./reminder-context-tracker');
const { YclientsClient } = require('../../integrations/yclients/client');
const whatsappClient = require('../../integrations/whatsapp/client');
const config = require('../../config');

class ReminderResponseHandler {
  constructor() {
    this.yclientsClient = new YclientsClient({
      companyId: config.yclients.companyId,
      bearerToken: config.yclients.bearerToken,
      userToken: config.yclients.userToken,
      partnerId: config.yclients.partnerId
    });
  }

  /**
   * Обработать ответ клиента на напоминание
   * @param {string} phone - Телефон клиента
   * @param {string} message - Текст сообщения
   * @param {string} messageId - ID сообщения (для реакции)
   * @returns {Promise<{handled: boolean, confirmed: boolean, error?: string}>}
   */
  async handleResponse(phone, message, messageId = null) {
    try {
      logger.info(`📨 Checking if message is reminder response`, {
        phone: this._sanitizePhone(phone),
        messagePreview: message.substring(0, 50)
      });

      // 1. Проверяем через reminderContextTracker (с паттернами + AI)
      const shouldHandle = await reminderContextTracker.shouldHandleAsReminderResponse(
        phone,
        message
      );

      if (!shouldHandle) {
        logger.debug('Not a reminder response, skipping');
        return {
          handled: false,
          confirmed: false
        };
      }

      logger.info(`✅ Confirmed reminder response detected from ${this._sanitizePhone(phone)}`);

      // 2. Получаем контекст напоминания
      const context = await reminderContextTracker.getReminderContext(phone);

      if (!context || !context.booking) {
        logger.error('No booking context found for reminder response', { phone });
        return {
          handled: true,
          confirmed: false,
          error: 'No booking context'
        };
      }

      const { recordId } = context.booking;

      if (!recordId) {
        logger.error('No recordId in booking context', { context });
        return {
          handled: true,
          confirmed: false,
          error: 'No recordId'
        };
      }

      logger.info(`📝 Processing confirmation for booking ${recordId}`);

      // 3. Обновляем статус в YClients (attendance = 2 "подтвержден")
      const updateResult = await this._updateBookingStatus(recordId);

      if (!updateResult.success) {
        logger.error(`Failed to update booking ${recordId} status:`, updateResult.error);
        return {
          handled: true,
          confirmed: false,
          error: updateResult.error
        };
      }

      logger.info(`✅ Booking ${recordId} confirmed in YClients`);

      // 4. Отправляем реакцию ❤️ на сообщение клиента
      await this._sendReaction(phone, messageId);

      // 5. Помечаем как подтвержденное в Redis
      await reminderContextTracker.markAsConfirmed(phone);

      logger.info(`🎉 Reminder response successfully processed for ${this._sanitizePhone(phone)}`, {
        recordId,
        message: message.substring(0, 50)
      });

      return {
        handled: true,
        confirmed: true,
        recordId,
        bookingDetails: context.booking
      };

    } catch (error) {
      logger.error('Error handling reminder response:', error);
      return {
        handled: true,
        confirmed: false,
        error: error.message
      };
    }
  }

  /**
   * Обновить статус записи в YClients
   * @private
   */
  async _updateBookingStatus(recordId) {
    try {
      // attendance = 2 означает "Подтвердил запись"
      const result = await this.yclientsClient.updateBookingStatus(recordId, 2);

      if (!result.success) {
        logger.error(`YClients API error when updating booking ${recordId}:`, result.error);
        return {
          success: false,
          error: result.error || 'Failed to update booking status'
        };
      }

      logger.info(`✅ Booking ${recordId} status updated to "confirmed" (attendance=2)`);
      return { success: true };

    } catch (error) {
      logger.error(`Exception updating booking ${recordId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Отправить реакцию на сообщение клиента
   * @private
   */
  async _sendReaction(phone, messageId) {
    try {
      // Отправляем реакцию ❤️
      const result = await whatsappClient.sendReaction(phone, '❤️');

      if (result.success) {
        logger.info(`💖 Reaction sent to ${this._sanitizePhone(phone)}`);
      } else {
        // Не критично если реакция не отправилась
        logger.warn(`Failed to send reaction to ${this._sanitizePhone(phone)}:`, result.error);
      }
    } catch (error) {
      // Не критично, просто логируем
      logger.warn(`Exception sending reaction:`, error);
    }
  }

  /**
   * Санитизация телефона для логов
   * @private
   */
  _sanitizePhone(phone) {
    if (!phone) return 'unknown';
    const digits = phone.replace(/\D/g, '');
    if (digits.length > 6) {
      return `${digits.substring(0, 3)}****${digits.substring(digits.length - 2)}`;
    }
    return 'phone_****';
  }

  /**
   * Получить статистику обработки подтверждений
   */
  getStats() {
    // TODO: Добавить метрики через Prometheus
    return {
      service: 'reminder-response-handler',
      status: 'operational'
    };
  }
}

module.exports = new ReminderResponseHandler();
