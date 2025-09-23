// src/utils/critical-error-logger.js
const logger = require('./logger');
const config = require('../config');
const { format } = require('date-fns');
const os = require('os');
const { supabase } = require('../database/supabase');

/**
 * Система подробного логирования критичных ошибок
 * Сохраняет детальную информацию о критичных сбоях для анализа
 */
class CriticalErrorLogger {
  constructor() {
    // Типы критичных ошибок
    this.criticalErrorTypes = {
      // Системные ошибки
      SYSTEM_CRASH: 'system_crash',
      DATABASE_CONNECTION_LOST: 'database_connection_lost',
      REDIS_CONNECTION_LOST: 'redis_connection_lost',
      MEMORY_LIMIT_EXCEEDED: 'memory_limit_exceeded',
      
      // Ошибки интеграций
      YCLIENTS_API_DOWN: 'yclients_api_down',
      WHATSAPP_CONNECTION_LOST: 'whatsapp_connection_lost',
      AI_SERVICE_FAILURE: 'ai_service_failure',
      
      // Бизнес-критичные ошибки
      BOOKING_CREATION_FAILED: 'booking_creation_failed',
      PAYMENT_PROCESSING_FAILED: 'payment_processing_failed',
      CLIENT_DATA_CORRUPTION: 'client_data_corruption',
      
      // Безопасность
      SECURITY_BREACH_ATTEMPT: 'security_breach_attempt',
      INVALID_HMAC_SIGNATURE: 'invalid_hmac_signature',
      RATE_LIMIT_ABUSE: 'rate_limit_abuse'
    };
    
    // Счетчики ошибок для определения паттернов
    this.errorCounters = new Map();
    this.errorPatternThreshold = 5; // Порог для определения паттерна
    this.errorTimeWindow = 300000; // 5 минут
  }
  
  /**
   * Логировать критичную ошибку с полным контекстом
   */
  async logCriticalError(error, context = {}) {
    try {
      const errorId = this.generateErrorId();
      const timestamp = new Date();
      
      // Собираем полную информацию об ошибке
      const errorData = {
        id: errorId,
        timestamp: timestamp.toISOString(),
        type: this.determineErrorType(error, context),
        severity: this.calculateSeverity(error, context),
        
        // Основная информация об ошибке
        error: {
          message: error.message,
          code: error.code,
          name: error.name,
          stack: error.stack,
          ...this.extractErrorDetails(error)
        },
        
        // Контекст
        context: {
          ...context,
          operation: context.operation,
          userId: context.userId || context.phone,
          companyId: context.companyId,
          requestId: context.requestId,
          jobId: context.jobId
        },
        
        // Системная информация
        system: {
          nodeVersion: process.version,
          platform: os.platform(),
          memory: {
            used: process.memoryUsage(),
            total: os.totalmem(),
            free: os.freemem()
          },
          uptime: process.uptime(),
          pid: process.pid
        },
        
        // Дополнительная диагностика
        diagnostics: await this.collectDiagnostics(error, context),
        
        // Анализ паттернов
        pattern: this.analyzeErrorPattern(error, context)
      };
      
      // Логируем в разные места в зависимости от серьезности
      await this.logToMultipleTargets(errorData);
      
      // Проверяем необходимость уведомлений
      if (errorData.severity === 'critical') {
        await this.sendCriticalAlert(errorData);
      }
      
      // Обновляем счетчики для анализа паттернов
      this.updateErrorCounters(errorData);
      
      return errorId;
    } catch (logError) {
      // Если не удалось залогировать критичную ошибку, используем fallback
      console.error('CRITICAL: Failed to log critical error:', logError);
      console.error('Original error:', error);
    }
  }
  
  /**
   * Определить тип ошибки
   */
  determineErrorType(error, context) {
    // Проверяем по коду ошибки
    if (error.code === 'ECONNREFUSED' && context.service === 'redis') {
      return this.criticalErrorTypes.REDIS_CONNECTION_LOST;
    }
    
    if (error.code === 'ECONNREFUSED' && context.service === 'database') {
      return this.criticalErrorTypes.DATABASE_CONNECTION_LOST;
    }
    
    // Проверяем по сообщению
    if (error.message?.includes('YClients API')) {
      return this.criticalErrorTypes.YCLIENTS_API_DOWN;
    }
    
    if (error.message?.includes('WhatsApp')) {
      return this.criticalErrorTypes.WHATSAPP_CONNECTION_LOST;
    }
    
    if (error.message?.includes('AI service') || error.message?.includes('DeepSeek')) {
      return this.criticalErrorTypes.AI_SERVICE_FAILURE;
    }
    
    // Проверяем по контексту
    if (context.operation === 'createBooking' && !error.response?.success) {
      return this.criticalErrorTypes.BOOKING_CREATION_FAILED;
    }
    
    if (context.security || error.message?.includes('HMAC')) {
      return this.criticalErrorTypes.INVALID_HMAC_SIGNATURE;
    }
    
    return 'unknown_critical_error';
  }
  
  /**
   * Рассчитать серьезность ошибки
   */
  calculateSeverity(error, context) {
    // Критичные - требуют немедленного вмешательства
    const criticalErrors = [
      this.criticalErrorTypes.DATABASE_CONNECTION_LOST,
      this.criticalErrorTypes.SECURITY_BREACH_ATTEMPT,
      this.criticalErrorTypes.PAYMENT_PROCESSING_FAILED,
      this.criticalErrorTypes.CLIENT_DATA_CORRUPTION
    ];
    
    if (criticalErrors.includes(this.determineErrorType(error, context))) {
      return 'critical';
    }
    
    // Высокие - влияют на функциональность
    const highErrors = [
      this.criticalErrorTypes.YCLIENTS_API_DOWN,
      this.criticalErrorTypes.WHATSAPP_CONNECTION_LOST,
      this.criticalErrorTypes.BOOKING_CREATION_FAILED
    ];
    
    if (highErrors.includes(this.determineErrorType(error, context))) {
      return 'high';
    }
    
    // Средние - могут подождать
    return 'medium';
  }
  
  /**
   * Извлечь дополнительные детали ошибки
   */
  extractErrorDetails(error) {
    const details = {};
    
    // HTTP ошибки
    if (error.response) {
      details.http = {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data
      };
    }
    
    // Axios ошибки
    if (error.config) {
      details.request = {
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers,
        timeout: error.config.timeout
      };
    }
    
    // Database ошибки
    if (error.detail) {
      details.database = {
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        code: error.code
      };
    }
    
    return details;
  }
  
  /**
   * Собрать диагностическую информацию
   */
  async collectDiagnostics(error, context) {
    const diagnostics = {};
    
    try {
      // Проверяем доступность сервисов
      diagnostics.services = {
        redis: await this.checkRedisConnection(),
        database: await this.checkDatabaseConnection(),
        whatsapp: await this.checkWhatsAppConnection()
      };
      
      // Последние операции
      if (context.userId) {
        diagnostics.userActivity = await this.getRecentUserActivity(context.userId);
      }
      
      // Состояние очередей
      diagnostics.queues = await this.getQueueStats();
      
      // Недавние ошибки
      diagnostics.recentErrors = this.getRecentErrors();
      
    } catch (diagError) {
      diagnostics.error = 'Failed to collect diagnostics: ' + diagError.message;
    }
    
    return diagnostics;
  }
  
  /**
   * Анализировать паттерны ошибок
   */
  analyzeErrorPattern(error, context) {
    const errorType = this.determineErrorType(error, context);
    const pattern = {
      type: errorType,
      isRecurring: false,
      frequency: 0,
      firstOccurrence: null,
      relatedErrors: []
    };
    
    // Проверяем счетчики
    const counter = this.errorCounters.get(errorType);
    if (counter) {
      pattern.isRecurring = counter.count > 1;
      pattern.frequency = counter.count;
      pattern.firstOccurrence = counter.firstSeen;
      
      // Если ошибка повторяется часто, это паттерн
      if (counter.count >= this.errorPatternThreshold) {
        pattern.isPattern = true;
        pattern.patternType = this.determinePatternType(counter);
      }
    }
    
    return pattern;
  }
  
  /**
   * Логировать в несколько мест
   */
  async logToMultipleTargets(errorData) {
    // 1. Winston logger
    logger.error('CRITICAL ERROR', errorData);
    
    // 2. Файловая система для критичных ошибок
    if (errorData.severity === 'critical') {
      await this.logToFile(errorData);
    }
    
    // 3. База данных для анализа
    try {
      await this.logToDatabase(errorData);
    } catch (dbError) {
      logger.error('Failed to log to database:', dbError);
    }
    
    // 4. Консоль для немедленного внимания
    if (errorData.severity === 'critical') {
      this.logToConsole(errorData);
    }
  }
  
  /**
   * Логировать в файл
   */
  async logToFile(errorData) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const logDir = path.join(__dirname, '../../logs/critical');
    const filename = `critical-${format(new Date(), 'yyyy-MM-dd')}.log`;
    const filepath = path.join(logDir, filename);
    
    try {
      await fs.mkdir(logDir, { recursive: true });
      const logEntry = JSON.stringify(errorData, null, 2) + '\n\n';
      await fs.appendFile(filepath, logEntry);
    } catch (fileError) {
      logger.error('Failed to write to log file:', fileError);
    }
  }
  
  /**
   * Логировать в базу данных
   */
  async logToDatabase(errorData) {
    try {
      const { error } = await supabase
        .from('critical_errors')
        .insert({
          error_id: errorData.id,
          timestamp: errorData.timestamp,
          type: errorData.type,
          severity: errorData.severity,
          error_data: errorData,
          company_id: errorData.context.companyId,
          user_id: errorData.context.userId
        });
        
      if (error) throw error;
    } catch (dbError) {
      // Используем fallback если БД недоступна
      logger.error('Database logging failed:', dbError);
    }
  }
  
  /**
   * Вывести в консоль с форматированием
   */
  logToConsole(errorData) {
    console.error('\n' + '='.repeat(80));
    console.error('🚨 CRITICAL ERROR DETECTED 🚨');
    console.error('='.repeat(80));
    console.error(`ID: ${errorData.id}`);
    console.error(`Type: ${errorData.type}`);
    console.error(`Time: ${errorData.timestamp}`);
    console.error(`Message: ${errorData.error.message}`);
    console.error('Stack:', errorData.error.stack);
    console.error('Context:', JSON.stringify(errorData.context, null, 2));
    console.error('='.repeat(80) + '\n');
  }
  
  /**
   * Отправить критичное уведомление
   */
  async sendCriticalAlert(errorData) {
    // TODO: Интегрировать с системой уведомлений
    // Например: email, SMS, Telegram, Slack
    logger.warn('Critical alert should be sent:', {
      errorId: errorData.id,
      type: errorData.type,
      severity: errorData.severity
    });
  }
  
  /**
   * Обновить счетчики ошибок
   */
  updateErrorCounters(errorData) {
    const type = errorData.type;
    const now = Date.now();
    
    let counter = this.errorCounters.get(type);
    if (!counter) {
      counter = {
        count: 0,
        firstSeen: now,
        lastSeen: now,
        occurrences: []
      };
      this.errorCounters.set(type, counter);
    }
    
    counter.count++;
    counter.lastSeen = now;
    counter.occurrences.push({
      time: now,
      errorId: errorData.id
    });
    
    // Очищаем старые записи
    counter.occurrences = counter.occurrences.filter(
      occ => now - occ.time < this.errorTimeWindow
    );
  }
  
  /**
   * Вспомогательные методы для проверки сервисов
   */
  async checkRedisConnection() {
    try {
      const Redis = require('ioredis');
      const { getRedisConfig } = require('../config/redis-config');
      const redisConfig = getRedisConfig();
      const redis = new Redis(redisConfig);
      await redis.ping();
      await redis.quit();
      return 'connected';
    } catch (e) {
      return 'disconnected';
    }
  }
  
  async checkDatabaseConnection() {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id')
        .limit(1);
      return error ? 'error' : 'connected';
    } catch (e) {
      return 'disconnected';
    }
  }
  
  async checkWhatsAppConnection() {
    try {
      const whatsappClient = require('../integrations/whatsapp/client');
      return whatsappClient.isConnected() ? 'connected' : 'disconnected';
    } catch (e) {
      return 'unknown';
    }
  }
  
  async getRecentUserActivity(userId) {
    // TODO: Получить последние действия пользователя
    return {
      lastMessage: null,
      lastBooking: null,
      messageCount: 0
    };
  }
  
  async getQueueStats() {
    // TODO: Получить статистику очередей
    return {
      messageQueue: { size: 0, processing: 0 }
    };
  }
  
  getRecentErrors() {
    const recent = [];
    const now = Date.now();
    
    for (const [type, counter] of this.errorCounters.entries()) {
      if (now - counter.lastSeen < this.errorTimeWindow) {
        recent.push({
          type,
          count: counter.occurrences.length,
          lastSeen: new Date(counter.lastSeen).toISOString()
        });
      }
    }
    
    return recent;
  }
  
  determinePatternType(counter) {
    const occurrences = counter.occurrences;
    if (occurrences.length < 2) return 'single';
    
    // Анализируем временные интервалы
    const intervals = [];
    for (let i = 1; i < occurrences.length; i++) {
      intervals.push(occurrences[i].time - occurrences[i-1].time);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    if (avgInterval < 1000) return 'burst'; // Взрывной паттерн
    if (avgInterval < 60000) return 'frequent'; // Частый паттерн
    return 'periodic'; // Периодический паттерн
  }
  
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Создаем singleton
module.exports = new CriticalErrorLogger();