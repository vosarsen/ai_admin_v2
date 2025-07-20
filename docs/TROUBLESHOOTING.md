# AI Admin v2 - Troubleshooting Guide

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

### 2. Redis Connection Issues (Port 6380 vs 6379)

**Problem**: Local development uses port 6380 (SSH tunnel), but production server uses port 6379.

**Temporary Solution**:
```javascript
// In smart-cache.js and redis-factory.js
let redisUrlString = config.redis.url;
if (redisUrlString && redisUrlString.includes('6380')) {
  redisUrlString = redisUrlString.replace('6380', '6379');
}
```

**Permanent Solution**: Use separate `.env` files for local and production environments.

**Files affected**:
- `src/services/cache/smart-cache.js`
- `src/utils/redis-factory.js`

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