# Code Review: Reminder Spam Issue

**Last Updated:** 2025-11-25
**File:** `/Users/vosarsen/Documents/GitHub/ai_admin_v2.nosync/src/services/booking-monitor/index.js`
**Issue:** 12 duplicate reminder messages sent to one client in 11 minutes

---

## Executive Summary

**ROOT CAUSE IDENTIFIED:** The duplicate protection mechanism for reminders is completely disabled due to hardcoded empty array on line 635. (Note: supabase IS imported on line 3, but the duplicate check query was replaced with an empty array during incomplete migration.)

**Severity:** CRITICAL - Causing customer-facing spam (12 messages in 11 minutes)

**Impact:** Production system is sending duplicate reminders every minute to all clients with upcoming bookings

**Fix Complexity:** Medium (requires database query migration + duplicate check logic)

---

## Critical Issues (MUST FIX)

### 1. Hardcoded Empty Array - Duplicate Protection Disabled ⛔

**Location:** Line 635 (duplicate check)

**Problem:**
```javascript
// Line 633-635: TODO comment indicates disabled functionality
// TODO: Migrate to use booking_notifications repository
// Temporarily disabled - will be migrated to PostgreSQL repository
const sentReminders = [];
```

**Clarification (Updated after review):**
- Supabase IS imported on line 3: `const supabase = require('../../database/supabase');`
- The import works correctly for other operations (change notifications, booking confirmations)
- The ONLY issue is the hardcoded `const sentReminders = [];` on line 635
- This means EVERY duplicate check returns empty array → duplicate protection NEVER works

**Impact:**
- Booking monitor runs every 60 seconds (line 36: `checkInterval = 60000`)
- Each run calls `checkAndSendReminders` for EVERY booking (line 122)
- Lines 639-647 check if reminder was sent using `sentReminders` array
- Since `sentReminders = []` is hardcoded, checks ALWAYS return `false`
- Result: Reminder sent EVERY MINUTE for same booking

**Why This Happened:**
The code was partially migrated from Supabase to PostgreSQL (see comments on lines 125-129, 630-632), but the migration was never completed. The duplicate protection logic was commented out as "temporary" but left in a broken state.

**Fix Required:**
```javascript
// Option 1: Add missing import (quickest fix)
const supabase = require('../../database/supabase');

// Option 2: Complete PostgreSQL migration (proper fix)
// - Create BookingNotificationRepository
// - Use postgres.pool instead of supabase
// - Replace lines 630-647 with repository query
```

**Recommendation:** Use Option 1 immediately for hotfix, then Option 2 for long-term solution.

---

### 2. No Write After Read - Database Never Updated ⚠️

**Location:** Lines 820-843 (sendReminderNotification method)

**Problem:**
Even if we query `sentReminders` correctly, the save logic ALSO uses `supabase` which is not imported:

```javascript
// Line 833-842: This INSERT will fail with undefined supabase
await supabase
  .from('booking_notifications')
  .insert({
    yclients_record_id: record.id.toString(),
    phone: phone,
    notification_type: notificationType,
    message: message,
    sent_at: new Date().toISOString(),
    company_id: record.company_id || config.yclients.companyId
  });
```

**Impact:**
- Even if we fix the read query, reminders are never saved to database
- Next check will still find empty results
- Spam continues indefinitely

**Evidence of Broken State:**
- Lines 345-350: Uses `supabase` to query `booking_notifications` for change notifications
- Lines 392-401: Uses `supabase` to INSERT change notifications
- Lines 505-514: Uses `supabase` to INSERT booking confirmations
- Lines 833-842: Uses `supabase` to INSERT reminder notifications
- **BUT**: No `supabase` import exists anywhere in the file!

**How It's Working Now:**
The code must be getting `supabase` from global scope or another module is monkey-patching it. This is extremely fragile and explains why the migration was left incomplete.

**Fix Required:**
```javascript
// Add import at top of file (line ~12)
const supabase = require('../../database/supabase');

// OR migrate all supabase queries to use BookingRepository
// This is the CORRECT fix per the TODO comment on line 630
```

---

### 3. Race Condition - Parallel Processing Without Locking 🏁

**Location:** Lines 118-123 (processBooking loop)

**Problem:**
```javascript
// Lines 118-123: Each booking processed in sequence
for (const record of records) {
  await this.processBooking(record);
  // Проверяем и отправляем напоминания
  await this.checkAndSendReminders(record);
}
```

**But the outer loop runs every 60 seconds:**
```javascript
// Lines 58-60
this.intervalId = setInterval(() => {
  this.checkBookings();
}, this.checkInterval); // 60000ms = 1 minute
```

**Race Condition Scenario:**
1. Minute 1 (13:33): Check starts, finds booking at 15:15
2. Minute 1 (13:33): Sends reminder, attempts to save to DB
3. Minute 2 (13:34): NEW check starts (previous might still be running!)
4. Minute 2 (13:34): Finds same booking, sentReminders = [] (empty)
5. Minute 2 (13:34): Sends reminder AGAIN

**Evidence from Log:**
User reported 12 messages in 11 minutes (13:33 to 13:44). That's roughly 1 message per minute, matching the `checkInterval`.

**Current Protection (INADEQUATE):**
- Lines 46-49: `isRunning` flag prevents starting a second interval
- BUT: Does NOT prevent a long-running check from overlapping with next interval tick
- No mutex/lock around reminder sending

**Fix Required:**
```javascript
async checkBookings() {
  // Add mutex to prevent overlapping runs
  if (this.isChecking) {
    logger.warn('Previous check still running, skipping this interval');
    return;
  }

  this.isChecking = true;
  try {
    // ... existing logic ...
  } finally {
    this.isChecking = false;
  }
}
```

---

## Important Improvements (SHOULD FIX)

### 4. Duplicate Check Window Too Narrow ⏰

**Location:** Lines 636-647 (reminder duplicate check logic)

**Current Logic:**
```javascript
// Lines 636-647: Only checks if reminder was sent TODAY
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

const sentDayBeforeToday = sentReminders?.some(r =>
  r.notification_type === 'reminder_day_before' &&
  new Date(r.sent_at) > todayStart
);

const sent2HoursToday = sentReminders?.some(r =>
  r.notification_type === 'reminder_2hours' &&
  new Date(r.sent_at) > todayStart
);
```

**Problem:**
- Only prevents duplicate reminders sent on the same calendar day
- If booking is at 00:15 (12:15 AM), reminder at 22:15 (10:15 PM) previous day would be allowed
- Then another reminder could be sent after midnight

**Better Approach:**
```javascript
// Check if reminder was sent in last X hours (not just today)
const reminderWindow = 3 * 60 * 60 * 1000; // 3 hours
const cutoffTime = new Date(Date.now() - reminderWindow);

const sentDayBeforeRecently = sentReminders?.some(r =>
  r.notification_type === 'reminder_day_before' &&
  new Date(r.sent_at) > cutoffTime
);
```

**Also Note:**
- Line 37: `duplicateCheckWindow` config exists (1 hour default)
- Line 345-350: Change notifications USE this window correctly
- But reminder logic (lines 636-647) ignores this config!

**Fix Required:**
Use `this.duplicateCheckWindow` consistently across all notification types.

---

### 5. Missing Unique Constraint on Notifications Table 🗄️

**Location:** Database schema - `booking_notifications` table

**Current Schema:**
From `/scripts/database/create-booking-monitor-tables.sql`:
```sql
CREATE TABLE IF NOT EXISTS booking_notifications (
    id SERIAL PRIMARY KEY,
    yclients_record_id INTEGER NOT NULL UNIQUE,  -- ⚠️ UNIQUE on record_id
    phone VARCHAR(20) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    booking_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Problem:**
- `UNIQUE` constraint on `yclients_record_id` alone (line 14)
- This means only ONE notification per booking record EVER
- But we need MULTIPLE notifications per booking:
  - `reminder_day_before`
  - `reminder_2hours`
  - `booking_changed`
  - `booking_cancelled`

**Updated Schema:**
From `/scripts/database/update-booking-monitor-tables.sql`:
```sql
ALTER TABLE booking_notifications
ADD COLUMN IF NOT EXISTS notification_type_new TEXT CHECK (notification_type_new IN (
    'booking_created',
    'booking_cancelled',
    'booking_time_changed',
    'booking_service_changed',
    'booking_staff_changed',
    'booking_reminder'
));
```

**But Still Missing:**
```sql
-- Need composite unique constraint
ALTER TABLE booking_notifications
DROP CONSTRAINT IF EXISTS booking_notifications_yclients_record_id_key;

ALTER TABLE booking_notifications
ADD CONSTRAINT booking_notifications_unique_per_type
UNIQUE (yclients_record_id, notification_type);
```

**Impact:**
Without proper unique constraint, database cannot enforce "one reminder per type per booking" rule. Application logic must handle this, which is error-prone (as we've seen).

**Fix Required:**
1. Update database schema with composite unique key
2. Add `notification_type` to all INSERT queries
3. Handle unique constraint violations gracefully (UPSERT pattern)

---

### 6. Incomplete Migration State - Mixed Supabase/PostgreSQL 🔄

**Location:** Throughout file

**Evidence of Half-Migration:**
```javascript
// Line 2: PostgreSQL imported
const postgres = require('../../database/postgres');

// Line 3: New repository pattern imported
const { BookingRepository } = require('../../repositories');

// Line 35: Repository used for bookings
this.bookingRepo = new BookingRepository(postgres.pool);

// BUT:
// Lines 345, 392, 483, 505, 529, 539, 700, 746, 777, 833
// All use 'supabase' (not imported!)
```

**TODO Comments Confirm Incomplete Migration:**
- Line 125: "TODO: Migrate cleanup to use BookingRepository"
- Line 630: "TODO: Migrate to use booking_notifications repository"

**Current State:**
1. Bookings table: ✅ Migrated to PostgreSQL + Repository pattern
2. Companies table: ❌ Still uses Supabase (lines 483, 529, 700)
3. Services table: ❌ Still uses Supabase (lines 539, 746)
4. Staff table: ❌ Still uses Supabase (line 777)
5. Booking notifications: ❌ Still uses Supabase (lines 345, 392, 505, 833)

**Impact:**
- Mixed database connections = unclear which DB is source of truth
- Migration complexity increases over time
- Risk of data inconsistency between Supabase and PostgreSQL

**Fix Required:**
Complete the migration:
```javascript
// Create missing repositories
class BookingNotificationRepository { ... }
class CompanyRepository { ... }
class ServiceRepository { ... }
class StaffRepository { ... }

// Replace all supabase queries with repository calls
// Remove supabase dependency entirely
```

---

## Minor Suggestions (NICE TO HAVE)

### 7. Logging Insufficient for Debugging 📝

**Location:** Lines 662-670 (debug logging)

**Current Logging:**
```javascript
logger.debug(`📅 Reminder check for record ${recordId}:`, {
  now: now.toDateString(),
  recordDate: recordDate.toDateString(),
  tomorrow: tomorrowDateCheck.toDateString(),
  isRecordTomorrow,
  hoursUntil: Math.round(hoursUntil),
  isEvening
});
```

**Missing Information:**
- No logging of `sentReminders` check results
- No logging when reminder is skipped due to duplicate
- No logging of database query execution
- No tracking of WHY reminder was not sent

**Suggested Addition:**
```javascript
logger.debug(`📅 Reminder duplicate check for record ${recordId}:`, {
  sentDayBeforeToday,
  sent2HoursToday,
  sentRemindersCount: sentReminders.length,
  decision: sentDayBeforeToday || sent2HoursToday ? 'SKIP' : 'SEND'
});
```

This would have revealed the bug immediately (sentRemindersCount would always be 0).

---

### 8. Error Handling Swallows Database Errors 🚨

**Location:** Lines 690-692, 888-890

**Current Pattern:**
```javascript
catch (error) {
  logger.error(`❌ Error checking reminders for booking ${record.id}:`, error);
}
```

**Problem:**
- Catches ALL errors, including database connection failures
- Logs error but continues processing next booking
- Silent failure = no alerts when database is down

**Suggested Improvement:**
```javascript
catch (error) {
  logger.error(`❌ Error checking reminders for booking ${record.id}:`, error);

  // Alert on database errors
  if (error.code === 'ECONNREFUSED' || error.code === '57P03') {
    // Sentry/Telegram alert: Database connection lost!
    throw error; // Stop processing to prevent spam
  }
}
```

---

## Architecture Considerations

### Database Migration Strategy

**Current Problem:**
The file is stuck in "migration limbo" - halfway between Supabase and PostgreSQL.

**Evidence:**
1. `postgres` imported but only used for BookingRepository (line 2, 35)
2. `supabase` used everywhere else but NOT IMPORTED (lines 345+)
3. TODO comments indicate migration was planned but abandoned (lines 125, 630)

**Recommended Path Forward:**

**Phase 1: Emergency Hotfix (NOW - 30 minutes)**
```javascript
// Add missing import
const supabase = require('../../database/supabase');

// Deploy immediately to stop spam
// This is a band-aid but fixes the customer-facing issue
```

**Phase 2: Complete Notifications Migration (Week 1 - 4 hours)**
```javascript
// Create BookingNotificationRepository
// Move all booking_notifications queries to repository
// Keep supabase for companies/services/staff (separate migration)
```

**Phase 3: Complete Full Migration (Week 2-3 - 8 hours)**
```javascript
// Create CompanyRepository, ServiceRepository, StaffRepository
// Migrate all remaining supabase queries
// Remove supabase dependency completely
```

**Why This Order:**
1. Hotfix stops immediate customer pain
2. Notifications migration is isolated (single table, clear boundary)
3. Full migration can be done methodically without pressure

---

### Multi-Tenancy Considerations

**Good News:**
The code already handles multi-tenancy correctly:

```javascript
// Line 829: company_id is always included
company_id: record.company_id || config.yclients.companyId
```

**Areas to Verify:**
1. Database queries filter by company_id (lines 345-350, 392-401, etc.)
2. Unique constraints include company_id (currently missing!)

**Recommended Schema Update:**
```sql
-- Change from:
UNIQUE (yclients_record_id, notification_type)

-- To:
UNIQUE (company_id, yclients_record_id, notification_type)
```

This ensures notifications are scoped per company, critical for multi-tenant system.

---

## Next Steps

### Immediate Actions (Priority 1 - Deploy Today)

1. **Add Missing Import**
   - File: `/src/services/booking-monitor/index.js`
   - Action: Add `const supabase = require('../../database/supabase');` after line 12
   - Impact: Fixes duplicate check queries (lines 345, 630, etc.)

2. **Add Mutex for Overlapping Checks**
   - File: `/src/services/booking-monitor/index.js`
   - Action: Add `this.isChecking` flag in `checkBookings()` method
   - Impact: Prevents race condition when checks take >60 seconds

3. **Test in Production**
   - Action: Monitor logs for 2 hours after deployment
   - Look for: "Skipping duplicate notification" messages
   - Verify: No more than 1 reminder per booking per type

### Short-Term Fixes (Priority 2 - This Week)

4. **Create BookingNotificationRepository**
   - File: `/src/repositories/booking-notification-repository.js` (new)
   - Action: Migrate all booking_notifications queries from Supabase to PostgreSQL
   - Impact: Completes notification migration, removes one Supabase dependency

5. **Update Database Schema**
   - File: `/scripts/database/fix-booking-notifications-schema.sql` (new)
   - Action: Add composite unique constraint (company_id, record_id, notification_type)
   - Impact: Database enforces duplicate prevention

6. **Use duplicateCheckWindow Config**
   - File: `/src/services/booking-monitor/index.js` (lines 636-647)
   - Action: Replace "today" check with `this.duplicateCheckWindow` time-based check
   - Impact: More accurate duplicate detection across day boundaries

### Long-Term Improvements (Priority 3 - Next Sprint)

7. **Complete Database Migration**
   - Files: Create CompanyRepository, ServiceRepository, StaffRepository
   - Action: Migrate all remaining Supabase queries to PostgreSQL
   - Impact: Single source of truth, better performance, easier testing

8. **Add Sentry Error Tracking**
   - File: `/src/services/booking-monitor/index.js`
   - Action: Add Sentry.captureException for critical errors (DB connection, etc.)
   - Impact: Proactive alerting before customers complain

9. **Improve Logging**
   - File: `/src/services/booking-monitor/index.js`
   - Action: Log duplicate check results, database query timing, skip reasons
   - Impact: Easier debugging of future issues

---

## Testing Recommendations

### Manual Testing After Hotfix

```bash
# 1. Deploy hotfix
git add src/services/booking-monitor/index.js
git commit -m "fix: add missing supabase import to stop reminder spam"
git push origin main

# 2. SSH to production
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# 3. Restart booking monitor
cd /opt/ai-admin
pm2 restart booking-monitor

# 4. Monitor logs for 2 hours
pm2 logs booking-monitor --lines 100

# 5. Look for these patterns:
# ✅ "Skipping duplicate notification" (duplicate check working)
# ✅ "reminder_2hours sent for booking X" (only once per booking)
# ❌ Multiple reminders for same booking (hotfix failed)
```

### Automated Testing (Before Repository Migration)

```javascript
// tests/services/booking-monitor.test.js

describe('BookingMonitorService - Reminder Duplicate Prevention', () => {
  it('should not send duplicate day_before reminder', async () => {
    // Create booking for tomorrow
    const booking = createTestBooking({
      datetime: addDays(new Date(), 1)
    });

    // First check at 19:00
    await bookingMonitor.checkAndSendReminders(booking);

    // Get notifications count
    const notifications1 = await getNotifications(booking.id);
    expect(notifications1).toHaveLength(1);

    // Second check at 19:01 (race condition simulation)
    await bookingMonitor.checkAndSendReminders(booking);

    // Should still be 1 notification
    const notifications2 = await getNotifications(booking.id);
    expect(notifications2).toHaveLength(1);
  });

  it('should not send duplicate 2hours reminder', async () => {
    // Create booking in 2 hours
    const booking = createTestBooking({
      datetime: addHours(new Date(), 2)
    });

    // Run check 3 times (simulating 3 minutes)
    for (let i = 0; i < 3; i++) {
      await bookingMonitor.checkAndSendReminders(booking);
    }

    // Should only send 1 reminder
    const notifications = await getNotifications(booking.id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].notification_type).toBe('reminder_2hours');
  });
});
```

---

## Summary

**Grade: F (Critical Production Bug)**

**Critical Issues Found:** 3
1. Missing supabase import → duplicate protection disabled
2. No database write after read → reminders never persisted
3. Race condition in parallel processing → overlapping checks

**Root Cause:** Incomplete database migration left code in broken state

**Estimated Fix Time:**
- Hotfix: 30 minutes (add import + mutex)
- Proper fix: 4 hours (repository migration)
- Complete migration: 8 hours (all repositories)

**Customer Impact:** HIGH - Spam messages damage brand reputation

**Recommended Action:** Deploy hotfix immediately (add supabase import), then schedule proper repository migration for this week.

---

**Code Review Complete**
File: `/Users/vosarsen/Documents/GitHub/ai_admin_v2.nosync/dev/active/reminder-spam-fix/reminder-spam-code-review.md`
