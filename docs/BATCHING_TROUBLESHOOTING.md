# Руководство по устранению неполадок Redis батчинга

## Быстрая диагностика

### 1. Проверить, работает ли батчинг
```bash
# Отправить тестовое сообщение
curl -s http://46.149.70.219:3000/webhook/whatsapp/batched/stats | jq .

# Ожидаемый результат при работающем батчинге:
{
  "success": true,
  "stats": {
    "pendingBatches": 1,
    "batches": [...]
  }
}
```

### 2. Проверить логи
```bash
# Логи API сервера
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-api --lines 50 | grep batch"

# Логи batch processor
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-batch-processor --lines 50"
```

## Распространенные проблемы

### Проблема 1: Батчи исчезают сразу после создания

**Симптомы**:
- API логи показывают "Added message to batch"
- Batch processor логи показывают "No pending batches found"

**Диагностика**:
```bash
# Остановить batch processor
pm2 stop ai-admin-batch-processor

# Отправить сообщения и проверить статистику
# Если батчи сохраняются - проблема в batch processor
```

**Возможные решения**:
1. Перезапустить все сервисы
2. Проверить Redis подключение
3. Временно отключить батчинг

### Проблема 2: TTL истекает слишком быстро

**Симптомы**:
- Логи показывают "TTL is very low: 1-3 seconds"
- Батчи исчезают до обработки

**Диагностика**:
```javascript
// test-ttl-check.js
const redis = require('ioredis')(...);
const key = 'rapid-fire:test';
await redis.rpush(key, 'test');
await redis.expire(key, 60);
// Проверять TTL каждую секунду
```

**Возможные решения**:
1. Увеличить defaultTTL в redis-batch-service.js
2. Проверить, не перезаписывается ли TTL

### Проблема 3: Процессы используют разные Redis базы

**Симптомы**:
- API создает ключи, batch processor их не видит
- Разные процессы видят разные данные

**Диагностика**:
```bash
# Запустить test-redis-info.js от имени разных процессов
NODE_ENV=production node test-redis-info.js api
NODE_ENV=production node test-redis-info.js batch
```

**Возможные решения**:
1. Использовать централизованную конфигурацию
2. Явно указать db: 0 в конфигурации
3. Проверить переменные окружения

## Инструменты отладки

### 1. Мониторинг Redis команд
```bash
redis-cli -p 6379 -a <password> monitor | grep rapid-fire
```

### 2. Проверка ключей в реальном времени
```bash
watch -n 1 'redis-cli -p 6379 -a <password> keys "rapid-fire:*"'
```

### 3. Тестовые скрипты
- `test-redis-batch.js` - базовый тест функциональности
- `test-redis-isolation.js` - тест изоляции между процессами
- `test-redis-ttl.js` - тест поведения TTL
- `test-redis-connections.js` - проверка подключений

### 4. Проверка конфигурации PM2
```bash
pm2 env ai-admin-api | grep -E 'NODE_ENV|REDIS'
pm2 env ai-admin-batch-processor | grep -E 'NODE_ENV|REDIS'
```

## Временные решения

### 1. Отключить батчинг полностью
Изменить Venom Bot webhook на `/webhook/whatsapp` вместо `/webhook/whatsapp/batched`

### 2. Увеличить TTL
```javascript
// src/services/redis-batch-service.js
this.defaultTTL = 120; // Увеличить с 60 до 120 секунд
```

### 3. Отключить batch processor
```bash
pm2 stop ai-admin-batch-processor
```

### 4. Использовать один процесс
Объединить API и batch processor в один процесс (не рекомендуется для production)

## Логирование для отладки

### Добавить в redis-batch-service.js:
```javascript
logger.debug('Redis operation', {
  operation: 'rpush',
  key: batchKey,
  processId: process.pid,
  timestamp: Date.now()
});
```

### Добавить в batch-processor.js:
```javascript
logger.debug('Batch check', {
  found: keys.length,
  processId: process.pid,
  redisInfo: await this.redis.info('server')
});
```

## Контрольный список отладки

- [ ] Проверить, что оба процесса запущены
- [ ] Проверить логи на наличие ошибок Redis подключения
- [ ] Убедиться, что используется один порт Redis (6379)
- [ ] Проверить, что используется одна база данных (db: 0)
- [ ] Проверить переменные окружения в PM2
- [ ] Остановить batch processor и проверить, сохраняются ли батчи
- [ ] Запустить изоляционные тесты
- [ ] Проверить Redis MONITOR на наличие DEL команд
- [ ] Убедиться, что нет других процессов, работающих с теми же ключами

## Когда эскалировать

Если после всех проверок проблема не решена:
1. Временно отключить батчинг
2. Создать issue в репозитории с логами
3. Рассмотреть альтернативные решения (in-memory, BullMQ)
4. Обратиться к специалисту по Redis