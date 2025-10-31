// src/services/ai-admin-v2/__tests__/business-logic.test.js
const businessLogic = require('../modules/business-logic');

describe('BusinessLogic', () => {
  describe('detectBusinessType', () => {
    it('should detect barbershop by keywords', () => {
      const companies = [
        { title: 'Барбершоп Усы' },
        { title: 'Мужская парикмахерская' },
        { title: 'Стрижка бород' }
      ];
      
      companies.forEach(company => {
        expect(businessLogic.detectBusinessType(company)).toBe('barbershop');
      });
    });

    it('should detect nails salon by keywords', () => {
      const companies = [
        { title: 'Студия маникюра' },
        { title: 'Ногтевой сервис' },
        { title: 'Nail Bar' }
      ];
      
      companies.forEach(company => {
        expect(businessLogic.detectBusinessType(company)).toBe('nails');
      });
    });

    it('should detect massage salon', () => {
      const companies = [
        { title: 'Массажный салон' },
        { title: 'СПА и массаж' }
      ];
      
      companies.forEach(company => {
        expect(businessLogic.detectBusinessType(company)).toBe('massage');
      });
    });

    it('should detect epilation salon', () => {
      const companies = [
        { title: 'Центр эпиляции' },
        { title: 'Лазерная депиляция' },
        { title: 'Шугаринг студия' }
      ];
      
      companies.forEach(company => {
        expect(businessLogic.detectBusinessType(company)).toBe('epilation');
      });
    });

    it('should detect brows salon', () => {
      const companies = [
        { title: 'Brow Bar' },
        { title: 'Студия бровей' },
        { title: 'Брови и ресницы' }
      ];
      
      companies.forEach(company => {
        expect(businessLogic.detectBusinessType(company)).toBe('brows');
      });
    });

    it('should default to beauty for generic names', () => {
      const companies = [
        { title: 'Салон красоты' },
        { title: 'Beauty Studio' },
        { title: 'Студия' }
      ];
      
      companies.forEach(company => {
        expect(businessLogic.detectBusinessType(company)).toBe('beauty');
      });
    });

    it('should handle empty or missing data', () => {
      expect(businessLogic.detectBusinessType({})).toBe('beauty');
      expect(businessLogic.detectBusinessType({ title: '' })).toBe('beauty');
      expect(businessLogic.detectBusinessType(null)).toBe('beauty');
    });
  });

  describe('getBusinessTerminology', () => {
    it('should return correct terminology for barbershop', () => {
      const terms = businessLogic.getBusinessTerminology('barbershop');
      
      expect(terms.master).toBe('барбер');
      expect(terms.masters).toBe('барберы');
      expect(terms.service).toBe('услуга');
      expect(terms.visit).toBe('визит');
      expect(terms.greeting).toContain('Привет');
    });

    it('should return correct terminology for nails', () => {
      const terms = businessLogic.getBusinessTerminology('nails');
      
      expect(terms.master).toBe('мастер');
      expect(terms.service).toBe('процедура');
      expect(terms.greeting).toContain('Добрый');
    });

    it('should return suggestions for each business type', () => {
      const types = ['barbershop', 'nails', 'massage', 'epilation', 'brows', 'beauty'];
      
      types.forEach(type => {
        const terms = businessLogic.getBusinessTerminology(type);
        expect(terms.suggestions).toBeInstanceOf(Array);
        expect(terms.suggestions.length).toBeGreaterThan(0);
      });
    });

    it('should default to beauty terminology for unknown type', () => {
      const terms = businessLogic.getBusinessTerminology('unknown');
      
      expect(terms.master).toBe('мастер');
      expect(terms.service).toBe('услуга');
    });
  });

  describe('sortServicesForClient', () => {
    const services = [
      { id: 1, title: 'Стрижка', yclients_id: 100, popularity_score: 50 },
      { id: 2, title: 'Борода', yclients_id: 101, popularity_score: 30 },
      { id: 3, title: 'Усы', yclients_id: 102, popularity_score: 20 },
      { id: 4, title: 'Комплекс', yclients_id: 103, popularity_score: 70 }
    ];

    it('should prioritize client favorite services', () => {
      const client = {
        last_service_ids: [101, 102]
      };
      
      const sorted = businessLogic.sortServicesForClient(services, client);
      
      expect(sorted[0].yclients_id).toBe(101); // Борода
      expect(sorted[1].yclients_id).toBe(102); // Усы
    });

    it('should sort by popularity when no client preferences', () => {
      const sorted = businessLogic.sortServicesForClient(services, null);
      
      expect(sorted[0].yclients_id).toBe(103); // Комплекс (highest popularity)
      expect(sorted[1].yclients_id).toBe(100); // Стрижка
      expect(sorted[2].yclients_id).toBe(101); // Борода
      expect(sorted[3].yclients_id).toBe(102); // Усы
    });

    it('should handle client without preferences', () => {
      const client = { name: 'Иван' };
      const sorted = businessLogic.sortServicesForClient(services, client);
      
      expect(sorted).toHaveLength(services.length);
      expect(sorted[0].popularity_score).toBe(70);
    });

    it('should handle empty services array', () => {
      const sorted = businessLogic.sortServicesForClient([], null);
      
      expect(sorted).toEqual([]);
    });

    it('should maintain original array immutability', () => {
      const originalServices = [...services];
      businessLogic.sortServicesForClient(services, null);
      
      expect(services).toEqual(originalServices);
    });
  });

  describe('normalizeServiceName', () => {
    it('should normalize service variations', () => {
      const variations = [
        ['стричься', 'стрижка'],
        ['подстричься', 'стрижка'],
        ['постричься', 'стрижка'],
        ['ногти', 'маникюр'],
        ['сделать ногти', 'маникюр'],
        ['покрасить волосы', 'окрашивание'],
        ['покраска', 'окрашивание']
      ];
      
      variations.forEach(([input, expected]) => {
        expect(businessLogic.normalizeServiceName(input)).toBe(expected);
      });
    });

    it('should return original if no normalization needed', () => {
      expect(businessLogic.normalizeServiceName('массаж')).toBe('массаж');
      expect(businessLogic.normalizeServiceName('педикюр')).toBe('педикюр');
    });

    it('should handle case insensitivity', () => {
      expect(businessLogic.normalizeServiceName('СТРИЧЬСЯ')).toBe('стрижка');
      expect(businessLogic.normalizeServiceName('НоГтИ')).toBe('маникюр');
    });
  });

  describe('isWorkingHours', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true during working hours', () => {
      jest.setSystemTime(new Date('2024-07-20T14:00:00'));
      expect(businessLogic.isWorkingHours()).toBe(true);
      
      jest.setSystemTime(new Date('2024-07-20T10:00:00'));
      expect(businessLogic.isWorkingHours()).toBe(true);
      
      jest.setSystemTime(new Date('2024-07-20T20:00:00'));
      expect(businessLogic.isWorkingHours()).toBe(true);
    });

    it('should return false outside working hours', () => {
      jest.setSystemTime(new Date('2024-07-20T08:00:00'));
      expect(businessLogic.isWorkingHours()).toBe(false);
      
      jest.setSystemTime(new Date('2024-07-20T22:00:00'));
      expect(businessLogic.isWorkingHours()).toBe(false);
      
      jest.setSystemTime(new Date('2024-07-20T02:00:00'));
      expect(businessLogic.isWorkingHours()).toBe(false);
    });
  });

  describe('getDayGreeting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return morning greeting', () => {
      jest.setSystemTime(new Date('2024-07-20T08:00:00'));
      expect(businessLogic.getDayGreeting()).toBe('Доброе утро');
      
      jest.setSystemTime(new Date('2024-07-20T11:00:00'));
      expect(businessLogic.getDayGreeting()).toBe('Доброе утро');
    });

    it('should return day greeting', () => {
      jest.setSystemTime(new Date('2024-07-20T12:00:00'));
      expect(businessLogic.getDayGreeting()).toBe('Добрый день');
      
      jest.setSystemTime(new Date('2024-07-20T16:00:00'));
      expect(businessLogic.getDayGreeting()).toBe('Добрый день');
    });

    it('should return evening greeting', () => {
      jest.setSystemTime(new Date('2024-07-20T17:00:00'));
      expect(businessLogic.getDayGreeting()).toBe('Добрый вечер');
      
      jest.setSystemTime(new Date('2024-07-20T22:00:00'));
      expect(businessLogic.getDayGreeting()).toBe('Добрый вечер');
    });

    it('should return night greeting', () => {
      jest.setSystemTime(new Date('2024-07-20T23:00:00'));
      expect(businessLogic.getDayGreeting()).toBe('Доброй ночи');
      
      jest.setSystemTime(new Date('2024-07-20T03:00:00'));
      expect(businessLogic.getDayGreeting()).toBe('Доброй ночи');
    });
  });

  describe('calculateOptimalSlots', () => {
    it('should limit slots based on business rules', () => {
      const slots = Array(20).fill(null).map((_, i) => ({
        time: `${10 + i}:00`,
        staff_id: 1
      }));
      
      const filtered = businessLogic.calculateOptimalSlots(slots, 'morning');
      
      expect(filtered.length).toBeLessThanOrEqual(5);
    });

    it('should prioritize diverse staff members', () => {
      const slots = [
        { time: '10:00', staff_id: 1, staff_name: 'Сергей' },
        { time: '10:30', staff_id: 1, staff_name: 'Сергей' },
        { time: '11:00', staff_id: 2, staff_name: 'Мария' },
        { time: '11:30', staff_id: 2, staff_name: 'Мария' },
        { time: '12:00', staff_id: 3, staff_name: 'Иван' }
      ];
      
      const filtered = businessLogic.calculateOptimalSlots(slots, 'morning');
      
      const uniqueStaff = new Set(filtered.map(s => s.staff_id));
      expect(uniqueStaff.size).toBeGreaterThan(1);
    });

    it('should handle empty slots', () => {
      const filtered = businessLogic.calculateOptimalSlots([], 'morning');
      
      expect(filtered).toEqual([]);
    });
  });
});