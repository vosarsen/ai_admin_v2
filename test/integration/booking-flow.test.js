// test/integration/booking-flow.test.js
const request = require('supertest');
const app = require('../../src/api');
const AIAdminV2 = require('../../src/services/ai-admin-v2');
const bookingService = require('../../src/services/booking');
const contextService = require('../../src/services/context');
const whatsappClient = require('../../src/integrations/whatsapp/client');
const messageQueue = require('../../src/queue/message-queue');
const config = require('../../src/config');
const crypto = require('crypto');

// Mocks
jest.mock('../../src/services/ai-admin-v2');
jest.mock('../../src/services/booking');
jest.mock('../../src/services/context');
jest.mock('../../src/integrations/whatsapp/client');
jest.mock('../../src/queue/message-queue');

describe('Complete Booking Flow Integration', () => {
  let server;
  const testPhone = '79001234567';
  const testPhoneWhatsApp = `${testPhone}@c.us`;
  
  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    messageQueue.addMessage.mockResolvedValue({
      success: true,
      jobId: 'job-123'
    });
    
    whatsappClient.checkStatus.mockResolvedValue({ connected: true });
    messageQueue.getMetrics.mockResolvedValue({ waiting: 0, active: 0 });
  });

  const generateSignature = (payload) => {
    return 'sha256=' + crypto
      .createHmac('sha256', config.webhooks.secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  };

  describe('New client booking flow', () => {
    it('should handle complete booking flow for new client', async () => {
      // Step 1: Initial greeting
      const step1 = {
        from: testPhoneWhatsApp,
        message: 'Привет',
        timestamp: new Date().toISOString()
      };

      AIAdminV2.processMessage.mockResolvedValueOnce({
        success: true,
        response: 'Здравствуйте! Добро пожаловать в наш салон красоты! Чем могу помочь?',
        commands: []
      });

      let response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(step1))
        .send(step1);

      expect(response.status).toBe(200);

      // Step 2: Request booking
      const step2 = {
        from: testPhoneWhatsApp,
        message: 'Хочу записаться на маникюр',
        timestamp: new Date().toISOString()
      };

      contextService.getContext.mockResolvedValueOnce({
        stage: 'initial'
      });

      AIAdminV2.processMessage.mockResolvedValueOnce({
        success: true,
        response: 'Отлично! У нас есть классический маникюр (1500₽) и маникюр с покрытием (2500₽). Что выберете?',
        commands: ['SHOW_SERVICES'],
        executedCommands: [{
          type: 'SHOW_SERVICES',
          data: {
            services: [
              { id: 1, name: 'Классический маникюр', price: 1500 },
              { id: 2, name: 'Маникюр с покрытием', price: 2500 }
            ]
          }
        }]
      });

      response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(step2))
        .send(step2);

      expect(response.status).toBe(200);

      // Step 3: Select service
      const step3 = {
        from: testPhoneWhatsApp,
        message: 'С покрытием',
        timestamp: new Date().toISOString()
      };

      contextService.getContext.mockResolvedValueOnce({
        stage: 'selecting_service',
        services: [
          { id: 1, name: 'Классический маникюр', price: 1500 },
          { id: 2, name: 'Маникюр с покрытием', price: 2500 }
        ]
      });

      AIAdminV2.processMessage.mockResolvedValueOnce({
        success: true,
        response: 'Хорошо, маникюр с покрытием. Когда вам удобно? У нас есть время завтра в 10:00, 14:00 и 16:00.',
        commands: ['SEARCH_SLOTS'],
        executedCommands: [{
          type: 'SEARCH_SLOTS',
          data: {
            slots: [
              { date: '2025-07-30', time: '10:00', staffId: 1, staffName: 'Мария' },
              { date: '2025-07-30', time: '14:00', staffId: 2, staffName: 'Анна' },
              { date: '2025-07-30', time: '16:00', staffId: 1, staffName: 'Мария' }
            ]
          }
        }]
      });

      response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(step3))
        .send(step3);

      expect(response.status).toBe(200);

      // Step 4: Select time
      const step4 = {
        from: testPhoneWhatsApp,
        message: 'Завтра в 14:00',
        timestamp: new Date().toISOString()
      };

      contextService.getContext.mockResolvedValueOnce({
        stage: 'selecting_time',
        selectedService: { id: 2, name: 'Маникюр с покрытием', price: 2500 },
        availableSlots: [
          { date: '2025-07-30', time: '10:00', staffId: 1, staffName: 'Мария' },
          { date: '2025-07-30', time: '14:00', staffId: 2, staffName: 'Анна' },
          { date: '2025-07-30', time: '16:00', staffId: 1, staffName: 'Мария' }
        ]
      });

      bookingService.createBooking.mockResolvedValueOnce({
        success: true,
        bookingId: 'booking-123',
        details: {
          date: '30 июля',
          time: '14:00',
          service: 'Маникюр с покрытием',
          staff: 'Анна',
          price: 2500
        }
      });

      AIAdminV2.processMessage.mockResolvedValueOnce({
        success: true,
        response: '✅ Отлично! Вы записаны на маникюр с покрытием 30 июля в 14:00 к мастеру Анна. Стоимость: 2500₽. Ждем вас!',
        commands: ['CREATE_BOOKING'],
        executedCommands: [{
          type: 'CREATE_BOOKING',
          data: {
            success: true,
            bookingId: 'booking-123'
          }
        }]
      });

      response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(step4))
        .send(step4);

      expect(response.status).toBe(200);
      
      // Verify booking was created
      expect(bookingService.createBooking).toHaveBeenCalled();
    });
  });

  describe('Existing client flow', () => {
    it('should handle returning client with preferences', async () => {
      const message = {
        from: testPhoneWhatsApp,
        message: 'Хочу записаться как обычно',
        timestamp: new Date().toISOString()
      };

      contextService.getContext.mockResolvedValueOnce({
        clientPreferences: {
          favoriteService: 'Маникюр с покрытием',
          favoriteStaff: 'Анна',
          lastVisit: '2025-07-15'
        }
      });

      AIAdminV2.processMessage.mockResolvedValueOnce({
        success: true,
        response: 'Здравствуйте! Рада вас снова видеть! Записать вас на маникюр с покрытием к Анне? У нее есть время послезавтра в 15:00.',
        commands: ['SEARCH_SLOTS'],
        executedCommands: [{
          type: 'SEARCH_SLOTS',
          data: {
            preferredStaff: 'Анна',
            preferredService: 'Маникюр с покрытием'
          }
        }]
      });

      const response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(message))
        .send(message);

      expect(response.status).toBe(200);
    });
  });

  describe('Booking cancellation flow', () => {
    it('should handle booking cancellation', async () => {
      const message = {
        from: testPhoneWhatsApp,
        message: 'Хочу отменить запись',
        timestamp: new Date().toISOString()
      };

      contextService.getContext.mockResolvedValueOnce({
        activeBookings: [
          {
            id: 'booking-123',
            date: '2025-07-30',
            time: '14:00',
            service: 'Маникюр с покрытием',
            staff: 'Анна'
          }
        ]
      });

      bookingService.cancelBooking.mockResolvedValueOnce({
        success: true
      });

      AIAdminV2.processMessage.mockResolvedValueOnce({
        success: true,
        response: '✅ Ваша запись на 30 июля в 14:00 успешно отменена. Будем рады видеть вас в другое время!',
        commands: ['CANCEL_BOOKING'],
        executedCommands: [{
          type: 'CANCEL_BOOKING',
          data: {
            success: true,
            bookingId: 'booking-123'
          }
        }]
      });

      const response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(message))
        .send(message);

      expect(response.status).toBe(200);
      expect(bookingService.cancelBooking).toHaveBeenCalledWith('booking-123', expect.any(Number));
    });
  });

  describe('Error scenarios', () => {
    it('should handle no available slots', async () => {
      const message = {
        from: testPhoneWhatsApp,
        message: 'Хочу записаться на сегодня',
        timestamp: new Date().toISOString()
      };

      AIAdminV2.processMessage.mockResolvedValueOnce({
        success: true,
        response: 'К сожалению, на сегодня все места заняты. Могу предложить запись на завтра. Вам подходит?',
        commands: ['SEARCH_SLOTS'],
        executedCommands: [{
          type: 'SEARCH_SLOTS',
          data: {
            available: false,
            reason: 'no_slots_today'
          }
        }]
      });

      const response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(message))
        .send(message);

      expect(response.status).toBe(200);
    });

    it('should handle service unavailable', async () => {
      const message = {
        from: testPhoneWhatsApp,
        message: 'Хочу записаться на педикюр',
        timestamp: new Date().toISOString()
      };

      AIAdminV2.processMessage.mockResolvedValueOnce({
        success: true,
        response: 'К сожалению, услуга педикюра временно недоступна. Могу предложить маникюр или другие услуги нашего салона.',
        commands: ['SHOW_SERVICES'],
        executedCommands: [{
          type: 'SHOW_SERVICES',
          data: {
            requestedService: 'педикюр',
            available: false
          }
        }]
      });

      const response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(message))
        .send(message);

      expect(response.status).toBe(200);
    });
  });
});