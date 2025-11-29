# Telegram Integration Plan - Technical Review

**Reviewer:** Senior Technical Plan Reviewer (Claude)
**Date:** 2025-11-29
**Plan Version:** Initial Draft
**Overall Assessment:** **NEEDS REVISION** (7/10 - Good foundation, fixable issues)

---

## Executive Summary

The Telegram Business Bot integration plan is well-structured and leverages the correct technology choices. The decision to use Telegram Business Bot over userbot is sound. However, the review has identified several critical issues that must be addressed before implementation, along with gaps in the current implementation that need resolution.

**Key Findings:**
- 1 Critical Issue (blocking)
- 3 High-Priority Issues (must fix)
- 5 Medium-Priority Concerns (should address)
- 8 Strengths identified

---

## 1. Strengths

### 1.1 Correct Technology Choice
- **Telegram Business Bot API** is the right approach (zero ban risk, official feature)
- **grammY** framework is well-maintained, TypeScript-friendly, and has excellent documentation
- Messages appear from salon account (not bot) - matching WhatsApp UX

### 1.2 Sound Architecture
- Parallel channel design (WhatsApp + Telegram) is clean
- Shared AI logic with platform-aware routing
- Follows existing codebase patterns from WhatsApp integration

### 1.3 Database Schema Quality
- Migration file (`migrations/20251129_create_telegram_tables.sql`) is well-designed
- Proper indexes defined
- Trigger for `updated_at` auto-update
- Conditional ALTER statements for existing tables

### 1.4 Bot Client Implementation
- `telegram-bot.js` (485 lines) is comprehensive
- Proper error handling with GrammyError/HttpError
- Health check implementation
- Metrics collection built-in
- Simple event emitter for loose coupling

### 1.5 Good Planning Structure
- Clear phases with time estimates
- Task breakdown is granular
- Context tracking file for continuity

---

## 2. Critical Issues (BLOCKING)

### 2.1 Missing `addReminder()` Method in MessageQueue

**Location:** `src/queue/message-queue.js`
**Severity:** CRITICAL - Will cause runtime errors

**Problem:**
The `message-worker-v2.js` calls `messageQueue.addReminder()` (lines 487, 499) but this method **does not exist** in `message-queue.js`. The plan assumes reminders work but they are broken in the current codebase.

```javascript
// src/workers/message-worker-v2.js:487
await messageQueue.addReminder({
  type: 'day_before',
  booking,
  phone
}, dayBefore);
```

**Impact:**
- Reminders do not work for WhatsApp (existing bug)
- Plan cannot add platform awareness to something that doesn't function
- Phase 2.4 "Reminder System Updates" is blocked

**Recommendation:**
1. **Fix existing bug first** - Implement `addReminder()` method in `message-queue.js`
2. Add platform parameter when implementing
3. Create reminder worker if not exists

```javascript
// Required implementation in message-queue.js
async addReminder(data, scheduledTime, options = {}) {
  const queueName = 'reminders';
  const queue = this.getQueue(queueName);
  const delay = scheduledTime.getTime() - Date.now();

  return queue.add('send-reminder', {
    ...data,
    platform: data.platform || 'whatsapp',
    scheduledFor: scheduledTime.toISOString()
  }, {
    delay: Math.max(0, delay),
    ...options
  });
}
```

---

## 3. High-Priority Issues (MUST FIX)

### 3.1 Database Schema Mismatch

**Problem:**
The Telegram migration references `companies(company_id)` but the existing schema uses `companies(id)` with a separate `yclients_company_id` column.

**In Telegram migration:**
```sql
CONSTRAINT fk_telegram_company
  FOREIGN KEY (company_id)
  REFERENCES companies(company_id)  -- WRONG!
```

**In existing schema:**
```sql
CREATE TABLE companies (
  id INTEGER PRIMARY KEY,  -- This is the PK
  yclients_company_id INTEGER UNIQUE NOT NULL,  -- This is YClients ID
```

**Fix Required:**
```sql
CONSTRAINT fk_telegram_company
  FOREIGN KEY (company_id)
  REFERENCES companies(id)  -- Correct reference
```

---

### 3.2 Company ID Resolution Gap

**Problem:**
The Telegram Bot receives `business_connection_id` but the plan does not define how to map this to `company_id`.

**In telegram-bot.js:**
```javascript
// Line 251-268: queueMessageForProcessing
const queueData = {
  platform: 'telegram',
  from: data.fromId.toString(),
  // companyId is MISSING - how do we get it?
  // ...
};
```

**Missing Logic:**
1. When salon connects (`business_connection` event) - how do we know which company?
2. The `telegram_business_connections` table stores `company_id` but...
3. Who sets `company_id` when the connection is made?

**Recommendation:**
Add one of these approaches to the plan:

**Option A: Admin Portal Integration**
- Admin creates Telegram connection in portal
- System generates unique connection code
- Salon owner sends code to bot before connecting
- Bot maps connection to company

**Option B: Telegram Username Mapping**
- Pre-configure `telegram_username` -> `company_id` mapping in admin
- When `business_connection` event arrives, lookup by username

**Option C: Single Company Mode (Quick Start)**
- For MVP, hardcode `TELEGRAM_COMPANY_ID` in config
- Only works for single-company setup

---

### 3.3 24-Hour Activity Window Not Addressed for Reminders

**Problem:**
Telegram Business Bot can only reply to active chats (24-hour window). The plan mentions this but doesn't address how reminders will work.

**Scenario:**
1. Customer books appointment via Telegram
2. Bot stores booking and schedules reminder
3. 24 hours pass with no customer activity
4. Bot tries to send reminder - **FAILS** (inactive chat)

**Recommendation:**
Add fallback strategy to the plan:
1. Check `can_reply` flag before sending reminder
2. If false, attempt to send reminder via alternative channel (WhatsApp if available)
3. Or: Schedule a "wake-up" interaction before reminder needed
4. Document this limitation for salon owners

---

## 4. Medium-Priority Concerns (SHOULD ADDRESS)

### 4.1 Repository Pattern Missing for Telegram

**Current State:**
The project uses repository pattern (`src/repositories/`) for database access. There are 14+ repositories but none for Telegram.

**Plan mentions (task 1.3):**
- [ ] Create repository `src/repositories/telegram-connection-repository.js`

**Issue:**
The task is noted but no specification is provided. Should include:
- `findByCompanyId(companyId)`
- `findByBusinessConnectionId(connectionId)`
- `createConnection(data)`
- `updateConnection(id, data)`
- `deactivateConnection(companyId)`
- `getAllActiveConnections()`

---

### 4.2 No Rollback Strategy Defined

**Missing:**
The plan lacks a rollback strategy for each phase.

**Recommendation:**
Add to plan:

```markdown
### Rollback Strategy

**Phase 1 Rollback:**
1. Set `TELEGRAM_ENABLED=false` in .env
2. Remove Telegram webhook: `bot.api.deleteWebhook()`
3. Drop migration if needed: `DROP TABLE telegram_business_connections;`

**Phase 2 Rollback:**
1. Revert context service changes (keep backup: context-service-v2.backup.js exists)
2. Revert worker changes
3. Remove platform flags from queue jobs

**Phase 3 Rollback:**
1. Stop PM2 Telegram process
2. Remove Nginx webhook config
3. Disable monitoring
```

---

### 4.3 Rate Limiting Implementation Unclear

**Plan mentions:**
- Task 1.5: "Add rate limiting"
- Context notes: "1 message/second per user, 30 messages/second globally"

**Missing:**
How to implement rate limiting is not specified. grammY has middleware but configuration details are absent.

**Recommendation:**
Add implementation detail:

```javascript
// Use grammY's ratelimiter middleware
const { autoRetry } = require('@grammyjs/auto-retry');
const { limit } = require('@grammyjs/ratelimiter');

bot.api.config.use(autoRetry());
bot.use(limit({
  timeFrame: 1000,
  limit: 1,
  onLimitExceeded: async (ctx) => {
    logger.warn(`Rate limit exceeded for ${ctx.from.id}`);
  }
}));
```

---

### 4.4 Context Key Structure Change May Break Existing Data

**Proposed Change (Phase 2.1):**
```javascript
// Current
_getKey(type, companyId, phone) {
  return `${prefix}${companyId}:${normalizedPhone}`;
}

// Proposed
_getKey(type, companyId, phone, platform = 'whatsapp') {
  return `${prefix}${companyId}:${platform}:${normalizedPhone}`;
}
```

**Problem:**
This changes the Redis key structure. Existing WhatsApp context data will become orphaned.

**Recommendation:**
Add migration step:
1. Default parameter maintains backward compatibility
2. Add script to migrate existing keys OR
3. Accept that WhatsApp context will reset (document this)

---

### 4.5 Webhook Security Concerns

**Current Implementation:**
```javascript
this.webhookHandler = webhookCallback(this.bot, 'express', {
  secretToken: config.telegram.webhookSecret
});
```

**Missing from Plan:**
1. How `TELEGRAM_WEBHOOK_SECRET` is generated
2. Nginx configuration to validate secret header
3. IP filtering (Telegram webhook IPs)

**Recommendation:**
Add to Phase 3.1:
```markdown
- [ ] Generate secure webhook secret: `openssl rand -hex 32`
- [ ] Add IP filtering in Nginx (optional, Telegram IPs change)
- [ ] Verify X-Telegram-Bot-Api-Secret-Token header in Express
```

---

## 5. Missing Considerations

### 5.1 Multi-Company Support
The current codebase is single-company (`config.yclients.companyId`). The plan doesn't address how Telegram connections map to multiple companies.

### 5.2 Message Format Differences
WhatsApp supports rich formatting (bold, italic, lists) with different syntax than Telegram. The plan mentions "Abstract message formatting layer" in risks but doesn't detail implementation.

### 5.3 Media Handling
WhatsApp integration handles photos, audio, documents. Telegram Business messages can include media but the plan focuses only on text.

### 5.4 Error Messages Localization
`src/utils/error-messages.js` exists but may need Telegram-specific variants.

### 5.5 Analytics/Reporting
No consideration for tracking Telegram vs WhatsApp conversion rates, response times, etc.

---

## 6. Time Estimate Review

| Phase | Estimated | Assessment |
|-------|-----------|------------|
| 1.1 Project Setup | 4h | **Accurate** - Already 75% done |
| 1.2 Bot Client | 8h | **Already done** - Reduce to 0h (complete) |
| 1.3 Database | 4h | **Underestimated** - Need repository too (6h) |
| 1.4 Manager | 8h | **Accurate** |
| 1.5 API Routes | 8h | **Accurate** |
| 1.6 Worker | 8h | **Underestimated** - Must fix addReminder first (12h) |
| 2.1-2.6 AI Integration | 40h | **Accurate** - May need +4h for testing |
| 3.1-3.5 Production | 20h | **Accurate** |

**Revised Total:** 98-106h (vs 100h estimated) - Reasonable

---

## 7. Risk Matrix

| Risk | Likelihood | Impact | Score | Mitigation |
|------|------------|--------|-------|------------|
| addReminder bug blocks reminders | 100% | Critical | 10 | Fix before Phase 2.4 |
| FK constraint error on migration | 100% | High | 8 | Fix SQL reference |
| Company ID resolution fails | High | Critical | 9 | Define mapping strategy |
| 24h window breaks reminders | Medium | Medium | 5 | Document + fallback |
| Context key migration | Medium | Medium | 4 | Default parameter |
| Rate limiting not implemented | Low | Medium | 3 | Use grammY middleware |
| Telegram API changes | Low | Medium | 3 | grammY handles updates |

---

## 8. Specific Recommendations

### Immediate Actions (Before Implementation)

1. **Fix `addReminder()` method** - Add to `message-queue.js`
2. **Fix FK reference** - Change `companies(company_id)` to `companies(id)`
3. **Define company mapping strategy** - Choose Option A, B, or C

### Plan Updates Required

1. Add rollback strategy section
2. Add company ID resolution flow
3. Add 24-hour window handling for reminders
4. Add rate limiting implementation details
5. Add context key migration plan

### Implementation Order Adjustment

```
Original Order:
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 2.x → 3.x

Recommended Order:
0.0 Fix addReminder() (pre-requisite)
1.1 → 1.3 (fix FK) → 1.3b (repository) → 1.4 → 1.2 (done) → 1.5 → 1.6 → 2.x → 3.x
```

---

## 9. Research Findings

### Telegram Business Bot API (verified)
- Launched March 2024
- Requires Telegram Premium ($4.99/month)
- `business_connection` event structure confirmed
- `business_message` event structure confirmed
- 24-hour activity window is real limitation

### grammY Framework (verified)
- v1.x stable, actively maintained
- TypeScript support
- Webhook handling works with Express
- `webhookCallback()` signature correct
- Rate limiter available as `@grammyjs/ratelimiter`

### Current Codebase Analysis
- Repository pattern used (14 repositories)
- Redis key structure: `prefix:companyId:phone`
- BullMQ for queuing
- PM2 for process management
- Nginx for reverse proxy

---

## 10. Conclusion

**Overall Assessment:** NEEDS REVISION

**Verdict:** The plan is 70% ready for implementation. The core architecture is sound, and the technology choices are correct. However, three issues must be resolved before starting:

1. **CRITICAL:** Fix `addReminder()` method (existing bug)
2. **HIGH:** Fix database FK reference
3. **HIGH:** Define company ID mapping strategy

Once these are addressed, the plan can proceed with high confidence of success.

**Estimated Delay for Fixes:** 4-6 hours additional planning + 2-4 hours implementation

**Recommendation:** Revise plan to address critical/high issues, then proceed to implementation.

---

*Review completed: 2025-11-29*
*Reviewer: Senior Technical Plan Reviewer*
