# Детальный разбор запроса к YClients API для получения слотов

## 📋 Что именно отправляется в YClients API

### 1. **URL запроса**

```
GET https://api.yclients.com/api/v1/book_times/{company_id}/{staff_id}/{date}
```

**Пример реального запроса**:
```
GET https://api.yclients.com/api/v1/book_times/962302/3413963/2025-08-21
```

Где:
- `962302` - ID компании в YClients (салон KULTURA Малаховка)
- `3413963` - ID мастера (например, Бари)
- `2025-08-21` - дата в формате YYYY-MM-DD

### 2. **Query параметры**

```
?service_id=18356024
```

Где:
- `service_id` - ID услуги в YClients (например, 18356024 для ДЕТСКАЯ СТРИЖКА)

**Полный URL с параметрами**:
```
https://api.yclients.com/api/v1/book_times/962302/3413963/2025-08-21?service_id=18356024
```

### 3. **HTTP заголовки**

```http
Content-Type: application/json
Accept: application/vnd.yclients.v2+json
Authorization: Bearer {bearerToken}, User {userToken}
User-Agent: AI-Admin-Enterprise/1.0.0
```

**Пример реальных заголовков**:
```http
Content-Type: application/json
Accept: application/vnd.yclients.v2+json
Authorization: Bearer yusw3yeu6hrr4r9j3gw6, User f0823f5c7a6e4d3bbcd5a1b36d70f67e
User-Agent: AI-Admin-Enterprise/1.0.0
```

### 4. **Тело запроса**

Для GET запроса `/book_times` тело отсутствует (все параметры в URL и query string).

## 📥 Что возвращает YClients API

### Успешный ответ (200 OK):

```json
{
  "success": true,
  "data": [
    {
      "time": "10:00",
      "datetime": "2025-08-21T10:00:00+03:00",
      "seance_length": 1800,
      "sum_length": 1800,
      "staff_id": 3413963,
      "staff_name": "Бари"
    },
    {
      "time": "10:30",
      "datetime": "2025-08-21T10:30:00+03:00",
      "seance_length": 1800,
      "sum_length": 1800,
      "staff_id": 3413963,
      "staff_name": "Бари"
    },
    {
      "time": "11:00",
      "datetime": "2025-08-21T11:00:00+03:00",
      "seance_length": 1800,
      "sum_length": 1800,
      "staff_id": 3413963,
      "staff_name": "Бари"
    }
  ],
  "meta": []
}
```

### Если нет свободных слотов:

```json
{
  "success": true,
  "data": [],
  "meta": []
}
```

### При ошибке (например, неверный service_id):

```json
{
  "success": false,
  "data": {
    "errors": {
      "service": ["Услуга недоступна для данного мастера"]
    }
  },
  "meta": {
    "message": "Validation failed"
  }
}
```

## 🔄 Полный flow запроса в коде

### 1. Вызов из command-handler.js:

```javascript
const result = await bookingService.findSuitableSlot({
  companyId: 962302,
  serviceId: 18356024,  // ID услуги ДЕТСКАЯ СТРИЖКА
  staffId: 3413963,      // ID мастера Бари
  preferredDate: "2025-08-21"
});
```

### 2. В booking/index.js формируется запрос:

```javascript
const staffSlots = await this.getAvailableSlots(
  3413963,                    // staffId
  "2025-08-21",               // date
  { service_id: 18356024 },   // params
  962302                      // companyId
);
```

### 3. В yclients/client.js отправляется HTTP запрос:

```javascript
async getAvailableSlots(staffId, date, params = {}, companyId) {
  const endpoint = `book_times/${companyId}/${staffId}/${date}`;
  // endpoint = "book_times/962302/3413963/2025-08-21"
  
  const queryParams = { service_id: 18356024 };
  
  return this.get(endpoint, queryParams, {
    cacheTtl: 300,  // Кэш на 5 минут
    priority: 'high'
  });
}
```

### 4. Axios выполняет запрос:

```javascript
const response = await axios({
  method: 'GET',
  url: 'https://api.yclients.com/api/v1/book_times/962302/3413963/2025-08-21',
  params: { service_id: 18356024 },
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.yclients.v2+json',
    'Authorization': 'Bearer yusw3yeu6hrr4r9j3gw6, User f0823f5c7a6e4d3bbcd5a1b36d70f67e',
    'User-Agent': 'AI-Admin-Enterprise/1.0.0'
  },
  timeout: 30000
});
```

## 🔑 Важные детали

### Авторизация:
- **Bearer Token** - основной токен для доступа к API (получается при регистрации приложения)
- **User Token** - токен конкретного пользователя (получается через auth endpoint)

### Rate Limiting:
- Максимум 500 запросов в час
- Система автоматически ждет если лимит превышен
- Критичные запросы имеют приоритет

### Кэширование:
- Слоты кэшируются на 5 минут
- При создании записи кэш очищается
- Кэш хранится в памяти приложения

### Особенности API:

1. **Мастер должен оказывать услугу** - если мастер не оказывает запрошенную услугу, API вернет пустой массив слотов

2. **Длительность услуги учитывается** - API автоматически фильтрует слоты где недостаточно времени для услуги

3. **Часовой пояс** - время возвращается в часовом поясе компании (+03:00 для Москвы)

4. **seance_length** - длительность услуги в секундах (1800 = 30 минут)

## 🐛 Типичные проблемы

### 1. Пустой массив слотов при существующих слотах
**Причина**: Мастер не оказывает данную услугу
**Решение**: Проверить настройки услуг мастера в YClients

### 2. Ошибка 401 Unauthorized
**Причина**: Неверный или истекший токен
**Решение**: Обновить bearerToken или userToken

### 3. Ошибка 429 Too Many Requests
**Причина**: Превышен лимит запросов (500/час)
**Решение**: Подождать или использовать кэширование

### 4. Слоты есть в YClients, но API их не возвращает
**Причина**: Недостаточно времени для услуги (например, осталось 30 минут, а услуга 45 минут)
**Решение**: Проверить длительность услуги

## 📊 Пример логов реального запроса

```
🕐 getAvailableSlots called {
  staffId: 3413963,
  date: "2025-08-21",
  params: { service_id: 18356024 },
  companyId: 962302
}

📋 Rate limiter executing request { staffId: 3413963, date: "2025-08-21" }

🚨 CRITICAL: Making request to: 
https://api.yclients.com/api/v1/book_times/962302/3413963/2025-08-21?service_id=18356024

🔍 YClients API Request [req_1755714038470_ciu5zxb28] attempt 1
  method: GET
  endpoint: book_times/962302/3413963/2025-08-21
  params: { service_id: 18356024 }

💾 Cache hit for book_times/962302/3413963/2025-08-21

✅ getAvailableSlots completed {
  success: true,
  dataLength: 15,
  sampleData: [
    { time: "10:00", staff_name: "Бари" },
    { time: "10:30", staff_name: "Бари" }
  ]
}
```

## 🎯 Итог

Для получения слотов отправляется простой GET запрос с:
1. **URL путь**: содержит company_id, staff_id и дату
2. **Query параметр**: service_id для фильтрации по услуге
3. **Заголовки**: авторизация через Bearer и User токены
4. **Ответ**: массив доступных временных слотов

Система дополнительно:
- Кэширует результаты на 5 минут
- Контролирует rate limits
- Повторяет запросы при сбоях
- Группирует слоты по мастерам
- Организует по времени суток