# AI Admin v2 - Troubleshooting Guide

## 📅 Last Updated: September 21, 2025

## Table of Contents
1. [Critical Issues](#critical-issues)
2. [WhatsApp Integration Issues](#whatsapp-integration-issues)
3. [Dependency Issues](#dependency-issues)
4. [API Service Issues](#api-service-issues)
5. [Database Connection Issues](#database-connection-issues)
6. [Redis Issues](#redis-issues)
7. [PM2 Process Management](#pm2-process-management)
8. [Common Error Messages](#common-error-messages)

## Critical Issues

### Error 440: connectionReplaced (SOLVED)

**Symptoms:**
- Baileys переподключается каждые 3-6 секунд
- В логах: `stream errored out`, `conflict type:replaced`
- WhatsApp соединение нестабильно

**Причины:**
1. Множественные процессы пытаются создать сессию для одного номера
2. API сервер и baileys-service конфликтуют
3. Агрессивные health checks вызывают ложные переподключения
4. Метод sendMessage создает новые сессии

**Решение:**
```bash
# 1. Добавить в .env на сервере
echo "BAILEYS_STANDALONE=true" >> /opt/ai-admin/.env

# 2. Обновить код
cd /opt/ai-admin
git pull

# 3. Перезапустить с обновлением окружения
pm2 restart baileys-whatsapp --update-env
pm2 restart ai-admin-api --update-env

# 4. Проверить статус
pm2 logs baileys-whatsapp --lines 50
```

**Профилактика:**
- ВСЕГДА используйте `BAILEYS_STANDALONE=true` в продакшене
- НЕ создавайте сессии в нескольких местах
- Используйте пассивный мониторинг вместо активных health checks

### Worker Cannot Send Messages (SOLVED)

**Symptoms:**
- `Failed to send message via API: Request failed with status code 500`
- Сообщения обрабатываются, но ответы не отправляются

**Причина:**
API не может найти WhatsApp сессию, так как она находится в памяти baileys-service

**Решение:**
API теперь проксирует запросы к baileys-service:
```bash
# Проверить, что baileys-service работает и доступен
curl http://localhost:3003/health

# Проверить логи отправки
pm2 logs baileys-whatsapp | grep "Sending message via baileys-service"
```

### Invalid company ID: [object Object] (SOLVED)

**Symptoms:**
- Ошибка при поиске слотов для бронирования
- `getServices failed: Invalid company ID: [object Object]`

**Причина:**
companyId передавался как объект вместо строки/числа

**Решение:**
Код уже исправлен. Если проблема повторяется:
```bash
cd /opt/ai-admin
git pull
pm2 restart ai-admin-worker-v2
```

## Dependency Issues

### MODULE_NOT_FOUND Errors

**Symptoms:**
```
Error: Cannot find module 'package-name'
Require stack:
- /opt/ai-admin/src/path/to/file.js
```

**Quick Fix:**
```bash
# On server
cd /opt/ai-admin
npm install missing-package-name
pm2 restart ai-admin-api
```

**Permanent Fix:**
1. Add to package.json locally
2. Commit and push changes
3. Pull and install on server

**Common Missing Packages (as of Sept 10, 2025):**
- node-cron
- bottleneck
- date-fns-tz
- prom-client
- swagger-ui-express
- swagger-jsdoc
- yamljs

### Package Version Conflicts

**Symptoms:**
- npm WARN peer dependency warnings
- Application behaves differently in dev vs production

**Solution:**
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
npm audit fix
```

## API Service Issues

### Service Won't Start

**Check PM2 Status:**
```bash
pm2 status
pm2 logs ai-admin-api --lines 100
```

**Common Causes:**
1. Missing dependencies (see above)
2. Port already in use
3. Environment variables not set

**Solutions:**
```bash
# Check port usage
lsof -i :3000

# Restart with environment update
pm2 restart ai-admin-api --update-env

# Full restart
pm2 delete ai-admin-api
pm2 start ecosystem.config.js
```

### High Restart Count

**Symptoms:**
- PM2 shows 100+ restarts
- Service keeps crashing

**Diagnosis:**
```bash
# Check error logs
pm2 logs ai-admin-api --err --lines 50

# Check system resources
free -m
df -h
```

**Common Fixes:**
1. Fix missing dependencies
2. Check memory limits
3. Verify database connection
4. Check Redis connection

## Common Issues and Solutions

### 1. AIService.generateResponse is not a function

**Problem**: The AI Admin v2 service tries to call `AIService.generateResponse()` which doesn't exist.

**Solution**: 
```javascript
// Wrong:
const response = await AIService.generateResponse({...});

// Correct:
if (!this.aiProvider) {
  this.aiProvider = require('../ai');
}
return await this.aiProvider._callAI(prompt);
```

**Files affected**:
- `src/services/ai-admin-v2/index.js`

### 2. Redis Connection Issues (✅ FIXED August 2, 2025)

**Problem**: Local development uses port 6380 (SSH tunnel), but production server uses port 6379. Multiple files had hardcoded Redis configuration.

**Solution**: Created centralized Redis configuration:
```javascript
// src/config/redis-config.js
const { getRedisConfig, getBullMQRedisConfig } = require('../config/redis-config');

// For ioredis clients:
const redisConfig = getRedisConfig();
const redis = new Redis(redisConfig);

// For BullMQ:
const connection = getBullMQRedisConfig();
```

**Files updated**:
- `src/config/redis-config.js` - Centralized configuration
- `src/queue/message-queue.js` - Uses getBullMQRedisConfig()
- `src/workers/message-worker-v2.js` - Uses getBullMQRedisConfig()
- `src/workers/message-worker.js` - Uses getBullMQRedisConfig()
- `src/workers/reminder-worker.js` - Uses getBullMQRedisConfig()
- `src/database/optimized-supabase.js` - Uses getRedisConfig()
- `src/utils/critical-error-logger.js` - Uses getRedisConfig()

### 3. Git Merge Conflicts on Server

**Problem**: Server has local changes that conflict with GitHub.

**Solution**:
```bash
ssh ai-admin-server "cd /opt/ai-admin && git fetch origin && git reset --hard origin/main"
```

### 4. PM2 Worker Not Updating

**Problem**: PM2 caches old code even after git pull.

**Solution**:
```bash
# Delete and recreate the process
pm2 delete ai-admin-worker-v2
pm2 start ecosystem.config.js --only ai-admin-worker-v2
```

### 5. WhatsApp Not Ready

**Problem**: Venom-bot shows "Not Logged" in headless mode.

**Solution**: 
1. Check venom-bot logs: `pm2 logs venom-bot`
2. May need to scan QR code for WhatsApp Web
3. For testing without WhatsApp, check logs for bot responses

### 6. API Server Not Running

**Problem**: Health check fails, webhook returns connection refused.

**Solution**:
```bash
pm2 start ecosystem.config.js --only ai-admin-api
```

### 7. Booking Record ID Shows as "undefined"

**Problem**: After creating a booking, the confirmation message shows "Номер записи: undefined"

**Root Cause**: YClients API returns nested data structure:
```javascript
{
  success: true,
  data: {
    data: [{ id: 1, record_id: 1194929772, record_hash: "..." }],
    meta: [],
    success: true
  }
}
```

**Solution**: Fixed in `src/services/ai-admin-v2/modules/command-handler.js`:
```javascript
// Extract nested data correctly
const responseData = result.data?.data || result.data || [];
const bookingRecord = Array.isArray(responseData) ? responseData[0] : responseData;
```

**Files affected**:
- `src/services/ai-admin-v2/modules/command-handler.js`

### 6. AI отправляет внутренние размышления пользователям

**Problem**: AI добавляет в ответ свой анализ ситуации в скобках или отдельными предложениями.

**Example**:
```
Бот: Добрый день! Как вас зовут? , мастера (Сергей) и дату (завтра), но имя клиента неизвестно.
```

**Solution**: Добавлены четкие инструкции в промпт:
```javascript
КРИТИЧЕСКИ ВАЖНО О ФОРМАТЕ ОТВЕТА:
- Отвечай ТОЛЬКО тем, что нужно сказать клиенту
- НЕ добавляй свои внутренние размышления в ответ
- НЕ пиши в скобках свой анализ ситуации
- НЕ объясняй свою логику в ответе клиенту
- Просто отвечай на вопрос или выполняй действие
```

**Files affected**:
- `src/services/ai-admin-v2/index.js`

### 7. supabase.from is not a function

**Problem**: Неправильный импорт Supabase клиента.

**Solution**: Использовать деструктурированный импорт:
```javascript
// Wrong:
const supabase = require('../../../database/supabase');

// Correct:
const { supabase } = require('../../../database/supabase');
```

**Files affected**:
- `src/services/ai-admin-v2/modules/command-handler.js`

### 8. targetDate is not defined

**Problem**: В методе checkStaffSchedule используется неопределенная переменная.

**Solution**: Добавить определение переменной:
```javascript
const dateStr = formatter.parseRelativeDate(date || 'сегодня');
const targetDate = new Date(dateStr); // Add this line
```

**Files affected**:
- `src/services/ai-admin-v2/modules/command-handler.js`

### 9. YClients API Permission Errors (✅ FIXED July 28, 2025)

**Problem**: Различные ошибки прав доступа при работе с YClients API.

**Errors**:
- 403: "Нет прав на управление компанией" (при поиске клиента)
- 403: "Нет прав на управление филиалом" (при создании клиента)
- 422: "Нет доступных для записи сотрудников" (при создании записи)

**Solution**: Добавить обязательный заголовок `X-Partner-Id: 8444`:
```javascript
headers: {
  'Authorization': `Bearer ${token}, User ${userToken}`,
  'X-Partner-Id': '8444',
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.yclients.v2+json'
}
```

**Files affected**:
- `src/integrations/yclients/client.js`

### 10. Redis NOAUTH Authentication Required (✅ FIXED August 2, 2025)

**Problem**: Redis clients не могли подключиться из-за отсутствия пароля аутентификации.

**Solution**: Централизованная конфигурация автоматически извлекает пароль из REDIS_URL или config.redis.password.

### 11. Bot не приветствует клиента (✅ FIXED August 2, 2025)

**Problem**: Бот не здоровался при первом контакте с клиентом.

**Solution**: Добавлено правило #12 в AI промпт:
```
12. 🔴 ВСЕГДА НАЧИНАЙ С ПРИВЕТСТВИЯ: Если это первое сообщение в диалоге - обязательно поздоровайся!
```

**Files affected**:
- `src/services/ai-admin-v2/index.js`

## Debugging Commands

### Check Service Status
```bash
pm2 status
pm2 logs ai-admin-worker-v2 --lines 50
```

### Test Webhook Locally
```bash
node test-webhook.js "your message here"
```

### Check Redis Connection
```bash
# Local tunnel status
./scripts/maintain-redis-tunnel.sh status

# Start tunnel if needed
./scripts/maintain-redis-tunnel.sh start
```

### Force Update from GitHub
```bash
ssh ai-admin-server "cd /opt/ai-admin && git fetch origin && git reset --hard origin/main && pm2 restart all"
```

## Log Locations

- **Worker Logs**: `/root/.pm2/logs/ai-admin-worker-v2-*.log`
- **API Logs**: `/root/.pm2/logs/ai-admin-api-*.log`
- **Venom Bot Logs**: `/root/.pm2/logs/venom-bot-*.log`

## Important Notes

1. Always check logs first when debugging
2. Redis tunnel must be running for local MCP servers
3. WhatsApp requires manual QR scan after server restart
4. Use `--update-env` flag when restarting PM2 processes after config changes