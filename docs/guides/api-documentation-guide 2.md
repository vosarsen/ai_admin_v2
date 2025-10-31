# API Documentation Guide

## Обзор

AI Admin v2 предоставляет RESTful API для интеграции с WhatsApp Business API и управления системой. API документирован в формате OpenAPI 3.0.

## Доступ к документации

### 1. Swagger UI

После запуска сервера документация доступна по адресу:
```
http://localhost:3000/api-docs
```

Swagger UI позволяет:
- Просматривать все endpoints
- Видеть схемы данных
- Тестировать API прямо из браузера
- Скачивать спецификацию

### 2. OpenAPI Specification

Спецификация доступна в двух форматах:
- YAML: `http://localhost:3000/openapi.yaml`
- JSON: `http://localhost:3000/openapi.json`

## Основные разделы API

### WhatsApp Integration
- `POST /webhook/whatsapp` - Прием сообщений от WhatsApp
- `POST /webhook/whatsapp/batched` - Батчевая обработка сообщений
- `POST /api/send-message` - Отправка сообщений (для тестов)

### Monitoring & Health
- `GET /health` - Проверка здоровья системы
- `GET /api/metrics` - Метрики производительности
- `GET /api/circuit-breakers` - Статус circuit breakers

### Synchronization
- `GET /api/sync/status` - Статус синхронизации с YClients
- `POST /api/sync/schedules` - Запуск синхронизации расписаний

### Calendar
- `POST /api/calendar/generate-ics-link` - Создание календарного приглашения
- `GET /api/calendar/download/{token}` - Скачивание .ics файла

## Аутентификация

### 1. API Key
Для большинства endpoints требуется API ключ:
```http
X-API-Key: your-api-key-here
```

### 2. HMAC Signature
Webhooks защищены HMAC-SHA256 подписью:
```http
X-Hub-Signature: sha256=signature_here
```

### 3. Bearer Token
YClients webhooks используют Bearer токены:
```http
Authorization: Bearer your-token-here
```

## Примеры использования

### 1. Проверка здоровья системы

```bash
curl http://localhost:3000/health
```

Ответ:
```json
{
  "status": "ok",
  "services": {
    "whatsapp": "connected",
    "database": "connected",
    "redis": "connected",
    "ai": "operational"
  },
  "queue": {
    "messages": 5,
    "processing": 2
  },
  "uptime": 86400
}
```

### 2. Отправка тестового сообщения

```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "79001234567",
    "message": "Тестовое сообщение",
    "companyId": 962302
  }'
```

### 3. Webhook от WhatsApp

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "X-Hub-Signature: sha256=calculated_signature" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "msg_123",
    "from": "79001234567@c.us",
    "body": "Хочу записаться на стрижку",
    "type": "chat",
    "timestamp": 1627849200
  }'
```

## Postman Collection

### Генерация коллекции

```bash
npm run generate-postman
# или
node scripts/generate-postman-collection.js
```

Это создаст файл `postman-collection.json` который можно импортировать в Postman.

### Использование в Postman

1. Импортируйте `postman-collection.json`
2. Настройте переменные окружения:
   - `base_url` - URL вашего сервера
   - `api_key` - Ваш API ключ
   - `hmac_signature` - Подпись для webhooks

3. Коллекция организована по папкам:
   - WhatsApp - endpoints для работы с сообщениями
   - Monitoring - здоровье и метрики
   - Sync - синхронизация данных
   - Calendar - календарные приглашения

## Коды ошибок

### HTTP статусы

- `200` - Успешно
- `400` - Неверный запрос
- `401` - Неавторизован
- `429` - Превышен лимит запросов
- `500` - Внутренняя ошибка сервера
- `503` - Сервис недоступен

### Коды ошибок приложения

```json
{
  "success": false,
  "error": "Human readable error message",
  "errorCode": "ERROR_CODE",
  "requestId": "req_123"
}
```

Коды ошибок:
- `INVALID_PHONE` - Неверный формат телефона
- `INVALID_SIGNATURE` - Неверная HMAC подпись
- `RATE_LIMIT_EXCEEDED` - Превышен лимит запросов
- `SERVICE_UNAVAILABLE` - Сервис недоступен

## Rate Limiting

API имеет ограничения на количество запросов:
- Общий лимит: 100 запросов в минуту
- WhatsApp webhooks: 30 запросов в минуту с одного номера
- Health check: 300 запросов в минуту

При превышении лимита возвращается ошибка 429 с заголовком:
```http
Retry-After: 60
```

## Webhooks

### Настройка webhook в WhatsApp Business API

1. URL: `https://your-domain.com/webhook/whatsapp`
2. Метод: POST
3. Заголовки: 
   - `X-Hub-Signature` с HMAC-SHA256 подписью

### Проверка подписи

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  return `sha256=${expectedSignature}` === signature;
}
```

## Версионирование

API использует версионирование через URL path:
- Текущая версия: v2
- В будущем: `/api/v3/...`

## Миграция с v1

Если вы мигрируете с AI Admin v1:
1. Обновите webhook URL на `/webhook/whatsapp`
2. Добавьте HMAC подпись
3. Используйте новый формат ответов

## Troubleshooting

### Swagger UI не загружается
1. Проверьте, что сервер запущен
2. Убедитесь, что установлены зависимости: `npm install`
3. Проверьте логи сервера

### 401 Unauthorized
1. Проверьте API ключ
2. Для webhooks - проверьте HMAC подпись
3. Убедитесь, что используете правильный тип аутентификации

### 429 Too Many Requests
1. Подождите время указанное в Retry-After
2. Используйте экспоненциальный backoff
3. Рассмотрите батчевую обработку