/**
 * Phone number utility functions for WhatsApp integration
 * Provides consistent phone normalization across all modules
 *
 * @module phone-utils
 */

const logger = require('../../utils/logger');

// Configuration
const CONFIG = {
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 15,
  DEFAULT_COUNTRY_CODE: '7', // Russia
  // Common country codes for validation (whitelist)
  VALID_COUNTRY_CODES: ['1', '7', '44', '49', '33', '39', '81', '86', '91', '380', '375', '998', '996', '992']
};

/**
 * Normalizes phone number to E.164 format (without + sign)
 * Handles various input formats and converts to standard format
 *
 * @param {string} phone - Phone number in any format
 * @returns {string} - E.164 formatted number (digits only, no +)
 * @throws {Error} - If phone number is invalid
 *
 * @example
 * normalizePhoneE164('89001234567')   // => '79001234567' (Russian 8 -> 7)
 * normalizePhoneE164('+79001234567')  // => '79001234567' (removes +)
 * normalizePhoneE164('9001234567')    // => '79001234567' (adds country code)
 * normalizePhoneE164('79001234567')   // => '79001234567' (unchanged)
 * normalizePhoneE164('+1-800-555-1234') // => '18005551234' (removes formatting)
 */
function normalizePhoneE164(phone) {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number is required and must be a string');
  }

  // Remove all non-digit characters (including +, -, spaces, etc.)
  let cleaned = phone.replace(/\D/g, '');

  // Validate length
  if (cleaned.length < CONFIG.MIN_PHONE_LENGTH) {
    throw new Error(`Phone number too short: ${cleaned.length} digits. Minimum: ${CONFIG.MIN_PHONE_LENGTH}`);
  }

  if (cleaned.length > CONFIG.MAX_PHONE_LENGTH) {
    throw new Error(`Phone number too long: ${cleaned.length} digits. Maximum: ${CONFIG.MAX_PHONE_LENGTH}`);
  }

  // Convert Russian mobile format (8 -> 7)
  // If starts with 8 and length is 11 (Russian mobile format), replace with 7
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.slice(1);
  }

  // If doesn't start with valid country code and length is 10, assume default country (Russia)
  if (cleaned.length === 10) {
    cleaned = CONFIG.DEFAULT_COUNTRY_CODE + cleaned;
  }

  return cleaned;
}

/**
 * Validates if a phone number has a valid country code
 * Uses whitelist of common country codes
 *
 * @param {string} phone - Normalized phone number (digits only)
 * @returns {{ valid: boolean, countryCode: string|null, message: string }}
 *
 * @example
 * validateCountryCode('79001234567')  // => { valid: true, countryCode: '7', message: 'OK' }
 * validateCountryCode('11234567890')  // => { valid: false, countryCode: null, message: 'Invalid...' }
 */
function validateCountryCode(phone) {
  if (!phone || phone.length < CONFIG.MIN_PHONE_LENGTH) {
    return {
      valid: false,
      countryCode: null,
      message: 'Phone number too short for country code validation'
    };
  }

  // Check against whitelist of country codes (1-3 digits)
  for (const code of CONFIG.VALID_COUNTRY_CODES) {
    if (phone.startsWith(code)) {
      return {
        valid: true,
        countryCode: code,
        message: 'OK'
      };
    }
  }

  // No matching country code found
  return {
    valid: false,
    countryCode: null,
    message: `Unknown country code. Number starts with: ${phone.substring(0, 3)}. Use international format (e.g., +7...)`
  };
}

/**
 * Formats phone number to WhatsApp JID format
 *
 * @param {string} phone - Phone number in any format
 * @returns {string} - WhatsApp JID (e.g., "79001234567@s.whatsapp.net")
 *
 * @example
 * formatPhoneToJID('89001234567') // => '79001234567@s.whatsapp.net'
 */
function formatPhoneToJID(phone) {
  return `${normalizePhoneE164(phone)}@s.whatsapp.net`;
}

/**
 * Extracts phone number from WhatsApp JID
 *
 * @param {string} jid - WhatsApp JID (e.g., "79001234567@s.whatsapp.net")
 * @returns {string|null} - Phone number or null if invalid
 *
 * @example
 * extractPhoneFromJID('79001234567@s.whatsapp.net') // => '79001234567'
 * extractPhoneFromJID('79001234567:5@s.whatsapp.net') // => '79001234567' (with device suffix)
 */
function extractPhoneFromJID(jid) {
  if (!jid || typeof jid !== 'string') {
    return null;
  }

  // Remove @s.whatsapp.net or @c.us suffix
  const parts = jid.split('@');
  if (parts.length < 1) {
    return null;
  }

  // Remove device suffix (e.g., ":5" in "79001234567:5")
  const phonePart = parts[0].split(':')[0];

  // Clean and validate
  const cleaned = phonePart.replace(/\D/g, '');

  if (cleaned.length < CONFIG.MIN_PHONE_LENGTH) {
    return null;
  }

  return cleaned;
}

/**
 * Compares two phone numbers for equality (ignoring format differences)
 *
 * @param {string} phone1 - First phone number
 * @param {string} phone2 - Second phone number
 * @returns {boolean} - True if phone numbers are equivalent
 *
 * @example
 * phonesMatch('89001234567', '79001234567')  // => true (8 and 7 are same)
 * phonesMatch('+7 900 123-45-67', '79001234567') // => true (ignores formatting)
 */
function phonesMatch(phone1, phone2) {
  try {
    const normalized1 = normalizePhoneE164(phone1);
    const normalized2 = normalizePhoneE164(phone2);
    return normalized1 === normalized2;
  } catch (error) {
    // If normalization fails, phones don't match
    logger.debug('Phone comparison failed:', { phone1, phone2, error: error.message });
    return false;
  }
}

/**
 * Masks phone number for logging (GDPR compliance)
 *
 * @param {string} phone - Phone number
 * @returns {string} - Masked phone (e.g., "7900***4567")
 *
 * @example
 * maskPhone('79001234567') // => '7900***4567'
 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) {
    return '***';
  }

  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length < 7) {
    return '***';
  }

  // Show first 4 and last 4 digits
  return `${cleaned.substring(0, 4)}***${cleaned.substring(cleaned.length - 4)}`;
}

module.exports = {
  normalizePhoneE164,
  validateCountryCode,
  formatPhoneToJID,
  extractPhoneFromJID,
  phonesMatch,
  maskPhone,
  CONFIG
};
