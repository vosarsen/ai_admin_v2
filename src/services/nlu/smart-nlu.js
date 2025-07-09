// src/services/nlu/smart-nlu.js
const logger = require('../../utils/logger');
const EntityExtractor = require('./entity-extractor');

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
      
      if (aiResult.success && aiResult.confidence > 0.7) {
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
        response: response.substring(0, 500) + '...',
        fullLength: response.length
      });
      
      const parsed = this.parseAIResponse(response);
      const action = this.determineAction(parsed);
      // Добавляем action в parsed объект
      parsed.action = action;
      const generatedResponse = this.generateResponse(parsed, context);
      
      logger.info('🎯 NLU extraction complete:', {
        intent: parsed.intent,
        action: action,
        generatedResponse: generatedResponse,
        entities: parsed.entities
      });
      
      // CRITICAL: Ensure search_slots never has a response
      const finalResponse = action === 'search_slots' ? null : generatedResponse;
      
      return {
        success: true,
        intent: parsed.intent,
        entities: parsed.entities,
        action: action,
        response: finalResponse,
        confidence: parsed.confidence || 0.8,
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
- Доступные мастера: Бари, Сергей, Рамзан
- Услуги: стрижка, стрижка бороды, бритье, моделирование бороды

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
6. confidence = 0.9 если все понятно, 0.5-0.7 если есть неточности

АНАЛИЗИРУЙ:`;
  }

  /**
   * Parse AI response for entity extraction
   */
  parseAIResponse(response) {
    logger.info('🔍 Parsing Smart NLU AI response:', {
      response: response.substring(0, 200) + '...',
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
        confidence: parsed.confidence || 0.7,
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

    combined.action = this.determineAction(combined);
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
    
    const aiConf = typeof aiEntity === 'object' ? aiEntity.confidence : 0.8;
    const patternConf = typeof patternEntity === 'object' ? patternEntity.confidence : 0.6;
    
    return aiConf >= patternConf ? aiEntity : patternEntity;
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
    const { intent, entities } = parsed;
    
    // CRITICAL: Ensure action is always defined
    let action = parsed.action;
    if (!action) {
      logger.warn('⚠️ Action not provided to generateResponse, determining it now');
      action = this.determineAction(parsed);
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

  /**
   * Normalization methods
   */
  normalizeService(service) {
    if (!service) return null;
    
    const serviceMap = {
      'стрижка': 'стрижка',
      'постричься': 'стрижка',
      'подстричься': 'стрижка',
      'борода': 'стрижка бороды',
      'стрижка бороды': 'стрижка бороды',
      'бритье': 'бритье',
      'побриться': 'бритье'
    };
    
    const normalized = serviceMap[service.toLowerCase()];
    return normalized || service;
  }

  normalizeStaff(staff) {
    if (!staff) return null;
    
    const staffMap = {
      'бари': 'Бари',
      'сергей': 'Сергей', 
      'сергею': 'Сергей',
      'рамзан': 'Рамзан'
    };
    
    const normalized = staffMap[staff.toLowerCase()];
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
    const action = this.determineAction({
      intent: extractionResult.intent?.name || 'other',
      entities: {
        service: extractionResult.service?.name,
        staff: extractionResult.staff?.name,
        date: extractionResult.date?.date, 
        time: extractionResult.time?.time
      }
    });
    
    const response = this.generateResponse({
      intent: extractionResult.intent?.name || 'other',
      entities: {
        service: extractionResult.service?.name,
        staff: extractionResult.staff?.name,
        date: extractionResult.date?.date,
        time: extractionResult.time?.time
      },
      action: action  // Добавляем action в объект
    }, context);
    
    // CRITICAL: Ensure search_slots never has a response
    const finalResponse = action === 'search_slots' ? null : response;
    
    return {
      success: true,
      intent: extractionResult.intent?.name || 'other',
      entities: {
        service: extractionResult.service?.name || null,
        staff: extractionResult.staff?.name || null, 
        date: extractionResult.date?.date || null,
        time: extractionResult.time?.time || null
      },
      action: action,
      response: finalResponse,
      confidence: extractionResult.confidence || 0.5,
      provider: provider
    };
  }
}

module.exports = SmartNLU;