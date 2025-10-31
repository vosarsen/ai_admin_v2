const LRUCache = require('../lru-cache');

describe('LRU Cache', () => {
  let cache;

  beforeEach(() => {
    // Создаем новый экземпляр кэша перед каждым тестом
    cache = new LRUCache(3, 1000); // maxSize: 3, ttl: 1 секунда
  });

  afterEach(() => {
    // Очищаем интервал после каждого теста
    if (cache) {
      cache.destroy();
    }
  });

  describe('Basic operations', () => {
    test('should set and get value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should return null for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    test('should delete key', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      
      cache.delete('key1');
      expect(cache.get('key1')).toBeNull();
    });

    test('should clear all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
      expect(cache.cache.size).toBe(0);
    });
  });

  describe('LRU behavior', () => {
    test('should evict least recently used item when max size reached', () => {
      // Заполняем кэш до максимума
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Добавляем еще один элемент - должен вытеснить key1
      cache.set('key4', 'value4');
      
      expect(cache.get('key1')).toBeNull(); // вытеснен
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should update LRU order on get', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Обращаемся к key1, делая его наиболее свежим
      cache.get('key1');
      
      // Добавляем новый элемент - должен вытеснить key2
      cache.set('key4', 'value4');
      
      expect(cache.get('key1')).toBe('value1'); // остался
      expect(cache.get('key2')).toBeNull(); // вытеснен
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should update value and move to end on re-set', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Обновляем key1
      cache.set('key1', 'newValue1');
      
      // Добавляем новый элемент - должен вытеснить key2
      cache.set('key4', 'value4');
      
      expect(cache.get('key1')).toBe('newValue1');
      expect(cache.get('key2')).toBeNull(); // вытеснен
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });
  });

  describe('TTL behavior', () => {
    test('should return null for expired items', async () => {
      cache.set('key1', 'value1');
      
      // Проверяем, что значение доступно сразу
      expect(cache.get('key1')).toBe('value1');
      
      // Ждем истечения TTL
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Значение должно быть недоступно
      expect(cache.get('key1')).toBeNull();
    });

    test('should not update expired items in LRU order', async () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      // Ждем истечения TTL для key1
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Пытаемся получить истекший key1
      expect(cache.get('key1')).toBeNull();
      
      // key1 должен быть удален из кэша
      expect(cache.cache.has('key1')).toBe(false);
    });

    test('cleanup should remove expired items', async () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      // Ждем истечения TTL
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Добавляем новый элемент, чтобы он не истек
      cache.set('key3', 'value3');
      
      // Запускаем очистку
      cache.cleanup();
      
      // Истекшие элементы должны быть удалены
      expect(cache.cache.has('key1')).toBe(false);
      expect(cache.cache.has('key2')).toBe(false);
      expect(cache.cache.has('key3')).toBe(true);
    });
  });

  describe('Stats', () => {
    test('should return correct stats', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.ttl).toBe(1000);
      expect(stats.stats).toBeDefined();
    });

    test('should update size in stats', () => {
      expect(cache.getStats().size).toBe(0);
      
      cache.set('key1', 'value1');
      expect(cache.getStats().size).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.getStats().size).toBe(2);
      
      cache.delete('key1');
      expect(cache.getStats().size).toBe(1);
      
      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });

    test('should track hit rate correctly', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.get('key1'); // hit
      cache.get('key2'); // hit
      cache.get('key3'); // miss
      
      const stats = cache.getStats();
      expect(stats.stats.hits).toBe(2);
      expect(stats.stats.misses).toBe(1);
      expect(stats.stats.hitRate).toBe('66.67%');
    });

    test('should track evictions', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // evicts key1
      
      const stats = cache.getStats();
      expect(stats.stats.evictions).toBe(1);
    });
  });

  describe('Edge cases', () => {
    test('should handle zero maxSize', () => {
      const zeroCache = new LRUCache(0, 1000);
      
      try {
        // Не должен сохранять элементы
        zeroCache.set('key1', 'value1');
        expect(zeroCache.get('key1')).toBeNull();
      } finally {
        zeroCache.destroy();
      }
    });

    test('should handle very short TTL', async () => {
      const shortTTLCache = new LRUCache(10, 1); // 1ms TTL
      
      try {
        shortTTLCache.set('key1', 'value1');
        
        // Ждем 10ms
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(shortTTLCache.get('key1')).toBeNull();
      } finally {
        shortTTLCache.destroy();
      }
    });

    test('should handle null and undefined values', () => {
      cache.set('null', null);
      cache.set('undefined', undefined);
      
      expect(cache.get('null')).toBeNull(); // null считается как отсутствие значения
      expect(cache.get('undefined')).toBe(undefined);
    });

    test('should handle object values', () => {
      const obj = { foo: 'bar', nested: { value: 42 } };
      cache.set('obj', obj);
      
      const retrieved = cache.get('obj');
      expect(retrieved).toEqual(obj);
      expect(retrieved).toBe(obj); // Должен быть тот же объект
    });
  });

  describe('Performance', () => {
    test('should handle many items efficiently', () => {
      const largeCache = new LRUCache(1000, 60000);
      
      try {
        const startTime = Date.now();
        
        // Добавляем 10000 элементов
        for (let i = 0; i < 10000; i++) {
          largeCache.set(`key${i}`, `value${i}`);
        }
        
        const setTime = Date.now() - startTime;
        
        // Проверяем, что в кэше только последние 1000
        expect(largeCache.cache.size).toBe(1000);
        
        // Проверяем, что первые элементы вытеснены
        expect(largeCache.get('key0')).toBeNull();
        expect(largeCache.get('key8999')).toBeNull();
        
        // Проверяем, что последние элементы остались
        expect(largeCache.get('key9999')).toBe('value9999');
        expect(largeCache.get('key9000')).toBe('value9000');
        
        // Проверяем производительность (должно быть быстро)
        expect(setTime).toBeLessThan(1000); // меньше 1 секунды
      } finally {
        largeCache.destroy();
      }
    });

    test('should handle frequent get operations efficiently', () => {
      // Заполняем кэш
      for (let i = 0; i < 3; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      const startTime = Date.now();
      
      // Выполняем 10000 операций get
      for (let i = 0; i < 10000; i++) {
        cache.get(`key${i % 3}`);
      }
      
      const getTime = Date.now() - startTime;
      
      // Проверяем производительность
      expect(getTime).toBeLessThan(100); // меньше 100ms
    });
  });
});