// src/integrations/yclients/marketplace-client.js
const axios = require('axios');
const Bottleneck = require('bottleneck');
const Sentry = require('@sentry/node');
const logger = require('../../utils/logger');

/**
 * YClients Marketplace API Client
 *
 * Выделенный клиент для работы с Marketplace API
 * Base URL: https://api.yclients.com/marketplace
 *
 * Features:
 * - Rate limiting (200 req/min)
 * - Retry logic with exponential backoff
 * - Sentry error tracking
 * - Automatic application_id injection
 *
 * @see https://developers.yclients.com/marketplace-api
 */
class YclientsMarketplaceClient {
  static MARKETPLACE_BASE = 'https://api.yclients.com/marketplace';

  /**
   * @param {string} partnerToken - YCLIENTS_PARTNER_TOKEN
   * @param {string|number} applicationId - YCLIENTS_APP_ID (18289)
   * @param {Object} options - Optional configuration
   */
  constructor(partnerToken, applicationId, options = {}) {
    if (!partnerToken) {
      throw new Error('partnerToken is required for YclientsMarketplaceClient');
    }
    if (!applicationId) {
      throw new Error('applicationId is required for YclientsMarketplaceClient');
    }

    this.partnerToken = partnerToken;
    this.applicationId = Number(applicationId);

    this.config = {
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };

    // Rate limiter: 200 req/min = ~3.3 req/sec, use 250ms min time for safety
    this.rateLimiter = new Bottleneck({
      minTime: 300, // 300ms between requests (200 req/min)
      maxConcurrent: 5,
      reservoir: 200,
      reservoirRefreshAmount: 200,
      reservoirRefreshInterval: 60 * 1000 // 1 minute
    });

    this.axiosInstance = this._createAxiosInstance();
    this._setupInterceptors();

    logger.info('YclientsMarketplaceClient initialized', {
      applicationId: this.applicationId,
      baseUrl: YclientsMarketplaceClient.MARKETPLACE_BASE
    });
  }

  // =============== PRIVATE METHODS ===============

  /**
   * Create axios instance with marketplace base URL
   * @private
   */
  _createAxiosInstance() {
    return axios.create({
      baseURL: YclientsMarketplaceClient.MARKETPLACE_BASE,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.yclients.v2+json',
        'Authorization': `Bearer ${this.partnerToken}`,
        'User-Agent': 'AI-Admin-Marketplace/1.0.0'
      }
    });
  }

  /**
   * Setup axios interceptors for logging
   * @private
   */
  _setupInterceptors() {
    this.axiosInstance.interceptors.request.use(
      config => {
        config.metadata = { startTime: Date.now() };
        logger.debug('Marketplace API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data
        });
        return config;
      },
      error => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      response => {
        const duration = Date.now() - response.config.metadata.startTime;
        logger.debug('Marketplace API response', {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          duration: `${duration}ms`
        });
        return response;
      },
      error => {
        const duration = error.config?.metadata
          ? Date.now() - error.config.metadata.startTime
          : 0;
        logger.error('Marketplace API error', {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          duration: `${duration}ms`,
          error: error.response?.data || error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Build request body with automatic application_id injection
   * @private
   */
  _buildRequestBody(data = {}) {
    return {
      application_id: this.applicationId,
      ...data
    };
  }

  /**
   * Check if error is retryable
   * @private
   */
  _isRetryable(error) {
    if (!error.response) return true; // Network errors
    return [429, 500, 502, 503, 504].includes(error.response.status);
  }

  /**
   * Calculate retry delay with exponential backoff
   * @private
   */
  _calculateRetryDelay(attempt) {
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000);
  }

  /**
   * Execute request with retry logic
   * @private
   */
  async _executeWithRetry(requestFn, context) {
    let lastError;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await requestFn();
        return response;
      } catch (error) {
        lastError = error;

        if (attempt < this.config.maxRetries && this._isRetryable(error)) {
          const delay = this._calculateRetryDelay(attempt);
          logger.warn(`Marketplace API retry ${attempt + 1}/${this.config.maxRetries}`, {
            context,
            delay: `${delay}ms`,
            error: error.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  /**
   * Make API request with rate limiting and retry
   * @private
   */
  async _makeRequest(method, endpoint, data = null, params = {}) {
    const context = `${method} ${endpoint}`;

    try {
      const result = await this.rateLimiter.schedule(async () => {
        return this._executeWithRetry(async () => {
          const config = {
            method,
            url: endpoint,
            params
          };

          if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
            config.data = this._buildRequestBody(data);
          }

          return this.axiosInstance.request(config);
        }, context);
      });

      return {
        success: true,
        data: result.data?.data ?? result.data,
        meta: result.data?.meta,
        status: result.status
      };
    } catch (error) {
      // Capture to Sentry with context
      Sentry.captureException(error, {
        tags: {
          component: 'YclientsMarketplaceClient',
          endpoint,
          method
        },
        extra: {
          applicationId: this.applicationId,
          requestData: data,
          responseData: error.response?.data,
          responseStatus: error.response?.status
        }
      });

      return {
        success: false,
        error: this._formatError(error),
        status: error.response?.status
      };
    }
  }

  /**
   * Format error for consistent response
   * @private
   */
  _formatError(error) {
    if (!error.response) {
      return {
        type: 'NETWORK_ERROR',
        message: 'Network error connecting to YClients Marketplace API',
        retryable: true
      };
    }

    const { status, data } = error.response;
    const errorMessages = {
      400: 'Bad request - invalid parameters',
      401: 'Unauthorized - invalid partner token',
      403: 'Forbidden - access denied',
      404: 'Resource not found',
      422: 'Validation error',
      429: 'Rate limit exceeded',
      500: 'Internal server error',
      502: 'Bad gateway',
      503: 'Service unavailable'
    };

    return {
      type: `HTTP_${status}`,
      message: errorMessages[status] || `HTTP ${status} error`,
      details: data?.message || data?.error || data,
      retryable: [429, 500, 502, 503].includes(status)
    };
  }

  // =============== CALLBACK METHODS (WE → YClients) ===============

  /**
   * Callback with redirect - уведомление YClients о регистрации с редиректом
   * POST /marketplace/partner/callback/redirect
   *
   * @param {number} salonId - ID салона в YClients
   * @param {string} apiKey - API ключ салона
   * @param {Object} webhookUrls - URLs для webhook уведомлений
   * @returns {Promise<Object>}
   */
  async callbackWithRedirect(salonId, apiKey, webhookUrls = {}) {
    logger.info('Marketplace: callbackWithRedirect', { salonId });

    return this._makeRequest('POST', '/partner/callback/redirect', {
      salon_id: salonId,
      api_key: apiKey,
      webhook_urls: webhookUrls
    });
  }

  /**
   * Callback install - установка приложения без редиректа
   * POST /marketplace/partner/callback
   *
   * @param {number} salonId - ID салона в YClients
   * @param {string} apiKey - API ключ салона
   * @param {Object} webhookUrls - URLs для webhook уведомлений
   * @param {string[]} channels - Каналы уведомлений ['sms', 'whatsapp']
   * @returns {Promise<Object>}
   */
  async callbackInstall(salonId, apiKey, webhookUrls = {}, channels = []) {
    logger.info('Marketplace: callbackInstall', { salonId, channels });

    return this._makeRequest('POST', '/partner/callback', {
      salon_id: salonId,
      api_key: apiKey,
      webhook_urls: webhookUrls,
      channels
    });
  }

  // =============== PAYMENT METHODS (OUTBOUND: WE → YClients) ===============

  /**
   * Notify payment - уведомить YClients о платеже клиента
   * POST /marketplace/partner/payment
   *
   * IMPORTANT: Response contains { id: 123 } - SAVE THIS payment_id for refund!
   *
   * @param {number} salonId - ID салона в YClients
   * @param {Object} paymentData - Данные платежа
   * @param {number} paymentData.payment_sum - Сумма платежа
   * @param {string} paymentData.currency_iso - Код валюты (RUB)
   * @param {string} paymentData.payment_date - Дата платежа (YYYY-MM-DD)
   * @param {string} paymentData.period_from - Начало периода подписки
   * @param {string} paymentData.period_to - Конец периода подписки
   * @returns {Promise<Object>} Contains payment_id in data.id
   */
  async notifyPayment(salonId, paymentData) {
    logger.info('Marketplace: notifyPayment', { salonId, paymentData });

    const result = await this._makeRequest('POST', '/partner/payment', {
      salon_id: salonId,
      ...paymentData
    });

    if (result.success && result.data?.id) {
      logger.info('Marketplace: payment notified, save payment_id for refund', {
        salonId,
        paymentId: result.data.id
      });
    }

    return result;
  }

  /**
   * Notify refund - уведомить YClients о возврате платежа
   * POST /marketplace/partner/payment/refund/{payment_id}
   *
   * @param {number} paymentId - ID платежа из notifyPayment response
   * @returns {Promise<Object>}
   */
  async notifyRefund(paymentId) {
    logger.info('Marketplace: notifyRefund', { paymentId });

    return this._makeRequest('POST', `/partner/payment/refund/${paymentId}`, {});
  }

  /**
   * Generate payment link - получить ссылку на оплату
   * GET /marketplace/application/payment_link
   *
   * @param {number} salonId - ID салона в YClients
   * @param {number|null} discount - Процент скидки (опционально)
   * @returns {Promise<Object>}
   */
  async generatePaymentLink(salonId, discount = null) {
    logger.info('Marketplace: generatePaymentLink', { salonId, discount });

    const params = {
      salon_id: salonId,
      application_id: this.applicationId
    };

    if (discount !== null) {
      params.discount = discount;
    }

    return this._makeRequest('GET', '/application/payment_link', null, params);
  }

  // =============== MANAGEMENT METHODS ===============

  /**
   * Get integration status - получить статус подключения салона
   * GET /marketplace/salon/{salon_id}/application/{application_id}
   *
   * @param {number} salonId - ID салона в YClients
   * @returns {Promise<Object>} Contains logs, payments, connection_status
   */
  async getIntegrationStatus(salonId) {
    logger.info('Marketplace: getIntegrationStatus', { salonId });

    return this._makeRequest(
      'GET',
      `/salon/${salonId}/application/${this.applicationId}`
    );
  }

  /**
   * Get connected salons - список подключенных салонов
   * GET /marketplace/application/{application_id}/salons
   *
   * @param {number} page - Номер страницы (default: 1)
   * @param {number} count - Количество на странице (max: 1000)
   * @returns {Promise<Object>}
   */
  async getConnectedSalons(page = 1, count = 100) {
    // API limit is 1000
    const safeCount = Math.min(count, 1000);

    logger.info('Marketplace: getConnectedSalons', { page, count: safeCount });

    return this._makeRequest(
      'GET',
      `/application/${this.applicationId}/salons`,
      null,
      { page, count: safeCount }
    );
  }

  /**
   * Uninstall from salon - отключить приложение от салона
   * POST /marketplace/salon/{salon_id}/application/{application_id}/uninstall
   *
   * WARNING: This action is irreversible!
   *
   * @param {number} salonId - ID салона в YClients
   * @returns {Promise<Object>}
   */
  async uninstallFromSalon(salonId) {
    logger.warn('Marketplace: uninstallFromSalon - DANGEROUS ACTION', { salonId });

    return this._makeRequest(
      'POST',
      `/salon/${salonId}/application/${this.applicationId}/uninstall`,
      {}
    );
  }

  // =============== TARIFFS & DISCOUNTS METHODS ===============

  /**
   * Get tariffs - получить тарифы приложения
   * GET /marketplace/application/{application_id}/tariffs
   *
   * @returns {Promise<Object>} Tariff options with prices
   */
  async getTariffs() {
    logger.info('Marketplace: getTariffs');

    return this._makeRequest(
      'GET',
      `/application/${this.applicationId}/tariffs`
    );
  }

  /**
   * Add discount - установить скидку для салонов
   * POST /marketplace/application/add_discount
   *
   * @param {number[]} salonIds - Массив ID салонов
   * @param {number} discountPercent - Процент скидки
   * @returns {Promise<Object>}
   */
  async addDiscount(salonIds, discountPercent) {
    logger.info('Marketplace: addDiscount', {
      salonIds,
      discountPercent,
      salonCount: salonIds.length
    });

    return this._makeRequest('POST', '/application/add_discount', {
      salon_ids: salonIds,
      discount: discountPercent
    });
  }

  // =============== CHANNEL METHODS ===============

  /**
   * Update channel - включить/отключить канал уведомлений
   * POST /marketplace/application/update_channel
   *
   * @param {number} salonId - ID салона в YClients
   * @param {string} channelSlug - Канал: 'sms' | 'whatsapp'
   * @param {boolean} isAvailable - Включить (true) или отключить (false)
   * @returns {Promise<Object>}
   */
  async updateChannel(salonId, channelSlug, isAvailable) {
    // Validate channel slug
    const validChannels = ['sms', 'whatsapp'];
    if (!validChannels.includes(channelSlug)) {
      return {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: `Invalid channel: ${channelSlug}. Valid channels: ${validChannels.join(', ')}`
        }
      };
    }

    logger.info('Marketplace: updateChannel', { salonId, channelSlug, isAvailable });

    return this._makeRequest('POST', '/application/update_channel', {
      salon_id: salonId,
      channel_slug: channelSlug,
      is_available: isAvailable
    });
  }

  /**
   * Set short names - установить имена отправителя SMS
   * POST /marketplace/partner/short_names
   *
   * @param {number} salonId - ID салона в YClients
   * @param {string[]} shortNames - Массив имён отправителя
   * @returns {Promise<Object>}
   */
  async setShortNames(salonId, shortNames) {
    logger.info('Marketplace: setShortNames', { salonId, shortNames });

    return this._makeRequest('POST', '/partner/short_names', {
      salon_id: salonId,
      short_names: shortNames
    });
  }

  // =============== UTILITY METHODS ===============

  /**
   * Health check - проверка доступности API
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    try {
      const start = Date.now();
      const result = await this.getTariffs();
      const responseTime = Date.now() - start;

      return {
        healthy: result.success,
        responseTime,
        applicationId: this.applicationId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        applicationId: this.applicationId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get client instance info
   * @returns {Object}
   */
  getInfo() {
    return {
      applicationId: this.applicationId,
      baseUrl: YclientsMarketplaceClient.MARKETPLACE_BASE,
      rateLimitConfig: {
        minTime: 300,
        maxConcurrent: 5,
        reservoirPerMinute: 200
      }
    };
  }
}

// Factory function for creating client from environment
function createMarketplaceClient(options = {}) {
  const config = require('../../config');

  const partnerToken = options.partnerToken || config.yclients?.bearerToken || process.env.YCLIENTS_PARTNER_TOKEN;
  const applicationId = options.applicationId || process.env.YCLIENTS_APP_ID;

  if (!partnerToken) {
    throw new Error('YCLIENTS_PARTNER_TOKEN is required');
  }
  if (!applicationId) {
    throw new Error('YCLIENTS_APP_ID is required');
  }

  return new YclientsMarketplaceClient(partnerToken, applicationId, options);
}

module.exports = {
  YclientsMarketplaceClient,
  createMarketplaceClient
};
