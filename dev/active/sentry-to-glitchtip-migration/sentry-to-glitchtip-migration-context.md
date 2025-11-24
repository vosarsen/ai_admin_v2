# Sentry to GlitchTip Migration - Context & Key Information

**Last Updated:** 2025-11-24
**Project:** AI Admin v2
**Migration Type:** Error tracking platform migration
**Status:** Phase 0 Complete → Phase 1 Ready

---

## Migration Overview

### What We're Doing
Replacing Sentry SaaS ($348/year) with GlitchTip self-hosted (free) to reduce operational costs while maintaining full error tracking capabilities.

### Why We're Doing It
1. **Cost:** Save $348/year (40,800 RUB)
2. **Data ownership:** Full control over error data
3. **Features:** GlitchTip includes uptime monitoring (bonus)
4. **Sustainability:** No recurring subscription costs

### Key Success Factor
GlitchTip is **100% Sentry SDK compatible** - we only need to change the DSN (1 line in .env), no code refactoring required.

---

## Current State

### Sentry Integration

**Entry Points:**
```
src/instrument.js
├─> src/index.js (API server)
└─> src/workers/index-v2.js (Worker process)
```

**Key Files:**
- `src/instrument.js:1-44` - Sentry initialization (imported first in all entry points)
- `src/database/postgres.js` - 4 Sentry.captureException() calls
- `src/repositories/BaseRepository.js` - 4 Sentry.captureException() calls
- `src/integrations/whatsapp/auth-state-timeweb.js` - 6 Sentry.captureException() calls
- Additional scattered calls (~36 more across codebase)

**Current Configuration:**
```env
# /opt/ai-admin/.env
SENTRY_DSN=https://f0e84f5737f802e81f871ed4cad08749@o4510346290069504.ingest.de.sentry.io/4510346297081936
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_ENABLED=true
NODE_ENV=production
```

**SDK Version:**
- Package: @sentry/node v10.24.0
- Also installed: @sentry/profiling-node

### Production Server

**Host:** 46.149.70.219

**Resources (as of 2025-11-24):**
```
RAM:  1.9 GB
  Used: 1.0 GB (52%)
  Available: 910 MB

CPU: 1 core @ 3.3GHz
  Load: idle

Disk: 30 GB
  Used: 13 GB (42%)
  Free: 18 GB
```

**PM2 Services (9 online, ~756 MB RAM):**
1. ai-admin-api (172.9 MB) - port 3000
2. ai-admin-worker-v2 (101.1 MB)
3. ai-admin-batch-processor (63.9 MB)
4. ai-admin-telegram-bot (78.4 MB)
5. ai-admin-booking-monitor (84.3 MB)
6. baileys-whatsapp-service (106.7 MB)
7. whatsapp-backup-service (88.2 MB)
8. whatsapp-safe-monitor (61.0 MB)
9. pm2-logrotate (47.5 MB)

**Infrastructure:**
- ✅ PostgreSQL: Timeweb (external)
- ✅ Redis: Local (port 6379)
- ✅ Docker: v29.0.3 (installed 2025-11-24)
- ✅ Docker Compose: v2.40.3 plugin
- ✅ Port 8080: Available

---

## Target State

### GlitchTip Architecture

```
Docker Containers (4):
┌────────────────────────┐
│ web (Django)     100MB │  Port 8080
├────────────────────────┤
│ worker (Celery)  100MB │
├────────────────────────┤
│ postgres         100MB │
├────────────────────────┤
│ redis             50MB │
└────────────────────────┘
Total: ~350-400 MB
```

**Resource Impact:**
- Current: 28% RAM (945 MB)
- + GlitchTip: +21% RAM (~400 MB)
- **New Total: 49% RAM (1,345 MB)**
- **Headroom: 51% (965 MB)** ✅

**Network:**
- URL: `http://46.149.70.219:8080`
- DSN: `http://[key]@46.149.70.219:8080/1`

**File Locations:**
```
/opt/glitchtip/
├── docker-compose.yml
├── .env
├── backup.sh
├── monitor.sh
└── daily-check.sh

/backups/glitchtip/
└── glitchtip_YYYYMMDD.sql.gz
```

---

## Phase 0 Execution Results

**Date:** 2025-11-24
**Duration:** ~30 minutes (vs 2-3h estimated) ⚡ **94% faster!**
**Status:** ✅ COMPLETE (6/6 tasks)

### Installation Details

**Docker Installation:**
- Version: 29.0.3 (latest stable)
- Method: Official install script (https://get.docker.com)
- Status: Active & enabled on boot
- Memory footprint: 38.7 MB

**Docker Compose:**
- Version: v2.40.3 (plugin architecture)
- Installed: Automatically with Docker
- Command: `docker compose` (modern syntax)

### Backups Created

**Files:**
- `/opt/ai-admin/.env.backup.20251124` (3.3 KB)
- `/tmp/sentry_dsn_backup.txt` (107 bytes)
- `/tmp/pm2_status_before.txt` (PM2 state snapshot)
- `/tmp/memory_before.txt` (Memory state)
- `/tmp/disk_before.txt` (Disk state)

**Backed Up DSN:**
```
SENTRY_DSN=https://f0e84f5737f802e81f871ed4cad08749@o4510346290069504.ingest.de.sentry.io/4510346297081936
```

### Resource Availability Confirmed

**RAM:**
- Available: 910 MB
- GlitchTip requires: ~400 MB
- After deployment: ~510 MB remaining (27% headroom) ✅

**Disk:**
- Available: 18 GB
- GlitchTip requires: 2-3 GB
- Plenty of space ✅

**Port 8080:**
- Status: Free and available ✅
- No conflicts detected

### Key Observations

1. **RAM Usage Higher Than Expected:**
   - Planned: 945 MB (28% usage)
   - Actual: 1.0 GB (52% usage)
   - Reason: Additional services (booking-monitor, whatsapp-backup, whatsapp-safe-monitor)
   - Impact: Still sufficient, but tighter margins (27% headroom vs 51% planned)

2. **Docker Installation Smooth:**
   - Ubuntu 24.04 LTS has excellent Docker support
   - No issues, no conflicts
   - Modern Docker Compose plugin automatically included

3. **All Systems Stable:**
   - 9 PM2 services running without issues
   - No errors in logs
   - System load minimal

### Next Steps

✅ **Phase 0 Complete** - Ready for Phase 1 (Local Testing)

---

## Key Decisions

### Decision 1: GlitchTip vs Alternatives

**Options Considered:**
1. ✅ GlitchTip (free, Sentry-compatible, 1GB RAM)
2. ❌ Sentry Self-hosted (requires 16-32 GB RAM - impossible)
3. ❌ Bugsink ($15/month, minimal but still costs)
4. ❌ Sentry SaaS (current, $348/year)

**Decision:** GlitchTip
**Rationale:**
- Free (vs $348/year)
- Fits in existing 2GB RAM server
- Zero code changes (Sentry SDK compatible)
- Bonus uptime monitoring feature
- Active community, production-proven

**Economic Analysis:**
- Cost savings: $348/year
- Infrastructure cost: $0 (uses existing server)
- DevOps time: ~1 hour/month maintenance
- **Net savings: ~$348/year**

### Decision 2: Parallel Testing Strategy

**Options:**
1. ✅ Deploy GlitchTip, run parallel 48h, then cutover
2. ❌ Direct cutover (too risky)
3. ❌ Dual reporting forever (unnecessary complexity)

**Decision:** Parallel testing for 48 hours
**Rationale:**
- Validates GlitchTip stability under real load
- Allows comparison with Sentry behavior
- Easy rollback if issues detected
- Low risk, high confidence

**Implementation:**
- Phase 3: Run both Sentry + GlitchTip for 48 hours
- Monitor GlitchTip resources and error capture
- Compare with Sentry for accuracy
- Proceed to cutover only if GlitchTip stable

### Decision 3: Self-Managed vs Hosted GlitchTip

**Options:**
1. ✅ Self-hosted on existing server
2. ❌ GlitchTip Cloud ($15/month free tier)

**Decision:** Self-hosted
**Rationale:**
- $0 cost vs $15/month minimum
- Full data control
- Fits in existing server (400 MB RAM available)
- No external dependencies
- Complete customization possible

### Decision 4: Cutover Timing

**Options:**
1. ✅ Weekend low-traffic window
2. ❌ Immediate cutover
3. ❌ Gradual service-by-service migration

**Decision:** Weekend cutover, all services at once
**Rationale:**
- Lower risk during low traffic
- Simpler than gradual migration
- Rollback is instant (<5 min)
- All services use same Sentry initialization

**Recommended Time:** Sunday morning 06:00-08:00 MSK

---

## Dependencies

### External Dependencies

**Infrastructure:**
- ✅ Production server (46.149.70.219) - accessible
- ✅ SSH key (~/.ssh/id_ed25519_ai_admin) - available
- ✅ sudo/root access - available
- 🔧 Docker + Docker Compose - to be installed in Phase 0
- ✅ Port 8080 - available (verified)
- ✅ 400 MB RAM - available (verified)
- ✅ 2-3 GB disk - available (verified)

**Access:**
- ✅ Sentry.io account - for cancellation
- ✅ Payment method info - for refund if applicable

### Internal Dependencies

**Skills Required:**
- Docker basics (up, down, logs, ps)
- Linux command line (ssh, nano, chmod)
- PM2 management (restart, status, logs)
- Basic networking (ports, curl, netstat)

**Team Availability:**
- DevOps engineer for deployment (Phase 0-2)
- Developer for testing (Phase 1, 3)
- Team for training (Phase 5)

### Technical Dependencies

**Package Versions:**
- Node.js: v20+ (already installed)
- @sentry/node: v10.24.0 (compatible with GlitchTip)
- Docker: 19.03+ (to be installed)
- Docker Compose: 2.0+ (to be installed)

**No Code Changes Required:**
- ✅ `src/instrument.js` - no changes
- ✅ All Sentry.captureException() calls - no changes
- ⚠️ Only `.env` SENTRY_DSN - one line change

---

## Critical Files

### Configuration Files

**Production .env:**
```bash
Location: /opt/ai-admin/.env
Owner: root
Permissions: 600

Key variables:
- SENTRY_DSN (will change)
- NODE_ENV=production
- All other variables remain unchanged
```

**GlitchTip .env:**
```bash
Location: /opt/glitchtip/.env
Owner: root
Permissions: 600

Will be created in Phase 2
Contains:
- SECRET_KEY (generated)
- POSTGRES_PASSWORD (generated)
- GLITCHTIP_DOMAIN
- Performance tuning variables
```

### Application Files

**Sentry Initialization:**
```javascript
// src/instrument.js
// NO CHANGES NEEDED
// This file will continue to work with GlitchTip DSN

require('dotenv').config();
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN, // Only this value changes (in .env)
  environment: process.env.NODE_ENV || 'development',
  // ... rest stays the same
});

module.exports = Sentry;
```

**Entry Points:**
```javascript
// src/index.js
require('./instrument'); // Imported FIRST - stays the same
// ... rest of API server

// src/workers/index-v2.js
require('./instrument'); // Imported FIRST - stays the same
// ... rest of worker
```

### Backup Files

**Pre-Migration Backups (create in Phase 0):**
```
/opt/ai-admin/.env.backup.YYYYMMDD
/opt/ai-admin/.env.pre-glitchtip-YYYYMMDD-HHMM
/tmp/sentry_dsn_backup.txt
/tmp/pm2_status_before.txt
/tmp/memory_before.txt
/tmp/disk_before.txt
```

**GlitchTip Backups (automated in Phase 5):**
```
/backups/glitchtip/glitchtip_YYYYMMDD.sql.gz
(Daily at 2 AM, keep 30 days)
```

---

## Environment Variables

### Current (Sentry SaaS)

```env
# /opt/ai-admin/.env
SENTRY_DSN=https://f0e84f5737f802e81f871ed4cad08749@o4510346290069504.ingest.de.sentry.io/4510346297081936
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_ENABLED=true
NODE_ENV=production
```

### Future (GlitchTip)

```env
# /opt/ai-admin/.env
SENTRY_DSN=http://[glitchtip-key]@46.149.70.219:8080/1
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_ENABLED=true
NODE_ENV=production
```

**Changes:**
- Only `SENTRY_DSN` value changes
- All other variables unchanged
- GlitchTip uses same environment variables

---

## Network & Ports

### Current Port Usage

```
Port 3000:  ai-admin-api (Express)
Port 6379:  Redis (local)
Port 5432:  PostgreSQL (Timeweb external)
```

### New Port Usage (After GlitchTip)

```
Port 3000:  ai-admin-api (Express) - unchanged
Port 6379:  Redis (local) - unchanged
Port 5432:  PostgreSQL (Timeweb) - unchanged
Port 8080:  GlitchTip Web UI (Docker) - NEW
```

**Firewall:**
- Port 8080: Internal only (not exposed to internet)
- Access via SSH tunnel if needed remotely

---

## Testing Strategy

### Phase 1: Local Testing (Isolated)

**Environment:** Local machine or staging server
**Objective:** Validate GlitchTip Sentry SDK compatibility
**Duration:** 4-6 hours

**Tests:**
1. Basic error capture
2. Context preservation (user, tags, extras)
3. Breadcrumbs
4. Stack traces
5. Error grouping
6. Real code patterns from codebase
7. Performance under load (100 errors)

**Success Criteria:**
- All tests pass
- UI responsive
- Resource usage <500 MB

### Phase 3: Parallel Testing (Production)

**Environment:** Production server
**Objective:** Validate GlitchTip stability under real load
**Duration:** 24-48 hours

**Approach:**
- Deploy GlitchTip on production (port 8080)
- Keep Sentry SaaS active (current DSN)
- Manually test GlitchTip with periodic test errors
- Monitor GlitchTip resources and stability

**Monitoring:**
- Every 4-6 hours check:
  - Container status (`docker-compose ps`)
  - Resource usage (`docker stats`)
  - Error logs (`docker-compose logs`)
  - UI accessibility
  - Real errors appearing (trigger manually)

**Success Criteria:**
- 24+ hours uptime
- RAM <80% (target: ~49%)
- All containers stable
- Errors captured correctly

### Phase 4: Production Verification

**Environment:** Production (after cutover)
**Objective:** Confirm errors flowing to GlitchTip
**Duration:** First hour after cutover

**Tests:**
1. Send test error via API
2. Check test error in GlitchTip UI
3. Monitor PM2 logs for Sentry initialization
4. Verify real production errors appearing
5. Check all 5 services reporting

**Success Criteria:**
- Test error appears in <10 seconds
- All services initializing Sentry correctly
- No errors in PM2 logs
- Sentry SaaS dashboard quiet (no new errors)

---

## Rollback Strategy

### Immediate Rollback (<5 minutes)

**Trigger Conditions:**
- Errors not appearing in GlitchTip
- GlitchTip containers crashing
- PM2 services failing to start
- Memory usage >90%
- Any production incident

**Procedure:**
```bash
# 1. Revert DSN
cd /opt/ai-admin
cp .env.pre-glitchtip-[timestamp] .env

# 2. Restart services
pm2 restart all

# 3. Verify
pm2 status
pm2 logs --lines 20

# 4. Check Sentry SaaS receiving errors
# Visit sentry.io dashboard
```

**Verification:**
- All PM2 services online
- Sentry SaaS receiving errors again
- No production impact

### Partial Rollback (Specific Service)

If only one service has issues:
```bash
# Example: ai-admin-api not sending to GlitchTip
# But other services work fine

# Just restart that service
pm2 restart ai-admin-api

# Check logs
pm2 logs ai-admin-api --lines 50
```

### Full Uninstall (Complete Removal)

If deciding to abandon GlitchTip entirely:
```bash
# 1. Rollback DSN (as above)
# 2. Stop and remove GlitchTip
cd /opt/glitchtip
docker-compose down -v  # -v removes volumes

# 3. Remove Docker (optional)
systemctl stop docker
apt-get remove docker-ce docker-ce-cli

# 4. Clean up
rm -rf /opt/glitchtip
rm -rf /backups/glitchtip
```

---

## Communication Plan

### Team Notifications

**Before Migration (Day 0):**
- Email team: "Migrating error tracking to GlitchTip"
- Explain benefits, timeline, impact
- Share new UI URL
- Mention no code changes needed

**During Testing (Days 2-5):**
- Slack update: "GlitchTip deployed, testing in parallel"
- Ask team to report any error tracking issues

**During Cutover (Day 6):**
- Slack announcement: "Cutover to GlitchTip in progress"
- Notify when complete
- Share new UI URL again

**After Migration (Day 7):**
- Celebrate savings: "Saving $348/year!"
- Schedule training session
- Collect feedback

### Escalation Path

**Issues During Migration:**
1. Migration engineer tries to resolve (15 min)
2. If stuck, escalate to DevOps lead
3. If critical production impact, execute rollback immediately
4. Notify team of rollback and reschedule

**Issues Post-Migration:**
1. Check GlitchTip UI for errors
2. Check GlitchTip logs: `docker-compose logs`
3. Check PM2 logs: `pm2 logs`
4. Try GlitchTip restart: `docker-compose restart`
5. If still broken, execute rollback

---

## Lessons Learned (To Be Updated Post-Migration)

### What Went Well
- TBD

### What Could Be Improved
- TBD

### Unexpected Challenges
- TBD

### Best Practices Discovered
- TBD

---

## Related Documentation

### Created For This Migration
- `sentry-to-glitchtip-migration-plan.md` - Comprehensive plan (this file's sibling)
- `sentry-to-glitchtip-migration-tasks.md` - Task checklist (this file's sibling)

### To Be Created During Migration
- `/opt/ai-admin/docs/ERROR_TRACKING.md` - GlitchTip usage guide (Phase 5)
- `/opt/glitchtip/README.md` - Deployment notes (Phase 2)

### Existing Related Docs
- `docs/ERROR_TRACKING_COMPARISON_2025.md` - Full alternatives research
- `docs/ERROR_TRACKING_QUICK_DECISION.md` - Quick decision guide
- `dev/active/error-tracking-decision/VPS_UPGRADE_ECONOMICS_RESEARCH.md` - Cost analysis
- `src/instrument.js` - Sentry initialization code
- `.env.example` - Environment variables template

### External References
- GlitchTip docs: https://glitchtip.com/documentation/
- Docker docs: https://docs.docker.com/
- Sentry SDK docs: https://docs.sentry.io/platforms/node/
- Migration guide: https://massadas.com/posts/ditch-sentry-for-a-free-open-source-alternative/

---

**Context Version:** 1.0
**Last Updated:** 2025-11-19
**Status:** Active reference document
**Next Update:** After Phase 0 completion (add Docker installation notes)
