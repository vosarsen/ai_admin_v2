// src/services/nlu/index.js
const logger = require('../../utils/logger');
const EntityExtractor = require('./entity-extractor');
const ActionResolver = require('./action-resolver');
const ResponseGenerator = require('./response-generator');
const DataNormalizer = require('./data-normalizer');
const PromptBuilder = require('./prompt-builder');
const InputValidator = require('./input-validator');
const NLUCache = require('./cache');
const { CONFIDENCE, LOGGING } = require('./constants');
const { 
  AIServiceError, 
  AIResponseParseError, 
  ValidationError 
} = require('./errors');

/**
 * Main NLU Service that coordinates all components
 */
class NLUService {
  constructor(aiService, cacheOptions = {}) {
    this.aiService = aiService;
    this.fallbackExtractor = new EntityExtractor();
    this.actionResolver = new ActionResolver();
    this.responseGenerator = new ResponseGenerator(this.actionResolver);
    this.dataNormalizer = new DataNormalizer();
    this.promptBuilder = new PromptBuilder();
    this.inputValidator = new InputValidator();
    this.cache = new NLUCache(cacheOptions);
    
    // Clean expired cache entries every 5 minutes
    this.cacheCleanupInterval = setInterval(() => {
      this.cache.cleanExpired();
    }, 300000);
  }

  /**
   * Process message with AI-powered NLU + fallback extraction
   * @param {string} message - User message
   * @param {Object} context - User context
   * @returns {Object} NLU result with intent, entities, action, and response
   */
  async processMessage(message, context) {
    // Validate inputs
    const messageValidation = this.inputValidator.validateMessage(message);
    if (!messageValidation.isValid) {
      const error = new ValidationError(messageValidation.errors, 'message');
      logger.error('Message validation failed:', error.toJSON());
      return this._errorResponse(error);
    }
    
    const contextValidation = this.inputValidator.validateContext(context);
    if (!contextValidation.isValid) {
      const error = new ValidationError(contextValidation.errors, 'context');
      logger.error('Context validation failed:', error.toJSON());
      return this._errorResponse(error);
    }
    
    // Use sanitized inputs
    const sanitizedMessage = messageValidation.sanitized;
    const sanitizedContext = contextValidation.sanitized;
    
    logger.info(`🧠 NLU Service processing: "${sanitizedMessage}"`);
    
    // Check cache first
    const cacheKey = this.cache.generateKey(sanitizedMessage, sanitizedContext);
    const cachedResult = this.cache.get(cacheKey);
    
    if (cachedResult) {
      logger.info('✅ NLU cache hit');
      return cachedResult;
    }

    try {
      // Try AI-powered extraction first
      const aiResult = await this.extractWithAI(sanitizedMessage, sanitizedContext);
      
      if (aiResult.success && aiResult.confidence > CONFIDENCE.HIGH_THRESHOLD) {
        logger.info('✅ AI extraction successful', { confidence: aiResult.confidence });
        
        // Cache successful AI results
        this.cache.set(cacheKey, aiResult);
        
        return aiResult;
      }

      logger.warn('🔄 AI extraction low confidence, using hybrid approach');
      
      // Combine AI results with pattern-based extraction
      const fallbackResult = this.fallbackExtractor.extract(sanitizedMessage);
      const hybridResult = this.combineResults(aiResult, fallbackResult, sanitizedContext);
      
      // Cache hybrid results with shorter TTL
      this.cache.set(cacheKey, hybridResult, 1800000); // 30 minutes
      
      return hybridResult;

    } catch (error) {
      logger.error('❌ AI extraction failed:', error instanceof Error ? error.toJSON ? error.toJSON() : error.message : error);
      
      // Pure fallback extraction
      const fallbackResult = this.fallbackExtractor.extract(sanitizedMessage);
      const formattedResult = this.formatResult(fallbackResult, 'pattern', sanitizedContext);
      
      // Cache fallback results with even shorter TTL
      this.cache.set(cacheKey, formattedResult, 900000); // 15 minutes
      
      return formattedResult;
    }
  }

  /**
   * Extract entities using AI with structured prompt
   */
  async extractWithAI(message, context) {
    const prompt = this.promptBuilder.buildExtractionPrompt(message, context);
    
    try {
      const response = await this.aiService._callAI(prompt, 'primary');
      logger.info('🤖 Raw AI response for NLU:', {
        response: response.substring(0, LOGGING.RESPONSE_PREVIEW_LENGTH) + '...',
        fullLength: response.length
      });
      
      const parsed = this.parseAIResponse(response);
      
      // Normalize entities
      parsed.entities = this.dataNormalizer.normalizeEntities(parsed.entities);
      
      // Ensure action is present
      this.actionResolver.ensureAction(parsed);
      
      // Generate response
      const generatedResponse = this.responseGenerator.generateResponse(parsed, context);
      
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
        action: parsed.action,
        response: finalResponse,
        confidence: parsed.confidence || CONFIDENCE.DEFAULT_AI,
        provider: 'ai-nlu'
      };
    } catch (error) {
      throw new AIServiceError('AI extraction failed', error);
    }
  }

  /**
   * Parse AI response for entity extraction
   */
  parseAIResponse(response) {
    logger.info('🔍 Parsing AI response:', {
      response: response.substring(0, LOGGING.RESPONSE_SHORT_PREVIEW) + '...',
      fullLength: response.length
    });
    
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new AIResponseParseError(response, 'No JSON found in response');
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        throw new AIResponseParseError(response, parseError);
      }
      
      // CRITICAL: Log if AI returns unexpected 'response' field
      if (parsed.response !== undefined) {
        logger.warn('⚠️ AI returned unexpected "response" field in NLU extraction:', {
          response: parsed.response,
          intent: parsed.intent
        });
      }
      
      logger.info('✅ Parsed AI response:', {
        intent: parsed.intent,
        hasEntities: !!parsed.entities,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning
      });
      
      // Validate parsed result
      const parsedValidation = this.inputValidator.validateParsedResult(parsed);
      if (!parsedValidation.isValid) {
        throw new ValidationError(parsedValidation.errors, 'AI response');
      }

      return {
        intent: parsedValidation.sanitized.intent,
        entities: parsedValidation.sanitized.entities,
        confidence: parsedValidation.sanitized.confidence || CONFIDENCE.HIGH_THRESHOLD,
        reasoning: parsedValidation.sanitized.reasoning || 'AI processing'
      };

    } catch (error) {
      logger.error('Failed to parse AI response:', error instanceof Error ? error.toJSON ? error.toJSON() : error.message : error);
      if (!(error instanceof AIResponseParseError)) {
        logger.error('Raw response was:', response);
      }
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

    // Ensure action is present
    this.actionResolver.ensureAction(combined);
    combined.response = this.responseGenerator.generateResponse(combined, context);
    
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
   * Format extraction result from fallback
   */
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
    
    // Normalize entities
    parsed.entities = this.dataNormalizer.normalizeEntities(parsed.entities);
    
    // Ensure action is always present
    this.actionResolver.ensureAction(parsed);
    
    const response = this.responseGenerator.generateResponse(parsed, context);
    
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

  /**
   * Emergency fallback when everything fails
   */
  _emergencyFallback(message, context) {
    logger.warn('⚠️ Using emergency fallback - limited functionality');
    
    return {
      success: true,
      intent: 'other',
      entities: {},
      action: 'none', 
      response: 'Извините, возникли технические трудности. Пожалуйста, уточните ваш запрос или позвоните нам напрямую.',
      confidence: 0.1,
      provider: 'emergency'
    };
  }

  /**
   * Generate response for errors
   */
  _errorResponse(error) {
    logger.warn('Error response:', error.toJSON ? error.toJSON() : error);
    
    let userMessage = 'Извините, не удалось обработать ваше сообщение. Пожалуйста, попробуйте еще раз.';
    
    // Customize message based on error type
    if (error.code === 'VALIDATION_ERROR' && error.details.inputType === 'message') {
      userMessage = 'Извините, ваше сообщение имеет неверный формат. Пожалуйста, попробуйте еще раз.';
    } else if (error.code === 'AI_SERVICE_ERROR') {
      userMessage = 'Извините, временные технические проблемы. Пожалуйста, попробуйте через минуту.';
    }
    
    return {
      success: false,
      intent: 'error',
      entities: {},
      action: 'none',
      response: userMessage,
      confidence: 0,
      provider: 'error',
      error: {
        code: error.code,
        message: error.message
      }
    };
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return this.cache.getStats();
  }
  
  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    this.cache.clear();
  }
}

module.exports = NLUService;