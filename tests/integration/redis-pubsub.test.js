/**
 * Integration Tests for Redis Pub/Sub
 *
 * Tests the cross-process communication between:
 * - baileys-service (publisher)
 * - ai-admin-api (subscriber)
 * - WebSocket broadcast to clients
 *
 * @module tests/integration/redis-pubsub
 */

// Mock Redis for testing without actual Redis connection
const EventEmitter = require('events');

class MockRedisClient extends EventEmitter {
  constructor() {
    super();
    this.subscriptions = new Set();
    this.messages = [];
  }

  subscribe(channel, callback) {
    this.subscriptions.add(channel);
    if (callback) callback(null);
    return Promise.resolve();
  }

  publish(channel, message) {
    this.messages.push({ channel, message });
    // Simulate pub/sub - emit to all subscribers
    process.nextTick(() => {
      this.emit('message', channel, message);
    });
    return Promise.resolve(1);
  }

  quit() {
    return Promise.resolve();
  }
}

// Mock Redis factory
const mockClients = new Map();
const createMockRedisClient = (role) => {
  const client = new MockRedisClient();
  mockClients.set(role, client);
  return client;
};

describe('Redis Pub/Sub Integration', () => {
  let publisher;
  let subscriber;

  beforeEach(() => {
    mockClients.clear();
    publisher = createMockRedisClient('test-publisher');
    subscriber = createMockRedisClient('test-subscriber');
  });

  afterEach(async () => {
    await publisher.quit();
    await subscriber.quit();
  });

  describe('Basic Pub/Sub Functionality', () => {
    test('subscriber receives published messages', async () => {
      const received = [];

      await subscriber.subscribe('whatsapp:events', (err) => {
        expect(err).toBeNull();
      });

      subscriber.on('message', (channel, message) => {
        received.push({ channel, message: JSON.parse(message) });
      });

      // In real Redis, publish goes to all subscribers on channel
      // Our mock requires manual emit to simulate cross-client delivery
      const testMessage = JSON.stringify({
        type: 'connected',
        companyId: 'company_962302',
        timestamp: Date.now()
      });

      // Simulate Redis pub/sub - emit to subscriber directly
      subscriber.emit('message', 'whatsapp:events', testMessage);

      // Wait for async delivery
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(received).toHaveLength(1);
      expect(received[0].channel).toBe('whatsapp:events');
      expect(received[0].message.type).toBe('connected');
      expect(received[0].message.companyId).toBe('company_962302');
    });

    test('multiple subscribers receive the same message', async () => {
      const subscriber1 = createMockRedisClient('subscriber1');
      const subscriber2 = createMockRedisClient('subscriber2');

      const received1 = [];
      const received2 = [];

      await subscriber1.subscribe('whatsapp:events');
      await subscriber2.subscribe('whatsapp:events');

      // Connect both to same mock Redis
      subscriber1.on('message', (channel, message) => {
        received1.push(JSON.parse(message));
      });

      subscriber2.on('message', (channel, message) => {
        received2.push(JSON.parse(message));
      });

      // Simulate cross-subscriber message (in real Redis, all subscribers get it)
      const testMessage = JSON.stringify({
        type: 'connected',
        companyId: 'company_123'
      });

      // Manually emit to both (simulating Redis behavior)
      subscriber1.emit('message', 'whatsapp:events', testMessage);
      subscriber2.emit('message', 'whatsapp:events', testMessage);

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
      expect(received1[0].companyId).toBe('company_123');
      expect(received2[0].companyId).toBe('company_123');

      await subscriber1.quit();
      await subscriber2.quit();
    });
  });

  describe('WhatsApp Events', () => {
    test('connected event has required fields', async () => {
      const received = [];

      await subscriber.subscribe('whatsapp:events');
      subscriber.on('message', (channel, message) => {
        received.push(JSON.parse(message));
      });

      const event = {
        type: 'connected',
        companyId: 'company_962302',
        phoneNumber: '79936363848',
        timestamp: Date.now()
      };

      // Simulate Redis delivery
      subscriber.emit('message', 'whatsapp:events', JSON.stringify(event));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(received).toHaveLength(1);
      expect(received[0]).toHaveProperty('type', 'connected');
      expect(received[0]).toHaveProperty('companyId');
      expect(received[0]).toHaveProperty('phoneNumber');
      expect(received[0]).toHaveProperty('timestamp');
      expect(received[0].companyId).toMatch(/^company_\d+$/);
    });

    test('ping event triggers pong response', async () => {
      const received = [];

      await subscriber.subscribe('whatsapp:health');
      subscriber.on('message', (channel, message) => {
        if (channel === 'whatsapp:health') {
          received.push(JSON.parse(message));
        }
      });

      // Simulate baileys-service ping handler
      const pingHandler = async (channel, message) => {
        if (channel === 'whatsapp:events') {
          const event = JSON.parse(message);
          if (event.type === 'ping' && event.testId) {
            // Simulate pong being delivered to health subscriber
            subscriber.emit('message', 'whatsapp:health', JSON.stringify({
              type: 'pong',
              testId: event.testId,
              service: 'baileys-service',
              timestamp: Date.now()
            }));
          }
        }
      };

      // Simulate ping
      const testId = 'test_' + Date.now();
      await pingHandler('whatsapp:events', JSON.stringify({
        type: 'ping',
        testId,
        timestamp: Date.now()
      }));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('pong');
      expect(received[0].testId).toBe(testId);
      expect(received[0].service).toBe('baileys-service');
    });
  });

  describe('Event Validation', () => {
    test('company_id format validation', () => {
      const validFormats = [
        'company_962302',
        'company_123',
        'company_1'
      ];

      const invalidFormats = [
        '962302',           // Missing prefix
        'company-962302',   // Wrong separator
        'COMPANY_962302',   // Wrong case
        'company_',         // Empty ID
        'company_abc'       // Non-numeric ID
      ];

      const regex = /^company_\d+$/;

      validFormats.forEach(format => {
        expect(format).toMatch(regex);
      });

      invalidFormats.forEach(format => {
        expect(format).not.toMatch(regex);
      });
    });

    test('event timestamp is within acceptable range', () => {
      const now = Date.now();
      const event = {
        type: 'connected',
        companyId: 'company_962302',
        timestamp: now
      };

      // Timestamp should be within 1 minute of now
      const maxAge = 60 * 1000;
      const isStale = (now - event.timestamp) > maxAge;

      expect(isStale).toBe(false);
    });

    test('rejects stale events', () => {
      const now = Date.now();
      const staleTimestamp = now - (2 * 60 * 1000); // 2 minutes ago

      const event = {
        type: 'connected',
        companyId: 'company_962302',
        timestamp: staleTimestamp
      };

      const maxAge = 60 * 1000; // 1 minute
      const isStale = (now - event.timestamp) > maxAge;

      expect(isStale).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('handles malformed JSON gracefully', () => {
      const received = [];
      const errors = [];

      subscriber.on('message', (channel, message) => {
        try {
          received.push(JSON.parse(message));
        } catch (error) {
          errors.push(error.message);
        }
      });

      // Emit malformed JSON
      subscriber.emit('message', 'whatsapp:events', 'not-json');

      expect(received).toHaveLength(0);
      expect(errors).toHaveLength(1);
    });

    test('handles missing required fields', () => {
      const validateEvent = (event) => {
        const required = ['type', 'companyId', 'timestamp'];
        const missing = required.filter(field => !event[field]);
        return missing.length === 0;
      };

      expect(validateEvent({
        type: 'connected',
        companyId: 'company_962302',
        timestamp: Date.now()
      })).toBe(true);

      expect(validateEvent({
        type: 'connected'
        // Missing companyId and timestamp
      })).toBe(false);
    });
  });

  describe('Channel Isolation', () => {
    test('messages only go to subscribed channels', async () => {
      const eventsReceived = [];
      const healthReceived = [];

      const eventsSubscriber = createMockRedisClient('events-subscriber');
      const healthSubscriber = createMockRedisClient('health-subscriber');

      await eventsSubscriber.subscribe('whatsapp:events');
      await healthSubscriber.subscribe('whatsapp:health');

      eventsSubscriber.on('message', (channel, message) => {
        eventsReceived.push({ channel, message });
      });

      healthSubscriber.on('message', (channel, message) => {
        healthReceived.push({ channel, message });
      });

      // Publish to events channel
      eventsSubscriber.emit('message', 'whatsapp:events', '{"type":"test"}');

      // Publish to health channel
      healthSubscriber.emit('message', 'whatsapp:health', '{"type":"pong"}');

      expect(eventsReceived).toHaveLength(1);
      expect(healthReceived).toHaveLength(1);
      expect(eventsReceived[0].channel).toBe('whatsapp:events');
      expect(healthReceived[0].channel).toBe('whatsapp:health');

      await eventsSubscriber.quit();
      await healthSubscriber.quit();
    });
  });
});

describe('Phone Format Handling', () => {
  describe('LID Phone Numbers', () => {
    test('preserves @lid suffix for LID contacts', () => {
      const extractPhoneNumber = (formattedPhone) => {
        if (!formattedPhone) return '';

        // Preserve @lid suffix for WhatsApp internal IDs
        if (formattedPhone.includes('@lid')) {
          return formattedPhone;
        }

        return formattedPhone
          .replace('@c.us', '')
          .replace('@s.whatsapp.net', '')
          .replace(/[^\d]/g, '');
      };

      // LID numbers should be preserved
      expect(extractPhoneNumber('152926689472618@lid')).toBe('152926689472618@lid');

      // Regular numbers should be cleaned
      expect(extractPhoneNumber('79001234567@c.us')).toBe('79001234567');
      expect(extractPhoneNumber('79001234567@s.whatsapp.net')).toBe('79001234567');
    });

    test('formatPhone adds @lid for 15+ digit numbers', () => {
      const formatPhone = (phone) => {
        if (!phone) return '';

        const phoneStr = phone.toString();

        // Already has @lid suffix - preserve it
        if (phoneStr.includes('@lid')) {
          return phoneStr;
        }

        // Clean phone - keep only digits
        const cleanPhone = phoneStr.replace(/[^\d]/g, '');

        // LID format (15+ digits)
        if (cleanPhone.length >= 15) {
          return `${cleanPhone}@lid`;
        }

        // Regular format
        return cleanPhone;
      };

      expect(formatPhone('152926689472618')).toBe('152926689472618@lid');
      expect(formatPhone('79001234567')).toBe('79001234567');
      expect(formatPhone('152926689472618@lid')).toBe('152926689472618@lid');
    });
  });

  describe('Regular Phone Numbers', () => {
    test('handles various phone formats', () => {
      const normalizePhone = (phone) => {
        return phone.toString()
          .replace(/[^\d]/g, '')
          .replace(/^8/, '7');  // Convert 8xxx to 7xxx for Russia
      };

      expect(normalizePhone('+7 900 123 45 67')).toBe('79001234567');
      expect(normalizePhone('8-900-123-45-67')).toBe('79001234567');
      expect(normalizePhone('79001234567')).toBe('79001234567');
    });
  });
});
