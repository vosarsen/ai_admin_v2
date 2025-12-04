/**
 * Telegram Errors Unit Tests
 *
 * Tests for custom Telegram error classes and TelegramErrorHandler utility
 *
 * Run with: npm test -- tests/telegram/telegram-errors.test.js
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

const {
  TelegramError,
  TelegramConnectionError,
  TelegramMessageError,
  TelegramRateLimitError,
  TelegramBotBlockedError,
  TelegramActivityWindowError,
  TelegramWebhookError,
  TelegramConnectionNotFoundError,
  TelegramAPIError,
  TelegramConfigError,
  TelegramErrorHandler
} = require('../../src/utils/telegram-errors');

describe('Telegram Error Classes', () => {
  describe('TelegramError (base class)', () => {
    test('should create error with default values', () => {
      const error = new TelegramError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TelegramError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TELEGRAM_ERROR');
      expect(error.name).toBe('TelegramError');
      expect(error.isRetryable).toBe(false);
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.stack).toBeDefined();
    });

    test('should create error with custom code and details', () => {
      const error = new TelegramError('Custom error', 'CUSTOM_CODE', { key: 'value' });

      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.details).toEqual({ key: 'value' });
    });

    test('should serialize to JSON correctly', () => {
      const error = new TelegramError('Test error', 'TEST_CODE', { foo: 'bar' });
      const json = error.toJSON();

      expect(json.name).toBe('TelegramError');
      expect(json.code).toBe('TEST_CODE');
      expect(json.message).toBe('Test error');
      expect(json.details).toEqual({ foo: 'bar' });
      expect(json.isRetryable).toBe(false);
      expect(json.stack).toBeDefined();
    });
  });

  describe('TelegramConnectionError', () => {
    test('should create connection error with companyId', () => {
      const error = new TelegramConnectionError('Connection failed', 12345);

      expect(error).toBeInstanceOf(TelegramError);
      expect(error.name).toBe('TelegramConnectionError');
      expect(error.code).toBe('TELEGRAM_CONNECTION_ERROR');
      expect(error.companyId).toBe(12345);
      expect(error.isRetryable).toBe(true);
      expect(error.details.companyId).toBe(12345);
    });
  });

  describe('TelegramMessageError', () => {
    test('should create message error with chatId', () => {
      const error = new TelegramMessageError('Send failed', 67890);

      expect(error.name).toBe('TelegramMessageError');
      expect(error.code).toBe('TELEGRAM_MESSAGE_ERROR');
      expect(error.chatId).toBe(67890);
      expect(error.isRetryable).toBe(true);
    });
  });

  describe('TelegramRateLimitError', () => {
    test('should create rate limit error with retryAfter', () => {
      const error = new TelegramRateLimitError('Too many requests', 30);

      expect(error.name).toBe('TelegramRateLimitError');
      expect(error.code).toBe('TELEGRAM_RATE_LIMIT');
      expect(error.retryAfter).toBe(30);
      expect(error.isRetryable).toBe(true);
    });

    test('should use default retryAfter of 60', () => {
      const error = new TelegramRateLimitError('Rate limited');

      expect(error.retryAfter).toBe(60);
    });
  });

  describe('TelegramBotBlockedError', () => {
    test('should create bot blocked error', () => {
      const error = new TelegramBotBlockedError('User blocked bot', 12345);

      expect(error.name).toBe('TelegramBotBlockedError');
      expect(error.code).toBe('TELEGRAM_BOT_BLOCKED');
      expect(error.chatId).toBe(12345);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('TelegramActivityWindowError', () => {
    test('should create activity window error', () => {
      const error = new TelegramActivityWindowError('24h window expired', 12345);

      expect(error.name).toBe('TelegramActivityWindowError');
      expect(error.code).toBe('TELEGRAM_ACTIVITY_WINDOW');
      expect(error.chatId).toBe(12345);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('TelegramWebhookError', () => {
    test('should create webhook error with URL', () => {
      const error = new TelegramWebhookError('Webhook failed', 'https://example.com/webhook');

      expect(error.name).toBe('TelegramWebhookError');
      expect(error.code).toBe('TELEGRAM_WEBHOOK_ERROR');
      expect(error.webhookUrl).toBe('https://example.com/webhook');
      expect(error.isRetryable).toBe(true);
    });
  });

  describe('TelegramConnectionNotFoundError', () => {
    test('should create connection not found error', () => {
      const error = new TelegramConnectionNotFoundError('No connection', 12345);

      expect(error.name).toBe('TelegramConnectionNotFoundError');
      expect(error.code).toBe('TELEGRAM_CONNECTION_NOT_FOUND');
      expect(error.companyId).toBe(12345);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('TelegramAPIError', () => {
    test('should create API error with error code and method', () => {
      const error = new TelegramAPIError('Bad request', 400, 'sendMessage');

      expect(error.name).toBe('TelegramAPIError');
      expect(error.code).toBe('TELEGRAM_API_ERROR');
      expect(error.errorCode).toBe(400);
      expect(error.method).toBe('sendMessage');
      expect(error.isRetryable).toBe(false); // 4xx not retryable
    });

    test('should mark 5xx errors as retryable', () => {
      const error = new TelegramAPIError('Server error', 500, 'sendMessage');

      expect(error.isRetryable).toBe(true);
    });
  });

  describe('TelegramConfigError', () => {
    test('should create config error', () => {
      const error = new TelegramConfigError('Missing token', 'botToken');

      expect(error.name).toBe('TelegramConfigError');
      expect(error.code).toBe('TELEGRAM_CONFIG_ERROR');
      expect(error.configKey).toBe('botToken');
      expect(error.isRetryable).toBe(false);
      expect(error.isOperational).toBe(false); // System error
    });
  });
});

describe('TelegramErrorHandler', () => {
  describe('fromGrammyError()', () => {
    test('should return TelegramError as-is', () => {
      const original = new TelegramMessageError('Test', 123);
      const result = TelegramErrorHandler.fromGrammyError(original);

      expect(result).toBe(original);
    });

    test('should convert 403 bot blocked error', () => {
      const grammyError = {
        name: 'GrammyError',
        error_code: 403,
        description: 'bot was blocked by the user'
      };

      const result = TelegramErrorHandler.fromGrammyError(grammyError, { chatId: 123 });

      expect(result).toBeInstanceOf(TelegramBotBlockedError);
      expect(result.chatId).toBe(123);
    });

    test('should convert 403 forbidden error', () => {
      const grammyError = {
        name: 'GrammyError',
        error_code: 403,
        description: 'Forbidden: access denied'
      };

      const result = TelegramErrorHandler.fromGrammyError(grammyError, { companyId: 123 });

      expect(result).toBeInstanceOf(TelegramConnectionError);
    });

    test('should convert 429 rate limit error', () => {
      const grammyError = {
        name: 'GrammyError',
        error_code: 429,
        description: 'Too Many Requests',
        parameters: { retry_after: 30 }
      };

      const result = TelegramErrorHandler.fromGrammyError(grammyError);

      expect(result).toBeInstanceOf(TelegramRateLimitError);
      expect(result.retryAfter).toBe(30);
    });

    test('should convert 400 activity window error', () => {
      const grammyError = {
        name: 'GrammyError',
        error_code: 400,
        description: 'BUSINESS_REPLY_FORBIDDEN'
      };

      const result = TelegramErrorHandler.fromGrammyError(grammyError, { chatId: 123 });

      expect(result).toBeInstanceOf(TelegramActivityWindowError);
    });

    test('should convert 400 bad request error', () => {
      const grammyError = {
        name: 'GrammyError',
        error_code: 400,
        description: 'Bad Request: message is too long'
      };

      const result = TelegramErrorHandler.fromGrammyError(grammyError, { chatId: 123 });

      expect(result).toBeInstanceOf(TelegramMessageError);
    });

    test('should convert network error', () => {
      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };

      const result = TelegramErrorHandler.fromGrammyError(networkError, { companyId: 123 });

      expect(result).toBeInstanceOf(TelegramConnectionError);
    });

    test('should convert unknown error to generic TelegramError', () => {
      const unknownError = new Error('Something went wrong');

      const result = TelegramErrorHandler.fromGrammyError(unknownError);

      expect(result).toBeInstanceOf(TelegramError);
      expect(result.code).toBe('UNKNOWN');
    });
  });

  describe('isRetryable()', () => {
    test('should return true for retryable TelegramError', () => {
      const error = new TelegramConnectionError('Connection failed', 123);

      expect(TelegramErrorHandler.isRetryable(error)).toBe(true);
    });

    test('should return false for non-retryable TelegramError', () => {
      const error = new TelegramBotBlockedError('Blocked', 123);

      expect(TelegramErrorHandler.isRetryable(error)).toBe(false);
    });

    test('should return true for network errors', () => {
      const error = { code: 'ECONNREFUSED' };

      expect(TelegramErrorHandler.isRetryable(error)).toBe(true);
    });

    test('should return true for ETIMEDOUT', () => {
      const error = { code: 'ETIMEDOUT' };

      expect(TelegramErrorHandler.isRetryable(error)).toBe(true);
    });
  });

  describe('getRetryDelay()', () => {
    test('should use retryAfter for rate limit errors', () => {
      const error = new TelegramRateLimitError('Rate limited', 30);

      expect(TelegramErrorHandler.getRetryDelay(error)).toBe(30000);
    });

    test('should use exponential backoff for other errors', () => {
      const error = new TelegramConnectionError('Connection failed', 123);

      const delay1 = TelegramErrorHandler.getRetryDelay(error, 1);
      const delay2 = TelegramErrorHandler.getRetryDelay(error, 2);
      const delay3 = TelegramErrorHandler.getRetryDelay(error, 3);

      // Check exponential growth (with jitter)
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThan(2000);

      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThan(3000);

      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThan(5000);
    });

    test('should cap delay at maxDelay', () => {
      const error = new TelegramConnectionError('Connection failed', 123);

      const delay = TelegramErrorHandler.getRetryDelay(error, 10);

      // Max delay is 30000 + jitter
      expect(delay).toBeLessThanOrEqual(31000);
    });
  });

  describe('toResponse()', () => {
    test('should convert error to API response format', () => {
      const error = new TelegramMessageError('Send failed', 123);

      const response = TelegramErrorHandler.toResponse(error);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('TELEGRAM_MESSAGE_ERROR');
      expect(response.error.message).toBe('Send failed');
      expect(response.error.isRetryable).toBe(true);
    });

    test('should include retryAfter for rate limit errors', () => {
      const error = new TelegramRateLimitError('Rate limited', 30);

      const response = TelegramErrorHandler.toResponse(error);

      expect(response.error.retryAfter).toBe(30);
    });
  });

  describe('retry()', () => {
    test('should succeed on first attempt', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        return 'success';
      };

      const result = await TelegramErrorHandler.retry(operation);

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    test('should retry on retryable error', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new TelegramConnectionError('Failed', 123);
        }
        return 'success';
      };

      const result = await TelegramErrorHandler.retry(operation, {
        maxAttempts: 3
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should not retry on non-retryable error', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new TelegramBotBlockedError('Blocked', 123);
      };

      await expect(TelegramErrorHandler.retry(operation, {
        maxAttempts: 3
      })).rejects.toThrow(TelegramBotBlockedError);

      expect(attempts).toBe(1);
    });

    test('should call onError callback', async () => {
      const errors = [];
      const operation = async () => {
        throw new TelegramConnectionError('Failed', 123);
      };

      await expect(TelegramErrorHandler.retry(operation, {
        maxAttempts: 2,
        onError: (error, attempt) => {
          errors.push({ error, attempt });
        }
      })).rejects.toThrow();

      expect(errors.length).toBe(2);
      expect(errors[0].attempt).toBe(1);
      expect(errors[1].attempt).toBe(2);
    });

    test('should use custom shouldRetry function', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new TelegramBotBlockedError('Blocked', 123);
      };

      await expect(TelegramErrorHandler.retry(operation, {
        maxAttempts: 3,
        shouldRetry: () => true // Force retry even for non-retryable
      })).rejects.toThrow();

      expect(attempts).toBe(3);
    });
  });

  describe('getSentryTags()', () => {
    test('should return Sentry tags for error', () => {
      const error = new TelegramMessageError('Failed', 123, { companyId: 456 });

      const tags = TelegramErrorHandler.getSentryTags(error, { companyId: 456 });

      expect(tags['telegram.error_code']).toBe('TELEGRAM_MESSAGE_ERROR');
      expect(tags['telegram.error_name']).toBe('TelegramMessageError');
      expect(tags['telegram.retryable']).toBe('true');
      expect(tags['telegram.operational']).toBe('true');
      expect(tags['telegram.chat_id']).toBe('123');
    });

    test('should include API error code for API errors', () => {
      const error = new TelegramAPIError('Bad request', 400, 'sendMessage');

      const tags = TelegramErrorHandler.getSentryTags(error);

      expect(tags['telegram.api_error_code']).toBe('400');
      expect(tags['telegram.api_method']).toBe('sendMessage');
    });
  });

  describe('log()', () => {
    test('should log error with appropriate level', () => {
      const mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      };

      // System error - critical
      const configError = new TelegramConfigError('Missing token', 'botToken');
      TelegramErrorHandler.log(configError, mockLogger);
      expect(mockLogger.error).toHaveBeenCalled();

      // Retryable - warning
      const connError = new TelegramConnectionError('Failed', 123);
      TelegramErrorHandler.log(connError, mockLogger);
      expect(mockLogger.warn).toHaveBeenCalled();

      // Non-retryable operational - info
      const blockedError = new TelegramBotBlockedError('Blocked', 123);
      TelegramErrorHandler.log(blockedError, mockLogger);
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });
});
