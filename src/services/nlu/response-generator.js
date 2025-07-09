// src/services/nlu/response-generator.js
const logger = require('../../utils/logger');

/**
 * Generates appropriate responses based on actions and context
 */
class ResponseGenerator {
  constructor(actionResolver) {
    this.actionResolver = actionResolver;
  }

  /**
   * Generate appropriate response - НЕ генерируем промежуточные сообщения
   * @param {Object} parsed - Object with intent, entities, and optionally action
   * @param {Object} context - User context
   * @returns {string|null} Generated response or null for search_slots
   */
  generateResponse(parsed, context) {
    // Validate input
    if (!parsed || typeof parsed !== 'object') {
      logger.error('Invalid input to generateResponse:', parsed);
      return 'Извините, произошла ошибка. Попробуйте еще раз.';
    }
    
    // Ensure action is always present
    this.actionResolver.ensureAction(parsed);
    
    const { intent, entities, action } = parsed;
    
    // Validate entities
    if (!entities || typeof entities !== 'object') {
      logger.warn('Missing or invalid entities in generateResponse');
      return 'Извините, не удалось распознать ваш запрос. Пожалуйста, уточните.';
    }
    
    logger.info('🎯 Generating response for:', {
      intent,
      action,
      hasEntities: !!entities
    });
    
    // CRITICAL: For search_slots ALWAYS return null
    if (action === 'search_slots') {
      logger.info('🔍 Returning null for search_slots - response will be generated later');
      return null;
    }
    
    if (action === 'create_booking') {
      const response = `Записываю вас к ${entities.staff} на ${entities.date} в ${entities.time}. Подтверждаю запись.`;
      logger.info('📝 Generated create_booking response:', response);
      return response;
    }
    
    if (intent === 'info') {
      const response = 'Какую информацию вас интересует? Расценки, режим работы или услуги?';
      logger.info('ℹ️ Generated info response:', response);
      return response;
    }
    
    const defaultResponse = 'Здравствуйте! Я помогу вам записаться на услуги. Скажите, на какую дату и время вы хотели бы записаться?';
    logger.info('💬 Generated default response:', defaultResponse);
    return defaultResponse;
  }
}

module.exports = ResponseGenerator;