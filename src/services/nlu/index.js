// src/services/nlu/index.js
const logger = require('../../utils/logger');
const EntityExtractor = require('./entity-extractor');
const ActionResolver = require('./action-resolver');
const ResponseGenerator = require('./response-generator');
const DataNormalizer = require('./data-normalizer');
const PromptBuilder = require('./prompt-builder');
const InputValidator = require('./input-validator');
const { CONFIDENCE, LOGGING } = require('./constants');

/**
 * Main NLU Service that coordinates all components
 */
class NLUService {
  constructor(aiService) {
    this.aiService = aiService;
    this.fallbackExtractor = new EntityExtractor();
    this.actionResolver = new ActionResolver();
    this.responseGenerator = new ResponseGenerator(this.actionResolver);
    this.dataNormalizer = new DataNormalizer();
    this.promptBuilder = new PromptBuilder();
    this.inputValidator = new InputValidator();
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
      logger.error('Invalid message input:', messageValidation.errors);
      return this._validationErrorResponse(messageValidation.errors);
    }
    
    const contextValidation = this.inputValidator.validateContext(context);
    if (!contextValidation.isValid) {
      logger.error('Invalid context input:', contextValidation.errors);
      return this._validationErrorResponse(contextValidation.errors);
    }
    
    // Use sanitized inputs
    const sanitizedMessage = messageValidation.sanitized;
    const sanitizedContext = contextValidation.sanitized;
    
    logger.info(`🧠 NLU Service processing: "${sanitizedMessage}"`);

    try {
      // Try AI-powered extraction first
      const aiResult = await this.extractWithAI(sanitizedMessage, sanitizedContext);
      
      if (aiResult.success && aiResult.confidence > CONFIDENCE.HIGH_THRESHOLD) {
        logger.info('✅ AI extraction successful', { confidence: aiResult.confidence });
        return aiResult;
      }

      logger.warn('🔄 AI extraction low confidence, using hybrid approach');
      
      // Combine AI results with pattern-based extraction
      const fallbackResult = this.fallbackExtractor.extract(sanitizedMessage);
      const hybridResult = this.combineResults(aiResult, fallbackResult, sanitizedContext);
      
      return hybridResult;

    } catch (error) {
      logger.error('❌ AI extraction failed, falling back to patterns:', error.message);
      
      // Pure fallback extraction
      const fallbackResult = this.fallbackExtractor.extract(sanitizedMessage);
      return this.formatResult(fallbackResult, 'pattern', sanitizedContext);
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
      return {
        success: false,
        error: error.message,
        confidence: 0
      };
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
      
      logger.info('✅ Parsed AI response:', {
        intent: parsed.intent,
        hasEntities: !!parsed.entities,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning
      });
      
      // Validate parsed result
      const parsedValidation = this.inputValidator.validateParsedResult(parsed);
      if (!parsedValidation.isValid) {
        logger.error('Invalid AI response structure:', parsedValidation.errors);
        throw new Error(`Invalid AI response: ${parsedValidation.errors.join(', ')}`);
      }

      return {
        intent: parsedValidation.sanitized.intent,
        entities: parsedValidation.sanitized.entities,
        confidence: parsedValidation.sanitized.confidence || CONFIDENCE.HIGH_THRESHOLD,
        reasoning: parsedValidation.sanitized.reasoning || 'AI processing'
      };

    } catch (error) {
      logger.error('Failed to parse AI response:', error.message);
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
   * Generate response for validation errors
   */
  _validationErrorResponse(errors) {
    logger.warn('Validation error response:', errors);
    
    return {
      success: false,
      intent: 'error',
      entities: {},
      action: 'none',
      response: 'Извините, не удалось обработать ваше сообщение. Пожалуйста, попробуйте еще раз.',
      confidence: 0,
      provider: 'validation',
      errors: errors
    };
  }
}

module.exports = NLUService;