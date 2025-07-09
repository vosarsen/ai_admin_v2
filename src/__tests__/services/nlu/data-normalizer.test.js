// src/__tests__/services/nlu/data-normalizer.test.js
const DataNormalizer = require('../../../services/nlu/data-normalizer');

describe('DataNormalizer', () => {
  let normalizer;

  beforeEach(() => {
    normalizer = new DataNormalizer();
  });

  describe('normalizeDate', () => {
    it('should normalize relative dates', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);

      expect(normalizer.normalizeDate('сегодня')).toBe(today.toISOString().split('T')[0]);
      expect(normalizer.normalizeDate('завтра')).toBe(tomorrow.toISOString().split('T')[0]);
      expect(normalizer.normalizeDate('послезавтра')).toBe(dayAfter.toISOString().split('T')[0]);
    });

    it('should pass through ISO dates unchanged', () => {
      expect(normalizer.normalizeDate('2024-01-15')).toBe('2024-01-15');
      expect(normalizer.normalizeDate('2024-12-31')).toBe('2024-12-31');
    });

    it('should handle null and undefined', () => {
      expect(normalizer.normalizeDate(null)).toBeNull();
      expect(normalizer.normalizeDate(undefined)).toBeNull();
      expect(normalizer.normalizeDate('')).toBeNull();
    });

    it('should return original value for unrecognized dates', () => {
      expect(normalizer.normalizeDate('непонятная дата')).toBe('непонятная дата');
      expect(normalizer.normalizeDate('123')).toBe('123');
    });
  });

  describe('normalizeTime', () => {
    it('should normalize time expressions', () => {
      expect(normalizer.normalizeTime('утром')).toBe('09:00');
      expect(normalizer.normalizeTime('днем')).toBe('12:00');
      expect(normalizer.normalizeTime('днём')).toBe('12:00');
      expect(normalizer.normalizeTime('вечером')).toBe('18:00');
    });

    it('should normalize hour-only times', () => {
      expect(normalizer.normalizeTime('в 14')).toBe('14:00');
      expect(normalizer.normalizeTime('в 9')).toBe('09:00');
      expect(normalizer.normalizeTime('14 часов')).toBe('14:00');
    });

    it('should pass through HH:MM format unchanged', () => {
      expect(normalizer.normalizeTime('14:30')).toBe('14:30');
      expect(normalizer.normalizeTime('09:00')).toBe('09:00');
    });

    it('should handle null and undefined', () => {
      expect(normalizer.normalizeTime(null)).toBeNull();
      expect(normalizer.normalizeTime(undefined)).toBeNull();
      expect(normalizer.normalizeTime('')).toBeNull();
    });

    it('should return original value for unrecognized times', () => {
      expect(normalizer.normalizeTime('непонятное время')).toBe('непонятное время');
      expect(normalizer.normalizeTime('abc')).toBe('abc');
    });
  });

  describe('normalizeServiceName', () => {
    it('should normalize service name variations', () => {
      expect(normalizer.normalizeServiceName('маникюр')).toBe('маникюр');
      expect(normalizer.normalizeServiceName('Маникюр')).toBe('маникюр');
      expect(normalizer.normalizeServiceName('МАНИКЮР')).toBe('маникюр');
      expect(normalizer.normalizeServiceName('ногти')).toBe('маникюр');
      expect(normalizer.normalizeServiceName('ноготочки')).toBe('маникюр');
    });

    it('should normalize pedicure variations', () => {
      expect(normalizer.normalizeServiceName('педикюр')).toBe('педикюр');
      expect(normalizer.normalizeServiceName('Педикюр')).toBe('педикюр');
      expect(normalizer.normalizeServiceName('стопы')).toBe('педикюр');
      expect(normalizer.normalizeServiceName('ножки')).toBe('педикюр');
    });

    it('should normalize haircut variations', () => {
      expect(normalizer.normalizeServiceName('стрижка')).toBe('стрижка');
      expect(normalizer.normalizeServiceName('подстричься')).toBe('стрижка');
      expect(normalizer.normalizeServiceName('волосы')).toBe('стрижка');
    });

    it('should handle null and undefined', () => {
      expect(normalizer.normalizeServiceName(null)).toBeNull();
      expect(normalizer.normalizeServiceName(undefined)).toBeNull();
      expect(normalizer.normalizeServiceName('')).toBeNull();
    });

    it('should return lowercase for unrecognized services', () => {
      expect(normalizer.normalizeServiceName('Неизвестная Услуга')).toBe('неизвестная услуга');
      expect(normalizer.normalizeServiceName('ABC')).toBe('abc');
    });
  });

  describe('normalizeStaffName', () => {
    it('should normalize staff name variations', () => {
      expect(normalizer.normalizeStaffName('мария')).toBe('Мария');
      expect(normalizer.normalizeStaffName('Мария')).toBe('Мария');
      expect(normalizer.normalizeStaffName('МАРИЯ')).toBe('Мария');
      expect(normalizer.normalizeStaffName('маша')).toBe('Мария');
      expect(normalizer.normalizeStaffName('машенька')).toBe('Мария');
    });

    it('should normalize other staff variations', () => {
      expect(normalizer.normalizeStaffName('оля')).toBe('Ольга');
      expect(normalizer.normalizeStaffName('катя')).toBe('Екатерина');
      expect(normalizer.normalizeStaffName('лена')).toBe('Елена');
      expect(normalizer.normalizeStaffName('наташа')).toBe('Наталья');
    });

    it('should capitalize first letter for unknown names', () => {
      expect(normalizer.normalizeStaffName('анастасия')).toBe('Анастасия');
      expect(normalizer.normalizeStaffName('владимир')).toBe('Владимир');
    });

    it('should handle null and undefined', () => {
      expect(normalizer.normalizeStaffName(null)).toBeNull();
      expect(normalizer.normalizeStaffName(undefined)).toBeNull();
      expect(normalizer.normalizeStaffName('')).toBeNull();
    });

    it('should handle special cases', () => {
      expect(normalizer.normalizeStaffName('любой')).toBe('любой');
      expect(normalizer.normalizeStaffName('Любой')).toBe('любой');
      expect(normalizer.normalizeStaffName('без разницы')).toBe('любой');
      expect(normalizer.normalizeStaffName('кто угодно')).toBe('любой');
    });
  });

  describe('normalizeEntities', () => {
    it('should normalize all entity types', () => {
      const entities = {
        service: 'НОГТИ',
        staff: 'маша',
        date: 'завтра',
        time: 'утром'
      };

      const normalized = normalizer.normalizeEntities(entities);
      
      expect(normalized.service).toBe('маникюр');
      expect(normalized.staff).toBe('Мария');
      expect(normalized.time).toBe('09:00');
      // Date will be tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(normalized.date).toBe(tomorrow.toISOString().split('T')[0]);
    });

    it('should handle missing entities', () => {
      const entities = {
        service: 'маникюр'
        // other fields missing
      };

      const normalized = normalizer.normalizeEntities(entities);
      
      expect(normalized.service).toBe('маникюр');
      expect(normalized.staff).toBeUndefined();
      expect(normalized.date).toBeUndefined();
      expect(normalized.time).toBeUndefined();
    });

    it('should preserve unrecognized fields', () => {
      const entities = {
        service: 'маникюр',
        customField: 'value',
        anotherField: 123
      };

      const normalized = normalizer.normalizeEntities(entities);
      
      expect(normalized.service).toBe('маникюр');
      expect(normalized.customField).toBe('value');
      expect(normalized.anotherField).toBe(123);
    });

    it('should handle null entities', () => {
      expect(normalizer.normalizeEntities(null)).toEqual({});
      expect(normalizer.normalizeEntities(undefined)).toEqual({});
    });

    it('should handle non-object entities', () => {
      expect(normalizer.normalizeEntities('string')).toEqual({});
      expect(normalizer.normalizeEntities(123)).toEqual({});
      expect(normalizer.normalizeEntities([])).toEqual({});
    });
  });
});