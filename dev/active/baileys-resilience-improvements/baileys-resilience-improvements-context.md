# Baileys PostgreSQL Resilience Improvements - Context

**Last Updated:** November 19, 2025
**Status:** Planning
**Priority:** CRITICAL

---

## Quick Context

**What:** Implement emergency procedures and monitoring to improve WhatsApp session resilience after migrating to PostgreSQL-only storage.

**Why:** Code review identified critical gaps (Grade: A-, -9 points) in rollback capability, disaster recovery, and database health monitoring.

**When:** 3-phase implementation over 90 days (CRITICAL items within 7 days).

---

## Current State

### What Just Happened (Nov 19, 2025)

1. **Completed:** Removed all file-based Baileys session storage
   - Deleted 4.1 MB of session directories
   - Archived 61K lines of migration scripts
   - Cleaned up `session-pool.js` (-30 lines)

2. **Result:** PostgreSQL is now **only** auth provider
   - No file-based fallback
   - No quick rollback path
   - Single point of failure

### Production Status

```yaml
Database: Timeweb PostgreSQL
  Host: a84c973324fdaccfc68d929d.twc1.net:5432
  Tables:
    - whatsapp_auth: 1 record (company 962302)
    - whatsapp_keys: 1,313 records

Configuration:
  USE_REPOSITORY_PATTERN: true
  USE_LEGACY_SUPABASE: false

Services:
  - baileys-whatsapp-service: online, 96 MB
  - ai-admin-worker-v2: online, 104 MB
  - ai-admin-api: online, 189 MB

Uptime:
  - 11 days since PostgreSQL migration (Nov 8)
  - 6 minutes since cleanup deployment (Nov 19)
```

---

## Key Files

### Implementation Files

| File | Purpose | Status |
|------|---------|--------|
| `src/integrations/whatsapp/session-pool.js` | Main session manager | ✅ Cleaned (no file fallback) |
| `src/integrations/whatsapp/auth-state-timeweb.js` | PostgreSQL auth implementation | ✅ Production-ready |
| `src/database/postgres.js` | Database connection pool | ✅ Operational |
| `archive/baileys-file-sessions-scripts/` | Legacy file-based code | 📦 Archived (7 scripts) |

### Documentation Files

| File | Purpose |
|------|---------|
| `docs/03-development-diary/2025-11-19-baileys-file-sessions-cleanup.md` | Cleanup diary (585 lines) |
| `docs/01-architecture/whatsapp/WHATSAPP_SESSION_ARCHITECTURE.md` | Architecture docs (updated) |
| `docs/05-reports/cleanups/BAILEYS_FILE_SESSIONS_CLEANUP_SUMMARY.md` | Summary report (325 lines) |
| `dev/active/baileys-file-sessions-cleanup/baileys-file-sessions-cleanup-code-review.md` | Code review (37KB) |

### To Be Created

| File | Purpose | Task | Priority |
|------|---------|------|----------|
| `scripts/emergency/restore-file-sessions.js` | Emergency rollback | 1.1 | CRITICAL |
| `docs/02-guides/operations/EMERGENCY_RECOVERY_RUNBOOK.md` | Disaster recovery | 1.2 | CRITICAL |
| `scripts/monitoring/database-health.js` | Health monitoring | 2.1-2.4 | CRITICAL |
| `scripts/cleanup/cleanup-expired-session-keys.js` | Automated cleanup | 3.2 | HIGH |
| `scripts/backup/validate-backup.sh` | Backup validation | 4.4 | MEDIUM |

---

## Critical Dependencies

### External Services

```yaml
Timeweb PostgreSQL:
  Connection: a84c973324fdaccfc68d929d.twc1.net:5432
  Database: default_db
  User: gen_user
  SSL: Required (verify-full)
  Credentials: /root/.cloud-certs/root.crt

Sentry:
  Organization: Admin AI
  Project: ai-admin-v2
  Environment: production
  DSN: https://...

Telegram Bot:
  Token: <configured>
  Chat IDs: <configured>
  Alerts: Database issues, backup failures

S3 Storage (planned):
  Region 1: Moscow (primary)
  Region 2: EU (replica)
  Buckets: backups-moscow, backups-eu
```

### Internal Dependencies

- **PM2:** Process management and cron jobs
- **Git:** Version control and emergency rollback tags
- **Node.js:** Runtime (v18+)
- **PostgreSQL Client:** pg library (installed)

---

## Key Decisions

### Decision 1: PostgreSQL-Only Architecture ✅

**Date:** November 8-19, 2025
**Decision:** Remove file-based storage, use PostgreSQL exclusively
**Rationale:**
- Single source of truth
- Better monitoring and backups
- Industry best practice

**Trade-offs:**
- ❌ No quick rollback if PostgreSQL fails
- ❌ Single point of failure
- ✅ Simpler codebase (61K lines removed)
- ✅ Better scalability

**Mitigation:** This plan (emergency procedures + monitoring)

---

### Decision 2: In-Memory Cache for Resilience ⏳

**Date:** November 19, 2025 (planned)
**Decision:** Add 5-minute credential cache to tolerate short outages
**Rationale:**
- Prevents immediate failure if PostgreSQL unreachable
- Allows time to diagnose and fix issues
- Read-only mode prevents data divergence

**Trade-offs:**
- ❌ Memory usage increases (~2 MB per company)
- ❌ Credentials may be slightly stale
- ✅ Zero downtime for <5 minute outages
- ✅ Graceful degradation

**Implementation:** Task 3.1

---

### Decision 3: Multi-Region Backups ⏳

**Date:** November 19, 2025 (planned)
**Decision:** Store backups in 2+ geographic regions (Moscow + EU)
**Rationale:**
- Protects against datacenter loss
- Meets disaster recovery SLA (RPO <1 hour)
- Relatively low cost (~$2.30/month)

**Trade-offs:**
- ❌ Increased infrastructure cost
- ❌ More complex backup management
- ✅ Better disaster recovery
- ✅ Regulatory compliance (data residency)

**Implementation:** Task 4.1

---

## Constraints & Assumptions

### Technical Constraints

1. **PostgreSQL SLA:** 99.9% uptime (Timeweb guarantee)
   - Allows ~43 minutes downtime per month
   - In-memory cache must handle this

2. **Database Size Limit:** ~1 GB free tier
   - Current: 11 MB (whatsapp_auth + whatsapp_keys)
   - Projected (20 companies): ~220 MB
   - Automated cleanup required to prevent growth

3. **Connection Pool Limit:** 21 max connections
   - Current: 3 active, 18 idle
   - Supports ~7 concurrent sessions per service
   - Scales to 20 companies without changes

### Business Constraints

1. **Downtime Tolerance:** <10 minutes per incident
   - Emergency rollback must complete in this window
   - Automated monitoring critical

2. **Data Loss Tolerance:** <1 hour (RPO)
   - Hourly WAL backups required
   - Point-in-time recovery needed

3. **Team Availability:** Small team (2-3 developers)
   - Automation critical for sustainability
   - Monthly testing must be scripted

### Assumptions

1. **Production Stability:** PostgreSQL will remain stable
   - Assumption validated: 11 days without issues
   - Risk: Future datacenter failures

2. **Backup Storage:** S3-compatible storage available
   - Assumption: Timeweb provides S3 or equivalent
   - Fallback: Local disk backups

3. **Team Training:** Team will be trained on procedures
   - Assumption: 1-2 hours training time available
   - Task 1.2 includes training

---

## Metrics & Monitoring

### Current Metrics (Baseline)

```yaml
Database:
  Size: 11 MB
  Rows (whatsapp_auth): 1
  Rows (whatsapp_keys): 1,313
  Query Latency (avg): ~50ms (estimated)
  Connection Pool: 3/21 active

WhatsApp:
  Companies: 1 (962302)
  Sessions: 1 active
  Uptime: 11 days
  Messages: Unknown (not tracked)
```

### Target Metrics (After Implementation)

```yaml
Resilience:
  Emergency Rollback Time: <10 minutes
  DB Failure Tolerance: 5 minutes (in-memory cache)
  MTTD (Mean Time to Detect): <1 minute
  MTTR (Mean Time to Recover): <10 minutes

Monitoring:
  Query Latency P95: <200ms
  Query Latency P99: <500ms
  Slow Query Alerts: >500ms
  Connection Pool Alerts: >80% utilization
  Expired Keys Alerts: >500 keys

Backups:
  Frequency: Daily (full) + Hourly (WAL)
  Retention: 30 days daily, 12 months monthly
  Restoration Time: <30 minutes
  Restoration Testing: Monthly
  Validation: 100% (SHA256 + row count)
```

---

## Lessons Learned (From Cleanup)

### What Went Well ✅

1. **Migration Strategy:** 11-day validation before cleanup was perfect
   - Caught issues early
   - Confirmed PostgreSQL stability
   - Built confidence

2. **Documentation:** Comprehensive diary and reports
   - Easy to understand decisions
   - Clear rollback path (via git history)
   - Team can reference later

3. **Zero Downtime:** Cleanup had no production impact
   - Careful deployment
   - Tested in staging first
   - PM2 restart handled gracefully

### What Could Be Better ⚠️

1. **Rollback Planning:** Should have created emergency procedures BEFORE cleanup
   - Now: No quick rollback path
   - Fix: Task 1.1, 1.2, 1.3

2. **Monitoring Gaps:** No proactive database health alerts
   - Now: Reactive (wait for failures)
   - Fix: Task 2.1, 2.2, 2.3, 2.4

3. **Backup Testing:** Never tested restoration before cleanup
   - Now: Don't know if backups work
   - Fix: Task 4.2

### Apply to This Project

- ✅ Create emergency procedures FIRST (Phase 1)
- ✅ Implement monitoring BEFORE removing safeguards
- ✅ Test disaster recovery MONTHLY, not ad-hoc
- ✅ Document ALL decisions (this file)

---

## Open Questions

### Technical

1. **Q:** What happens if in-memory cache expires during outage?
   **A:** WhatsApp disconnects, emergency rollback required (Task 1.1)

2. **Q:** How do we handle PostgreSQL corruption vs temporary unavailability?
   **A:** Query latency monitoring + error type detection (Task 2.1)

3. **Q:** Can we restore from backup to new datacenter?
   **A:** Yes, with S3 multi-region backups (Task 4.1)

### Operational

4. **Q:** Who is on-call for database emergencies?
   **A:** TBD - need to establish rotation (Task 1.2 runbook)

5. **Q:** What is our RTO (Recovery Time Objective)?
   **A:** Target: <10 minutes (emergency rollback), <2 hours (full restore)

6. **Q:** How often should we test disaster recovery?
   **A:** Monthly (backups), Quarterly (full DR simulation)

---

## Next Steps (Immediate)

1. **Day 0 (Nov 19):** ✅ Plan approved, context documented
2. **Day 1 (Nov 20):** Start Task 1.1 (emergency rollback script)
3. **Day 2 (Nov 21):** Continue Task 1.1, start Task 1.2 (runbook)
4. **Day 3 (Nov 22):** Test emergency rollback (Task 1.3)
5. **Day 4-7 (Nov 23-26):** Database health monitoring (Tasks 2.1-2.4)

**Checkpoint:** Nov 26 - Review Phase 1 completion, plan Phase 2

---

## Team Communication

### Stakeholders

| Role | Name | Responsibility |
|------|------|----------------|
| **Product Owner** | TBD | Approve plan, budget |
| **Backend Lead** | TBD | Implement Tasks 2.x, 3.1 |
| **DevOps Lead** | TBD | Implement Tasks 1.x, 3.2, 4.x |
| **QA Lead** | TBD | Test Tasks 1.3, 4.2 |
| **Tech Writer** | TBD | Document Tasks 1.2, 4.3 |

### Status Updates

- **Daily:** Slack #dev-baileys channel
- **Weekly:** Monday standup (progress review)
- **Phase Complete:** Detailed report + demo

---

**Last Updated:** November 19, 2025
**Next Update:** November 26, 2025 (Phase 1 checkpoint)
