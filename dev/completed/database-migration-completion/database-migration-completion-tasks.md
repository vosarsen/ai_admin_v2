# Database Migration Completion Tasks
**Last Updated: 2025-11-07**

---

## 📋 Task Status Legend

- ⬜ Not Started
- 🔄 In Progress
- ✅ Completed
- ❌ Blocked
- ⏸️ Paused

---

## 🚨 PHASE 0.7: Emergency Baileys Fix (1-2 days) - URGENT

### Development Tasks

- [ ] **Task 0.7.1:** Create auth-state-timeweb.js (3h)
  - [ ] Copy auth-state-supabase.js as template
  - [ ] Replace supabase.from() with postgres.query()
  - [ ] Transform query API (select, insert, upsert, delete)
  - [ ] Preserve Buffer serialization logic
  - [ ] Update error handling for PostgreSQL
  - [ ] Code compiles without errors
  - **Acceptance:** File created, all Supabase calls replaced

- [ ] **Task 0.7.2:** Create auth-state-database.js (1h)
  - [ ] Create dynamic router module
  - [ ] Read USE_LEGACY_SUPABASE from config
  - [ ] Import appropriate module (Supabase or Timeweb)
  - [ ] Export unified interface
  - [ ] Test flag-based switching
  - **Acceptance:** Dynamic selection works, unified API exported

- [ ] **Task 0.7.3:** Update session-pool.js (30min)
  - [ ] Change import: auth-state-supabase → auth-state-database
  - [ ] Update function call: useSupabaseAuthState → useDatabaseAuthState
  - [ ] Test compilation
  - **Acceptance:** Import updated, compiles successfully

### Testing Tasks

- [ ] **Task 0.7.4:** Unit Tests (1h)
  - [ ] Create test-auth-state-timeweb.js
  - [ ] Set USE_LEGACY_SUPABASE=false in test
  - [ ] Test credential loading
  - [ ] Test credential saving
  - [ ] Test key get/set operations
  - [ ] Verify Buffer serialization
  - **Acceptance:** All unit tests pass

- [ ] **Task 0.7.5:** Integration Test on VPS (1h)
  - [ ] Git push changes to GitHub
  - [ ] SSH to VPS, git pull
  - [ ] Backup baileys_sessions directory
  - [ ] Set USE_LEGACY_SUPABASE=false in .env
  - [ ] Restart baileys-whatsapp-service
  - [ ] Monitor logs for 5 minutes
  - [ ] Verify "Using Timeweb PostgreSQL auth state"
  - [ ] Verify WhatsApp connected
  - **Acceptance:** Baileys connects, no errors for 5 min

- [ ] **Task 0.7.6:** E2E Test (30min)
  - [ ] Send test message: @whatsapp send_message phone:89686484488
  - [ ] Check worker logs: @logs logs_tail
  - [ ] Verify AI response received
  - [ ] Check context: @redis get_context phone:89686484488
  - [ ] Verify no errors
  - **Acceptance:** Full message flow works

- [ ] **Task 0.7.7:** Monitor 24 Hours (1 day)
  - [ ] Set up monitoring checks (every 6h)
    - [ ] PM2 service status
    - [ ] Baileys connection status
    - [ ] Message flow count
    - [ ] Timeweb query logs
    - [ ] Error rate
  - [ ] Document any issues
  - [ ] Verify Supabase queries = 0
  - [ ] Check Timeweb keys updated_at timestamps
  - **Acceptance:** 24h stable, zero Supabase queries

### Phase 0.7 Completion Criteria
- [ ] Baileys reads from Timeweb PostgreSQL
- [ ] WhatsApp send/receive works
- [ ] Zero Supabase queries in Baileys logs
- [ ] Fresh timestamps in Timeweb whatsapp_keys
- [ ] 24 hours without errors

---

## 📅 WEEK 1: Abstraction Layer (7 days)

### Design Tasks

- [ ] **Task 1.1:** Design unified-db.js API (1 day)
  - [ ] Define interface for common operations
  - [ ] Design query builder pattern
  - [ ] Plan error handling strategy
  - [ ] Document API
  - [ ] Review with team
  - **Acceptance:** API design approved

### Implementation Tasks

- [ ] **Task 1.2:** Implement Supabase Adapter (1 day)
  - [ ] Create adapter class
  - [ ] Implement select, insert, update, delete, upsert
  - [ ] Add pagination support
  - [ ] Add filtering support
  - [ ] Error normalization
  - **Acceptance:** Adapter passes test suite

- [ ] **Task 1.3:** Implement Timeweb Adapter (1 day)
  - [ ] Create adapter class
  - [ ] Implement select, insert, update, delete, upsert
  - [ ] Query builder for PostgreSQL
  - [ ] Add pagination support
  - [ ] Add filtering support
  - [ ] Error normalization
  - **Acceptance:** Adapter passes test suite

- [ ] **Task 1.4:** Create Comprehensive Tests (1 day)
  - [ ] Unit tests for both adapters
  - [ ] Integration tests
  - [ ] Performance benchmarks
  - [ ] Edge case testing
  - **Acceptance:** 100% test coverage

### File Update Tasks

- [ ] **Task 1.5:** Update Data Layer (1 day)
  - [ ] Refactor supabase-data-layer.js → unified-data-layer.js
  - [ ] Replace 977 lines with unified-db calls
  - [ ] Maintain backward compatibility
  - [ ] Test all methods
  - **Acceptance:** Data layer uses unified-db

- [ ] **Task 1.6:** Update Critical Sync Scripts (1 day)
  - [ ] Update clients-sync.js
  - [ ] Update services-sync.js
  - [ ] Update staff-sync.js
  - [ ] Update schedules-sync.js
  - [ ] Update bookings-sync.js
  - **Acceptance:** 5 sync scripts use unified-db

- [ ] **Task 1.7:** Code Review + Testing (1 day)
  - [ ] Full code review
  - [ ] Integration tests
  - [ ] Performance tests
  - [ ] Fix issues found
  - **Acceptance:** All tests pass, review approved

### Week 1 Completion Criteria
- [ ] unified-db.js created and tested
- [ ] Both adapters working
- [ ] Data layer refactored
- [ ] 5+ critical files updated
- [ ] All tests passing

---

## 📅 WEEK 2: Migration Scripts + Testing (7 days)

### Script Development Tasks

- [ ] **Task 2.1:** Create Migration Script (2 days)
  - [ ] Design script structure
  - [ ] Implement table dependency resolution
  - [ ] Add batch processing (100 records)
  - [ ] Add progress tracking
  - [ ] Implement error handling + retry
  - [ ] Add verification checksums
  - [ ] Implement dry-run mode
  - [ ] Test with mock data
  - **Acceptance:** Script handles 11 tables with verification

### Table Migration Order

- [ ] **Task 2.2:** companies (1 record)
  - [ ] No dependencies
  - [ ] Priority: 1

- [ ] **Task 2.3:** clients (1,299 records)
  - [ ] Depends on: companies
  - [ ] Priority: 2

- [ ] **Task 2.4:** services (63 records)
  - [ ] Depends on: companies
  - [ ] Priority: 3

- [ ] **Task 2.5:** staff (12 records)
  - [ ] Depends on: companies
  - [ ] Priority: 4

- [ ] **Task 2.6:** staff_schedules (56+ records)
  - [ ] Depends on: staff
  - [ ] Priority: 5

- [ ] **Task 2.7:** bookings (38 records)
  - [ ] Depends on: clients, services, staff
  - [ ] Priority: 6

- [ ] **Task 2.8:** appointments_cache
  - [ ] Depends on: clients, services, staff
  - [ ] Priority: 7

- [ ] **Task 2.9:** dialog_contexts (21 records)
  - [ ] No dependencies
  - [ ] Priority: 8

- [ ] **Task 2.10:** reminders
  - [ ] Depends on: clients, bookings
  - [ ] Priority: 9

- [ ] **Task 2.11:** sync_status
  - [ ] No dependencies
  - [ ] Priority: 10

- [ ] **Task 2.12:** messages (partitioned)
  - [ ] No dependencies
  - [ ] Priority: 11

### Testing Tasks

- [ ] **Task 2.13:** Local Testing (1 day)
  - [ ] Test with SSH tunnel to Timeweb
  - [ ] Verify all tables migrate
  - [ ] Check foreign key constraints
  - [ ] Verify checksums
  - **Acceptance:** All tables migrate successfully locally

- [ ] **Task 2.14:** Staging Dry-Run (1 day)
  - [ ] Run on production data (read-only)
  - [ ] Verify record counts
  - [ ] Check execution time
  - [ ] Identify bottlenecks
  - **Acceptance:** Dry-run completes in <3 hours

- [ ] **Task 2.15:** Performance Benchmarks (1 day)
  - [ ] Measure query times
  - [ ] Test connection pool
  - [ ] Optimize batch sizes
  - [ ] Tune indexes
  - **Acceptance:** Performance acceptable

- [ ] **Task 2.16:** Rollback Procedure Test (1 day)
  - [ ] Document rollback steps
  - [ ] Test rollback on staging
  - [ ] Time rollback execution
  - [ ] Verify data restoration
  - **Acceptance:** Rollback works in <5 minutes

- [ ] **Task 2.17:** Fix Issues + Optimize (1 day)
  - [ ] Address issues found in testing
  - [ ] Optimize slow operations
  - [ ] Final code review
  - **Acceptance:** All issues resolved

### Week 2 Completion Criteria
- [ ] Migration script complete
- [ ] All 11 tables tested
- [ ] Dry-run successful on production
- [ ] Performance acceptable (<3h migration)
- [ ] Rollback tested and working

---

## 📅 WEEK 3: Production Cutover (7 days prep + 6h execution)

### Preparation Tasks (Days 15-20)

- [ ] **Task 3.1:** Final Code Review (1 day)
  - [ ] Review all changes
  - [ ] Check for edge cases
  - [ ] Verify error handling
  - [ ] Approve for production
  - **Acceptance:** Code review passed

- [ ] **Task 3.2:** Backup Procedures (1 day)
  - [ ] Test Supabase backup
  - [ ] Test Timeweb backup
  - [ ] Test file backup
  - [ ] Verify restoration works
  - **Acceptance:** Backups tested

- [ ] **Task 3.3:** Rollback Procedures (1 day)
  - [ ] Document step-by-step rollback
  - [ ] Test rollback on staging
  - [ ] Time rollback execution
  - [ ] Train team on rollback
  - **Acceptance:** Rollback procedure ready

- [ ] **Task 3.4:** Monitoring Dashboards (1 day)
  - [ ] Set up real-time monitoring
  - [ ] Create alert thresholds
  - [ ] Test alerting
  - [ ] Prepare status page
  - **Acceptance:** Monitoring ready

- [ ] **Task 3.5:** Stakeholder Communication (1 day)
  - [ ] Send client notification (48h advance)
  - [ ] Send team notification
  - [ ] Confirm maintenance window
  - [ ] Prepare status updates
  - **Acceptance:** All stakeholders notified

- [ ] **Task 3.6:** On-Call Schedule (1 day)
  - [ ] Assign primary on-call
  - [ ] Assign backup on-call
  - [ ] Share contact info
  - [ ] Confirm availability
  - **Acceptance:** Team scheduled

### Execution Tasks (Day 21, Sunday 02:00-08:00)

#### Phase 1: Preparation (02:00-02:30)

- [ ] **Task 3.7:** Enable Maintenance Mode
  - [ ] Stop all PM2 services
  - [ ] Add MAINTENANCE=true to .env
  - [ ] Verify no active connections
  - **Time:** 10 minutes
  - **Acceptance:** All services stopped

- [ ] **Task 3.8:** Full Backup
  - [ ] Backup Supabase (pg_dump)
  - [ ] Backup Timeweb (pg_dump)
  - [ ] Backup .env files
  - [ ] Verify backup integrity
  - **Time:** 20 minutes
  - **Acceptance:** All backups created

#### Phase 2: Data Migration (02:30-05:30)

- [ ] **Task 3.9:** Execute Migration Script
  - [ ] Run migrate-all-tables-timeweb.js --verify
  - [ ] Monitor progress (all 11 tables)
  - [ ] Check for errors
  - **Time:** 2-3 hours
  - **Acceptance:** All tables migrated

- [ ] **Task 3.10:** Verify Data Integrity
  - [ ] Run verification script
  - [ ] Check record counts match
  - [ ] Verify checksums
  - [ ] Check foreign keys
  - **Time:** 30 minutes
  - **Acceptance:** 100% verification passed

#### Phase 3: Switch to Timeweb (05:30-06:00)

- [ ] **Task 3.11:** Update Configuration
  - [ ] Set USE_LEGACY_SUPABASE=false
  - [ ] Verify config change
  - [ ] Backup old .env
  - **Time:** 10 minutes
  - **Acceptance:** Config updated

#### Phase 4: Start Services (06:00-06:30)

- [ ] **Task 3.12:** Start Services (Staged)
  - [ ] Start baileys-whatsapp-service (wait 60s, verify)
  - [ ] Start ai-admin-worker-v2 (wait 30s, verify)
  - [ ] Start ai-admin-booking-monitor (verify)
  - [ ] Start remaining 5 services (verify each)
  - **Time:** 30 minutes
  - **Acceptance:** All 8 services online

- [ ] **Task 3.13:** Disable Maintenance Mode
  - [ ] Remove MAINTENANCE flag
  - [ ] Verify services responsive
  - **Time:** 5 minutes
  - **Acceptance:** Maintenance mode off

#### Phase 5: Verification (06:30-07:30)

- [ ] **Task 3.14:** E2E Tests
  - [ ] Send test WhatsApp message
  - [ ] Verify AI response
  - [ ] Check booking creation
  - [ ] Verify schedules load
  - [ ] Check client data
  - **Time:** 30 minutes
  - **Acceptance:** All E2E tests pass

- [ ] **Task 3.15:** Database Query Verification
  - [ ] Check Timeweb has recent activity
  - [ ] Verify Supabase is idle (zero queries)
  - [ ] Monitor query logs
  - **Time:** 15 minutes
  - **Acceptance:** Timeweb active, Supabase idle

- [ ] **Task 3.16:** Monitor for Anomalies
  - [ ] Check error logs
  - [ ] Monitor service status
  - [ ] Check message flow
  - [ ] Verify no critical errors
  - **Time:** 15 minutes
  - **Acceptance:** No critical errors

#### Phase 6: Post-Migration (07:30-08:00)

- [ ] **Task 3.17:** Final Smoke Tests
  - [ ] Test all critical paths
  - [ ] Verify WhatsApp messages
  - [ ] Check bookings
  - [ ] Test AI responses
  - **Time:** 20 minutes
  - **Acceptance:** All smoke tests pass

- [ ] **Task 3.18:** Confirm Success
  - [ ] Send success notification to team
  - [ ] Send success notification to clients
  - [ ] Update status page
  - [ ] Document any issues
  - **Time:** 10 minutes
  - **Acceptance:** Success confirmed

### Post-Migration Tasks (Days 22-28)

- [ ] **Task 3.19:** Daily Monitoring (7 days)
  - [ ] Day 1: Check every 2 hours
  - [ ] Day 2-3: Check every 6 hours
  - [ ] Day 4-7: Check every 12 hours
  - [ ] Monitor error rates
  - [ ] Check performance metrics
  - [ ] Document issues
  - **Acceptance:** 7 days stable operation

- [ ] **Task 3.20:** Decommission Supabase
  - [ ] Verify zero Supabase queries (7 days)
  - [ ] Final backup of Supabase
  - [ ] Cancel Supabase subscription
  - [ ] Remove Supabase credentials from .env
  - [ ] Update documentation
  - **Acceptance:** Supabase decommissioned

### Week 3 Completion Criteria
- [ ] Migration executed in maintenance window
- [ ] All 11 tables migrated (100% verified)
- [ ] All services online and functional
- [ ] E2E tests passing
- [ ] 7 days stable operation
- [ ] Supabase decommissioned

---

## 🎯 Overall Success Criteria

### Technical Success
- [ ] All 11 tables migrated to Timeweb
- [ ] All 51 files using unified-db interface
- [ ] Zero Supabase queries across entire application
- [ ] All 8 PM2 services online
- [ ] WhatsApp connected and working
- [ ] Message success rate >98%
- [ ] Error rate <5%
- [ ] Performance same or better than baseline

### Operational Success
- [ ] Migration completed within 6-hour window
- [ ] Downtime <4 hours actual
- [ ] Zero data loss
- [ ] Zero critical incidents
- [ ] Rollback not needed
- [ ] 7 days stable operation post-migration
- [ ] Supabase successfully decommissioned

### Business Success
- [ ] Client notification sent 48h advance
- [ ] Clients informed of completion
- [ ] No client complaints
- [ ] Cost savings achieved (Supabase decommissioned)
- [ ] Documentation updated
- [ ] Team trained on new system

---

## 📝 Notes

**Test Phone:** 89686484488 (ONLY use this number for testing!)

**Rollback Triggers:**
- Baileys disconnected >10 minutes
- Error rate >20%
- Data verification fails
- Critical service won't start
- Any PRIMARY success criterion not met

**Communication Schedule:**
- Before Phase 0.7: 24h advance (team only)
- Before Full Migration: 48h advance (clients + team)
- During Migration: Every 30 minutes (status updates)
- After Migration: Immediately (success notification)

**Backup Locations:**
- Supabase dumps: /opt/ai-admin/backups/
- Timeweb dumps: /opt/ai-admin/backups/
- .env backups: /opt/ai-admin/.env.backup.*

---

**Created:** 2025-11-07
**Status:** Ready to Execute
**Next Action:** Begin Phase 0.7 - Task 0.7.1
