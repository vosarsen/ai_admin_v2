/**
 * Telegram Integration Module
 *
 * Exports all Telegram-related components:
 * - telegramBot: grammY bot client (low-level)
 * - telegramManager: High-level manager with connection handling
 * - telegramApiClient: HTTP client for workers
 * - telegramRateLimiter: Rate limiting for Telegram API
 */

const telegramBot = require('./telegram-bot');
const telegramManager = require('./telegram-manager');
const telegramApiClient = require('./telegram-api-client');
const telegramRateLimiter = require('./telegram-rate-limiter');

module.exports = {
  telegramBot,
  telegramManager,
  telegramApiClient,
  telegramRateLimiter
};
