// test/scenarios/booking-flow.test.js
const axios = require('axios');
const { format, addDays } = require('date-fns');

/**
 * E2E тестовые сценарии для процесса бронирования
 * Используем реальный YClients API вашего барбершопа
 */
class BookingFlowTest {
  constructor(config) {
    this.apiUrl = config.apiUrl || 'http://localhost:3000';
    this.testPhone = config.testPhone || '79999999999';
    this.venomUrl = config.venomUrl || 'http://localhost:3001';
    this.results = [];
  }

  /**
   * Отправить сообщение через webhook (симуляция WhatsApp)
   */
  async sendMessage(message) {
    try {
      const response = await axios.post(`${this.apiUrl}/webhook/whatsapp`, {
        from: `${this.testPhone}@c.us`,
        message: message,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📤 Sent: "${message}"`);
      
      // Ждём обработки
      await this.wait(3000);
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to send message:', error.message);
      throw error;
    }
  }

  /**
   * Ожидание
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Тест: Простое бронирование
   */
  async testSimpleBooking() {
    console.log('\n🧪 Test: Simple Booking Flow');
    console.log('=' . repeat(50));
    
    try {
      // 1. Приветствие
      await this.sendMessage('Привет');
      
      // 2. Запрос на бронирование
      await this.sendMessage('Хочу записаться на стрижку');
      
      // 3. Выбор даты (завтра)
      const tomorrow = format(addDays(new Date(), 1), 'dd.MM.yyyy');
      await this.sendMessage(`Завтра ${tomorrow}`);
      
      // 4. Выбор времени
      await this.sendMessage('В 15:00');
      
      // 5. Подтверждение
      await this.sendMessage('Да, подтверждаю');
      
      this.results.push({
        test: 'Simple Booking',
        status: 'PASSED',
        duration: Date.now() - startTime
      });
      
      console.log('✅ Test passed');
    } catch (error) {
      this.results.push({
        test: 'Simple Booking',
        status: 'FAILED',
        error: error.message
      });
      console.error('❌ Test failed:', error.message);
    }
  }

  /**
   * Тест: Бронирование с выбором мастера
   */
  async testBookingWithMaster() {
    console.log('\n🧪 Test: Booking with Master Selection');
    console.log('=' . repeat(50));
    
    try {
      // 1. Запрос с указанием мастера
      await this.sendMessage('Хочу записаться к конкретному мастеру');
      
      // 2. Выбор мастера (используйте реальное имя из вашего барбершопа)
      await this.sendMessage('К Александру');
      
      // 3. Выбор услуги
      await this.sendMessage('Стрижка мужская');
      
      // 4. Выбор времени
      await this.sendMessage('Покажи свободное время на этой неделе');
      
      // 5. Выбираем первый доступный слот
      await this.sendMessage('Первый вариант подходит');
      
      this.results.push({
        test: 'Booking with Master',
        status: 'PASSED'
      });
      
      console.log('✅ Test passed');
    } catch (error) {
      this.results.push({
        test: 'Booking with Master',
        status: 'FAILED',
        error: error.message
      });
      console.error('❌ Test failed:', error.message);
    }
  }

  /**
   * Тест: Отмена записи
   */
  async testCancelBooking() {
    console.log('\n🧪 Test: Cancel Booking');
    console.log('=' . repeat(50));
    
    try {
      // 1. Запрос на отмену
      await this.sendMessage('Хочу отменить запись');
      
      // 2. Подтверждение отмены
      await this.sendMessage('Да, отменить');
      
      this.results.push({
        test: 'Cancel Booking',
        status: 'PASSED'
      });
      
      console.log('✅ Test passed');
    } catch (error) {
      this.results.push({
        test: 'Cancel Booking',
        status: 'FAILED',
        error: error.message
      });
      console.error('❌ Test failed:', error.message);
    }
  }

  /**
   * Тест: Получение информации
   */
  async testGetInfo() {
    console.log('\n🧪 Test: Get Information');
    console.log('=' . repeat(50));
    
    try {
      // 1. Запрос услуг
      await this.sendMessage('Какие услуги есть?');
      
      // 2. Запрос цен
      await this.sendMessage('Сколько стоит стрижка?');
      
      // 3. Запрос адреса
      await this.sendMessage('Какой адрес?');
      
      // 4. Часы работы
      await this.sendMessage('Во сколько открываетесь?');
      
      this.results.push({
        test: 'Get Information',
        status: 'PASSED'
      });
      
      console.log('✅ Test passed');
    } catch (error) {
      this.results.push({
        test: 'Get Information',
        status: 'FAILED',
        error: error.message
      });
      console.error('❌ Test failed:', error.message);
    }
  }

  /**
   * Запустить все тесты
   */
  async runAll() {
    console.log('🚀 Starting E2E Tests for AI Admin');
    console.log(`📱 Test WhatsApp: ${this.testPhone}`);
    console.log(`🌐 API URL: ${this.apiUrl}`);
    console.log('');
    
    const startTime = Date.now();
    
    // Запускаем тесты последовательно
    await this.testSimpleBooking();
    await this.wait(5000); // Пауза между тестами
    
    await this.testBookingWithMaster();
    await this.wait(5000);
    
    await this.testGetInfo();
    await this.wait(5000);
    
    await this.testCancelBooking();
    
    // Итоги
    console.log('\n📊 Test Results Summary');
    console.log('=' . repeat(50));
    
    const passed = this.results.filter(r => r.status === 'PASSED').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;
    
    this.results.forEach(result => {
      const icon = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`${icon} ${result.test}: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('');
    console.log(`Total: ${this.results.length} tests`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    
    return failed === 0;
  }
}

// Запуск тестов
if (require.main === module) {
  const test = new BookingFlowTest({
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    testPhone: process.env.TEST_CLIENT_PHONE || '79999999999',
    venomUrl: process.env.VENOM_SERVER_URL || 'http://localhost:3001'
  });
  
  test.runAll()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = BookingFlowTest;