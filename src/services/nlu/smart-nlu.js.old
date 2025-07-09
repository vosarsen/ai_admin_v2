// src/services/nlu/smart-nlu.js
const logger = require('../../utils/logger');
const EntityExtractor = require('./entity-extractor');
const { CONFIDENCE, LOGGING, AI_PROMPT, SERVICE_MAP, STAFF_MAP, AVAILABLE_SERVICES, AVAILABLE_STAFF } = require('./constants');

class SmartNLU {
  constructor(aiService) {
    this.aiService = aiService;
    this.fallbackExtractor = new EntityExtractor();
  }

  /**
   * Process message with AI-powered NLU + fallback extraction
   */
  async processMessage(message, context) {
    logger.info(`🧠 SmartNLU processing: "${message}"`);

    try {
      // Try AI-powered extraction first
      const aiResult = await this.extractWithAI(message, context);
      
      if (aiResult.success && aiResult.confidence > CONFIDENCE.HIGH_THRESHOLD) {
        logger.info('✅ AI extraction successful', { confidence: aiResult.confidence });
        return aiResult;
      }

      logger.warn('🔄 AI extraction low confidence, using hybrid approach');
      
      // Combine AI results with pattern-based extraction
      const fallbackResult = this.fallbackExtractor.extract(message);
      const hybridResult = this.combineResults(aiResult, fallbackResult, context);
      
      return hybridResult;

    } catch (error) {
      logger.error('❌ AI extraction failed, falling back to patterns:', error.message);
      
      // Pure fallback extraction
      const fallbackResult = this.fallbackExtractor.extract(message);
      return this.formatResult(fallbackResult, 'pattern', context);
    }
  }

  /**
   * Extract entities using AI with structured prompt
   */
  async extractWithAI(message, context) {
    const prompt = this.buildExtractionPrompt(message, context);
    
    try {
      const response = await this.aiService._callAI(prompt, 'primary');
      logger.info('🤖 Raw AI response for NLU:', {
        response: response.substring(0, LOGGING.RESPONSE_PREVIEW_LENGTH) + '...',
        fullLength: response.length
      });
      
      const parsed = this.parseAIResponse(response);
      // Ensure action is always present
      this.ensureAction(parsed);
      const generatedResponse = this.generateResponse(parsed, context);
      
      logger.info('🎯 NLU extraction complete:', {
        intent: parsed.intent,
        action: parsed.action,
        generatedResponse: generatedResponse,
        entities: parsed.entities
      });
      
      // CRITICAL: Ensure search_slots never has a response
      const finalResponse = parsed.action === 'search_slots' ? null : generatedResponse;
      
      return {
        success: true,
        intent: parsed.intent,
        entities: parsed.entities,
        action: action,
        response: finalResponse,
        confidence: parsed.confidence || CONFIDENCE.DEFAULT_AI,
        provider: 'ai-nlu'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        confidence: 0
      };
    }
  }

  /**
   * Build specialized prompt for entity extraction
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

  /**
   * Parse AI response for entity extraction
   */
  parseAIResponse(response) {
    logger.info('🔍 Parsing Smart NLU AI response:', {
      response: response.substring(0, LOGGING.RESPONSE_SHORT_PREVIEW) + '...',
      fullLength: response.length
    });
    
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // CRITICAL: Log if AI returns unexpected 'response' field
      if (parsed.response !== undefined) {
        logger.warn('⚠️ AI returned unexpected "response" field in NLU extraction:', {
          response: parsed.response,
          intent: parsed.intent
        });
      }
      
      logger.info('✅ Parsed Smart NLU response:', {
        intent: parsed.intent,
        hasEntities: !!parsed.entities,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        hasResponseField: parsed.response !== undefined
      });
      
      // Validate structure
      if (!parsed.intent || !parsed.entities) {
        throw new Error('Invalid response structure');
      }

      // Normalize entities
      const entities = {
        service: this.normalizeService(parsed.entities.service),
        staff: this.normalizeStaff(parsed.entities.staff),
        date: this.normalizeDate(parsed.entities.date),
        time: this.normalizeTime(parsed.entities.time),
        info_type: parsed.entities.info_type || null,
        time_preference: parsed.entities.time_preference || null
      };

      return {
        intent: parsed.intent,
        entities: entities,
        confidence: parsed.confidence || CONFIDENCE.HIGH_THRESHOLD,
        reasoning: parsed.reasoning || 'AI processing'
      };

    } catch (error) {
      logger.error('Failed to parse AI extraction response:', error.message);
      logger.error('Raw response was:', response);
      throw error;
    }
  }

  /**
   * Combine AI and pattern-based results
   */
  combineResults(aiResult, patternResult, context) {
    const combined = {
      intent: aiResult.entities?.intent?.name || patternResult.intent.name,
      entities: {},
      confidence: Math.max(aiResult.confidence || 0, patternResult.confidence || 0),
      provider: 'hybrid'
    };

    // Use best confidence for each entity
    combined.entities.service = this.selectBestEntity(
      aiResult.entities?.service, 
      patternResult.service
    );
    
    combined.entities.staff = this.selectBestEntity(
      aiResult.entities?.staff,
      patternResult.staff
    );
    
    combined.entities.date = this.selectBestEntity(
      aiResult.entities?.date,
      patternResult.date?.date
    );
    
    combined.entities.time = this.selectBestEntity(
      aiResult.entities?.time,
      patternResult.time?.time  
    );

    // Ensure action is always present
    this.ensureAction(combined);
    combined.response = this.generateResponse(combined, context);
    
    // CRITICAL: Ensure search_slots never has a response
    if (combined.action === 'search_slots') {
      combined.response = null;
    }

    return {
      success: true,
      ...combined
    };
  }

  /**
   * Select entity with highest confidence
   */
  selectBestEntity(aiEntity, patternEntity) {
    if (!aiEntity && !patternEntity) return null;
    if (!aiEntity) return patternEntity;
    if (!patternEntity) return aiEntity;
    
    const aiConf = typeof aiEntity === 'object' ? aiEntity.confidence : CONFIDENCE.DEFAULT_AI;
    const patternConf = typeof patternEntity === 'object' ? patternEntity.confidence : CONFIDENCE.DEFAULT_PATTERN;
    
    return aiConf >= patternConf ? aiEntity : patternEntity;
  }

  /**
   * Ensure parsed result always has action field
   * @param {Object} parsed - Parsed result with intent and entities
   * @returns {Object} Parsed result with action field guaranteed
   */
  ensureAction(parsed) {
    if (!parsed.action) {
      parsed.action = this.determineAction(parsed);
    }
    return parsed;
  }

  /**
   * Determine action based on intent and entities
   */
  determineAction(parsed) {
    const { intent, entities } = parsed;
    
    if (intent === 'booking') {
      // If we have specific date, time and staff - create booking
      if (entities.date && entities.time && entities.staff) {
        return 'create_booking';
      }
      // Otherwise search for available slots
      return 'search_slots';
    }
    
    if (intent === 'reschedule') return 'reschedule_booking';
    if (intent === 'cancel') return 'cancel_booking';  
    if (intent === 'info') return 'get_info';
    
    return 'none';
  }

  /**
   * Generate appropriate response - НЕ генерируем промежуточные сообщения
   */
  generateResponse(parsed, context) {
    // Ensure action is always present
    this.ensureAction(parsed);
    
    const { intent, entities, action } = parsed;
    
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

  /**
   * Normalization methods
   */
  normalizeService(service) {
    if (!service) return null;
    
    const normalized = SERVICE_MAP[service.toLowerCase()];
    return normalized || service;
  }

  normalizeStaff(staff) {
    if (!staff) return null;
    
    const normalized = STAFF_MAP[staff.toLowerCase()];
    return normalized || staff;
  }

  normalizeDate(date) {
    if (!date) return null;
    
    // If already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    const today = new Date();
    
    if (date === 'сегодня') {
      return today.toISOString().split('T')[0];
    }
    
    if (date === 'завтра') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    
    return date;
  }

  normalizeTime(time) {
    if (!time) return null;
    
    // If already in HH:MM format
    if (/^\d{1,2}:\d{2}$/.test(time)) {
      const [hours, minutes] = time.split(':');
      return `${hours.padStart(2, '0')}:${minutes}`;
    }
    
    return time;
  }

  formatDateForUser(date) {
    if (!date) return '';
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    if (date === today) return 'сегодня';
    if (date === tomorrowStr) return 'завтра';
    
    return date;
  }

  formatResult(extractionResult, provider, context) {
    const parsed = {
      intent: extractionResult.intent?.name || 'other',
      entities: {
        service: extractionResult.service?.name,
        staff: extractionResult.staff?.name,
        date: extractionResult.date?.date,
        time: extractionResult.time?.time
      }
    };
    
    // Ensure action is always present
    this.ensureAction(parsed);
    
    const response = this.generateResponse(parsed, context);
    
    // CRITICAL: Ensure search_slots never has a response
    const finalResponse = parsed.action === 'search_slots' ? null : response;
    
    return {
      success: true,
      intent: parsed.intent,
      entities: parsed.entities,
      action: parsed.action,
      response: finalResponse,
      confidence: extractionResult.confidence || CONFIDENCE.DEFAULT_FALLBACK,
      provider: provider
    };
  }
}

module.exports = SmartNLU;