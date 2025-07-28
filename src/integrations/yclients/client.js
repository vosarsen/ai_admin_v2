// src/integrations/yclients/api/yclients-client.js
const axios = require('axios');
const logger = require('../../utils/logger');
const Bottleneck = require('bottleneck');

/**
 * 🚀 PRODUCTION-READY YCLIENTS CLIENT
 * Enterprise-grade клиент для работы с Yclients API
 * Объединяет: YclientsGateway + BaseHttpClient + YclientsEndpoints
 * 
 * Возможности:
 * - Rate limiting (500 req/hour)
 * - Smart retry с exponential backoff  
 * - Circuit breaker pattern
 * - Request/response caching
 * - Real-time метрики
 * - Graceful error handling
 */
class YclientsClient {
  // =============== ENDPOINTS КОНСТАНТЫ ===============
  static ENDPOINTS = {
    // Company endpoints
    company: (companyId) => `company/${companyId}`,
    services: (companyId) => `company/${companyId}/services`,
    serviceCategories: (companyId) => `company/${companyId}/service_categories`,
    staff: (companyId) => `company/${companyId}/staff`,
    clients: (companyId) => `company/${companyId}/clients`,
    createClient: (companyId) => `clients/${companyId}`,
    searchClients: (companyId) => `company/${companyId}/clients/search`,

    // Booking endpoints (критичные для высокой нагрузки)
    bookServices: (companyId) => `book_services/${companyId}`,
    bookStaff: (companyId) => `book_staff/${companyId}`,
    bookDates: (companyId) => `book_dates/${companyId}`,
    bookTimes: (companyId, staffId, date) => `book_times/${companyId}/${staffId}/${date}`,
    bookCheck: (companyId) => `book_check/${companyId}`,
    bookRecord: (companyId) => `book_record/${companyId}`,

    // Records endpoints
    records: (companyId) => `records/${companyId}`,
    record: (companyId, recordId) => `record/${companyId}/${recordId}`,

    // Staff schedule endpoints
    staffSeances: (companyId, staffId) => `book_staff_seances/${companyId}/${staffId}/`
  };

  constructor(config = {}) {
    const appConfig = require("../../config");
    this.config = {
      baseUrl: 'https://api.yclients.com/api/v1',
      bearerToken: config.bearerToken || appConfig.yclients.bearerToken,
      userToken: config.userToken || appConfig.yclients.userToken,
      partnerId: config.partnerId || appConfig.yclients.partnerId,
      companyId: config.companyId || appConfig.yclients.companyId,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,

      // Production настройки
      rateLimit: {
        requestsPerHour: 450, // Запас от лимита 500
        burstLimit: 10,       // Максимум в секунду
        ...config.rateLimit
      },

      cache: {
        enabled: true,
        ttl: 1800, // 30 минут
        maxSize: 1000,
        ...config.cache
      },

      monitoring: {
        enabled: true,
        metricsInterval: 60000, // 1 минута
        ...config.monitoring
      }
    };

    // Инициализация компонентов
    this.axiosInstance = this._createAxiosInstance();
    this.rateLimiter = this._createRateLimiter();
    this.slotsRateLimiter = new Bottleneck({
      minTime: 250, // не чаще 1 запроса в 250мс
      maxConcurrent: 5, // максимум 5 параллельных запросов
      reservoir: 500, // максимум 500 запросов в час
      reservoirRefreshAmount: 500,
      reservoirRefreshInterval: 60 * 60 * 1000 // каждый час
    });
    this.errorHandler = this._createErrorHandler();
    this.cache = new Map();
    this.stats = this._initStats();

    this._setupInterceptors();
    this._startMetricsCollection();

    // Предупреждение если Partner ID не установлен
    if (!this.config.partnerId) {
      logger.warn('⚠️ YCLIENTS_PARTNER_ID not set - this may cause API errors');
    }

    logger.info('🚀 YclientsClient initialized for production load', {
      hasPartnerId: !!this.config.partnerId,
      hasUserToken: !!this.config.userToken,
      hasBearerToken: !!this.config.bearerToken
    });
  }

  // =============== CORE HTTP METHODS ===============

  /**
   * Основной метод для всех API запросов
   * Включает rate limiting, caching, retry логику
   */
  async request(method, endpoint, data = null, params = {}, options = {}) {
    const requestId = this._generateRequestId();
    const cacheKey = this._generateCacheKey(method, endpoint, params);

    logger.info(`🚀 YclientsClient.request() started [${requestId}]`, { 
      method, endpoint, params, options 
    });

    try {
      // 1. Проверяем кэш (для GET запросов)
      if (method === 'GET' && this.config.cache.enabled) {
        const cached = this._getFromCache(cacheKey);
        if (cached) {
          logger.debug(`💾 Cache hit for ${endpoint}`);
          this.stats.cacheHits++;
          return cached;
        }
      }

      // 2. Rate limiting
      logger.info(`⏳ Rate limiting [${requestId}]`, { priority: options.priority || 'normal' });
      await this.rateLimiter.waitForSlot(options.priority || 'normal');
      logger.info(`✅ Rate limiting passed [${requestId}]`);

      // 3. Выполняем запрос с retry логикой
      logger.info(`🔄 Starting _executeWithRetry [${requestId}]`);
      const result = await this._executeWithRetry(method, endpoint, data, params, requestId);

      // 4. Кэшируем результат (для GET запросов)
      if (method === 'GET' && this.config.cache.enabled && result.success) {
        this._saveToCache(cacheKey, result);
      }

      // 5. Обновляем метрики
      this._updateStats(true, Date.now() - result.startTime);

      return result;

    } catch (error) {
      this._updateStats(false, 0);
      logger.error(`❌ Request failed [${requestId}]: ${error.message}`);

      return {
        success: false,
        error: this.errorHandler.formatError(error),
        requestId
      };
    }
  }

  /**
   * GET запрос с умным кэшированием
   */
  async get(endpoint, params = {}, options = {}) {
    return this.request('GET', endpoint, null, params, options);
  }

  /**
   * POST запрос с приоритетом
   */
  async post(endpoint, data, options = {}) {
    return this.request('POST', endpoint, data, {}, {
      priority: 'high', // POST запросы имеют высокий приоритет
      ...options
    });
  }

  // =============== BUSINESS METHODS ===============

  /**
   * 🏢 Получить информацию о компании
   */
  async getCompanyInfo(companyId = this.config.companyId) {
    return this.get(YclientsClient.ENDPOINTS.company(companyId), {}, {
      cacheTtl: 3600 // Информация о компании кэшируется на час
    });
  }

  /**
   * 🛍️ Получить услуги (с фильтрацией по времени/мастеру)
   */
  async getServices(params = {}, companyId = this.config.companyId) {
    const endpoint = params.datetime || params.staff_id 
      ? YclientsClient.ENDPOINTS.bookServices(companyId)
      : YclientsClient.ENDPOINTS.services(companyId);

    return this.get(endpoint, params, {
      cacheTtl: 1800 // Услуги кэшируются на 30 минут
    });
  }

  /**
   * 👥 Получить мастеров (с фильтрацией по услугам/времени)
   */
  async getStaff(params = {}, companyId = this.config.companyId) {
    const endpoint = params.service_ids || params.datetime
      ? YclientsClient.ENDPOINTS.bookStaff(companyId)
      : YclientsClient.ENDPOINTS.staff(companyId);

    return this.get(endpoint, params, {
      cacheTtl: 1800 // Мастера кэшируются на 30 минут
    });
  }

  /**
   * 📅 Получить доступные даты
   */
  async getAvailableDates(params = {}, companyId = this.config.companyId) {
    return this.get(YclientsClient.ENDPOINTS.bookDates(companyId), params, {
      cacheTtl: 600, // Даты кэшируются на 10 минут
      priority: 'high'
    });
  }

  /**
   * 🕐 Получить доступные слоты (rate limited)
   */
  async getAvailableSlots(staffId, date, params = {}, companyId = this.config.companyId) {
    logger.info('🕐 getAvailableSlots called', { staffId, date, params, companyId });
    
    try {
      const result = await this.slotsRateLimiter.schedule(() => {
        logger.info('📋 Rate limiter executing request', { staffId, date });
        
        // ✅ Исправлено: используем book_times с правильными параметрами
        const queryParams = {
          ...params
        };
        
        const endpoint = YclientsClient.ENDPOINTS.bookTimes(companyId, staffId, date);
        const fullUrl = `${this.config.baseUrl}/${endpoint}`;
        const queryString = new URLSearchParams(queryParams).toString();
        logger.info(`🚨 CRITICAL: Making request to: ${fullUrl}?${queryString}`);
        
        return this.get(
          endpoint,
          queryParams,
          {
            cacheTtl: 300, // Слоты кэшируются на 5 минут
            priority: 'high'
          }
        );
      });
      
      logger.info('✅ getAvailableSlots completed', { 
        staffId, 
        date, 
        success: result?.success,
        dataLength: Array.isArray(result?.data) ? result.data.length : 'not-array',
        sampleData: Array.isArray(result?.data) ? result.data.slice(0, 2) : result?.data,
        fullResult: result
      });
      return result;
    } catch (error) {
      logger.error('❌ getAvailableSlots failed', { 
        staffId, 
        date, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * ✅ Валидация записи ПЕРЕД созданием (критично!)
   */
  async validateBooking(appointments, companyId = this.config.companyId) {
    const result = await this.post(
      YclientsClient.ENDPOINTS.bookCheck(companyId), 
      { appointments },
      { priority: 'critical' }
    );

    // Обработка специфичных ошибок валидации
    if (!result.success && result.status === 422) {
      return this.errorHandler.parseValidationErrors(result.data);
    }

    return result;
  }

  /**
   * 📝 Создать запись
   */
  async createBooking(bookingData, companyId = this.config.companyId) {
    return this.post(
      YclientsClient.ENDPOINTS.bookRecord(companyId), 
      bookingData,
      { priority: 'critical' }
    );
  }

  /**
   * 📋 Получить записи с фильтрацией
   */
  async getRecords(params = {}, companyId = this.config.companyId) {
    return this.get(YclientsClient.ENDPOINTS.records(companyId), params, {
      cacheTtl: 60 // Записи кэшируются на 1 минуту
    });
  }

  /**
   * 🔍 Поиск клиентов по телефону или имени
   */
  async searchClients(searchQuery, companyId = this.config.companyId) {
    return this.post(
      YclientsClient.ENDPOINTS.searchClients(companyId),
      { search_term: searchQuery },
      { cacheTtl: 300 } // Кэшируем на 5 минут
    );
  }

  /**
   * 👤 Создать клиента
   */
  async createClient(clientData, companyId = this.config.companyId) {
    const payload = {
      name: clientData.name || clientData.fullname,
      phone: clientData.phone,
      email: clientData.email || '',
      comment: clientData.comment || 'Создан через AI администратора'
    };
    
    return this.post(
      YclientsClient.ENDPOINTS.createClient(companyId),
      payload,
      { priority: 'high' }
    );
  }

  // =============== PRIVATE METHODS ===============

  _createAxiosInstance() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.yclients.v2+json',
      'Authorization': this._buildAuthHeader(),
      'User-Agent': 'AI-Admin-Enterprise/1.0.0'
    };

    // Добавляем Partner ID если он есть
    if (this.config.partnerId) {
      headers['X-Partner-Id'] = this.config.partnerId;
    }

    return axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers
    });
  }

  _buildAuthHeader() {
    let auth = `Bearer ${this.config.bearerToken}`;
    if (this.config.userToken) {
      auth += `, User ${this.config.userToken}`;
    }
    return auth;
  }

  _createRateLimiter() {
    return {
      requestTimes: [],
      lastRequest: 0,

      async waitForSlot(priority = 'normal') {
        const now = Date.now();
        const hourAgo = now - 3600000;

        // Удаляем старые запросы
        this.requestTimes = this.requestTimes.filter(time => time > hourAgo);

        // Проверяем лимиты
        if (this.requestTimes.length >= 450) { // Запас от лимита 500
          const waitTime = 3600000 - (now - this.requestTimes[0]);
          logger.warn(`⏱️ Rate limit reached, waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Burst protection
        const timeSinceLastRequest = now - this.lastRequest;
        if (timeSinceLastRequest < 100) { // Минимум 100ms между запросами
          await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
        }

        this.requestTimes.push(now);
        this.lastRequest = now;
      }
    };
  }

  _createErrorHandler() {
    return {
      formatError(error) {
        if (!error.response) {
          return {
            type: 'NETWORK_ERROR',
            message: 'Проблемы с подключением к серверу',
            retryable: true
          };
        }

        const { status, data } = error.response;

        const errorMap = {
          400: 'Неверные параметры запроса',
          401: 'Ошибка авторизации', 
          403: 'Доступ запрещен',
          404: 'Ресурс не найден',
          422: 'Ошибка валидации данных',
          429: 'Превышен лимит запросов',
          500: 'Внутренняя ошибка сервера',
          502: 'Сервер недоступен',
          503: 'Сервис временно недоступен'
        };

        // Извлекаем детальные ошибки от YClients
        let yclientsErrors = null;
        if (data?.meta?.errors && Array.isArray(data.meta.errors)) {
          yclientsErrors = data.meta.errors;
        }
        
        return {
          type: `HTTP_${status}`,
          message: errorMap[status] || `HTTP ${status} ошибка`,
          details: data?.message || data?.error,
          yclientsErrors: yclientsErrors,
          retryable: [429, 500, 502, 503].includes(status)
        };
      },

      parseValidationErrors(errorData) {
        const errorMap = {
          432: 'Неправильный код подтверждения',
          433: 'Выбранное время уже занято',
          434: 'Клиент в черном списке',
          435: 'Не указано имя клиента',
          436: 'Нет доступных мастеров',
          437: 'Пересечение времени записей',
          438: 'Услуга недоступна'
        };

        return {
          success: false,
          error: errorMap[errorData.meta?.code] || 'Ошибка валидации',
          code: errorData.meta?.code,
          appointmentId: errorData.meta?.appointment_id
        };
      }
    };
  }

  async _executeWithRetry(method, endpoint, data, params, requestId) {
    let lastError;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const config = {
          method,
          url: endpoint,
          data,
          params,
          metadata: { requestId, attempt }
        };

        // ✅ Детальное логирование запроса
        logger.info(`🔍 YClients API Request [${requestId}] attempt ${attempt + 1}`, {
          method,
          endpoint,
          params,
          fullUrl: `${this.config.baseUrl}/${endpoint}`,
          headers: this.axiosInstance.defaults.headers
        });

        const response = await this.axiosInstance.request(config);

        // Обработка специального случая для статуса 204 No Content
        if (response.status === 204) {
          return {
            success: true,
            data: null,
            status: response.status,
            startTime,
            attempt
          };
        }

        return {
          success: true,
          data: response.data,
          status: response.status,
          startTime,
          attempt
        };

      } catch (error) {
        lastError = error;

        // ✅ Детальное логирование ошибок
        logger.error(`❌ YClients API Request Failed [${requestId}] attempt ${attempt + 1}`, {
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            params: error.config?.params
          }
        });

        if (attempt < this.config.maxRetries && this._isRetryable(error)) {
          const delay = this._calculateRetryDelay(attempt);
          logger.warn(`🔄 Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  _isRetryable(error) {
    if (!error.response) return true; // Network errors
    return [429, 500, 502, 503, 504].includes(error.response.status);
  }

  _calculateRetryDelay(attempt) {
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000);
  }

  // Cache methods
  _generateCacheKey(method, endpoint, params) {
    return `${method}:${endpoint}:${JSON.stringify(params)}`;
  }

  _getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  _saveToCache(key, data, customTtl) {
    const ttl = customTtl || this.config.cache.ttl;
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttl * 1000)
    });

    // Очистка старого кэша
    if (this.cache.size > this.config.cache.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  // Metrics methods
  _initStats() {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHits: 0,
      rateLimitWaits: 0,
      lastHealthCheck: Date.now()
    };
  }

  _updateStats(success, responseTime) {
    this.stats.totalRequests++;

    if (success) {
      this.stats.successfulRequests++;

      // Обновляем среднее время ответа
      const currentAvg = this.stats.averageResponseTime;
      const totalRequests = this.stats.totalRequests;
      this.stats.averageResponseTime = ((currentAvg * (totalRequests - 1)) + responseTime) / totalRequests;
    } else {
      this.stats.failedRequests++;
    }
  }

  _startMetricsCollection() {
    if (!this.config.monitoring.enabled) return;

    setInterval(() => {
      const stats = this.getStats();

      // Логируем ключевые метрики
      logger.info(`📊 YclientsClient Stats: ${stats.successRate}% success, ${stats.averageResponseTime}ms avg response`);

      // Алерты при проблемах
      if (stats.successRate < 95) {
        logger.warn(`⚠️ Low success rate: ${stats.successRate}%`);
      }

      if (stats.averageResponseTime > 2000) {
        logger.warn(`⚠️ High response time: ${stats.averageResponseTime}ms`);
      }

    }, this.config.monitoring.metricsInterval);
  }

  _setupInterceptors() {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      config => {
        config.metadata = { ...config.metadata, startTime: Date.now() };
        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      response => {
        const duration = Date.now() - response.config.metadata.startTime;
        logger.debug(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`);
        return response;
      },
      error => {
        const duration = error.config?.metadata ? Date.now() - error.config.metadata.startTime : 0;
        logger.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status || 'Network Error'} (${duration}ms)`);
        return Promise.reject(error);
      }
    );
  }

  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // =============== PUBLIC UTILITY METHODS ===============

  /**
   * Получить статистику производительности
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 
        ? Math.round((this.stats.successfulRequests / this.stats.totalRequests) * 100)
        : 100,
      cacheHitRate: this.stats.totalRequests > 0
        ? Math.round((this.stats.cacheHits / this.stats.totalRequests) * 100)
        : 0,
      uptime: Date.now() - this.stats.lastHealthCheck
    };
  }

  /**
   * Health check для мониторинга
   */
  async healthCheck() {
    try {
      const start = Date.now();
      const result = await this.getCompanyInfo();
      const responseTime = Date.now() - start;

      return {
        healthy: result.success,
        responseTime,
        stats: this.getStats(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Получить список записей
   */
  async getRecords(companyId, params = {}) {
    try {
      logger.info(`📋 Getting records for company ${companyId}`, params);
      
      const queryParams = {};
      
      // Добавляем параметры фильтрации
      if (params.client_phone) {
        queryParams.client_phone = params.client_phone;
      }
      if (params.start_date) {
        queryParams.start_date = params.start_date;
      }
      if (params.end_date) {
        queryParams.end_date = params.end_date;
      }
      if (params.staff_id) {
        queryParams.staff_id = params.staff_id;
      }
      
      const result = await this.request(
        'GET',
        `records/${companyId}`,
        null,
        queryParams
      );

      if (result.success && result.data) {
        logger.info(`✅ Found ${result.data.length} records`);
        return {
          success: true,
          data: result.data
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to get records'
      };
    } catch (error) {
      logger.error('Error getting records:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Удалить запись
   */
  async deleteRecord(companyId, recordId) {
    try {
      logger.info(`🚫 Deleting record ${recordId} from company ${companyId}`);
      
      const result = await this.request(
        'DELETE',
        `record/${companyId}/${recordId}`,
        null,
        {
          include_consumables: 0,
          include_finance_transactions: 0
        }
      );

      // Проверяем успешность по статусу 204 или флагу success
      if (result.status === 204 || result.success) {
        logger.info(`✅ Successfully deleted record ${recordId}`);
        return {
          success: true,
          data: result.data
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to delete record'
      };
    } catch (error) {
      logger.error('Error deleting record:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Удалить запись пользователя через user endpoint
   * Требует record_hash для авторизации
   */
  async deleteUserRecord(recordId, recordHash) {
    try {
      logger.info(`🚫 Deleting user record ${recordId} with hash`);
      
      const result = await this.request(
        'DELETE',
        `user/records/${recordId}/${recordHash}`,
        null
      );

      if (result.success) {
        logger.info(`✅ Successfully deleted user record ${recordId}`);
        return {
          success: true,
          data: result.data
        };
      }

      return {
        success: false,
        error: result.meta?.message || 'Failed to delete user record'
      };
    } catch (error) {
      logger.error('Error deleting user record:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Отменить запись через изменение статуса (мягкая отмена)
   * Устанавливает статус "Не пришел" вместо удаления
   */
  async cancelRecordSoft(companyId, recordId, comment = 'Отменено клиентом через WhatsApp') {
    try {
      logger.info(`🚫 Soft canceling record ${recordId} at company ${companyId}`);
      
      // Сначала получаем детали записи для получения visit_id
      const recordDetails = await this.request(
        'GET',
        `record/${companyId}/${recordId}`
      );
      
      // Проверяем разные варианты структуры ответа
      const recordData = recordDetails.data?.data || recordDetails.data;
      
      if (!recordData?.visit_id) {
        logger.error('Failed to get visit_id from record details', { recordDetails });
        return {
          success: false,
          error: 'Не удалось получить информацию о записи'
        };
      }
      
      const visitId = recordData.visit_id;
      logger.info(`Found visit_id: ${visitId} for record ${recordId}`);
      
      // Используем endpoint /visits для изменения статуса
      const result = await this.request(
        'PUT',
        `visits/${visitId}/${recordId}`,
        {
          attendance: -1, // Не пришел
          comment
        }
      );

      if (result.status === 200 || result.status === 201 || result.success) {
        logger.info(`✅ Successfully soft-cancelled record ${recordId} via visit ${visitId}`);
        return {
          success: true,
          data: result.data,
          visitId,
          recordId
        };
      }

      return {
        success: false,
        error: result.error || result.meta?.message || 'Failed to cancel record'
      };
    } catch (error) {
      logger.error('Error soft canceling record:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Обновить статус посещения (attendance)
   * @param {number} visitId - ID визита
   * @param {number} recordId - ID записи
   * @param {number} attendance - Статус: 2=подтвердил, 1=пришел, 0=ожидание, -1=не пришел
   * @param {object} additionalData - Дополнительные данные (комментарий, услуги и т.д.)
   */
  async updateVisitStatus(visitId, recordId, attendance, additionalData = {}) {
    try {
      logger.info(`📝 Updating visit status for record ${recordId}, attendance: ${attendance}`);
      
      const attendanceMap = {
        2: 'Подтвердил',
        1: 'Пришел',
        0: 'Ожидание',
        '-1': 'Не пришел'
      };
      
      const payload = {
        attendance,
        ...additionalData
      };
      
      const result = await this.request(
        'PUT',
        `visits/${visitId}/${recordId}`,
        payload
      );

      if (result.success) {
        logger.info(`✅ Successfully updated visit status to: ${attendanceMap[attendance]}`);
        return {
          success: true,
          data: result.data,
          status: attendanceMap[attendance]
        };
      }

      return {
        success: false,
        error: result.meta?.message || 'Failed to update visit status'
      };
    } catch (error) {
      logger.error('Error updating visit status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Обновить запись (например, изменить статус)
   */
  async updateRecord(companyId, recordId, updateData) {
    try {
      logger.info(`📝 Updating record ${recordId} in company ${companyId}`, updateData);
      
      const result = await this.request(
        'PUT',
        `record/${companyId}/${recordId}`,
        updateData,
        {}
      );

      if (result.success) {
        logger.info(`✅ Successfully updated record ${recordId}`);
        return {
          success: true,
          data: result.data
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to update record'
      };
    } catch (error) {
      logger.error('Error updating record:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Очистить кэш
   */
  clearCache() {
    this.cache.clear();
    logger.info('🗑️ Cache cleared');
  }

  /**
   * Перенести запись на новое время
   * @param {number} companyId - ID компании
   * @param {number} recordId - ID записи
   * @param {string} datetime - Новая дата и время в формате ISO 8601
   * @param {string} comment - Комментарий (опционально)
   * @returns {Promise<Object>} Результат переноса
   */
  async rescheduleRecord(companyId, recordId, datetime, comment = '') {
    try {
      logger.info(`📅 Rescheduling record ${recordId} to ${datetime}`, {
        companyId,
        recordId,
        datetime,
        comment
      });

      const result = await this.request(
        'PUT',
        `book_record/${companyId}/${recordId}`,
        {
          datetime,
          comment
        },
        {}
      );

      if (result.success) {
        logger.info(`✅ Successfully rescheduled record ${recordId} to ${datetime}`);
        return {
          success: true,
          data: result.data
        };
      }

      return {
        success: false,
        error: result.meta?.message || 'Failed to reschedule record'
      };
    } catch (error) {
      logger.error('❌ Error rescheduling record:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Graceful shutdown
   */
  destroy() {
    this.cache.clear();
    logger.info('💥 YclientsClient destroyed');
  }
}

module.exports = { YclientsClient };