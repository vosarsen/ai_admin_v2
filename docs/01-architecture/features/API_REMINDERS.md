# API Endpoints для системы напоминаний

## Основные endpoints

### 1. Планирование напоминаний для существующих записей

**Endpoint**: `POST /api/reminders/schedule-existing`

**Описание**: Загружает записи из БД и планирует напоминания для следующих 7 дней

**Запрос**:
```json
{
  "days": 7,  // опционально, по умолчанию 7
  "dryRun": false  // опционально, для тестирования без создания задач
}
```

**Ответ**:
```json
{
  "success": true,
  "scheduled": 15,
  "bookings": [
    {
      "record_id": "1203614616",
      "appointment_datetime": "2025-07-25T15:00:00",
      "reminders": {
        "dayBefore": "2025-07-24T19:30:00",
        "hoursBefore": "2025-07-25T13:00:00"
      }
    }
  ]
}
```

### 2. Проверка статуса напоминания

**Endpoint**: `GET /api/reminders/status/:recordId`

**Описание**: Получает статус напоминаний для конкретной записи

**Ответ**:
```json
{
  "success": true,
  "booking": {
    "record_id": "1203614616",
    "appointment_datetime": "2025-07-25T15:00:00",
    "reminders": {
      "dayBefore": {
        "scheduled": true,
        "sent": true,
        "sentAt": "2025-07-24T19:30:00",
        "confirmed": false
      },
      "hoursBefore": {
        "scheduled": true,
        "sent": false,
        "sentAt": null
      }
    }
  }
}
```

### 3. Отмена напоминаний

**Endpoint**: `DELETE /api/reminders/:recordId`

**Описание**: Отменяет все запланированные напоминания для записи

**Ответ**:
```json
{
  "success": true,
  "cancelled": 2,
  "message": "Reminders cancelled successfully"
}
```

### 4. Ручное создание напоминания

**Endpoint**: `POST /api/reminders/manual`

**Описание**: Создает напоминание вручную (для тестирования или специальных случаев)

**Запрос**:
```json
{
  "phone": "79001234567",
  "type": "custom",  // "day_before", "hours_before", "custom"
  "message": "Ваш текст напоминания",
  "scheduledTime": "2025-07-24T19:00:00",
  "booking": {
    "record_id": "123456",
    "service_name": "Стрижка",
    "staff_name": "Сергей",
    "datetime": "2025-07-25T15:00:00"
  }
}
```

**Ответ**:
```json
{
  "success": true,
  "jobId": "reminder_123456",
  "scheduledTime": "2025-07-24T19:00:00"
}
```

### 5. Статистика напоминаний

**Endpoint**: `GET /api/reminders/stats`

**Описание**: Получает статистику по напоминаниям

**Query параметры**:
- `from` - дата начала периода (ISO 8601)
- `to` - дата окончания периода (ISO 8601)
- `type` - тип напоминания (day_before, hours_before, all)

**Ответ**:
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "sent": 145,
    "failed": 5,
    "pending": 20,
    "confirmed": 89,
    "byType": {
      "day_before": {
        "sent": 75,
        "confirmed": 45,
        "confirmRate": 0.6
      },
      "hours_before": {
        "sent": 70,
        "confirmed": 44,
        "confirmRate": 0.63
      }
    }
  }
}
```

### 6. Конфигурация напоминаний

**Endpoint**: `GET /api/reminders/config`

**Описание**: Получает текущую конфигурацию системы напоминаний

**Ответ**:
```json
{
  "success": true,
  "config": {
    "dayBefore": {
      "enabled": true,
      "timeRange": {
        "from": "19:00",
        "to": "21:00"
      },
      "randomTime": true
    },
    "hoursBefore": {
      "enabled": true,
      "hours": 2
    },
    "retryPolicy": {
      "attempts": 3,
      "backoff": "exponential",
      "delay": 2000
    }
  }
}
```

**Endpoint**: `PUT /api/reminders/config`

**Описание**: Обновляет конфигурацию системы напоминаний

**Запрос**:
```json
{
  "dayBefore": {
    "timeRange": {
      "from": "18:00",
      "to": "22:00"
    }
  },
  "hoursBefore": {
    "hours": 3
  }
}
```

## Webhook endpoints

### 1. Подтверждение напоминания

**Endpoint**: `POST /webhook/reminder/confirm`

**Описание**: Вызывается когда клиент подтверждает запись через WhatsApp

**Запрос**:
```json
{
  "phone": "79001234567",
  "recordId": "1203614616",
  "action": "confirm",  // "confirm", "cancel", "reschedule"
  "timestamp": "2025-07-24T19:35:00"
}
```

## Внутренние endpoints (для мониторинга)

### 1. Состояние очереди

**Endpoint**: `GET /api/internal/reminders/queue-status`

**Описание**: Показывает состояние очереди BullMQ

**Ответ**:
```json
{
  "success": true,
  "queue": {
    "name": "reminders",
    "counts": {
      "waiting": 5,
      "active": 1,
      "completed": 150,
      "failed": 2,
      "delayed": 45
    },
    "workers": {
      "count": 1,
      "status": "online"
    }
  }
}
```

### 2. Перезапуск воркера

**Endpoint**: `POST /api/internal/reminders/restart-worker`

**Описание**: Перезапускает reminder worker через PM2

**Требования**: Требует авторизации администратора

**Ответ**:
```json
{
  "success": true,
  "message": "Worker restarted successfully",
  "pid": 12345
}
```

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Некорректные параметры запроса |
| 404 | Запись не найдена |
| 409 | Напоминание уже запланировано |
| 500 | Внутренняя ошибка сервера |
| 503 | Сервис временно недоступен (Redis/Queue недоступны) |

## Примеры использования

### cURL

```bash
# Планирование напоминаний для существующих записей
curl -X POST http://localhost:3000/api/reminders/schedule-existing \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'

# Проверка статуса
curl http://localhost:3000/api/reminders/status/1203614616

# Статистика за период
curl "http://localhost:3000/api/reminders/stats?from=2025-07-01&to=2025-07-31"
```

### JavaScript

```javascript
// Планирование напоминаний
const response = await fetch('/api/reminders/schedule-existing', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ days: 7 })
});

const result = await response.json();
console.log(`Запланировано ${result.scheduled} напоминаний`);
```

## Безопасность

1. Все endpoints требуют HMAC аутентификации
2. Rate limiting: 30 запросов в минуту
3. Внутренние endpoints доступны только с localhost
4. Логирование всех операций для аудита