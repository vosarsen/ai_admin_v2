// src/integrations/whatsapp/client.js
const axios = require('axios');
const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../utils/logger');
const circuitBreakerFactory = require('../../utils/circuit-breaker');

class WhatsAppClient {
  constructor() {
    this.baseUrl = config.whatsapp.venomServerUrl;
    this.apiKey = config.whatsapp.apiKey;
    this.secretKey = config.whatsapp.secretKey;
    this.timeout = config.whatsapp.timeout;
    this.retries = config.whatsapp.retries;
    
    // Initialize circuit breaker
    this.circuitBreaker = circuitBreakerFactory.getBreaker('whatsapp', {
      timeout: this.timeout,
      errorThreshold: 5,
      resetTimeout: 60000 // 1 minute
    });
    
    // Validate required auth config
    if (!this.apiKey || !this.secretKey) {
      logger.warn('WhatsApp client authentication not configured. VENOM_API_KEY and VENOM_SECRET_KEY must be set.');
    }
    
    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for authentication (only if needed)
    if (this.apiKey && this.secretKey) {
      this.client.interceptors.request.use(
        request => {
          // Add timestamp for request freshness
          const timestamp = Date.now();
          request.headers['X-Timestamp'] = timestamp;
          
          // Add API key
          request.headers['X-API-Key'] = this.apiKey;
          
          // Generate signature
          const signature = this._generateSignature(request, timestamp);
          request.headers['X-Signature'] = signature;
          
          return request;
        },
        error => Promise.reject(error)
      );
    }

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      response => {
        logger.debug('WhatsApp API response:', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      error => {
        logger.error('WhatsApp API error:', {
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
          errorString: String(error),
          errorMessage: error?.message,
          errorCode: error?.code,
          errorStack: error?.stack,
          errorResponse: error?.response?.data,
          errorStatus: error?.response?.status,
          errorStatusText: error?.response?.statusText,
          isNull: error === null,
          isUndefined: error === undefined,
          hasOwnProperties: error ? Object.getOwnPropertyNames(error) : 'N/A',
          config: {
            url: error?.config?.url,
            method: error?.config?.method,
            headers: error?.config?.headers
          }
        });
        
        // Ensure we always reject with a proper Error object
        if (error === undefined || error === null) {
          return Promise.reject(new Error('WhatsApp API returned undefined error'));
        }
        
        // If error is not an Error object, wrap it
        if (!(error instanceof Error)) {
          return Promise.reject(new Error(`WhatsApp API error: ${String(error)}`));
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate HMAC signature for request
   */
  _generateSignature(request, timestamp) {
    // Create signature payload
    const method = request.method.toUpperCase();
    const path = request.url;
    const body = request.data ? JSON.stringify(request.data) : '';
    
    // Combine all parts
    const payload = `${method}:${path}:${timestamp}:${body}`;
    
    // Generate HMAC-SHA256
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Send message via WhatsApp
   */
  async sendMessage(phone, message, options = {}) {
    // Ensure phone has WhatsApp format
    const whatsappPhone = this._formatPhone(phone);
    
    try {
      logger.info(`📱 Attempting to send message to ${this._sanitizePhone(whatsappPhone)}`, {
        url: `${this.baseUrl}/send-message`,
        hasAuth: !!(this.apiKey && this.secretKey),
        messageLength: message.length
      });
      
      logger.debug(`📱 Starting circuit breaker execution for ${this._sanitizePhone(whatsappPhone)}`);
      
      const response = await this.circuitBreaker.execute(async () => {
        logger.debug(`📱 Inside circuit breaker, starting retry logic`);
        return await this._retryRequest(async () => {
          logger.debug(`📱 Making actual axios request to Venom Bot`);
          
          const requestData = {
            to: whatsappPhone,
            message: message,
            ...options
          };
          
          logger.debug(`📱 Request details:`, {
            baseURL: this.baseUrl,
            endpoint: '/send-message',
            data: requestData,
            timeout: this.timeout,
            hasAuth: !!(this.apiKey && this.secretKey)
          });
          
          try {
            const result = await this.client.post('/send-message', requestData);
            logger.info(`📱 Raw Venom response:`, result.data);
            return result;
          } catch (axiosError) {
            logger.error(`📱 Axios error caught in request:`, {
              axiosErrorType: typeof axiosError,
              axiosErrorConstructor: axiosError?.constructor?.name,
              axiosErrorString: String(axiosError),
              axiosErrorMessage: axiosError?.message,
              axiosErrorCode: axiosError?.code,
              axiosErrorStack: axiosError?.stack,
              axiosErrorResponse: axiosError?.response?.data,
              axiosErrorStatus: axiosError?.response?.status,
              isNull: axiosError === null,
              isUndefined: axiosError === undefined,
              hasOwnProperties: axiosError ? Object.getOwnPropertyNames(axiosError) : 'N/A'
            });
            throw axiosError;
          }
        });
      });

      logger.info(`📱 Message sent to ${this._sanitizePhone(whatsappPhone)}`);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error(`📱 sendMessage caught error:`, {
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorString: String(error),
        errorMessage: error?.message,
        errorCode: error?.code,
        errorStack: error?.stack,
        errorResponse: error?.response?.data,
        errorStatus: error?.response?.status,
        isNull: error === null,
        isUndefined: error === undefined,
        hasOwnProperties: error ? Object.getOwnPropertyNames(error) : 'N/A'
      });
      
      if (error?.code === 'CIRCUIT_OPEN') {
        logger.warn(`WhatsApp circuit breaker is open, service temporarily unavailable`);
        return { success: false, error: 'WhatsApp service temporarily unavailable' };
      }
      
      return { success: false, error: error ? (error.message || error.toString() || "Unknown error") : "Connection error" };
    }
  }

  /**
   * Send file via WhatsApp
   */
  async sendFile(phone, fileUrl, caption = '') {
    const whatsappPhone = this._formatPhone(phone);
    
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this._retryRequest(async () => {
          return await this.client.post('/send-file', {
            to: whatsappPhone,
            url: fileUrl,
            caption: caption
          });
        });
      });

      logger.info(`📎 File sent to ${this._sanitizePhone(whatsappPhone)}`);
      return { success: true, data: response.data };
    } catch (error) {
      if (error?.code === 'CIRCUIT_OPEN') {
        logger.warn(`WhatsApp circuit breaker is open, service temporarily unavailable`);
        return { success: false, error: 'WhatsApp service temporarily unavailable' };
      }
      logger.error(`Failed to send file to ${this._sanitizePhone(whatsappPhone)}:`, error);
      return { success: false, error: error ? (error.message || error.toString() || "Error exists but no message") : "Error is null" };
    }
  }

  /**
   * Check WhatsApp connection status
   */
  async checkStatus() {
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.get('/status');
      });
      return { 
        success: true, 
        connected: response.data.connected,
        qrCode: response.data.qrCode 
      };
    } catch (error) {
      if (error?.code === 'CIRCUIT_OPEN') {
        logger.warn('WhatsApp circuit breaker is open');
        return { success: false, connected: false, circuitOpen: true };
      }
      logger.error('Failed to check WhatsApp status:', error);
      return { success: false, connected: false };
    }
  }

  /**
   * Format phone number for WhatsApp
   */
  _formatPhone(phone) {
    // Remove + symbol and ensure proper format
    let cleanPhone = phone.replace(/\+/g, "");
    
    // If already in WhatsApp format, ensure no + symbol
    if (cleanPhone.includes("@c.us")) {
      return cleanPhone;
    }
    
    // Remove all non-digits
    const digitsOnly = cleanPhone.replace(/\D/g, "");
    
    // Add WhatsApp suffix
    return `${digitsOnly}@c.us`;

  }
  /**
   * Sanitize phone for logs
   */
  _sanitizePhone(phone) {
    if (!phone) return 'unknown';
    const digits = phone.replace(/\D/g, '');
    if (digits.length > 6) {
      return `${digits.substring(0, 3)}****${digits.substring(digits.length - 2)}`;
    }
    return 'phone_****';
  }

  /**
   * Retry request with exponential backoff
   */
  async _retryRequest(requestFn) {
    let lastError;
    
    logger.debug(`📞 Starting retry request, max attempts: ${this.retries}`);
    
    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        logger.info(`📞 WhatsApp request attempt ${attempt + 1}/${this.retries}`);
        const result = await requestFn();
        logger.info(`✅ WhatsApp request successful on attempt ${attempt + 1}`);
        return result;
      } catch (error) {
        lastError = error;
        
        logger.error(`❌ WhatsApp request failed on attempt ${attempt + 1}:`, {
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
          errorString: String(error),
          errorMessage: error?.message,
          errorCode: error?.code,
          errorStack: error?.stack,
          errorResponse: error?.response?.data,
          errorStatus: error?.response?.status,
          isNull: error === null,
          isUndefined: error === undefined,
          hasOwnProperties: error ? Object.getOwnPropertyNames(error) : 'N/A'
        });
        
        // Don't retry on auth errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          logger.warn(`Auth error detected, not retrying`);
          throw error;
        }
        
        if (attempt < this.retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn(`Retrying WhatsApp request, attempt ${attempt + 1}/${this.retries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error(`📞 All retry attempts exhausted, throwing lastError:`, {
      lastErrorType: typeof lastError,
      lastErrorConstructor: lastError?.constructor?.name,
      lastErrorString: String(lastError),
      lastErrorMessage: lastError?.message,
      lastErrorCode: lastError?.code,
      isNull: lastError === null,
      isUndefined: lastError === undefined
    });
    
    // Ensure we always throw a proper Error object
    if (lastError === undefined || lastError === null) {
      throw new Error('WhatsApp request failed with undefined error');
    }
    
    // If lastError is not an Error object, wrap it
    if (!(lastError instanceof Error)) {
      throw new Error(`WhatsApp request failed: ${String(lastError)}`);
    }
    
    throw lastError;
  }

  /**
   * Send typing indicator
   */
  async sendTyping(phone, duration = 3000) {
    const whatsappPhone = this._formatPhone(phone);
    
    try {
      await this.client.post('/send-typing', {
        to: whatsappPhone,
        duration: duration
      });
      logger.debug(`⌨️ Typing indicator sent to ${this._sanitizePhone(whatsappPhone)}`);
    } catch (error) {
      // Don't fail if typing indicator fails
      logger.warn('Failed to send typing indicator:', error ? (error.message || error.toString() || "Error exists but no message") : "Error is null");
    }
  }
}

// Singleton instance
module.exports = new WhatsAppClient();