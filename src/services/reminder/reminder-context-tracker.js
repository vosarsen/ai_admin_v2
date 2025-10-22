// src/services/reminder/reminder-context-tracker.js
/**
 * Отслеживание контекста напоминаний
 * Сохраняет информацию о последнем отправленном напоминании в Redis
 * чтобы правильно обрабатывать ответы клиентов
 */

const logger = require('../../utils/logger');
const { createRedisClient } = require('../../utils/redis-factory');
const config = require('../../config');

class ReminderContextTracker {
  constructor() {
    this.redisPrefix = 'reminder_context:';
    this.ttl = 24 * 60 * 60; // 24 часа
    this.redis = null;
    this._initRedis();
  }

  async _initRedis() {
    try {
      this.redis = await createRedisClient();
      logger.info('✅ Redis client initialized for ReminderContextTracker');
    } catch (error) {
      logger.error('Failed to initialize Redis client:', error);
    }
  }

  /**
   * Сохранить информацию о последнем отправленном напоминании
   */
  async saveReminderContext(phone, bookingData, reminderType) {
    try {
      if (!this.redis) {
        logger.warn('Redis client not initialized, trying to reconnect...');
        await this._initRedis();
        if (!this.redis) {
          logger.error('Failed to initialize Redis client');
          return false;
        }
      }
      
      const key = `${this.redisPrefix}${phone}`;
      
      const context = {
        type: reminderType, // 'day_before', '2hours'
        sentAt: new Date().toISOString(),
        booking: {
          recordId: bookingData.record_id || bookingData.id,
          datetime: bookingData.datetime,
          serviceName: bookingData.service_name,
          staffName: bookingData.staff_name
        },
        awaitingConfirmation: true
      };

      await this.redis.set(key, JSON.stringify(context), 'EX', this.ttl);
      
      logger.info(`📝 Saved reminder context for ${phone}:`, {
        type: reminderType,
        recordId: context.booking.recordId
      });

      return true;
    } catch (error) {
      logger.error('Failed to save reminder context:', error);
      return false;
    }
  }

  /**
   * Получить контекст последнего напоминания
   */
  async getReminderContext(phone) {
    try {
      const key = `${this.redisPrefix}${phone}`;
      const data = await this.redis.get(key);
      
      if (!data) {
        return null;
      }

      const context = JSON.parse(data);
      
      // Проверяем актуальность (не старше 12 часов для ожидания подтверждения)
      const sentAt = new Date(context.sentAt);
      const hoursAgo = (Date.now() - sentAt.getTime()) / (1000 * 60 * 60);
      
      if (context.awaitingConfirmation && hoursAgo > 12) {
        // Контекст устарел
        await this.clearReminderContext(phone);
        return null;
      }

      return context;
    } catch (error) {
      logger.error('Failed to get reminder context:', error);
      return null;
    }
  }

  /**
   * Очистить контекст напоминания (после обработки ответа)
   */
  async clearReminderContext(phone) {
    try {
      const key = `${this.redisPrefix}${phone}`;
      await this.redis.del(key);
      logger.debug(`🗑️ Cleared reminder context for ${phone}`);
      return true;
    } catch (error) {
      logger.error('Failed to clear reminder context:', error);
      return false;
    }
  }

  /**
   * Пометить, что подтверждение получено
   */
  async markAsConfirmed(phone) {
    try {
      const context = await this.getReminderContext(phone);
      if (!context) {
        return false;
      }

      context.awaitingConfirmation = false;
      context.confirmedAt = new Date().toISOString();

      const key = `${this.redisPrefix}${phone}`;
      await this.redis.set(key, JSON.stringify(context), 'EX', this.ttl);
      
      logger.info(`✅ Marked reminder as confirmed for ${phone}`);
      return true;
    } catch (error) {
      logger.error('Failed to mark reminder as confirmed:', error);
      return false;
    }
  }

  /**
   * Проверить, является ли сообщение подтверждением напоминания (паттерны)
   */
  isConfirmationMessage(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const lowerMessage = message.toLowerCase().trim();

    // Расширенные паттерны подтверждения
    const confirmationPatterns = [
      // Базовые подтверждения
      'ок', 'ok', 'да', 'yes', 'конечно', 'обязательно',
      'приду', 'придем', 'буду', 'будем', 'спасибо', 'хорошо',
      'договорились', 'подтверждаю', 'согласен', 'согласна',

      // Дополнительные варианты
      'отлично', 'супер', 'пойду', 'пойдем', 'ага', 'угу',
      'точно', 'естественно', 'разумеется', 'без проблем',
      'ладно', 'окей', 'океюшки', 'ок)', 'ок!', 'да)', 'да!',
      'приду!', 'буду!', 'конечно!', 'конечно приду',
      'обязательно приду', 'обязательно буду', 'точно приду',
      'точно буду', 'да приду', 'да буду', 'ага приду',

      // Сленг и разговорные
      'оки', 'окс', 'давай', 'го', 'погнали', 'ес',
      'есс', 'есть', 'ясн', 'ясно', 'понял', 'поняла',
      'записывай', 'записывайте', 'жду', 'ждём',

      // Благодарности (часто идут вместе с подтверждением)
      'спс', 'спасибо!', 'благодарю', 'thanks', 'thx',

      // Эмодзи подтверждения
      '👍', '👌', '✅', '💯', '+', '++', 'подтверждено',
      '❤️', '💗', '❤', '♥️', '💙', '💚', '💛', '💜',
      '👏', '🙏', '😊', '🙂', '😉', '🤝', '💪'
    ];

    // Проверяем точное совпадение
    if (confirmationPatterns.includes(lowerMessage)) {
      return true;
    }

    // Проверяем, начинается ли сообщение с паттерна подтверждения
    const startsWithPattern = confirmationPatterns.some(pattern =>
      lowerMessage.startsWith(pattern + ' ') ||
      lowerMessage.startsWith(pattern + ',') ||
      lowerMessage.startsWith(pattern + '.') ||
      lowerMessage.startsWith(pattern + '!')
    );

    if (startsWithPattern) {
      return true;
    }

    // Проверяем содержание ключевых фраз (более гибко)
    const confirmationPhrases = [
      'приду на запись',
      'буду на визите',
      'подтверждаю запись',
      'подтверждаю визит',
      'все в силе',
      'всё в силе',
      'всё подтверждаю',
      'все подтверждаю'
    ];

    return confirmationPhrases.some(phrase => lowerMessage.includes(phrase));
  }

  /**
   * Использовать AI для определения является ли сообщение подтверждением
   * Fallback метод, вызывается только если паттерны не сработали
   */
  async isConfirmationByAI(message) {
    try {
      // Импортируем AI provider только когда нужно
      const providerFactory = require('../ai/provider-factory');
      const provider = providerFactory.getProvider();

      const prompt = `Клиент ответил на напоминание о записи в салон.

Сообщение клиента: "${message}"

Это положительное подтверждение того, что клиент ПРИДЕТ на визит?

Важно:
- Если клиент подтверждает визит (да, приду, буду, ок и т.д.) → ответь "YES"
- Если клиент отменяет, переносит или задает вопросы → ответь "NO"
- Если неясно или двусмысленно → ответь "NO"

Ответь ТОЛЬКО одним словом: YES или NO`;

      logger.info('🤖 Using AI to detect confirmation intent', {
        message: message.substring(0, 100)
      });

      const response = await provider.call(prompt, {
        maxTokens: 10, // Нужно всего 1 токен для ответа
        temperature: 0 // Детерминированный ответ
      });

      const answer = response.trim().toUpperCase();
      const isConfirmation = answer === 'YES';

      logger.info(`🤖 AI confirmation detection result: ${answer}`, {
        isConfirmation,
        message: message.substring(0, 50)
      });

      return isConfirmation;

    } catch (error) {
      logger.error('Failed to use AI for confirmation detection:', error);
      // При ошибке AI считаем что НЕ подтверждение (безопасный fallback)
      return false;
    }
  }

  /**
   * Проверить, нужно ли обрабатывать сообщение как ответ на напоминание
   * Использует гибридный подход: сначала паттерны, потом AI
   */
  async shouldHandleAsReminderResponse(phone, message) {
    const context = await this.getReminderContext(phone);

    if (!context || !context.awaitingConfirmation) {
      return false;
    }

    // Проверяем, прошло ли меньше 30 минут с момента отправки
    const sentAt = new Date(context.sentAt);
    const minutesAgo = (Date.now() - sentAt.getTime()) / (1000 * 60);

    if (minutesAgo > 30) {
      // Слишком много времени прошло
      logger.debug(`Reminder timeout: ${minutesAgo} minutes since reminder sent`);
      return false;
    }

    // 1. Сначала проверяем быстрые паттерны (0.001ms)
    const patternMatch = this.isConfirmationMessage(message);

    if (patternMatch) {
      logger.info('✅ Confirmation detected by pattern matching');
      return true;
    }

    // 2. Если паттерны не сработали - используем AI (1-2 секунды)
    logger.info('🤖 Pattern matching failed, falling back to AI detection');
    const aiMatch = await this.isConfirmationByAI(message);

    if (aiMatch) {
      logger.info('✅ Confirmation detected by AI');
    } else {
      logger.info('❌ Not a confirmation (AI result)');
    }

    return aiMatch;
  }
}

module.exports = new ReminderContextTracker();