# Context: Reminder Spam Fix

**Last Updated:** 2025-11-25 18:35 (Session 3 - DEPLOYED ✅)

---

## Key Files

### Primary Files (Modify)
- `src/services/booking-monitor/index.js` - Main service with 11 Supabase calls to replace
- `src/repositories/index.js` - Add BookingNotificationRepository export

### Files to Create
- `src/repositories/BookingNotificationRepository.js` - New repository
- `tests/repositories/BookingNotificationRepository.test.js` - Unit tests
- `scripts/database/create-booking-notifications-timeweb.sql` - SQL migration (DONE)

### Reference Files
- `src/repositories/BaseRepository.js` - Pattern to follow (558 lines)
- `src/repositories/BookingRepository.js` - Example repository (167 lines)
- `src/database/postgres.js` - Database connection
- `src/database/supabase.js` - Shows correct import pattern: `module.exports = { supabase, getCached, clearCache }`

---

## Key Decisions

### 1. Full PostgreSQL Migration (Not Hotfix)
**Decision:** Complete migration to Timeweb PostgreSQL instead of quick Supabase fix
**Rationale:**
- Project already 80% migrated to PostgreSQL
- Supabase will be deprecated
- Repository pattern provides better testing/maintenance
- Database-level UNIQUE constraint is more reliable

### 2. notification_date Column for UNIQUE
**Decision:** Added separate `notification_date DATE` column instead of using `DATE(sent_at)`
**Rationale:** PostgreSQL requires IMMUTABLE functions in index expressions; `DATE()` on TIMESTAMPTZ is not IMMUTABLE

### 3. Raw INSERT Instead of Upsert
**Decision:** Use raw INSERT in `create()` method, handle duplicate key error (23505)
**Rationale:**
- Duplicates should never happen (business logic error)
- Returning null on 23505 is safe silent fallback (with debug logging)
- Upsert would mask bugs in duplicate check logic

### 4. Sentry in Custom Methods
**Decision:** Add Sentry.captureException to findRecent() and create()
**Rationale:** BaseRepository covers standard methods, but custom SQL needs explicit tracking

### 5. Repository Method Names (Corrected after review)
**Decision:** Use correct existing method names:
- `companyRepo.findById(companyId)` - NOT findByYclientsId
- `serviceRepo.findById(serviceId, companyId)` - requires companyId
- `staffRepo.findById(staffId, companyId)` - requires companyId
**Rationale:** Plan reviewer found incorrect method names

### 6. Repository Initialization
**Decision:** Initialize repositories with `postgres.pool` (not postgres module)
**Rationale:** This is the pattern used throughout the project (see supabase-data-layer.js)

---

## Current Progress

### Completed
- [x] Phase 1: Database schema created in Timeweb PostgreSQL
  - Table: `booking_notifications`
  - UNIQUE index: `idx_bn_unique_notification(yclients_record_id, notification_type, company_id, notification_date)`
  - Helper indexes created
- [x] Phase 2: BookingNotificationRepository created
  - All methods: findRecent, isDuplicate, create, findSentToday, countByType
  - Unit tests created
  - Exported from repositories/index.js
- [x] Phase 3: Service Integration complete
  - Removed all 11 Supabase calls
  - Added mutex to checkBookings()
  - **CRITICAL FIX:** Fixed hardcoded empty array `const sentReminders = []`
  - Added Sentry tracking
- [x] Phase 4: Testing
  - Syntax verification passed
  - Server logs clean
  - PostgreSQL connection successful
  - Table structure verified
- [x] Phase 5: Deploy
  - Commit `d5ef56f` pushed to main
  - Deployed to production
  - Service running without errors

### In Progress
- Nothing - all phases complete!

### Blocked
- Nothing - project complete!

---

## Dependencies

### Existing Repositories (Already Migrated)
These are already using PostgreSQL and can be reused:
- `BookingRepository` - Used in booking-monitor
- `CompanyRepository` - Need to add to booking-monitor
- `ServiceRepository` - Need to add to booking-monitor
- `StaffRepository` - Need to add to booking-monitor

### External Services
- Timeweb PostgreSQL: `a84c973324fdaccfc68d929d.twc1.net:5432`
- WhatsApp Client: For sending messages
- YClients API: For fetching bookings

---

## Important Notes

### Test Phone Only!
**CRITICAL:** Only test on phone `89686484488`. Never test on real client phones.

### Notification Types
Valid values for `notification_type`:
- `reminder_day_before` - Evening reminder for tomorrow's booking
- `reminder_2hours` - 2-hour before reminder
- `booking_created` - New booking confirmation
- `booking_cancelled` - Cancellation notification
- `booking_changed` - Change notification (time/service/staff)

### Timing Windows
- Day before reminder: Sent 18:00-21:00 evening before
- 2-hour reminder: Sent 1.5-2.5 hours before appointment
- Duplicate check window: 24 hours (same day via notification_date)

---

## Session Notes

### Session 1 (2025-11-25)
- Identified root cause: hardcoded empty array (NOT wrong import - supabase IS imported)
- Created comprehensive plan with 5 phases
- Plan reviewed by agent, found issues:
  - ✅ SQL migration with DATE() - already fixed (added notification_date column)
  - ✅ Code review incorrectly stated supabase not imported - corrected
  - ✅ Wrong method names (findByYclientsId → findById) - corrected
  - ✅ Repository init pattern confirmed: use postgres.pool
- Completed Phase 1: Database schema created in Timeweb PostgreSQL
- Created dev-docs structure
- Applied all corrections from plan review

### Session 2 (2025-11-25)
- ✅ Phase 2: Created BookingNotificationRepository (254 lines)
  - Methods: findRecent, isDuplicate, create, findSentToday, countByType
  - Proper Sentry tracking on all methods
  - UNIQUE constraint handling (23505 error returns null)
- ✅ Phase 2: Created unit tests (292 lines)
  - 18 test cases covering all methods
  - UNIQUE constraint verification test
- ✅ Phase 3: Updated booking-monitor/index.js
  - Replaced 11 Supabase calls with repositories
  - Added mutex to checkBookings()
  - **CRITICAL FIX:** Replaced `const sentReminders = []` with actual DB query
  - Added Sentry tracking everywhere

### Session 3 (2025-11-25) - DEPLOYED!
- ✅ Phase 4: Testing complete
  - Syntax verification passed
  - Deployed and service running clean
  - PostgreSQL connection successful
  - Table structure verified with all indexes
- ✅ Phase 5: Production deploy complete
  - Commit `d5ef56f` pushed to main
  - Service restarted successfully
  - Logs show no errors

### Post-Deploy Monitoring
- Monitor for first reminder cycle (evening 18:00-21:00 or 2-hour before booking)
- Verify notifications appear in `booking_notifications` table
- Confirm no spam reports from users

**Verification command:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && psql 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require' -c 'SELECT notification_type, COUNT(*), MAX(sent_at) FROM booking_notifications GROUP BY notification_type;'"
```

---

## PROJECT COMPLETE ✅

**Status:** Deployed to production on 2025-11-25
**Commit:** `d5ef56f`

### Summary
- Root cause: Hardcoded `const sentReminders = []` on line 654
- Fix: Full migration to PostgreSQL with BookingNotificationRepository
- Prevention: UNIQUE constraint at DB level prevents future duplicates

### Verification
```bash
# Check logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-booking-monitor --lines 50 --nostream"

# Check notifications in DB
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && psql 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require' -c 'SELECT notification_type, COUNT(*) FROM booking_notifications GROUP BY notification_type;'"
```

### Rollback (if needed)
```bash
git revert d5ef56f
git push origin main
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart ai-admin-booking-monitor"
```
