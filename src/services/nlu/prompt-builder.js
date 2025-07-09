// src/services/nlu/prompt-builder.js
const { AI_PROMPT, AVAILABLE_SERVICES, AVAILABLE_STAFF } = require('./constants');

/**
 * Builds prompts for AI entity extraction
 */
class PromptBuilder {
  /**
   * Build specialized prompt for entity extraction
   * @param {string} message - User message
   * @param {Object} context - User context
   * @returns {string} Formatted prompt
   */
  buildExtractionPrompt(message, context) {
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

    return `Ты - эксперт по обработке естественного языка для салона красоты. Анализируй ТОЛЬКО сообщение клиента и извлекай сущности.

СООБЩЕНИЕ КЛИЕНТА: "${message}"

КОНТЕКСТ:
- Текущая дата: ${currentDate}
- Текущее время: ${currentTime}
- Доступные мастера: ${AVAILABLE_STAFF.join(', ')}
- Услуги: ${AVAILABLE_SERVICES.join(', ')}

ЗАДАЧА: Извлеки сущности и определи намерение клиента.

КРИТИЧЕСКИ ВАЖНО: НЕ ДОБАВЛЯЙ поле "response" в ответ! Оно не требуется.

ОТВЕТЬ СТРОГО в JSON формате (БЕЗ поля response):
{
  "intent": "booking|reschedule|cancel|info|other",
  "entities": {
    "service": "точное название услуги или null",
    "staff": "имя мастера или null", 
    "date": "YYYY-MM-DD или null",
    "time": "HH:MM или null",
    "info_type": "staff_today|prices|services|schedule или null",
    "time_preference": "morning|afternoon|evening или null",
    "original_text": {
      "service": "как клиент написал услугу",
      "staff": "как клиент написал мастера",
      "date": "как клиент написал дату", 
      "time": "как клиент написал время"
    }
  },
  "confidence": "число от 0 до 1",
  "reasoning": "краткое объяснение принятого решения"
}

ПРАВИЛА:
1. intent = "booking" если клиент хочет записаться, "info" если спрашивает информацию
2. date = "сегодня" → "${currentDate}", "завтра" → следующий день
3. Если мастер не указан явно - staff = null
4. Если время не указано - time = null
5. info_type = "staff_today" если спрашивает кто работает
6. confidence = ${AI_PROMPT.CONFIDENCE_HIGH} если все понятно, ${AI_PROMPT.CONFIDENCE_MEDIUM_MIN}-${AI_PROMPT.CONFIDENCE_MEDIUM_MAX} если есть неточности

АНАЛИЗИРУЙ:`;
  }
}

module.exports = PromptBuilder;