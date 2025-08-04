/**
 * Простая реализация LRU (Least Recently Used) кэша
 * с поддержкой TTL (Time To Live)
 */
class LRUCache {
  constructor(maxSize = 100, ttl = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl; // время жизни в миллисекундах
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Проверяем не истек ли TTL
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    // LRU: переместить в конец (самый свежий)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  set(key, value) {
    // Удаляем если уже существует (для LRU порядка)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Проверяем размер кэша
    if (this.cache.size >= this.maxSize) {
      // Удаляем самый старый элемент (первый в Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    // Добавляем в конец
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Периодическая очистка истекших элементов
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

module.exports = LRUCache;