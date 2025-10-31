/**
 * Context Service Redirect
 * 
 * This file redirects all old context imports to the new v2 system.
 * The old context system has been completely replaced by context-service-v2.
 * 
 * Migration completed: 2025-08-26
 */

// Экспортируем v2 сервис для обратной совместимости
module.exports = require('./context-service-v2');