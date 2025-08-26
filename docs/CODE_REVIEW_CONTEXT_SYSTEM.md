# 🔍 Code Review: Система управления контекстом AI Admin

**Дата**: 26 августа 2025
**Ревьюер**: Команда разработки
**Статус**: Требуются улучшения

## Executive Summary

В проекте параллельно работают **ТРИ системы управления контекстом**, что создает избыточность, путаницу и потенциальные баги. Необходима унификация и рефакторинг.

## 📊 Обзор архитектуры

### Системы контекста:
1. **Старая система** (`src/services/context/index.js`)
2. **Система v2** (`src/services/context/context-service-v2.js`)  
3. **Промежуточный контекст** (`src/services/context/intermediate-context.js`)

### Менеджеры:
1. **context-manager-v2.js** - обертка над context-service-v2
2. **Прямые вызовы** старой системы в основном коде

## 🔴 Критические проблемы

### 1. Дублирование функциональности

**Проблема**: Три системы делают одно и то же разными способами

```javascript
// Старая система
contextService.setContext(phone, companyId, {data: JSON.stringify({...})})

// Новая система  
contextServiceV2.updateDialogContext(phone, companyId, {selection: {...}})

// Промежуточный контекст
intermediateContext.saveProcessingStart(phone, message, context)
```

**Влияние**: 
- Сложно понять какую систему использовать
- Риск потери данных при несогласованности
- Увеличение потребления памяти Redis

### 2. Несогласованность ключей Redis

**Проблема**: Каждая система использует свои префиксы

```javascript
// Старая система
`context:${companyId}:${phone}`

// Новая система
`dialog:${companyId}:${phone}`
`messages:${companyId}:${phone}`
`client:${companyId}:${phone}`
`preferences:${companyId}:${phone}`

// Промежуточный контекст
`intermediate:${phone}` // БЕЗ companyId!
```

**Риски**:
- Конфликт данных между компаниями в intermediate context
- Сложность миграции данных
- Невозможность понять структуру через Redis CLI

### 3. Неэффективное использование Redis

**Проблема**: Множественные вызовы Redis вместо пакетных операций

```javascript
// context-service-v2.js - getFullContext делает 4 параллельных запроса
const [dialog, client, preferences, messages] = await Promise.all([
  this.getDialogContext(),
  this.getClientCache(), 
  this.getPreferences(),
  this.getMessages()
]);
```

**Влияние**: 
- Увеличенная латентность (4 round-trip вместо 1)
- Нагрузка на Redis
- Риск частичного чтения при сбоях

### 4. Отсутствие валидации и типизации

**Проблема**: Нет проверки структуры данных

```javascript
// Старая система - парсинг без проверки
savedData = contextData.data ? JSON.parse(contextData.data) : {};

// Новая система - прямое использование
selection: data.selection ? JSON.parse(data.selection) : {}
```

**Риски**:
- Runtime ошибки при неверной структуре
- Сложность отладки
- Нет автокомплита в IDE

### 5. Смешивание логики сохранения

**Проблема**: Контекст сохраняется в разных местах

```javascript
// В index.js (AI Admin v2)
await contextManager.saveContext(phone, companyId, updates);
await contextManager.saveCommandContext(phone, companyId, commands);

// В старой системе
await contextService.setContext(phone, companyId, data);

// В message-worker-v2.js  
// Тоже есть сохранение контекста
```

**Влияние**:
- Сложно отследить flow данных
- Возможность race conditions
- Дублирование сохранений

## 🟡 Средние проблемы

### 6. Избыточное логирование

```javascript
logger.info('Context data from Redis:', {
  contextKey,
  hasContextData: !!contextData,
  contextKeys: Object.keys(contextData || {}),
  dataField: contextData?.data,
  fullData: JSON.stringify(contextData) // Весь контекст в логах!
});
```

**Проблемы**:
- Утечка персональных данных в логи
- Огромный размер логов
- Снижение производительности

### 7. Нет обработки ошибок парсинга

```javascript
try {
  savedData = contextData.data ? JSON.parse(contextData.data) : {};
} catch (e) {
  logger.error('Failed to parse context data:', e);
  // И продолжаем работу с пустым объектом!
}
```

### 8. Magic numbers без конфигурации

```javascript
this.contextTTL = 30 * 24 * 60 * 60; // 30 days - хардкод
this.maxMessages = 50; // Хардкод
this.ttl = 300; // 5 минут - хардкод
```

### 9. Proxy для префиксов - избыточное усложнение

```javascript
this.redis = new Proxy(redisClient, {
  get(target, prop) {
    // 20+ строк сложной логики для добавления префикса
  }
});
```

Проще использовать helper методы.

### 10. Несогласованность TTL

- dialog: 2 часа
- messages: 24 часа  
- clientCache: 24 часа
- preferences: 30 дней
- fullContext: 12 часов
- processing: 5 минут

Нет единой логики определения TTL.

## 🟢 Хорошие практики (что работает)

### 1. Параллельная загрузка данных
```javascript
const [dialog, client, preferences, messages] = await Promise.all([...])
```

### 2. Нормализация телефонов
```javascript
const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
```

### 3. LRU кеш в памяти
```javascript
this.memoryCache = new LRUCache(size, ttl);
```

### 4. Атомарное сохранение
```javascript
await this.redis.hset(key, ...fieldsToSet);
```

### 5. Умное слияние контекстов
```javascript
selection = {
  ...selection,  // Старый выбор
  ...updates.selection,  // Новый
  // Критичные поля не перезаписываем null
  service: updates.selection.service !== undefined ? updates.selection.service : selection.service
}
```

## 📋 Рекомендации по улучшению

### 1. Унификация систем контекста

**Краткосрочное решение** (1-2 дня):
```javascript
// Создать единый фасад
class UnifiedContextService {
  async getContext(phone, companyId) {
    // Вызывает нужную систему в зависимости от конфига
    return USE_CONTEXT_V2 ? 
      this.contextV2.getFullContext() : 
      this.contextOld.getContext();
  }
}
```

**Долгосрочное решение** (1-2 недели):
- Мигрировать все на context-v2
- Удалить старую систему
- Унифицировать intermediate context

### 2. Типизация данных

```typescript
interface DialogContext {
  phone: string;
  companyId: number;
  selection: {
    service?: string;
    staff?: string;
    date?: string;
    time?: string;
  };
  clientName?: string;
  pendingAction?: PendingAction;
}
```

### 3. Конфигурация TTL

```javascript
const TTL_CONFIG = {
  dialog: config.redis.ttl.dialog || 7200,
  messages: config.redis.ttl.messages || 86400,
  // ...
}
```

### 4. Пакетные операции Redis

```javascript
// Вместо множественных вызовов
const multi = this.redis.multi();
multi.hgetall(dialogKey);
multi.get(clientKey);
multi.lrange(messagesKey, 0, -1);
const results = await multi.exec();
```

### 5. Валидация данных

```javascript
const DialogSchema = Joi.object({
  phone: Joi.string().required(),
  companyId: Joi.number().required(),
  selection: Joi.object({
    service: Joi.string().optional(),
    // ...
  })
});

function validateDialog(data) {
  const { error, value } = DialogSchema.validate(data);
  if (error) throw new ValidationError(error);
  return value;
}
```

### 6. Единый менеджер состояния

```javascript
class ContextStateManager {
  private state = new Map();
  
  async transition(phone, from, to, data) {
    // Централизованное управление переходами
    // с логированием и валидацией
  }
}
```

### 7. Метрики и мониторинг

```javascript
class ContextMetrics {
  recordCacheHit() { this.cacheHits++; }
  recordCacheMiss() { this.cacheMisses++; }
  getStats() { return { hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) }; }
}
```

### 8. Обработка ошибок

```javascript
class ContextError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// Использование
throw new ContextError('Failed to parse context', 'PARSE_ERROR', { phone, raw: data });
```

## 🎯 План действий

### Фаза 1: Быстрые исправления (1-2 дня)
1. ✅ Добавить поле `data` в старую систему (уже сделано)
2. Добавить companyId в intermediate context
3. Вынести TTL в конфигурацию
4. Убрать fullData из логов

### Фаза 2: Стабилизация (3-5 дней)
1. Создать UnifiedContextService
2. Добавить валидацию данных
3. Реализовать пакетные операции Redis
4. Добавить метрики

### Фаза 3: Рефакторинг (1-2 недели)
1. Мигрировать все на context-v2
2. Удалить старую систему
3. Добавить TypeScript типы
4. Написать тесты

## 📈 Ожидаемые результаты

После рефакторинга:
- **-50%** вызовов Redis
- **-30%** потребления памяти
- **+100%** читаемости кода
- **0** runtime ошибок парсинга
- **100%** покрытие тестами критических путей

## Заключение

Текущая система работает, но требует серьезного рефакторинга. Основная проблема - три параллельные системы контекста, которые нужно унифицировать. Рекомендуется начать с быстрых исправлений и постепенно мигрировать на единую систему context-v2.