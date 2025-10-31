# AI Admin v2 Commands API Documentation

## Overview

AI Admin v2 использует командную систему для выполнения действий. AI анализирует сообщение пользователя и встраивает команды в свой ответ в формате `[COMMAND_NAME параметры]`.

## Command Format

```
[COMMAND_NAME param1: value1, param2: value2]
```

## Available Commands

### 1. SEARCH_SLOTS
Поиск доступных временных слотов для записи.

**Parameters:**
- `service_name` (string, optional) - название услуги
- `date` (string, optional) - дата в формате YYYY-MM-DD или относительная (завтра, послезавтра)
- `time_preference` (string, optional) - предпочтительное время (утро, день, вечер)
- `staff_name` (string, optional) - имя мастера

**Example:**
```
[SEARCH_SLOTS service_name: стрижка, date: завтра, staff_name: Сергей]
```

**Response:**
Возвращает массив доступных слотов с информацией о времени и мастерах.

### 2. CREATE_BOOKING
Создание новой записи.

**Parameters:**
- `service_name` (string, required) - название услуги
- `date` (string, required) - дата записи
- `time` (string, required) - время записи в формате HH:MM
- `staff_name` (string, optional) - имя мастера (если не указан, выберется любой доступный)

**Example:**
```
[CREATE_BOOKING service_name: стрижка, date: 2024-07-20, time: 15:00, staff_name: Сергей]
```

**Response:**
Возвращает информацию о созданной записи с ID записи.

### 3. CANCEL_BOOKING
Отмена существующей записи.

**Parameters:**
- `booking_id` (number, optional) - ID записи для отмены

**Example:**
```
[CANCEL_BOOKING booking_id: 12345]
```

**Note:** Если booking_id не указан, бот запросит у пользователя выбор из списка активных записей.

### 4. RESCHEDULE_BOOKING
Перенос записи на другое время.

**Parameters:**
- `booking_number` (number, optional) - номер записи из списка
- `date` (string, optional) - новая дата
- `time` (string, optional) - новое время

**Example:**
```
[RESCHEDULE_BOOKING date: завтра, time: 16:00]
```

### 5. CHECK_STAFF_SCHEDULE
Быстрая проверка расписания мастера.

**Parameters:**
- `staff_name` (string, required) - имя мастера
- `date` (string, optional) - дата для проверки

**Example:**
```
[CHECK_STAFF_SCHEDULE staff_name: Мария, date: сегодня]
```

### 6. SHOW_PRICES
Показать прайс-лист услуг.

**Parameters:**
- `category` (string, optional) - категория услуг для фильтрации

**Example:**
```
[SHOW_PRICES category: стрижка]
```

### 7. SHOW_PORTFOLIO
Показать портфолио работ (в разработке).

**Parameters:**
- `staff_name` (string, optional) - мастер, чье портфолио показать
- `category` (string, optional) - категория работ

**Example:**
```
[SHOW_PORTFOLIO staff_name: Сергей]
```

### 8. SAVE_CLIENT_NAME
Сохранить имя клиента в базе данных.

**Parameters:**
- `name` (string, required) - имя клиента

**Example:**
```
[SAVE_CLIENT_NAME name: Александр]
```

### 9. CONFIRM_BOOKING
Подтвердить запись (для напоминаний).

**Parameters:**
- `booking_id` (number, required) - ID записи
- `visit_id` (number, required) - ID визита

**Example:**
```
[CONFIRM_BOOKING booking_id: 12345, visit_id: 67890]
```

### 10. MARK_NO_SHOW
Отметить неявку клиента.

**Parameters:**
- `booking_id` (number, required) - ID записи
- `visit_id` (number, required) - ID визита
- `reason` (string, optional) - причина неявки

**Example:**
```
[MARK_NO_SHOW booking_id: 12345, visit_id: 67890, reason: не предупредил]
```

## Command Execution Flow

1. **Parsing**: AI генерирует ответ с встроенными командами
2. **Extraction**: Система извлекает команды из текста ответа
3. **Validation**: Проверка параметров команд
4. **Execution**: Последовательное выполнение команд
5. **Response**: Результаты встраиваются в финальный ответ пользователю

## Error Handling

Если команда не может быть выполнена, система:
1. Логирует ошибку
2. Корректирует ответ AI, убирая фразы об успешном выполнении
3. Предлагает альтернативные варианты

## Command Priorities

Некоторые команды являются критичными и прерывают выполнение последующих при ошибке:
- `CREATE_BOOKING`
- `CANCEL_BOOKING`

## Best Practices для AI

1. **Всегда указывайте все обязательные параметры**
2. **Используйте CHECK_STAFF_SCHEDULE перед CREATE_BOOKING для проверки доступности**
3. **Не показывайте команды в ответе пользователю**
4. **При создании записи всегда проверяйте наличие имени клиента**
5. **Используйте правильные форматы дат и времени**

## Integration Examples

### Сценарий записи нового клиента:
```
User: "Хочу записаться на стрижку"
AI: "Здравствуйте! Как вас зовут?"
User: "Александр"
AI: "Приятно познакомиться, Александр! [SAVE_CLIENT_NAME name: Александр] На какой день вас записать?"
User: "На завтра в 15:00"
AI: "Проверяю доступность... [SEARCH_SLOTS service_name: стрижка, date: завтра, time_preference: 15:00]"
AI: "Отлично! Записываю вас на завтра в 15:00 к мастеру Сергею. [CREATE_BOOKING service_name: стрижка, date: завтра, time: 15:00, staff_name: Сергей]"
```

### Сценарий отмены записи:
```
User: "Хочу отменить запись"
AI: "Конечно, помогу отменить. [CANCEL_BOOKING] Какую именно запись вы хотите отменить?"
```

## Performance Considerations

- Команды выполняются последовательно
- Каждая команда имеет таймаут выполнения
- Результаты команд кэшируются для оптимизации

## Future Commands (Planned)

- `SEND_REMINDER` - отправка напоминания о записи
- `GET_CLIENT_HISTORY` - получение истории визитов клиента
- `SUGGEST_SERVICES` - предложение услуг на основе истории
- `CHECK_AVAILABILITY` - проверка общей доступности