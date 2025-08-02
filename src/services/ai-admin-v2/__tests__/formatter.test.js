// src/services/ai-admin-v2/__tests__/formatter.test.js
const formatter = require('../modules/formatter');

describe('Formatter', () => {
  describe('formatServices', () => {
    it('should format services list for barbershop', () => {
      const services = [
        { title: 'Стрижка', price_min: 1500, duration: 30 },
        { title: 'Борода', price_min: 800, duration: 20 }
      ];
      
      const result = formatter.formatServices(services, 'barbershop');
      
      expect(result).toContain('Стрижка - от 1500 руб');
      expect(result).toContain('Борода - от 800 руб');
    });

    it('should use correct terminology for different business types', () => {
      const services = [
        { title: 'Маникюр', price_min: 2000 }
      ];
      
      const nailsResult = formatter.formatServices(services, 'nails');
      const beautyResult = formatter.formatServices(services, 'beauty');
      
      expect(nailsResult).toContain('процедура');
      expect(beautyResult).toContain('услуга');
    });

    it('should handle empty services array', () => {
      const result = formatter.formatServices([], 'barbershop');
      
      expect(result).toBe('Нет доступных услуг');
    });

    it('should show discounts when available', () => {
      const services = [
        { 
          title: 'Стрижка', 
          price_min: 1500,
          discount: 20,
          discounted_price_min: 1200
        }
      ];
      
      const result = formatter.formatServices(services, 'barbershop');
      
      expect(result).toContain('~~1500~~');
      expect(result).toContain('1200 руб');
      expect(result).toContain('(-20%)');
    });
  });

  describe('formatStaffSchedules', () => {
    it('should format staff schedules by date', () => {
      const schedules = [
        { staff_id: 1, date: '2024-07-20', start_time: '09:00', end_time: '18:00' },
        { staff_id: 2, date: '2024-07-20', start_time: '10:00', end_time: '19:00' }
      ];
      
      const staff = [
        { id: 1, name: 'Сергей' },
        { id: 2, name: 'Мария' }
      ];
      
      const result = formatter.formatStaffSchedules(schedules, staff);
      
      expect(result).toContain('20.07');
      expect(result).toContain('Сергей (09:00-18:00)');
      expect(result).toContain('Мария (10:00-19:00)');
    });

    it('should handle empty schedules', () => {
      const result = formatter.formatStaffSchedules([], []);
      
      expect(result).toBe('Расписание не загружено');
    });
  });

  describe('formatTodayStaff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-07-20T10:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should show only today working staff', () => {
      const schedules = [
        { staff_id: 1, date: '2024-07-20', start_time: '09:00', end_time: '18:00' },
        { staff_id: 2, date: '2024-07-21', start_time: '10:00', end_time: '19:00' }
      ];
      
      const staff = [
        { id: 1, name: 'Сергей' },
        { id: 2, name: 'Мария' }
      ];
      
      const result = formatter.formatTodayStaff(schedules, staff);
      
      expect(result).toContain('Сергей (09:00-18:00)');
      expect(result).not.toContain('Мария');
    });

    it('should show message when no one works today', () => {
      const schedules = [
        { staff_id: 1, date: '2024-07-21', start_time: '09:00', end_time: '18:00' }
      ];
      
      const result = formatter.formatTodayStaff(schedules, []);
      
      expect(result).toBe('Сегодня никто не работает');
    });
  });

  describe('formatSlots', () => {
    it('should group slots by time period', () => {
      const slots = [
        { datetime: '2024-07-20T09:00:00', seance_length: 30, master: { name: 'Сергей' } },
        { datetime: '2024-07-20T15:00:00', seance_length: 30, master: { name: 'Сергей' } },
        { datetime: '2024-07-20T19:00:00', seance_length: 30, master: { name: 'Мария' } }
      ];
      
      const result = formatter.formatSlots(slots, 'barbershop');
      
      expect(result).toHaveProperty('morning');
      expect(result).toHaveProperty('afternoon');
      expect(result).toHaveProperty('evening');
      expect(result.morning).toContain('09:00');
      expect(result.afternoon).toContain('15:00');
      expect(result.evening).toContain('19:00');
    });

    it('should handle empty slots', () => {
      const result = formatter.formatSlots([], 'barbershop');
      
      expect(result).toBeNull();
    });

    it('should use correct terminology for master', () => {
      const slots = [
        { datetime: '2024-07-20T10:00:00', master: { name: 'Сергей' } }
      ];
      
      const barbershopResult = formatter.formatSlots(slots, 'barbershop');
      const nailsResult = formatter.formatSlots(slots, 'nails');
      
      expect(barbershopResult.morning).toContain('барбер');
      expect(nailsResult.morning).toContain('мастер');
    });
  });

  describe('formatBookingConfirmation', () => {
    it('should format booking confirmation message', () => {
      const booking = {
        date: '2024-07-20',
        time: '15:00',
        services: 'Стрижка',
        staff: 'Сергей',
        price: 1500,
        address: 'ул. Тестовая, 1'
      };
      
      const result = formatter.formatBookingConfirmation(booking, 'barbershop');
      
      expect(result).toContain('20 июля');
      expect(result).toContain('15:00');
      expect(result).toContain('Стрижка');
      expect(result).toContain('Сергей');
      expect(result).toContain('1500 руб');
      expect(result).toContain('ул. Тестовая, 1');
    });

    it('should use correct terminology for different business types', () => {
      const booking = {
        date: '2024-07-20',
        time: '15:00',
        services: 'Маникюр',
        staff: 'Мария'
      };
      
      const barbershopResult = formatter.formatBookingConfirmation(booking, 'barbershop');
      const nailsResult = formatter.formatBookingConfirmation(booking, 'nails');
      
      expect(barbershopResult).toContain('Барбер: Мария');
      expect(nailsResult).toContain('Мастер: Мария');
    });

    it('should handle missing optional fields', () => {
      const booking = {
        date: '2024-07-20',
        time: '15:00'
      };
      
      const result = formatter.formatBookingConfirmation(booking, 'barbershop');
      
      expect(result).toContain('20 июля');
      expect(result).toContain('15:00');
      expect(result).not.toContain('undefined');
    });
  });

  describe('formatPrices', () => {
    it('should format price list', () => {
      const services = [
        { title: 'Стрижка', price_min: 1500, price_max: 2500 },
        { title: 'Борода', price_min: 800 }
      ];
      
      const result = formatter.formatPrices(services, 'barbershop');
      
      expect(result).toContain('💈 ПРАЙС-ЛИСТ');
      expect(result).toContain('Стрижка: 1500-2500 руб');
      expect(result).toContain('Борода: от 800 руб');
    });

    it('should show discounted prices', () => {
      const services = [
        { 
          title: 'Стрижка', 
          price_min: 1500,
          discount: 20,
          discounted_price_min: 1200
        }
      ];
      
      const result = formatter.formatPrices(services, 'barbershop');
      
      expect(result).toContain('~~1500~~');
      expect(result).toContain('1200 руб');
      expect(result).toContain('скидка 20%');
    });
  });

  describe('formatWorkingHours', () => {
    it('should format working hours object', () => {
      const hours = {
        monday: { start: '09:00', end: '21:00' },
        tuesday: { start: '09:00', end: '21:00' },
        wednesday: { start: '09:00', end: '21:00' }
      };
      
      const result = formatter.formatWorkingHours(hours);
      
      expect(result).toContain('пн-ср: 09:00-21:00');
    });

    it('should handle empty hours', () => {
      const result = formatter.formatWorkingHours({});
      
      expect(result).toBe('не указаны');
    });

    it('should group consecutive days with same hours', () => {
      const hours = {
        monday: { start: '09:00', end: '21:00' },
        tuesday: { start: '09:00', end: '21:00' },
        wednesday: { start: '10:00', end: '20:00' },
        thursday: { start: '10:00', end: '20:00' }
      };
      
      const result = formatter.formatWorkingHours(hours);
      
      expect(result).toContain('пн-вт: 09:00-21:00');
      expect(result).toContain('ср-чт: 10:00-20:00');
    });
  });

  describe('formatConversation', () => {
    it('should format conversation history', () => {
      const messages = [
        {
          message_text: 'Привет',
          is_from_client: true,
          created_at: '2024-07-20T10:00:00'
        },
        {
          message_text: 'Здравствуйте!',
          is_from_client: false,
          created_at: '2024-07-20T10:01:00'
        }
      ];
      
      const result = formatter.formatConversation(messages);
      
      expect(result).toContain('Клиент: Привет');
      expect(result).toContain('Бот: Здравствуйте!');
    });

    it('should limit long messages', () => {
      const longMessage = 'А'.repeat(200);
      const messages = [
        {
          message_text: longMessage,
          is_from_client: true,
          created_at: '2024-07-20T10:00:00'
        }
      ];
      
      const result = formatter.formatConversation(messages);
      
      expect(result).toContain('...');
      expect(result.length).toBeLessThan(longMessage.length);
    });

    it('should handle empty conversation', () => {
      const result = formatter.formatConversation([]);
      
      expect(result).toBe('Нет предыдущих сообщений');
    });
  });

  describe('formatRescheduleConfirmation', () => {
    it('should format reschedule confirmation', () => {
      const data = {
        oldDateTime: '2024-07-20T15:00:00',
        newDateTime: '2024-07-21T16:00:00',
        services: ['Стрижка'],
        staff: 'Сергей'
      };
      
      const result = formatter.formatRescheduleConfirmation(data);
      
      expect(result).toContain('Запись успешно перенесена');
      expect(result).toContain('20 июля в 15:00');
      expect(result).toContain('21 июля в 16:00');
      expect(result).toContain('Стрижка');
      expect(result).toContain('Сергей');
    });

    it('should handle missing data gracefully', () => {
      const result = formatter.formatRescheduleConfirmation({});
      
      expect(result).toBe('');
    });
  });

  describe('formatVisitHistory', () => {
    it('should format visit history', () => {
      const history = [
        { date: '2024-06-15', services: ['Стрижка'] },
        { date: '2024-05-10', services: ['Стрижка', 'Борода'] }
      ];
      
      const result = formatter.formatVisitHistory(history);
      
      expect(result).toContain('2 визита');
      expect(result).toContain('последний 15.06.2024');
    });

    it('should handle no history', () => {
      const result = formatter.formatVisitHistory([]);
      
      expect(result).toBe('первый визит');
    });

    it('should handle null history', () => {
      const result = formatter.formatVisitHistory(null);
      
      expect(result).toBe('нет данных');
    });
  });
});