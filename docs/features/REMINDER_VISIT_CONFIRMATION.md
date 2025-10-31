# Подтверждение визита при ответе на напоминание

**Дата создания:** 22 октября 2025
**Статус:** 📋 Техническое задание
**Приоритет:** Средний

## 📋 Описание задачи

Когда клиент отвечает положительно на напоминание о визите ("Да", "Приду", "Ок", "👍" и т.д.), система должна автоматически:
1. Распознать положительный ответ
2. Обновить статус записи в YClients на `attendance = 2` ("подтвержден")
3. Отправить реакцию "❤️" (лайк) на сообщение клиента

## 🎯 Цели

- **Автоматизация:** Избавить администратора от ручного подтверждения записей
- **Вовлечение:** Дать клиенту мгновенную обратную связь (реакция)
- **Аналитика:** Видеть в YClients какие записи подтверждены клиентом

## 📊 Текущее состояние

### Что уже есть

1. **ReminderContextTracker** (`src/services/reminder/reminder-context-tracker.js`)
   - ✅ Сохраняет контекст напоминания в Redis (TTL 24 часа)
   - ✅ Метод `isConfirmationMessage()` - проверяет паттерны подтверждения
   - ✅ Метод `shouldHandleAsReminderResponse()` - проверяет нужно ли обрабатывать как ответ (в течение 30 минут)
   - ✅ Метод `markAsConfirmed()` - помечает что подтверждение получено

2. **YclientsClient** (`src/integrations/yclients/client.js`)
   - ✅ Метод `updateBookingStatus(recordId, attendance)` - обновляет attendance
   - ✅ Метод `updateRecord(companyId, recordId, updateData)` - базовый метод для PUT запроса

3. **WhatsAppClient** (`src/integrations/whatsapp/client.js`)
   - ✅ Метод `sendReaction(phone, emoji)` - отправка реакции (сейчас как обычное сообщение)
   - ⚠️ **Требует доработки** - нужно использовать Baileys API для настоящих реакций

4. **Booking Monitor** (`src/services/booking-monitor/index.js`)
   - ✅ Отправляет напоминания
   - ✅ Сохраняет контекст через `reminderContextTracker.saveReminderContext()`

## 🔧 Что нужно реализовать

### 1. Обработчик ответов на напоминания

**Файл:** `src/services/reminder/reminder-response-handler.js` (НОВЫЙ)

```javascript
class ReminderResponseHandler {
  /**
   * Обработать ответ клиента на напоминание
   * @param {string} phone - Телефон клиента
   * @param {string} message - Текст сообщения
   * @param {Object} context - Контекст диалога
   * @returns {Promise<{handled: boolean, confirmed: boolean}>}
   */
  async handleResponse(phone, message, context) {
    // 1. Проверить через reminderContextTracker.shouldHandleAsReminderResponse()
    // 2. Если нужно обработать:
    //    a) Получить booking.recordId из контекста
    //    b) Обновить attendance = 2 через yclientsClient.updateBookingStatus()
    //    c) Отправить реакцию ❤️ через whatsappClient.sendReaction()
    //    d) Пометить как подтверж дено через reminderContextTracker.markAsConfirmed()
    //    e) Обновить контекст диалога
    // 3. Вернуть результат
  }
}
```

### 2. Интеграция с AI Admin v2

**Файл:** `src/services/ai-admin-v2/index.js` или `message-processor.js`

**Где добавить:**
- В начале обработки сообщения, ДО вызова AI
- Проверка: `await reminderResponseHandler.handleResponse(phone, message, context)`
- Если `handled: true` - можно пропустить AI обработку (опционально)

**Псевдокод:**
```javascript
async processMessage(phone, message) {
  // ДО вызова AI - проверяем ответ на напоминание
  const reminderResponse = await reminderResponseHandler.handleResponse(
    phone,
    message,
    context
  );

  if (reminderResponse.confirmed) {
    // Клиент подтвердил визит
    // Можно вернуть короткий ответ или пропустить AI
    logger.info(`✅ Client ${phone} confirmed visit`);
    // return { success: true, confirmed: true };
  }

  // Продолжаем обычную обработку через AI...
}
```

### 3. Улучшение WhatsApp реакций

**Файл:** `src/integrations/whatsapp/client.js`

**Текущая реализация:**
```javascript
async sendReaction(phone, emoji = '❤️') {
  // Сейчас отправляет как обычное сообщение
  return await this.sendMessage(phone, emoji);
}
```

**Нужно:**
1. Добавить параметр `messageId` для реакции на конкретное сообщение
2. Использовать Baileys API: `sock.sendMessage(jid, { react: { text: emoji, key: messageKey } })`
3. Фоллбэк на текущую реализацию если messageId не передан

**Обновленная сигнатура:**
```javascript
async sendReaction(phone, emoji = '❤️', messageId = null) {
  if (messageId) {
    // Используем Baileys API для реакции на конкретное сообщение
  } else {
    // Фоллбэк - отправляем как обычное сообщение
  }
}
```

### 4. Обновление схемы данных (опционально)

**Таблица:** `booking_notifications` (Supabase)

**Добавить поля:**
- `confirmed_by_client` (boolean) - подтвердил ли клиент визит
- `confirmed_at` (timestamp) - когда подтвердил
- `confirmation_message` (text) - текст сообщения подтверждения

## 📐 Архитектура решения

```
┌─────────────────────────────────────────────────────────┐
│ Клиент отвечает на напоминание                          │
│ "Да, приду" / "Ок" / "👍"                              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ WhatsApp Message Handler                                 │
│ (src/queue/processors/whatsapp-message-processor.js)    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ AI Admin v2 - processMessage()                          │
│ ПЕРВЫМ делом вызывает:                                   │
│ reminderResponseHandler.handleResponse()                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ ReminderResponseHandler                                  │
│ 1. reminderContextTracker.shouldHandle...()  (Redis)    │
│    ├─ Проверяет: отправляли ли напоминание?            │
│    ├─ Проверяет: прошло < 30 минут?                    │
│    └─ Проверяет: похоже на подтверждение?              │
│                                                          │
│ Если ДА:                                                 │
│ 2. yclientsClient.updateBookingStatus(recordId, 2)      │
│    └─ PUT /record/{company}/{record} {attendance: 2}    │
│                                                          │
│ 3. whatsappClient.sendReaction(phone, '❤️', msgId)     │
│    └─ Отправляет реакцию на сообщение                  │
│                                                          │
│ 4. reminderContextTracker.markAsConfirmed(phone)        │
│    └─ Обновляет Redis                                   │
│                                                          │
│ 5. contextService.updateContext() (опционально)         │
│    └─ Сохраняет факт подтверждения в контексте         │
└─────────────────────────────────────────────────────────┘
```

## 🔍 Паттерны подтверждения

**Уже есть в `isConfirmationMessage()`:**
```javascript
const confirmationPatterns = [
  'ок', 'ok', 'да', 'yes', 'конечно', 'обязательно',
  'приду', 'придем', 'буду', 'будем', 'спасибо', 'хорошо',
  'договорились', 'подтверждаю', 'согласен', 'согласна',
  '👍', '👌', '✅', '💯', '+', '++', 'подтверждено',
  '❤️', '💗', '❤', '♥️', '💙', '💚', '💛', '💜'
];
```

**Можно расширить:**
- "отлично"
- "супер"
- "пойду"
- "🙂", "😊"
- и т.д.

## ⚠️ Важные моменты

1. **Таймаут ответа:** 30 минут после отправки напоминания
   - Если клиент ответит позже - не обрабатываем как подтверждение
   - Это сделано чтобы не путать с обычными сообщениями

2. **Безопасность:**
   - Проверяем что recordId существует в контексте
   - Проверяем что запись принадлежит этому клиенту (через phone)
   - Логируем все действия

3. **Идемпотентность:**
   - Если клиент уже подтвердил - не обрабатываем повторно
   - Проверка через `context.awaitingConfirmation === false`

4. **Откат при ошибке:**
   - Если не удалось обновить YClients - не помечаем как подтвержденное
   - Если не удалось отправить реакцию - это не критично, продолжаем

## 📝 Примеры работы

### Сценарий 1: Успешное подтверждение

```
1. Система отправляет: "Добрый вечер, Иван! Напоминаем о записи на мужскую стрижку завтра в 14:00"
2. Клиент отвечает: "Да, приду"
3. Система:
   - ✅ Обновляет attendance = 2 в YClients
   - ❤️ Ставит реакцию на сообщение клиента
   - 📝 Помечает в Redis как подтвержденное
4. AI может ответить: "Отлично! Ждём вас завтра 👍"
```

### Сценарий 2: Ответ спустя час

```
1. Система отправляет напоминание в 19:00
2. Клиент отвечает "Да" в 20:35 (прошло > 30 минут)
3. Система НЕ обрабатывает как подтверждение
4. AI обрабатывает как обычное сообщение
```

### Сценарий 3: Отрицательный ответ

```
1. Система отправляет напоминание
2. Клиент: "Не смогу, нужно перенести"
3. isConfirmationMessage() = false
4. AI обрабатывает как запрос на перенос
```

## 🧪 Тестирование

### Юнит-тесты

```javascript
describe('ReminderResponseHandler', () => {
  it('should confirm booking when client responds positively', async () => {
    // Arrange: создаем контекст напоминания
    // Act: вызываем handleResponse() с "Да, приду"
    // Assert: проверяем что attendance обновился
  });

  it('should not handle after 30 minutes timeout', async () => {
    // ...
  });

  it('should send heart reaction', async () => {
    // ...
  });
});
```

### E2E тесты

```javascript
// Использовать MCP servers:
// 1. @whatsapp send_message - отправить напоминание
// 2. @whatsapp send_message - ответить "Да"
// 3. @supabase query_table - проверить attendance
// 4. @redis get_context - проверить Redis
```

## 📊 Метрики

После реализации отслеживать:
- **Процент подтверждений** - сколько клиентов подтверждают визит
- **Время отклика** - как быстро клиенты отвечают на напоминания
- **Явка** - коррелируют ли подтверждения с реальной явкой

## 🚀 План реализации

1. ✅ **Исследование** (завершено)
   - Изучена текущая архитектура
   - Найдены все необходимые API
   - Создано ТЗ

2. **Реализация** (следующий этап)
   - [ ] Создать `ReminderResponseHandler`
   - [ ] Интегрировать в AI Admin v2
   - [ ] Улучшить WhatsApp реакции (Baileys API)
   - [ ] Добавить логирование и мониторинг

3. **Тестирование**
   - [ ] Юнит-тесты
   - [ ] E2E тесты через MCP
   - [ ] Тестирование на production (89686484488)

4. **Деплой**
   - [ ] Деплой на сервер
   - [ ] Мониторинг первых подтверждений
   - [ ] Сбор обратной связи

## 📚 Связанные документы

- [REMINDER_SYSTEM_CURRENT.md](./REMINDER_SYSTEM_CURRENT.md) - Текущая система напоминаний
- [REMINDER_CONFIRMATION_SYSTEM.md](./REMINDER_CONFIRMATION_SYSTEM.md) - Старая документация
- [YCLIENTS_API.md](../../YCLIENTS_API.md) - API YClients (attendance = 2)

## 🔗 Примеры кода

### Использование YClients API

```javascript
const yclientsClient = new YclientsClient();

// Подтвердить визит
await yclientsClient.updateBookingStatus(recordId, 2);

// Значения attendance:
// 2 - Подтвердил запись
// 1 - Пришел
// 0 - Ожидание
// -1 - Не пришел
```

### Использование ReminderContextTracker

```javascript
const reminderContextTracker = require('./reminder-context-tracker');

// Проверить нужно ли обрабатывать
const shouldHandle = await reminderContextTracker.shouldHandleAsReminderResponse(
  phone,
  message
);

if (shouldHandle) {
  // Получить контекст
  const context = await reminderContextTracker.getReminderContext(phone);
  const recordId = context.booking.recordId;

  // Обработать подтверждение...

  // Пометить как обработанное
  await reminderContextTracker.markAsConfirmed(phone);
}
```

---

**Статус:** 📋 Готово к реализации
**Оценка сложности:** Средняя (2-3 часа)
**Зависимости:** Нет (всё уже есть в системе)
