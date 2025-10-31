// src/api/routes/cache-stats.js
const express = require('express');
const router = express.Router();
const localCache = require('../../utils/local-cache');
const cachedDataLoader = require('../../services/ai-admin-v2/modules/cached-data-loader');
const { validateApiKey } = require('../../middlewares/webhook-auth');
const logger = require('../../utils/logger').child({ module: 'cache-stats-api' });

/**
 * API endpoints для мониторинга кэша
 */

// Получить статистику кэша
router.get('/stats', validateApiKey, (req, res) => {
  try {
    const stats = localCache.getStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Очистить кэш
router.post('/flush', validateApiKey, (req, res) => {
  try {
    const { cacheType } = req.body;
    
    if (cacheType) {
      localCache.flush(cacheType);
      logger.info(`Cache flushed: ${cacheType}`);
    } else {
      localCache.flush();
      logger.info('All caches flushed');
    }
    
    res.json({
      success: true,
      message: cacheType ? `Cache ${cacheType} flushed` : 'All caches flushed'
    });
  } catch (error) {
    logger.error('Error flushing cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Инвалидировать конкретный ключ
router.delete('/key', validateApiKey, (req, res) => {
  try {
    const { cacheType, key } = req.body;
    
    if (!cacheType || !key) {
      return res.status(400).json({
        success: false,
        error: 'Both cacheType and key are required'
      });
    }
    
    const deleted = localCache.delete(cacheType, key);
    
    res.json({
      success: true,
      deleted,
      message: deleted ? 'Key deleted' : 'Key not found'
    });
  } catch (error) {
    logger.error('Error deleting cache key:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Инвалидировать связанные данные
router.post('/invalidate', validateApiKey, (req, res) => {
  try {
    const { entityType, entityId, companyId } = req.body;
    
    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'Both entityType and entityId are required'
      });
    }
    
    // Инвалидируем через data loader
    cachedDataLoader.invalidateCache(entityType, entityId, companyId);
    
    res.json({
      success: true,
      message: `Invalidated cache for ${entityType}:${entityId}`
    });
  } catch (error) {
    logger.error('Error invalidating cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получить все ключи определенного типа кэша
router.get('/keys/:cacheType', validateApiKey, (req, res) => {
  try {
    const { cacheType } = req.params;
    
    if (!localCache.caches[cacheType]) {
      return res.status(400).json({
        success: false,
        error: `Unknown cache type: ${cacheType}`
      });
    }
    
    const keys = localCache.caches[cacheType].keys();
    
    res.json({
      success: true,
      cacheType,
      count: keys.length,
      keys
    });
  } catch (error) {
    logger.error('Error getting cache keys:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;