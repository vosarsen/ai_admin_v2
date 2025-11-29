# Telegram Integration - Tasks

**Project:** AI Admin v2 - Telegram Channel Integration
**Last Updated:** 2025-11-29

---

## Phase 1: Core Infrastructure (Week 1) - 40h

### 1.1 Project Setup (4h) ✅ COMPLETE
- [x] Create `src/integrations/telegram/` directory
- [x] Install grammY: `npm install grammy`
- [x] Add Telegram config to `src/config/index.js`
- [x] Update `.env.example` with Telegram vars
- [ ] Create bot via @BotFather (get token) - **Manual step for production**
- [ ] Enable Business Mode in @BotFather - **Manual step for production**

### 1.2 Telegram Bot Client (8h) ✅ COMPLETE
- [x] Create `src/integrations/telegram/telegram-bot.js`
- [x] Initialize grammY Bot instance
- [x] Handle `business_connection` event
  - [x] Parse connection data
  - [x] Emit event for TelegramManager (will store in DB)
  - [x] Log connection
- [x] Handle `business_message` event
  - [x] Extract message text
  - [x] Extract sender info
  - [x] Emit event for queueing
- [x] Implement `sendMessage(chatId, text, businessConnectionId)`
- [x] Implement `sendTypingAction(chatId, businessConnectionId)`
- [x] Implement `sendWithTyping()` for natural UX
- [x] Add error handling and logging
- [x] Add webhook handler for Express
- [x] Add health check method
- [x] Add metrics collection

### 1.3 Database Schema (4h) ✅ COMPLETE
- [x] Create migration file `migrations/20251129_create_telegram_tables.sql`
- [x] Create `telegram_business_connections` table
- [x] Add indexes for performance
- [x] Add trigger for updated_at auto-update
- [x] Add telegram_enabled, telegram_premium_until to companies
- [x] Fix FK reference (`companies(id)` instead of `companies(company_id)`)
- [x] Create repository `src/repositories/TelegramConnectionRepository.js`
- [x] Register in `src/repositories/index.js`
- [ ] Run migration on local
- [ ] Run migration on production

### 1.4 Telegram Manager (8h) ✅ COMPLETE
- [x] Create `src/integrations/telegram/telegram-manager.js`
- [x] Implement `initialize()` - bot startup
- [x] Implement `getBusinessConnection(companyId)` → `getConnectionStatus()`
- [x] Implement `saveBusinessConnection(companyId, data)` → via event handlers
- [x] Implement `removeBusinessConnection(companyId)` → `disconnect()`
- [x] Implement `sendMessage(companyId, chatId, message)`
- [x] Implement `sendWithTyping(companyId, chatId, message)` - with delay
- [x] Implement `healthCheck()`
- [x] Implement `getMetrics()`
- [x] Add singleton export
- [x] Connection cache with TTL (5 min)
- [x] Cache warmup on startup

### 1.5 API Routes (8h) ✅ COMPLETE
- [x] Create `src/api/webhooks/telegram.js`
  - [x] POST `/webhook/telegram` - receive updates
  - [x] Verify webhook secret header
  - [x] GET `/webhook/telegram/info` - admin info
- [x] Create `src/api/routes/telegram-management.js`
  - [x] GET `/api/telegram/status/:companyId` - connection status
  - [x] DELETE `/api/telegram/disconnect/:companyId` - disconnect
  - [x] GET `/api/telegram/connections` - list all (admin)
  - [x] GET `/api/telegram/health` - health check
  - [x] GET `/api/telegram/metrics` - metrics
  - [x] POST `/api/telegram/webhook/set` - set webhook URL
  - [x] POST `/api/telegram/send` - send message (testing)
- [x] Register routes in `src/api/index.js`
- [x] Add rate limiting
- [ ] Add Swagger documentation (low priority)

### 1.6 Worker Integration (8h) ✅ COMPLETE
- [x] Create `src/integrations/telegram/telegram-api-client.js`
  - [x] HTTP client for workers
  - [x] `sendMessage(companyId, chatId, message)`
  - [x] `canSendVia(companyId)` - check availability
  - [x] `healthCheck()`
- [x] Modify `src/workers/message-worker-v2.js`
  - [x] Add `platform` detection from job data
  - [x] Import Telegram API client
  - [x] Add helper methods `sendMessage()` and `sendReaction()`
  - [x] Update all message sending to use platform-aware methods
  - [x] Update logging for platform awareness
  - [x] Update `sendCalendarInvite()` for platform support
- [x] Create `src/integrations/telegram/index.js` - module exports
- [ ] Test with mock messages (requires Phase 2)

---

## Phase 2: AI Integration (Week 2) - 40h

### 2.1 Context Service Updates (8h)
- [ ] Update `src/services/context/context-service-v2.js`
  - [ ] Add platform parameter to `_getKey()`
  - [ ] Update `getFullContext()` for platform
  - [ ] Update `getDialogContext()` for platform
  - [ ] Update `updateDialogContext()` for platform
  - [ ] Update `addMessage()` for platform
  - [ ] Update `clearDialogContext()` for platform
- [ ] Keep backward compatibility (default to 'whatsapp')
- [ ] Add tests for multi-platform context

### 2.2 Message Queue Updates (8h)
- [ ] Update `src/queue/message-queue.js`
  - [ ] Document new job structure with platform
  - [ ] Add Telegram-specific queue options if needed
- [ ] Update queue job schema:
  ```javascript
  {
    companyId: number,
    platform: 'whatsapp' | 'telegram',
    from: string, // phone or Telegram user ID
    chatId: number, // Telegram-specific
    businessConnectionId: string, // Telegram-specific
    message: string,
    messageId: string,
    metadata: {}
  }
  ```
- [ ] Test queue processing with both platforms

### 2.3 AI Admin v2 Updates (8h)
- [ ] Update `src/services/ai-admin-v2/index.js`
  - [ ] Add `platform` to `processMessage()` options
  - [ ] Pass platform to context service
  - [ ] Return platform in response
- [ ] Update `src/services/ai-admin-v2/modules/context-manager-v2.js`
  - [ ] Add platform parameter to `loadFullContext()`
  - [ ] Add platform parameter to `saveContext()`
- [ ] Test AI processing for Telegram messages

### 2.4 Reminder System Updates (8h)
- [ ] Update `src/queue/message-queue.js` - `addReminder()`
  - [ ] Include platform in reminder data
- [ ] Update `src/workers/message-worker-v2.js` - `scheduleReminders()`
  - [ ] Store platform with reminder
- [ ] Update reminder worker (if separate)
  - [ ] Send via correct platform
  - [ ] Handle `can_reply` flag for Telegram
- [ ] Test reminder flow for both platforms

### 2.5 Calendar Invite Updates (4h)
- [ ] Update `sendCalendarInvite()` in worker
  - [ ] Use Telegram-specific message format
  - [ ] Ensure links work in Telegram
- [ ] Test .ics links via Telegram

### 2.6 Testing Infrastructure (4h)
- [ ] Create test scenarios in `tests/telegram/`
- [ ] Mock Telegram API responses
- [ ] Test business connection flow
- [ ] Test message processing flow
- [ ] Test reminder sending flow

---

## Phase 3: Production & Monitoring (Week 3) - 20h

### 3.1 Deployment Configuration (4h)
- [ ] Create `src/integrations/telegram/bot-service.js` - standalone entry
- [ ] Add PM2 config for Telegram bot
- [ ] Configure Nginx for webhook
  - [ ] Add location `/webhook/telegram`
  - [ ] Proxy to app
  - [ ] Verify secret header
- [ ] Set webhook URL via Telegram API
- [ ] Test webhook delivery

### 3.2 Monitoring & Alerts (4h)
- [ ] Add Prometheus metrics
  - [ ] `telegram_messages_received_total`
  - [ ] `telegram_messages_sent_total`
  - [ ] `telegram_connections_active`
  - [ ] `telegram_errors_total`
- [ ] Create Grafana dashboard (or update existing)
- [ ] Add Telegram alerts to Telegram admin channel (ironic!)
- [ ] Add Sentry tags for Telegram errors

### 3.3 Error Handling (4h)
- [ ] Create `src/utils/telegram-errors.js`
  - [ ] `TelegramError` base class
  - [ ] `TelegramConnectionError`
  - [ ] `TelegramMessageError`
  - [ ] `TelegramRateLimitError`
- [ ] Update error messages for Telegram context
- [ ] Handle specific Telegram API errors
  - [ ] `403 Forbidden` - bot blocked
  - [ ] `429 Too Many Requests` - rate limit
  - [ ] `400 Bad Request` - invalid message

### 3.4 Documentation (4h)
- [ ] Create `docs/02-guides/telegram/TELEGRAM_INTEGRATION_GUIDE.md`
  - [ ] Setup instructions
  - [ ] Configuration reference
  - [ ] Troubleshooting
- [ ] Update `CLAUDE.md` with Telegram section
- [ ] Create salon onboarding guide (for clients)
- [ ] Add API documentation

### 3.5 Buffer (4h)
- Reserved for unexpected issues

---

## Post-Launch Tasks

### Week 4+ (After stable launch)
- [ ] Add Telegram-specific features
  - [ ] Inline keyboards for booking confirmation
  - [ ] Photo sharing (salon portfolio)
  - [ ] Location sharing (salon address)
- [ ] Optimize performance
- [ ] Gather user feedback
- [ ] A/B test response formats

---

## Progress Tracking

| Phase | Status | Progress | Hours Spent | Hours Estimated |
|-------|--------|----------|-------------|-----------------|
| 1.1 Project Setup | ✅ Complete | 4/6 | 1 | 4 |
| 1.2 Bot Client | ✅ Complete | 12/12 | 2 | 8 |
| 1.3 Database | ✅ Complete | 8/8 | 2 | 4 |
| 1.4 Manager | ✅ Complete | 12/12 | 2 | 8 |
| 1.5 API Routes | ✅ Complete | 11/12 | 1.5 | 8 |
| 1.6 Worker | ✅ Complete | 8/9 | 1.5 | 8 |
| 2.1 Context | ⬜ Pending | 0/8 | 0 | 8 |
| 2.2 Queue | ⬜ Pending | 0/4 | 0 | 8 |
| 2.3 AI Admin | ⬜ Pending | 0/5 | 0 | 8 |
| 2.4 Reminders | ✅ Fixed | 1/5 | 0.5 | 8 |
| 2.5 Calendar | ⬜ Pending | 0/3 | 0 | 4 |
| 2.6 Testing | ⬜ Pending | 0/5 | 0 | 4 |
| 3.1 Deploy | ⬜ Pending | 0/6 | 0 | 4 |
| 3.2 Monitor | ⬜ Pending | 0/5 | 0 | 4 |
| 3.3 Errors | ⬜ Pending | 0/5 | 0 | 4 |
| 3.4 Docs | ⬜ Pending | 0/4 | 0 | 4 |
| 3.5 Buffer | ⬜ Pending | - | 0 | 4 |
| **TOTAL** | | **56/92** | **10.5** | **100** |

### Session 4 (2025-11-29) - Phase 1 Implementation
**Phase 1.4 - Telegram Manager:**
- Created `telegram-manager.js` (420 lines)
- Connection cache with 5-min TTL
- Event handlers for bot events
- Full CRUD via repository

**Phase 1.5 - API Routes:**
- Created `webhooks/telegram.js` (webhook handler)
- Created `routes/telegram-management.js` (7 endpoints)
- Registered in `api/index.js`

**Phase 1.6 - Worker Integration:**
- Created `telegram-api-client.js` (HTTP client)
- Modified `message-worker-v2.js`:
  - Added platform detection
  - Added `sendMessage()` and `sendReaction()` helpers
  - Updated all message sending for multi-platform
- Created `telegram/index.js` module exports

**Phase 1 Status: ✅ COMPLETE (10.5 hours actual vs 40 hours estimated)**

### Plan Review Session (Session 3)
- Added `addReminder()` to message-queue.js (0.5h)
- Fixed FK in migration (0.1h)
- Created TelegramConnectionRepository (0.5h)
- Updated plan with 6 new sections (1h)
- **Plan Status: ✅ READY FOR IMPLEMENTATION**
