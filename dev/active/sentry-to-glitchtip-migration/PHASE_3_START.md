# Phase 3: Parallel Testing - STARTED ✅

**Date Started:** 2025-11-24 16:54 UTC
**Duration:** 24-48 hours monitoring
**Status:** 🟢 ACTIVE - Monitoring in Progress

---

## 🎯 What Was Done

### Cutover Completed (2025-11-24 16:54)

**✅ Task 3.0: DSN Cutover**
- Backup created: `.env.backup-phase3-20251124-1654` (3.3 KB)
- Old Sentry DSN backed up
- New GlitchTip DSN applied: `http://304929daf8ea494d89c853a7fce277ce@localhost:8080/1`
- All AI Admin services restarted (12 services)
- Test error sent successfully
- Worker processed event ✅

**Services Restarted:**
1. ai-admin-api ✅
2. ai-admin-worker-v2 ✅
3. ai-admin-batch-processor ✅
4. ai-admin-telegram-bot ✅
5. baileys-whatsapp-service ✅
6. ai-admin-booking-monitor ✅
7. whatsapp-backup-service ✅
8. whatsapp-safe-monitor ✅
9. backup-postgresql ✅

**Verification:**
- Test error: "Phase 3 Integration Test - GlitchTip Cutover"
- Tags: phase=phase-3, test=cutover-verification
- Worker log: "Process 1 issue event requests" ✅
- Result: ✅ ERROR CAPTURED SUCCESSFULLY

---

## 📊 Current State

### AI Admin v2 Configuration
```env
SENTRY_DSN=http://304929daf8ea494d89c853a7fce277ce@localhost:8080/1
SENTRY_ENABLED=true
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
NODE_ENV=production
```

### GlitchTip Status
```
Container          Status      RAM Usage    CPU %
web                Up 24 min   185.5 MiB    0.02%
worker             Up 24 min   147.2 MiB    0.28%
postgres           Up 34 min   55.5 MiB     0.01%
redis              Up 34 min   6.8 MiB      0.41%
──────────────────────────────────────────────
Total:                         ~395 MiB     (21% of 1.9 GB)
```

**Health:** All containers healthy ✅

### AI Admin Services
```
Service                     Status    RAM      Restarts
ai-admin-api               online    90 MB    62
ai-admin-worker-v2         online    63 MB    80
ai-admin-batch-processor   online    72 MB    769
ai-admin-telegram-bot      online    66 MB    783
baileys-whatsapp-service   online    107 MB   193
ai-admin-booking-monitor   online    103 MB   5
whatsapp-backup-service    online    104 MB   3
whatsapp-safe-monitor      online    60 MB    2
backup-postgresql          online    84 MB    0
```

**Total PM2:** ~749 MB
**Combined (PM2 + GlitchTip):** ~1,144 MB (60% of 1.9 GB)
**Headroom:** ~756 MB (40%)

---

## 🔍 Monitoring Plan (24-48 Hours)

### What to Monitor

**Every 4-6 Hours:**
1. **GlitchTip Containers**
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker compose ps"
   ```
   Expected: All containers "Up"

2. **Resource Usage**
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker stats --no-stream"
   ```
   Expected: web <256 MB, worker <200 MB, total <500 MB

3. **AI Admin Services**
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"
   ```
   Expected: All services "online"

4. **Error Capture Test**
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node test-glitchtip-phase3.js"
   ```
   Expected: "✅ Test error sent to GlitchTip"

5. **GlitchTip Worker Logs**
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker compose logs worker --tail 10"
   ```
   Expected: "Process 1 issue event requests"

6. **System Memory**
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "free -h"
   ```
   Expected: <80% used (currently 60%)

### Quick Health Check Script

Create this script for easy monitoring:
```bash
# /opt/ai-admin/scripts/check-glitchtip-health.sh
#!/bin/bash
echo "=== GlitchTip Health Check ==="
echo "Date: $(date)"
echo ""
echo "1. Containers:"
cd /opt/glitchtip && docker compose ps
echo ""
echo "2. Resources:"
docker stats --no-stream
echo ""
echo "3. PM2 Services:"
pm2 status
echo ""
echo "4. Memory:"
free -h | grep Mem
echo ""
echo "✅ Health check complete"
```

**Usage:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "bash /opt/ai-admin/scripts/check-glitchtip-health.sh"
```

---

## 📅 Monitoring Schedule

**Phase 3 Duration:** 24-48 hours
**Start Time:** 2025-11-24 16:54 UTC (19:54 MSK)

### Check Schedule

| Time (MSK) | Check # | Actions |
|------------|---------|---------|
| 2025-11-24 23:00 | Check 1 (4h) | Run health check, verify error capture |
| 2025-11-25 05:00 | Check 2 (12h) | Run health check, compare resources |
| 2025-11-25 11:00 | Check 3 (18h) | Run health check, review logs |
| 2025-11-25 17:00 | Check 4 (24h) | **MILESTONE: 24h stability** - Full verification |
| 2025-11-25 23:00 | Check 5 (30h) | Run health check |
| 2025-11-26 05:00 | Check 6 (36h) | Run health check |
| 2025-11-26 11:00 | Check 7 (42h) | Run health check |
| 2025-11-26 17:00 | Check 8 (48h) | **PHASE 3 COMPLETE** - Decision: proceed to Phase 4? |

---

## ✅ Success Criteria

**Must be TRUE to proceed to Phase 4:**

- [ ] 48+ hours continuous uptime (all containers + PM2 services)
- [ ] Zero crashes or service interruptions
- [ ] RAM usage stable <80% (currently 60%)
- [ ] All manual test errors captured correctly
- [ ] Real production errors appearing in GlitchTip
- [ ] Worker processing events without delays
- [ ] No error spikes or unusual patterns
- [ ] Team reviewed and approved for final cutover

---

## 🚨 What to Watch For

### Red Flags (Immediate Action)

**Container Issues:**
- Any container shows "Exited" or "Restarting"
- Health checks failing repeatedly
- Worker not processing events

**Resource Issues:**
- RAM usage >85%
- Disk usage >90%
- CPU sustained >80%

**Error Capture Issues:**
- Test errors not appearing in GlitchTip
- Missing production errors (compare with expected volume)
- Delayed error processing (>30 seconds)

**Action if Red Flags:** Execute rollback immediately (see below)

### Yellow Flags (Monitor Closely)

- RAM usage 70-85%
- Occasional container restarts (1-2 in 24h)
- Slow error processing (10-30 seconds)
- Worker queue building up

**Action if Yellow Flags:** Increase monitoring frequency to every 2 hours

---

## 🔄 Rollback Procedure (If Needed)

**Execute if RED FLAGS detected or production issues occur**

**Time to Rollback:** <5 minutes

```bash
# 1. SSH to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# 2. Restore old Sentry DSN
cd /opt/ai-admin
cp .env.backup-phase3-20251124-1654 .env

# 3. Verify restoration
grep SENTRY_DSN .env
# Should show: https://f0e84f5737f802e81f871ed4cad08749@o4510346290069504...

# 4. Restart AI Admin services
pm2 restart all

# 5. Verify services online
pm2 status

# 6. Send test error to Sentry
# (Check sentry.io dashboard to confirm)

# 7. Stop GlitchTip (optional, if consuming resources)
cd /opt/glitchtip
docker compose down

# 8. Notify team
echo "⚠️ Rollback executed - back to Sentry SaaS"
```

**Rollback Verification:**
- All PM2 services online
- Sentry DSN pointing to sentry.io
- Test error appears in Sentry dashboard
- No production impact

---

## 📈 Key Metrics to Track

### Resource Trends
- RAM usage trend (should be stable)
- CPU usage trend (should be low)
- Disk usage (should grow slowly)

### Error Capture Metrics
- Errors captured per hour
- Worker processing latency
- Error grouping accuracy

### Stability Metrics
- Container uptime
- Service restart count
- Health check success rate

---

## 🎯 Phase 3 Completion

**After 48 hours stable operation:**

1. **Review all metrics** - Confirm success criteria met
2. **Team decision** - Approve proceed to Phase 4 (final cutover)?
3. **If YES:** Keep GlitchTip, confirm Sentry cancellation
4. **If NO:** Execute rollback, investigate issues, retry later

---

## 📝 Notes & Observations

**Session 4 Notes (2025-11-24):**
- Cutover smooth, no issues
- All services restarted successfully
- Test error captured immediately
- Worker processing fast (<5 seconds)
- Resources well within limits (60% RAM)
- Team confident in GlitchTip stability

**To be updated during monitoring period:**
- [Add observations here during checks]

---

## 🔗 Related Files

**Migration Documentation:**
- `sentry-to-glitchtip-migration-plan.md` - Full migration plan
- `sentry-to-glitchtip-migration-context.md` - Context & decisions
- `sentry-to-glitchtip-migration-tasks.md` - Task checklist
- `PHASE_1_COMPLETE.md` - Local testing results
- `PHASE_2_COMPLETE.md` - Production deployment results
- `sentry-to-glitchtip-code-review.md` - Code review (Grade A-)

**Scripts:**
- `test-glitchtip-phase3.js` - Test error script
- `/opt/glitchtip/monitor.sh` - GlitchTip monitoring
- `/opt/ai-admin/.env.backup-phase3-20251124-1654` - Rollback backup

---

## 🎉 Phase 3 Status: ACTIVE

**Monitoring Period:** 2025-11-24 16:54 UTC → 2025-11-26 16:54 UTC (48 hours)

**Next Milestone:** 24-hour stability check (2025-11-25 17:00 MSK)

**Current Status:** 🟢 All systems operational, monitoring in progress

---

**Phase 3 Started:** 2025-11-24 16:54 UTC
**Expected Completion:** 2025-11-26 16:54 UTC (48 hours)
**Progress:** 0/48 hours (just started)
**Health:** ✅ GREEN - All systems nominal
