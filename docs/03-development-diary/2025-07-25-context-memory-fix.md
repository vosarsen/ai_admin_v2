# Исправление системы памяти контекста диалогов

**Дата**: 25 июля 2025  
**Автор**: AI Admin Team  
**Задача**: Исправить проблему, когда бот не помнит имя клиента между сообщениями

## Контекст проблемы

Пользователь Арсен сообщил о проблеме: бот успешно сохраняет имя клиента при первом знакомстве, но при следующих сообщениях снова спрашивает "Как вас зовут?", как будто не помнит предыдущий диалог.

### Пример проблемного диалога:
```
Клиент: Арсен
Бот: Приятно познакомиться, Арсен! На какую услугу хотите записаться?
Клиент: хочу записаться на стрижку к Сергею завтра  
Бот: Как вас зовут? У Сергея доступно на завтра...
```

## Анализ проблемы

### 1. Проверка сохранения имени
При анализе логов обнаружено, что имя успешно сохраняется:
- `Executing command: SAVE_CLIENT_NAME`
- `Client info saved in Redis for +79936363848`
- `Context set for +79936363848`

### 2. Проблема при загрузке
При следующем сообщении контекст не загружается:
- `Context data from Redis: {"contextKeys":[]}`
- `Parsed context data: {"hasClientName":false,"savedData":{}}`

### 3. Корневая причина
Проблема в Redis proxy, который добавляет префикс `context:` ко всем ключам:
- При сохранении: ключ `962302:79936363848` → `context:962302:79936363848`
- При загрузке: ключ `context:962302:79936363848` → `context:context:962302:79936363848`

## Реализованные исправления

### 1. Добавлено детальное логирование (коммит 3f72b38)
```javascript
// В src/services/ai-admin-v2/index.js
logger.info('Redis context loaded:', {
  hasRedisContext: !!redisContext,
  hasClient: !!redisContext?.client,
  clientName: redisContext?.clientName,
  clientFromContext: redisContext?.client
});

// В src/services/context/index.js
logger.info('Context data from Redis:', {
  hasContextData: !!contextData,
  contextKeys: Object.keys(contextData || {}),
  dataField: contextData?.data
});
```

### 2. Исправлен метод setContext (коммит 571bf86)
```javascript
// Старый код (неправильный формат):
await this.redis.hset(contextKey, {
  'phone': normalizedPhone,
  'companyId': companyId,
  // ...
});

// Новый код (правильный формат для Redis):
await this.redis.hset(contextKey, 
  'phone', normalizedPhone,
  'companyId', companyId,
  'lastActivity', new Date().toISOString(),
  'state', contextData.state || 'active',
  'data', JSON.stringify(contextData.data || {})
);
```

### 3. Улучшена загрузка контекста (коммит 6c6dd40)
```javascript
// Добавлена проверка данных из основного контекста
const [/* ... */, contextData] = await Promise.all([
  // ...
  this.redis.hgetall(contextKey)
]);

// Если клиент не найден в кэше, но есть имя в контексте
if (!finalClient && contextData) {
  const savedData = contextData.data ? JSON.parse(contextData.data) : {};
  if (savedData.clientName) {
    finalClient = {
      phone: normalizedPhone,
      name: savedData.clientName,
      company_id: companyId
    };
  }
}
```

### 4. Обновлен command-handler (коммит 6c6dd40)
```javascript
// При сохранении имени теперь обновляется и основной контекст
await contextService.setContext(cleanPhone, companyId, {
  data: { clientName: params.name }
});
```

## Технические детали

### Архитектура хранения контекста
1. **Redis** - основное хранилище с TTL 30 дней
2. **In-memory cache** - кэш в памяти с TTL 5 минут
3. **Supabase** - долгосрочное хранилище для аналитики

### Формат ключей в Redis
- Контекст: `context:962302:79936363848`
- Предпочтения: `context:preferences:962302:79936363848`
- Клиенты: `context:clients:962302` (hash с телефонами как ключами)

### Проблема с префиксами
Redis proxy автоматически добавляет префикс `context:` ко всем операциям. Это создает проблему двойного префикса при некоторых операциях.

## Нерешенные проблемы

1. **Двойной префикс в Redis** - требуется рефакторинг proxy или изменение логики работы с ключами
2. **Синхронизация кэшей** - нужно обеспечить согласованность между Redis и in-memory кэшем
3. **Миграция старых данных** - необходимо мигрировать существующие контексты в новый формат

## Уроки и рекомендации

1. **Всегда логировать операции с кэшем** - это критически важно для отладки
2. **Тестировать полный сценарий** - не только сохранение, но и загрузку через время
3. **Документировать формат данных** - особенно при использовании proxy с автоматическими префиксами
4. **Использовать правильный формат Redis команд** - hset требует пары ключ-значение, а не объект

## Следующие шаги

1. Полностью решить проблему с префиксами Redis
2. Добавить unit-тесты для всех операций с контекстом
3. Реализовать механизм восстановления контекста из Supabase при отсутствии в Redis
4. Добавить метрики для мониторинга hit rate кэша

## Результат

После внесенных изменений система должна корректно сохранять и загружать имя клиента между сообщениями. Однако полное решение требует исправления проблемы с префиксами Redis.