# WhatsApp Session Management Architecture

## 📋 Оглавление
- [Обзор](#обзор)
- [Проблемы старой архитектуры](#проблемы-старой-архитектуры)
- [Новая архитектура](#новая-архитектура)
- [Компоненты системы](#компоненты-системы)
- [API Reference](#api-reference)
- [Установка и настройка](#установка-и-настройка)
- [Мониторинг и метрики](#мониторинг-и-метрики)
- [Безопасность](#безопасность)
- [Troubleshooting](#troubleshooting)

## 🎯 Обзор

Система управления WhatsApp сессиями обеспечивает централизованное управление всеми WhatsApp подключениями для multi-tenant приложения. Гарантирует, что для каждой компании существует только одна активная сессия.

### Ключевые возможности:
- ✅ **Единственность сессии** - Только одна сессия на компанию
- ✅ **Автоматическое восстановление** - Exponential backoff при сбоях
- ✅ **Rate Limiting** - Защита от спама
- ✅ **Health Checks** - Автоматический мониторинг состояния
- ✅ **Метрики** - Детальная статистика работы
- ✅ **WebSocket события** - Real-time уведомления
- ✅ **Graceful Shutdown** - Корректное завершение

## ❌ Проблемы старой архитектуры

### Что было неправильно:
1. **Множественные процессы** для одной компании
2. **Конфликты** при доступе к файлам аутентификации
3. **Отсутствие централизованного управления**
4. **Memory leaks** из-за неправильной очистки
5. **Race conditions** в обработчиках событий
6. **Отсутствие валидации** входных данных
7. **Нет rate limiting** и защиты от спама
8. **Нет мониторинга** состояния сессий

### Пример проблемы:
```bash
# Несколько процессов пытались управлять одной сессией:
node tests/baileys-qr-server.js        # Процесс 1
node test-baileys-simple.js            # Процесс 2  
node scripts/reinit-baileys-session.js # Процесс 3
# Все для компании 962302 одновременно!
```

## 🏗️ Новая архитектура

### Диаграмма архитектуры:

```
┌─────────────────────────────────────────────┐
│              AI Admin API                    │
│            (REST + WebSocket)                │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         WhatsApp Session Pool                │
│         (Singleton Instance)                 │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │         Session Manager               │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐   │   │
│  │  │Company │ │Company │ │Company │   │   │
│  │  │   1    │ │   2    │ │   N    │   │   │
│  │  └────────┘ └────────┘ └────────┘   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │         Rate Limiter                 │   │
│  │    (Redis/In-Memory Fallback)        │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │         Health Monitor               │   │
│  │    (30 second intervals)             │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │         Metrics Collector            │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│      Timeweb PostgreSQL Database            │
│  (a84c973324fdaccfc68d929d.twc1.net)        │
│                                             │
│  whatsapp_auth:   1 record                  │
│    - company_id: 962302                     │
│    - credentials (JSON)                     │
│                                             │
│  whatsapp_keys:   1,313 records             │
│    - company_id + key_id (composite PK)     │
│    - key_data (session keys)                │
└─────────────────────────────────────────────┘
```

## 🔧 Компоненты системы

### 1. WhatsApp Session Pool (`session-pool-improved.js`)

Основной компонент управления сессиями.

#### Ключевые методы:

```javascript
class WhatsAppSessionPool {
    // Получить или создать сессию
    async getOrCreateSession(companyId)
    
    // Инициализировать новую сессию (QR код)
    async initializeSession(companyId)
    
    // Отправить сообщение
    async sendMessage(companyId, phone, message, options)
    
    // Получить статус сессии
    getSessionStatus(companyId)
    
    // Проверка здоровья
    async healthCheck(companyId)
    
    // Получить метрики
    getMetrics()
    
    // Graceful shutdown
    async shutdown()
}
```

#### События:

- `qr` - QR код сгенерирован
- `connected` - Сессия подключена
- `message` - Входящее сообщение
- `error` - Ошибка в сессии
- `logout` - Сессия разлогинена
- `reconnect_failed` - Не удалось переподключиться
- `health_check_failed` - Health check провалился

### 2. Rate Limiter (`rate-limiter.js`)

Ограничение количества запросов.

#### Конфигурация:
```javascript
{
    windowMs: 60000,      // Окно времени (1 минута)
    maxRequests: 30,      // Максимум запросов
    keyPrefix: 'whatsapp:ratelimit:'
}
```

### 3. API Routes (`whatsapp-sessions-improved.js`)

REST API для управления сессиями.

## 📡 API Reference

### Endpoints

#### 1. Получить список сессий
```http
GET /api/whatsapp/sessions
```

**Response:**
```json
{
    "success": true,
    "count": 2,
    "sessions": [
        {
            "companyId": "962302",
            "connected": true,
            "status": "connected",
            "health": "healthy"
        }
    ],
    "metrics": {
        "totalSessions": 2,
        "activeConnections": 1,
        "messagesSent": 150,
        "messagesReceived": 200
    }
}
```

#### 2. Инициализировать сессию
```http
POST /api/whatsapp/sessions/:companyId/initialize
```

**Response:**
```json
{
    "success": true,
    "companyId": "962302",
    "qr": "2@AH3K2J3K23...",
    "qrDataUrl": "data:image/png;base64,...",
    "qrTerminal": "█▀▀▀▀▀█...",
    "message": "Please scan the QR code with WhatsApp"
}
```

#### 3. Отправить сообщение
```http
POST /api/whatsapp/sessions/:companyId/send
```

**Request Body:**
```json
{
    "phone": "79001234567",
    "message": "Ваша запись подтверждена!",
    "options": {
        "quoted": "messageId"  // Optional
    }
}
```

**Response:**
```json
{
    "success": true,
    "companyId": "962302",
    "phone": "79001234567",
    "messageId": "3EB0123456789",
    "timestamp": "2025-09-10T12:00:00.000Z"
}
```

#### 4. Получить статус сессии
```http
GET /api/whatsapp/sessions/:companyId/status
```

**Response:**
```json
{
    "success": true,
    "companyId": "962302",
    "connected": true,
    "status": "connected",
    "reconnectAttempts": 0,
    "health": {
        "healthy": true,
        "phoneNumber": "79686484488@s.whatsapp.net"
    }
}
```

#### 5. Health Check
```http
GET /api/whatsapp/sessions/:companyId/health
```

**Response (200 OK если healthy, 503 если нет):**
```json
{
    "success": true,
    "companyId": "962302",
    "healthy": true,
    "phoneNumber": "79686484488@s.whatsapp.net"
}
```

#### 6. Получить метрики
```http
GET /api/whatsapp/metrics
```

**Response:**
```json
{
    "success": true,
    "metrics": {
        "totalSessions": 5,
        "activeConnections": 4,
        "failedReconnects": 1,
        "messagesSent": 1500,
        "messagesReceived": 2000,
        "qrCodesGenerated": 8,
        "errors": 3,
        "lastError": "Connection timeout"
    },
    "sessions": {
        "total": 5,
        "connected": 4,
        "disconnected": 1
    },
    "timestamp": "2025-09-10T12:00:00.000Z"
}
```

#### 7. WebSocket Events
```javascript
// Подключение
const ws = new WebSocket('ws://localhost:3000/api/whatsapp/events');

// Получение событий
ws.on('message', (data) => {
    const event = JSON.parse(data);
    switch(event.type) {
        case 'qr':
            console.log('QR код:', event.qr);
            break;
        case 'connected':
            console.log('Подключено:', event.companyId);
            break;
        case 'message':
            console.log('Сообщение:', event.message);
            break;
        case 'error':
            console.error('Ошибка:', event.error);
            break;
    }
});
```

## 🚀 Установка и настройка

### 1. Установка зависимостей
```bash
npm install @whiskeysockets/baileys @hapi/boom qrcode express-validator validator
```

### 2. Настройка окружения
```env
# .env файл
REDIS_URL=redis://localhost:6379

# Database Configuration (PostgreSQL only, no file storage)
USE_REPOSITORY_PATTERN=true           # ✅ Use Timeweb PostgreSQL
USE_LEGACY_SUPABASE=false             # ❌ Legacy Supabase (deprecated)
TIMEWEB_DATABASE_URL=postgresql://... # Timeweb connection string

# Rate limiting & monitoring
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30
HEALTH_CHECK_INTERVAL=30000
```

### 3. Интеграция в приложение
```javascript
// app.js
const express = require('express');
const whatsappRoutes = require('./src/api/routes/whatsapp-sessions-improved');

const app = express();
app.use('/api/whatsapp', whatsappRoutes);

// Graceful shutdown
process.on('SIGTERM', async () => {
    const { getSessionPool } = require('./src/integrations/whatsapp/session-pool-improved');
    await getSessionPool().shutdown();
    process.exit(0);
});
```

### 4. Запуск с PM2
```javascript
// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'ai-admin-api',
        script: './src/api/server.js',
        instances: 1, // ВАЖНО: только 1 экземпляр!
        exec_mode: 'fork',
        env: {
            NODE_ENV: 'production'
        }
    }]
};
```

## 📊 Мониторинг и метрики

### Grafana Dashboard пример:
```json
{
    "panels": [
        {
            "title": "Active Sessions",
            "query": "whatsapp_active_sessions"
        },
        {
            "title": "Messages Sent/Received",
            "query": "rate(whatsapp_messages_total[5m])"
        },
        {
            "title": "Error Rate",
            "query": "rate(whatsapp_errors_total[5m])"
        },
        {
            "title": "Reconnection Attempts",
            "query": "whatsapp_reconnect_attempts"
        }
    ]
}
```

### Prometheus метрики:
```javascript
// Экспорт метрик для Prometheus
router.get('/metrics/prometheus', (req, res) => {
    const metrics = sessionPool.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(`
# HELP whatsapp_sessions_total Total number of sessions
# TYPE whatsapp_sessions_total gauge
whatsapp_sessions_total ${metrics.totalSessions}

# HELP whatsapp_active_connections Active WhatsApp connections
# TYPE whatsapp_active_connections gauge
whatsapp_active_connections ${metrics.activeConnections}

# HELP whatsapp_messages_sent_total Total messages sent
# TYPE whatsapp_messages_sent_total counter
whatsapp_messages_sent_total ${metrics.messagesSent}

# HELP whatsapp_messages_received_total Total messages received
# TYPE whatsapp_messages_received_total counter
whatsapp_messages_received_total ${metrics.messagesReceived}

# HELP whatsapp_errors_total Total errors
# TYPE whatsapp_errors_total counter
whatsapp_errors_total ${metrics.errors}
    `);
});
```

## 🔒 Безопасность

### 1. Валидация входных данных
- Все `companyId` проверяются и санитизируются
- Телефонные номера валидируются через `validator.isMobilePhone()`
- Сообщения ограничены 4096 символами
- Используется `express-validator` для всех endpoints

### 2. Rate Limiting
- 30 сообщений в минуту на компанию
- Redis для распределенного rate limiting
- Fallback на in-memory при недоступности Redis

### 3. Изоляция данных
- Каждая компания хранит данные в отдельной директории
- Права доступа 0o700 (только владелец)
- Санитизация путей файловой системы

### 4. Аутентификация и авторизация
```javascript
// Добавьте middleware для проверки прав
router.use('/sessions/:companyId', async (req, res, next) => {
    const userCompanyId = req.user.companyId;
    const requestedCompanyId = req.params.companyId;
    
    if (userCompanyId !== requestedCompanyId && !req.user.isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }
    
    next();
});
```

## 🔧 Troubleshooting

### Проблема: "No active session for company"
**Причины:**
1. Сессия не инициализирована
2. Сессия отключилась и не смогла переподключиться
3. Пользователь разлогинился в WhatsApp

**Решение:**
```bash
# Проверить статус
curl http://localhost:3000/api/whatsapp/sessions/962302/status

# Переинициализировать
curl -X POST http://localhost:3000/api/whatsapp/sessions/962302/initialize
```

### Проблема: "Rate limit exceeded"
**Причина:** Превышен лимит сообщений

**Решение:**
```javascript
// Увеличить лимит в конфигурации
const rateLimiter = new RateLimiter({
    windowMs: 60000,
    maxRequests: 60  // Увеличено до 60
});
```

### Проблема: Memory leak
**Причина:** Не очищаются таймеры или обработчики

**Решение:** Убедитесь что используете улучшенную версию с правильной очисткой:
```javascript
// При удалении сессии
const timer = this.reconnectTimers.get(companyId);
if (timer) {
    clearTimeout(timer);
    this.reconnectTimers.delete(companyId);
}
```

### Проблема: Multiple QR codes
**Причина:** Несколько процессов пытаются создать сессию

**Решение:** 
1. Остановить все лишние процессы
2. Использовать только API для управления сессиями
3. Убедиться что запущен только 1 экземпляр API

## 📝 Best Practices

1. **Всегда используйте API** для управления сессиями
2. **Не запускайте** несколько процессов для одной компании
3. **Мониторьте метрики** для раннего обнаружения проблем
4. **Настройте алерты** на health check failures
5. **Используйте WebSocket** для real-time обновлений
6. **Регулярно очищайте** старые сессии неактивных компаний
7. **Логируйте все ошибки** для последующего анализа
8. **Делайте бэкапы базы данных** (PostgreSQL dumps для whatsapp_auth и whatsapp_keys)

## 🔄 Миграция со старой архитектуры

> **✅ Migration Completed:** November 19, 2025
>
> File-based sessions are no longer supported. All session data is stored in **Timeweb PostgreSQL**.
>
> See detailed migration history:
> - Phase 0 (Nov 6-8): `dev/completed/database-migration-completion/PHASE_0.7_COMPLETION_SUMMARY.md`
> - Phase 1-5 (Nov 9-12): `dev/completed/database-migration-supabase-timeweb/`
> - Cleanup (Nov 19): `docs/03-development-diary/2025-11-19-baileys-file-sessions-cleanup.md`

### Current Architecture (as of Nov 2025)

**Database Storage (PostgreSQL):**
```sql
-- Timeweb PostgreSQL (a84c973324fdaccfc68d929d.twc1.net:5432)
whatsapp_auth:   1 record     -- Authentication credentials
whatsapp_keys:   1,313 records -- Session keys
```

**Environment Configuration:**
```env
USE_REPOSITORY_PATTERN=true   # ✅ Timeweb PostgreSQL
USE_LEGACY_SUPABASE=false     # ❌ Deprecated
```

**No file-based storage** - all legacy code and directories removed (4.1 MB freed).

### Historical Migration Timeline

1. **Phase 0 (Nov 6-8, 2025):** File → PostgreSQL
   - Migrated 1 auth + 728 keys from `baileys_sessions/`
   - 28,700% faster than estimated (10 min vs 48h)

2. **Phase 1-5 (Nov 9-12, 2025):** Full DB Migration
   - Supabase → Timeweb PostgreSQL
   - Repository pattern + transactions
   - 1,490 records migrated, zero data loss

3. **Cleanup (Nov 19, 2025):** Legacy Code Removal
   - Deleted all `baileys_sessions*` directories (4.1 MB)
   - Archived 7 migration scripts (61K lines)
   - Removed file-based fallback from `session-pool.js`

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `pm2 logs ai-admin-api`
2. Проверьте метрики: `GET /api/whatsapp/metrics`
3. Проверьте health: `GET /api/whatsapp/sessions/:companyId/health`
4. Создайте issue в репозитории с логами и метриками

---

*Документация обновлена: 19 ноября 2025* (PostgreSQL migration completed)
*Версия архитектуры: 2.0.0*