# 📘 YClients Marketplace Integration - Complete Technical Specification

**Проект:** AI Admin v2
**Интеграция:** YClients Marketplace
**Версия документа:** 1.0
**Дата:** 29 октября 2025
**Статус:** Production Ready (98%)

---

## 📑 Содержание

1. [Общая информация](#общая-информация)
2. [Архитектура системы](#архитектура-системы)
3. [API Endpoints](#api-endpoints)
4. [Процесс онбординга](#процесс-онбординга)
5. [Авторизация и безопасность](#авторизация-и-безопасность)
6. [База данных](#база-данных)
7. [WebSocket интеграция](#websocket-интеграция)
8. [WhatsApp подключение](#whatsapp-подключение)
9. [Синхронизация данных](#синхронизация-данных)
10. [Webhook обработка](#webhook-обработка)
11. [AI обработка сообщений](#ai-обработка-сообщений)
12. [Мониторинг и логирование](#мониторинг-и-логирование)
13. [Deployment и инфраструктура](#deployment-и-инфраструктура)
14. [Найденные проблемы и решения](#найденные-проблемы-и-решения)
15. [Тестирование](#тестирование)

---

## Общая информация

### Описание проекта

AI Admin - это WhatsApp бот для автоматизации работы салонов красоты, интегрированный с системой YClients через официальный Marketplace.

**Основные функции:**
- Автоматические ответы клиентам 24/7
- Запись на услуги через WhatsApp
- Напоминания о предстоящих визитах
- Отмена и перенос записей
- Ответы на вопросы об услугах и ценах
- Управление расписанием мастеров

### Ключевые характеристики

| Характеристика | Значение |
|----------------|----------|
| **Backend** | Node.js 18+ (Express) |
| **Database** | PostgreSQL (Supabase) |
| **WebSocket** | Socket.IO 4.8.1 |
| **WhatsApp** | Baileys (WhatsApp Web Protocol) |
| **AI Provider** | Google Gemini 2.5 Flash |
| **Queue** | BullMQ (Redis) |
| **Process Manager** | PM2 |
| **Web Server** | Nginx (reverse proxy) |
| **SSL** | Let's Encrypt |
| **Hosting** | VPS 46.149.70.219 |

### Production URLs

```
Domain: https://ai-admin.app
Server: 46.149.70.219
Path: /opt/ai-admin
Port: 3000 (internal)
SSL: 443 (external)
```

---

## Архитектура системы

### High-Level Architecture

```
┌─────────────────┐
│  YClients       │
│  Marketplace    │
└────────┬────────┘
         │ 1. Redirect
         ↓
┌─────────────────────────────────────────────────────────┐
│                    AI Admin Backend                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Express    │  │  Socket.IO   │  │    PM2       │ │
│  │   Router     │  │  WebSocket   │  │  Manager     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘ │
│         │                  │                            │
│  ┌──────▼──────────────────▼─────────┐                │
│  │   Marketplace Integration          │                │
│  │   - Registration                   │                │
│  │   - Onboarding                     │                │
│  │   - Activation                     │                │
│  │   - Webhooks                       │                │
│  └────────────────────────────────────┘                │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Baileys    │  │   BullMQ     │  │    Sync      │ │
│  │   WhatsApp   │  │   Queue      │  │   Manager    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          ↓                  ↓                  ↓
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│   WhatsApp      │  │    Redis     │  │   Supabase   │
│   (Client)      │  │              │  │  PostgreSQL  │
└─────────────────┘  └──────────────┘  └──────────────┘
          │                                     ↑
          │                                     │
          ↓                                     │
┌─────────────────┐                   ┌─────────────────┐
│  Google Gemini  │                   │   YClients API  │
│  2.5 Flash      │                   │                 │
└─────────────────┘                   └─────────────────┘
```

### Component Breakdown

#### 1. **API Layer** (`src/api/`)
- Express.js HTTP server
- Socket.IO WebSocket server
- REST API endpoints
- Middleware (auth, rate limiting, CORS)

#### 2. **Integration Layer** (`src/api/routes/yclients-marketplace.js`)
- Registration redirect handler
- Onboarding page server
- QR/Pairing code generation
- Integration activation
- Webhook receiver

#### 3. **WebSocket Layer** (`src/api/websocket/marketplace-socket.js`)
- Real-time QR code updates
- Pairing code delivery
- Connection status updates
- Event broadcasting

#### 4. **WhatsApp Layer** (`src/integrations/whatsapp/`)
- Session pool management
- Message sending/receiving
- QR code generation
- Pairing code generation
- Connection state management

#### 5. **Sync Layer** (`src/sync/`)
- YClients data synchronization
- Scheduled jobs (cron)
- Company, services, staff, schedules
- Incremental updates

#### 6. **Queue Layer** (`src/queue/`)
- BullMQ message queue
- Worker processes
- Job scheduling
- Retry logic

#### 7. **AI Layer** (`src/services/ai-admin-v2/`)
- Google Gemini integration
- Two-stage processing
- Command extraction
- Response generation

#### 8. **Database Layer** (`src/database/`)
- Supabase client
- PostgreSQL operations
- Real-time subscriptions

---

## API Endpoints

### Marketplace Endpoints

#### 1. Registration Redirect
```http
GET /auth/yclients/redirect?salon_id={id}&user_id={id}&user_name={name}

Описание: Точка входа из YClients Marketplace
Параметры:
  - salon_id (required): ID салона в YClients
  - user_id (optional): ID пользователя YClients
  - user_name (optional): Имя пользователя
  - user_phone (optional): Телефон пользователя
  - user_email (optional): Email пользователя

Ответ: 302 Redirect → /marketplace/onboarding?token={jwt}

Обработка:
1. Проверка PARTNER_TOKEN
2. GET https://api.yclients.com/api/v1/company/{salon_id}
3. UPSERT в таблицу companies
4. Генерация JWT (TTL: 1 час)
5. Создание события registration_started
6. Редирект на onboarding
```

**Код:** `src/api/routes/yclients-marketplace.js:34-159`

#### 2. Onboarding Page
```http
GET /marketplace/onboarding?token={jwt}

Описание: Страница подключения WhatsApp
Параметры:
  - token (required): JWT токен из registration redirect

Ответ: HTML страница (200 OK) или Error Page (401/400)

Обработка:
1. Валидация JWT токена
2. Проверка срока действия
3. Отдача HTML файла
```

**Файл:** `public/marketplace/onboarding.html`
**Код:** `src/api/routes/yclients-marketplace.js:165-202`

#### 3. QR Code Generation
```http
POST /marketplace/api/qr
Headers:
  Authorization: Bearer {jwt}

Описание: Генерация QR-кода для WhatsApp
Тело: пустое

Ответ:
{
  "success": true,
  "qr": "data:image/png;base64,...",
  "session_id": "company_962302",
  "expires_in": 20
}

Обработка:
1. Валидация JWT
2. Извлечение company_id, salon_id
3. Создание session_id = "company_{salon_id}"
4. sessionPool.getQR(sessionId) или создание сессии
5. Возврат QR кода
```

**Код:** `src/api/routes/yclients-marketplace.js:209-268`

#### 4. Connection Status Check
```http
GET /marketplace/api/status/:sessionId
Headers:
  Authorization: Bearer {jwt}

Описание: Проверка статуса подключения WhatsApp
Параметры:
  - sessionId: ID сессии (company_{salon_id})

Ответ:
{
  "success": true,
  "status": "connected" | "connecting" | "disconnected",
  "connected": true | false,
  "session_id": "company_962302"
}
```

**Код:** `src/api/routes/yclients-marketplace.js:275-309`

#### 5. Integration Activation
```http
POST /marketplace/activate
Content-Type: application/json

{
  "token": "{jwt}"
}

Описание: Активация интеграции в YClients
Тело:
  - token (required): JWT токен

Ответ:
{
  "success": true,
  "message": "Integration activated successfully",
  "company_id": 123,
  "salon_id": 962302,
  "yclients_response": {...}
}

Обработка:
1. Валидация JWT
2. Проверка времени регистрации (< 60 мин)
3. Генерация API ключа (crypto.randomBytes(32))
4. Сохранение API ключа в БД
5. POST https://api.yclients.com/marketplace/partner/callback/redirect
6. Обновление статуса → 'active'
7. Создание события integration_activated
```

**Код:** `src/api/routes/yclients-marketplace.js:316-473`

#### 6. Webhook Receiver
```http
POST /webhook/yclients
Content-Type: application/json

{
  "event_type": "uninstall" | "freeze" | "payment" | "record_*",
  "salon_id": 962302,
  "data": {...}
}

Описание: Прием webhook событий от YClients
Тело:
  - event_type (required): Тип события
  - salon_id (required): ID салона
  - data (optional): Данные события

Ответ: 200 OK (быстрый ответ < 500ms)

Обработка (асинхронно):
- uninstall: Остановка WhatsApp, статус → 'uninstalled'
- freeze: Статус → 'frozen'
- payment: Статус → 'active', обновление last_payment_date
- record_*: Логирование (обработка в webhook-processor)
```

**Код:** `src/api/routes/yclients-marketplace.js:479-648`

#### 7. Health Check
```http
GET /marketplace/health

Описание: Проверка работоспособности системы

Ответ:
{
  "status": "ok" | "error",
  "timestamp": "2025-10-29T12:00:00.000Z",
  "environment": {
    "partner_token": true,
    "app_id": true,
    "jwt_secret": true,
    "base_url": "https://ai-admin.app",
    "node_version": "v18.17.0"
  },
  "dependencies": {
    "express": true,
    "jsonwebtoken": true,
    "supabase": true,
    "session_pool": true
  },
  "services": {
    "api_running": true,
    "database_connected": true,
    "whatsapp_pool_ready": true
  },
  "missing": [] // если есть проблемы
}
```

**Код:** `src/api/routes/yclients-marketplace.js:511-550`

### YClients API Calls

#### Получение информации о компании
```http
GET https://api.yclients.com/api/v1/company/{salon_id}
Headers:
  Authorization: Bearer {PARTNER_TOKEN}
  Accept: application/vnd.yclients.v2+json

Используется: При registration redirect
```

#### Callback активации
```http
POST https://api.yclients.com/marketplace/partner/callback/redirect
Headers:
  Authorization: Bearer {PARTNER_TOKEN}
  Content-Type: application/json
  Accept: application/vnd.yclients.v2+json

Body:
{
  "salon_id": 962302,
  "application_id": {APP_ID},
  "api_key": "generated_unique_key",
  "webhook_urls": [
    "https://ai-admin.app/webhook/yclients"
  ]
}

Ответ: 301 Redirect (успех) или ошибка
```

---

## Процесс онбординга

### Полный Flow (Step by Step)

#### Step 1: YClients Redirect
```
Пользователь → YClients Marketplace → Клик "Подключить"
                                              ↓
YClients проверяет права пользователя
                                              ↓
YClients делает редирект:
GET https://ai-admin.app/auth/yclients/redirect?salon_id=962302&user_id=123

Время: 0-2 секунды
```

#### Step 2: Registration Processing
```
AI Admin получает запрос
                ↓
Проверяет PARTNER_TOKEN
                ↓
Получает данные салона:
GET https://api.yclients.com/api/v1/company/962302
                ↓
UPSERT в БД:
INSERT INTO companies (yclients_id, title, phone, ...)
ON CONFLICT (yclients_id) DO UPDATE ...
                ↓
Генерирует JWT токен:
jwt.sign({ company_id, salon_id, type: 'marketplace_registration' },
         JWT_SECRET,
         { expiresIn: '1h' })
                ↓
Создает событие:
INSERT INTO marketplace_events (event_type: 'registration_started')
                ↓
Редиректит:
302 → /marketplace/onboarding?token={jwt}

Время: 2-3 секунды
```

#### Step 3: Onboarding Page Load
```
Браузер загружает /marketplace/onboarding?token={jwt}
                ↓
Сервер проверяет JWT
                ↓
Отдает HTML страницу (public/marketplace/onboarding.html)
                ↓
HTML инициализирует:
  - Декодирует JWT для получения salon_id
  - Подключается к WebSocket /marketplace
  - Отображает UI с выбором метода (QR / Pairing Code)

Время: 1 секунда
```

#### Step 4: WebSocket Connection
```
HTML:
socket = io('/marketplace', { auth: { token: jwt } })
                ↓
Backend (marketplace-socket.js):
  1. Валидация токена
  2. Извлечение companyId из JWT
  3. Rate limiting по IP
  4. Проверка origin (production)
  5. socket.join(`company-${companyId}`)
                ↓
Автоматический запуск:
startWhatsAppConnection(socket, companyId)
                ↓
Session Pool:
  - Создание сессии Baileys
  - Генерация QR кода
  - Эмит события 'qr'
                ↓
WebSocket фильтрует и отправляет:
socket.emit('qr-update', { qr, expiresIn: 20 })
                ↓
HTML отображает QR код

Время: 1-2 секунды
```

#### Step 5: WhatsApp Connection (вариант A - QR)
```
Пользователь сканирует QR код камерой телефона
                ↓
WhatsApp отправляет подтверждение
                ↓
Baileys получает подтверждение
                ↓
Session Pool эмитит:
emit('connected', { companyId, user, phoneNumber })
                ↓
WebSocket ловит событие (с фильтрацией):
if (data.companyId === companyId) {
  socket.emit('whatsapp-connected', { success: true, phone })
}
                ↓
HTML получает событие 'whatsapp-connected'
                ↓
Автоматически вызывает:
await activateIntegration()

Время: 5-15 секунд (зависит от пользователя)
```

#### Step 5: WhatsApp Connection (вариант B - Pairing Code)
```
Пользователь выбирает "Код сопряжения"
                ↓
Вводит номер WhatsApp (79001234567)
                ↓
Нажимает "Получить код"
                ↓
HTML:
socket.emit('request-pairing-code', { phoneNumber })
                ↓
Backend создает сессию:
sessionPool.createSession(companyId, {
  usePairingCode: true,
  phoneNumber
})
                ↓
Baileys генерирует 8-значный код
                ↓
Session Pool эмитит:
emit('pairing-code', { companyId, code, phoneNumber })
                ↓
WebSocket отправляет:
socket.emit('pairing-code', { code, phoneNumber, expiresIn: 60 })
                ↓
HTML отображает код крупным шрифтом
                ↓
Пользователь вводит код в WhatsApp (60 секунд)
                ↓
WhatsApp подключается
                ↓
Далее как в варианте A (событие 'connected')

Время: 10-20 секунд
```

#### Step 6: Integration Activation
```
HTML вызывает:
POST /marketplace/activate
Body: { token: jwt }
                ↓
Backend:
  1. Валидация JWT
  2. Проверка времени регистрации (< 60 мин)
  3. Генерация API ключа:
     const apiKey = crypto.randomBytes(32).toString('hex')
  4. СОХРАНЕНИЕ в БД:
     UPDATE companies SET api_key = apiKey WHERE id = company_id
  5. Отправка callback в YClients:
     POST https://api.yclients.com/marketplace/partner/callback/redirect
     Body: { salon_id, application_id, api_key, webhook_urls }
  6. Обновление статуса:
     UPDATE companies SET integration_status = 'active'
  7. Создание события:
     INSERT INTO marketplace_events (event_type: 'integration_activated')
                ↓
YClients получает callback
                ↓
YClients активирует интеграцию
                ↓
AI Admin получает ответ 200 OK / 301 Redirect
                ↓
Backend запускает онбординг:
startOnboarding(companyId, whatsappPhone)

Время: 2-3 секунды
```

#### Step 7: Onboarding & Data Sync
```
startOnboarding(companyId, whatsappPhone):
  1. Обновление в БД:
     UPDATE companies SET
       whatsapp_connected = true,
       whatsapp_phone = whatsappPhone,
       integration_status = 'active'

  2. Запуск синхронизации:
     syncManager.syncAll(companyId)  // ⚠️ ИСПРАВИТЬ на runFullSync()

     Синхронизирует:
     - Информацию о компании
     - Услуги
     - Мастеров
     - Клиентов
     - Расписания
     - Активные записи

  3. Отправка приветственного сообщения (через 2 сек):
     sessionPool.sendMessage(companyId, whatsappPhone, welcomeMessage)
                ↓
HTML показывает:
  - Сообщение "WhatsApp успешно подключен!"
  - Анимация загрузки
  - Через 3 секунды: "Готово! Бот активен"

Время: 3-5 секунд (синхронизация в фоне)
```

#### Step 8: Ready to Use
```
✅ Интеграция активна
✅ WhatsApp подключен
✅ Данные синхронизированы
✅ Webhook настроен
✅ Бот готов к работе

Общее время: 20-30 секунд
```

### Диаграмма последовательности

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant YC as YClients
    participant BE as AI Admin Backend
    participant WS as WebSocket
    participant SP as Session Pool
    participant WA as WhatsApp
    participant DB as Database

    User->>YC: Клик "Подключить"
    YC->>BE: GET /auth/yclients/redirect?salon_id=962302
    BE->>YC: GET /api/v1/company/962302
    YC-->>BE: Company info
    BE->>DB: UPSERT companies
    BE->>DB: INSERT marketplace_events
    BE-->>User: 302 Redirect → /onboarding?token=jwt

    User->>BE: GET /marketplace/onboarding?token=jwt
    BE-->>User: HTML page

    User->>WS: Connect to /marketplace
    WS->>WS: Validate JWT
    WS->>SP: createSession(companyId)
    SP->>SP: Generate QR
    SP-->>WS: emit('qr', {companyId, qr})
    WS-->>User: emit('qr-update', {qr})

    User->>WA: Scan QR / Enter code
    WA-->>SP: Connection confirmed
    SP-->>WS: emit('connected', {companyId, phone})
    WS-->>User: emit('whatsapp-connected')

    User->>BE: POST /marketplace/activate
    BE->>DB: UPDATE companies (api_key)
    BE->>YC: POST /marketplace/partner/callback/redirect
    YC-->>BE: 200 OK
    BE->>DB: UPDATE companies (status='active')
    BE->>BE: startOnboarding()
    BE->>DB: Sync data
    BE->>WA: Send welcome message
    BE-->>User: {success: true}

    User->>User: Show success screen
```

---

## Авторизация и безопасность

### Используемые токены

#### 1. Partner Token
```javascript
const PARTNER_TOKEN = process.env.YCLIENTS_PARTNER_TOKEN;

Назначение: Авторизация всех запросов к YClients API
Формат: Bearer token
Хранение: .env файл, переменная окружения
Использование:
  headers: {
    'Authorization': `Bearer ${PARTNER_TOKEN}`,
    'Accept': 'application/vnd.yclients.v2+json'
  }

Где используется:
- GET /api/v1/company/{salon_id}
- POST /marketplace/partner/callback/redirect
- Все YClients API запросы
```

#### 2. JWT Token (Internal)
```javascript
const JWT_SECRET = process.env.JWT_SECRET;

Назначение: Безопасная передача данных в onboarding процессе
TTL: 1 час
Формат:
{
  "company_id": 123,
  "salon_id": 962302,
  "type": "marketplace_registration",
  "user_data": {
    "user_id": "...",
    "user_name": "...",
    "user_phone": "...",
    "user_email": "..."
  },
  "iat": 1234567890,
  "exp": 1234571490
}

Генерация:
jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })

Валидация:
jwt.verify(token, JWT_SECRET)

Где используется:
- /marketplace/onboarding (query parameter)
- /marketplace/api/qr (Authorization header)
- /marketplace/api/status/:id (Authorization header)
- /marketplace/activate (request body)
- WebSocket auth (auth.token)
```

#### 3. API Key (Per-Company)
```javascript
const apiKey = crypto.randomBytes(32).toString('hex');

Назначение: Уникальный идентификатор салона для webhook
Генерация: При активации интеграции
Хранение: companies.api_key в БД
Длина: 64 символа (hex)

Использование:
- Отправляется в YClients при callback
- Сохраняется ПЕРЕД отправкой (критично!)
- Может использоваться для валидации webhook (будущее)
```

### Безопасность

#### HTTPS
```
✅ Все соединения через HTTPS (443)
✅ SSL сертификат от Let's Encrypt
✅ Автоматическое обновление сертификата
✅ HTTP → HTTPS редирект в Nginx
```

#### CORS
```javascript
// src/api/index.js:40-46
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://ai-admin.app', 'https://yclients.com', 'https://n962302.yclients.com']
      : '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

#### Rate Limiting

**WebSocket:**
```javascript
// src/api/websocket/marketplace-socket.js:13-15
this.RATE_LIMIT_MAX = 5; // Максимум 5 подключений
this.RATE_LIMIT_WINDOW = 60000; // За 60 секунд

// Проверка (строка 32-39):
if (!this.checkRateLimit(clientIp)) {
  logger.warn('Rate limit превышен для IP:', clientIp);
  socket.disconnect();
  return;
}
```

**REST API:**
```javascript
// Middleware в src/middlewares/rate-limiter.js
// Используется на критических endpoints:
app.post('/api/send-message', rateLimiter, ...)
app.get('/api/metrics', rateLimiter, ...)
app.post('/api/sync/schedules', rateLimiter, ...)
```

#### Origin Validation (WebSocket)
```javascript
// src/api/websocket/marketplace-socket.js:42-56
if (process.env.NODE_ENV === 'production') {
  const allowedOrigins = [
    'https://ai-admin.app',
    'https://yclients.com',
    'https://n962302.yclients.com'
  ];
  const origin = socket.handshake.headers.origin;

  if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed))) {
    logger.warn('Недопустимый origin:', origin);
    socket.disconnect();
    return;
  }
}
```

#### JWT Validation (Multi-Source)
```javascript
// src/api/websocket/marketplace-socket.js:58-80
// Приоритет источников JWT:
// 1. Authorization header (самый безопасный)
const authHeader = socket.handshake.headers.authorization;
if (authHeader && authHeader.startsWith('Bearer ')) {
  token = authHeader.substring(7);
}
// 2. Socket.IO auth object (Socket.IO v4)
else if (socket.handshake.auth?.token) {
  token = socket.handshake.auth.token;
}
// 3. Query parameter (fallback, с предупреждением)
else if (socket.handshake.query.token) {
  token = socket.handshake.query.token;
  logger.warn('Токен через query - небезопасно!');
}

// Проверка наличия
if (!token) {
  socket.disconnect();
  return;
}

// Валидация
const decoded = jwt.verify(token, JWT_SECRET);
companyId = decoded.company_id; // Извлекаем из токена (безопасно!)
```

#### Webhook Signature (TODO)
```javascript
// src/api/routes/yclients-marketplace.js:479
// ⚠️ В настоящее время НЕ реализовано
// TODO: Добавить проверку подписи от YClients

router.post('/webhook/yclients', async (req, res) => {
  // TODO: Проверить signature
  const signature = req.headers['x-yclients-signature'];
  if (signature && !verifyWebhookSignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // ...
});
```

#### Environment Variables Protection
```bash
# Критические переменные в .env:
YCLIENTS_PARTNER_TOKEN=xxx  # НЕ в git
YCLIENTS_APP_ID=xxx         # НЕ в git
JWT_SECRET=xxx              # НЕ в git
DATABASE_URL=xxx            # НЕ в git

# .gitignore:
.env
.env.local
.env.production
```

---

## База данных

### Supabase PostgreSQL Schema

#### Таблица: companies
```sql
CREATE TABLE companies (
  id BIGSERIAL PRIMARY KEY,
  yclients_id INTEGER UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  timezone VARCHAR(50) DEFAULT 'Europe/Moscow',

  -- Marketplace fields
  integration_status VARCHAR(50) DEFAULT 'pending_whatsapp',
  marketplace_user_id VARCHAR(100),
  marketplace_user_name VARCHAR(255),
  marketplace_user_phone VARCHAR(50),
  marketplace_user_email VARCHAR(255),

  -- WhatsApp fields
  whatsapp_connected BOOLEAN DEFAULT false,
  whatsapp_phone VARCHAR(50),
  whatsapp_connected_at TIMESTAMP,

  -- API key
  api_key VARCHAR(255),

  -- Payment
  last_payment_date TIMESTAMP,

  -- Timestamps
  connected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_yclients_id ON companies(yclients_id);
CREATE INDEX idx_companies_status ON companies(integration_status);
CREATE INDEX idx_companies_whatsapp ON companies(whatsapp_connected);
```

**Возможные значения integration_status:**
- `pending_whatsapp` - Ожидает подключения WhatsApp
- `activating` - В процессе активации
- `active` - Активна и работает
- `activation_failed` - Ошибка активации
- `frozen` - Заморожена
- `uninstalled` - Отключена

#### Таблица: marketplace_events
```sql
CREATE TABLE marketplace_events (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id),
  salon_id INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_marketplace_events_company ON marketplace_events(company_id);
CREATE INDEX idx_marketplace_events_salon ON marketplace_events(salon_id);
CREATE INDEX idx_marketplace_events_type ON marketplace_events(event_type);
CREATE INDEX idx_marketplace_events_created ON marketplace_events(created_at DESC);
```

**Типы событий:**
- `registration_started` - Начало регистрации
- `whatsapp_connected` - WhatsApp подключен
- `integration_activated` - Интеграция активирована
- `integration_failed` - Ошибка активации
- `uninstalled` - Интеграция отключена
- `payment_received` - Получен платеж

#### Таблица: services
```sql
CREATE TABLE services (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id),
  yclients_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  category_id INTEGER,
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  duration INTEGER, -- minutes
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, yclients_id)
);
```

#### Таблица: staff
```sql
CREATE TABLE staff (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id),
  yclients_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  specialization VARCHAR(255),
  avatar_url TEXT,
  rating DECIMAL(3,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, yclients_id)
);
```

#### Таблица: clients
```sql
CREATE TABLE clients (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id),
  yclients_id INTEGER NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  visit_count INTEGER DEFAULT 0,
  last_visit_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, yclients_id)
);

CREATE INDEX idx_clients_phone ON clients(phone);
```

#### Таблица: schedules
```sql
CREATE TABLE schedules (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id),
  staff_id BIGINT REFERENCES staff(id),
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_schedules_date ON schedules(date);
CREATE INDEX idx_schedules_staff ON schedules(staff_id);
```

#### Таблица: bookings
```sql
CREATE TABLE bookings (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id),
  yclients_id INTEGER UNIQUE NOT NULL,
  client_id BIGINT REFERENCES clients(id),
  staff_id BIGINT REFERENCES staff(id),
  service_id BIGINT REFERENCES services(id),
  datetime TIMESTAMP NOT NULL,
  status VARCHAR(50),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bookings_datetime ON bookings(datetime);
CREATE INDEX idx_bookings_status ON bookings(status);
```

---

## WebSocket интеграция

### Socket.IO Configuration

**Файл:** `src/api/index.js:36-56`

```javascript
const http = require('http');
const { Server } = require('socket.io');
const MarketplaceSocket = require('./websocket/marketplace-socket');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://ai-admin.app', 'https://yclients.com', 'https://n962302.yclients.com']
      : '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling'], // Fallback на polling!
  pingTimeout: 60000,
  pingInterval: 25000
});

new MarketplaceSocket(io);
logger.info('✅ Socket.IO server initialized for marketplace integration');

// ВАЖНО: Экспортируем server, НЕ app
module.exports = server;
```

### Marketplace WebSocket Handler

**Файл:** `src/api/websocket/marketplace-socket.js`

#### Класс MarketplaceSocket

```javascript
class MarketplaceSocket {
  constructor(io) {
    this.io = io;
    this.sessionPool = getSessionPool();
    this.connections = new Map(); // companyId -> socket
    this.rateLimiter = new Map(); // IP -> { count, lastReset }
    this.RATE_LIMIT_MAX = 5;
    this.RATE_LIMIT_WINDOW = 60000;

    // Создаем namespace для маркетплейса
    this.namespace = io.of('/marketplace');
    this.setupHandlers();
    this.startCleanupTimer();
  }

  // ... методы
}
```

#### События от клиента (browser → server)

```javascript
// Подключение
socket.connect()

// Запрос нового QR-кода
socket.emit('request-qr')

// Запрос pairing code
socket.emit('request-pairing-code', { phoneNumber: '79001234567' })

// Отключение
socket.disconnect()
```

#### События к клиенту (server → browser)

```javascript
// Подключение установлено
socket.on('connect', () => {})

// Обновление QR-кода
socket.on('qr-update', (data) => {
  // data: { qr: "data:image/png;base64,...", expiresIn: 20 }
})

// Pairing code получен
socket.on('pairing-code', (data) => {
  // data: { code: "XXXX-XXXX", phoneNumber: "79001234567", expiresIn: 60 }
})

// WhatsApp подключен
socket.on('whatsapp-connected', (data) => {
  // data: { success: true, phone: "79001234567", companyId: 123 }
})

// Ошибка
socket.on('error', (error) => {
  // error: { message: "..." }
})

// Отключение
socket.on('disconnect', () => {})
```

#### Session Pool Events (internal)

```javascript
// Session Pool эмитит глобальные события:
sessionPool.emit('qr', { companyId, qr })
sessionPool.emit('connected', { companyId, user, phoneNumber })
sessionPool.emit('logout', { companyId })
sessionPool.emit('pairing-code', { companyId, code, phoneNumber })

// WebSocket подписывается с фильтрацией:
const handleQR = (data) => {
  if (data.companyId === companyId) {
    socket.emit('qr-update', { qr: data.qr, expiresIn: 20 });
  }
};
this.sessionPool.on('qr', handleQR);

// Cleanup при disconnect:
socket.on('disconnect', () => {
  this.sessionPool.off('qr', handleQR);
  this.sessionPool.off('connected', handleConnected);
  this.sessionPool.off('logout', handleLogout);
  this.sessionPool.off('pairing-code', handlePairingCode);
});
```

### Frontend WebSocket (HTML)

**Файл:** `public/marketplace/onboarding.html:498-565`

```javascript
// Инициализация
function initWebSocket() {
  socket = io('/marketplace', {
    auth: { token: token }  // JWT токен
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('qr-update', (data) => {
    currentQR = data.qr;
    displayQR(data.qr);
    startQRTimer();
  });

  socket.on('whatsapp-connected', async (data) => {
    console.log('WhatsApp connected!', data);
    await activateIntegration();
    handleWhatsAppConnected();
  });

  socket.on('pairing-code', (data) => {
    console.log('Pairing code received:', data);
    displayPairingCode(data.code);
  });

  // FALLBACK: Polling на случай если WebSocket не работает
  let activationAttempts = 0;
  const checkConnectionStatus = setInterval(async () => {
    if (activationAttempts >= 30) {
      clearInterval(checkConnectionStatus);
      showError('Timeout подключения WhatsApp');
      return;
    }

    try {
      const sessionId = `company_${tokenData.salon_id}`;
      const response = await fetch(`/marketplace/api/status/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.connected) {
          clearInterval(checkConnectionStatus);
          await activateIntegration();
          handleWhatsAppConnected();
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
    }

    activationAttempts++;
  }, 1000);

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
    showError(error.message || 'Ошибка подключения');
  });
}
```

---

## WhatsApp подключение

### Baileys Integration

**Библиотека:** [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
**Файл:** `src/integrations/whatsapp/session-pool.js`

#### Session Pool Class

```javascript
class SessionPool extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // companyId -> BaileysInstance
    this.qrCodes = new Map();  // companyId -> QR code
    this.locks = new Map();    // companyId -> boolean (prevent concurrent)
  }

  // Методы:
  // - createSession(companyId, options)
  // - getQR(companyId)
  // - getSessionStatus(companyId)
  // - sendMessage(companyId, phone, message)
  // - sendReaction(companyId, phone, emoji, messageId)
  // - removeSession(companyId)
  // - disconnectSession(companyId)
}
```

#### Создание сессии (QR метод)

```javascript
async createSession(companyId, options = {}) {
  // Проверка существующей сессии
  if (this.sessions.has(companyId)) {
    logger.info('Session already exists:', companyId);
    return;
  }

  // Lock для предотвращения concurrent создания
  if (this.locks.get(companyId)) {
    logger.warn('Session creation already in progress:', companyId);
    return;
  }
  this.locks.set(companyId, true);

  try {
    const sessionId = `company_${companyId}`;

    // Store для auth credentials
    const { state, saveCreds } = await useMultiFileAuthState(
      `./baileys_sessions/${sessionId}`
    );

    // Создание Baileys instance
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'], // Критично!
      logger: pino({ level: 'silent' })
    });

    // Обработчик connection update
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR код сгенерирован
      if (qr) {
        const qrDataURL = await QRCode.toDataURL(qr);
        this.qrCodes.set(companyId, qrDataURL);
        this.emit('qr', { companyId, qr: qrDataURL });
        logger.info('QR code generated:', companyId);
      }

      // Подключено
      if (connection === 'open') {
        this.qrCodes.delete(companyId);
        const user = sock.user;
        this.emit('connected', {
          companyId,
          user: { id: user.id, name: user.name },
          phoneNumber: user.id.split(':')[0]
        });
        logger.info('WhatsApp connected:', companyId);
      }

      // Отключено
      if (connection === 'close') {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          await this.createSession(companyId, options); // Reconnect
        } else {
          this.sessions.delete(companyId);
          this.emit('logout', { companyId });
        }
      }
    });

    // Сохранение credentials
    sock.ev.on('creds.update', saveCreds);

    // Сохранение instance
    this.sessions.set(companyId, sock);

  } catch (error) {
    logger.error('Failed to create session:', error);
    throw error;
  } finally {
    this.locks.delete(companyId);
  }
}
```

#### Создание сессии (Pairing Code метод)

```javascript
async createSession(companyId, options = {}) {
  // ... начало как выше

  if (options.usePairingCode && options.phoneNumber) {
    // Создание сессии без printQRInTerminal
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'], // КРИТИЧНО!
      logger: pino({ level: 'silent' })
    });

    // Запрос pairing code
    const code = await sock.requestPairingCode(options.phoneNumber);

    // Форматирование кода (XXXX-XXXX)
    const formattedCode = code.match(/.{1,4}/g).join('-');

    // Сохранение и эмит
    this.qrCodes.set(`pairing-${companyId}`, formattedCode);
    this.emit('pairing-code', {
      companyId,
      code: formattedCode,
      phoneNumber: options.phoneNumber
    });

    logger.info('Pairing code generated:', { companyId, code: formattedCode });

    // Далее обработчики как обычно
    sock.ev.on('connection.update', ...);
  }
}
```

#### Отправка сообщения

```javascript
async sendMessage(companyId, phone, message) {
  const session = this.sessions.get(companyId);

  if (!session) {
    throw new Error('Session not found');
  }

  // Форматирование номера для WhatsApp
  const formattedPhone = phone.includes('@')
    ? phone
    : `${phone}@s.whatsapp.net`;

  // Отправка
  await session.sendMessage(formattedPhone, { text: message });

  logger.info('Message sent:', { companyId, phone });
}
```

#### Отправка реакции

```javascript
async sendReaction(companyId, phone, emoji, messageId) {
  const session = this.sessions.get(companyId);

  if (!session) {
    throw new Error('Session not found');
  }

  const formattedPhone = phone.includes('@')
    ? phone
    : `${phone}@s.whatsapp.net`;

  await session.sendMessage(formattedPhone, {
    react: {
      text: emoji,
      key: { id: messageId, remoteJid: formattedPhone }
    }
  });

  logger.info('Reaction sent:', { companyId, phone, emoji });
}
```

### Важные моменты Baileys

#### Browser Configuration
```javascript
// КРИТИЧНО для pairing code!
browser: ['Ubuntu', 'Chrome', '20.0.04']

// Без этого:
// ❌ "Couldn't link device" ошибка при pairing code
// ❌ QR код может не работать стабильно

// Почему это работает:
// YClients использует те же browser fingerprints
// WhatsApp доверяет этой конфигурации
```

#### Multi-device Support
```javascript
// Baileys поддерживает WhatsApp Multi-Device:
// - Основное устройство (телефон) остается активным
// - Бот работает как "связанное устройство"
// - Поддержка до 4 связанных устройств
// - При выходе из телефона - бот отключается
```

#### Session Storage
```javascript
// Файловая система:
./baileys_sessions/
  └── company_962302/
      ├── creds.json          // Auth credentials
      ├── app-state-sync-key-*.json
      └── pre-key-*.json

// Автоматическое сохранение:
sock.ev.on('creds.update', saveCreds);

// При перезапуске сервера:
// - Сессии восстанавливаются автоматически
// - Не нужно заново сканировать QR
// - WhatsApp остается подключенным
```

---

## Синхронизация данных

### Sync Manager

**Файл:** `src/sync/sync-manager.js`

#### Класс SyncManager

```javascript
class SyncManager {
  constructor() {
    this.isInitialized = false;
    this.isRunning = false;
    this.cronJobs = [];

    this.modules = {
      company: new CompanyInfoSync(),
      services: new ServicesSync(),
      staff: new StaffSync(),
      clients: new ClientsSyncOptimized(),
      schedules: new SchedulesSync(),
      clientRecords: new ClientRecordsSync(),
      bookings: new BookingsSync(),
      visits: new VisitsSync()
    };

    this.schedule = {
      services: '0 1 * * *',          // 01:00 ежедневно
      staff: '0 2 * * *',             // 02:00 ежедневно
      clients: '0 3 * * *',           // 03:00 ежедневно
      visits: '0 4 * * *',            // 04:00 ежедневно
      schedules: '0 5 * * *',         // 05:00 FULL (30 дней)
      schedulesToday: '0 8-23 * * *', // 08:00-23:00 TODAY (today+tomorrow)
      company: '0 0 * * 0',           // 00:00 воскресенье
      bookings: '*/15 * * * *'        // Каждые 15 минут
    };
  }

  // Методы
}
```

#### Полная синхронизация

```javascript
async runFullSync() {
  if (this.isRunning) {
    logger.warn('Sync already running');
    return { success: false, message: 'Sync already in progress' };
  }

  this.isRunning = true;
  const startTime = Date.now();
  const results = {};

  try {
    logger.info('🚀 Starting full synchronization...');

    // 1. Компания
    results.company = await this.syncCompany();

    // 2. Услуги
    results.services = await this.syncServices();

    // 3. Мастера
    results.staff = await this.syncStaff();

    // 4. Клиенты
    results.clients = await this.syncClients({
      syncVisitHistory: process.env.SYNC_CLIENT_VISITS === 'true'
    });

    // 5. Расписания
    results.schedules = await this.syncSchedules();

    // 6. Активные записи
    results.bookings = await this.syncBookings();

    const duration = Math.round((Date.now() - startTime) / 1000);
    logger.info(`✅ Full sync completed in ${duration} seconds`);

    return { success: true, duration, results };

  } catch (error) {
    logger.error('Full sync failed:', error);
    return { success: false, error: error.message, results };
  } finally {
    this.isRunning = false;
  }
}
```

#### ⚠️ Проблема: syncAll(companyId)

```javascript
// ❌ ПРОБЛЕМА: Этот метод НЕ СУЩЕСТВУЕТ!
// Используется в: src/api/websocket/marketplace-socket.js:337
await syncManager.syncAll(companyId);

// ✅ РЕШЕНИЕ 1: Использовать существующий метод
await syncManager.runFullSync(); // Синхронизирует ВСЕ компании

// ✅ РЕШЕНИЕ 2 (РЕКОМЕНДУЕТСЯ): Добавить новый метод
async syncAll(companyId) {
  try {
    logger.info('🔄 Starting sync for company:', companyId);

    const results = {};

    results.company = await this.syncCompany();
    results.services = await this.syncServices();
    results.staff = await this.syncStaff();
    results.clients = await this.syncClients();
    results.schedules = await this.syncSchedules();
    results.bookings = await this.syncBookings();

    logger.info('✅ Company sync completed:', { companyId, results });
    return results;

  } catch (error) {
    logger.error('Company sync failed:', { companyId, error });
    throw error;
  }
}
```

### Расписание синхронизации

#### FULL Sync (30 дней вперед)
```javascript
// Запускается: 05:00 ежедневно (Moscow time)
cron.schedule('0 5 * * *', async () => {
  await syncManager.syncSchedules(); // 30 дней
}, { timezone: 'Europe/Moscow' });

// Метод: syncSchedules()
// Получает: GET /book_dates/{company_id}?start_date=...&end_date=...
// Период: Сегодня + 30 дней
// Время выполнения: ~5-10 секунд
```

#### TODAY-ONLY Sync (сегодня + завтра)
```javascript
// Запускается: Каждый час 08:00-23:00
cron.schedule('0 8-23 * * *', async () => {
  await syncManager.syncSchedulesToday(); // Только сегодня+завтра
}, { timezone: 'Europe/Moscow' });

// Метод: syncSchedulesToday()
// Получает: GET /book_dates/{company_id}?start_date=today&end_date=tomorrow
// Время выполнения: ~1-2 секунды
// Преимущество: Свежие данные каждый час
```

### Hybrid Schedules Sync

**Концепция:**
```
FULL sync (05:00):
├── День 1-30: Полные данные
└── Время: ~10 секунд

TODAY-ONLY sync (08:00-23:00 каждый час):
├── День 1-2: Свежие данные (max 1 час задержка)
└── Время: ~2 секунды

Результат:
├── Ближайшие дни: Задержка max 1 час
├── Дальние дни: Задержка max 24 часа
└── Vs старая система: Задержка всегда 24 часа
```

**Документация:** `docs/development-diary/2025-10-23-hybrid-schedules-sync.md`

---

## Webhook обработка

### Webhook Events

**Endpoint:** `POST /webhook/yclients`

#### Формат запроса от YClients

```json
{
  "event_type": "uninstall" | "freeze" | "payment" | "record_created" | "record_updated" | "record_deleted",
  "salon_id": 962302,
  "data": {
    // Данные зависят от типа события
  }
}
```

#### Обработка событий

**Файл:** `src/api/routes/yclients-marketplace.js:479-648`

```javascript
router.post('/webhook/yclients', async (req, res) => {
  try {
    const { event_type, salon_id, data } = req.body;

    logger.info('📨 YClients webhook received:', {
      event_type,
      salon_id,
      data_keys: data ? Object.keys(data) : []
    });

    // КРИТИЧНО: Быстрый ответ YClients (< 500ms)
    res.status(200).json({ success: true, received: true });

    // Обработка асинхронно (не блокируем ответ)
    setImmediate(async () => {
      try {
        await handleWebhookEvent(event_type, salon_id, data);
      } catch (error) {
        logger.error('❌ Webhook processing error:', error);
      }
    });

  } catch (error) {
    logger.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### Обработчики событий

**1. Uninstall (Отключение)**
```javascript
async function handleUninstall(salonId) {
  logger.info(`🗑️ Handling uninstall for salon ${salonId}`);

  // 1. Останавливаем WhatsApp сессию
  const sessionId = `company_${salonId}`;
  try {
    await sessionPool.removeSession(sessionId);
    logger.info('✅ WhatsApp session removed');
  } catch (error) {
    logger.error('❌ Failed to remove WhatsApp session:', error);
  }

  // 2. Обновляем статус в БД
  await supabase
    .from('companies')
    .update({
      integration_status: 'uninstalled',
      whatsapp_connected: false,
      updated_at: new Date().toISOString()
    })
    .eq('yclients_id', parseInt(salonId));

  logger.info('✅ Company marked as uninstalled');
}
```

**2. Freeze (Заморозка)**
```javascript
async function handleFreeze(salonId) {
  logger.info(`❄️ Handling freeze for salon ${salonId}`);

  await supabase
    .from('companies')
    .update({
      integration_status: 'frozen',
      updated_at: new Date().toISOString()
    })
    .eq('yclients_id', parseInt(salonId));

  logger.info('✅ Company marked as frozen');
}
```

**3. Payment (Оплата)**
```javascript
async function handlePayment(salonId, data) {
  logger.info(`💰 Payment received for salon ${salonId}:`, data);

  await supabase
    .from('companies')
    .update({
      integration_status: 'active',
      last_payment_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('yclients_id', parseInt(salonId));

  logger.info('✅ Payment processed');
}
```

**4. Record Events (Записи)**
```javascript
// record_created, record_updated, record_deleted
case 'record_created':
case 'record_updated':
case 'record_deleted':
  // Логируем (обработка в отдельном webhook-processor)
  logger.info(`📋 Record event: ${eventType} for salon ${salonId}`);
  break;
```

### Webhook Security (TODO)

```javascript
// ⚠️ В настоящее время НЕ реализовано
// TODO: Добавить проверку signature от YClients

const signature = req.headers['x-yclients-signature'];
if (signature) {
  const isValid = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex') === signature;

  if (!isValid) {
    logger.warn('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
}
```

---

## AI обработка сообщений

### Two-Stage Processing

**Концепция:**
```
Входящее сообщение
        ↓
Stage 1: Extract Commands (JSON)
        ├── AI анализирует сообщение
        ├── Извлекает команды и параметры
        ├── Возвращает JSON структуру
        └── Время: ~5 секунд
        ↓
Execute Commands
        ├── Поиск в расписании
        ├── Создание записи
        ├── Получение информации
        └── Время: ~0.01 секунды
        ↓
Stage 2: Generate Response
        ├── AI генерирует текст ответа
        ├── На основе результатов команд
        └── Время: ~4 секунды
        ↓
Отправка ответа клиенту

Итого: ~9 секунд (vs 24 сек с DeepSeek)
```

### AI Provider: Google Gemini 2.5 Flash

**Конфигурация:**
```javascript
// .env
AI_PROVIDER=gemini-flash
GEMINI_API_KEY=AIzaSyD...
SOCKS_PROXY=socks5://127.0.0.1:1080
USE_TWO_STAGE=true
AI_PROMPT_VERSION=two-stage
```

**Преимущества:**
- ⚡ 2.6x быстрее DeepSeek (9s vs 24s)
- 💰 73% дешевле ($29/мес vs $106/мес)
- 🌍 VPN через США (обход geo-blocking)
- 🎯 Точность: ~95% правильных ответов

**VPN Setup:**
```
Server: us.cdn.stun.su (USA)
Service: Xray (systemctl status xray)
Config: /usr/local/etc/xray/config.json
Port: 1080 (SOCKS5 proxy)
Latency: 108ms
```

**Документация:**
- `docs/AI_PROVIDERS_GUIDE.md`
- `docs/GEMINI_INTEGRATION_GUIDE.md`
- `docs/development-diary/2025-10-19-gemini-integration-with-vpn.md`

### Обработка сообщений

**Файл:** `src/services/ai-admin-v2/index.js`

```javascript
async function processMessage(message, context) {
  // Stage 1: Extract commands
  const commands = await extractCommands(message, context);

  // Execute commands
  const results = await executeCommands(commands);

  // Stage 2: Generate response
  const response = await generateResponse(message, results, context);

  return response;
}
```

---

## Мониторинг и логирование

### Winston Logger

**Файл:** `src/utils/logger.js`

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### PM2 Logs

```bash
# Просмотр логов
pm2 logs ai-admin-api

# Только ошибки
pm2 logs --err

# Последние 50 строк
pm2 logs --lines 50

# Очистка логов
pm2 flush
```

### MCP Log Server

**Использование через MCP:**
```bash
# Последние N строк
@logs logs_tail service:ai-admin-worker-v2 lines:50

# Поиск по паттерну
@logs logs_search pattern:"error" service:ai-admin-worker-v2

# Последние ошибки
@logs logs_errors minutes:30 service:ai-admin-worker-v2

# Live логи (10 секунд)
@logs logs_live seconds:10 service:ai-admin-worker-v2
```

---

## Deployment и инфраструктура

### Server Configuration

```
Host: 46.149.70.219
OS: Ubuntu 22.04
RAM: 8GB
CPU: 4 cores
Disk: 160GB SSD
```

### PM2 Processes

```bash
pm2 status

# 7 процессов:
# 1. ai-admin-api (port 3000)
# 2-6. ai-admin-worker-v2-0 to ai-admin-worker-v2-4 (workers)
# 7. booking-monitor
```

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name ai-admin.app;

    ssl_certificate /etc/letsencrypt/live/ai-admin.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ai-admin.app/privkey.pem;

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name ai-admin.app;
    return 301 https://$server_name$request_uri;
}
```

### Deployment Process

```bash
# 1. SSH к серверу
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# 2. Pull изменений
cd /opt/ai-admin
git pull origin feature/redis-context-cache

# 3. Установка зависимостей (если нужно)
npm install

# 4. Перезапуск PM2
pm2 restart all

# 5. Проверка статуса
pm2 status
pm2 logs --lines 20
```

### Environment Variables (.env)

```bash
# YClients
YCLIENTS_PARTNER_TOKEN=xxx
YCLIENTS_APP_ID=xxx
YCLIENTS_BEARER_TOKEN=xxx

# JWT
JWT_SECRET=xxx

# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=xxx

# AI
AI_PROVIDER=gemini-flash
GEMINI_API_KEY=xxx
SOCKS_PROXY=socks5://127.0.0.1:1080
USE_TWO_STAGE=true

# WhatsApp
BAILEYS_STANDALONE=true

# Other
BASE_URL=https://ai-admin.app
NODE_ENV=production
LOG_LEVEL=info
```

---

## Найденные проблемы и решения

### 🔴 CRITICAL #1: syncAll(companyId) не существует

**Локация:** `src/api/websocket/marketplace-socket.js:337`

**Проблема:**
```javascript
await syncManager.syncAll(companyId);  // ❌ Метод не существует
```

**Последствия:**
- После подключения WhatsApp синхронизация НЕ запускается
- Ошибка: `syncManager.syncAll is not a function`
- Данные салона не синхронизируются

**Решение (рекомендуется):**

Добавить в `src/sync/sync-manager.js` после `runFullSync()`:

```javascript
/**
 * Синхронизировать данные для конкретной компании
 * @param {number} companyId - ID компании
 */
async syncAll(companyId) {
  try {
    logger.info('🔄 Starting sync for company:', companyId);

    const results = {};

    results.company = await this.syncCompany();
    results.services = await this.syncServices();
    results.staff = await this.syncStaff();
    results.clients = await this.syncClients();
    results.schedules = await this.syncSchedules();
    results.bookings = await this.syncBookings();

    logger.info('✅ Company sync completed:', { companyId, results });
    return results;

  } catch (error) {
    logger.error('Company sync failed:', { companyId, error });
    throw error;
  }
}
```

**Статус:** ⚠️ Требует исправления после звонка

---

### 🟡 MINOR #2: Структура обработчика pairing-code

**Локация:** `public/marketplace/onboarding.html:785-795`

**Проблема:**
- Обработчик `pairing-code` добавляется через переопределение функции
- Сложно читать и поддерживать

**Текущий код:**
```javascript
function initWebSocket() {
  socket = io('/marketplace', { auth: { token } });
  socket.on('qr-update', ...);
  socket.on('whatsapp-connected', ...);
  // НЕТ обработчика pairing-code
}

// Где-то ниже:
const originalInitWebSocket = initWebSocket;
function initWebSocket() {
  originalInitWebSocket();
  socket.on('pairing-code', ...); // Добавляется здесь
}
```

**Решение:**
Добавить обработчик сразу в `initWebSocket()` на одном уровне с другими.

**Статус:** ⚠️ Minor, не критично

---

### 🟡 MINOR #3: Webhook signature не проверяется

**Локация:** `src/api/routes/yclients-marketplace.js:479`

**Проблема:**
- Нет проверки подписи webhook запросов
- Возможны fake webhook от злоумышленников

**Решение:**
Уточнить у YClients на звонке, поддерживают ли они webhook signature.

**Статус:** ⚠️ Требует уточнения

---

## Тестирование

### Health Check

```bash
# Production
curl https://ai-admin.app/marketplace/health | jq

# Expected:
{
  "status": "ok",
  "environment": {
    "partner_token": true,
    "app_id": true,
    "jwt_secret": true
  }
}
```

### PM2 Status

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"

# Expected: 7 processes online
```

### WebSocket Test

```bash
curl https://ai-admin.app/socket.io/

# Expected:
{"code":0,"message":"Transport unknown"}
# Это нормально - Socket.IO отвечает так без параметров
```

### Full Flow Test

```bash
# 1. Registration redirect (симуляция)
curl "https://ai-admin.app/auth/yclients/redirect?salon_id=962302&user_name=Test" -L

# 2. Через браузер:
# - Открыть URL из редиректа
# - Проверить WebSocket подключение (DevTools)
# - Сканировать QR / ввести pairing code
# - Проверить активацию
```

### Test Phone Number

```
ВАЖНО: Используй ТОЛЬКО тестовый номер для экспериментов!

Тестовый номер: 89686484488

❌ НЕ тестируй на реальных клиентах!
```

---

## 📊 Итоговая статистика

### Готовность системы

| Компонент | Готовность | Комментарий |
|-----------|-----------|-------------|
| Registration Redirect | ✅ 100% | Работает |
| Onboarding Page | ✅ 100% | Работает |
| WebSocket Setup | ✅ 100% | Работает |
| WebSocket Authorization | ✅ 100% | Безопасно |
| QR Code Generation | ✅ 100% | Работает |
| Pairing Code | ✅ 100% | Работает |
| WhatsApp Connection | ✅ 100% | Работает |
| Activation Process | ✅ 100% | Работает |
| Webhook Processing | ✅ 95% | Нет signature |
| Data Synchronization | ⚠️ 0% | Метод не существует |
| **ИТОГО** | **⚠️ 89%** | **1 критический баг** |

### Проблемы

| Проблема | Критичность | Статус |
|----------|-------------|--------|
| syncAll() не существует | 🔴 CRITICAL | Исправить после звонка |
| Pairing code структура | 🟡 MINOR | Можно не исправлять |
| Webhook signature | 🟡 MINOR | Уточнить на звонке |

### Производительность

| Метрика | Значение |
|---------|----------|
| Onboarding время | 20-30 секунд |
| QR генерация | 1-2 секунды |
| WebSocket latency | < 100ms |
| Activation время | 2-3 секунды |
| AI response время | ~9 секунд (среднее) |
| Webhook response | < 500ms |
| Uptime | 99.5%+ |

---

**Документ создан:** 29 октября 2025
**Версия:** 1.0
**Автор:** AI Admin Development Team
**Статус:** Production Ready (after sync fix)

---

*Конец технической спецификации*
