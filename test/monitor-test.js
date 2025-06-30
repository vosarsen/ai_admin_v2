// test/monitor-test.js
const axios = require('axios');
const colors = require('colors/safe');

/**
 * Монитор для отслеживания состояния системы во время тестов
 */
class TestMonitor {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || 'http://localhost:3000';
    this.venomUrl = config.venomUrl || 'http://localhost:3001';
    this.interval = config.interval || 2000; // 2 seconds
    this.monitoring = false;
  }

  /**
   * Проверить состояние сервисов
   */
  async checkServices() {
    const services = {
      api: { url: `${this.apiUrl}/health`, name: 'API Server' },
      venom: { url: `${this.venomUrl}/status`, name: 'WhatsApp (Venom)' },
      circuitBreakers: { url: `${this.apiUrl}/api/circuit-breakers`, name: 'Circuit Breakers' },
      metrics: { url: `${this.apiUrl}/api/metrics`, name: 'Queue Metrics' }
    };

    const results = {};

    for (const [key, service] of Object.entries(services)) {
      try {
        const response = await axios.get(service.url, { timeout: 3000 });
        results[key] = {
          name: service.name,
          status: 'UP',
          details: response.data
        };
      } catch (error) {
        results[key] = {
          name: service.name,
          status: 'DOWN',
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * Отобразить статус
   */
  displayStatus(results) {
    console.clear();
    console.log(colors.bold('\n🔍 AI Admin Test Monitor'));
    console.log(colors.gray('=' . repeat(60)));
    console.log(colors.gray(`Time: ${new Date().toLocaleString()}`));
    console.log('');

    // Статус сервисов
    console.log(colors.bold('📊 Services Status:'));
    for (const [key, service] of Object.entries(results)) {
      const statusIcon = service.status === 'UP' ? '✅' : '❌';
      const statusColor = service.status === 'UP' ? colors.green : colors.red;
      
      console.log(`${statusIcon} ${service.name}: ${statusColor(service.status)}`);
      
      if (service.status === 'UP' && service.details) {
        // Показать дополнительную информацию
        if (key === 'api' && service.details.services) {
          console.log(`   WhatsApp: ${service.details.services.whatsapp}`);
          console.log(`   Redis: ${service.details.services.redis}`);
        }
        
        if (key === 'venom' && service.details.connected !== undefined) {
          console.log(`   Connected: ${service.details.connected ? 'Yes' : 'No'}`);
        }
        
        if (key === 'metrics' && service.details.metrics) {
          const m = service.details.metrics;
          console.log(`   Waiting: ${m.waiting || 0}, Active: ${m.active || 0}, Completed: ${m.completed || 0}, Failed: ${m.failed || 0}`);
        }
        
        if (key === 'circuitBreakers' && service.details.circuitBreakers) {
          for (const [name, breaker] of Object.entries(service.details.circuitBreakers)) {
            const icon = breaker.state === 'CLOSED' ? '🟢' : breaker.state === 'OPEN' ? '🔴' : '🟡';
            console.log(`   ${icon} ${name}: ${breaker.state} (errors: ${breaker.errorCount}/${breaker.callCount})`);
          }
        }
      }
    }

    console.log('');
    console.log(colors.gray('Press Ctrl+C to stop monitoring'));
  }

  /**
   * Начать мониторинг
   */
  async start() {
    this.monitoring = true;
    
    console.log(colors.yellow('Starting monitoring...'));
    
    while (this.monitoring) {
      try {
        const results = await this.checkServices();
        this.displayStatus(results);
      } catch (error) {
        console.error(colors.red('Monitor error:'), error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, this.interval));
    }
  }

  /**
   * Остановить мониторинг
   */
  stop() {
    this.monitoring = false;
  }
}

// Запуск монитора
if (require.main === module) {
  const monitor = new TestMonitor({
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    venomUrl: process.env.VENOM_SERVER_URL || 'http://localhost:3001',
    interval: parseInt(process.env.MONITOR_INTERVAL) || 2000
  });

  // Обработка Ctrl+C
  process.on('SIGINT', () => {
    console.log(colors.yellow('\nStopping monitor...'));
    monitor.stop();
    process.exit(0);
  });

  monitor.start().catch(error => {
    console.error(colors.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = TestMonitor;