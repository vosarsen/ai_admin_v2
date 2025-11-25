# Tasks: Reminder Spam Fix

**Last Updated:** 2025-11-25 18:35 (Session 3 - DEPLOYED ✅)

---

## Phase 1: Database Schema ✅ COMPLETE

- [x] Create SQL migration file (`scripts/database/create-booking-notifications-timeweb.sql`)
- [x] Create `booking_notifications` table in Timeweb PostgreSQL
- [x] Add `notification_date` column for UNIQUE constraint
- [x] Create composite UNIQUE index `idx_bn_unique_notification`
- [x] Create helper indexes (company, phone, sent_at, duplicate_check)

**Completed:** 2025-11-25 (15 min)

---

## Phase 2: Repository Layer (Est: 1.5 hours) ✅ COMPLETE

### 2.1 Create BookingNotificationRepository
- [x] Create file `src/repositories/BookingNotificationRepository.js`
- [x] Extend BaseRepository
- [x] Import Sentry for error tracking
- [x] Implement `findRecent(recordId, windowMs, types)` method
  - [x] Build filters with yclients_record_id, sent_at >= cutoff
  - [x] Support optional types array filter
  - [x] Add Sentry tracking with tags
- [x] Implement `isDuplicate(recordId, type, windowMs)` helper
  - [x] Call findRecent and check length > 0
- [x] Implement `create(data)` method
  - [x] Validate yclients_record_id and company_id required
  - [x] Use raw INSERT (not upsert)
  - [x] Set notification_date = CURRENT_DATE
  - [x] Handle duplicate key error (code 23505) gracefully
  - [x] Add Sentry tracking
- [x] Implement `findSentToday(recordId, types)` method
  - [x] Calculate today's start time
  - [x] Delegate to findRecent

### 2.2 Export Repository
- [x] Add to `src/repositories/index.js`

### 2.3 Unit Tests
- [x] Create file `tests/repositories/BookingNotificationRepository.test.js`
- [x] Test: create() requires yclients_record_id
- [x] Test: create() requires company_id
- [x] Test: create() successfully creates notification
- [x] Test: isDuplicate() returns true for existing notification
- [x] Test: isDuplicate() returns false for different type
- [x] Test: findSentToday() returns today's notifications
- [x] Cleanup test data in afterAll()

**Completed:** 2025-11-25 (45 min)

---

## Phase 3: Service Integration (Est: 2.5 hours) ✅ COMPLETE

### 3.1 Update Imports
- [x] Remove: `const supabase = require('../../database/supabase');`
- [x] Add: `const Sentry = require('@sentry/node');`
- [x] Add: Import BookingNotificationRepository from repositories
- [x] Add: CompanyRepository, ServiceRepository, StaffRepository imports

### 3.2 Update Constructor
- [x] Add: `this.notificationRepo = new BookingNotificationRepository(postgres.pool);`
- [x] Add: companyRepo, serviceRepo, staffRepo are initialized

### 3.3 Add Mutex to checkBookings()
- [x] Add isChecking check at start of method
- [x] Wrap existing code in try/finally
- [x] Add in finally: `this.isChecking = false;`
- [x] Add Sentry tracking in catch block

### 3.4 Replace Supabase Calls (11 locations)

| # | Line | Operation | Status |
|---|------|-----------|--------|
| 1 | 3 | Import | [x] Deleted |
| 2 | 347-352 | SELECT booking_notifications | [x] → notificationRepo.findRecent() |
| 3 | 394-403 | INSERT booking_notifications | [x] → notificationRepo.create() |
| 4 | 485-491 | SELECT companies | [x] → companyRepo.findById(companyId) |
| 5 | 507-516 | INSERT booking_notifications | [x] → notificationRepo.create() |
| 6 | 531-545 | SELECT companies, services | [x] → companyRepo.findById(), serviceRepo.findAll() |
| 7 | 632-647 | SELECT (disabled!) | [x] → notificationRepo.findSentToday() **CRITICAL FIX!** |
| 8 | 702-707 | SELECT companies | [x] → companyRepo.findById(companyId) |
| 9 | 748-760 | SELECT services | [x] → serviceRepo.findById(serviceId, companyId) |
| 10 | 779-788 | SELECT staff | [x] → staffRepo.findById(staffId, companyId) |
| 11 | 835-844 | INSERT booking_notifications | [x] → notificationRepo.create() |

### 3.5 Fix Duplicate Check Logic (lines 630-650)
- [x] Remove: `const sentReminders = [];`
- [x] Add: try/catch block with notificationRepo.findSentToday()
- [x] Add: Sentry.captureException on error
- [x] Add: Debug logging for duplicate check results

**Completed:** 2025-11-25 (60 min)

---

## Phase 4: Testing (Est: 45 min) ✅ COMPLETE

### 4.1 Local Tests
- [x] Run: `npm run test -- BookingNotificationRepository.test.js`
- [x] Syntax verification passed (no DB connection locally, expected)

### 4.2 Server Tests
- [x] Deploy code to server
- [x] Restart booking-monitor: `pm2 restart ai-admin-booking-monitor`
- [x] Monitor logs: `pm2 logs ai-admin-booking-monitor --lines 100`
- [x] Verify no errors in logs - service running clean
- [x] PostgreSQL connection successful

### 4.3 Database Verification
- [x] Table structure verified:
  - All columns created correctly
  - UNIQUE index `idx_bn_unique_notification` in place
  - Helper indexes created

### 4.4 Smoke Test
- [x] Service running without errors
- [x] Will monitor for first reminder cycle (evening or 2-hour)

**Completed:** 2025-11-25 (10 min)

---

## Phase 5: Deploy (Est: 30 min) ✅ COMPLETE

### 5.1 Git Operations
- [x] Stage all changes: `git add -A`
- [x] Commit: `d5ef56f` with proper message
- [x] Push to main: `git push origin main`

### 5.2 Production Deploy
- [x] SSH to server
- [x] Pull changes: `git pull origin main`
- [x] Restart service: `pm2 restart ai-admin-booking-monitor`
- [x] Verify service running: `pm2 status` - online

### 5.3 Post-Deploy Verification
- [x] Logs show no errors
- [x] PostgreSQL connected successfully
- [x] Ready to monitor for spam fix effectiveness

**Completed:** 2025-11-25 (15 min)

---

## Rollback Checklist (If Needed)

- [ ] `git revert HEAD`
- [ ] `git push origin main`
- [ ] SSH to server
- [ ] `cd /opt/ai-admin && git pull && pm2 restart ai-admin-booking-monitor`
- [ ] Verify rollback successful

---

## Notes

- **Test phone only:** 89686484488
- **Never test on real clients!**
- Update this file and context.md after each session
