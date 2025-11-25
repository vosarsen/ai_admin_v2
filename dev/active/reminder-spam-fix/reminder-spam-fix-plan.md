# Plan: Reminder Spam Fix - Full PostgreSQL Migration

**Project:** reminder-spam-fix
**Created:** 2025-11-25
**Last Updated:** 2025-11-25
**Status:** Ready for Deploy (Phases 1-3 Complete, Code Ready)
**Priority:** CRITICAL (Production Bug)
**Estimated:** 6 hours

---

## Executive Summary

Production system sent 12 reminder notifications in 11 minutes to a single client instead of 1. Root cause: incomplete migration from Supabase to PostgreSQL left duplicate checking completely disabled. This plan migrates the notification system fully to Timeweb PostgreSQL with proper duplicate prevention.

---

## Current State Analysis

### Problem Evidence
- Client "Ирина" received 12 messages from 13:33 to 13:44 (11 minutes)
- All messages identical: reminder about booking at 15:15
- Expected: 1 message

### Root Cause (2 Issues)

1. **Hardcoded Empty Array** (`src/services/booking-monitor/index.js:635`)
   ```javascript
   // TODO: Migrate to use booking_notifications repository
   const sentReminders = [];  // DISABLES ALL DUPLICATE CHECKING!
   ```
   Note: supabase IS imported correctly on line 3. The import works for other operations.
   The ONLY issue is this hardcoded empty array that bypasses the duplicate check.

2. **Unused Mutex** (`src/services/booking-monitor/index.js:40`)
   ```javascript
   this.isChecking = false;  // Declared but never checked in checkBookings()
   ```

### Affected System
- **Service:** booking-monitor (runs every 60 seconds)
- **Database:** booking_notifications table
- **Impact:** All clients with upcoming bookings receive spam

---

## Proposed Future State

### Architecture After Migration

```
booking-monitor/index.js
    ├── BookingNotificationRepository (NEW)
    │   ├── findRecent() - Check duplicates
    │   ├── isDuplicate() - Helper
    │   ├── create() - Save notification
    │   └── findSentToday() - For reminder check
    │
    ├── Existing Repositories (already migrated)
    │   ├── BookingRepository
    │   ├── CompanyRepository
    │   ├── ServiceRepository
    │   └── StaffRepository
    │
    └── Timeweb PostgreSQL
        └── booking_notifications table
            └── UNIQUE(record_id, type, company_id, date)
```

### Duplicate Prevention Layers

1. **Database Level:** UNIQUE constraint prevents same notification twice per day
2. **Application Level:** `findSentToday()` checks before sending
3. **Process Level:** Mutex prevents overlapping checks

---

## Implementation Phases

### Phase 1: Database Schema (45 min) ✅ COMPLETE

**Goal:** Create `booking_notifications` table in Timeweb PostgreSQL

**Tasks:**
- [x] Create SQL migration file
- [x] Create table with proper columns
- [x] Add `notification_date` column for UNIQUE constraint
- [x] Create composite UNIQUE index
- [x] Create helper indexes

**SQL Applied:**
```sql
CREATE TABLE booking_notifications (
    id SERIAL PRIMARY KEY,
    yclients_record_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    phone VARCHAR(20) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'sent',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notification_date DATE DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX idx_bn_unique_notification
  ON booking_notifications(yclients_record_id, notification_type, company_id, notification_date);
```

---

### Phase 2: Repository Layer (1.5 hours)

**Goal:** Create BookingNotificationRepository following project patterns

**Files to Create:**
1. `src/repositories/BookingNotificationRepository.js`
2. `tests/repositories/BookingNotificationRepository.test.js`

**Files to Modify:**
1. `src/repositories/index.js` - Add export

**Repository Methods:**

| Method | Purpose | Sentry |
|--------|---------|--------|
| `findRecent(recordId, windowMs, types)` | Query recent notifications | Yes |
| `isDuplicate(recordId, type, windowMs)` | Check if already sent | Via findRecent |
| `create(data)` | INSERT notification | Yes |
| `findSentToday(recordId, types)` | Get today's notifications | Via findRecent |

**Key Implementation Details:**
- Extend BaseRepository
- Use raw INSERT (not upsert) for create()
- Handle duplicate key error (code 23505) gracefully
- Include Sentry tracking in all methods
- Set `notification_date` = CURRENT_DATE on insert

---

### Phase 3: Service Integration (2.5 hours)

**Goal:** Replace all 11 Supabase calls in booking-monitor with repositories

**Supabase Calls to Replace:**

| Line | Operation | Current | Replace With |
|------|-----------|---------|--------------|
| 3 | import | `const supabase = require(...)` | DELETE |
| 347-352 | SELECT | booking_notifications | `notificationRepo.findRecent()` |
| 394-403 | INSERT | booking_notifications | `notificationRepo.create()` |
| 485-491 | SELECT | companies | `companyRepo.findById(companyId)` |
| 507-516 | INSERT | booking_notifications | `notificationRepo.create()` |
| 531-545 | SELECT | companies, services | `companyRepo.findById()`, `serviceRepo.findById()` |
| 632-647 | SELECT (disabled!) | booking_notifications | `notificationRepo.findSentToday()` |
| 702-707 | SELECT | companies | `companyRepo.findById(companyId)` |
| 748-760 | SELECT | services | `serviceRepo.findById(serviceId, companyId)` |
| 779-788 | SELECT | staff | `staffRepo.findById(staffId, companyId)` |
| 835-844 | INSERT | booking_notifications | `notificationRepo.create()` |

**Additional Changes:**

1. **Update imports** (top of file):
```javascript
const postgres = require('../../database/postgres');
const {
  BookingRepository,
  BookingNotificationRepository,
  CompanyRepository,
  ServiceRepository,
  StaffRepository
} = require('../../repositories');
// REMOVE: const supabase = require('../../database/supabase');
```

2. **Update constructor:**
```javascript
constructor() {
  // ... existing ...
  this.notificationRepo = new BookingNotificationRepository(postgres.pool);
  this.companyRepo = new CompanyRepository(postgres.pool);
  this.serviceRepo = new ServiceRepository(postgres.pool);
  this.staffRepo = new StaffRepository(postgres.pool);
}
```

3. **Add mutex to checkBookings():**
```javascript
async checkBookings() {
  if (this.isChecking) {
    logger.debug('⏭️ Skipping - previous check running');
    return;
  }
  this.isChecking = true;
  try {
    // ... existing code ...
  } finally {
    this.isChecking = false;
  }
}
```

4. **Fix duplicate check (lines 630-650):**
```javascript
// REMOVE: const sentReminders = [];
let sentReminders = [];
try {
  sentReminders = await this.notificationRepo.findSentToday(
    recordId,
    ['reminder_day_before', 'reminder_2hours']
  );
} catch (error) {
  logger.error(`Failed to check sent reminders:`, error);
  Sentry.captureException(error);
}
```

---

### Phase 4: Testing (45 min)

**Goal:** Verify fix works correctly

**Tests:**
1. Unit tests for BookingNotificationRepository
2. Server logs monitoring
3. Database data verification
4. Smoke test on test phone (89686484488 ONLY!)

**Verification Queries:**
```sql
-- Check notifications are being saved
SELECT notification_type, COUNT(*), MAX(sent_at)
FROM booking_notifications
GROUP BY notification_type;

-- Check no duplicates (should return 0 rows)
SELECT yclients_record_id, notification_type, COUNT(*)
FROM booking_notifications
WHERE sent_at > NOW() - INTERVAL '24 hours'
GROUP BY yclients_record_id, notification_type
HAVING COUNT(*) > 1;
```

---

### Phase 5: Deploy (30 min)

**Goal:** Deploy to production and verify

**Steps:**
1. Commit with conventional message
2. Push to main
3. Deploy to server
4. Monitor logs for 30 minutes
5. Verify no duplicate notifications

**Commit Message:**
```
feat: migrate booking_notifications to PostgreSQL

- Create booking_notifications table in Timeweb PostgreSQL
- Add BookingNotificationRepository with Sentry tracking
- Replace all supabase calls in booking-monitor with repositories
- Add mutex to prevent overlapping checks
- Add UNIQUE constraint for duplicate prevention at DB level

Fixes reminder spam issue (12 messages instead of 1)
```

---

## Risk Assessment

### High Risk
- **Database Connection Failure:** If PostgreSQL unavailable, no reminders sent
  - Mitigation: Fallback logs + Sentry alerts
  - Rollback: Revert commit in <1 minute

### Medium Risk
- **Repository Bug:** Logic error in new code
  - Mitigation: Unit tests before deploy
  - Rollback: git revert + pm2 restart

### Low Risk
- **Performance:** New indexes slow down queries
  - Mitigation: Partial index for recent records
  - Accept: Table small (<10k rows)

---

## Rollback Plan

### Quick Rollback (< 1 min)
```bash
git revert HEAD
git push origin main
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "cd /opt/ai-admin && git pull && pm2 restart ai-admin-booking-monitor"
```

### Emergency Stop
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 stop ai-admin-booking-monitor"
# No reminders sent, but no spam either
```

---

## Success Metrics

1. **Zero duplicate reminders** for 24 hours after deploy
2. **All notifications saved** to PostgreSQL (visible in DB)
3. **No Sentry errors** from BookingNotificationRepository
4. **Mutex working:** Logs show "Skipping - previous check running" when applicable

---

## Files Summary

| File | Action | Status |
|------|--------|--------|
| `scripts/database/create-booking-notifications-timeweb.sql` | Create | ✅ Done |
| `src/repositories/BookingNotificationRepository.js` | Create | Pending |
| `src/repositories/index.js` | Modify | Pending |
| `tests/repositories/BookingNotificationRepository.test.js` | Create | Pending |
| `src/services/booking-monitor/index.js` | Modify (11 places) | Pending |

---

## Timeline

| Phase | Estimated | Actual | Status |
|-------|-----------|--------|--------|
| 1. Database Schema | 45 min | 15 min | ✅ Complete |
| 2. Repository Layer | 1.5 hours | 45 min | ✅ Complete |
| 3. Service Integration | 2.5 hours | 60 min | ✅ Complete |
| 4. Testing | 45 min | - | Pending |
| 5. Deploy | 30 min | - | Pending |
| **Total** | **6 hours** | **~2 hours** | **Ready for Deploy** |
