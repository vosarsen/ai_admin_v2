# Redis Context Caching

## Обзор

Redis кеширование контекста - это функция, которая сохраняет полный контекст диалога в Redis на 12 часов, обеспечивая быструю загрузку и единое хранилище для всех воркеров.

## Архитектура

### Компоненты

1. **ContextService** (`src/services/context/index.js`)
   - Управляет всеми операциями с Redis
   - Предоставляет методы для кеширования полного контекста
   - Использует `redisRaw` для избежания двойного префикса

2. **AI Admin v2** (`src/services/ai-admin-v2/index.js`)
   - Использует Redis кеш перед загрузкой из БД
   - Сохраняет контекст после загрузки
   - Больше не использует in-memory кеш

3. **Command Handler** (`src/services/ai-admin-v2/modules/command-handler.js`)
   - Инвалидирует кеш при создании/отмене записей
   - Обеспечивает актуальность данных

### Структура ключей Redis

```
full_context:{companyId}:{normalizedPhone}
```

Пример: `full_context:962302:+79001234567`

### TTL (Time To Live)

- **Полный контекст**: 12 часов (43200 секунд)
- **Обычный контекст диалога**: 30 дней
- **Предпочтения клиента**: 1 год

## API

### getCachedFullContext(phone, companyId)

Получает кешированный контекст из Redis.

**Параметры:**
- `phone` (string): Номер телефона клиента
- `companyId` (number): ID компании

**Возвращает:**
- `Object`: Полный контекст или `null` если не найден

**Пример:**
```javascript
const cachedContext = await contextService.getCachedFullContext('+79001234567', 962302);
if (cachedContext) {
  // Используем кешированный контекст
}
```

### setCachedFullContext(phone, companyId, context, ttl)

Сохраняет контекст в Redis с указанным TTL.

**Параметры:**
- `phone` (string): Номер телефона клиента
- `companyId` (number): ID компании
- `context` (Object): Объект контекста для сохранения
- `ttl` (number): Время жизни в секундах (по умолчанию 12 часов)

**Возвращает:**
- `boolean`: true при успехе, false при ошибке

**Пример:**
```javascript
const success = await contextService.setCachedFullContext(
  '+79001234567', 
  962302, 
  context,
  12 * 60 * 60 // 12 часов
);
```

### invalidateCachedContext(phone, companyId)

Удаляет кешированный контекст из Redis.

**Параметры:**
- `phone` (string): Номер телефона клиента
- `companyId` (number): ID компании

**Возвращает:**
- `boolean`: true при успехе, false при ошибке

**Пример:**
```javascript
await contextService.invalidateCachedContext('+79001234567', 962302);
```

## Использование

### Загрузка контекста

```javascript
async loadFullContext(phone, companyId) {
  const startTime = Date.now();
  
  // 1. Проверяем Redis кеш
  const cachedContext = await contextService.getCachedFullContext(phone, companyId);
  if (cachedContext) {
    logger.info(`Context loaded from Redis cache in ${Date.now() - startTime}ms`);
    return { ...cachedContext, startTime: Date.now() };
  }
  
  // 2. Загружаем из БД если кеш пуст
  logger.info('Loading full context from database...');
  const context = await loadFromDatabase();
  
  // 3. Сохраняем в Redis для будущего использования
  await contextService.setCachedFullContext(phone, companyId, context);
  
  return context;
}
```

### Инвалидация при изменениях

```javascript
// После создания записи
if (bookingCreated) {
  await contextService.invalidateCachedContext(
    context.phone, 
    context.company.company_id
  );
}

// После отмены записи
if (bookingCancelled) {
  await contextService.invalidateCachedContext(
    context.phone, 
    context.company.company_id
  );
}
```

## Конфигурация

### Порты Redis

Конфигурация в `src/config/redis-config.js`:

```javascript
const isLocal = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const port = isLocal ? 6380 : 6379; // Локально SSH туннель, на сервере прямое подключение
```

### SSH туннель для локальной разработки

```bash
# Запустить туннель
./scripts/maintain-redis-tunnel.sh start

# Проверить статус
./scripts/maintain-redis-tunnel.sh status

# Остановить туннель
./scripts/maintain-redis-tunnel.sh stop
```

## Производительность

### Бенчмарки

| Операция | Время | Описание |
|----------|-------|----------|
| Загрузка из БД | ~8.2 сек | Полная загрузка всех данных |
| Загрузка из Redis | ~2.7 сек | В 3 раза быстрее |
| Сохранение в Redis | ~7.5 сек | Включая сериализацию |
| Инвалидация | < 100мс | Удаление ключа |

### Использование памяти

- Средний размер контекста: ~300KB
- При 1000 активных клиентов: ~300MB RAM
- При 10000 активных клиентов: ~3GB RAM

## Мониторинг

### Логирование

Все операции логируются с уровнями:
- `info`: Успешные операции кеширования
- `debug`: Детали операций (ключи, размеры)
- `error`: Ошибки Redis

### Метрики для отслеживания

1. **Cache Hit Rate**: Процент успешных попаданий в кеш
2. **Cache Miss Rate**: Процент промахов
3. **Average Load Time**: Среднее время загрузки
4. **Cache Size**: Общий размер кеша в Redis

## Troubleshooting

### Проблема: Контекст не кешируется

**Симптомы:** Каждый запрос загружается из БД

**Проверки:**
1. Redis подключен: `redis-cli ping`
2. Правильный порт: 6380 для локальной разработки
3. SSH туннель запущен: `./scripts/maintain-redis-tunnel.sh status`

### Проблема: Старые данные в кеше

**Симптомы:** Изменения не отображаются

**Решение:** Проверить инвалидацию кеша при операциях создания/изменения

### Проблема: Высокое использование памяти

**Симптомы:** Redis использует много RAM

**Решения:**
1. Уменьшить TTL (например, до 6 часов)
2. Реализовать сжатие контекста
3. Добавить LRU eviction policy в Redis

## Безопасность

1. **Данные в Redis не шифруются** - используйте VPN/приватную сеть
2. **Требуется пароль Redis** - установлен через REDIS_PASSWORD
3. **Нет персональных данных в ключах** - только phone и companyId

## Будущие улучшения

1. **Сжатие контекста** - gzip может уменьшить размер на 70%
2. **Partial updates** - обновлять только измененные части
3. **Warm-up кеша** - предзагрузка для VIP клиентов
4. **Distributed lock** - для избежания race conditions
5. **Метрики в Grafana** - визуализация cache hit rate