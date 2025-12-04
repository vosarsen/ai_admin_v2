// src/api/routes/health.js
// Migrated from Supabase to PostgreSQL (2025-11-26)
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createRedisClient } = require('../../utils/redis-factory');
const postgres = require('../../database/postgres');
const logger = require('../../utils/logger');
const config = require('../../config');
const { checkSessionHealth } = require('../../integrations/whatsapp/auth-state-timeweb');

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
 * WhatsApp session health check
 * Monitors WhatsApp session keys and database storage
 */
router.get('/health/whatsapp', async (req, res) => {
  try {
    const health = await checkSessionHealth();

    // Set HTTP status based on health status
    let httpStatus = 200;
    if (health.status === 'critical') {
      httpStatus = 503; // Service Unavailable
    } else if (health.status === 'error') {
      httpStatus = 500; // Internal Server Error
    } else if (health.status === 'warning') {
      httpStatus = 200; // OK but with warnings
    }

    res.status(httpStatus).json({
      ...health,
      recommendations: getHealthRecommendations(health)
    });

  } catch (error) {
    logger.error('WhatsApp health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get recommendations based on health status
 */
function getHealthRecommendations(health) {
  const recommendations = [];

  if (health.status === 'critical') {
    recommendations.push('Run cleanup script immediately: node scripts/cleanup-whatsapp-keys.js');
    recommendations.push('Check Sentry for related errors');
  } else if (health.status === 'warning') {
    recommendations.push('Schedule cleanup soon: node scripts/cleanup-whatsapp-keys.js');
  } else if (health.status === 'healthy') {
    recommendations.push('System is healthy - no action needed');
  }

  if (health.expired_keys > 0) {
    recommendations.push(`Clean up ${health.expired_keys} expired keys to free database space`);
  }

  return recommendations;
}

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
    const startTime = Date.now();
    await postgres.query('SELECT 1');
    const responseTime = Date.now() - startTime;

    return {
      status: 'ok',
      connected: true,
      responseTime: responseTime < 100 ? 'fast' : responseTime < 500 ? 'normal' : 'slow',
      responseTimeMs: responseTime,
      backend: 'postgres'
    };
  } catch (error) {
    return {
      status: 'error',
      connected: false,
      error: error.message,
      backend: 'postgres'
    };
  }
}

async function checkWhatsApp() {
  try {
    // Check if running in Baileys standalone mode
    const isStandalone = process.env.BAILEYS_STANDALONE === 'true';
    const baileysServiceUrl = process.env.BAILEYS_SERVICE_URL || 'http://localhost:3003';

    if (isStandalone) {
      // For Baileys standalone, check the dedicated service
      try {
        const companyId = config.company?.id || '962302';

        // Try checking status endpoint first (faster)
        try {
          const statusResponse = await axios.get(`${baileysServiceUrl}/status/${companyId}`, {
            timeout: 5000,
            validateStatus: () => true
          });

          if (statusResponse.status === 200 && statusResponse.data?.connected) {
            return {
              status: 'ok',
              connected: true,
              message: 'Baileys service connected',
              mode: 'standalone'
            };
          }
        } catch (statusError) {
          // Status endpoint failed, try send test
        }

        // Fallback: try test message with higher timeout
        const testResponse = await axios.post('http://localhost:3000/api/whatsapp/sessions/962302/send', {
          phone: '79000000000',
          message: 'health_check_test',
          dryRun: true
        }, {
          timeout: 5000,
          validateStatus: () => true
        });

        // If API responds at all, WhatsApp is probably working
        if (testResponse.status === 200 || testResponse.status === 400) {
          return {
            status: 'ok',
            connected: true,
            message: 'WhatsApp API responding',
            mode: 'standalone'
          };
        }

        return {
          status: 'warning',
          connected: false,
          message: 'Baileys service not responding',
          mode: 'standalone'
        };
      } catch (apiError) {
        return {
          status: 'warning',
          connected: false,
          message: `Baileys check failed: ${apiError.message}`,
          mode: 'standalone'
        };
      }
    }

    // Non-standalone mode: check sessionPool
    let sessionPool = global.whatsappSessionPool;

    if (!sessionPool) {
      // Try API check as fallback
      try {
        const testResponse = await axios.post('http://localhost:3000/api/whatsapp/sessions/962302/send', {
          phone: '79000000000',
          message: 'health_check_test',
          dryRun: true
        }, {
          timeout: 5000,
          validateStatus: () => true
        });

        if (testResponse.status === 200 || testResponse.status === 400) {
          return {
            status: 'ok',
            connected: true,
            message: 'WhatsApp API responding',
            mode: 'integrated'
          };
        }
      } catch (apiError) {
        // Continue to file check
      }

      // Check for session files
      const fs = require('fs');
      const path = require('path');
      const sessionsPath = path.join(process.cwd(), 'sessions');

      if (fs.existsSync(sessionsPath)) {
        const sessionDirs = fs.readdirSync(sessionsPath).filter(dir => dir.startsWith('company_'));
        if (sessionDirs.length > 0) {
          return {
            status: 'ok',
            connected: true,
            message: `Found ${sessionDirs.length} session(s)`,
            mode: 'integrated'
          };
        }
      }

      return {
        status: 'warning',
        connected: false,
        message: 'Cannot verify WhatsApp status',
        mode: 'integrated'
      };
    }

    const companyId = config.company?.id || '962302';
    const session = sessionPool.sessions.get(companyId);

    if (!session || !session.sock) {
      return {
        status: 'error',
        connected: false,
        message: 'No active session',
        mode: 'integrated'
      };
    }

    const state = session.sock.user ? 'connected' : 'disconnected';

    return {
      status: state === 'connected' ? 'ok' : 'error',
      connected: state === 'connected',
      phoneNumber: session.sock.user?.id?.split(':')[0] || 'unknown',
      mode: 'integrated'
    };
  } catch (error) {
    return {
      status: 'warning',
      connected: false,
      message: 'Check failed: ' + error.message
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

  // Thresholds for 4GB server
  const RSS_WARNING_MB = 800;
  const RSS_CRITICAL_MB = 1500;

  let status = 'ok';
  if (rssMB > RSS_CRITICAL_MB) {
    status = 'error';
  } else if (rssMB > RSS_WARNING_MB) {
    status = 'warning';
  }

  return {
    status,
    heapUsedMB,
    heapTotalMB,
    rssMB,
    // RSS percentage of 4GB total server RAM (more meaningful than heap ratio)
    rssPercentOfServer: Math.round((rssMB / 4096) * 100),
    // Keep old field for backwards compatibility, but now based on RSS
    percentage: Math.round((rssMB / 4096) * 100)
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
    const validTimestamps = timestamps
      .map(t => parseInt(t))
      .filter(t => !isNaN(t) && t > 0);

    if (validTimestamps.length === 0) {
      return {
        status: 'warning',
        message: 'No valid timestamps found',
        activeChats: lastMsgKeys.length
      };
    }

    const mostRecent = Math.max(...validTimestamps);
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
    const result = await postgres.query(
      `SELECT created_at, from_phone, message_text
       FROM messages
       WHERE company_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [companyId, limit]
    );

    return result.rows.map(msg => ({
      time: msg.created_at,
      from: msg.from_phone,
      preview: msg.message_text?.substring(0, 50)
    }));
  } catch (error) {
    // Table might not exist
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

/**
 * Redis Pub/Sub Health Check
 * Tests the complete pub/sub flow between baileys-service and ai-admin-api
 *
 * POST /health/pubsub
 *
 * Flow:
 * 1. Publish test ping to whatsapp:events channel
 * 2. Wait for pong response on whatsapp:health channel
 * 3. Return 200 if response received within timeout, 503 otherwise
 */
router.get('/health/pubsub', async (req, res) => {
  const startTime = Date.now();
  const timeout = parseInt(req.query.timeout) || 5000; // Default 5 seconds

  // Create dedicated publisher for this health check
  let publisher = null;
  let subscriber = null;

  try {
    publisher = createRedisClient('health-pubsub-publisher');
    subscriber = createRedisClient('health-pubsub-subscriber');

    // Generate unique test ID
    const testId = `ping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Set up promise to wait for pong response
    const receivePromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for pubsub response'));
      }, timeout);

      subscriber.subscribe('whatsapp:health', (err) => {
        if (err) {
          clearTimeout(timeoutId);
          reject(err);
        }
      });

      subscriber.on('message', (channel, message) => {
        if (channel === 'whatsapp:health') {
          try {
            const event = JSON.parse(message);
            if (event.type === 'pong' && event.testId === testId) {
              clearTimeout(timeoutId);
              resolve({
                latencyMs: Date.now() - startTime,
                testId
              });
            }
          } catch (e) {
            // Ignore malformed messages
          }
        }
      });
    });

    // Publish test ping
    await publisher.publish('whatsapp:events', JSON.stringify({
      type: 'ping',
      testId,
      timestamp: Date.now()
    }));

    logger.debug('🏓 Published health ping:', { testId });

    // Wait for response
    const result = await receivePromise;

    // Success
    res.json({
      status: 'healthy',
      pubsub: 'working',
      latencyMs: result.latencyMs,
      testId: result.testId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.warn('Redis Pub/Sub health check failed:', error.message);

    // Check if it's a timeout vs other error
    const isTimeout = error.message.includes('Timeout');

    res.status(503).json({
      status: 'unhealthy',
      pubsub: isTimeout ? 'timeout' : 'error',
      error: error.message,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      suggestion: isTimeout
        ? 'baileys-service may not be responding to ping events'
        : 'Check Redis connection and configuration'
    });

  } finally {
    // Clean up Redis connections
    try {
      if (publisher) await publisher.quit();
      if (subscriber) await subscriber.quit();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
});

/**
 * Simple Redis Pub/Sub connectivity check (without ping/pong)
 * Just verifies Redis channel subscription works
 *
 * GET /health/pubsub/simple
 */
router.get('/health/pubsub/simple', async (req, res) => {
  const startTime = Date.now();
  let redisClient = null;

  try {
    redisClient = createRedisClient('health-pubsub-simple');

    // Test basic pub/sub capability
    const testId = `test_${Date.now()}`;

    // Subscribe and immediately receive our own message
    const receivePromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout'));
      }, 3000);

      redisClient.subscribe('whatsapp:health-test', (err) => {
        if (err) {
          clearTimeout(timeoutId);
          reject(err);
        }
      });

      redisClient.on('message', (channel, message) => {
        if (channel === 'whatsapp:health-test') {
          try {
            const event = JSON.parse(message);
            if (event.testId === testId) {
              clearTimeout(timeoutId);
              resolve(event);
            }
          } catch (e) {
            // Ignore
          }
        }
      });
    });

    // Create separate client for publish (can't publish from subscriber)
    const pubClient = createRedisClient('health-pubsub-simple-pub');
    await pubClient.publish('whatsapp:health-test', JSON.stringify({
      type: 'self-test',
      testId,
      timestamp: Date.now()
    }));
    await pubClient.quit();

    // Wait for self-message
    await receivePromise;

    res.json({
      status: 'healthy',
      redis_pubsub: 'working',
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      redis_pubsub: 'error',
      error: error.message,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

  } finally {
    try {
      if (redisClient) await redisClient.quit();
    } catch (e) {
      // Ignore
    }
  }
});

module.exports = router;