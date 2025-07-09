// src/services/nlu/prompt-builder.js
const { AI_PROMPT, AVAILABLE_SERVICES, AVAILABLE_STAFF } = require('./constants');

/**
 * Builds prompts for AI entity extraction
 */
class PromptBuilder {
  constructor() {
    // Pre-build static parts of prompt
    this._basePrompt = this._buildBasePrompt();
    this._exampleJson = this._buildExampleJson();
  }

  /**
   * Build static parts of the prompt
   * @private
   */
  _buildBasePrompt() {
    return `Ты - эксперт по обработке естественного языка для салона красоты. Анализируй ТОЛЬКО сообщение клиента и извлекай сущности.

ДОСТУПНЫЕ УСЛУГИ: ${AVAILABLE_SERVICES.join(', ')}
ДОСТУПНЫЕ МАСТЕРА: ${AVAILABLE_STAFF.join(', ')}

ЗАДАЧА: Извлеки сущности и определи намерение клиента.
КРИТИЧЕСКИ ВАЖНО: НЕ ДОБАВЛЯЙ поле "response" в ответ!`;
  }

  /**
   * Build example JSON structure
   * @private
   */
  _buildExampleJson() {
    return {
      intent: "booking|reschedule|cancel|info|other",
      entities: {
        service: "точное название услуги или null",
        staff: "имя мастера или null", 
        date: "YYYY-MM-DD или null",
        time: "HH:MM или null",
        info_type: "staff_today|prices|services|schedule или null",
        time_preference: "morning|afternoon|evening или null"
      },
      confidence: "число от 0 до 1",
      reasoning: "краткое объяснение"
    };
  }

  /**
   * Build specialized prompt for entity extraction
   * @param {string} message - User message
   * @param {Object} context - User context with optional fields
   * @returns {string} Formatted prompt
   */
  buildExtractionPrompt(message, context) {
    // Use memoized date/time if processing multiple messages in same second
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().substring(0, 5);

    // Build dynamic context based on what's available
    const contextParts = [
      `- Текущая дата: ${currentDate}`,
      `- Текущее время: ${currentTime}`
    ];

    // Add previous booking info if available
    if (context.lastBooking) {
      contextParts.push(`- Последняя запись: ${context.lastBooking.service} к ${context.lastBooking.staff}`);
    }

    // Add client preference if known
    if (context.client?.preferredStaff) {
      contextParts.push(`- Предпочитаемый мастер: ${context.client.preferredStaff}`);
    }

    return `${this._basePrompt}

СООБЩЕНИЕ КЛИЕНТА: "${message}"

КОНТЕКСТ:
${contextParts.join('\n')}

ОТВЕТЬ СТРОГО в JSON формате:
${JSON.stringify(this._exampleJson, null, 2)}

ПРАВИЛА:
1. intent = "booking" для записи, "info" для вопросов
2. Преобразуй относительные даты: "сегодня" → "${currentDate}", "завтра" → "${this._getTomorrowDate()}"
3. Нормализуй время: "утром" → "09:00", "днем" → "12:00", "вечером" → "18:00"
4. staff = null если мастер не указан явно
5. confidence = ${AI_PROMPT.CONFIDENCE_HIGH} если все ясно, ${AI_PROMPT.CONFIDENCE_MEDIUM_MIN}-${AI_PROMPT.CONFIDENCE_MEDIUM_MAX} при неточностях

АНАЛИЗИРУЙ:`;
  }

  /**
   * Get tomorrow's date in YYYY-MM-DD format
   * @private
   */
  _getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  /**
   * Build a simplified prompt for quick intent detection
   * @param {string} message - User message
   * @returns {string} Simplified prompt
   */
  buildQuickIntentPrompt(message) {
    return `Определи намерение клиента салона красоты в одном слове.

Сообщение: "${message}"

Варианты ответа:
- booking (хочет записаться)
- reschedule (хочет перенести запись)
- cancel (хочет отменить запись)
- info (спрашивает информацию)
- other (другое)

Ответь одним словом:`;
  }
}

module.exports = PromptBuilder;