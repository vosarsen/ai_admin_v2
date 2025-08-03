const logger = require('../../utils/logger').child({ module: 'qwen-health-monitor' });
const dashscopeProvider = require('./dashscope-provider');

/**
 * Мониторинг здоровья Qwen AI системы
 * Отслеживает метрики, ошибки и производительность
 */
class QwenHealthMonitor {
  constructor() {
    this.metrics = {
      lastCheck: null,
      failures: [],
      slowResponses: [],
      errorRate: 0,
      avgResponseTime: 0
    };
    
    // Пороги для алертов
    this.thresholds = {
      errorRate: 0.1, // 10% ошибок
      slowResponse: 5000, // 5 секунд
      maxFailures: 5 // 5 ошибок подряд
    };
  }

  /**
   * Проверка здоровья системы
   */
  async checkHealth() {
    const startTime = Date.now();
    
    try {
      // Проверяем доступность обеих моделей
      const healthCheck = await dashscopeProvider.healthCheck();
      
      // Получаем статистику
      const stats = dashscopeProvider.getStats();
      
      // Рассчитываем метрики
      const totalRequests = stats.fast.count + stats.smart.count;
      const totalErrors = stats.fast.errors + stats.smart.errors;
      const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
      
      // Средняя задержка
      const avgResponseTime = this.calculateAvgResponseTime(stats);
      
      // Обновляем метрики
      this.metrics = {
        lastCheck: new Date(),
        errorRate,
        avgResponseTime,
        failures: errorRate > this.thresholds.errorRate ? 
          [...this.metrics.failures, new Date()] : [],
        slowResponses: avgResponseTime > this.thresholds.slowResponse ?
          [...this.metrics.slowResponses, new Date()] : [],
        stats,
        healthy: healthCheck.available && errorRate < this.thresholds.errorRate
      };
      
      // Логируем состояние
      if (!this.metrics.healthy) {
        logger.error('🚨 Qwen AI health check failed', this.metrics);
      } else {
        logger.info('✅ Qwen AI health check passed', {
          errorRate: `${(errorRate * 100).toFixed(2)}%`,
          avgResponseTime: `${avgResponseTime}ms`
        });
      }
      
      return this.metrics;
      
    } catch (error) {
      logger.error('Health check error:', error);
      this.metrics.failures.push(new Date());
      this.metrics.healthy = false;
      return this.metrics;
    }
  }

  /**
   * Рассчет средней задержки
   */
  calculateAvgResponseTime(stats) {
    const totalTime = stats.fast.totalTime + stats.smart.totalTime;
    const totalCount = stats.fast.count + stats.smart.count;
    return totalCount > 0 ? Math.round(totalTime / totalCount) : 0;
  }

  /**
   * Проверка необходимости алерта
   */
  shouldAlert() {
    // Алерт если слишком много ошибок подряд
    if (this.metrics.failures.length >= this.thresholds.maxFailures) {
      const recentFailures = this.metrics.failures.filter(
        date => Date.now() - date.getTime() < 300000 // последние 5 минут
      );
      
      if (recentFailures.length >= this.thresholds.maxFailures) {
        return {
          alert: true,
          reason: 'Too many consecutive failures',
          details: this.metrics
        };
      }
    }
    
    // Алерт если высокий error rate
    if (this.metrics.errorRate > this.thresholds.errorRate) {
      return {
        alert: true,
        reason: 'High error rate',
        details: this.metrics
      };
    }
    
    // Алерт если слишком медленные ответы
    if (this.metrics.avgResponseTime > this.thresholds.slowResponse) {
      return {
        alert: true,
        reason: 'Slow response times',
        details: this.metrics
      };
    }
    
    return { alert: false };
  }

  /**
   * Запуск периодического мониторинга
   */
  startMonitoring(intervalMs = 60000) { // каждую минуту
    logger.info('Starting Qwen health monitoring...');
    
    // Первая проверка сразу
    this.checkHealth();
    
    // Периодические проверки
    this.monitoringInterval = setInterval(async () => {
      await this.checkHealth();
      
      const alertStatus = this.shouldAlert();
      if (alertStatus.alert) {
        logger.error('🚨 ALERT:', alertStatus);
        // Здесь можно добавить отправку уведомлений
      }
    }, intervalMs);
  }

  /**
   * Остановка мониторинга
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      logger.info('Qwen health monitoring stopped');
    }
  }
}

// Экспортируем singleton
module.exports = new QwenHealthMonitor();