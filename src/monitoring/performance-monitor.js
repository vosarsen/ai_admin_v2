// src/monitoring/performance-monitor.js
const logger = require('../utils/logger');

/**
 * 📊 PERFORMANCE MONITOR
 * Мониторинг производительности системы в реальном времени
 * 
 * Отслеживает:
 * - Время обработки сообщений
 * - Использование кэша
 * - Rate limiting метрики
 * - AI performance
 * - Rapid-fire статистику
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      messageProcessing: {
        totalMessages: 0,
        totalTime: 0,
        averageTime: 0,
        maxTime: 0,
        minTime: Infinity,
        timeouts: 0,
        errors: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalRequests: 0
      },
      rateLimiting: {
        requestsBlocked: 0,
        totalRequests: 0,
        blockRate: 0,
        phoneNumbers: new Set()
      },
      ai: {
        totalRequests: 0,
        totalTime: 0,
        averageTime: 0,
        errors: 0,
        entityResolutions: 0
      },
      rapidFire: {
        batchesProcessed: 0,
        messagesAggregated: 0,
        averageBatchSize: 0,
        totalWaitTime: 0
      },
      system: {
        startTime: Date.now(),
        uptime: 0,
        memoryUsage: {}
      }
    };

    this.recentMessages = []; // Последние 100 сообщений для анализа
    this.maxRecentMessages = 100;
    
    // Автоматическое обновление системных метрик каждые 30 секунд
    this.systemMetricsInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);
  }

  /**
   * 📝 Записать метрику обработки сообщения
   */
  recordMessageProcessing(processingTime, success = true, phone = null) {
    const metrics = this.metrics.messageProcessing;
    
    metrics.totalMessages++;
    metrics.totalTime += processingTime;
    metrics.averageTime = Math.round(metrics.totalTime / metrics.totalMessages);
    
    if (processingTime > metrics.maxTime) {
      metrics.maxTime = processingTime;
    }
    
    if (processingTime < metrics.minTime) {
      metrics.minTime = processingTime;
    }
    
    if (!success) {
      metrics.errors++;
    }
    
    if (processingTime > 30000) { // 30 секунд = timeout
      metrics.timeouts++;
    }

    // Добавляем в недавние сообщения
    this.recentMessages.push({
      timestamp: Date.now(),
      processingTime,
      success,
      phone: phone?.substring(0, 8) + 'xxx' // Маскируем номер
    });

    // Ограничиваем размер массива
    if (this.recentMessages.length > this.maxRecentMessages) {
      this.recentMessages.shift();
    }

    // Логируем медленные сообщения
    if (processingTime > 10000) {
      logger.warn(`🐌 Slow message processing: ${processingTime}ms`, {
        phone: phone?.substring(0, 8) + 'xxx',
        success
      });
    }
  }

  /**
   * 💾 Записать метрику кэша
   */
  recordCacheOperation(isHit) {
    const cache = this.metrics.cache;
    
    cache.totalRequests++;
    
    if (isHit) {
      cache.hits++;
    } else {
      cache.misses++;
    }
    
    cache.hitRate = Math.round((cache.hits / cache.totalRequests) * 100);
  }

  /**
   * 🚧 Записать метрику rate limiting
   */
  recordRateLimitOperation(phone, wasBlocked) {
    const rateLimiting = this.metrics.rateLimiting;
    
    rateLimiting.totalRequests++;
    rateLimiting.phoneNumbers.add(phone);
    
    if (wasBlocked) {
      rateLimiting.requestsBlocked++;
    }
    
    rateLimiting.blockRate = Math.round((rateLimiting.requestsBlocked / rateLimiting.totalRequests) * 100);
  }

  /**
   * 🤖 Записать метрику AI
   */
  recordAIOperation(processingTime, success = true, operationType = 'general') {
    const ai = this.metrics.ai;
    
    ai.totalRequests++;
    ai.totalTime += processingTime;
    ai.averageTime = Math.round(ai.totalTime / ai.totalRequests);
    
    if (!success) {
      ai.errors++;
    }
    
    if (operationType === 'entity_resolution') {
      ai.entityResolutions++;
    }
  }

  /**
   * 🔥 Записать метрику rapid-fire
   */
  recordRapidFireBatch(batchSize, waitTime) {
    const rapidFire = this.metrics.rapidFire;
    
    rapidFire.batchesProcessed++;
    rapidFire.messagesAggregated += batchSize;
    rapidFire.totalWaitTime += waitTime;
    
    rapidFire.averageBatchSize = Math.round(rapidFire.messagesAggregated / rapidFire.batchesProcessed);
  }

  /**
   * 🖥️ Обновить системные метрики
   */
  updateSystemMetrics() {
    const system = this.metrics.system;
    
    system.uptime = Date.now() - system.startTime;
    system.memoryUsage = process.memoryUsage();
    
    // Конвертируем байты в МБ
    Object.keys(system.memoryUsage).forEach(key => {
      system.memoryUsage[key] = Math.round(system.memoryUsage[key] / 1024 / 1024 * 100) / 100; // МБ
    });
  }

  /**
   * 📊 Получить текущие метрики
   */
  getMetrics() {
    this.updateSystemMetrics();
    
    return {
      ...this.metrics,
      summary: this.getPerformanceSummary()
    };
  }

  /**
   * 📈 Получить сводку производительности
   */
  getPerformanceSummary() {
    const msg = this.metrics.messageProcessing;
    const cache = this.metrics.cache;
    const ai = this.metrics.ai;
    const rateLimiting = this.metrics.rateLimiting;
    
    const summary = {
      status: 'healthy',
      issues: [],
      recommendations: []
    };
    
    // Анализ времени обработки сообщений
    if (msg.averageTime > 5000) {
      summary.status = 'degraded';
      summary.issues.push('Slow message processing (>5s average)');
      summary.recommendations.push('Optimize AI response time or add more workers');
    } else if (msg.averageTime > 2000) {
      summary.issues.push('Moderate message processing delays (>2s average)');
      summary.recommendations.push('Consider optimizing cache usage');
    }
    
    // Анализ ошибок
    const errorRate = (msg.errors / msg.totalMessages) * 100;
    if (errorRate > 5) {
      summary.status = 'unhealthy';
      summary.issues.push(`High error rate: ${Math.round(errorRate)}%`);
      summary.recommendations.push('Investigate error causes in logs');
    } else if (errorRate > 1) {
      summary.issues.push(`Moderate error rate: ${Math.round(errorRate)}%`);
    }
    
    // Анализ кэша
    if (cache.hitRate < 50 && cache.totalRequests > 50) {
      summary.issues.push(`Low cache hit rate: ${cache.hitRate}%`);
      summary.recommendations.push('Review cache TTL settings and key strategies');
    }
    
    // Анализ rate limiting
    if (rateLimiting.blockRate > 20) {
      summary.issues.push(`High rate limit blocks: ${rateLimiting.blockRate}%`);
      summary.recommendations.push('Review rate limit thresholds or user behavior');
    }
    
    // Анализ AI производительности
    if (ai.averageTime > 3000) {
      summary.issues.push('Slow AI processing (>3s average)');
      summary.recommendations.push('Check AI service response times');
    }
    
    // Анализ памяти
    const memoryMB = this.metrics.system.memoryUsage.heapUsed;
    if (memoryMB > 512) {
      summary.status = memoryMB > 1024 ? 'unhealthy' : 'degraded';
      summary.issues.push(`High memory usage: ${memoryMB}MB`);
      summary.recommendations.push('Check for memory leaks or optimize cache size');
    }
    
    return summary;
  }

  /**
   * 🔍 Получить недавние медленные операции
   */
  getSlowOperations(thresholdMs = 5000) {
    return this.recentMessages
      .filter(msg => msg.processingTime > thresholdMs)
      .sort((a, b) => b.processingTime - a.processingTime)
      .slice(0, 10);
  }

  /**
   * 📊 Получить статистику за период
   */
  getTimeRangeStats(minutes = 60) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentMessages = this.recentMessages.filter(msg => msg.timestamp > cutoff);
    
    if (recentMessages.length === 0) {
      return { period: `${minutes}m`, messages: 0 };
    }
    
    const totalTime = recentMessages.reduce((sum, msg) => sum + msg.processingTime, 0);
    const errors = recentMessages.filter(msg => !msg.success).length;
    
    return {
      period: `${minutes}m`,
      messages: recentMessages.length,
      averageTime: Math.round(totalTime / recentMessages.length),
      maxTime: Math.max(...recentMessages.map(msg => msg.processingTime)),
      errorRate: Math.round((errors / recentMessages.length) * 100),
      messagesPerMinute: Math.round(recentMessages.length / minutes)
    };
  }

  /**
   * 🎯 Получить топ проблемных номеров
   */
  getTopProblemNumbers() {
    const phoneStats = {};
    
    this.recentMessages.forEach(msg => {
      if (msg.phone) {
        if (!phoneStats[msg.phone]) {
          phoneStats[msg.phone] = { errors: 0, total: 0, totalTime: 0 };
        }
        
        phoneStats[msg.phone].total++;
        phoneStats[msg.phone].totalTime += msg.processingTime;
        
        if (!msg.success) {
          phoneStats[msg.phone].errors++;
        }
      }
    });
    
    return Object.entries(phoneStats)
      .map(([phone, stats]) => ({
        phone,
        errorRate: Math.round((stats.errors / stats.total) * 100),
        averageTime: Math.round(stats.totalTime / stats.total),
        totalMessages: stats.total
      }))
      .filter(stats => stats.errorRate > 0 || stats.averageTime > 5000)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5);
  }

  /**
   * 🎨 Форматировать метрики для красивого вывода
   */
  formatMetricsForDisplay() {
    const metrics = this.getMetrics();
    const summary = metrics.summary;
    
    const statusEmoji = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌'
    };
    
    const lines = [
      `${statusEmoji[summary.status]} System Status: ${summary.status.toUpperCase()}`,
      '',
      '📊 MESSAGE PROCESSING:',
      `  Messages: ${metrics.messageProcessing.totalMessages}`,
      `  Average Time: ${metrics.messageProcessing.averageTime}ms`,
      `  Max Time: ${metrics.messageProcessing.maxTime}ms`,
      `  Errors: ${metrics.messageProcessing.errors}`,
      `  Error Rate: ${Math.round((metrics.messageProcessing.errors / Math.max(metrics.messageProcessing.totalMessages, 1)) * 100)}%`,
      '',
      '💾 CACHE PERFORMANCE:',
      `  Hit Rate: ${metrics.cache.hitRate}%`,
      `  Total Requests: ${metrics.cache.totalRequests}`,
      `  Hits: ${metrics.cache.hits} | Misses: ${metrics.cache.misses}`,
      '',
      '🤖 AI PERFORMANCE:',
      `  Requests: ${metrics.ai.totalRequests}`,
      `  Average Time: ${metrics.ai.averageTime}ms`,
      `  Entity Resolutions: ${metrics.ai.entityResolutions}`,
      `  Errors: ${metrics.ai.errors}`,
      '',
      '🚧 RATE LIMITING:',
      `  Total Requests: ${metrics.rateLimiting.totalRequests}`,
      `  Blocked: ${metrics.rateLimiting.requestsBlocked} (${metrics.rateLimiting.blockRate}%)`,
      `  Unique Users: ${metrics.rateLimiting.phoneNumbers.size}`,
      '',
      '🔥 RAPID-FIRE:',
      `  Batches: ${metrics.rapidFire.batchesProcessed}`,
      `  Avg Batch Size: ${metrics.rapidFire.averageBatchSize}`,
      `  Messages Aggregated: ${metrics.rapidFire.messagesAggregated}`,
      '',
      '🖥️ SYSTEM:',
      `  Uptime: ${Math.round(metrics.system.uptime / 1000 / 60)}m`,
      `  Memory: ${metrics.system.memoryUsage.heapUsed}MB`,
      `  Memory Growth: ${metrics.system.memoryUsage.external}MB external`
    ];
    
    if (summary.issues.length > 0) {
      lines.push('', '⚠️ ISSUES:');
      summary.issues.forEach(issue => lines.push(`  • ${issue}`));
    }
    
    if (summary.recommendations.length > 0) {
      lines.push('', '💡 RECOMMENDATIONS:');
      summary.recommendations.forEach(rec => lines.push(`  • ${rec}`));
    }
    
    const recentStats = this.getTimeRangeStats(60);
    if (recentStats.messages > 0) {
      lines.push('', '⏱️ LAST HOUR:');
      lines.push(`  Messages: ${recentStats.messages} (${recentStats.messagesPerMinute}/min)`);
      lines.push(`  Average Time: ${recentStats.averageTime}ms`);
      lines.push(`  Max Time: ${recentStats.maxTime}ms`);
      lines.push(`  Error Rate: ${recentStats.errorRate}%`);
    }
    
    return lines.join('\n');
  }

  /**
   * 🧹 Очистить старые метрики
   */
  cleanup() {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
  }
}

// Singleton instance
module.exports = new PerformanceMonitor();