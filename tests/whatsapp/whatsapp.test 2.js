/**
 * WhatsApp Integration Tests
 * Comprehensive test suite for WhatsApp functionality
 */

const whatsappManager = require('../../src/integrations/whatsapp/whatsapp-manager-unified');
const { getSessionPool } = require('../../src/integrations/whatsapp/session-pool');
const WhatsAppValidator = require('../../src/utils/whatsapp-validator');
const { ValidationError, ConnectionError, MessageSendError } = require('../../src/utils/whatsapp-errors');

// Mock dependencies
jest.mock('../../src/integrations/whatsapp/session-pool');
jest.mock('../../src/utils/logger');

describe('WhatsApp Manager Tests', () => {
  let sessionPoolMock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup session pool mock
    sessionPoolMock = {
      getOrCreateSession: jest.fn(),
      sendMessage: jest.fn(),
      sendReaction: jest.fn(),
      removeSession: jest.fn(),
      getSessionStatus: jest.fn(),
      getQRCode: jest.fn(),
      requestPairingCode: jest.fn(),
      healthCheck: jest.fn(),
      getActiveSessions: jest.fn(),
      getMetrics: jest.fn(),
      shutdown: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };

    getSessionPool.mockReturnValue(sessionPoolMock);
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await whatsappManager.initialize();
      expect(whatsappManager.isInitialized).toBe(true);
      expect(getSessionPool).toHaveBeenCalled();
    });

    test('should not reinitialize if already initialized', async () => {
      whatsappManager.isInitialized = true;
      await whatsappManager.initialize();
      expect(getSessionPool).not.toHaveBeenCalled();
    });

    test('should handle initialization failure', async () => {
      getSessionPool.mockReturnValue(null);
      await expect(whatsappManager.initialize()).rejects.toThrow('Failed to get session pool instance');
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      await whatsappManager.initialize();
    });

    test('should send text message successfully', async () => {
      sessionPoolMock.sendMessage.mockResolvedValue({ messageId: 'msg123' });

      const result = await whatsappManager.sendMessage(
        '79001234567',
        'Test message',
        { companyId: '962302' }
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg123');
      expect(sessionPoolMock.sendMessage).toHaveBeenCalledWith(
        '962302',
        '79001234567',
        'Test message',
        { companyId: '962302' }
      );
    });

    test('should validate phone number', async () => {
      await expect(
        whatsappManager.sendMessage('invalid', 'Test', { companyId: '962302' })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate message content', async () => {
      await expect(
        whatsappManager.sendMessage('79001234567', '', { companyId: '962302' })
      ).rejects.toThrow(ValidationError);
    });

    test('should require company ID in multi-tenant mode', async () => {
      whatsappManager.defaultCompanyId = null;

      await expect(
        whatsappManager.sendMessage('79001234567', 'Test')
      ).rejects.toThrow('Company ID is required');
    });

    test('should handle send failure', async () => {
      sessionPoolMock.sendMessage.mockRejectedValue(new Error('Network error'));

      await expect(
        whatsappManager.sendMessage('79001234567', 'Test', { companyId: '962302' })
      ).rejects.toThrow(MessageSendError);
    });
  });

  describe('Reaction Sending', () => {
    beforeEach(async () => {
      await whatsappManager.initialize();
    });

    test('should send reaction successfully', async () => {
      sessionPoolMock.sendReaction.mockResolvedValue(true);

      const result = await whatsappManager.sendReaction(
        '79001234567',
        '👍',
        'msg123',
        { companyId: '962302' }
      );

      expect(result.success).toBe(true);
      expect(sessionPoolMock.sendReaction).toHaveBeenCalledWith(
        '962302',
        '79001234567',
        '👍',
        'msg123'
      );
    });
  });

  describe('Media Sending', () => {
    beforeEach(async () => {
      await whatsappManager.initialize();
    });

    test('should send media message successfully', async () => {
      sessionPoolMock.sendMessage.mockResolvedValue({ messageId: 'media123' });

      const result = await whatsappManager.sendMedia(
        '79001234567',
        'https://example.com/image.jpg',
        'Check this out',
        { companyId: '962302' }
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('media123');
      expect(sessionPoolMock.sendMessage).toHaveBeenCalledWith(
        '962302',
        '79001234567',
        'Check this out',
        expect.objectContaining({ media: 'https://example.com/image.jpg' })
      );
    });

    test('should validate media URL', async () => {
      await expect(
        whatsappManager.sendMedia(
          '79001234567',
          'not-a-url',
          'Caption',
          { companyId: '962302' }
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await whatsappManager.initialize();
    });

    test('should connect session', async () => {
      sessionPoolMock.getOrCreateSession.mockResolvedValue({ id: 'session123' });

      const result = await whatsappManager.connect('962302');

      expect(result.success).toBe(true);
      expect(result.companyId).toBe('962302');
      expect(sessionPoolMock.getOrCreateSession).toHaveBeenCalledWith('962302', {});
    });

    test('should disconnect session', async () => {
      sessionPoolMock.removeSession.mockResolvedValue(true);

      const result = await whatsappManager.disconnect('962302');

      expect(result.success).toBe(true);
      expect(result.status).toBe('disconnected');
      expect(sessionPoolMock.removeSession).toHaveBeenCalledWith('962302');
    });

    test('should get session status', async () => {
      const mockStatus = { connected: true, phoneNumber: '79001234567' };
      sessionPoolMock.getSessionStatus.mockReturnValue(mockStatus);

      const status = await whatsappManager.getStatus('962302');

      expect(status).toEqual(mockStatus);
      expect(sessionPoolMock.getSessionStatus).toHaveBeenCalledWith('962302');
    });

    test('should get QR code', async () => {
      const mockQR = { type: 'qr', code: 'qr-code-data' };
      sessionPoolMock.getQRCode.mockReturnValue(mockQR);

      const qr = await whatsappManager.getQRCode('962302');

      expect(qr).toEqual(mockQR);
      expect(sessionPoolMock.getQRCode).toHaveBeenCalledWith('962302');
    });

    test('should handle missing QR code', async () => {
      sessionPoolMock.getQRCode.mockReturnValue(null);

      await expect(
        whatsappManager.getQRCode('962302')
      ).rejects.toThrow('No QR code available');
    });
  });

  describe('Pairing Code', () => {
    beforeEach(async () => {
      await whatsappManager.initialize();
    });

    test('should request pairing code successfully', async () => {
      sessionPoolMock.requestPairingCode.mockResolvedValue('1234-5678');

      const result = await whatsappManager.requestPairingCode('962302', '79001234567');

      expect(result.success).toBe(true);
      expect(result.code).toBe('1234-5678');
      expect(result.expiresIn).toBe(60);
      expect(sessionPoolMock.requestPairingCode).toHaveBeenCalledWith(
        '962302',
        '79001234567'
      );
    });

    test('should validate phone number for pairing code', async () => {
      await expect(
        whatsappManager.requestPairingCode('962302', 'invalid-phone')
      ).rejects.toThrow(ValidationError);
    });

    test('should handle pairing code failure', async () => {
      sessionPoolMock.requestPairingCode.mockResolvedValue(null);

      await expect(
        whatsappManager.requestPairingCode('962302', '79001234567')
      ).rejects.toThrow('Failed to generate pairing code');
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      await whatsappManager.initialize();
    });

    test('should check health for specific company', async () => {
      const mockHealth = { healthy: true, companyId: '962302' };
      sessionPoolMock.healthCheck.mockResolvedValue(mockHealth);

      const health = await whatsappManager.healthCheck('962302');

      expect(health).toEqual(mockHealth);
      expect(sessionPoolMock.healthCheck).toHaveBeenCalledWith('962302');
    });

    test('should check overall system health', async () => {
      const mockSessions = [
        { companyId: '1', connected: true },
        { companyId: '2', connected: false }
      ];
      const mockMetrics = { errors: 5, startTime: Date.now() - 3600000 };

      sessionPoolMock.getActiveSessions.mockReturnValue(mockSessions);
      sessionPoolMock.getMetrics.mockReturnValue(mockMetrics);

      const health = await whatsappManager.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.totalSessions).toBe(2);
      expect(health.activeSessions).toBe(1);
      expect(health.errors).toBe(5);
    });

    test('should mark as unhealthy on errors', async () => {
      sessionPoolMock.getActiveSessions.mockReturnValue([]);
      sessionPoolMock.getMetrics.mockReturnValue({ errors: 15 });

      const health = await whatsappManager.healthCheck();

      expect(health.healthy).toBe(false);
    });
  });

  describe('Metrics', () => {
    test('should get company metrics', () => {
      const metrics = whatsappManager.getMetrics('962302');

      expect(metrics).toBeDefined();
      // Metrics should be from the metrics instance
    });

    test('should get global metrics', () => {
      const metrics = whatsappManager.getMetrics();

      expect(metrics.global).toBeDefined();
      expect(metrics.performance).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      await whatsappManager.initialize();
    });

    test('should shutdown properly', async () => {
      await whatsappManager.shutdown();

      expect(whatsappManager.isInitialized).toBe(false);
      expect(sessionPoolMock.shutdown).toHaveBeenCalled();
    });
  });
});

describe('WhatsApp Validator Tests', () => {
  describe('Phone Validation', () => {
    test('should validate correct phone number', () => {
      const result = WhatsAppValidator.validatePhone('79001234567');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('79001234567');
    });

    test('should reject invalid phone number', () => {
      const result = WhatsAppValidator.validatePhone('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid phone');
    });

    test('should sanitize phone with special characters', () => {
      const result = WhatsAppValidator.validatePhone('+7 (900) 123-45-67');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('79001234567');
    });
  });

  describe('Message Validation', () => {
    test('should validate correct message', () => {
      const result = WhatsAppValidator.validateMessage('79001234567', 'Hello World');
      expect(result.valid).toBe(true);
    });

    test('should reject empty message', () => {
      const result = WhatsAppValidator.validateMessage('79001234567', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Message cannot be empty');
    });

    test('should reject too long message', () => {
      const longMessage = 'a'.repeat(5001);
      const result = WhatsAppValidator.validateMessage('79001234567', longMessage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('Company ID Validation', () => {
    test('should validate correct company ID', () => {
      const result = WhatsAppValidator.validateCompanyId('company_962302');
      expect(result.valid).toBe(true);
    });

    test('should reject invalid company ID format', () => {
      const result = WhatsAppValidator.validateCompanyId('company@123');
      expect(result.valid).toBe(false);
    });
  });

  describe('Media URL Validation', () => {
    test('should validate correct URL', () => {
      const result = WhatsAppValidator.validateMediaUrl('https://example.com/image.jpg');
      expect(result.valid).toBe(true);
    });

    test('should reject invalid URL', () => {
      const result = WhatsAppValidator.validateMediaUrl('not-a-url');
      expect(result.valid).toBe(false);
    });

    test('should validate data URLs', () => {
      const result = WhatsAppValidator.validateMediaUrl('data:image/jpeg;base64,/9j/4AA...');
      expect(result.valid).toBe(true);
    });
  });
});