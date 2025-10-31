# Система управления контекстом AI Admin v2

## Обзор

Система контекста в AI Admin v2 представляет собой многоуровневую архитектуру для хранения, управления и синхронизации состояния диалогов между пользователями и AI ботом. После полной переработки в августе 2025 года, система обеспечивает надежное сохранение контекста между сообщениями и правильную обработку многошаговых диалогов.

## Архитектура

### Компоненты системы

```
┌─────────────────────────────────────────────────────────┐
│                   AI Admin v2 Core                       │
│                  (src/services/ai-admin-v2/)             │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │   ContextManagerV2      │
        │  (context-manager-v2.js) │
        └────────────┬────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌────┴────┐    ┌────┴────┐    ┌────┴────┐
│ Memory  │    │  Redis  │    │Database │
│  Cache  │    │  Cache  │    │ Loader  │
│  (LRU)  │    │         │    │         │
└─────────┘    └────┬────┘    └─────────┘
                    │
           ┌────────┴────────┐
           │ ContextServiceV2│
           │(context-service-v2.js)│
           └─────────────────┘
```

### Уровни хранения данных

1. **Memory Cache (LRU)** - Сверхбыстрый доступ в памяти процесса
   - TTL: 5 минут
   - Размер: 50 записей
   - Время доступа: <1ms

2. **Redis Cache** - Распределенный кэш между процессами
   - TTL: По типу данных (2ч - 30 дней)
   - Время доступа: 1-5ms
   - Персистентность между рестартами

3. **Supabase Database** - Долгосрочное хранилище
   - Постоянное хранение
   - Время доступа: 150-200ms
   - Полная история и аналитика

## Типы данных контекста

### 1. Dialog Context (TTL: 2 часа)
Текущее состояние диалога и выбор пользователя:
```javascript
{
  selection: {
    service: "стрижка",
    staff: "Бари",
    date: "завтра",
    time: "15:00"
  },
  clientName: "Арсен",
  pendingAction: null,
  state: "active"
}
```

### 2. Client Data (TTL: 24 часа)
Информация о клиенте из базы данных:
```javascript
{
  id: 123,
  name: "Арсен",
  phone: "79686484488",
  favorite_service_id: 45,
  favorite_staff_ids: [1, 3],
  bookings_count: 15,
  last_visit: "2025-08-15"
}
```

### 3. Preferences (TTL: 30 дней)
Долгосрочные предпочтения пользователя:
```javascript
{
  favoriteServiceId: 45,
  favoriteStaffId: 1,
  preferredTime: "evening",
  communicationStyle: "formal"
}
```

### 4. Messages History (TTL: 24 часа)
История последних сообщений:
```javascript
[
  {
    sender: "user",
    text: "Когда завтра свободно?",
    timestamp: "2025-08-20T10:00:00Z"
  },
  {
    sender: "bot",
    text: "Завтра свободно: 15:00, 16:00...",
    timestamp: "2025-08-20T10:00:05Z"
  }
]
```

## Основные классы и методы

### ContextManagerV2

Высокоуровневый менеджер контекста с кэшированием и обогащением данных.

```javascript
class ContextManagerV2 {
  // Загрузка полного контекста с многоуровневым кэшированием
  async loadFullContext(phone, companyId)
  
  // Атомарное сохранение изменений контекста
  async saveContext(phone, companyId, updates)
  
  // Сохранение контекста из выполненных команд
  async saveCommandContext(phone, companyId, executedCommands, commandResults)
  
  // Очистка диалога после создания записи
  async clearDialogAfterBooking(phone, companyId)
  
  // Обработка ожидающих действий
  async handlePendingActions(message, phone, companyId)
}
```

### ContextServiceV2

Низкоуровневый сервис для работы с Redis, обеспечивающий правильное разделение данных.

```javascript
class ContextServiceV2 {
  // Получение полного контекста
  async getFullContext(phone, companyId)
  
  // Обновление контекста диалога (атомарно)
  async updateDialogContext(phone, companyId, updates)
  
  // Добавление сообщения в историю
  async addMessage(phone, companyId, message)
  
  // Сохранение предпочтений
  async savePreferences(phone, companyId, preferences)
  
  // Очистка контекста диалога
  async clearDialogContext(phone, companyId)
}
```

## Процесс обработки сообщения

### 1. Загрузка контекста
```javascript
// В ai-admin-v2/index.js
const context = await contextManager.loadFullContext(phone, companyId);
```

Последовательность:
1. Проверка Memory Cache (LRU)
2. Проверка Redis Cache
3. Загрузка из базы данных
4. Обогащение данными (услуги, мастера, расписание)
5. Сохранение в кэши

### 2. Обработка сообщения
```javascript
// Two-Stage или ReAct обработка
const result = await processor.process(message, context);
```

### 3. Сохранение контекста
```javascript
// Атомарное сохранение всех изменений
await contextManager.saveContext(phone, companyId, {
  userMessage: message,
  botResponse: result.response,
  selection: extractedSelection,
  clientName: extractedName
});
```

### 4. Сохранение результатов команд
```javascript
// Сохранение данных из выполненных команд
await contextManager.saveCommandContext(
  phone, 
  companyId, 
  result.executedCommands,
  result.commandResults
);
```

## Критические исправления (август 2025)

### Проблема 1: Потеря контекста даты
**Симптом**: Бот забывал дату между сообщениями (спрашивали про "завтра", бот искал на "сегодня").

**Решение**:
1. Атомарное сохранение вместо множественных вызовов
2. Умное слияние selection с проверкой undefined
3. Усиленные промпты с явными инструкциями использовать lastDate
4. Передача redisContext в Two-Stage процессор

### Проблема 2: Перезапись контекста
**Симптом**: Множественные вызовы updateContext перезаписывали друг друга.

**Решение**:
```javascript
// Было: множественные вызовы
await contextService.updateContext(...);
await contextService.updateContext(...); // перезаписывает первый

// Стало: один атомарный вызов
await contextManager.saveContext(phone, companyId, allUpdates);
```

### Проблема 3: Агрессивная очистка
**Симптом**: Важные данные (услуга, мастер, дата) удалялись через 24 часа.

**Решение**: Разные TTL для разных типов данных:
- Dialog: 2 часа
- Client: 24 часа
- Preferences: 30 дней
- Messages: 24 часа

## Конфигурация

### Переменные окружения
```bash
# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_password

# Кэширование
CONTEXT_CACHE_TTL=300000  # 5 минут
CONTEXT_CACHE_SIZE=50      # записей

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### Настройки модулей
```javascript
// src/services/ai-admin-v2/config/modules-config.js
{
  cache: {
    contextCacheSize: 50,
    contextCacheTTL: 300000,  // 5 минут
  },
  contextManager: {
    memoryCheckInterval: 60000,  // 1 минута
  }
}
```

## Мониторинг и метрики

### Доступные метрики
- Cache hit rate (Memory/Redis)
- Context load time
- Save operation time
- Cache evictions count

### Получение статистики
```javascript
const stats = contextManager.getCacheStats();
console.log(stats);
// {
//   memory: {
//     size: 45,
//     hits: 1234,
//     misses: 56,
//     hitRate: 0.956
//   }
// }
```

## Отладка

### Включение debug логов
```bash
DEBUG=ai-admin:context* npm run dev
```

### Проверка контекста через MCP
```bash
# Получить контекст
@redis get_context phone:79686484488

# Очистить контекст
@redis clear_context phone:79686484488

# Посмотреть все активные контексты
@redis list_active_contexts
```

### Типичные проблемы

#### Контекст не сохраняется
1. Проверьте Redis подключение
2. Убедитесь что вызывается saveContext
3. Проверьте логи на ошибки сохранения

#### Дата теряется между сообщениями
1. Проверьте что lastDate сохраняется в selection
2. Убедитесь что redisContext передается в процессор
3. Проверьте промпт на использование lastDate

#### Высокая задержка загрузки контекста
1. Проверьте cache hit rate
2. Оптимизируйте запросы к базе
3. Увеличьте размер кэша

## Миграция со старой системы

### Изменения в коде
```javascript
// Старый подход
const context = await contextService.getContext(phone, companyId);
await contextService.updateContext(phone, companyId, { ... });

// Новый подход
const context = await contextManager.loadFullContext(phone, companyId);
await contextManager.saveContext(phone, companyId, { ... });
```

### Совместимость
Система поддерживает обратную совместимость через сохранение в старый формат для критических полей (lastDate, lastService, lastStaff).

## Производительность

### Целевые показатели
- Context load: <100ms (с кэшем <10ms)
- Context save: <50ms
- Cache hit rate: >70%
- Memory usage: <50MB на процесс

### Оптимизации
1. Многоуровневое кэширование (Memory → Redis → DB)
2. Параллельная загрузка данных
3. Умная инвалидация кэшей
4. Batch операции для Redis

## Безопасность

- Все данные шифруются в Redis
- TTL автоматически очищает старые данные
- Валидация всех входных данных
- Изоляция по companyId

## Roadmap

### Планируемые улучшения
1. Поддержка Redis Cluster для масштабирования
2. Сжатие больших контекстов
3. Аналитика использования контекста
4. Автоматическая оптимизация TTL на основе паттернов

## Заключение

Система контекста v2 обеспечивает надежное и производительное управление состоянием диалогов. Атомарные операции, многоуровневое кэширование и правильное разделение данных гарантируют сохранение контекста между сообщениями и корректную обработку многошаговых сценариев.