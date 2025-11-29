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

## Phase 2: AI Integration (Week 2) - 40h ✅ COMPLETE

### 2.1 Context Service Updates (8h) ✅ COMPLETE
- [x] Update `src/services/context/context-service-v2.js`
  - [x] Add platform parameter to `_getKey()`
  - [x] Update `getFullContext()` for platform
  - [x] Update `getDialogContext()` for platform
  - [x] Update `updateDialogContext()` for platform
  - [x] Update `addMessage()` for platform
  - [x] Update `clearDialogContext()` for platform
  - [x] Update all other public methods
- [x] Keep backward compatibility (default to 'whatsapp')
- [ ] Add tests for multi-platform context (deferred to Phase 2.6)

### 2.2 Message Queue Updates (8h) ✅ COMPLETE
- [x] Update `src/queue/message-queue.js`
  - [x] Document new job structure with platform
  - [x] Add platform field to addMessage()
- [x] Job schema documented:
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
- [ ] Test queue processing with both platforms (deferred to Phase 2.6)

### 2.3 AI Admin v2 Updates (8h) ✅ COMPLETE
- [x] Update `src/services/ai-admin-v2/index.js`
  - [x] Add `platform` to `processMessage()` options
  - [x] Pass platform to context service
  - [x] Add platform to context object
- [x] Update `src/services/ai-admin-v2/modules/context-manager-v2.js`
  - [x] Add platform parameter to `loadFullContext()`
  - [x] Add platform parameter to `saveContext()`
  - [x] Add platform parameter to `saveCommandContext()`
  - [x] Add platform parameter to `clearDialogAfterBooking()`
  - [x] Add platform parameter to `handlePendingActions()`
  - [x] Add platform parameter to `setProcessingStatus()`
- [ ] Test AI processing for Telegram messages (deferred to Phase 2.6)

### 2.4 Reminder System Updates (8h) ✅ COMPLETE
- [x] Update `src/queue/message-queue.js` - `addReminder()`
  - [x] Include platform in reminder data (already done in Phase 1)
- [x] Update `src/services/booking-monitor/index.js`
  - [x] Add explicit platform to context updates
  - [x] Note: Telegram reminders deferred to Phase 3
- [ ] Update reminder worker for Telegram (deferred to Phase 3)
  - [ ] Handle `can_reply` flag for Telegram
- [ ] Test reminder flow for both platforms (deferred to Phase 2.6)

### 2.5 Calendar Invite Updates (4h) ✅ COMPLETE
- [x] `sendCalendarInvite()` in worker already supports platform
  - [x] Accepts options.platform parameter
  - [x] Uses platform-aware sendMessage()
- [x] Links work in Telegram (same HTTP links)
- [ ] Test .ics links via Telegram (deferred to Phase 2.6)

### 2.6 Testing Infrastructure (4h) ⏸️ DEFERRED
- [ ] Create test scenarios in `tests/telegram/`
- [ ] Mock Telegram API responses
- [ ] Test business connection flow
- [ ] Test message processing flow
- [ ] Test reminder sending flow
**NOTE:** Testing deferred until Phase 3 deployment ready

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
| 2.1 Context | ✅ Complete | 8/8 | 0.5 | 8 |
| 2.2 Queue | ✅ Complete | 4/4 | 0.25 | 8 |
| 2.3 AI Admin | ✅ Complete | 6/6 | 0.5 | 8 |
| 2.4 Reminders | ✅ Complete | 3/5 | 0.25 | 8 |
| 2.5 Calendar | ✅ Complete | 3/3 | 0.25 | 4 |
| 2.6 Testing | ⏸️ Deferred | 0/5 | 0 | 4 |
| 3.1 Deploy | ⬜ Pending | 0/6 | 0 | 4 |
| 3.2 Monitor | ⬜ Pending | 0/5 | 0 | 4 |
| 3.3 Errors | ⬜ Pending | 0/5 | 0 | 4 |
| 3.4 Docs | ⬜ Pending | 0/4 | 0 | 4 |
| 3.5 Buffer | ⬜ Pending | - | 0 | 4 |
| **TOTAL** | | **79/93** | **12.25** | **100** |

**Phase 1 Complete:** 10.5h actual vs 40h estimated = **74% faster**
**Phase 2 Complete:** 1.75h actual vs 40h estimated = **96% faster**
**Total Phase 1+2:** 12.25h actual vs 80h estimated = **85% faster**

### Session 5 (2025-11-29) - Phase 2 Implementation
**Phase 2.1 - Context Service:**
- Updated `context-service-v2.js` with platform parameter
- All 13 public methods now accept `options.platform`
- Key format: `prefix:companyId:platform:phone`
- Default platform: 'whatsapp' for backward compatibility

**Phase 2.2 - Message Queue:**
- Documented job data structure with platform-specific fields
- Added platform to `addMessage()` method

**Phase 2.3 - AI Admin v2:**
- Added platform to `processMessage()` options
- Updated `context-manager-v2.js` with platform parameter
- Context object now includes platform

**Phase 2.4 - Reminders:**
- booking-monitor already WhatsApp-only
- Added explicit platform to context updates
- Telegram reminders deferred to Phase 3

**Phase 2.5 - Calendar Invites:**
- Already supports platform in options
- No changes needed

**Phase 2 Status: ✅ COMPLETE (1.75 hours actual vs 40 hours estimated = 96% faster!)**

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
