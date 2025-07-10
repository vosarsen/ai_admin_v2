// src/services/nlu/prompt-builder.js
const { AI_PROMPT } = require('./constants');

/**
 * Builds prompts for AI entity extraction
 * @class PromptBuilder
 * @description Creates optimized prompts for AI-based entity extraction
 */
class PromptBuilder {
  /**
   * Creates an instance of PromptBuilder
   * @constructor
   * @description Pre-builds static prompt parts for performance optimization
   */
  constructor() {
    // Company data will be loaded dynamically
    this.companyData = new Map(); // companyId -> { services, staff }
    
    // Default prompt parts
    this._basePromptTemplate = `Ты - эксперт по обработке естественного языка для салона красоты. Анализируй ТОЛЬКО сообщение клиента и извлекай сущности.

ЗАДАЧА: Извлеки сущности и определи намерение клиента.
КРИТИЧЕСКИ ВАЖНО: НЕ ДОБАВЛЯЙ поле "response" в ответ!`;
    
    this._exampleJson = this._buildExampleJson();
  }

  /**
   * Update company-specific data
   * @param {string} companyId - Company ID
   * @param {Array} services - Array of services from database
   * @param {Array} staff - Array of staff from database
   */
  updateCompanyData(companyId, services = [], staff = []) {
    const serviceNames = services.map(s => s.title);
    const staffNames = staff.map(s => s.name);
    
    this.companyData.set(companyId, {
      services: serviceNames,
      staff: staffNames,
      servicesData: services,
      staffData: staff
    });
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
   * @param {string} message - User message to analyze
   * @param {Object} context - User context with optional fields
   * @param {Object} [context.lastBooking] - Previous booking information
   * @param {Object} [context.client] - Client information
   * @param {string} [context.client.preferredStaff] - Client's preferred staff member
   * @returns {string} Formatted prompt ready for AI processing
   * @example
   * buildExtractionPrompt('Хочу записаться на маникюр', {
   *   phone: '+79991234567',
   *   companyId: '12345',
   *   client: { preferredStaff: 'Мария' }
   * });
   */
  buildExtractionPrompt(message, context) {
    // Use memoized date/time if processing multiple messages in same second
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().substring(0, 5);
    
    // Get company-specific data
    const companyData = context.companyId ? this.companyData.get(context.companyId) : null;
    const availableServices = companyData?.services || [];
    const availableStaff = companyData?.staff || [];

    // Build dynamic prompt with actual company data
    let prompt = this._basePromptTemplate;
    
    if (availableServices.length > 0) {
      prompt += `\n\nДОСТУПНЫЕ УСЛУГИ: ${availableServices.join(', ')}`;
    }
    
    if (availableStaff.length > 0) {
      prompt += `\nДОСТУПНЫЕ МАСТЕРА: ${availableStaff.join(', ')}`;
    }

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

    // Add conversation history if available
    let historySection = '';
    if (context.lastMessages && context.lastMessages.length > 0) {
      const recentMessages = context.lastMessages.slice(0, 5); // Last 5 messages
      historySection = `\n\nИСТОРИЯ ДИАЛОГА:
${recentMessages.map(m => `Клиент: ${m.user}\nАссистент: ${m.assistant}`).join('\n\n')}`;
    }

    return `${prompt}

СООБЩЕНИЕ КЛИЕНТА: "${message}"

КОНТЕКСТ:
${contextParts.join('\n')}${historySection}

ОТВЕТЬ СТРОГО в JSON формате:
${JSON.stringify(this._exampleJson, null, 2)}

ПРАВИЛА:
1. intent = "booking" для записи, "info" для вопросов
2. Если есть история диалога - учитывай контекст предыдущих сообщений
3. НЕ повторяй приветствие, если клиент уже поздоровался
4. Если клиент отвечает на твой вопрос - определи intent как продолжение диалога
5. Преобразуй относительные даты: "сегодня" → "${currentDate}", "завтра" → "${this._getTomorrowDate()}"
6. Нормализуй время: "утром" → "09:00", "днем" → "12:00", "вечером" → "18:00"
7. staff = null если мастер не указан явно
8. confidence = ${AI_PROMPT.CONFIDENCE_HIGH} если все ясно, ${AI_PROMPT.CONFIDENCE_MEDIUM_MIN}-${AI_PROMPT.CONFIDENCE_MEDIUM_MAX} при неточностях

АНАЛИЗИРУЙ:`;
  }

  /**
   * Get tomorrow's date in YYYY-MM-DD format
   * @private
   * @returns {string} Tomorrow's date in YYYY-MM-DD format
   */
  _getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  /**
   * Build a simplified prompt for quick intent detection
   * @param {string} message - User message to analyze
   * @returns {string} Simplified prompt for fast intent detection
   * @description Use for quick intent classification without entity extraction
   * @example
   * buildQuickIntentPrompt('Хочу отменить запись');
   * // AI should respond with: 'cancel'
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