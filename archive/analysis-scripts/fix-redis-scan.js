const fs = require('fs');

// Читаем файл
let content = fs.readFileSync('src/services/redis-batch-service.js', 'utf8');

// Добавляем метод scanKeys после конструктора
const scanKeysMethod = `
  /**
   * Сканирует ключи используя SCAN вместо KEYS для production
   */
  async scanKeys(pattern) {
    const keys = [];
    let cursor = '0';
    
    do {
      const [newCursor, foundKeys] = await this.redis.scan(
        cursor,
        'MATCH', pattern,
        'COUNT', 100
      );
      
      cursor = newCursor;
      keys.push(...foundKeys);
      
    } while (cursor !== '0');
    
    return keys;
  }
`;

// Ищем место после конструктора
const constructorEnd = content.indexOf('  }', content.indexOf('constructor('));
if (constructorEnd !== -1) {
  // Вставляем метод после конструктора
  content = content.slice(0, constructorEnd + 3) + scanKeysMethod + content.slice(constructorEnd + 3);
}

// Записываем обратно
fs.writeFileSync('src/services/redis-batch-service.js', content);

console.log('✅ Added scanKeys method to redis-batch-service.js');