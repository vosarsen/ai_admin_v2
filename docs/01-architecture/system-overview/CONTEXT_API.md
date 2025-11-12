# Context System API Reference

## ContextManagerV2

Высокоуровневый менеджер контекста с многоуровневым кэшированием и обогащением данных.

### Импорт
```javascript
const contextManager = require('./modules/context-manager-v2');
```

### Методы

#### loadFullContext(phone, companyId)
Загружает полный контекст пользователя с многоуровневым кэшированием.

**Параметры:**
- `phone` (string) - Номер телефона пользователя (с или без @c.us)
- `companyId` (number) - ID компании

**Возвращает:** Promise<Object>
```javascript
{
  // Базовая информация
  phone: "79686484488",
  companyId: 962302,
  startTime: 1724150400000,
  
  // Данные компании
  company: {
    company_id: 962302,
    title: "Барбершоп Бари",
    type: "barbershop",
    address: "ул. Ленина, 1",
    phone: "+7900000000",
    work_hours: "9:00-21:00"
  },
  
  // Услуги (отсортированные по релевантности)
  services: [
    {
      id: 45,
      title: "Стрижка",
      price: 1500,
      duration: 30,
      category: "Стрижки",
      score: 150  // рейтинг для сортировки
    }
  ],
  
  // Мастера
  staff: [
    {
      id: 1,
      name: "Бари",
      specialization: "Барбер"
    }
  ],
  
  // Расписания мастеров
  staffSchedules: {
    "1": [/* расписание */]
  },
  
  // Данные клиента
  client: {
    id: 123,
    name: "Арсен",
    phone: "79686484488",
    favorite_service_id: 45,
    favorite_staff_ids: [1],
    bookings_count: 15
  },
  
  // Текущий выбор в диалоге
  currentSelection: {
    service: "стрижка",
    staff: "Бари",
    date: "завтра",
    time: "15:00"
  },
  
  // Ожидающие действия
  pendingAction: null,
  
  // История сообщений
  messages: [
    {
      sender: "user",
      text: "Хочу записаться",
      timestamp: "2025-08-20T10:00:00Z"
    }
  ],
  
  // Предпочтения
  preferences: {
    favoriteServiceId: 45,
    favoriteStaffId: 1
  },
  
  // Состояние диалога
  dialogState: "active",
  lastActivity: "2025-08-20T10:00:00Z",
  
  // Флаги
  isNewClient: false,
  hasActiveDialog: true,
  
  // Redis контекст (для обратной совместимости)
  redisContext: {
    data: '{"lastDate":"завтра","lastService":"стрижка"}',
    state: "active"
  }
}
```

**Пример использования:**
```javascript
const context = await contextManager.loadFullContext('79686484488', 962302);
console.log(`Загружен контекст для ${context.client?.name || 'нового клиента'}`);
```

---

#### saveContext(phone, companyId, updates)
Атомарно сохраняет изменения контекста.

**Параметры:**
- `phone` (string) - Номер телефона
- `companyId` (number) - ID компании
- `updates` (Object) - Объект с обновлениями
  - `userMessage` (string) - Сообщение пользователя
  - `botResponse` (string) - Ответ бота
  - `selection` (Object) - Текущий выбор (service, staff, date, time)
  - `clientName` (string) - Имя клиента
  - `pendingAction` (Object) - Ожидающее действие
  - `preferences` (Object) - Предпочтения
  - `state` (string) - Состояние диалога

**Возвращает:** Promise<Object>
```javascript
{
  success: true
}
```

**Пример использования:**
```javascript
await contextManager.saveContext('79686484488', 962302, {
  userMessage: 'Хочу записаться на стрижку завтра',
  botResponse: 'Какое время вам удобно?',
  selection: {
    service: 'стрижка',
    date: 'завтра'
  },
  state: 'active'
});
```

---

#### saveCommandContext(phone, companyId, executedCommands, commandResults)
Сохраняет контекст из выполненных команд.

**Параметры:**
- `phone` (string) - Номер телефона
- `companyId` (number) - ID компании
- `executedCommands` (Array) - Массив выполненных команд
- `commandResults` (Array) - Массив результатов команд

**Пример использования:**
```javascript
await contextManager.saveCommandContext(
  '79686484488',
  962302,
  [
    {
      command: 'SEARCH_SLOTS',
      params: { service_name: 'стрижка', date: 'завтра' }
    }
  ],
  [
    {
      command: 'SEARCH_SLOTS',
      success: true,
      data: [/* слоты */]
    }
  ]
);
```

---

#### clearDialogAfterBooking(phone, companyId)
Очищает контекст диалога после успешного создания записи.

**Параметры:**
- `phone` (string) - Номер телефона
- `companyId` (number) - ID компании

**Пример использования:**
```javascript
await contextManager.clearDialogAfterBooking('79686484488', 962302);
```

---

#### handlePendingActions(message, phone, companyId)
Обрабатывает ожидающие действия (например, подтверждение отмены).

**Параметры:**
- `message` (string) - Сообщение пользователя
- `phone` (string) - Номер телефона
- `companyId` (number) - ID компании

**Возвращает:** Promise<Object>
```javascript
{
  handled: true,  // было ли обработано ожидающее действие
  response: "Ваша запись отменена"  // ответ для пользователя
}
```

---

#### getCacheStats()
Возвращает статистику использования кэша.

**Возвращает:** Object
```javascript
{
  memory: {
    size: 45,
    maxSize: 50,
    hits: 1234,
    misses: 56,
    evictions: 12,
    hitRate: 0.956,
    metrics: {
      hits: 1234,
      misses: 56,
      evictions: 12
    }
  }
}
```

---

## ContextServiceV2

Низкоуровневый сервис для работы с Redis.

### Импорт
```javascript
const contextServiceV2 = require('../../context/context-service-v2');
```

### Методы

#### getFullContext(phone, companyId)
Получает полный контекст из Redis.

**Параметры:**
- `phone` (string) - Номер телефона
- `companyId` (number) - ID компании

**Возвращает:** Promise<Object> - Объединенный контекст из всех namespace

---

#### getDialogContext(phone, companyId)
Получает только контекст диалога.

**Возвращает:** Promise<Object>
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
  state: "active",
  lastActivity: "2025-08-20T10:00:00Z"
}
```

---

#### updateDialogContext(phone, companyId, updates)
Атомарно обновляет контекст диалога с умным слиянием.

**Параметры:**
- `phone` (string) - Номер телефона
- `companyId` (number) - ID компании
- `updates` (Object) - Обновления для применения

**Особенности:**
- Не перезаписывает критические поля (service, staff, date, time) значениями null/undefined
- Сливает selection объекты, а не заменяет полностью
- Атомарная операция через Redis транзакцию

**Пример использования:**
```javascript
await contextServiceV2.updateDialogContext('79686484488', 962302, {
  selection: {
    time: '15:00'  // добавит time, сохранив service, staff, date
  },
  state: 'active'
});
```

---

#### addMessage(phone, companyId, message)
Добавляет сообщение в историю.

**Параметры:**
- `phone` (string) - Номер телефона
- `companyId` (number) - ID компании
- `message` (Object) - Объект сообщения
  - `sender` (string) - 'user' или 'bot'
  - `text` (string) - Текст сообщения
  - `timestamp` (string) - ISO timestamp

**Пример использования:**
```javascript
await contextServiceV2.addMessage('79686484488', 962302, {
  sender: 'user',
  text: 'Хочу записаться',
  timestamp: new Date().toISOString()
});
```

---

#### savePreferences(phone, companyId, preferences)
Сохраняет долгосрочные предпочтения пользователя.

**Параметры:**
- `phone` (string) - Номер телефона
- `companyId` (number) - ID компании
- `preferences` (Object) - Объект предпочтений

**Пример использования:**
```javascript
await contextServiceV2.savePreferences('79686484488', 962302, {
  favoriteServiceId: 45,
  favoriteStaffId: 1,
  preferredTime: 'evening'
});
```

---

#### clearDialogContext(phone, companyId)
Очищает контекст диалога, сохраняя другие данные.

**Пример использования:**
```javascript
await contextServiceV2.clearDialogContext('79686484488', 962302);
```

---

#### setProcessingStatus(phone, companyId, status)
Устанавливает статус обработки сообщения.

**Параметры:**
- `phone` (string) - Номер телефона
- `companyId` (number) - ID компании
- `status` (string) - 'processing', 'completed', 'error'

---

#### invalidateFullContextCache(phone, companyId)
Инвалидирует кэш полного контекста в Redis.

---

## Утилиты

### LRUCache
Реализация LRU кэша для хранения в памяти.

```javascript
const LRUCache = require('./lru-cache');

const cache = new LRUCache(maxSize, ttl);
cache.set(key, value);
const value = cache.get(key);
cache.delete(key);
cache.clear();
const stats = cache.getStats();
```

### Пример полного цикла обработки

```javascript
// 1. Загрузка контекста
const context = await contextManager.loadFullContext(phone, companyId);

// 2. Обработка сообщения (AI, команды и т.д.)
const result = await processMessage(message, context);

// 3. Сохранение контекста
await contextManager.saveContext(phone, companyId, {
  userMessage: message,
  botResponse: result.response,
  selection: result.selection
});

// 4. Сохранение результатов команд
if (result.executedCommands) {
  await contextManager.saveCommandContext(
    phone,
    companyId,
    result.executedCommands,
    result.commandResults
  );
}

// 5. Очистка после записи (если нужно)
if (result.bookingCreated) {
  await contextManager.clearDialogAfterBooking(phone, companyId);
}
```

## Обработка ошибок

Все методы могут выбрасывать исключения. Рекомендуется использовать try-catch:

```javascript
try {
  const context = await contextManager.loadFullContext(phone, companyId);
  // обработка
} catch (error) {
  logger.error('Failed to load context:', error);
  // fallback логика
}
```

## Конфигурация TTL

TTL (Time To Live) для разных типов данных:

| Тип данных | TTL | Описание |
|------------|-----|----------|
| Dialog | 2 часа | Текущий выбор и состояние диалога |
| Client | 24 часа | Данные клиента из БД |
| Messages | 24 часа | История сообщений |
| Preferences | 30 дней | Долгосрочные предпочтения |
| Memory Cache | 5 минут | Кэш в памяти процесса |
| Processing Status | 5 минут | Статус обработки сообщения |

## Performance Tips

1. **Используйте loadFullContext один раз** в начале обработки сообщения
2. **Batch обновления** - сохраняйте все изменения одним вызовом saveContext
3. **Мониторьте cache hit rate** - должен быть >70%
4. **Очищайте диалог после записи** для экономии памяти
5. **Используйте правильные TTL** для разных типов данных