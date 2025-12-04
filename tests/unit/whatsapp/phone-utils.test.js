/**
 * Unit tests for phone-utils module
 */

const {
  normalizePhoneE164,
  validateCountryCode,
  formatPhoneToJID,
  extractPhoneFromJID,
  phonesMatch,
  maskPhone
} = require('../../../src/integrations/whatsapp/phone-utils');

describe('phone-utils', () => {
  describe('normalizePhoneE164', () => {
    test('converts Russian 8 prefix to 7', () => {
      expect(normalizePhoneE164('89001234567')).toBe('79001234567');
    });

    test('handles international format with +', () => {
      expect(normalizePhoneE164('+79001234567')).toBe('79001234567');
    });

    test('adds country code for 10-digit numbers', () => {
      expect(normalizePhoneE164('9001234567')).toBe('79001234567');
    });

    test('keeps valid 11-digit Russian number unchanged', () => {
      expect(normalizePhoneE164('79001234567')).toBe('79001234567');
    });

    test('removes formatting characters', () => {
      expect(normalizePhoneE164('+7 (900) 123-45-67')).toBe('79001234567');
      expect(normalizePhoneE164('7-900-123-45-67')).toBe('79001234567');
    });

    test('handles US numbers', () => {
      expect(normalizePhoneE164('+18005551234')).toBe('18005551234');
      expect(normalizePhoneE164('1-800-555-1234')).toBe('18005551234');
    });

    test('throws on too short number', () => {
      expect(() => normalizePhoneE164('123')).toThrow('too short');
      expect(() => normalizePhoneE164('123456789')).toThrow('too short');
    });

    test('throws on too long number', () => {
      expect(() => normalizePhoneE164('1234567890123456')).toThrow('too long');
    });

    test('throws on empty input', () => {
      expect(() => normalizePhoneE164('')).toThrow('required');
      expect(() => normalizePhoneE164(null)).toThrow('required');
      expect(() => normalizePhoneE164(undefined)).toThrow('required');
    });

    test('throws on non-string input', () => {
      expect(() => normalizePhoneE164(79001234567)).toThrow('must be a string');
    });
  });

  describe('validateCountryCode', () => {
    test('validates Russian numbers', () => {
      const result = validateCountryCode('79001234567');
      expect(result.valid).toBe(true);
      expect(result.countryCode).toBe('7');
    });

    test('validates US numbers', () => {
      const result = validateCountryCode('18005551234');
      expect(result.valid).toBe(true);
      expect(result.countryCode).toBe('1');
    });

    test('validates UK numbers', () => {
      const result = validateCountryCode('447911123456');
      expect(result.valid).toBe(true);
      expect(result.countryCode).toBe('44');
    });

    test('validates Ukrainian numbers', () => {
      const result = validateCountryCode('380501234567');
      expect(result.valid).toBe(true);
      expect(result.countryCode).toBe('380');
    });

    test('rejects unknown country codes', () => {
      const result = validateCountryCode('99912345678');
      expect(result.valid).toBe(false);
      expect(result.countryCode).toBeNull();
    });

    test('handles short numbers', () => {
      const result = validateCountryCode('123');
      expect(result.valid).toBe(false);
    });
  });

  describe('formatPhoneToJID', () => {
    test('formats normalized number to JID', () => {
      expect(formatPhoneToJID('79001234567')).toBe('79001234567@s.whatsapp.net');
    });

    test('normalizes and formats', () => {
      expect(formatPhoneToJID('89001234567')).toBe('79001234567@s.whatsapp.net');
      expect(formatPhoneToJID('+7 900 123 45 67')).toBe('79001234567@s.whatsapp.net');
    });
  });

  describe('extractPhoneFromJID', () => {
    test('extracts phone from standard JID', () => {
      expect(extractPhoneFromJID('79001234567@s.whatsapp.net')).toBe('79001234567');
    });

    test('extracts phone from JID with device suffix', () => {
      expect(extractPhoneFromJID('79001234567:5@s.whatsapp.net')).toBe('79001234567');
      expect(extractPhoneFromJID('79001234567:37@s.whatsapp.net')).toBe('79001234567');
    });

    test('extracts phone from group JID', () => {
      expect(extractPhoneFromJID('79001234567@c.us')).toBe('79001234567');
    });

    test('returns null for invalid input', () => {
      expect(extractPhoneFromJID(null)).toBeNull();
      expect(extractPhoneFromJID('')).toBeNull();
      expect(extractPhoneFromJID('invalid')).toBeNull();
      expect(extractPhoneFromJID('123@s.whatsapp.net')).toBeNull(); // Too short
    });
  });

  describe('phonesMatch', () => {
    test('matches same numbers', () => {
      expect(phonesMatch('79001234567', '79001234567')).toBe(true);
    });

    test('matches 8 and 7 prefix variations', () => {
      expect(phonesMatch('89001234567', '79001234567')).toBe(true);
      expect(phonesMatch('79001234567', '89001234567')).toBe(true);
    });

    test('matches formatted and unformatted', () => {
      expect(phonesMatch('+7 (900) 123-45-67', '79001234567')).toBe(true);
      expect(phonesMatch('7-900-123-45-67', '+79001234567')).toBe(true);
    });

    test('matches 10-digit with country code added', () => {
      expect(phonesMatch('9001234567', '79001234567')).toBe(true);
    });

    test('detects different numbers', () => {
      expect(phonesMatch('79001234567', '79001234568')).toBe(false);
      expect(phonesMatch('79001234567', '79002234567')).toBe(false);
    });

    test('returns false for invalid numbers', () => {
      expect(phonesMatch('123', '79001234567')).toBe(false);
      expect(phonesMatch('79001234567', '456')).toBe(false);
    });
  });

  describe('maskPhone', () => {
    test('masks middle digits', () => {
      expect(maskPhone('79001234567')).toBe('7900***4567');
    });

    test('handles formatted numbers', () => {
      expect(maskPhone('+7 900 123 45 67')).toBe('7900***4567');
    });

    test('handles short numbers', () => {
      expect(maskPhone('123456')).toBe('***');
      expect(maskPhone('12345')).toBe('***');
    });

    test('handles empty/null', () => {
      expect(maskPhone('')).toBe('***');
      expect(maskPhone(null)).toBe('***');
      expect(maskPhone(undefined)).toBe('***');
    });
  });
});
