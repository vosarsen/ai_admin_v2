# 🔗 YClients Marketplace Integration

## 📋 Оглавление

1. [Обзор интеграции](#обзор-интеграции)
2. [Архитектура системы](#архитектура-системы)
3. [Компоненты интеграции](#компоненты-интеграции)
4. [Процесс подключения](#процесс-подключения)
5. [API Endpoints](#api-endpoints)
6. [Безопасность](#безопасность)
7. [База данных](#база-данных)
8. [Мониторинг и логирование](#мониторинг-и-логирование)
9. [Тестирование](#тестирование)
10. [Развертывание](#развертывание)

## 🎯 Обзор интеграции

AI Admin интегрируется с YClients Marketplace, позволяя салонам красоты подключать WhatsApp бота для автоматизации коммуникации с клиентами.

### Ключевые возможности:
- ✅ Автоматическая запись клиентов через WhatsApp
- ✅ Синхронизация расписания, услуг и мастеров
- ✅ Ответы на вопросы о ценах и услугах 24/7
- ✅ Напоминания о предстоящих визитах
- ✅ Перенос и отмена записей
- ✅ Сбор отзывов после визита

### URL интеграции:
- **Production**: https://ai-admin.app/marketplace/
- **API Base**: https://ai-admin.app/marketplace/
- **WebSocket**: wss://ai-admin.app/marketplace

## 🏗️ Архитектура системы

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  YClients App   │────▶│   AI Admin      │────▶│   WhatsApp      │
│   Marketplace   │     │   Integration   │     │     Baileys     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  YClients API   │◀───▶│    Supabase     │     │  WhatsApp API   │
│                 │     │    Database     │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Поток данных:
1. **Регистрация**: YClients → AI Admin → Database
2. **QR Generation**: AI Admin → Baileys → WebSocket → Client
3. **WhatsApp Connection**: Client → QR Scan → Baileys → AI Admin
4. **Message Processing**: WhatsApp → Baileys → AI Admin → AI Service → YClients API

## 📦 Компоненты интеграции

### 1. MarketplaceService (`src/services/marketplace/marketplace-service.js`)
Основной сервис управления интеграцией:
- Создание и управление компаниями
- Генерация API ключей
- Управление токенами
- Синхронизация с YClients

### 2. BaileysManager (`src/integrations/whatsapp/baileys-manager.js`)
Управление WhatsApp сессиями:
- Multi-tenant архитектура
- Генерация QR-кодов
- Управление подключениями
- Обработка сообщений

### 3. MarketplaceSocket (`src/api/websocket/marketplace-socket.js`)
WebSocket сервер для real-time коммуникации:
- Передача QR-кодов
- Статус подключения
- События WhatsApp
- Rate limiting

### 4. API Routes (`src/api/routes/marketplace.js`)
REST API endpoints:
- Регистрация компаний
- Получение QR-кодов
- Webhooks от YClients
- Статус интеграции

## 🚀 Процесс подключения

### Шаг 1: Регистрация в маркетплейсе
```bash
POST /marketplace/register
{
  "salon_id": 962302,
  "phone": "+79001234567",
  "email": "salon@example.com"
}
```

### Шаг 2: Получение токена и URL
```json
{
  "success": true,
  "company_id": 15,
  "salon_id": 962302,
  "api_key": "sk_...",
  "connect_url": "/marketplace/connect?token=..."
}
```

### Шаг 3: Подключение WhatsApp
1. Пользователь открывает `connect_url`
2. Сканирует QR-код WhatsApp
3. Система подтверждает подключение
4. Отправляется callback в YClients

### Шаг 4: Активация интеграции
После успешного подключения:
- Статус меняется на `active`
- Запускается синхронизация данных
- Бот начинает обрабатывать сообщения

## 📡 API Endpoints

### Публичные endpoints

#### GET /marketplace/
Главная страница интеграции
- **Response**: HTML страница

#### GET /marketplace/connect
Страница подключения WhatsApp
- **Query params**:
  - `token` - токен авторизации
  - `company` - ID компании
  - `salon` - ID салона
- **Response**: HTML страница с QR-кодом

#### GET /marketplace/test
Тестовый endpoint для проверки работоспособности
- **Response**:
```json
{
  "success": true,
  "status": "ok",
  "endpoints": {...},
  "message": "Marketplace integration endpoints are ready"
}
```

### Защищенные endpoints

#### POST /marketplace/register
Регистрация новой компании
- **Body**:
```json
{
  "salon_id": 123456,
  "phone": "+79001234567",
  "email": "salon@example.com"
}
```
- **Response**:
```json
{
  "success": true,
  "company_id": 1,
  "salon_id": 123456,
  "api_key": "sk_...",
  "connect_url": "/marketplace/connect?..."
}
```

#### GET /marketplace/qr/:token
Получение QR-кода для WhatsApp
- **Params**:
  - `token` - токен сессии
- **Response**:
```json
{
  "success": true,
  "qr": "data:image/png;base64,...",
  "expires_in": 20
}
```

#### GET /marketplace/status/:companyId
Получение статуса подключения
- **Params**:
  - `companyId` - ID компании
- **Response**:
```json
{
  "success": true,
  "company_id": 1,
  "whatsapp_connected": true,
  "whatsapp_phone": "+79001234567",
  "integration_status": "active",
  "connected_at": "2024-01-01T12:00:00Z"
}
```

#### POST /marketplace/callback
Callback для YClients после подключения
- **Body**:
```json
{
  "salon_id": 123456,
  "company_id": 1,
  "status": "connected",
  "whatsapp_phone": "+79001234567",
  "api_key": "sk_..."
}
```

#### POST /marketplace/webhook/:companyId
Webhook для событий от YClients
- **Params**:
  - `companyId` - ID компании
- **Body**: Данные события от YClients

#### GET /marketplace/companies
Статистика подключений (требует API ключ)
- **Headers**:
  - `X-API-Key` - API ключ администратора
- **Response**:
```json
{
  "success": true,
  "stats": {
    "total": 100,
    "connected": 85
  }
}
```

## 🔒 Безопасность

### JWT Authentication
- Все токены подписаны JWT с секретом из `JWT_SECRET`
- Срок жизни токена: 24 часа
- Payload содержит `company_id` и `iat`

### Валидация данных
- Все входные данные проходят валидацию
- SQL injection защита через параметризованные запросы
- XSS защита через санитизацию HTML
- Валидация телефонов, email, ID

### Rate Limiting
- WebSocket: максимум 5 подключений за 60 секунд с одного IP
- Автоматическая очистка rate limiter каждые 5 минут
- DDoS защита на уровне nginx

### CORS и Origin проверка
- Разрешенные origins в production:
  - https://ai-admin.app
  - https://yclients.com
  - https://n*.yclients.com

## 💾 База данных

### Таблица companies
```sql
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  company_id INTEGER,
  yclients_id INTEGER,
  title VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(100),
  address VARCHAR(500),
  timezone VARCHAR(50) DEFAULT 'Europe/Moscow',

  -- WhatsApp интеграция
  whatsapp_connected BOOLEAN DEFAULT FALSE,
  whatsapp_phone VARCHAR(20),
  whatsapp_connected_at TIMESTAMPTZ,
  integration_status VARCHAR(50) DEFAULT 'pending',
  connected_at TIMESTAMPTZ,

  -- Флаги
  ai_enabled BOOLEAN DEFAULT TRUE,
  sync_enabled BOOLEAN DEFAULT TRUE,
  whatsapp_enabled BOOLEAN DEFAULT FALSE,

  -- Метаданные
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Индексы для производительности
CREATE INDEX idx_companies_whatsapp_connected
ON companies(whatsapp_connected)
WHERE whatsapp_connected = true;

CREATE INDEX idx_companies_whatsapp_phone
ON companies(whatsapp_phone)
WHERE whatsapp_phone IS NOT NULL;
```

### Redis структура
```
marketplace:token:{token} -> companyId (TTL: 24h)
marketplace:company:{companyId}:token -> token (TTL: 24h)
marketplace:qr:{companyId} -> {generated_at, qr} (TTL: 20s)
```

## 📊 Мониторинг и логирование

### Логирование
Все важные события логируются с префиксами:
- `✅` - успешные операции
- `❌` - ошибки
- `⚠️` - предупреждения
- `📱` - WhatsApp события
- `🔄` - синхронизация
- `📨` - webhooks

### Метрики
- Количество подключенных компаний
- Статус WhatsApp сессий
- Количество обработанных сообщений
- Время ответа API
- Rate limit статистика

### PM2 мониторинг
```bash
# Статус процессов
pm2 status

# Логи API
pm2 logs ai-admin-api

# Мониторинг в реальном времени
pm2 monit
```

## 🧪 Тестирование

### Запуск тестов интеграции
```bash
# Полный тест интеграции
node tests/manual/test-marketplace-integration.js

# Тест отдельных компонентов
node tests/manual/test-baileys-direct.js
```

### Проверка endpoints
```bash
# Проверка доступности
curl https://ai-admin.app/marketplace/test

# Проверка регистрации (тестовый режим)
curl -X POST https://ai-admin.app/marketplace/register \
  -H "Content-Type: application/json" \
  -d '{"salon_id": 999999}'
```

## 🚀 Развертывание

### Требования
- Node.js 18+
- Redis 6+
- PostgreSQL 14+ (Supabase)
- PM2 для управления процессами
- Nginx для reverse proxy
- SSL сертификат

### Переменные окружения
```bash
# Обязательные
JWT_SECRET=<secure-random-string>
YCLIENTS_API_KEY=<yclients-api-key>
SUPABASE_URL=<supabase-url>
SUPABASE_KEY=<supabase-service-key>
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=<redis-password>

# WhatsApp
WHATSAPP_PROVIDER=baileys
WHATSAPP_MULTI_TENANT=true
WHATSAPP_SESSIONS_PATH=./sessions

# Опциональные
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### Деплой на production
```bash
# 1. Клонировать репозиторий
git clone https://github.com/vosarsen/ai_admin_v2.git
cd ai_admin_v2

# 2. Установить зависимости
npm install

# 3. Настроить окружение
cp .env.example .env
# Отредактировать .env

# 4. Применить миграции БД
node scripts/apply-whatsapp-migration.js

# 5. Запустить через PM2
pm2 start ecosystem.config.js

# 6. Настроить Nginx
sudo cp nginx/ai-admin.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/ai-admin.conf /etc/nginx/sites-enabled/
sudo nginx -s reload
```

## 🔧 Troubleshooting

### Проблема: QR-код не генерируется
**Решение**:
- Проверить Redis подключение
- Убедиться что Baileys manager инициализирован
- Проверить логи: `pm2 logs ai-admin-api --lines 100`

### Проблема: WebSocket не подключается
**Решение**:
- Проверить JWT_SECRET в .env
- Убедиться что токен передается в headers
- Проверить CORS настройки

### Проблема: Callback в YClients не отправляется
**Решение**:
- Проверить YCLIENTS_API_KEY
- Убедиться что webhook URL правильный
- Проверить логи webhook событий

### Проблема: База данных не синхронизируется
**Решение**:
- Проверить наличие WhatsApp колонок в БД
- Запустить миграцию: `node scripts/apply-whatsapp-migration.js`
- Проверить права доступа Supabase

## 📚 Дополнительные ресурсы

- [Техническая документация API](./MARKETPLACE_API.md)
- [Руководство по установке](./MARKETPLACE_SETUP.md)
- [Безопасность интеграции](./MARKETPLACE_SECURITY.md)
- [YClients API документация](../YCLIENTS_API.md)
- [Changelog](../CHANGELOG.md)

## 📞 Поддержка

- Email: support@ai-admin.app
- Telegram: @ai_admin_support
- GitHub Issues: https://github.com/vosarsen/ai_admin_v2/issues

---

*Последнее обновление: 16 сентября 2024*