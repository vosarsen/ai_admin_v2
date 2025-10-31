# 📡 YClients Marketplace API Reference

## 📋 Оглавление

1. [Обзор API](#обзор-api)
2. [Аутентификация](#аутентификация)
3. [Публичные Endpoints](#публичные-endpoints)
4. [Защищенные Endpoints](#защищенные-endpoints)
5. [WebSocket API](#websocket-api)
6. [Webhook События](#webhook-события)
7. [Коды ошибок](#коды-ошибок)
8. [Примеры использования](#примеры-использования)

## 🎯 Обзор API

### Базовый URL
```
Production: https://ai-admin.app/marketplace
Development: http://localhost:3000/marketplace
```

### Форматы данных
- Все запросы и ответы в формате JSON
- Даты в формате ISO 8601
- Телефоны в международном формате (+7XXXXXXXXXX)

### Заголовки
```http
Content-Type: application/json
Accept: application/json
X-API-Key: sk_... (для защищенных endpoints)
```

## 🔒 Аутентификация

### JWT Токены
Используются для временной аутентификации при подключении WhatsApp:
```javascript
{
  "company_id": 123,
  "iat": 1234567890,
  "exp": 1234654290
}
```

### API Ключи
Формат: `sk_[random_string]`
Используются для административных endpoint'ов.

## 📌 Публичные Endpoints

### GET /marketplace/
**Описание**: Главная страница интеграции YClients

**Response**:
```http
HTTP/1.1 200 OK
Content-Type: text/html

<!DOCTYPE html>
<html>...</html>
```

---

### GET /marketplace/test
**Описание**: Проверка работоспособности API

**Response**:
```json
{
  "success": true,
  "status": "ok",
  "endpoints": {
    "connect": "/marketplace/connect",
    "register": "POST /marketplace/register",
    "qr": "/marketplace/qr/:token",
    "status": "/marketplace/status/:companyId",
    "callback": "POST /marketplace/callback",
    "webhook": "POST /marketplace/webhook/:companyId",
    "companies": "/marketplace/companies"
  },
  "message": "Marketplace integration endpoints are ready"
}
```

---

### GET /marketplace/connect
**Описание**: Страница подключения WhatsApp

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | JWT токен авторизации |
| company | number | Yes | ID компании |
| salon | number | Yes | ID салона в YClients |

**Response**:
```http
HTTP/1.1 200 OK
Content-Type: text/html

<!DOCTYPE html>
<!-- Страница с QR-кодом для подключения -->
```

## 🔐 Защищенные Endpoints

### POST /marketplace/register
**Описание**: Регистрация новой компании из маркетплейса YClients

**Request Body**:
```json
{
  "salon_id": 962302,
  "phone": "+79001234567",
  "email": "salon@example.com"
}
```

**Validation Rules**:
- `salon_id`: required, positive integer
- `phone`: optional, 10-15 digits
- `email`: optional, valid email format

**Success Response** (201):
```json
{
  "success": true,
  "company_id": 15,
  "salon_id": 962302,
  "api_key": "sk_abc123def456...",
  "connect_url": "/marketplace/connect?token=xxx&company=15&salon=962302",
  "message": "Компания успешно зарегистрирована"
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "Отсутствует обязательный параметр salon_id"
}
```

**Error Response** (500):
```json
{
  "success": false,
  "error": "Ошибка регистрации компании"
}
```

---

### GET /marketplace/qr/:token
**Описание**: Получение QR-кода для подключения WhatsApp

**URL Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| token | string | JWT токен сессии |

**Success Response** (200):
```json
{
  "success": true,
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "expires_in": 20
}
```

**Error Response** (401):
```json
{
  "success": false,
  "error": "Недействительный токен"
}
```

**Error Response** (500):
```json
{
  "success": false,
  "error": "Не удалось сгенерировать QR-код"
}
```

---

### GET /marketplace/status/:companyId
**Описание**: Получение статуса подключения компании

**URL Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| companyId | number | ID компании |

**Success Response** (200):
```json
{
  "success": true,
  "company_id": 1,
  "whatsapp_connected": true,
  "whatsapp_phone": "+79001234567",
  "integration_status": "active",
  "connected_at": "2024-09-16T12:00:00Z"
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": "Компания не найдена"
}
```

---

### POST /marketplace/callback
**Описание**: Callback для YClients после успешного подключения

**Request Body**:
```json
{
  "salon_id": 962302,
  "company_id": 1,
  "status": "connected",
  "whatsapp_phone": "+79001234567",
  "api_key": "sk_abc123..."
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Callback отправлен",
  "data": {
    "callback_sent_at": "2024-09-16T12:00:00Z"
  }
}
```

---

### POST /marketplace/webhook/:companyId
**Описание**: Webhook для получения событий от YClients

**URL Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| companyId | number | ID компании |

**Request Body** (пример события создания записи):
```json
{
  "type": "booking_created",
  "data": {
    "id": 12345,
    "client_id": 67890,
    "service_id": 45,
    "staff_id": 3,
    "datetime": "2024-09-17T15:00:00",
    "comment": "Первый визит"
  },
  "created_at": "2024-09-16T10:30:00Z"
}
```

**Response** (200):
```json
{
  "success": true
}
```

**Note**: Всегда возвращает 200 OK для избежания повторных вызовов

---

### GET /marketplace/companies
**Описание**: Статистика подключений (требует API ключ)

**Headers**:
```http
X-API-Key: sk_your_admin_api_key
```

**Success Response** (200):
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "connected": 142,
    "pending": 8,
    "disconnected": 0,
    "by_status": {
      "active": 142,
      "pending": 8,
      "inactive": 0
    },
    "last_24h": {
      "new_connections": 5,
      "disconnections": 0
    }
  }
}
```

**Error Response** (401):
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

## 🔌 WebSocket API

### Подключение
```javascript
const socket = io('/marketplace', {
  transportOptions: {
    polling: {
      extraHeaders: {
        'x-auth-token': 'your_jwt_token'
      }
    }
  }
});
```

### События

#### Client → Server

##### `authenticate`
Аутентификация подключения:
```javascript
socket.emit('authenticate', {
  token: 'jwt_token',
  companyId: 123
});
```

##### `getQR`
Запрос QR-кода:
```javascript
socket.emit('getQR', {
  companyId: 123
});
```

#### Server → Client

##### `authenticated`
Успешная аутентификация:
```javascript
socket.on('authenticated', (data) => {
  console.log('Authenticated for company:', data.companyId);
});
```

##### `qr`
Новый QR-код:
```javascript
socket.on('qr', (data) => {
  console.log('QR code:', data.qr);
  console.log('Company:', data.companyId);
});
```

##### `whatsapp.connected`
WhatsApp подключен:
```javascript
socket.on('whatsapp.connected', (data) => {
  console.log('WhatsApp connected:', data.phone);
  console.log('Company:', data.companyId);
});
```

##### `whatsapp.disconnected`
WhatsApp отключен:
```javascript
socket.on('whatsapp.disconnected', (data) => {
  console.log('WhatsApp disconnected for company:', data.companyId);
});
```

##### `error`
Ошибка:
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error.message);
});
```

## 📨 Webhook События

### Типы событий от YClients

#### `booking_created`
Создана новая запись:
```json
{
  "type": "booking_created",
  "data": {
    "id": 12345,
    "client_id": 67890,
    "service_id": 45,
    "staff_id": 3,
    "datetime": "2024-09-17T15:00:00"
  }
}
```

#### `booking_updated`
Запись изменена:
```json
{
  "type": "booking_updated",
  "data": {
    "id": 12345,
    "changes": {
      "datetime": {
        "old": "2024-09-17T15:00:00",
        "new": "2024-09-17T16:00:00"
      }
    }
  }
}
```

#### `booking_cancelled`
Запись отменена:
```json
{
  "type": "booking_cancelled",
  "data": {
    "id": 12345,
    "cancelled_at": "2024-09-16T12:00:00Z",
    "reason": "Client request"
  }
}
```

#### `client_created`
Новый клиент:
```json
{
  "type": "client_created",
  "data": {
    "id": 67890,
    "name": "Иван Иванов",
    "phone": "+79001234567"
  }
}
```

## ❌ Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Bad Request - некорректные параметры запроса |
| 401 | Unauthorized - недействительный токен или API ключ |
| 404 | Not Found - ресурс не найден |
| 429 | Too Many Requests - превышен лимит запросов |
| 500 | Internal Server Error - внутренняя ошибка сервера |
| 502 | Bad Gateway - ошибка связи с внешним сервисом |

## 💡 Примеры использования

### cURL

#### Регистрация компании
```bash
curl -X POST https://ai-admin.app/marketplace/register \
  -H "Content-Type: application/json" \
  -d '{
    "salon_id": 962302,
    "phone": "+79001234567",
    "email": "salon@example.com"
  }'
```

#### Получение статуса
```bash
curl https://ai-admin.app/marketplace/status/15
```

#### Тестирование API
```bash
curl https://ai-admin.app/marketplace/test
```

### JavaScript (Node.js)

#### Регистрация и подключение
```javascript
const axios = require('axios');

async function registerAndConnect() {
  try {
    // 1. Регистрация
    const registerResponse = await axios.post(
      'https://ai-admin.app/marketplace/register',
      {
        salon_id: 962302,
        phone: '+79001234567'
      }
    );

    const { company_id, connect_url, api_key } = registerResponse.data;
    console.log('Company registered:', company_id);
    console.log('Connect URL:', connect_url);

    // 2. Получение QR-кода
    const token = connect_url.split('token=')[1].split('&')[0];
    const qrResponse = await axios.get(
      `https://ai-admin.app/marketplace/qr/${token}`
    );

    console.log('QR code received:', qrResponse.data.qr.substring(0, 50) + '...');

    // 3. Проверка статуса
    const statusResponse = await axios.get(
      `https://ai-admin.app/marketplace/status/${company_id}`
    );

    console.log('WhatsApp connected:', statusResponse.data.whatsapp_connected);

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

registerAndConnect();
```

#### WebSocket подключение
```javascript
const io = require('socket.io-client');

function connectWebSocket(token, companyId) {
  const socket = io('https://ai-admin.app/marketplace', {
    transportOptions: {
      polling: {
        extraHeaders: {
          'x-auth-token': token
        }
      }
    }
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket');
    socket.emit('authenticate', { token, companyId });
  });

  socket.on('authenticated', (data) => {
    console.log('Authenticated:', data);
    socket.emit('getQR', { companyId });
  });

  socket.on('qr', (data) => {
    console.log('New QR code received');
    // Отобразить QR-код пользователю
  });

  socket.on('whatsapp.connected', (data) => {
    console.log('WhatsApp connected!', data);
    // Перенаправить на страницу успеха
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
}
```

### Python

#### Регистрация компании
```python
import requests
import json

def register_company(salon_id, phone=None, email=None):
    url = "https://ai-admin.app/marketplace/register"

    payload = {
        "salon_id": salon_id
    }

    if phone:
        payload["phone"] = phone
    if email:
        payload["email"] = email

    headers = {
        "Content-Type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers)

    if response.status_code == 201:
        data = response.json()
        print(f"Company registered: {data['company_id']}")
        print(f"Connect URL: {data['connect_url']}")
        return data
    else:
        print(f"Error: {response.status_code}")
        print(response.json())
        return None

# Использование
result = register_company(
    salon_id=962302,
    phone="+79001234567",
    email="salon@example.com"
)
```

### PHP

#### Получение статуса компании
```php
<?php

function getCompanyStatus($companyId) {
    $url = "https://ai-admin.app/marketplace/status/" . $companyId;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, false);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode == 200) {
        $data = json_decode($response, true);
        echo "Company ID: " . $data['company_id'] . "\n";
        echo "WhatsApp Connected: " . ($data['whatsapp_connected'] ? 'Yes' : 'No') . "\n";
        echo "Status: " . $data['integration_status'] . "\n";
        return $data;
    } else {
        echo "Error getting status: HTTP " . $httpCode . "\n";
        return null;
    }
}

// Использование
$status = getCompanyStatus(15);
?>
```

## 📊 Rate Limiting

### Лимиты запросов
- **Публичные endpoints**: 60 запросов в минуту с одного IP
- **Защищенные endpoints**: 120 запросов в минуту с API ключом
- **WebSocket подключения**: 5 подключений за 60 секунд с одного IP

### Заголовки ответа
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1694863200
```

### Обработка превышения лимита
При превышении лимита возвращается ошибка 429:
```json
{
  "success": false,
  "error": "Too many requests",
  "retry_after": 30
}
```

## 🔧 Обработка ошибок

### Рекомендации
1. Всегда проверяйте поле `success` в ответе
2. Обрабатывайте HTTP коды ответа
3. Реализуйте exponential backoff для повторных попыток
4. Логируйте все ошибки для отладки

### Пример обработки ошибок
```javascript
async function makeAPICall(url, options = {}) {
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 30;
        console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      return data;

    } catch (error) {
      console.error(`Attempt ${retries + 1} failed:`, error.message);
      retries++;

      if (retries >= maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## 📞 Поддержка

При возникновении проблем с API:

1. Проверьте статус сервиса: `GET /marketplace/test`
2. Убедитесь в правильности параметров запроса
3. Проверьте актуальность токенов и API ключей
4. Обратитесь в поддержку:
   - Email: support@ai-admin.app
   - Telegram: @ai_admin_support
   - GitHub Issues: https://github.com/vosarsen/ai_admin_v2/issues

---

*Последнее обновление: 16 сентября 2024*
*Версия API: 1.0.0*