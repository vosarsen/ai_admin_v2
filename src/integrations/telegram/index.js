/**
 * Telegram Integration Module
 *
 * Exports all Telegram-related components:
 * - telegramBot: grammY bot client (low-level)
 * - telegramManager: High-level manager with connection handling
 * - telegramApiClient: HTTP client for workers
 */

const telegramBot = require('./telegram-bot');
const telegramManager = require('./telegram-manager');
const telegramApiClient = require('./telegram-api-client');

module.exports = {
  telegramBot,
  telegramManager,
  telegramApiClient
};
