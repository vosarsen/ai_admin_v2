# Telegram Integration - Context

**Last Updated:** 2025-11-29
**Current Phase:** Phase 3 - Production & Monitoring (Pending)
**Session:** 5

---

## Quick Summary

Integrating Telegram Business Bot API as a second messaging channel for AI Admin v2 beauty salon booking system.

**Approach:** Telegram Business Bot (official API, zero ban risk)
**Library:** grammY (Node.js)
**Timeline:** 2-3 weeks

---

## Key Decisions

### 1. Why Telegram Business Bot over Userbot?
- **Zero ban risk** - Official feature launched March 2024
- **Messages appear from salon account** - Same UX as userbot
- **Simpler implementation** - Connection ID vs 700+ session keys
- **Future-proof** - Supported by Telegram

### 2. Architecture Approach
- **Parallel channels** - WhatsApp and Telegram work independently
- **Shared AI logic** - Same AI Admin v2 processes both
- **Platform-aware context** - Redis keys include platform prefix
- **Unified queue** - BullMQ handles both with platform flag

### 3. Database Design
- New table `telegram_business_connections` for salon accounts
- Add `platform` column to messages for tracking
- Store only connection ID (not heavy session data like Baileys)

---

## Current State

### Done
- [x] Research completed (web-research-specialist agent)
- [x] Architecture designed
- [x] Plan created (`telegram-integration-plan.md`)
- [x] **Phase 1.1: Project Setup**
  - [x] Created `src/integrations/telegram/` directory
  - [x] Installed grammY: `npm install grammy`
  - [x] Added Telegram config to `src/config/index.js`
  - [x] Updated `.env.example` with Telegram vars
- [x] **Phase 1.2: Telegram Bot Client (partial)**
  - [x] Created `src/integrations/telegram/telegram-bot.js` (grammY client)
- [x] **Phase 1.3: Database Schema**
  - [x] Created migration `migrations/20251129_create_telegram_tables.sql`
  - [x] Fixed FK reference (`companies(id)` instead of `companies(company_id)`)
  - [x] Created `src/repositories/TelegramConnectionRepository.js`
  - [x] Registered in `src/repositories/index.js`
- [x] **Plan Review Fixes** (Session 3)
  - [x] Added `addReminder()` method to `src/queue/message-queue.js`
  - [x] Added `defaultCompanyId` to Telegram config
  - [x] Added `TELEGRAM_DEFAULT_COMPANY_ID` to `.env.example`
  - [x] Added Rollback Strategy section to plan
  - [x] Added Company ID Mapping Strategy section to plan
  - [x] Added 24-Hour Activity Window Handling section to plan
  - [x] Added Rate Limiting Implementation section to plan
  - [x] Added Context Key Migration Plan section to plan

### In Progress
- [ ] Phase 3: Production & Monitoring (Deployment, Monitoring, Documentation)

### Blocked
- None

### Phase 1: COMPLETE ✅
All core infrastructure is ready:
- `telegram-bot.js` - grammY client (485 lines)
- `telegram-manager.js` - high-level orchestrator (420 lines)
- `telegram-api-client.js` - HTTP client for workers (130 lines)
- `TelegramConnectionRepository.js` - database layer (300 lines)
- `webhooks/telegram.js` - webhook handler
- `routes/telegram-management.js` - 7 management endpoints
- `message-worker-v2.js` - multi-platform support

### Phase 2: COMPLETE ✅
All AI integration complete:
- `context-service-v2.js` - platform parameter added to all methods
- `context-manager-v2.js` - platform-aware caching and context loading
- `message-queue.js` - documented job structure with platform
- `ai-admin-v2/index.js` - platform in processMessage options
- `booking-monitor` - explicit platform for WhatsApp reminders

---

## Important Files

| File | Purpose | Status |
|------|---------|--------|
| `src/integrations/telegram/` | Telegram integration | ✅ Complete |
| `src/repositories/TelegramConnectionRepository.js` | Database layer | ✅ Complete |
| `src/api/webhooks/telegram.js` | Webhook handler | ✅ Complete |
| `src/api/routes/telegram-management.js` | Management API | ✅ Complete |
| `src/workers/message-worker-v2.js` | Multi-platform worker | ✅ Complete |
| `src/services/context/context-service-v2.js` | Platform-aware context | ✅ Complete |
| `src/services/ai-admin-v2/modules/context-manager-v2.js` | Platform-aware cache | ✅ Complete |
| `src/services/ai-admin-v2/index.js` | Platform in options | ✅ Complete |
| `src/queue/message-queue.js` | Message queue | ✅ Complete |

---

## Technical Notes

### Telegram Business Bot Flow
```
1. Salon owner buys Telegram Premium ($4.99/month)
2. In Telegram: Settings → Business → Chatbot → Connect our bot
3. Bot receives `business_connection` event with connection ID
4. We store connection ID in PostgreSQL
5. When customer messages salon → we get `business_message` event
6. We queue message for AI processing
7. AI response sent via bot with `business_connection_id`
8. Customer sees message as from salon (no bot label)
```

### Rate Limits (grammY)
- 1 message/second per user
- 30 messages/second globally
- Use ratelimiter middleware

### 24-Hour Activity Window
- Can only reply to chats active in last 24 hours
- For bookings: customer always messages first, so OK
- For reminders: may need to check `can_reply` flag

---

## Questions to Resolve

1. ~~Bot name for production?~~ → TBD during setup
2. ~~Pricing for salons with Telegram?~~ → +$15/month (covers Premium + margin)
3. ~~How to handle cross-platform context?~~ → Separate context per platform

---

## Lessons Learned

(Will be updated during implementation)

---

## Session Log

### Session 1 (2025-11-29)
- Created plan with web-research-specialist agent
- Designed architecture based on WhatsApp implementation
- Created plan document and context file
- Ready for approval to start implementation

### Session 2 (2025-11-29)
- Started implementation before /dev-docs (stopped to fix process)
- **Completed:**
  - `src/integrations/telegram/` directory created
  - grammY installed (52 packages)
  - Telegram config added to `src/config/index.js`
  - `.env.example` updated with Telegram vars
  - `src/integrations/telegram/telegram-bot.js` created (full grammY client)
  - `migrations/20251129_create_telegram_tables.sql` created
- **Next:** Continue with telegram-manager.js

### Session 3 (2025-11-29) - Plan Review Fixes
- **Trigger:** Used plan-reviewer agent to review the plan
- **Issues Found:**
  1. CRITICAL: Missing `addReminder()` method in message-queue.js
  2. HIGH: FK reference error (`companies(company_id)` → `companies(id)`)
  3. HIGH: No company ID mapping strategy defined
  4. MEDIUM: No rollback strategy
  5. MEDIUM: 24-hour activity window not addressed for reminders
  6. MEDIUM: Rate limiting implementation unclear
  7. MEDIUM: Context key migration plan missing
  8. LOW: TelegramConnectionRepository not created
- **All Issues Fixed:**
  - Added `addReminder()` method (also fixes existing WhatsApp reminder bug!)
  - Fixed FK in migration
  - Added `defaultCompanyId` to config (MVP single-company mode)
  - Added 6 new sections to plan (Rollback, Company Mapping, 24h Window, Rate Limiting, Context Migration)
  - Created TelegramConnectionRepository with full CRUD
- **Plan Status:** ✅ READY FOR IMPLEMENTATION
- **Next:** Continue with Phase 1.4 (telegram-manager.js)

### Session 5 (2025-11-29) - Phase 2 Complete! 🎉
- **Phase 2.1 - Context Service:**
  - Updated `context-service-v2.js` with platform parameter
  - All 13 public methods now accept `options.platform`
  - Key format: `prefix:companyId:platform:phone`
  - Default platform: 'whatsapp' for backward compatibility

- **Phase 2.2 - Message Queue:**
  - Documented job data structure with platform-specific fields
  - Added platform to `addMessage()` method

- **Phase 2.3 - AI Admin v2:**
  - Added platform to `processMessage()` options
  - Updated `context-manager-v2.js` with platform parameter
  - Context object now includes platform

- **Phase 2.4 - Reminders:**
  - booking-monitor already WhatsApp-only
  - Added explicit platform to context updates
  - Telegram reminders deferred to Phase 3

- **Phase 2.5 - Calendar Invites:**
  - Already supports platform in options
  - No changes needed

- **Result:** Phase 2 complete in 1.75 hours (vs 40 hours estimated = **96% faster**)
- **Cumulative:** Phase 1+2 in 12.25 hours (vs 80 hours estimated = **85% faster**)
- **Next:** Phase 3 - Production & Monitoring (Deployment, Alerts, Documentation)

### Session 4 (2025-11-29) - Phase 1 Complete! 🎉
- **Phase 1.4 - Telegram Manager:**
  - Created `telegram-manager.js` (420 lines)
  - Connection cache with 5-min TTL
  - Event handlers for bot events
  - Full CRUD via repository
  - Cache warmup on startup

- **Phase 1.5 - API Routes:**
  - Created `webhooks/telegram.js` (webhook handler with secret verification)
  - Created `routes/telegram-management.js` (7 endpoints)
  - Registered in `api/index.js`
  - All endpoints have rate limiting

- **Phase 1.6 - Worker Integration:**
  - Created `telegram-api-client.js` (HTTP client for workers)
  - Modified `message-worker-v2.js`:
    - Added platform detection from job data
    - Added `sendMessage()` and `sendReaction()` helper methods
    - Updated all message sending for multi-platform support
    - Updated logging with platform awareness
  - Created `telegram/index.js` module exports

- **Result:** Phase 1 complete in 10.5 hours (vs 40 hours estimated = **74% faster**)
- **Next:** Phase 2 - AI Integration (Context service, Queue, AI Admin v2)

---

## Handoff Notes (Last Updated: 2025-11-29)

### Current State
**Phase 1: COMPLETE ✅** - All core infrastructure committed.
**Phase 2: COMPLETE ✅** - All AI integration committed.
**Ready for:** Phase 3 - Production & Monitoring

### Commits Made
1. **Phase 1 commit:** `7e28c9b feat(telegram): Phase 1 - Core infrastructure complete`
2. **Phase 2 commit:** `a845b91 feat(telegram): Phase 2 - AI Integration with platform support`

### Before Deployment (Phase 3)
1. **Run migration on production:**
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
   cd /opt/ai-admin
   psql $DATABASE_URL < migrations/20251129_create_telegram_tables.sql
   ```

2. **Create bot via @BotFather:**
   - Create new bot
   - Enable Business Mode
   - Get bot token

3. **Set environment variables:**
   ```
   TELEGRAM_ENABLED=true
   TELEGRAM_BOT_TOKEN=<from @BotFather>
   TELEGRAM_WEBHOOK_SECRET=<generate random>
   TELEGRAM_DEFAULT_COMPANY_ID=962302
   ```

4. **Configure Nginx for webhook:**
   ```nginx
   location /webhook/telegram {
     proxy_pass http://localhost:3000;
     # Verify webhook secret
   }
   ```

5. **Set webhook URL:**
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://your-domain.com/webhook/telegram" \
     -d "secret_token=<WEBHOOK_SECRET>"
   ```

### Next Phase (Phase 3: Production & Monitoring)
Start with `telegram-integration-tasks.md` section "Phase 3: Production & Monitoring":
1. Deployment configuration (PM2, Nginx)
2. Monitoring & alerts (Prometheus, Grafana)
3. Error handling (custom error classes)
4. Documentation (user guide, API docs)

### Key Files to Read First
- `dev/active/telegram-integration/telegram-integration-plan.md` - Full plan with all sections
- `src/integrations/telegram/telegram-manager.js` - Main orchestrator
- `src/services/context/context-service-v2.js` - Platform-aware context

### Important Decisions Made
1. **MVP Single Company Mode** - Use `TELEGRAM_DEFAULT_COMPANY_ID` instead of complex mapping
2. **24-hour window** - Graceful degradation with fallback to WhatsApp
3. **Connection cache** - 5-min TTL to reduce DB lookups
4. **Platform detection** - Via `platform` field in job data, defaults to 'whatsapp'
5. **Context separation** - Each platform has separate Redis keys (`dialog:962302:telegram:123456789`)

---

## Quick Resume (for next session)

```bash
# Current state: Phase 1+2 COMPLETE, Phase 3 PENDING
# All code committed, working tree clean

# Read these files to resume:
cat dev/active/telegram-integration/telegram-integration-tasks.md | head -n 100
cat dev/active/telegram-integration/telegram-integration-context.md | head -n 50

# Next action: Start Phase 3.1 (Deployment Configuration)
# - Create standalone bot service for PM2
# - Configure Nginx for webhook
# - Run migration on production
# - Set environment variables
```

### What's Complete
- ✅ Phase 1: Core Infrastructure (10.5h)
- ✅ Phase 2: AI Integration (1.75h)
- **Total: 12.25h actual vs 80h estimated = 85% faster**

### What's Next (Phase 3)
1. Run migration: `psql $DATABASE_URL < migrations/20251129_create_telegram_tables.sql`
2. Create bot via @BotFather (manual)
3. Set env vars: TELEGRAM_ENABLED, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
4. Configure Nginx webhook location
5. Set webhook URL via Telegram API
6. Test end-to-end flow
