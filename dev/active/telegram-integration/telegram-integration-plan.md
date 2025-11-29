# Telegram Business Bot Integration Plan

**Project:** AI Admin v2 - Telegram Channel Integration
**Status:** Planning
**Created:** 2025-11-29
**Estimated:** 2-3 weeks (~100 hours)

---

## Executive Summary

Integrate Telegram as an additional messaging channel for AI Admin, using the official **Telegram Business Bot API** (launched March 2024). This allows salons to receive and respond to customer messages through their Telegram account, similar to the existing WhatsApp integration.

### Key Decision: Telegram Business Bot vs Userbot

| Approach | Ban Risk | Complexity | Recommendation |
|----------|----------|------------|----------------|
| **Userbot (MTProto)** | 🔴 HIGH | 4-5 weeks | ❌ NOT RECOMMENDED |
| **Business Bot** | 🟢 NONE | 2-3 weeks | ✅ RECOMMENDED |

**Chosen: Telegram Business Bot** - Official, zero ban risk, simpler integration

### Trade-offs

- ✅ Official Telegram feature (no ban risk)
- ✅ Messages appear from salon's account (not bot label)
- ✅ Simpler session management (connection ID vs 700+ keys)
- ⚠️ Requires Telegram Premium ($4.99/month per salon)
- ⚠️ 24-hour activity window (can only reply in active chats)

---

## Architecture Overview

### Current WhatsApp Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Admin v2                              │
│  (src/services/ai-admin-v2/index.js)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐
│  Message Queue      │   │  Context Service    │
│  (BullMQ)           │   │  (Redis)            │
└─────────┬───────────┘   └─────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  WhatsApp Integration                                        │
│  - session-pool.js (Baileys connection management)          │
│  - api-client.js (HTTP proxy for workers)                   │
│  - whatsapp-manager-unified.js (main interface)             │
└─────────────────────────────────────────────────────────────┘
```

### Proposed Multi-Channel Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Admin v2                              │
│  (src/services/ai-admin-v2/index.js)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐
│  Message Queue      │   │  Context Service    │
│  (BullMQ)           │   │  (Redis + platform) │
└─────────┬───────────┘   └─────────────────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌─────────────┐ ┌─────────────────────────────────────────────┐
│  WhatsApp   │ │  Telegram Integration (NEW)                  │
│  (Baileys)  │ │  - telegram-bot.js (grammY bot client)      │
│             │ │  - telegram-manager.js (main interface)      │
│             │ │  - business-connection.js (salon accounts)   │
└─────────────┘ └─────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1) - 40h

#### 1.1 Project Setup (4h)
- [ ] Create `src/integrations/telegram/` directory structure
- [ ] Add grammY dependency: `npm install grammy`
- [ ] Create Telegram config in `src/config/index.js`
- [ ] Add environment variables to `.env.example`

```javascript
// src/config/index.js - new section
get telegram() {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    enabled: process.env.TELEGRAM_ENABLED === 'true'
  };
}
```

#### 1.2 Telegram Bot Client (8h)
- [ ] Create `src/integrations/telegram/telegram-bot.js`
- [ ] Implement grammY bot initialization
- [ ] Handle `business_connection` events (salon connects account)
- [ ] Handle `business_message` events (incoming messages)
- [ ] Implement message sending with `business_connection_id`

```javascript
// src/integrations/telegram/telegram-bot.js
const { Bot } = require('grammy');

class TelegramBot {
  constructor() {
    this.bot = new Bot(config.telegram.botToken);
    this.setupHandlers();
  }

  setupHandlers() {
    // Salon owner connects their account
    this.bot.on('business_connection', this.handleBusinessConnection);

    // Customer sends message to salon
    this.bot.on('business_message', this.handleBusinessMessage);
  }

  async sendMessage(chatId, text, businessConnectionId) {
    return this.bot.api.sendMessage(chatId, text, {
      business_connection_id: businessConnectionId
    });
  }
}
```

#### 1.3 Database Schema (4h)
- [ ] Create migration for Telegram business connections table
- [ ] Add `messaging_channel` column to existing tables where needed

```sql
-- migrations/YYYYMMDD_create_telegram_tables.sql
CREATE TABLE telegram_business_connections (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),  -- Note: companies.id is PK
  business_connection_id VARCHAR(255) UNIQUE NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  telegram_username VARCHAR(255),
  can_reply BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tg_company ON telegram_business_connections(company_id);
CREATE INDEX idx_tg_connection ON telegram_business_connections(business_connection_id);

-- Add platform column to track message source
ALTER TABLE messages ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'whatsapp';
```

#### 1.4 Telegram Manager (8h)
- [ ] Create `src/integrations/telegram/telegram-manager.js`
- [ ] Implement connection management (store/retrieve connection IDs)
- [ ] Implement health checks
- [ ] Add metrics collection

```javascript
// src/integrations/telegram/telegram-manager.js
class TelegramManager {
  async getBusinessConnection(companyId) { }
  async saveBusinessConnection(companyId, connectionData) { }
  async sendMessage(companyId, chatId, message) { }
  async healthCheck() { }
}
```

#### 1.5 API Routes (8h)
- [ ] Create `src/api/webhooks/telegram.js` for webhook handling
- [ ] Create `src/api/routes/telegram-management.js` for admin API
- [ ] Add webhook verification middleware
- [ ] Register routes in `src/api/index.js`

```javascript
// src/api/webhooks/telegram.js
router.post('/webhook/telegram', async (req, res) => {
  // Verify webhook secret
  // Process update through grammY
  // Queue message for processing
});

// src/api/routes/telegram-management.js
router.get('/api/telegram/status/:companyId', /* ... */);
router.post('/api/telegram/disconnect/:companyId', /* ... */);
```

#### 1.6 Worker Integration (8h)
- [ ] Modify `src/workers/message-worker-v2.js` to support Telegram
- [ ] Add platform-aware message sending
- [ ] Create `src/integrations/telegram/telegram-api-client.js` for workers

```javascript
// Modified worker logic
async processMessage(job) {
  const { platform = 'whatsapp', ...data } = job.data;

  // Process with AI Admin v2 (same logic)
  const result = await aiAdminV2.processMessage(message, from, companyId);

  // Send response via appropriate channel
  if (platform === 'telegram') {
    await telegramClient.sendMessage(from, result.response, options);
  } else {
    await whatsappClient.sendMessage(from, result.response, options);
  }
}
```

### Phase 2: AI Integration (Week 2) - 40h

#### 2.1 Context Service Updates (8h)
- [ ] Add platform awareness to context keys
- [ ] Update `src/services/context/context-service-v2.js`
- [ ] Ensure conversation history tracks platform

```javascript
// Updated key structure
_getKey(type, companyId, phone, platform = 'whatsapp') {
  const prefix = this.prefixes[type] || '';
  const normalizedPhone = this._normalizePhoneForKey(phone);
  return `${prefix}${companyId}:${platform}:${normalizedPhone}`;
}
```

#### 2.2 Message Queue Updates (8h)
- [ ] Update queue job structure to include platform
- [ ] Create Telegram-specific queue if needed
- [ ] Update `src/queue/message-queue.js`

```javascript
// Updated queue message structure
{
  companyId: 962302,
  platform: 'telegram', // or 'whatsapp'
  from: '79001234567',
  chatId: 123456789, // Telegram-specific
  businessConnectionId: 'conn_abc123', // Telegram-specific
  message: 'Хочу записаться',
  metadata: { ... }
}
```

#### 2.3 AI Admin v2 Updates (8h)
- [ ] Add platform parameter to `processMessage()`
- [ ] Ensure response formatting works for both platforms
- [ ] Update booking confirmations to work with both channels

```javascript
// src/services/ai-admin-v2/index.js
async processMessage(message, phone, companyId, options = {}) {
  const { platform = 'whatsapp', chatId, businessConnectionId } = options;

  // Same AI processing logic
  // ...

  return {
    success: true,
    response: result.response,
    platform,
    chatId, // For Telegram
    businessConnectionId // For Telegram
  };
}
```

#### 2.4 Reminder System Updates (8h)
- [ ] Update reminder scheduling to track platform
- [ ] Modify reminder worker to send via correct channel
- [ ] Update `src/services/reminder/` modules

#### 2.5 Calendar Invite Updates (4h)
- [ ] Ensure .ics links work with Telegram
- [ ] Update calendar invite sending logic

#### 2.6 Testing Infrastructure (4h)
- [ ] Add Telegram MCP server for testing (optional)
- [ ] Create test scenarios for Telegram flow
- [ ] Update existing tests to be platform-agnostic

### Phase 3: Production & Monitoring (Week 3) - 20h

#### 3.1 Deployment Configuration (4h)
- [ ] Add PM2 config for Telegram bot service
- [ ] Configure Nginx for webhook endpoint
- [ ] Set up SSL for webhook verification

```javascript
// ecosystem.config.js addition
{
  name: 'telegram-bot',
  script: 'src/integrations/telegram/bot-service.js',
  instances: 1,
  env: {
    NODE_ENV: 'production',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN
  }
}
```

```nginx
# Nginx webhook configuration
location /webhook/telegram {
  proxy_pass http://localhost:3000/webhook/telegram;
  proxy_http_version 1.1;
  proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;
}
```

#### 3.2 Monitoring & Alerts (4h)
- [ ] Add Telegram metrics to Prometheus
- [ ] Create Grafana dashboard for Telegram
- [ ] Set up Telegram-specific alerts

```javascript
// Prometheus metrics
telegramMessagesReceived.inc({ company_id: companyId });
telegramMessagesSent.inc({ company_id: companyId });
telegramConnectionsActive.set(activeConnections);
```

#### 3.3 Error Handling (4h)
- [ ] Add Telegram-specific error types
- [ ] Update error messages for Telegram context
- [ ] Add Sentry tags for Telegram errors

#### 3.4 Documentation (4h)
- [ ] Create `docs/TELEGRAM_INTEGRATION_GUIDE.md`
- [ ] Update CLAUDE.md with Telegram commands
- [ ] Create salon onboarding guide

#### 3.5 Buffer for Issues (4h)
- Reserved for unexpected issues

---

## File Structure

```
src/
├── integrations/
│   ├── whatsapp/                    # Existing
│   │   ├── api-client.js
│   │   ├── session-pool.js
│   │   └── whatsapp-manager-unified.js
│   └── telegram/                     # NEW
│       ├── telegram-bot.js          # grammY bot client
│       ├── telegram-manager.js      # Main interface
│       ├── telegram-api-client.js   # HTTP client for workers
│       ├── business-connection.js   # Connection management
│       └── bot-service.js           # Standalone bot service
├── api/
│   ├── webhooks/
│   │   ├── whatsapp-baileys.js      # Existing
│   │   └── telegram.js              # NEW - webhook handler
│   └── routes/
│       ├── whatsapp-management.js   # Existing
│       └── telegram-management.js   # NEW - admin API
├── services/
│   └── context/
│       └── context-service-v2.js    # Updated for platform
└── workers/
    └── message-worker-v2.js         # Updated for multi-channel
```

---

## Database Schema

### New Table: telegram_business_connections

```sql
CREATE TABLE telegram_business_connections (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  business_connection_id VARCHAR(255) UNIQUE NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  telegram_username VARCHAR(255),
  telegram_first_name VARCHAR(255),
  can_reply BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMP DEFAULT NOW(),
  disconnected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_company FOREIGN KEY (company_id)
    REFERENCES companies(id) ON DELETE CASCADE  -- Note: companies.id is PK
);

-- Indexes
CREATE INDEX idx_telegram_company_id ON telegram_business_connections(company_id);
CREATE INDEX idx_telegram_business_connection ON telegram_business_connections(business_connection_id);
CREATE INDEX idx_telegram_user_id ON telegram_business_connections(telegram_user_id);
CREATE INDEX idx_telegram_active ON telegram_business_connections(is_active) WHERE is_active = true;
```

### Modified Tables

```sql
-- Add platform tracking to messages (if exists)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS
  platform VARCHAR(20) DEFAULT 'whatsapp'
  CHECK (platform IN ('whatsapp', 'telegram'));

-- Add Telegram channel to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  telegram_enabled BOOLEAN DEFAULT false;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  telegram_premium_until TIMESTAMP;
```

---

## API Endpoints

### Webhook

```
POST /webhook/telegram
- Receives all Telegram updates
- Validates secret token
- Queues messages for processing
```

### Management API

```
GET  /api/telegram/status/:companyId
- Returns connection status and can_reply flag

POST /api/telegram/disconnect/:companyId
- Disconnects Telegram from company

GET  /api/telegram/connections
- Lists all active Telegram connections (admin only)
```

---

## Environment Variables

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=random_secret_for_verification
TELEGRAM_ENABLED=true

# Optional
TELEGRAM_BOT_USERNAME=ai_admin_salon_bot
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Telegram API changes | Low | Medium | Monitor Telegram changelog, use grammY (actively maintained) |
| 24-hour activity limit | Medium | Low | Design UX to encourage customer engagement |
| Premium cost per salon | Low | Low | Include in pricing (+$15/month covers Premium) |
| Webhook reliability | Low | Medium | Implement retry logic, dead letter queue |
| Message format differences | Medium | Low | Abstract message formatting layer |

---

## Rollback Strategy

### Phase 1 Rollback
If issues occur during core infrastructure setup:

1. **Disable Telegram** in environment:
   ```bash
   TELEGRAM_ENABLED=false
   ```
2. **Remove webhook** (if set):
   ```bash
   curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook"
   ```
3. **Stop PM2 process** (if running):
   ```bash
   pm2 stop telegram-bot
   pm2 delete telegram-bot
   ```
4. **Rollback database** (if needed):
   ```sql
   DROP TABLE IF EXISTS telegram_business_connections;
   ALTER TABLE companies DROP COLUMN IF EXISTS telegram_enabled;
   ALTER TABLE companies DROP COLUMN IF EXISTS telegram_premium_until;
   ALTER TABLE messages DROP COLUMN IF EXISTS platform;
   ```

### Phase 2 Rollback
If issues occur during AI integration:

1. Revert context service changes:
   - Backup exists at `context-service-v2.backup.js` (create before modifications)
   - Restore: `cp context-service-v2.backup.js context-service-v2.js`
2. Revert worker changes:
   - Backup: `message-worker-v2.backup.js`
   - Restore: `cp message-worker-v2.backup.js message-worker-v2.js`
3. Remove platform flags from queue jobs (they're ignored if not processed)

### Phase 3 Rollback
If issues occur in production:

1. **Stop PM2 Telegram process**:
   ```bash
   pm2 stop telegram-bot
   ```
2. **Remove Nginx webhook config**:
   ```bash
   rm /etc/nginx/sites-enabled/telegram-webhook.conf
   nginx -s reload
   ```
3. **Disable monitoring** (Grafana dashboard can stay, just hide)
4. **WhatsApp continues working** (no shared state affected)

### Recovery Time Objectives (RTO)
- Phase 1 rollback: < 5 minutes
- Phase 2 rollback: < 10 minutes
- Phase 3 rollback: < 3 minutes

---

## Company ID Mapping Strategy

### The Problem
When Telegram sends a `business_connection` event, it provides `business_connection_id` but not our internal `company_id`. We need to map connections to companies.

### Chosen Solution: Single Company Mode (MVP)

For MVP, we use a simple approach:

```javascript
// src/config/index.js
get telegram() {
  return {
    // ... other config
    defaultCompanyId: parseInt(process.env.TELEGRAM_DEFAULT_COMPANY_ID) || null
  };
}
```

**Workflow:**
1. We have one company (962302) initially
2. Set `TELEGRAM_DEFAULT_COMPANY_ID=962302` in `.env`
3. All Telegram connections auto-map to this company
4. Scale later when we have multiple companies

### Future: Multi-Company Mapping

When scaling to multiple companies, implement one of these:

**Option A: Connection Code Flow**
```
1. Admin creates "Telegram Connection Request" in portal
2. System generates unique 6-char code (e.g., "ABC123")
3. Salon owner sends code to bot as first message
4. Bot maps connection to company using code
5. Code expires after 10 minutes
```

**Option B: Telegram Username Pre-mapping**
```sql
-- Add telegram_username to companies table
ALTER TABLE companies ADD COLUMN telegram_username VARCHAR(255);

-- Admin sets telegram username for each company
UPDATE companies SET telegram_username = '@salon_telegram' WHERE id = 962302;

-- When connection arrives, lookup by username
SELECT id FROM companies WHERE telegram_username = '@salon_telegram';
```

### Implementation (MVP)

```javascript
// src/integrations/telegram/telegram-manager.js
async handleBusinessConnection(connectionData) {
  const companyId = config.telegram.defaultCompanyId;

  if (!companyId) {
    logger.error('TELEGRAM_DEFAULT_COMPANY_ID not set');
    throw new Error('Telegram not configured for this deployment');
  }

  await this.saveBusinessConnection(companyId, connectionData);
  logger.info(`Connected Telegram to company ${companyId}`);
}
```

---

## 24-Hour Activity Window Handling

### The Problem
Telegram Business Bot can only reply to chats where the customer has been active in the last 24 hours. This affects:
- **Booking reminders** (scheduled 1 day or 2 hours before)
- **Follow-up messages** (after booking confirmation)

### Solution: Graceful Degradation

#### 1. Check `can_reply` Before Sending

```javascript
// src/integrations/telegram/telegram-manager.js
async sendReminder(companyId, chatId, message) {
  const connection = await this.getBusinessConnection(companyId);

  if (!connection.can_reply) {
    logger.warn(`Cannot send reminder to ${chatId}: chat inactive (24h window)`);
    return { success: false, reason: 'chat_inactive' };
  }

  return this.sendMessage(companyId, chatId, message);
}
```

#### 2. Fallback to Alternative Channel

```javascript
// src/workers/reminder-worker.js
async sendReminder(data) {
  const { platform, phone, chatId, ...reminderData } = data;

  if (platform === 'telegram') {
    const result = await telegramManager.sendReminder(companyId, chatId, message);

    if (!result.success && result.reason === 'chat_inactive') {
      // Try WhatsApp if available
      const client = await clientRepository.findByPhone(phone);
      if (client?.whatsapp_phone) {
        logger.info(`Telegram inactive, falling back to WhatsApp for ${phone}`);
        return whatsappManager.sendMessage(companyId, client.whatsapp_phone, message);
      }

      // Log failed reminder for manual follow-up
      logger.warn(`Reminder failed: no active channel for ${phone}`);
      return { success: false, reason: 'no_active_channel' };
    }

    return result;
  }

  // Default WhatsApp path
  return whatsappManager.sendMessage(companyId, phone, message);
}
```

#### 3. Document Limitation for Salon Owners

Include in onboarding guide:
```markdown
### Telegram Reminder Limitations

Telegram only allows our bot to send messages if the customer has been
active in their chat within the last 24 hours. This means:

- ✅ Booking confirmations: Always work (customer just messaged)
- ⚠️ Day-before reminders: May not reach inactive customers
- ⚠️ 2-hour reminders: May not reach inactive customers

**Recommendation:** If a customer books via Telegram but hasn't
messaged in 24 hours, they won't receive reminders. Consider:
1. Asking for phone number during booking for SMS/WhatsApp backup
2. Sending "appointment coming up" message proactively after 12 hours
```

---

## Rate Limiting Implementation

### grammY Configuration

```javascript
// src/integrations/telegram/telegram-bot.js
const { Bot } = require('grammy');
const { autoRetry } = require('@grammyjs/auto-retry');
const { limit } = require('@grammyjs/ratelimiter');

class TelegramBot {
  constructor() {
    this.bot = new Bot(config.telegram.botToken);
    this.setupMiddleware();
    this.setupHandlers();
  }

  setupMiddleware() {
    // Auto-retry on rate limits (429 errors)
    this.bot.api.config.use(autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: 60
    }));

    // Rate limit incoming requests (per user)
    this.bot.use(limit({
      timeFrame: 1000, // 1 second window
      limit: 1,        // 1 message per window per user
      onLimitExceeded: async (ctx) => {
        logger.warn(`Rate limit exceeded for Telegram user ${ctx.from?.id}`);
        // Don't respond - just log and drop
      }
    }));
  }
}
```

### NPM Dependencies

```bash
npm install @grammyjs/auto-retry @grammyjs/ratelimiter
```

### Telegram Rate Limits Reference

| Limit Type | Value | Notes |
|------------|-------|-------|
| Messages to same user | 1/sec | Enforced client-side |
| Global messages | 30/sec | Across all chats |
| Bulk messages | 30/min | To groups/channels |
| API requests | ~30/sec | General limit |

---

## Context Key Migration Plan

### The Problem
Current Redis keys: `context:962302:79001234567`
Proposed keys: `context:962302:whatsapp:79001234567`

This changes the key structure, potentially orphaning existing WhatsApp context data.

### Solution: Backward-Compatible Migration

#### 1. Default Parameter Maintains Compatibility

```javascript
// src/services/context/context-service-v2.js
_getKey(type, companyId, phone, platform = 'whatsapp') {
  const prefix = this.prefixes[type] || '';
  const normalizedPhone = this._normalizePhoneForKey(phone);

  // New structure with platform
  return `${prefix}${companyId}:${platform}:${normalizedPhone}`;
}
```

#### 2. Migration Script (One-Time)

Run before deploying platform-aware context:

```javascript
// scripts/migrate-context-keys.js
const redis = require('../src/config/redis');

async function migrateContextKeys() {
  const patterns = [
    'context:*',
    'dialog:*',
    'prefs:*'
  ];

  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);

    for (const oldKey of keys) {
      // Skip already migrated keys (contain platform)
      if (oldKey.match(/:(whatsapp|telegram):/)) continue;

      // Parse old key: prefix:companyId:phone
      const parts = oldKey.split(':');
      if (parts.length !== 3) continue;

      const [prefix, companyId, phone] = parts;
      const newKey = `${prefix}:${companyId}:whatsapp:${phone}`;

      // Copy to new key
      const value = await redis.get(oldKey);
      const ttl = await redis.ttl(oldKey);

      if (ttl > 0) {
        await redis.setex(newKey, ttl, value);
      } else {
        await redis.set(newKey, value);
      }

      console.log(`Migrated: ${oldKey} -> ${newKey}`);
    }
  }
}
```

#### 3. Execution Plan

1. **Before deployment:** Run migration script
2. **During deployment:** Deploy new code with platform-aware keys
3. **After verification:** Delete old keys (optional, they'll expire naturally)

```bash
# Run migration
node scripts/migrate-context-keys.js

# Verify migration
redis-cli KEYS "context:*:whatsapp:*" | wc -l
redis-cli KEYS "dialog:*:whatsapp:*" | wc -l

# Deploy new code
pm2 restart all
```

---

## Success Metrics

1. **Technical**
   - [ ] Telegram messages processed < 10 seconds
   - [ ] 99%+ webhook delivery rate
   - [ ] Zero unhandled exceptions

2. **Business**
   - [ ] 3+ salons using Telegram within 1 month
   - [ ] Telegram booking rate >= WhatsApp rate
   - [ ] Customer satisfaction scores maintained

---

## Dependencies

### NPM Packages
- `grammy` - Telegram Bot framework for Node.js
- Already have: `bullmq`, `ioredis`, `pg`

### External Services
- Telegram Premium subscription per salon ($4.99/month)
- Telegram Bot created via @BotFather
- SSL certificate for webhook (already have)

---

## Timeline Summary

| Week | Phase | Hours | Deliverables |
|------|-------|-------|--------------|
| 1 | Core Infrastructure | 40h | Bot client, DB schema, API routes, worker integration |
| 2 | AI Integration | 40h | Context updates, queue updates, AI Admin updates, testing |
| 3 | Production | 20h | Deployment, monitoring, docs, buffer |
| **Total** | | **100h** | Full Telegram integration |

---

## Next Steps (After Approval)

1. Create `dev/active/telegram-integration/` project structure
2. Create detailed task list (`telegram-integration-tasks.md`)
3. Create context tracking file (`telegram-integration-context.md`)
4. Start Phase 1.1: Project Setup
