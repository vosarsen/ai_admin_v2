// src/monitoring/index.js
const performanceMonitor = require('./performance-monitor');
const healthCheck = require('./health-check');
const logger = require('../utils/logger');

/**
 * 📊 MONITORING SERVICE
 * Единая точка входа для всех функций мониторинга
 */
class MonitoringService {
  constructor() {
    this.isStarted = false;
    this.intervals = {};
  }

  /**
   * 🚀 Запустить мониторинг
   */
  start() {
    if (this.isStarted) {
      logger.warn('Monitoring service already started');
      return;
    }

    logger.info('🚀 Starting monitoring service...');

    // Периодические health checks каждые 5 минут
    this.intervals.healthCheck = setInterval(async () => {
      try {
        const report = await healthCheck.checkAll();
        
        if (report.status !== 'healthy') {
          logger.warn('🏥 Health check detected issues:', {
            status: report.status,
            issues: report.summary.criticalErrors
          });
        }
        
        // Логируем краткую сводку
        logger.info('🏥 Health check completed:', {
          status: report.status,
          healthScore: `${report.summary.healthPercentage}%`,
          components: `${report.summary.healthy}/${report.summary.total}`
        });
        
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 5 * 60 * 1000); // 5 минут

    // Логирование метрик производительности каждые 2 минуты
    this.intervals.metricsLog = setInterval(() => {
      try {
        const metrics = performanceMonitor.getMetrics();
        
        logger.info('📊 Performance metrics:', {
          messages: {
            total: metrics.messageProcessing.totalMessages,
            avgTime: `${metrics.messageProcessing.averageTime}ms`,
            errorRate: `${Math.round((metrics.messageProcessing.errors / Math.max(metrics.messageProcessing.totalMessages, 1)) * 100)}%`
          },
          cache: {
            hitRate: `${metrics.cache.hitRate}%`,
            requests: metrics.cache.totalRequests
          },
          ai: {
            requests: metrics.ai.totalRequests,
            avgTime: `${metrics.ai.averageTime}ms`
          },
          system: {
            uptime: `${Math.round(metrics.system.uptime / 1000 / 60)}m`,
            memory: `${metrics.system.memoryUsage.heapUsed}MB`
          },
          status: metrics.summary.status
        });
        
        // Предупреждения о проблемах производительности
        if (metrics.summary.issues.length > 0) {
          logger.warn('⚠️ Performance issues detected:', {
            issues: metrics.summary.issues,
            recommendations: metrics.summary.recommendations
          });
        }
        
      } catch (error) {
        logger.error('Failed to log metrics:', error);
      }
    }, 2 * 60 * 1000); // 2 минуты

    this.isStarted = true;
    logger.info('✅ Monitoring service started');
  }

  /**
   * 🛑 Остановить мониторинг
   */
  stop() {
    if (!this.isStarted) {
      return;
    }

    logger.info('🛑 Stopping monitoring service...');

    // Очищаем все интервалы
    Object.values(this.intervals).forEach(interval => {
      clearInterval(interval);
    });
    
    this.intervals = {};

    // Очищаем мониторы
    performanceMonitor.cleanup();

    this.isStarted = false;
    logger.info('✅ Monitoring service stopped');
  }

  /**
   * 📊 Получить полный отчет о состоянии системы
   */
  async getFullReport() {
    logger.info('📊 Generating full system report...');

    try {
      const [healthReport, metrics] = await Promise.all([
        healthCheck.checkAll(),
        Promise.resolve(performanceMonitor.getMetrics())
      ]);

      const fullReport = {
        timestamp: new Date().toISOString(),
        overview: {
          systemStatus: healthReport.status,
          performanceStatus: metrics.summary.status,
          healthScore: `${healthReport.summary.healthPercentage}%`,
          uptime: `${Math.round(metrics.system.uptime / 1000 / 60)}m`
        },
        health: healthReport,
        performance: {
          current: metrics,
          lastHour: performanceMonitor.getTimeRangeStats(60),
          slowOperations: performanceMonitor.getSlowOperations(),
          problemNumbers: performanceMonitor.getTopProblemNumbers()
        },
        recommendations: this.generateRecommendations(healthReport, metrics)
      };

      logger.info('✅ Full report generated');
      return fullReport;

    } catch (error) {
      logger.error('Failed to generate full report:', error);
      throw error;
    }
  }

  /**
   * 🚨 Быстрая проверка критических компонентов
   */
  async quickStatus() {
    try {
      const quickCheck = await healthCheck.quickCheck();
      const recentStats = performanceMonitor.getTimeRangeStats(15); // Последние 15 минут
      
      return {
        timestamp: new Date().toISOString(),
        status: quickCheck.status,
        components: quickCheck.components,
        recentActivity: recentStats,
        alerts: this.getActiveAlerts()
      };
      
    } catch (error) {
      logger.error('Quick status check failed:', error);
      return {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 💡 Сгенерировать рекомендации
   */
  generateRecommendations(healthReport, metrics) {
    const recommendations = [];

    // Анализ health check
    if (healthReport.summary.error > 0) {
      recommendations.push({
        type: 'critical',
        category: 'infrastructure',
        message: `${healthReport.summary.error} critical components are down`,
        action: 'Check failed components and restore service',
        components: healthReport.summary.criticalErrors
      });
    }

    // Анализ производительности
    if (metrics.messageProcessing.averageTime > 5000) {
      recommendations.push({
        type: 'warning',
        category: 'performance',
        message: 'Message processing is slow (>5s average)',
        action: 'Optimize AI response time or scale workers',
        details: `Average: ${metrics.messageProcessing.averageTime}ms`
      });
    }

    // Анализ кэша
    if (metrics.cache.hitRate < 60 && metrics.cache.totalRequests > 100) {
      recommendations.push({
        type: 'optimization',
        category: 'cache',
        message: `Low cache hit rate: ${metrics.cache.hitRate}%`,
        action: 'Review cache keys and TTL settings',
        impact: 'Increased AI API calls and response time'
      });
    }

    // Анализ памяти
    if (metrics.system.memoryUsage.heapUsed > 512) {
      const type = metrics.system.memoryUsage.heapUsed > 1024 ? 'critical' : 'warning';
      recommendations.push({
        type,
        category: 'resources',
        message: `High memory usage: ${metrics.system.memoryUsage.heapUsed}MB`,
        action: 'Check for memory leaks or optimize cache size',
        trend: 'Monitor memory growth over time'
      });
    }

    // Анализ ошибок
    const errorRate = (metrics.messageProcessing.errors / Math.max(metrics.messageProcessing.totalMessages, 1)) * 100;
    if (errorRate > 5) {
      recommendations.push({
        type: 'critical',
        category: 'reliability',
        message: `High error rate: ${Math.round(errorRate)}%`,
        action: 'Investigate error patterns in logs',
        details: `${metrics.messageProcessing.errors} errors out of ${metrics.messageProcessing.totalMessages} messages`
      });
    }

    return recommendations;
  }

  /**
   * 🚨 Получить активные алерты
   */
  getActiveAlerts() {
    const alerts = [];
    const metrics = performanceMonitor.getMetrics();

    // Алерт о медленной обработке
    if (metrics.messageProcessing.averageTime > 10000) {
      alerts.push({
        level: 'critical',
        type: 'performance',
        message: 'Very slow message processing detected',
        value: `${metrics.messageProcessing.averageTime}ms average`,
        threshold: '10s'
      });
    }

    // Алерт о высоком проценте ошибок
    const errorRate = (metrics.messageProcessing.errors / Math.max(metrics.messageProcessing.totalMessages, 1)) * 100;
    if (errorRate > 10) {
      alerts.push({
        level: 'critical',
        type: 'errors',
        message: 'High error rate detected',
        value: `${Math.round(errorRate)}%`,
        threshold: '10%'
      });
    }

    // Алерт о высоком использовании памяти
    if (metrics.system.memoryUsage.heapUsed > 1024) {
      alerts.push({
        level: 'warning',
        type: 'memory',
        message: 'High memory usage',
        value: `${metrics.system.memoryUsage.heapUsed}MB`,
        threshold: '1GB'
      });
    }

    return alerts;
  }

  /**
   * 📈 Получить тренды производительности
   */
  getPerformanceTrends() {
    return {
      last15min: performanceMonitor.getTimeRangeStats(15),
      lastHour: performanceMonitor.getTimeRangeStats(60),
      slowOperations: performanceMonitor.getSlowOperations(3000), // >3s
      problemNumbers: performanceMonitor.getTopProblemNumbers()
    };
  }

  /**
   * 🎨 Форматировать краткий статус для консоли
   */
  async formatQuickStatus() {
    const status = await this.quickStatus();
    
    const statusEmojis = {
      healthy: '🟢',
      degraded: '🟡',
      unhealthy: '🔴'
    };
    
    const lines = [
      `${statusEmojis[status.status]} System: ${status.status.toUpperCase()}`,
      `Time: ${new Date(status.timestamp).toLocaleTimeString()}`
    ];
    
    if (status.recentActivity.messages > 0) {
      lines.push(`Messages: ${status.recentActivity.messages} (last 15min)`);
      lines.push(`Avg time: ${status.recentActivity.averageTime}ms`);
    }
    
    if (status.alerts && status.alerts.length > 0) {
      lines.push(`🚨 Alerts: ${status.alerts.length}`);
    }
    
    return lines.join(' | ');
  }
}

// Singleton instance
const monitoringService = new MonitoringService();

module.exports = {
  monitoringService,
  performanceMonitor,
  healthCheck
};