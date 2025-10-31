const prometheus = require('prom-client');
const logger = require('../../../utils/logger').child({ module: 'prometheus-metrics' });

/**
 * @typedef {Object} MetricLabels
 * @property {string} [method] - HTTP method
 * @property {string} [status] - Response status
 * @property {string} [service] - Service name
 * @property {string} [operation] - Operation name
 * @property {string} [command] - Command name
 * @property {string} [provider] - Provider name
 * @property {string} [error_type] - Error type
 */

/**
 * Prometheus метрики для AI Admin v2
 */
class PrometheusMetrics {
  constructor() {
    // Регистр для метрик
    this.register = new prometheus.Registry();
    
    // Добавляем стандартные метрики (CPU, память и т.д.)
    prometheus.collectDefaultMetrics({ 
      register: this.register,
      prefix: 'ai_admin_' 
    });

    // Инициализируем кастомные метрики
    this.initializeMetrics();
    
    logger.info('Prometheus metrics initialized');
  }

  /**
   * Инициализация всех метрик
   * @private
   */
  initializeMetrics() {
    // HTTP метрики
    this.httpRequestDuration = new prometheus.Histogram({
      name: 'ai_admin_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register]
    });

    this.httpRequestsTotal = new prometheus.Counter({
      name: 'ai_admin_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.register]
    });

    // AI провайдер метрики
    this.aiProviderDuration = new prometheus.Histogram({
      name: 'ai_admin_ai_provider_duration_seconds',
      help: 'Duration of AI provider calls in seconds',
      labelNames: ['provider', 'model'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register]
    });

    this.aiProviderErrors = new prometheus.Counter({
      name: 'ai_admin_ai_provider_errors_total',
      help: 'Total number of AI provider errors',
      labelNames: ['provider', 'error_type'],
      registers: [this.register]
    });

    // Команды метрики
    this.commandExecutions = new prometheus.Counter({
      name: 'ai_admin_command_executions_total',
      help: 'Total number of command executions',
      labelNames: ['command', 'status'],
      registers: [this.register]
    });

    this.commandDuration = new prometheus.Histogram({
      name: 'ai_admin_command_duration_seconds',
      help: 'Duration of command execution in seconds',
      labelNames: ['command'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register]
    });

    // Booking метрики
    this.bookingsCreated = new prometheus.Counter({
      name: 'ai_admin_bookings_created_total',
      help: 'Total number of bookings created',
      labelNames: ['service_type', 'status'],
      registers: [this.register]
    });

    this.bookingsCancelled = new prometheus.Counter({
      name: 'ai_admin_bookings_cancelled_total',
      help: 'Total number of bookings cancelled',
      labelNames: ['reason'],
      registers: [this.register]
    });

    // Кэш метрики
    this.cacheHits = new prometheus.Counter({
      name: 'ai_admin_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
      registers: [this.register]
    });

    this.cacheMisses = new prometheus.Counter({
      name: 'ai_admin_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
      registers: [this.register]
    });

    this.cacheHitRate = new prometheus.Gauge({
      name: 'ai_admin_cache_hit_rate',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
      registers: [this.register]
    });

    // Circuit Breaker метрики
    this.circuitBreakerState = new prometheus.Gauge({
      name: 'ai_admin_circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 0.5=half-open)',
      labelNames: ['service'],
      registers: [this.register]
    });

    this.circuitBreakerFailures = new prometheus.Counter({
      name: 'ai_admin_circuit_breaker_failures_total',
      help: 'Total circuit breaker failures',
      labelNames: ['service'],
      registers: [this.register]
    });

    // Rate Limiter метрики
    this.rateLimiterBlocked = new prometheus.Counter({
      name: 'ai_admin_rate_limiter_blocked_total',
      help: 'Total requests blocked by rate limiter',
      labelNames: ['identifier_type'],
      registers: [this.register]
    });

    this.rateLimiterAllowed = new prometheus.Counter({
      name: 'ai_admin_rate_limiter_allowed_total',
      help: 'Total requests allowed by rate limiter',
      labelNames: ['identifier_type'],
      registers: [this.register]
    });

    // База данных метрики
    this.databaseQueryDuration = new prometheus.Histogram({
      name: 'ai_admin_database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.register]
    });

    this.databaseErrors = new prometheus.Counter({
      name: 'ai_admin_database_errors_total',
      help: 'Total number of database errors',
      labelNames: ['operation', 'error_type'],
      registers: [this.register]
    });

    // Бизнес метрики
    this.activeConversations = new prometheus.Gauge({
      name: 'ai_admin_active_conversations',
      help: 'Number of active conversations',
      registers: [this.register]
    });

    this.messageProcessingDuration = new prometheus.Histogram({
      name: 'ai_admin_message_processing_duration_seconds',
      help: 'Duration of message processing in seconds',
      labelNames: ['message_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register]
    });

    this.messagesProcessed = new prometheus.Counter({
      name: 'ai_admin_messages_processed_total',
      help: 'Total number of messages processed',
      labelNames: ['status', 'company_type'],
      registers: [this.register]
    });
  }

  /**
   * Запись HTTP метрики
   * @param {string} method - HTTP method
   * @param {string} route - Route path
   * @param {number} status - HTTP status code
   * @param {number} duration - Duration in seconds
   */
  recordHttpRequest(method, route, status, duration) {
    const labels = { method, route, status: status.toString() };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, duration);
  }

  /**
   * Запись вызова AI провайдера
   * @param {string} provider - Provider name
   * @param {string} model - Model name
   * @param {number} duration - Duration in seconds
   * @param {boolean} success - Whether call succeeded
   * @param {string} [errorType] - Error type if failed
   */
  recordAIProviderCall(provider, model, duration, success, errorType) {
    this.aiProviderDuration.observe({ provider, model }, duration);
    
    if (!success && errorType) {
      this.aiProviderErrors.inc({ provider, error_type: errorType });
    }
  }

  /**
   * Запись выполнения команды
   * @param {string} command - Command name
   * @param {number} duration - Duration in seconds
   * @param {boolean} success - Whether execution succeeded
   */
  recordCommandExecution(command, duration, success) {
    const status = success ? 'success' : 'failure';
    this.commandExecutions.inc({ command, status });
    this.commandDuration.observe({ command }, duration);
  }

  /**
   * Запись создания записи
   * @param {string} serviceType - Service type
   * @param {boolean} success - Whether booking was created
   */
  recordBookingCreated(serviceType, success) {
    const status = success ? 'success' : 'failure';
    this.bookingsCreated.inc({ service_type: serviceType, status });
  }

  /**
   * Запись отмены записи
   * @param {string} reason - Cancellation reason
   */
  recordBookingCancelled(reason) {
    this.bookingsCancelled.inc({ reason });
  }

  /**
   * Запись работы кэша
   * @param {string} cacheType - Cache type
   * @param {boolean} hit - Whether it was a hit
   */
  recordCacheOperation(cacheType, hit) {
    if (hit) {
      this.cacheHits.inc({ cache_type: cacheType });
    } else {
      this.cacheMisses.inc({ cache_type: cacheType });
    }
  }

  /**
   * Обновление hit rate кэша
   * @param {string} cacheType - Cache type
   * @param {number} hitRate - Hit rate percentage
   */
  updateCacheHitRate(cacheType, hitRate) {
    this.cacheHitRate.set({ cache_type: cacheType }, hitRate);
  }

  /**
   * Обновление состояния Circuit Breaker
   * @param {string} service - Service name
   * @param {'CLOSED' | 'OPEN' | 'HALF_OPEN'} state - Circuit breaker state
   */
  updateCircuitBreakerState(service, state) {
    const stateValue = state === 'CLOSED' ? 0 : state === 'OPEN' ? 1 : 0.5;
    this.circuitBreakerState.set({ service }, stateValue);
  }

  /**
   * Запись ошибки Circuit Breaker
   * @param {string} service - Service name
   */
  recordCircuitBreakerFailure(service) {
    this.circuitBreakerFailures.inc({ service });
  }

  /**
   * Запись работы Rate Limiter
   * @param {string} identifierType - Identifier type (phone/ip)
   * @param {boolean} allowed - Whether request was allowed
   */
  recordRateLimiterOperation(identifierType, allowed) {
    if (allowed) {
      this.rateLimiterAllowed.inc({ identifier_type: identifierType });
    } else {
      this.rateLimiterBlocked.inc({ identifier_type: identifierType });
    }
  }

  /**
   * Запись операции с БД
   * @param {string} operation - Operation type
   * @param {string} table - Table name
   * @param {number} duration - Duration in seconds
   * @param {boolean} success - Whether operation succeeded
   * @param {string} [errorType] - Error type if failed
   */
  recordDatabaseOperation(operation, table, duration, success, errorType) {
    this.databaseQueryDuration.observe({ operation, table }, duration);
    
    if (!success && errorType) {
      this.databaseErrors.inc({ operation, error_type: errorType });
    }
  }

  /**
   * Обновление количества активных разговоров
   * @param {number} count - Number of active conversations
   */
  updateActiveConversations(count) {
    this.activeConversations.set(count);
  }

  /**
   * Запись обработки сообщения
   * @param {string} messageType - Message type
   * @param {number} duration - Duration in seconds
   * @param {boolean} success - Whether processing succeeded
   * @param {string} companyType - Company type
   */
  recordMessageProcessing(messageType, duration, success, companyType) {
    const status = success ? 'success' : 'failure';
    this.messagesProcessed.inc({ status, company_type: companyType });
    this.messageProcessingDuration.observe({ message_type: messageType }, duration);
  }

  /**
   * Получить метрики в формате Prometheus
   * @returns {Promise<string>} Metrics in Prometheus format
   */
  async getMetrics() {
    return this.register.metrics();
  }

  /**
   * Получить тип контента для метрик
   * @returns {string} Content type
   */
  getContentType() {
    return this.register.contentType;
  }

  /**
   * Сбросить все метрики
   */
  reset() {
    this.register.clear();
    this.initializeMetrics();
  }
}

// Экспортируем singleton
module.exports = new PrometheusMetrics();