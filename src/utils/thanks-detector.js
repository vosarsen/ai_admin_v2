// src/utils/thanks-detector.js
const logger = require('./logger');

/**
 * Утилита для определения благодарностей в сообщениях
 */
class ThanksDetector {
  constructor() {
    // Паттерны благодарности на русском
    this.thanksPatterns = [
      // Прямые благодарности
      /\b(спасибо|спасиб|спс|благодарю|благодарен|благодарна)\b/i,
      // С дополнениями
      /\b(большое\s+спасибо|огромное\s+спасибо|спасибо\s+большое|спасибо\s+огромное)\b/i,
      // Вариации
      /\b(благодарствую|благодарность|признателен|признательна)\b/i,
      // Сокращения и сленг
      /\b(пасиб|пасибо|пасибки|спасибки|сенкс|сенькс|сэнкс)\b/i,
      // Английские варианты
      /\b(thanks|thank\s+you|thx|thnx|ty)\b/i,
      // Эмоциональные благодарности
      /\b(спасибо.*[!❤️🙏💕😊]|[❤️🙏💕]\s*спасибо)\b/i,
      // "Это всё" как завершение разговора после благодарности
      /\b(это\s+всё|всё\s+спасибо|пока\s+спасибо)\b/i
    ];

    // Паттерны фраз после благодарности, которые НЕ требуют продолжения диалога
    this.closingPatterns = [
      /\b(это\s+всё|всё|пока|до\s+свидания|больше\s+ничего|больше\s+не\s+надо)\b/i,
      /\b(больше\s+ничем|всё\s+хорошо|всё\s+отлично|всё\s+понятно)\b/i,
      /\b(не\s+нужно|не\s+надо|ничего\s+не\s+надо|ничем\s+не\s+помочь)\b/i,
      /\b(достаточно|хватит|всё\s+ок|всё\s+окей)\b/i
    ];
  }

  /**
   * Проверяет, является ли сообщение благодарностью
   * @param {string} message - Текст сообщения
   * @returns {boolean}
   */
  isThanks(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const normalizedMessage = message.toLowerCase().trim();
    
    // Проверяем каждый паттерн
    for (const pattern of this.thanksPatterns) {
      if (pattern.test(normalizedMessage)) {
        logger.debug(`Thanks detected in message: "${message}" (pattern: ${pattern})`);
        return true;
      }
    }

    return false;
  }

  /**
   * Проверяет, содержит ли сообщение признаки завершения диалога
   * @param {string} message - Текст сообщения
   * @returns {boolean}
   */
  isClosingMessage(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const normalizedMessage = message.toLowerCase().trim();
    
    // Проверяем паттерны завершения
    for (const pattern of this.closingPatterns) {
      if (pattern.test(normalizedMessage)) {
        logger.debug(`Closing phrase detected in message: "${message}" (pattern: ${pattern})`);
        return true;
      }
    }

    return false;
  }

  /**
   * Определяет тип реакции на сообщение
   * @param {string} message - Текст сообщения
   * @returns {Object} - { shouldReact: boolean, shouldAskMore: boolean }
   */
  analyzeMessage(message) {
    const isThanks = this.isThanks(message);
    const isClosing = this.isClosingMessage(message);

    return {
      shouldReact: isThanks,           // Отправить реакцию ❤️
      shouldAskMore: false,             // НЕ спрашивать "Чем еще могу помочь?"
      isConversationEnd: isThanks || isClosing  // Признак завершения диалога
    };
  }
}

// Экспортируем синглтон
module.exports = new ThanksDetector();