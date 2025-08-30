# Руководство по устранению неполадок системы контекста

## Частые проблемы и решения

### 1. Контекст не сохраняется между сообщениями

#### Симптомы
- Бот не помнит предыдущие сообщения
- Теряется выбор услуги/мастера/даты
- Каждое сообщение обрабатывается как новый диалог

#### Диагностика
```bash
# Проверить Redis подключение
redis-cli ping

# Проверить сохранение через MCP
@redis get_context phone:79686484488

# Проверить логи на ошибки сохранения
grep "Failed to save context" logs/app.log
```

#### Решения

**1. Проверьте Redis подключение:**
```bash
# Проверить статус Redis
systemctl status redis

# Проверить конфигурацию
echo $REDIS_URL

# Тестовое подключение
redis-cli -h localhost -p 6379 ping
```

**2. Убедитесь что вызывается saveContext:**
```javascript
// Проверьте в ai-admin-v2/index.js
// После обработки сообщения должен быть вызов:
await contextManager.saveContext(phone, companyId, {
  userMessage: message,
  botResponse: result.response,
  selection: extractedSelection
});
```

**3. Проверьте атомарность операций:**
```javascript
// НЕПРАВИЛЬНО - множественные вызовы
await contextService.updateContext(...);
await contextService.updateContext(...); // перезапишет первый!

// ПРАВИЛЬНО - один атомарный вызов
await contextManager.saveContext(phone, companyId, allUpdates);
```

---

### 2. Бот путает даты (сегодня/завтра)

#### Симптомы
- Спрашивают про "завтра", бот ищет на "сегодня"
- После выбора даты, бот использует другую дату
- Контекст даты не сохраняется

#### Диагностика
```bash
# Проверить сохраненную дату в контексте
@redis get_context phone:79686484488

# Посмотреть в логах какая дата используется
grep "lastDate" logs/app.log
grep "date=" logs/app.log
```

#### Решения

**1. Проверьте передачу redisContext в процессор:**
```javascript
// В ai-admin-v2/index.js должно быть:
context.redisContext = redisContext;
```

**2. Проверьте промпт на использование lastDate:**
```javascript
// В two-stage-command-prompt.js должны быть правила:
"🔴 КРИТИЧЕСКИ ВАЖНО - ИСПОЛЬЗОВАНИЕ ДАТЫ ИЗ КОНТЕКСТА:
- ЕСЛИ В КОНТЕКСТЕ ЕСТЬ lastDate → ВСЕГДА ИСПОЛЬЗУЙ ЕЁ!"
```

**3. Проверьте сохранение даты после SEARCH_SLOTS:**
```javascript
// После выполнения SEARCH_SLOTS должно сохраняться:
if (cmd.command === 'SEARCH_SLOTS' && cmd.params?.date) {
  await contextService.setContext(phone, companyId, {
    data: { lastDate: cmd.params.date }
  });
}
```

**4. Включите debug логирование:**
```bash
DEBUG=ai-admin:context* npm run dev
```

---

### 3. Высокая задержка при загрузке контекста

#### Симптомы
- Медленный ответ бота (>5 секунд)
- Таймауты при обработке сообщений
- Высокое использование CPU

#### Диагностика
```javascript
// Добавьте логирование времени
const start = Date.now();
const context = await contextManager.loadFullContext(phone, companyId);
console.log(`Context loaded in ${Date.now() - start}ms`);
```

#### Решения

**1. Проверьте cache hit rate:**
```javascript
const stats = contextManager.getCacheStats();
console.log(`Cache hit rate: ${stats.memory.hitRate}`);
// Должен быть >70%
```

**2. Увеличьте размер кэша:**
```javascript
// В modules-config.js
{
  cache: {
    contextCacheSize: 100,  // увеличить с 50
    contextCacheTTL: 600000  // увеличить до 10 минут
  }
}
```

**3. Оптимизируйте запросы к базе:**
```sql
-- Добавьте индексы если их нет
CREATE INDEX idx_clients_phone_company ON clients(phone, company_id);
CREATE INDEX idx_services_company_active ON services(company_id, active);
```

**4. Используйте Redis pipeline:**
```javascript
// Вместо множественных запросов
const dialog = await redis.hgetall(dialogKey);
const client = await redis.hgetall(clientKey);

// Используйте pipeline
const pipeline = redis.pipeline();
pipeline.hgetall(dialogKey);
pipeline.hgetall(clientKey);
const [dialog, client] = await pipeline.exec();
```

---

### 4. Контекст перезаписывается или теряется

#### Симптомы
- Данные из одного диалога попадают в другой
- Старые данные перезаписывают новые
- Race conditions при параллельных сообщениях

#### Диагностика
```bash
# Проверить параллельные обработки
grep "Processing message from" logs/app.log | tail -20

# Проверить блокировки
@redis get_all_keys pattern:processing:*
```

#### Решения

**1. Проверьте блокировку обработки:**
```javascript
// В message-processor.js должна быть проверка:
await this.checkAndWaitForPreviousProcessing(phone);
```

**2. Используйте правильное слияние данных:**
```javascript
// В context-service-v2.js
selection = {
  ...oldSelection,
  ...newSelection,
  // Критичные поля не перезаписываем null/undefined
  date: newSelection.date !== undefined ? newSelection.date : oldSelection.date
};
```

**3. Изолируйте по companyId:**
```javascript
// Всегда используйте составной ключ
const key = `context:${companyId}:${phone}:dialog`;
```

---

### 5. Memory leak или высокое потребление памяти

#### Симптомы
- Постоянный рост памяти процесса
- Out of memory errors
- Замедление работы со временем

#### Диагностика
```bash
# Мониторинг памяти
pm2 monit

# Heap snapshot
node --inspect src/workers/index-v2.js
# Откройте chrome://inspect и сделайте heap snapshot
```

#### Решения

**1. Проверьте очистку кэша:**
```javascript
// Должен быть cleanup interval
this.cleanupInterval = setInterval(() => {
  this.memoryCache.cleanup();
}, 60000);
```

**2. Ограничьте размер кэша:**
```javascript
// В LRUCache
if (this.cache.size >= this.maxSize) {
  const oldestKey = this.cache.keys().next().value;
  this.cache.delete(oldestKey);
}
```

**3. Очищайте большие объекты:**
```javascript
// После использования
context = null;
result = null;
```

---

### 6. Ошибки Redis: "ReplyError: WRONGTYPE"

#### Симптомы
- Ошибка "WRONGTYPE Operation against a key holding the wrong kind of value"
- Невозможность сохранить/прочитать контекст

#### Решения

**1. Очистите проблемный ключ:**
```bash
redis-cli DEL context:962302:79686484488:dialog
```

**2. Проверьте тип ключа:**
```bash
redis-cli TYPE context:962302:79686484488:dialog
# Должен быть "hash"
```

**3. Используйте правильные команды:**
```javascript
// Для hash используйте hset/hgetall
await redis.hset(key, field, value);  // ✓
await redis.set(key, value);          // ✗ неправильно для hash
```

---

### 7. Промежуточный контекст не работает

#### Симптомы
- intermediateContext всегда null
- Не сохраняются упомянутые услуги/мастера
- Теряется контекст незавершенной обработки

#### Решения

**1. Проверьте сохранение:**
```javascript
// В ai-admin-v2/index.js
await intermediateContext.saveProcessingStart(phone, message, context);
await intermediateContext.updateAfterAIAnalysis(phone, aiResponse, commands);
```

**2. Проверьте загрузку:**
```javascript
// В cached-data-loader.js
const intermediate = await intermediateContext.getContext(normalizedPhone);
```

---

## Полезные команды для отладки

### Redis команды
```bash
# Посмотреть все ключи контекста
redis-cli --scan --pattern "context:*"

# Удалить все контексты (ОСТОРОЖНО!)
redis-cli --scan --pattern "context:*" | xargs redis-cli DEL

# Мониторинг команд в реальном времени
redis-cli MONITOR

# Проверить TTL ключа
redis-cli TTL context:962302:79686484488:dialog
```

### MCP команды для тестирования
```bash
# Получить полный контекст
@redis get_context phone:79686484488

# Очистить контекст для тестирования
@redis clear_context phone:79686484488

# Установить определенный этап записи
@redis set_booking_stage phone:79686484488 stage:selecting_service

# Сделать клиента "постоянным"
@redis simulate_returning_client phone:79686484488 visits:10

# Посмотреть все активные контексты
@redis list_active_contexts
```

### Логирование для отладки
```javascript
// Добавьте в проблемные места
logger.debug('Context before save:', JSON.stringify(context, null, 2));
logger.debug('Updates to apply:', updates);
logger.debug('Result after save:', result);
```

### Проверка производительности
```javascript
// Временные метки для каждого этапа
const metrics = {
  loadStart: Date.now(),
  loadEnd: 0,
  processStart: 0,
  processEnd: 0,
  saveStart: 0,
  saveEnd: 0
};

// После каждого этапа
metrics.loadEnd = Date.now();
console.log(`Load time: ${metrics.loadEnd - metrics.loadStart}ms`);
```

## Контакты для помощи

Если проблема не решается:

1. Проверьте логи: `pm2 logs ai-admin-worker-v2 --lines 100`
2. Включите debug режим: `DEBUG=ai-admin:* npm run dev`
3. Создайте issue на GitHub с:
   - Описанием проблемы
   - Логами ошибки
   - Шагами воспроизведения
   - Версией системы

## Превентивные меры

1. **Мониторинг**
   - Настройте алерты на cache hit rate <70%
   - Мониторьте время ответа >3 секунд
   - Отслеживайте memory usage

2. **Регулярное обслуживание**
   - Очищайте старые контексты раз в неделю
   - Проверяйте размер Redis базы
   - Анализируйте медленные запросы

3. **Тестирование**
   - Тестируйте многошаговые диалоги
   - Проверяйте сохранение после каждого изменения
   - Используйте load testing для проверки производительности