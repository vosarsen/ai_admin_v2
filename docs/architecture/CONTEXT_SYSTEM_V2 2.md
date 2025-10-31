# Система управления контекстом v2

## 📋 Оглавление
1. [Обзор системы](#обзор-системы)
2. [Архитектура](#архитектура)
3. [Основные компоненты](#основные-компоненты)
4. [Использование](#использование)
5. [Миграция с v1](#миграция-с-v1)
6. [Решенные проблемы](#решенные-проблемы)

## Обзор системы

Новая система контекста v2 решает ключевые проблемы потери данных в диалоге через:
- **Атомарные операции** - все данные сохраняются за один вызов
- **Четкое разделение данных** - диалог, клиент, предпочтения хранятся отдельно
- **Умную инвалидацию кэшей** - при обновлении данных все кэши синхронизируются
- **Правильные TTL** - разное время жизни для разных типов данных

## Архитектура

```
┌─────────────────────────────────────────────┐
│            AI Admin v2 Service              │
├─────────────────────────────────────────────┤
│          Context Manager V2                 │
│  ┌────────────────────────────────────┐     │
│  │  Memory Cache (LRU, 5 min TTL)     │     │
│  └────────────────────────────────────┘     │
├─────────────────────────────────────────────┤
│          Context Service V2                 │
│  ┌─────────────┬─────────────┬──────────┐  │
│  │   Dialog    │   Client    │ Prefs    │  │
│  │  (2 hours)  │ (24 hours) │(30 days) │  │
│  └─────────────┴─────────────┴──────────┘  │
├─────────────────────────────────────────────┤
│                 Redis                       │
│  ┌─────────────────────────────────────┐   │
│  │ dialog:962302:79001234567           │   │
│  │ client:962302:79001234567           │   │
│  │ prefs:962302:79001234567            │   │
│  │ messages:962302:79001234567         │   │
│  │ full_ctx:962302:79001234567         │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Основные компоненты

### 1. ContextServiceV2 (`context-service-v2.js`)
Низкоуровневый сервис работы с Redis:
- **Разделенные namespace** для разных типов данных
- **Атомарные операции** сохранения
- **Автоматическая инвалидация** кэшей

### 2. ContextManagerV2 (`context-manager-v2.js`)
Высокоуровневый менеджер контекста:
- **Многоуровневое кэширование** (память + Redis)
- **Обогащение данными** из Supabase
- **Умное слияние** контекстов

### 3. Ключевые методы

#### Загрузка контекста
```javascript
// Загружает полный контекст с учетом всех источников
const context = await contextManager.loadFullContext(phone, companyId);

// Структура возвращаемого контекста:
{
  phone: '+79001234567',
  companyId: 962302,
  client: {
    name: 'Арсен',
    id: 123,
    visits_count: 5
  },
  currentSelection: {
    service: 'Стрижка',
    staff: 'Александр',
    time: '15:00',
    date: '2025-01-20'
  },
  messages: [...],
  preferences: {...},
  dialogState: 'active',
  hasActiveDialog: true
}
```

#### Сохранение контекста
```javascript
// Единый атомарный вызов для сохранения всех изменений
await contextManager.saveContext(phone, companyId, {
  userMessage: 'Текст сообщения пользователя',
  botResponse: 'Ответ бота',
  selection: {
    service: 'Стрижка',
    staff: 'Александр'
  },
  clientName: 'Арсен',
  preferences: {
    favoriteServiceId: 45
  }
});
```

#### Сохранение из команд
```javascript
// Автоматическое извлечение контекста из выполненных команд
await contextManager.saveCommandContext(
  phone, 
  companyId,
  executedCommands,
  commandResults
);
```

## Использование

### В AI Admin v2

```javascript
// src/services/ai-admin-v2/index.js

// 1. Загрузка контекста в начале обработки
const context = await contextManager.loadFullContext(phone, companyId);

// 2. Обработка сообщения...

// 3. Сохранение контекста после обработки
await contextManager.saveContext(normalizedPhone, companyId, {
  userMessage: message,
  botResponse: result.response,
  selection: extractedSelection,
  clientName: extractedName
});

// 4. Сохранение контекста из команд
if (result.executedCommands?.length > 0) {
  await contextManager.saveCommandContext(
    normalizedPhone,
    companyId,
    result.executedCommands,
    result.commandResults
  );
}
```

### TTL конфигурация

```javascript
const TTL_CONFIG = {
  dialog: {
    messages: 24 * 60 * 60,      // 24 часа
    selection: 2 * 60 * 60,       // 2 часа
    pendingAction: 30 * 60,       // 30 минут
  },
  clientCache: 24 * 60 * 60,      // 24 часа
  preferences: 30 * 24 * 60 * 60, // 30 дней
  fullContext: 12 * 60 * 60,      // 12 часов
};
```

## Миграция с v1

### Было (v1):
```javascript
// Множественные несинхронизированные вызовы
await contextService.updateContext(phone, companyId, { lastMessage: {...} });
await contextService.updateContext(phone, companyId, { lastMessage: {...} });
await contextService.setContext(phone, companyId, { data: {...} });
```

### Стало (v2):
```javascript
// Единый атомарный вызов
await contextManager.saveContext(phone, companyId, {
  userMessage: '...',
  botResponse: '...',
  selection: {...},
  clientName: '...'
});
```

### Изменения в коде:

1. **Замените импорты**:
```javascript
// Было
const contextManager = require('./modules/context-manager');

// Стало
const contextManager = require('./modules/context-manager-v2');
```

2. **Используйте новые методы**:
```javascript
// Было
context = await this.messageProcessor.loadContext(phone, companyId);

// Стало
context = await contextManager.loadFullContext(phone, companyId);
```

3. **Объедините сохранение**:
```javascript
// Вместо множественных вызовов используйте один
await contextManager.saveContext(phone, companyId, allUpdates);
```

## Решенные проблемы

### ✅ Проблема 1: Потеря контекста при множественных вызовах
**Было**: Каждый `updateContext` мог перезаписать предыдущий
**Решение**: Атомарное сохранение всех изменений за один вызов

### ✅ Проблема 2: Агрессивная очистка через 24 часа
**Было**: Удалялись важные данные (услуга, мастер) через сутки
**Решение**: Разные TTL для разных типов данных

### ✅ Проблема 3: Несинхронизированные кэши
**Было**: 3 разных кэша могли содержать разные данные
**Решение**: Автоматическая инвалидация всех кэшей при обновлении

### ✅ Проблема 4: Смешивание источников данных
**Было**: Данные из Supabase перезаписывали текущий диалог
**Решение**: Четкое разделение namespace и приоритеты при слиянии

## Тестирование

Запустите тесты для проверки работы системы:
```bash
node test-context-persistence.js
```

Тесты проверяют:
- Сохранение и загрузку контекста
- Атомарность операций
- Работу кэширования
- Инвалидацию кэшей
- Сохранение предпочтений

## Мониторинг

Проверка состояния контекста:
```bash
# Через MCP в Claude Code
@redis get_context phone:79001234567

# Или через скрипт
node scripts/check-context-status.js 79001234567
```

## Поддержка

При возникновении проблем:
1. Проверьте логи: `pm2 logs ai-admin-worker-v2`
2. Проверьте Redis: `@redis get_all_keys pattern:dialog:*`
3. Очистите кэш: `node scripts/clear-redis-context.js`

## Дальнейшие улучшения

- [ ] Добавить версионирование контекста
- [ ] Реализовать сжатие больших контекстов
- [ ] Добавить метрики производительности
- [ ] Создать дашборд для мониторинга