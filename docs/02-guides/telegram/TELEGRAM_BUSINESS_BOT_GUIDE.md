# Telegram Business Bot Integration Guide

**Version:** 1.0
**Last Updated:** 2025-11-29
**Status:** Production Ready

## Overview

AI Admin v2 supports Telegram Business Bot as a second messaging channel alongside WhatsApp. This allows salons to receive and respond to customer messages through their personal Telegram account, with responses appearing as if sent directly by the salon owner.

### Key Benefits

- **Zero ban risk** - Official Telegram feature, not a workaround
- **Messages from salon account** - No bot labels visible to customers
- **Same AI processing** - Identical booking flow as WhatsApp
- **Platform-aware context** - Separate conversation history per platform

## Architecture

```
Customer → Salon's Telegram Account → Telegram Business Bot API → AI Admin v2
                                                                    ↓
AI Admin v2 → Telegram Business Bot API → Salon's Telegram Account → Customer
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| TelegramBot | `src/integrations/telegram/telegram-bot.js` | grammY client for Telegram API |
| TelegramManager | `src/integrations/telegram/telegram-manager.js` | Business logic orchestrator |
| TelegramAPIClient | `src/integrations/telegram/telegram-api-client.js` | HTTP client for workers |
| TelegramConnectionRepository | `src/repositories/TelegramConnectionRepository.js` | Database access |
| Error Classes | `src/utils/telegram-errors.js` | Standardized error handling |

## Setup

### 1. Create Bot via @BotFather

```
1. Open @BotFather in Telegram
2. Send /newbot
3. Choose name: "AI Admin Bot" (or similar)
4. Choose username: Must end with "bot" (e.g., @YourSalonAIBot)
5. Copy the bot token
```

### 2. Environment Variables

Add to `.env`:

```bash
# Enable Telegram integration
TELEGRAM_ENABLED=true

# Business Bot token (for customer messaging)
TELEGRAM_BUSINESS_BOT_TOKEN=8522061774:AAGxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook secret (generate with: openssl rand -hex 32)
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret_here

# Default company ID (single-company MVP mode)
TELEGRAM_DEFAULT_COMPANY_ID=962302
```

**Note:** `TELEGRAM_BOT_TOKEN` is for admin alerts, `TELEGRAM_BUSINESS_BOT_TOKEN` is for customer messaging.

### 3. Database Migration

Run the migration to create required tables:

```sql
-- migrations/20251129_create_telegram_tables.sql
CREATE TABLE telegram_business_connections (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  business_connection_id TEXT NOT NULL UNIQUE,
  telegram_user_id BIGINT NOT NULL,
  telegram_username TEXT,
  telegram_first_name TEXT,
  can_reply BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4. Set Webhook

After deployment, set the webhook URL:

```bash
# Via API endpoint
curl -X POST https://your-domain.com/api/telegram/webhook/set \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/webhook/telegram"}'

# Or via Telegram API directly
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/webhook/telegram&secret_token=<SECRET>"
```

## API Endpoints

### Webhook

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/webhook/telegram` | Receive updates from Telegram |
| GET | `/webhook/telegram/info` | Health check and bot info |

### Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/telegram/status/:companyId` | Connection status |
| DELETE | `/api/telegram/disconnect/:companyId` | Disconnect company |
| GET | `/api/telegram/connections` | List all connections (admin) |
| GET | `/api/telegram/health` | Health check |
| GET | `/api/telegram/metrics` | Metrics |
| POST | `/api/telegram/webhook/set` | Set webhook URL |
| POST | `/api/telegram/send` | Send test message |

## Salon Onboarding

### Requirements

1. **Telegram Premium** - Salon owner needs Premium subscription ($4.99/month)
2. **Business Mode** - Must enable Telegram Business features

### Connection Steps

1. Open Telegram app
2. Go to **Settings** → **Telegram Business** → **Chatbot**
3. Search for `@YourBotUsername`
4. Click **Connect**
5. Bot receives `business_connection` event
6. Connection stored in database

### Verification

```bash
# Check connection status
curl https://your-domain.com/api/telegram/status/962302

# Expected response
{
  "connected": true,
  "canReply": true,
  "telegramUsername": "@salon_owner",
  "connectedAt": "2025-11-29T12:00:00Z"
}
```

## Message Flow

### Incoming Message

```
1. Customer messages salon's personal Telegram
2. Telegram sends business_message to our webhook
3. TelegramBot emits 'incoming_message' event
4. TelegramManager resolves companyId from businessConnectionId
5. Message queued via BullMQ with platform='telegram'
6. message-worker-v2 processes message
7. AI generates response
8. Response sent via TelegramManager.sendMessage()
9. Customer sees response from salon's account
```

### Context Separation

Each platform has separate Redis keys:

```
# WhatsApp context
dialog:962302:whatsapp:79001234567

# Telegram context
dialog:962302:telegram:123456789
```

## Error Handling

### Error Classes

| Class | Code | Retryable | Description |
|-------|------|-----------|-------------|
| TelegramError | TELEGRAM_ERROR | No | Base error class |
| TelegramConnectionError | TELEGRAM_CONNECTION_ERROR | Yes | Connection issues |
| TelegramMessageError | TELEGRAM_MESSAGE_ERROR | Yes | Message send/receive |
| TelegramRateLimitError | TELEGRAM_RATE_LIMIT | Yes | 429 Too Many Requests |
| TelegramBotBlockedError | TELEGRAM_BOT_BLOCKED | No | 403 - User blocked bot |
| TelegramActivityWindowError | TELEGRAM_ACTIVITY_WINDOW | No | 24h window expired |
| TelegramWebhookError | TELEGRAM_WEBHOOK_ERROR | Yes | Webhook issues |
| TelegramConnectionNotFoundError | TELEGRAM_CONNECTION_NOT_FOUND | No | No connection for company |
| TelegramAPIError | TELEGRAM_API_ERROR | 5xx only | Telegram API error |
| TelegramConfigError | TELEGRAM_CONFIG_ERROR | No | Configuration missing |

### Sentry Integration

All errors are captured to Sentry with tags:

```javascript
{
  'telegram.error_code': 'TELEGRAM_MESSAGE_ERROR',
  'telegram.retryable': 'true',
  'telegram.company_id': '962302',
  'telegram.chat_id': '123456789'
}
```

## Rate Limits

Telegram enforces these limits:

- **1 message/second** per user
- **30 messages/second** globally
- **Business Bot** has same limits as regular bots

grammY's built-in rate limiter handles this automatically.

## 24-Hour Activity Window

**Important:** Business Bot can only reply to chats active in last 24 hours.

- For **bookings**: Customer always messages first → No issue
- For **reminders**: Check `can_reply` flag before sending
- **Fallback**: If Telegram unavailable, try WhatsApp

```javascript
if (!connection.can_reply) {
  // Try WhatsApp fallback
  return await whatsappClient.sendMessage(phone, message);
}
```

## Monitoring

### Health Check

```bash
curl https://your-domain.com/webhook/telegram/info | jq '.health'
```

### Metrics

```bash
curl https://your-domain.com/api/telegram/metrics
```

Response:
```json
{
  "messagesReceived": 150,
  "messagesSent": 145,
  "messagesQueued": 150,
  "connectionLookups": 300,
  "cacheHits": 285,
  "cacheHitRate": "95.00%",
  "errors": 2,
  "uptimeHours": "24.50"
}
```

### Logs

```bash
# API logs (includes Telegram)
pm2 logs ai-admin-api --lines 50 | grep telegram

# Filter by component
pm2 logs ai-admin-api | grep "telegram-manager"
pm2 logs ai-admin-api | grep "telegram-bot"
```

## Troubleshooting

### Bot Not Receiving Messages

1. Check webhook is set correctly:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

2. Verify webhook URL is accessible:
   ```bash
   curl -v https://your-domain.com/webhook/telegram/info
   ```

3. Check bot token is correct

### "Cannot Reply" Error

**Cause:** 24-hour activity window expired.

**Solution:** Customer must send a new message to restart the window.

### Connection Not Found

**Cause:** Salon disconnected or never connected.

**Solution:**
1. Ask salon owner to reconnect via Telegram Business settings
2. Check database: `SELECT * FROM telegram_business_connections WHERE company_id = ?`

### Rate Limit Errors

**Cause:** Sending too many messages.

**Solution:** grammY handles this automatically with exponential backoff. If persistent, review message frequency.

## Security

### Webhook Verification

All webhook requests are verified using the secret token:

```javascript
// Header: X-Telegram-Bot-Api-Secret-Token
if (req.headers['x-telegram-bot-api-secret-token'] !== config.telegram.webhookSecret) {
  return res.status(401).json({ error: 'Invalid secret' });
}
```

### Bot Token Protection

- Never commit tokens to git
- Use environment variables
- Rotate tokens if compromised

## Testing

### Send Test Message

```bash
curl -X POST https://your-domain.com/api/telegram/send \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": 962302,
    "chatId": 123456789,
    "message": "Test message from AI Admin"
  }'
```

### Simulate Business Connection

For testing without Telegram Premium:

```bash
# Insert test connection
psql -c "INSERT INTO telegram_business_connections
  (company_id, business_connection_id, telegram_user_id, telegram_username)
  VALUES (962302, 'test-conn-id', 123456789, 'test_user')"
```

## Related Documentation

- [TELEGRAM_BOT_QUICK_REFERENCE.md](./TELEGRAM_BOT_QUICK_REFERENCE.md) - Admin alerts bot
- [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md) - Initial setup guide
- [TELEGRAM_ALERTS_TROUBLESHOOTING.md](./TELEGRAM_ALERTS_TROUBLESHOOTING.md) - Alert troubleshooting
