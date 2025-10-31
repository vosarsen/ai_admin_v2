/**
 * Валидация данных контекста
 * Предотвращает runtime ошибки при парсинге и обработке
 */

const Joi = require('joi');
const logger = require('./logger').child({ module: 'context-validator' });

// Схемы валидации
const schemas = {
  // Телефон
  phone: Joi.string()
    .pattern(/^\+?[0-9]{10,15}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be 10-15 digits, optionally starting with +',
      'any.required': 'Phone is required'
    }),
  
  // ID компании
  companyId: Joi.number()
    .positive()
    .required()
    .messages({
      'number.positive': 'CompanyId must be a positive number',
      'any.required': 'CompanyId is required'
    }),
  
  // Выбор в диалоге
  selection: Joi.object({
    service: Joi.string().allow('', null).optional(),
    staff: Joi.string().allow('', null).optional(),
    date: Joi.string().allow('', null).optional(),
    time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow('', null).optional()
  }).optional(),
  
  // Ожидающее действие
  pendingAction: Joi.object({
    type: Joi.string().valid('cancellation', 'confirmation', 'reschedule').required(),
    data: Joi.object().optional(),
    timestamp: Joi.date().iso().optional()
  }).allow(null).optional(),
  
  // Полный контекст
  fullContext: Joi.object({
    phone: Joi.string().required(),
    companyId: Joi.number().required(),
    client: Joi.object().allow(null).optional(),
    messages: Joi.array().items(Joi.object()).optional(),
    currentSelection: Joi.object().optional(),
    dialogState: Joi.string().optional(),
    data: Joi.string().optional() // JSON строка для обратной совместимости
  }),
  
  // Обновления контекста
  contextUpdates: Joi.object({
    selection: Joi.object().optional(),
    clientName: Joi.string().allow('', null).optional(),
    pendingAction: Joi.object().allow(null).optional(),
    state: Joi.string().valid('active', 'completed', 'cancelled').optional(),
    userMessage: Joi.string().optional(),
    botResponse: Joi.string().optional()
  })
};

/**
 * Класс для валидации контекста
 */
class ContextValidator {
  /**
   * Валидировать телефон
   */
  validatePhone(phone) {
    const { error, value } = schemas.phone.validate(phone);
    if (error) {
      throw new ValidationError('Invalid phone number', 'INVALID_PHONE', {
        phone,
        details: error.details
      });
    }
    return value;
  }
  
  /**
   * Валидировать ID компании
   */
  validateCompanyId(companyId) {
    const { error, value } = schemas.companyId.validate(companyId);
    if (error) {
      throw new ValidationError('Invalid company ID', 'INVALID_COMPANY_ID', {
        companyId,
        details: error.details
      });
    }
    return value;
  }
  
  /**
   * Валидировать параметры getContext
   */
  validateGetContext(phone, companyId) {
    const errors = [];
    
    try {
      this.validatePhone(phone);
    } catch (e) {
      errors.push(e);
    }
    
    try {
      this.validateCompanyId(companyId);
    } catch (e) {
      errors.push(e);
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Invalid parameters for getContext', 'INVALID_PARAMS', {
        phone,
        companyId,
        errors
      });
    }
    
    return { phone, companyId };
  }
  
  /**
   * Валидировать обновления контекста
   */
  validateContextUpdates(updates) {
    const { error, value } = schemas.contextUpdates.validate(updates);
    if (error) {
      logger.warn('Invalid context updates:', {
        updates,
        error: error.details
      });
      
      // Возвращаем очищенную версию вместо ошибки
      return this._sanitizeUpdates(updates);
    }
    return value;
  }
  
  /**
   * Валидировать selection
   */
  validateSelection(selection) {
    const { error, value } = schemas.selection.validate(selection);
    if (error) {
      logger.warn('Invalid selection:', {
        selection,
        error: error.details
      });
      return {}; // Возвращаем пустой объект вместо ошибки
    }
    return value;
  }
  
  /**
   * Безопасный парсинг JSON
   */
  safeJsonParse(jsonString, defaultValue = {}) {
    if (!jsonString) return defaultValue;
    if (typeof jsonString !== 'string') return jsonString;
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.warn('Failed to parse JSON:', {
        jsonString: jsonString.substring(0, 100), // Не логируем весь JSON
        error: error.message
      });
      return defaultValue;
    }
  }
  
  /**
   * Безопасная сериализация в JSON
   */
  safeJsonStringify(obj, defaultValue = '{}') {
    if (!obj) return defaultValue;
    if (typeof obj === 'string') return obj;
    
    try {
      return JSON.stringify(obj);
    } catch (error) {
      logger.warn('Failed to stringify JSON:', {
        error: error.message
      });
      return defaultValue;
    }
  }
  
  /**
   * Очистить обновления от невалидных данных
   */
  _sanitizeUpdates(updates) {
    const sanitized = {};
    
    // Безопасно копируем только валидные поля
    const allowedFields = ['selection', 'clientName', 'pendingAction', 'state', 'userMessage', 'botResponse'];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'selection' && typeof updates[field] === 'object') {
          sanitized[field] = this.validateSelection(updates[field]);
        } else if (field === 'state' && ['active', 'completed', 'cancelled'].includes(updates[field])) {
          sanitized[field] = updates[field];
        } else if (typeof updates[field] === 'string') {
          sanitized[field] = updates[field];
        } else if (field === 'pendingAction' && (updates[field] === null || typeof updates[field] === 'object')) {
          sanitized[field] = updates[field];
        }
      }
    }
    
    return sanitized;
  }
  
  /**
   * Проверить структуру контекста из Redis
   */
  validateRedisContext(contextData) {
    if (!contextData) return null;
    
    // Базовая проверка типов
    const validated = {
      phone: typeof contextData.phone === 'string' ? contextData.phone : null,
      companyId: contextData.companyId,
      client: contextData.client || null,
      messages: Array.isArray(contextData.messages) ? contextData.messages : [],
      currentSelection: contextData.currentSelection || {},
      data: contextData.data || null
    };
    
    // Если есть data - пытаемся распарсить
    if (validated.data) {
      validated.parsedData = this.safeJsonParse(validated.data, {});
    }
    
    return validated;
  }
}

/**
 * Класс ошибки валидации
 */
class ValidationError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
  }
}

// Экспортируем singleton
module.exports = new ContextValidator();
module.exports.ValidationError = ValidationError;