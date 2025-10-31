# Техническое задание: Подтверждение визита при ответе на напоминание

**Дата:** 22 октября 2025
**Статус:** 📋 ТЗ создано
**Автор:** AI Admin Dev Team

## 📝 Краткое описание

Создано детальное техническое задание для функции автоматического подтверждения визита когда клиент отвечает положительно на напоминание.

## 🎯 Цель функции

Автоматизировать процесс подтверждения записей:
1. Клиент получает напоминание о визите
2. Клиент отвечает: "Да", "Приду", "Ок", "👍" и т.д.
3. Система автоматически:
   - Обновляет статус в YClients (attendance = 2 "подтвержден")
   - Отправляет реакцию ❤️ на сообщение клиента
   - Сохраняет факт подтверждения

## 🔍 Проведенное исследование

### 1. Изучена существующая инфраструктура

✅ **ReminderContextTracker** (`src/services/reminder/reminder-context-tracker.js`)
- Уже сохраняет контекст напоминания в Redis
- Есть метод `isConfirmationMessage()` с паттернами подтверждения
- Есть метод `shouldHandleAsReminderResponse()` - проверяет таймаут 30 минут
- Есть метод `markAsConfirmed()` - помечает подтверждение

✅ **YclientsClient** (`src/integrations/yclients/client.js`)
- Метод `updateBookingStatus(recordId, attendance)` - готов к использованию
- Метод `updateRecord()` - базовый PUT запрос
- Поддерживает attendance = 2 (подтвержден)

✅ **WhatsAppClient** (`src/integrations/whatsapp/client.js`)
- Метод `sendReaction(phone, emoji)` - есть, но отправляет как текст
- Нужна доработка для использования Baileys API

✅ **Booking Monitor** (`src/services/booking-monitor/index.js`)
- Уже сохраняет контекст через `reminderContextTracker.saveReminderContext()`
- При отправке напоминания записывает в Redis:
  ```javascript
  {
    type: 'day_before' | '2hours',
    sentAt: timestamp,
    booking: {
      recordId: ...,
      datetime: ...,
      serviceName: ...,
      staffName: ...
    },
    awaitingConfirmation: true
  }
  ```

### 2. Найдены паттерны подтверждения

Уже реализовано в `isConfirmationMessage()`:
```javascript
const confirmationPatterns = [
  'ок', 'ok', 'да', 'yes', 'конечно', 'обязательно',
  'приду', 'придем', 'буду', 'будем', 'спасибо', 'хорошо',
  'договорились', 'подтверждаю', 'согласен', 'согласна',
  '👍', '👌', '✅', '💯', '+', '++', 'подтверждено',
  '❤️', '💗', '❤', '♥️', '💙', '💚', '💛', '💜'
];
```

### 3. Изучен API YClients

Из `YCLIENTS_API.md`:
```
attendance (number):
- 2: Пользователь подтвердил запись
- 1: Пользователь пришел, услуги оказаны
- 0: Ожидание пользователя
- -1: Пользователь не пришел на визит
```

Метод: `PUT /record/{company_id}/{record_id}`
Тело: `{ attendance: 2 }`

## 📐 Архитектура решения

```
Клиент → WhatsApp → AI Admin v2 → ReminderResponseHandler
                                         ↓
                     ┌───────────────────┴────────────────────┐
                     ▼                   ▼                     ▼
              reminderContextTracker  YclientsClient  WhatsAppClient
              (Redis - проверка)      (attendance=2)  (реакция ❤️)
```

### Алгоритм обработки

1. **Проверка контекста** (reminderContextTracker)
   - Отправляли ли напоминание этому клиенту?
   - Прошло ли меньше 30 минут?
   - Похоже ли сообщение на подтверждение?

2. **Обновление YClients**
   - `yclientsClient.updateBookingStatus(recordId, 2)`
   - Если ошибка - откатываемся

3. **Отправка реакции**
   - `whatsappClient.sendReaction(phone, '❤️', messageId)`
   - Не критично если не получилось

4. **Обновление контекста**
   - `reminderContextTracker.markAsConfirmed(phone)`
   - Помечаем что обработали

## 🔧 Что нужно реализовать

### Новые файлы

1. **src/services/reminder/reminder-response-handler.js**
   - Класс `ReminderResponseHandler`
   - Метод `handleResponse(phone, message, context)`
   - Объединяет всю логику подтверждения

### Изменения в существующих файлах

1. **src/services/ai-admin-v2/index.js** или **message-processor.js**
   - Добавить вызов `reminderResponseHandler.handleResponse()` в начале
   - ПЕРЕД вызовом AI

2. **src/integrations/whatsapp/client.js**
   - Улучшить `sendReaction(phone, emoji, messageId)`
   - Добавить поддержку Baileys API для реакций на конкретное сообщение

3. **src/services/booking-monitor/index.js** (опционально)
   - Уже сохраняет контекст, ничего менять не нужно

### Опционально

**Supabase - таблица `booking_notifications`:**
- `confirmed_by_client` (boolean)
- `confirmed_at` (timestamp)
- `confirmation_message` (text)

## ⚠️ Важные моменты

### Безопасность
- ✅ Проверяем что recordId принадлежит клиенту (через phone в контексте)
- ✅ Таймаут 30 минут - не путаем с обычными сообщениями
- ✅ Идемпотентность - не обрабатываем повторно

### Откат при ошибках
- Если YClients упал - не помечаем как подтвержденное
- Если реакция не отправилась - это не критично, продолжаем
- Логируем все действия для отладки

### Метрики
- Процент подтверждений
- Время отклика клиента
- Корреляция с реальной явкой

## 📝 Примеры работы

### ✅ Успешный сценарий

```
19:00 - Система: "Добрый вечер! Напоминаем о записи завтра в 14:00"
19:03 - Клиент: "Да, приду"
19:03 - Система:
        ✓ Обновляет attendance = 2 в YClients
        ✓ Ставит ❤️ на сообщение клиента
        ✓ Помечает в Redis
19:03 - AI: "Отлично! Ждём вас завтра 👍"
```

### ⏰ Таймаут истёк

```
19:00 - Система: отправляет напоминание
19:35 - Клиент: "Да" (прошло > 30 минут)
       - Система НЕ обрабатывает как подтверждение
       - AI обрабатывает как обычное сообщение
```

### ❌ Отрицательный ответ

```
19:00 - Система: отправляет напоминание
19:02 - Клиент: "Не смогу, нужно перенести"
       - isConfirmationMessage() = false
       - AI обрабатывает как запрос на перенос
```

## 🧪 План тестирования

### Юнит-тесты
- [ ] ReminderResponseHandler.handleResponse()
- [ ] isConfirmationMessage() с разными паттернами
- [ ] shouldHandleAsReminderResponse() с таймаутами

### E2E тесты (через MCP)
```bash
# 1. Отправить напоминание
@whatsapp send_message phone:89686484488 message:"Напоминание"

# 2. Ответить как клиент
@whatsapp send_message phone:89686484488 message:"Да, приду"

# 3. Проверить YClients
@supabase query_table table:bookings filters:{"phone":"89686484488"}

# 4. Проверить Redis
@redis get_context phone:89686484488
```

## 📊 Оценка

| Параметр | Значение |
|----------|----------|
| **Сложность** | Средняя |
| **Время** | 2-3 часа |
| **Зависимости** | Нет (всё готово) |
| **Риски** | Низкие |

## 🚀 Следующие шаги

1. **Реализация** (когда будем готовы)
   - Создать ReminderResponseHandler
   - Интегрировать в AI Admin v2
   - Улучшить WhatsApp реакции

2. **Тестирование**
   - Юнит-тесты
   - E2E на тестовом номере 89686484488
   - Проверка в production

3. **Деплой**
   - Коммит и пуш
   - Деплой на сервер
   - Мониторинг

## 📚 Документы

- **ТЗ:** [docs/features/REMINDER_VISIT_CONFIRMATION.md](../features/REMINDER_VISIT_CONFIRMATION.md)
- **Связанное:** [REMINDER_SYSTEM_CURRENT.md](../features/REMINDER_SYSTEM_CURRENT.md)
- **API:** [YCLIENTS_API.md](../../YCLIENTS_API.md)

## ✅ Итог

Создано полное техническое задание для функции подтверждения визита. Все необходимые компоненты уже есть в системе, осталось только связать их вместе.

Функция готова к реализации когда появится время! 🚀

---

**Дата создания ТЗ:** 22 октября 2025
**Готовность к реализации:** ✅ 100%
**Блокеры:** Нет
