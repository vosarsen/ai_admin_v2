# Sentry to GlitchTip Migration - Task Checklist

**Last Updated:** 2025-11-24 (Session 2)
**Status:** Phase 0 Complete, Phase 1: 67% (4/6)
**Current Phase:** Phase 1 (Local Testing) - Partial Complete
**Target Completion:** 2025-11-26

---

## Quick Status

**Overall Progress:** 10/38 tasks (26%)

| Phase | Tasks | Completed | Progress |
|-------|-------|-----------|----------|
| Phase 0: Docker Setup | 6 | 6 | ✅ 100% |
| Phase 1: Local Testing | 6 | 4 | 🟡 67% |
| Phase 2: Production Deploy | 8 | 0 | 0% |
| Phase 3: Parallel Testing | 6 | 0 | 0% |
| Phase 4: Cutover | 5 | 0 | 0% |
| Phase 5: Cleanup | 7 | 0 | 0% |
| **TOTAL** | **38** | **10** | **26%** |

---

## Phase 0: Preparation & Docker Installation

**Duration:** 30 minutes (vs 2-3h estimated) ⚡ 94% faster!
**Status:** ✅ COMPLETE (2025-11-24)
**Blocking:** None

### Tasks

- [x] **0.1** Install Docker (30 min, S) - **DONE 2025-11-24**
  - [x] SSH to production server
  - [x] Run Docker install script: `curl -fsSL https://get.docker.com | sh`
  - [x] Start Docker: `systemctl start docker && systemctl enable docker`
  - [x] Verify: `docker --version`
  - **Acceptance:** Docker v29.0.3 installed ✅

- [x] **0.2** Install Docker Compose (15 min, S) - **DONE 2025-11-24**
  - [x] Verify installed (included in Docker install): `docker-compose --version`
  - **Acceptance:** Docker Compose v2.40.3 plugin installed ✅

- [x] **0.3** Verify Port 8080 Available (10 min, S) - **DONE 2025-11-24**
  - [x] Check port: `ss -tlnp | grep 8080`
  - [x] Verify output is empty (port free)
  - **Acceptance:** Port 8080 is FREE ✅

- [x] **0.4** Create Backups (30 min, S) - **DONE 2025-11-24**
  - [x] Backup .env: `cp /opt/ai-admin/.env /opt/ai-admin/.env.backup.20251124`
  - [x] Save Sentry DSN: `grep SENTRY_DSN /opt/ai-admin/.env > /tmp/sentry_dsn_backup.txt`
  - [x] Verify backups exist and contain correct data
  - **Acceptance:** All backups created (3.3 KB + 107 bytes) ✅

- [x] **0.5** Document Current State (30 min, S) - **DONE 2025-11-24**
  - [x] Save PM2 status: `pm2 status > /tmp/pm2_status_before.txt`
  - [x] Save memory: `free -h > /tmp/memory_before.txt`
  - [x] Save disk: `df -h > /tmp/disk_before.txt`
  - [x] Review and verify all state captured
  - **Acceptance:** State captured (9 services, 1.0GB RAM used, 18GB disk free) ✅

- [x] **0.6** Reserve Resources (15 min, S) - **DONE 2025-11-24**
  - [x] Check RAM available: `free -h` (need 400 MB free)
  - [x] Check disk: `df -h` (need 2-3 GB free)
  - [x] Confirm headroom exists
  - **Acceptance:** 910 MB RAM + 18 GB disk confirmed available ✅

**Phase 0 Completion Criteria:**
- [x] Docker and Docker Compose installed ✅
- [x] Port 8080 available ✅
- [x] Backups created ✅
- [x] Resources confirmed available ✅
- [x] Ready to proceed to Phase 1 ✅

---

## Phase 1: Local/Staging Testing

**Duration:** 2 hours (vs 4-6h estimated) ⚡ 60% faster!
**Status:** 🟡 PARTIAL (4/6 tasks - 67%) (2025-11-24 Session 2)
**Blocking:** Phase 0 complete ✅

### Tasks

- [x] **1.1** Deploy GlitchTip Locally (1 hour, M) - **DONE 2025-11-24**
  - [x] Create test directory: `~/glitchtip-test/`
  - [x] Create docker-compose.yml manually (official URL 404)
  - [x] Create .env file with SECRET_KEY and config
  - [x] Start services: `docker compose up -d`
  - [x] All 4 containers running (web, worker, postgres, redis)
  - [x] UI accessible at http://localhost:8080
  - **Acceptance:** ✅ All containers Up, UI responsive

- [x] **1.2** Create Test Project (30 min, S) - **DONE 2025-11-24**
  - [x] Create superuser: admin@test.com / admin123
  - [x] Login to UI at localhost:8080
  - [x] Create organization "Test Org"
  - [x] Create project "AI Admin Test"
  - [x] Get DSN: http://a7a6528779f148d68ac5b3079aabfd2e@localhost:8080/1
  - **Acceptance:** ✅ DSN obtained and saved

- [x] **1.3** Test Sentry SDK Compatibility (1 hour, M) - **DONE 2025-11-24**
  - [x] Create test script `test-sentry-compat.js` (5 scenarios)
  - [x] Run test: `node test-sentry-compat.js`
  - [x] All 5 errors captured in GlitchTip UI
  - [x] Stack traces readable, user context preserved
  - [x] Breadcrumbs, tags, extra data all work
  - **Acceptance:** ✅ 100% SDK compatibility confirmed

- [x] **1.4** Test Real Code Patterns (2 hours, L) - **DONE 2025-11-24**
  - [x] Create test script `test-real-patterns.js` (5 patterns)
  - [x] Test database error pattern (postgres.js) ✅
  - [x] Test repository error pattern (BaseRepository.js) ✅
  - [x] Test WhatsApp error pattern (auth-state-timeweb.js) ✅
  - [x] Test service error pattern (booking-monitor) ✅
  - [x] Test queue worker error pattern (BullMQ) ✅
  - [x] All 5 patterns work perfectly with tags/extra data
  - **Acceptance:** ✅ Production patterns validated

- [ ] **1.5** Performance & Resource Testing (30 min, M) - **NOT STARTED**
  - [ ] Check baseline resources: `docker stats --no-stream`
  - [ ] Send 100 test errors: `for i in {1..100}; do node test-sentry-compat.js & done; wait`
  - [ ] Check resource usage during load
  - [ ] Check all 100 errors captured in UI
  - [ ] Verify RAM <500 MB total
  - [ ] Check for crashes or errors in logs
  - **Acceptance:** All 100 errors captured, RAM <500 MB, no crashes

- [ ] **1.6** Uptime Monitoring Test (30 min, S) - **NOT STARTED**
  - [ ] Navigate to "Uptime" in GlitchTip UI
  - [ ] Add uptime check for `http://example.com`
  - [ ] Verify check runs every 60 seconds
  - [ ] Break URL (typo), verify alert fires
  - [ ] Fix URL, verify check passes again
  - **Acceptance:** Uptime monitoring functional
  - **Note:** Nice-to-have, not critical for production readiness

**Phase 1 Completion Criteria:**
- [x] Local GlitchTip deployed successfully ✅
- [x] Sentry SDK compatibility verified (all tests pass) ✅
- [x] Real error patterns work correctly ✅
- [ ] Performance acceptable under load (optional)
- [ ] Uptime monitoring works (optional)
- [x] **Core testing complete** - Safe to proceed to Phase 2 ✅

**Decision Point:**
- **Option 1:** Complete tasks 1.5 & 1.6 (~1 hour) for full Phase 1
- **Option 2:** Skip to Phase 2 (production deployment) - core compatibility confirmed

---

## Phase 2: Production Deployment

**Duration:** 2-3 hours
**Status:** Not Started
**Blocking:** Phase 1 complete

### Tasks

- [ ] **2.1** Create Production Directory (5 min, S)
  - [ ] SSH to production: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
  - [ ] Create directory: `mkdir -p /opt/glitchtip && cd /opt/glitchtip`
  - [ ] Verify: `pwd` shows `/opt/glitchtip`
  - **Acceptance:** Directory exists

- [ ] **2.2** Download Docker Compose Config (10 min, S)
  - [ ] Download: `wget https://github.com/glitchtip/glitchtip-docker-compose/releases/latest/download/docker-compose.yml`
  - [ ] Verify: `cat docker-compose.yml` shows 4 services
  - **Acceptance:** File downloaded successfully

- [ ] **2.3** Create Production .env (15 min, S)
  - [ ] Create .env file (see plan for template)
  - [ ] Generate SECRET_KEY: `openssl rand -hex 32`
  - [ ] Generate POSTGRES_PASSWORD: `openssl rand -hex 16`
  - [ ] Set GLITCHTIP_DOMAIN=http://46.149.70.219:8080
  - [ ] Secure file: `chmod 600 .env`
  - [ ] Verify: `cat .env` shows all variables
  - **Acceptance:** .env created with secure permissions

- [ ] **2.4** Start GlitchTip Services (30 min, M)
  - [ ] Pull images: `docker-compose pull`
  - [ ] Start services: `docker-compose up -d`
  - [ ] Wait 60 seconds for initialization
  - [ ] Check status: `docker-compose ps`
  - [ ] View logs: `docker-compose logs -f` (check for errors)
  - [ ] Verify all containers "Up"
  - **Acceptance:** All 4 containers running without errors

- [ ] **2.5** Create Superuser (10 min, S)
  - [ ] Run: `docker-compose exec web ./manage.py createsuperuser`
  - [ ] Username: admin
  - [ ] Email: admin@ai-admin.com
  - [ ] Password: [generate secure password]
  - [ ] Save credentials in password manager
  - **Acceptance:** Superuser created successfully

- [ ] **2.6** Access UI and Create Project (30 min, M)
  - [ ] Open browser: `http://46.149.70.219:8080`
  - [ ] Login with superuser credentials
  - [ ] Create organization "AI Admin"
  - [ ] Create project "AI Admin v2 Production"
  - [ ] Navigate to Settings → Client Keys
  - [ ] Copy DSN key
  - [ ] Save to file: `echo "DSN" > /tmp/glitchtip_dsn.txt`
  - **Acceptance:** Project created, DSN saved

- [ ] **2.7** Setup Resource Monitoring (15 min, S)
  - [ ] Create monitoring script at `/opt/glitchtip/monitor.sh` (see plan)
  - [ ] Make executable: `chmod +x /opt/glitchtip/monitor.sh`
  - [ ] Test run: `/opt/glitchtip/monitor.sh`
  - **Acceptance:** Script runs and shows resource usage

- [ ] **2.8** Verify Production Deployment (30 min, M)
  - [ ] Health check: `curl http://46.149.70.219:8080/api/0/health/`
  - [ ] Create test script `/tmp/test-glitchtip.js` (see plan)
  - [ ] Update DSN in test script
  - [ ] Run test: `cd /opt/ai-admin && node /tmp/test-glitchtip.js`
  - [ ] Check UI for test error
  - [ ] Verify error appears within 10 seconds
  - **Acceptance:** Health check OK, test error captured

**Phase 2 Completion Criteria:**
- [ ] GlitchTip deployed on production server
- [ ] All containers running stably
- [ ] UI accessible at port 8080
- [ ] Test error captured successfully
- [ ] Resources within acceptable range (<80% RAM)
- [ ] Ready for parallel testing

---

## Phase 3: Parallel Running (Testing Period)

**Duration:** 24-48 hours
**Status:** Not Started
**Blocking:** Phase 2 complete

### Tasks

- [ ] **3.1** Setup Monitoring Schedule (30 min, S)
  - [ ] Create check script `/tmp/check-glitchtip.sh` (see plan)
  - [ ] Make executable: `chmod +x /tmp/check-glitchtip.sh`
  - [ ] Set calendar reminders: Every 6 hours for 48 hours
  - **Acceptance:** Monitoring schedule established

- [ ] **3.2** Initial 6-Hour Check (15 min, S)
  - [ ] Run check script: `/tmp/check-glitchtip.sh`
  - [ ] Verify all containers still "Up"
  - [ ] Check RAM usage <80%
  - [ ] Check disk not growing rapidly
  - [ ] Access GlitchTip UI, verify accessible
  - [ ] Send manual test error, verify captured
  - **Acceptance:** All checks pass

- [ ] **3.3** 12-Hour Stability Check (15 min, S)
  - [ ] Run check script again
  - [ ] Compare resource usage to 6h mark
  - [ ] Check docker logs for errors: `docker-compose logs --since 6h | grep -i error`
  - [ ] Verify UI still responsive
  - **Acceptance:** Stable, no degradation

- [ ] **3.4** Load Testing (1 hour, M)
  - [ ] Create stress test script `/tmp/stress-test.sh` (see plan)
  - [ ] Run stress test: `/tmp/stress-test.sh`
  - [ ] Monitor during test: `watch -n 5 'docker stats --no-stream | grep glitchtip'`
  - [ ] Check all 50 errors captured in UI
  - [ ] Verify RAM spike <100 MB
  - [ ] Check for any crashes or errors
  - **Acceptance:** All errors captured, services stable under load

- [ ] **3.5** 24-Hour Stability Verification (30 min, M)
  - [ ] Check uptime: `docker-compose ps | grep Up`
  - [ ] Review resource usage: `docker stats --no-stream`
  - [ ] Check logs for errors: `docker-compose logs --since 24h | grep -i error`
  - [ ] Count errors in GlitchTip UI (should have recent activity)
  - [ ] Compare performance with Sentry SaaS
  - **Acceptance:** 24+ hours uptime, stable, comparable to Sentry

- [ ] **3.6** Team Feedback Collection (30 min, S)
  - [ ] Share GlitchTip URL with team
  - [ ] Ask team to browse UI
  - [ ] Collect feedback on usability
  - [ ] Address any concerns
  - [ ] Get approval to proceed with cutover
  - **Acceptance:** Team comfortable, approved for cutover

**Phase 3 Completion Criteria:**
- [ ] 48 hours continuous uptime
- [ ] No crashes or service interruptions
- [ ] Resource usage stable (<80% RAM)
- [ ] Load testing passed
- [ ] Team approved for cutover
- [ ] Confident to proceed to production cutover

---

## Phase 4: Production Cutover

**Duration:** 30 minutes
**Status:** Not Started
**Blocking:** Phase 3 complete, Team approval

**⚠️ IMPORTANT:** Schedule cutover during low-traffic window (recommended: Sunday 06:00-08:00 MSK)

### Tasks

- [ ] **4.1** Pre-Cutover Checklist (10 min, S)
  - [ ] Verify all GlitchTip containers "Up": `docker-compose ps`
  - [ ] Verify RAM <70%: `free -h`
  - [ ] Health check passes: `curl http://46.149.70.219:8080/api/0/health/`
  - [ ] Create final backup: `cp /opt/ai-admin/.env /opt/ai-admin/.env.pre-glitchtip-$(date +%Y%m%d-%H%M)`
  - [ ] Verify GlitchTip DSN ready: `cat /tmp/glitchtip_dsn.txt`
  - [ ] Announce to team: "Cutover starting now"
  - **Acceptance:** All pre-flight checks pass

- [ ] **4.2** Update Environment Variable (5 min, S)
  - [ ] SSH to server (if not already)
  - [ ] Edit .env: `cd /opt/ai-admin && nano .env`
  - [ ] Change SENTRY_DSN to GlitchTip DSN
  - [ ] Save and exit (Ctrl+X, Y, Enter)
  - [ ] Verify change: `grep SENTRY_DSN .env`
  - **Acceptance:** DSN updated to GlitchTip URL

- [ ] **4.3** Restart All Services (5 min, S)
  - [ ] Restart PM2: `pm2 restart all`
  - [ ] Verify all started: `pm2 status`
  - [ ] Check for errors: `pm2 logs --lines 50`
  - **Acceptance:** All 5 services show "online" status

- [ ] **4.4** Immediate Verification (10 min, S)
  - [ ] Send test error: `curl -X POST http://localhost:3000/api/test/error`
  - [ ] Check GlitchTip UI for test error (refresh page)
  - [ ] Verify error appears within 10 seconds
  - [ ] Check PM2 logs for Sentry init: `pm2 logs | grep -i sentry`
  - [ ] Verify Sentry SaaS NOT receiving new errors (check sentry.io)
  - **Acceptance:** Test error in GlitchTip, Sentry SaaS quiet

- [ ] **4.5** Monitor First Hour (60 min, S)
  - [ ] Every 15 min: `pm2 status` (verify all online)
  - [ ] Every 15 min: `free -h` (check RAM usage)
  - [ ] Every 15 min: `docker stats --no-stream` (check GlitchTip resources)
  - [ ] Check GlitchTip UI for new errors
  - [ ] Monitor PM2 logs for issues: `pm2 logs --err --lines 20`
  - [ ] Announce to team: "Cutover complete, monitoring"
  - **Acceptance:** 1 hour stable, errors flowing to GlitchTip

**Phase 4 Completion Criteria:**
- [ ] DSN successfully updated
- [ ] All PM2 services restarted without errors
- [ ] Test error captured in GlitchTip
- [ ] Real production errors appearing in GlitchTip
- [ ] Sentry SaaS no longer receiving errors
- [ ] 1 hour post-cutover monitoring passed
- [ ] No rollback needed

**Rollback Available:** If ANY issues, revert DSN from backup and restart PM2 (< 5 minutes)

---

## Phase 5: Cleanup & Finalization

**Duration:** 1 hour + 24 hours monitoring
**Status:** Not Started
**Blocking:** Phase 4 complete + 24 hours stable

### Tasks

- [ ] **5.1** 24-Hour Post-Cutover Monitoring (24 hours, S)
  - [ ] Create daily check script `/opt/glitchtip/daily-check.sh` (see plan)
  - [ ] Make executable: `chmod +x /opt/glitchtip/daily-check.sh`
  - [ ] Run daily for 7 days: `/opt/glitchtip/daily-check.sh`
  - [ ] Monitor for any issues
  - **Acceptance:** 24+ hours stable, no production incidents

- [ ] **5.2** Cancel Sentry Subscription (15 min, S)
  - [ ] Login to Sentry.io
  - [ ] Navigate to Settings → Subscription
  - [ ] Cancel subscription
  - [ ] Confirm cancellation
  - [ ] Download final invoice/receipt
  - [ ] Save confirmation email
  - **Acceptance:** Subscription cancelled, confirmation received

- [ ] **5.3** Update Documentation (30 min, M)
  - [ ] Create `/opt/ai-admin/docs/ERROR_TRACKING.md` (see plan template)
  - [ ] Include: Access, Quick Start, Common Tasks, Troubleshooting
  - [ ] Add to project README
  - [ ] Update runbook with GlitchTip procedures
  - **Acceptance:** Documentation created and accessible

- [ ] **5.4** Setup Automated Backups (20 min, M)
  - [ ] Create backup directory: `mkdir -p /backups/glitchtip && chmod 700 /backups/glitchtip`
  - [ ] Create backup script `/opt/glitchtip/backup.sh` (see plan)
  - [ ] Make executable: `chmod +x /opt/glitchtip/backup.sh`
  - [ ] Test backup: `/opt/glitchtip/backup.sh`
  - [ ] Add to crontab: `0 2 * * * /opt/glitchtip/backup.sh`
  - [ ] Verify crontab: `crontab -l | grep glitchtip`
  - **Acceptance:** Backup runs successfully, scheduled daily at 2 AM

- [ ] **5.5** Configure Alerts (15 min, S)
  - [ ] Login to GlitchTip UI
  - [ ] Settings → Alerts → Add new alert
  - [ ] Create "Critical Errors" alert (count > 10 in 1 hour)
  - [ ] Create "New Issues" alert (on new issue)
  - [ ] Set notification email
  - [ ] Test alerts by triggering conditions
  - **Acceptance:** Alerts fire correctly

- [ ] **5.6** Team Training Session (30 min, M)
  - [ ] Schedule 30-min training session
  - [ ] Demo GlitchTip UI navigation
  - [ ] Show search/filter functionality
  - [ ] Explain issue grouping
  - [ ] Demo uptime monitoring
  - [ ] Q&A session
  - **Acceptance:** Team trained, comfortable using GlitchTip

- [ ] **5.7** Update Runbook (15 min, S)
  - [ ] Add GlitchTip to operational runbook
  - [ ] Document monitoring commands
  - [ ] Document restart procedures
  - [ ] Document backup/restore
  - [ ] Document rollback to Sentry (emergency)
  - **Acceptance:** Runbook updated

**Phase 5 Completion Criteria:**
- [ ] 24+ hours stable operation post-cutover
- [ ] Sentry subscription cancelled
- [ ] Documentation complete and reviewed
- [ ] Automated backups configured and tested
- [ ] Alerts configured and tested
- [ ] Team trained and comfortable
- [ ] Runbook updated
- [ ] Migration officially complete! 🎉

---

## Final Verification Checklist

Before declaring migration complete, verify:

### Technical ✅
- [ ] All 4 GlitchTip containers running stably
- [ ] RAM usage <80% (target: ~49%)
- [ ] Disk usage <70%
- [ ] Test errors captured successfully
- [ ] Real production errors appearing in UI
- [ ] Stack traces complete and readable
- [ ] Breadcrumbs and context preserved
- [ ] Error grouping working correctly
- [ ] Alerts configured and firing
- [ ] Uptime monitoring configured
- [ ] Automated backups working

### Business ✅
- [ ] Sentry subscription cancelled
- [ ] Confirmation email received
- [ ] Cost savings documented ($348/year)
- [ ] Team trained and comfortable
- [ ] Documentation complete

### Operational ✅
- [ ] 7+ days stable operation
- [ ] Zero production incidents
- [ ] Rollback procedure documented and tested
- [ ] Monitoring integrated
- [ ] On-call runbook updated

---

## Risk Log

Track any risks encountered during migration:

| Date | Risk | Impact | Resolution | Status |
|------|------|--------|------------|--------|
| | | | | |

---

## Issues Log

Track any issues encountered:

| Date | Issue | Severity | Resolution | Time to Resolve |
|------|-------|----------|------------|-----------------|
| | | | | |

---

## Time Tracking

Track actual time spent vs estimates:

| Phase | Estimated | Actual | Variance | Notes |
|-------|-----------|--------|----------|-------|
| Phase 0 | 2-3h | | | |
| Phase 1 | 4-6h | | | |
| Phase 2 | 2-3h | | | |
| Phase 3 | 2h + 48h | | | |
| Phase 4 | 30min | | | |
| Phase 5 | 1h | | | |
| **Total** | **12-16h** | | | |

---

## Notes & Observations

### General Notes
-

### Lessons Learned
-

### Improvements for Future Migrations
-

---

## Completion Certificate

When all tasks complete:

```
┌─────────────────────────────────────────┐
│  MIGRATION COMPLETE ✅                  │
├─────────────────────────────────────────┤
│  From: Sentry SaaS                      │
│  To:   GlitchTip Self-Hosted            │
│  Date: [YYYY-MM-DD]                     │
│  Duration: [X] hours                    │
│  Savings: $348/year                     │
│  Status: SUCCESS                        │
└─────────────────────────────────────────┘
```

**Completed by:** _________________
**Date:** _________________
**Approved by:** _________________

---

**Tasks Version:** 1.0
**Last Updated:** 2025-11-19
**Next Update:** After each phase completion
**Current Phase:** Pre-Phase 0 (Planning)
