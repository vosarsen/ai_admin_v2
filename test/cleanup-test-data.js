// test/cleanup-test-data.js
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const config = require('../src/config');
const logger = require('../src/utils/logger');

/**
 * Скрипт для очистки тестовых данных после тестирования
 */
class TestDataCleaner {
  constructor() {
    this.testPhonePrefix = process.env.TEST_CLIENT_PHONE || '79999999999';
    this.yclientsApi = axios.create({
      baseURL: 'https://api.yclients.com/api/v1',
      headers: {
        'Authorization': `Bearer ${config.yclients.bearerToken}, User ${config.yclients.userToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.yclients.v2+json'
      }
    });
    
    // Initialize connections
    this.redis = new Redis(config.redis.url, {
      password: config.redis.password
    });
    
    this.supabase = createClient(
      config.database.supabaseUrl,
      config.database.supabaseKey
    );
  }

  /**
   * Очистить записи в YClients созданные во время тестов
   */
  async cleanYClientsBookings() {
    console.log('🧹 Cleaning YClients test bookings...');
    
    try {
      // Получить записи за последние 7 дней
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const response = await this.yclientsApi.get(`/records/${config.yclients.companyId}`, {
        params: {
          start_date: weekAgo.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        }
      });
      
      const testRecords = response.data.data.filter(record => {
        // Фильтруем записи с тестовым номером телефона
        return record.client && record.client.phone && 
               record.client.phone.includes(this.testPhonePrefix.slice(-10));
      });
      
      console.log(`Found ${testRecords.length} test bookings`);
      
      // Отменяем каждую тестовую запись
      for (const record of testRecords) {
        try {
          await this.yclientsApi.delete(`/records/${config.yclients.companyId}/${record.id}`);
          console.log(`❌ Cancelled booking #${record.id}`);
        } catch (error) {
          console.error(`Failed to cancel booking #${record.id}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('Error cleaning YClients bookings:', error.message);
    }
  }

  /**
   * Очистить данные из Redis
   */
  async cleanRedisData() {
    console.log('🧹 Cleaning Redis test data...');
    
    try {
      // Паттерны ключей для удаления
      const patterns = [
        `context:${this.testPhonePrefix}*`,
        `messages:${this.testPhonePrefix}*`,
        `client:${this.testPhonePrefix}*`,
        `booking:${this.testPhonePrefix}*`,
        'test-*' // Любые тестовые ключи
      ];
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          console.log(`🗑️  Deleted ${keys.length} keys matching pattern: ${pattern}`);
        }
      }
      
      // Очистить тестовые очереди
      const testQueues = ['test-whatsapp-messages', 'test-reminders'];
      for (const queueName of testQueues) {
        const queueKeys = await this.redis.keys(`bull:${queueName}:*`);
        if (queueKeys.length > 0) {
          await this.redis.del(...queueKeys);
          console.log(`🗑️  Cleaned queue: ${queueName}`);
        }
      }
      
    } catch (error) {
      console.error('Error cleaning Redis data:', error.message);
    }
  }

  /**
   * Очистить данные из Supabase
   */
  async cleanSupabaseData() {
    console.log('🧹 Cleaning Supabase test data...');
    
    try {
      // Удалить тестовые записи клиентов
      const { data: clients, error: clientError } = await this.supabase
        .from('clients')
        .delete()
        .match({ phone: this.testPhonePrefix });
      
      if (clientError) throw clientError;
      
      console.log(`🗑️  Deleted test clients`);
      
      // Удалить тестовые записи бронирований
      const { data: bookings, error: bookingError } = await this.supabase
        .from('bookings')
        .delete()
        .like('client_phone', `${this.testPhonePrefix}%`);
      
      if (bookingError) throw bookingError;
      
      console.log(`🗑️  Deleted test bookings`);
      
    } catch (error) {
      console.error('Error cleaning Supabase data:', error.message);
    }
  }

  /**
   * Показать статистику перед очисткой
   */
  async showStats() {
    console.log('\n📊 Test Data Statistics:');
    console.log('=' . repeat(50));
    
    // Redis stats
    const redisKeys = await this.redis.dbsize();
    console.log(`Redis keys: ${redisKeys}`);
    
    // Queue stats
    const messageQueue = await this.redis.keys('bull:test-whatsapp-messages:*');
    const reminderQueue = await this.redis.keys('bull:test-reminders:*');
    console.log(`Test message queue items: ${messageQueue.length}`);
    console.log(`Test reminder queue items: ${reminderQueue.length}`);
    
    console.log('');
  }

  /**
   * Запустить полную очистку
   */
  async cleanAll() {
    console.log('🚀 Starting test data cleanup...');
    console.log(`📱 Test phone pattern: ${this.testPhonePrefix}`);
    console.log('');
    
    await this.showStats();
    
    // Спросить подтверждение
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('\n⚠️  This will delete all test data. Continue? (y/N): ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'y') {
      console.log('❌ Cleanup cancelled');
      return;
    }
    
    console.log('');
    
    // Выполнить очистку
    await this.cleanRedisData();
    await this.cleanSupabaseData();
    await this.cleanYClientsBookings();
    
    // Показать финальную статистику
    console.log('\n✅ Cleanup completed!');
    await this.showStats();
    
    // Закрыть соединения
    await this.redis.quit();
  }
}

// Запуск очистки
if (require.main === module) {
  const cleaner = new TestDataCleaner();
  
  cleaner.cleanAll()
    .then(() => {
      console.log('\n👍 All done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = TestDataCleaner;