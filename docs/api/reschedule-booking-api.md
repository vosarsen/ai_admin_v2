# API Reference: Перенос записи (Reschedule Booking)

## Обзор

API для переноса существующих записей клиентов на новое время через WhatsApp бота.

## Команда AI

### RESCHEDULE_BOOKING

Команда для переноса записи на новую дату и время.

**Формат:**
```
[RESCHEDULE_BOOKING: date="YYYY-MM-DD", time="HH:MM", booking_id="ID"]
```

**Параметры:**
- `date` (обязательный) - новая дата записи
  - Формат ISO: "2024-08-11"
  - Относительный: "завтра", "послезавтра"
  - С месяцем: "11 августа", "15 сентября"
  - День недели: "понедельник", "среда"
  
- `time` (обязательный) - новое время записи
  - Формат 24ч: "15:00", "20:30"
  - Формат 12ч: "3pm" (будет преобразовано в 15:00)
  
- `booking_id` (опциональный) - ID конкретной записи
  - Если не указан, выбирается последняя созданная запись

**Примеры команд:**
```
[RESCHEDULE_BOOKING: date="2024-08-11", time="20:00"]
[RESCHEDULE_BOOKING: date="завтра", time="15:30"]
[RESCHEDULE_BOOKING: date="15 августа", time="18:00", booking_id="12345"]
```

## JavaScript API

### CommandHandler.rescheduleBooking(params)

**Расположение:** `/src/services/ai-admin-v2/modules/command-handler.js`

**Параметры:**
```javascript
{
  phone: string,      // Телефон клиента (79001234567)
  date: string,       // Новая дата
  time: string,       // Новое время
  booking_id?: string // ID записи (опционально)
}
```

**Возвращает:**
```javascript
// Успешный перенос
{
  success: true,
  rescheduleResult: {
    oldDateTime: "2024-08-09T15:00:00",
    newDateTime: "2024-08-11T20:00:00",
    services: [{
      id: 123,
      title: "Стрижка мужская"
    }],
    staff: {
      id: 456,
      name: "Сергей"
    }
  }
}

// Ошибка доступа (403)
{
  success: false,
  permissionError: true,
  error: "К сожалению, эту запись нельзя перенести через бота...",
  alternativeAction: "cancel_and_rebook"
}

// Другие ошибки
{
  success: false,
  error: "Описание ошибки"
}
```

### YclientsClient.rescheduleRecord()

**Расположение:** `/src/integrations/yclients/client.js`

**Сигнатура:**
```javascript
async rescheduleRecord(
  companyId: number,
  recordId: number,
  datetime: string,
  comment?: string
): Promise<{success: boolean, data?: any, error?: string}>
```

**Пример использования:**
```javascript
const result = await yclientsClient.rescheduleRecord(
  962302,                    // companyId
  12345,                     // recordId
  "2024-08-11T20:00:00",    // новое время
  "Перенос через WhatsApp"   // комментарий
);
```

## YClients API Endpoints

### PUT /api/v1/book_record/{company_id}/{record_id}

Основной endpoint для переноса записи.

**Headers:**
```
Authorization: Bearer {token}, User {userToken}
Content-Type: application/json
Accept: application/vnd.yclients.v2+json
```

**Request Body:**
```json
{
  "datetime": "2024-08-11T20:00:00",
  "comment": "Перенос через WhatsApp бота"
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": 12345,
    "datetime": "2024-08-11 20:00:00",
    "services": [...],
    "staff": {...}
  }
}
```

**Error Response (403):**
```json
{
  "success": false,
  "meta": {
    "code": 403,
    "message": "Forbidden"
  }
}
```

## Fallback механизм

При ошибке 403 (нет прав на изменение записи) используется альтернативный подход:

1. **Отмена существующей записи**
   ```
   DELETE /api/v1/record/{company_id}/{record_id}
   ```

2. **Создание новой записи**
   ```
   POST /api/v1/book_record/{company_id}
   ```

**Автоматически активируется при:**
- Записи созданы через админ-панель YClients
- Записи созданы другим пользователем
- Недостаточно прав для изменения

## Форматирование ответов

### formatRescheduleConfirmation(data)

**Расположение:** `/src/services/ai-admin-v2/modules/formatter.js`

**Входные данные:**
```javascript
{
  oldDateTime: "2024-08-09T15:00:00",
  newDateTime: "2024-08-11T20:00:00",
  services: [{title: "Стрижка мужская"}],
  staff: {name: "Сергей"}
}
```

**Выходной формат:**
```
✅ Запись успешно перенесена!

📋 Детали переноса:
❌ Старое время: пт, 9 августа, 15:00
✅ Новое время: вс, 11 августа, 20:00
💇 Услуга: Стрижка мужская
👤 Мастер: Сергей

💬 Ждём вас в новое время! Если планы изменятся, пожалуйста, предупредите заранее.
```

## Обработка ошибок

### Типы ошибок:

1. **no_bookings** - У клиента нет активных записей
2. **invalid_datetime** - Некорректный формат даты/времени
3. **slot_busy** - Выбранное время занято
4. **permission_denied** - Нет прав на изменение записи
5. **past_date** - Попытка переноса на прошедшую дату

### Примеры обработки:

```javascript
// В command-handler.js
if (!futureBookings || futureBookings.length === 0) {
  return {
    success: false,
    error: 'У вас нет активных записей для переноса'
  };
}

// Проверка даты
const today = new Date();
if (new Date(targetDate) < today) {
  return {
    success: false,
    error: 'Нельзя перенести запись на прошедшую дату'
  };
}
```

## Логирование

### Ключевые точки логирования:

```javascript
logger.info('🔄 Starting reschedule process', {
  phone: params.phone,
  newDate: params.date,
  newTime: params.time,
  bookingId: params.booking_id
});

logger.info('📅 Successfully rescheduled booking', {
  bookingId: booking.id,
  oldDateTime: booking.datetime,
  newDateTime: isoDateTime
});

logger.error('❌ Failed to reschedule booking', {
  error: error.message,
  bookingId: booking.id,
  attemptedDateTime: isoDateTime
});
```

## Тестирование

### Unit тесты:
```javascript
describe('CommandHandler.rescheduleBooking', () => {
  it('should reschedule booking to new time', async () => {
    const result = await handler.rescheduleBooking({
      phone: '79001234567',
      date: '2024-08-11',
      time: '20:00'
    });
    expect(result.success).toBe(true);
  });
});
```

### Integration тесты через MCP:
```bash
# Создать тестовую запись
@yclients create_test_booking phone:79001234567 appointments:[{
  "services": [45],
  "staff_id": 123,
  "datetime": "2024-08-09 15:00:00"
}]

# Отправить команду переноса
@whatsapp send_message phone:79001234567 message:"Перенесите запись на 11 августа 20:00"

# Проверить результат
@whatsapp get_last_response phone:79001234567
```

## Миграции базы данных

Для поддержки истории переносов добавить таблицу:

```sql
CREATE TABLE booking_reschedules (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL,
  old_datetime TIMESTAMP NOT NULL,
  new_datetime TIMESTAMP NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(20) -- phone number
);
```

## Метрики и мониторинг

### Prometheus метрики:
```
ai_admin_reschedule_total{status="success|failure"} 
ai_admin_reschedule_duration_seconds
ai_admin_reschedule_fallback_used_total
```

### Grafana дашборд:
- Количество переносов в час
- Процент успешных переносов
- Среднее время выполнения
- Топ причин ошибок