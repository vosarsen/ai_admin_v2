// src/__tests__/services/nlu/cache.test.js
const NLUCache = require('../../../services/nlu/cache');

describe('NLUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new NLUCache({ maxSize: 5, ttl: 1000 });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same input', () => {
      const message = 'Хочу записаться на маникюр';
      const context = { companyId: '12345', phone: '+79991234567' };

      const key1 = cache.generateKey(message, context);
      const key2 = cache.generateKey(message, context);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{32}$/); // MD5 hash
    });

    it('should generate different keys for different messages', () => {
      const context = { companyId: '12345', phone: '+79991234567' };

      const key1 = cache.generateKey('Хочу записаться', context);
      const key2 = cache.generateKey('Отменить запись', context);

      expect(key1).not.toBe(key2);
    });

    it('should normalize message case', () => {
      const context = { companyId: '12345', phone: '+79991234567' };

      const key1 = cache.generateKey('Хочу ЗАПИСАТЬСЯ', context);
      const key2 = cache.generateKey('хочу записаться', context);

      expect(key1).toBe(key2);
    });

    it('should include context in key generation', () => {
      const message = 'Хочу записаться';

      const key1 = cache.generateKey(message, { companyId: '12345', phone: '+79991234567' });
      const key2 = cache.generateKey(message, { companyId: '54321', phone: '+79991234567' });

      expect(key1).not.toBe(key2);
    });
  });

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      const key = 'test-key';
      const value = { intent: 'booking', entities: { service: 'маникюр' } };

      cache.set(key, value);
      const retrieved = cache.get(key);

      expect(retrieved).toEqual(value);
      expect(retrieved).not.toBe(value); // Should be a copy
    });

    it('should return null for missing keys', () => {
      expect(cache.get('non-existent')).toBeNull();
    });

    it('should update cache stats', () => {
      const key = 'test-key';
      cache.set(key, { test: true });

      // Miss
      cache.get('non-existent');
      expect(cache.stats.misses).toBe(1);

      // Hit
      cache.get(key);
      expect(cache.stats.hits).toBe(1);
    });

    it('should prevent mutation of cached values', () => {
      const key = 'test-key';
      const value = { entities: { service: 'маникюр' } };

      cache.set(key, value);
      
      // Mutate original
      value.entities.service = 'педикюр';
      
      const retrieved = cache.get(key);
      expect(retrieved.entities.service).toBe('маникюр');
      
      // Mutate retrieved
      retrieved.entities.service = 'стрижка';
      
      const retrievedAgain = cache.get(key);
      expect(retrievedAgain.entities.service).toBe('маникюр');
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const key = 'test-key';
      cache.set(key, { test: true }, 100); // 100ms TTL

      expect(cache.get(key)).not.toBeNull();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.get(key)).toBeNull();
      expect(cache.stats.misses).toBe(1);
    });

    it('should respect custom TTL', () => {
      cache.set('key1', { test: 1 }, 1000);
      cache.set('key2', { test: 2 }, 2000);

      const entry1 = cache.cache.get('key1');
      const entry2 = cache.cache.get('key2');

      expect(entry2.expiresAt - entry1.expiresAt).toBeCloseTo(1000, -2);
    });
  });

  describe('max size enforcement', () => {
    it('should evict oldest entry when max size reached', () => {
      // Fill cache to max size
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, { value: i });
      }

      expect(cache.cache.size).toBe(5);

      // Add one more
      cache.set('key5', { value: 5 });

      expect(cache.cache.size).toBe(5);
      expect(cache.get('key0')).toBeNull(); // Oldest evicted
      expect(cache.get('key5')).toEqual({ value: 5 }); // Newest present
      expect(cache.stats.evictions).toBe(1);
    });
  });

  describe('cleanExpired', () => {
    it('should remove expired entries', async () => {
      cache.set('key1', { test: 1 }, 100);
      cache.set('key2', { test: 2 }, 200);
      cache.set('key3', { test: 3 }, 1000);

      await new Promise(resolve => setTimeout(resolve, 150));

      const removed = cache.cleanExpired();

      expect(removed).toBe(1);
      expect(cache.cache.size).toBe(2);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).not.toBeNull();
      expect(cache.get('key3')).not.toBeNull();
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', { test: 1 });
      cache.set('key2', { test: 2 });
      cache.set('key3', { test: 3 });

      expect(cache.cache.size).toBe(3);

      cache.clear();

      expect(cache.cache.size).toBe(0);
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('key1', { test: 1 });
      cache.get('key1'); // hit
      cache.get('key2'); // miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(5);
      expect(stats.hitRate).toBe('50.00%');
    });

    it('should handle zero total requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe('0.00%');
    });
  });

  describe('getHitRate', () => {
    it('should return hit rate as decimal', () => {
      cache.set('key1', { test: 1 });
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key2'); // miss

      expect(cache.getHitRate()).toBeCloseTo(0.667, 2);
    });
  });
});