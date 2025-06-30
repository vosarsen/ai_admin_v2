// src/__tests__/utils/data-transformers.test.js
const DataTransformers = require('../../utils/data-transformers');

describe('DataTransformers', () => {
  describe('normalizePhoneNumber', () => {
    it('should normalize Russian phone numbers', () => {
      expect(DataTransformers.normalizePhoneNumber('79936363848')).toBe('+79936363848');
      expect(DataTransformers.normalizePhoneNumber('+79936363848')).toBe('+79936363848');
      expect(DataTransformers.normalizePhoneNumber('89936363848')).toBe('+79936363848');
      expect(DataTransformers.normalizePhoneNumber('9936363848')).toBe('+79936363848');
    });

    it('should handle WhatsApp format', () => {
      expect(DataTransformers.normalizePhoneNumber('79936363848@c.us')).toBe('+79936363848');
    });

    it('should remove non-numeric characters', () => {
      expect(DataTransformers.normalizePhoneNumber('+7 (993) 636-38-48')).toBe('+79936363848');
      expect(DataTransformers.normalizePhoneNumber('8-993-636-38-48')).toBe('+79936363848');
    });

    it('should return null for invalid phone numbers', () => {
      expect(DataTransformers.normalizePhoneNumber('')).toBeNull();
      expect(DataTransformers.normalizePhoneNumber('123')).toBeNull();
      expect(DataTransformers.normalizePhoneNumber('abc')).toBeNull();
    });
  });

  describe('formatDateTime', () => {
    it('should format date to Moscow timezone', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const formatted = DataTransformers.formatDateTime(date);
      expect(formatted).toContain('15.01.2024');
    });

    it('should handle string dates', () => {
      const formatted = DataTransformers.formatDateTime('2024-01-15T10:00:00Z');
      expect(formatted).toContain('15.01.2024');
    });

    it('should use custom format', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const formatted = DataTransformers.formatDateTime(date, 'yyyy-MM-dd');
      expect(formatted).toBe('2024-01-15');
    });
  });

  describe('parseDateTime', () => {
    it('should parse Russian date format', () => {
      const parsed = DataTransformers.parseDateTime('15.01.2024 14:30');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getFullYear()).toBe(2024);
      expect(parsed.getMonth()).toBe(0);
      expect(parsed.getDate()).toBe(15);
    });

    it('should parse ISO format', () => {
      const parsed = DataTransformers.parseDateTime('2024-01-15T14:30:00');
      expect(parsed).toBeInstanceOf(Date);
    });

    it('should parse with custom format', () => {
      const parsed = DataTransformers.parseDateTime('15/01/2024', 'dd/MM/yyyy');
      expect(parsed.getFullYear()).toBe(2024);
    });
  });

  describe('sanitizeInput', () => {
    it('should trim whitespace', () => {
      expect(DataTransformers.sanitizeInput('  hello  ')).toBe('hello');
    });

    it('should remove control characters', () => {
      expect(DataTransformers.sanitizeInput('hello\x00world')).toBe('helloworld');
      expect(DataTransformers.sanitizeInput('test\x1F\x7F')).toBe('test');
    });

    it('should limit length', () => {
      const longString = 'a'.repeat(1500);
      expect(DataTransformers.sanitizeInput(longString).length).toBe(1000);
    });

    it('should handle empty input', () => {
      expect(DataTransformers.sanitizeInput('')).toBe('');
      expect(DataTransformers.sanitizeInput(null)).toBe('');
      expect(DataTransformers.sanitizeInput(undefined)).toBe('');
    });
  });

  describe('parseNumber', () => {
    it('should parse valid numbers', () => {
      expect(DataTransformers.parseNumber('123')).toBe(123);
      expect(DataTransformers.parseNumber('123.45')).toBe(123.45);
      expect(DataTransformers.parseNumber(123)).toBe(123);
    });

    it('should return default for invalid numbers', () => {
      expect(DataTransformers.parseNumber('abc', 0)).toBe(0);
      expect(DataTransformers.parseNumber('', 10)).toBe(10);
      expect(DataTransformers.parseNumber(null, 5)).toBe(5);
    });
  });

  describe('normalizeString', () => {
    it('should normalize for search', () => {
      expect(DataTransformers.normalizeString('МАНИКЮР')).toBe('маникюр');
      expect(DataTransformers.normalizeString('  Педикюр  ')).toBe('педикюр');
      expect(DataTransformers.normalizeString('Массаж\n')).toBe('массаж');
    });

    it('should handle empty strings', () => {
      expect(DataTransformers.normalizeString('')).toBe('');
      expect(DataTransformers.normalizeString(null)).toBe('');
    });
  });
});