# AI Admin v2 - Troubleshooting Guide

## 📅 Last Updated: August 2, 2025, 16:00

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