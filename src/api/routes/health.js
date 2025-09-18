// src/api/routes/health.js
const express = require('express');
const router = express.Router();
const { createRedisClient } = require('../../utils/redis-factory');
const { supabase } = require('../../database/supabase');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * Health check endpoint для мониторинга системы
 * Проверяет все критические компоненты
 */
router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  try {
    // 1. Проверка Redis
    const redisCheck = await checkRedis();
    health.checks.redis = redisCheck;

    // 2. Проверка базы данных
    const dbCheck = await checkDatabase();
    health.checks.database = dbCheck;

    // 3. Проверка WhatsApp сессии
    const whatsappCheck = await checkWhatsApp();
    health.checks.whatsapp = whatsappCheck;

    // 4. Проверка очереди сообщений
    const queueCheck = await checkMessageQueue();
    health.checks.queue = queueCheck;

    // 5. Проверка памяти
    const memoryCheck = checkMemory();
    health.checks.memory = memoryCheck;

    // 6. Проверка последней активности
    const activityCheck = await checkLastActivity();
    health.checks.lastActivity = activityCheck;

    // Определяем общий статус
    const allChecks = Object.values(health.checks);
    if (allChecks.some(check => check.status === 'error')) {
      health.status = 'error';
      res.status(503);
    } else if (allChecks.some(check => check.status === 'warning')) {
      health.status = 'warning';
      res.status(200);
    } else {
      res.status(200);
    }

    res.json(health);

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Детальная проверка для конкретной компании
 */
router.get('/health/company/:companyId', async (req, res) => {
  const { companyId } = req.params;

  try {
    const health = {
      companyId,
      status: 'ok',
      timestamp: new Date().toISOString(),
      whatsapp: await checkCompanyWhatsApp(companyId),
      lastMessages: await getLastMessages(companyId),
      queueSize: await getCompanyQueueSize(companyId),
      errors24h: await getCompanyErrors(companyId)
    };

    res.json(health);
  } catch (error) {
    logger.error(`Health check failed for company ${companyId}:`, error);
    res.status(503).json({
      status: 'error',
      companyId,
      error: error.message
    });
  }
});

// Вспомогательные функции проверки

async function checkRedis() {
  const redis = createRedisClient('health-check');
  try {
    await redis.ping();
    const dbSize = await redis.dbsize();
    await redis.quit();

    return {
      status: 'ok',
      connected: true,
      keys: dbSize
    };
  } catch (error) {
    return {
      status: 'error',
      connected: false,
      error: error.message
    };
  }
}

async function checkDatabase() {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    if (error) throw error;

    return {
      status: 'ok',
      connected: true,
      responseTime: 'fast'
    };
  } catch (error) {
    return {
      status: 'error',
      connected: false,
      error: error.message
    };
  }
}

async function checkWhatsApp() {
  try {
    const sessionPool = global.whatsappSessionPool;
    if (!sessionPool) {
      return {
        status: 'warning',
        message: 'Session pool not initialized'
      };
    }

    const companyId = config.company?.id || '962302';
    const session = sessionPool.sessions.get(companyId);

    if (!session || !session.sock) {
      return {
        status: 'error',
        connected: false,
        message: 'No active session'
      };
    }

    const state = session.sock.user ? 'connected' : 'disconnected';

    return {
      status: state === 'connected' ? 'ok' : 'error',
      connected: state === 'connected',
      phoneNumber: session.sock.user?.id?.split(':')[0] || 'unknown'
    };
  } catch (error) {
    return {
      status: 'error',
      connected: false,
      error: error.message
    };
  }
}

async function checkMessageQueue() {
  const redis = createRedisClient('health-check-queue');
  try {
    const queueKeys = await redis.keys('bull:company-*-messages:*');
    const rapidFireKeys = await redis.keys('rapid-fire:*');

    await redis.quit();

    return {
      status: queueKeys.length > 100 ? 'warning' : 'ok',
      totalJobs: queueKeys.length,
      pendingBatches: rapidFireKeys.length
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

function checkMemory() {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);

  return {
    status: rssMB > 500 ? 'warning' : 'ok',
    heapUsedMB,
    heapTotalMB,
    rssMB,
    percentage: Math.round((usage.heapUsed / usage.heapTotal) * 100)
  };
}

async function checkLastActivity() {
  const redis = createRedisClient('health-check-activity');
  try {
    // Получаем последние сообщения
    const lastMsgKeys = await redis.keys('last-msg:*');
    if (lastMsgKeys.length === 0) {
      await redis.quit();
      return {
        status: 'warning',
        message: 'No recent activity'
      };
    }

    // Проверяем время последнего сообщения
    const timestamps = await Promise.all(
      lastMsgKeys.slice(0, 5).map(key => redis.get(key))
    );

    await redis.quit();

    const now = Date.now();
    const mostRecent = Math.max(...timestamps.map(t => parseInt(t) || 0));
    const minutesAgo = Math.round((now - mostRecent) / 1000 / 60);

    return {
      status: minutesAgo > 60 ? 'warning' : 'ok',
      lastMessageMinutesAgo: minutesAgo,
      activeChats: lastMsgKeys.length
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

async function checkCompanyWhatsApp(companyId) {
  const sessionPool = global.whatsappSessionPool;
  if (!sessionPool) return { connected: false };

  const session = sessionPool.sessions.get(companyId);
  if (!session || !session.sock) return { connected: false };

  return {
    connected: !!session.sock.user,
    phoneNumber: session.sock.user?.id?.split(':')[0] || 'unknown'
  };
}

async function getLastMessages(companyId, limit = 5) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('created_at, from_phone, message_text')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(msg => ({
      time: msg.created_at,
      from: msg.from_phone,
      preview: msg.message_text?.substring(0, 50)
    }));
  } catch (error) {
    return [];
  }
}

async function getCompanyQueueSize(companyId) {
  const redis = createRedisClient('health-check-company');
  try {
    const keys = await redis.keys(`bull:company-${companyId}-messages:*`);
    await redis.quit();
    return keys.length;
  } catch (error) {
    return 0;
  }
}

async function getCompanyErrors(companyId) {
  // Здесь можно добавить подсчёт ошибок из логов
  // Пока возвращаем заглушку
  return {
    count: 0,
    lastError: null
  };
}

module.exports = router;