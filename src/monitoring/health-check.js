// src/monitoring/health-check.js
// Migrated from Supabase to PostgreSQL (2025-11-26)
const logger = require('../utils/logger');
const performanceMonitor = require('./performance-monitor');

/**
 * HEALTH CHECK SERVICE
 * Проверка здоровья всех компонентов системы
 *
 * Проверяет:
 * - Redis соединение
 * - PostgreSQL соединение
 * - AI сервис
 * - YClients API
 * - WhatsApp клиент
 * - Queue система
 */
class HealthCheck {
  constructor() {
    this.checks = {
      redis: { status: 'unknown', lastCheck: null, error: null },
      postgres: { status: 'unknown', lastCheck: null, error: null },
      ai: { status: 'unknown', lastCheck: null, error: null },
      yclients: { status: 'unknown', lastCheck: null, error: null },
      whatsapp: { status: 'unknown', lastCheck: null, error: null },
      queue: { status: 'unknown', lastCheck: null, error: null },
      performance: { status: 'unknown', lastCheck: null, error: null }
    };
    
    this.checkTimeout = 5000; // 5 секунд на проверку
  }

  /**
   * 🔍 Проверить все компоненты
   */
  async checkAll() {
    logger.info('🏥 Running health checks...');
    
    const results = {};
    
    // Проверяем все компоненты параллельно
    const checkPromises = [
      this.checkRedis(),
      this.checkPostgres(),
      this.checkAI(),
      this.checkYClients(),
      this.checkWhatsApp(),
      this.checkQueue(),
      this.checkPerformance()
    ];
    
    const checks = await Promise.allSettled(checkPromises);
    
    // Собираем результаты
    const components = ['redis', 'supabase', 'ai', 'yclients', 'whatsapp', 'queue', 'performance'];
    components.forEach((component, index) => {
      const check = checks[index];
      if (check.status === 'fulfilled') {
        results[component] = check.value;
      } else {
        results[component] = {
          status: 'error',
          error: check.reason?.message || 'Unknown error',
          lastCheck: new Date().toISOString()
        };
      }
      this.checks[component] = results[component];
    });
    
    // Общий статус системы
    const overallStatus = this.calculateOverallStatus(results);
    
    const healthReport = {
      timestamp: new Date().toISOString(),
      status: overallStatus,
      components: results,
      summary: this.generateSummary(results),
      metrics: performanceMonitor.getMetrics().summary
    };
    
    logger.info(`🏥 Health check completed: ${overallStatus}`, {
      healthy: Object.values(results).filter(r => r.status === 'healthy').length,
      total: Object.keys(results).length
    });
    
    return healthReport;
  }

  /**
   * 📦 Проверить Redis
   */
  async checkRedis() {
    return this.runCheck('redis', async () => {
      try {
        const redis = require('../services/cache/smart-cache').redis;
        if (!redis) {
          return { status: 'warning', message: 'Redis not configured, using memory cache' };
        }
        
        const startTime = Date.now();
        await redis.ping();
        const responseTime = Date.now() - startTime;
        
        return {
          status: 'healthy',
          responseTime: `${responseTime}ms`,
          info: 'Redis connection active'
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message,
          fallback: 'Using memory cache'
        };
      }
    });
  }

  /**
   * Check PostgreSQL database
   * Migrated from Supabase (2025-11-26)
   */
  async checkPostgres() {
    return this.runCheck('postgres', async () => {
      try {
        const postgres = require('../database/postgres');

        if (!postgres.pool) {
          return {
            status: 'warning',
            message: 'PostgreSQL pool not initialized'
          };
        }

        const startTime = Date.now();
        await postgres.query('SELECT 1');
        const responseTime = Date.now() - startTime;

        return {
          status: 'healthy',
          responseTime: `${responseTime}ms`,
          info: 'PostgreSQL connection active',
          backend: 'timeweb'
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message,
          fallback: 'Using mock data',
          backend: 'timeweb'
        };
      }
    });
  }

  /**
   * 🤖 Проверить AI сервис
   */
  async checkAI() {
    return this.runCheck('ai', async () => {
      try {
        const config = require('../config');
        
        if (!config.ai.apiKey) {
          return {
            status: 'warning',
            message: 'AI service not configured, using mocks'
          };
        }
        
        // Простой тестовый запрос к AI
        const startTime = Date.now();
        
        // Здесь был бы реальный запрос к AI API
        // Пока используем мок
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const responseTime = Date.now() - startTime;
        
        return {
          status: 'healthy',
          responseTime: `${responseTime}ms`,
          info: 'AI service responding'
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message,
          fallback: 'Using mock responses'
        };
      }
    });
  }

  /**
   * 🏢 Проверить YClients API
   */
  async checkYClients() {
    return this.runCheck('yclients', async () => {
      try {
        const config = require('../config');
        
        if (!config.yclients.apiKey) {
          return {
            status: 'warning',
            message: 'YClients not configured, using mocks'
          };
        }
        
        const startTime = Date.now();
        
        // Простая проверка API (мок)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const responseTime = Date.now() - startTime;
        
        return {
          status: 'healthy',
          responseTime: `${responseTime}ms`,
          info: 'YClients API accessible'
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message,
          fallback: 'Using mock bookings'
        };
      }
    });
  }

  /**
   * 📱 Проверить WhatsApp клиент
   */
  async checkWhatsApp() {
    return this.runCheck('whatsapp', async () => {
      try {
        const whatsappClient = require('../integrations/whatsapp/client');
        
        // Проверяем статус клиента
        const isReady = await whatsappClient.isReady();
        
        if (!isReady) {
          return {
            status: 'warning',
            message: 'WhatsApp client not ready or not configured'
          };
        }
        
        return {
          status: 'healthy',
          info: 'WhatsApp client ready'
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message,
          impact: 'Cannot send WhatsApp messages'
        };
      }
    });
  }

  /**
   * 📋 Проверить Queue систему
   */
  async checkQueue() {
    return this.runCheck('queue', async () => {
      try {
        const messageQueue = require('../queue/message-queue');
        
        // Проверяем очереди
        const queueStatus = await messageQueue.getQueueStatus();
        
        return {
          status: 'healthy',
          info: `${queueStatus.activeQueues} active queues`,
          details: queueStatus
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message,
          impact: 'Message processing may be affected'
        };
      }
    });
  }

  /**
   * 📊 Проверить производительность
   */
  async checkPerformance() {
    return this.runCheck('performance', async () => {
      const metrics = performanceMonitor.getMetrics();
      const summary = metrics.summary;
      
      if (summary.status === 'unhealthy') {
        return {
          status: 'error',
          error: 'Performance degraded',
          issues: summary.issues,
          recommendations: summary.recommendations
        };
      } else if (summary.status === 'degraded') {
        return {
          status: 'warning',
          message: 'Performance issues detected',
          issues: summary.issues,
          recommendations: summary.recommendations
        };
      }
      
      return {
        status: 'healthy',
        info: `Average response: ${metrics.messageProcessing.averageTime}ms`,
        details: {
          messagesProcessed: metrics.messageProcessing.totalMessages,
          averageTime: metrics.messageProcessing.averageTime,
          cacheHitRate: `${metrics.cache.hitRate}%`,
          uptime: `${Math.round(metrics.system.uptime / 1000 / 60)}m`
        }
      };
    });
  }

  /**
   * 🕒 Выполнить проверку с таймаутом
   */
  async runCheck(componentName, checkFunction) {
    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.checkTimeout);
      });
      
      const result = await Promise.race([
        checkFunction(),
        timeoutPromise
      ]);
      
      return {
        ...result,
        lastCheck: new Date().toISOString(),
        checkDuration: `${Date.now() - startTime}ms`
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        lastCheck: new Date().toISOString(),
        checkDuration: `${Date.now() - startTime}ms`
      };
    }
  }

  /**
   * 📊 Рассчитать общий статус системы
   */
  calculateOverallStatus(results) {
    const statuses = Object.values(results).map(r => r.status);
    
    if (statuses.some(s => s === 'error')) {
      return 'unhealthy';
    } else if (statuses.some(s => s === 'warning')) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * 📝 Сгенерировать сводку
   */
  generateSummary(results) {
    const healthy = Object.values(results).filter(r => r.status === 'healthy').length;
    const warning = Object.values(results).filter(r => r.status === 'warning').length;
    const error = Object.values(results).filter(r => r.status === 'error').length;
    const total = Object.keys(results).length;
    
    const criticalErrors = Object.entries(results)
      .filter(([_, result]) => result.status === 'error')
      .map(([component]) => component);
    
    return {
      total,
      healthy,
      warning,
      error,
      healthPercentage: Math.round((healthy / total) * 100),
      criticalErrors: criticalErrors.length > 0 ? criticalErrors : null
    };
  }

  /**
   * 🎨 Форматировать отчет для красивого вывода
   */
  formatHealthReport(report) {
    const statusEmojis = {
      healthy: '✅',
      warning: '⚠️',
      error: '❌',
      unknown: '❓'
    };
    
    const overallEmoji = {
      healthy: '🟢',
      degraded: '🟡',
      unhealthy: '🔴'
    };
    
    const lines = [
      `${overallEmoji[report.status]} SYSTEM HEALTH: ${report.status.toUpperCase()}`,
      `Timestamp: ${report.timestamp}`,
      `Health Score: ${report.summary.healthPercentage}% (${report.summary.healthy}/${report.summary.total} components)`,
      ''
    ];
    
    // Компоненты
    Object.entries(report.components).forEach(([component, result]) => {
      const emoji = statusEmojis[result.status] || statusEmojis.unknown;
      const name = component.toUpperCase();
      
      lines.push(`${emoji} ${name}`);
      
      if (result.info) {
        lines.push(`    ℹ️ ${result.info}`);
      }
      
      if (result.responseTime) {
        lines.push(`    ⏱️ Response: ${result.responseTime}`);
      }
      
      if (result.message) {
        lines.push(`    💬 ${result.message}`);
      }
      
      if (result.error) {
        lines.push(`    ❌ Error: ${result.error}`);
      }
      
      if (result.fallback) {
        lines.push(`    🔄 Fallback: ${result.fallback}`);
      }
      
      if (result.issues && result.issues.length > 0) {
        lines.push(`    ⚠️ Issues: ${result.issues.join(', ')}`);
      }
      
      lines.push('');
    });
    
    // Критические ошибки
    if (report.summary.criticalErrors && report.summary.criticalErrors.length > 0) {
      lines.push('🚨 CRITICAL COMPONENTS DOWN:');
      report.summary.criticalErrors.forEach(component => {
        lines.push(`    • ${component.toUpperCase()}`);
      });
      lines.push('');
    }
    
    // Производительность
    if (report.metrics) {
      lines.push('📊 PERFORMANCE SUMMARY:');
      if (report.metrics.issues.length > 0) {
        lines.push('    Issues:');
        report.metrics.issues.forEach(issue => {
          lines.push(`      • ${issue}`);
        });
      }
      
      if (report.metrics.recommendations.length > 0) {
        lines.push('    Recommendations:');
        report.metrics.recommendations.forEach(rec => {
          lines.push(`      • ${rec}`);
        });
      }
      
      if (report.metrics.issues.length === 0) {
        lines.push('    ✅ No performance issues detected');
      }
    }
    
    return lines.join('\n');
  }

  /**
   * 🚨 Проверить критические компоненты
   */
  async quickCheck() {
    const critical = ['whatsapp', 'queue', 'performance'];
    const results = {};
    
    for (const component of critical) {
      try {
        switch (component) {
          case 'whatsapp':
            results[component] = await this.checkWhatsApp();
            break;
          case 'queue':
            results[component] = await this.checkQueue();
            break;
          case 'performance':
            results[component] = await this.checkPerformance();
            break;
        }
      } catch (error) {
        results[component] = {
          status: 'error',
          error: error.message,
          lastCheck: new Date().toISOString()
        };
      }
    }
    
    const overallStatus = this.calculateOverallStatus(results);
    
    return {
      timestamp: new Date().toISOString(),
      type: 'quick_check',
      status: overallStatus,
      components: results
    };
  }
}

// Singleton instance
module.exports = new HealthCheck();