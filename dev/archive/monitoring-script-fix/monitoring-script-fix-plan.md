# Monitoring Script Fix - Comprehensive Plan

**Last Updated:** 2025-11-08
**Status:** In Progress
**Priority:** Medium (monitoring only, not blocking)
**Estimated Time:** 65-75 minutes

---

## Executive Summary

Fix Phase 0.7 monitoring script to correctly detect WhatsApp connection and Timeweb PostgreSQL usage after daily log rotation at 00:00.

**Problem:** Baileys doesn't restart daily, so doesn't write new log messages. After log rotation, monitoring script can't find old messages in current log file.

**Solution:** Check multiple sources (current log, archived log, .env file) to determine actual status.

---

## Current State Analysis

### What's Working
- ✅ Baileys actually using Timeweb PostgreSQL (verified via .env and E2E test)
- ✅ WhatsApp connected for 18+ hours (PID 870068 stable)
- ✅ No PostgreSQL errors
- ✅ System processing messages correctly

### What's Broken
- ❌ Monitoring reports "NOT using Timeweb" after 00:00
- ❌ Monitoring reports "No WhatsApp connection" after 00:00
- ❌ False negatives every morning

### Root Cause
PM2 rotates logs daily at 00:00:
```
baileys-service-out-8.log (current, starts empty at 00:00)
baileys-service-out-8__2025-11-07_00-00-00.log (yesterday, 41M)
baileys-service-out-8__2025-11-08_00-00-00.log (today's archived, 42M)
```

Baileys writes "Using Timeweb PostgreSQL" only at startup. If no restart → no new messages → monitoring finds nothing in current log.

---

## Proposed Future State

### Updated Detection Logic

**WhatsApp Connection Check:**
1. Check current log (`baileys-service-out-8.log`)
2. If not found → check yesterday's archived log
3. If found in either → ✅ connected
4. Additional: if same PID as yesterday → still connected

**Timeweb PostgreSQL Check (Option A - Recommended):**
```bash
# Direct .env check - most reliable
if grep -q "USE_LEGACY_SUPABASE=false" /opt/ai-admin/.env; then
    log_success "Using Timeweb (env verified)"
fi
```

**Timeweb PostgreSQL Check (Option B - Log-based):**
```bash
# Check current log first
TIMEWEB_COUNT=$(tail -20000 "$LOG_FILE_OUT" | grep -c "Using Timeweb PostgreSQL")

# If not found, check yesterday's archived log
if [[ "$TIMEWEB_COUNT" -eq 0 ]]; then
    YESTERDAY_LOG=$(ls -1 /opt/ai-admin/logs/baileys-service-out-8__*.log 2>/dev/null | tail -1)
    if [[ -f "$YESTERDAY_LOG" ]]; then
        TIMEWEB_COUNT=$(tail -20000 "$YESTERDAY_LOG" | grep -c "Using Timeweb PostgreSQL")
    fi
fi
```

---

## Implementation Phases

### Phase 1: Create Dev Docs (15 min) ✅

**Tasks:**
- [x] Create `dev/active/monitoring-script-fix/` directory
- [x] Create `monitoring-script-fix-plan.md`
- [x] Create `monitoring-script-fix-context.md`
- [x] Create `monitoring-script-fix-tasks.md`

---

### Phase 2: Update Monitoring Script (20-30 min)

**File:** `scripts/monitor-phase07-timeweb.sh`

**Changes:**

**2.1 WhatsApp Connection (lines 126-139)**
```bash
if [[ -f "$LOG_FILE_OUT" ]]; then
    # Check current log
    CONNECTION_COUNT=$(tail -20000 "$LOG_FILE_OUT" | grep -c "WhatsApp connected for company 962302" 2>/dev/null || echo "0")
    CONNECTION_COUNT=$(echo "$CONNECTION_COUNT" | tr -d '\n\r' | tr -d ' ')

    # If not found in current, check yesterday's archived log
    if [[ "$CONNECTION_COUNT" -eq 0 ]]; then
        YESTERDAY_LOG=$(ls -1t /opt/ai-admin/logs/baileys-service-out-8__*.log 2>/dev/null | head -1)
        if [[ -n "$YESTERDAY_LOG" && -f "$YESTERDAY_LOG" ]]; then
            CONNECTION_COUNT=$(tail -20000 "$YESTERDAY_LOG" | grep -c "WhatsApp connected for company 962302" 2>/dev/null || echo "0")
            CONNECTION_COUNT=$(echo "$CONNECTION_COUNT" | tr -d '\n\r' | tr -d ' ')
        fi
    fi

    if [[ "$CONNECTION_COUNT" =~ ^[0-9]+$ ]] && [[ "$CONNECTION_COUNT" -gt 0 ]]; then
        log_success "WhatsApp is connected ($CONNECTION_COUNT connection(s) found)"
    else
        log_error "No recent WhatsApp connection found!"
    fi
fi
```

**2.2 Timeweb PostgreSQL (lines 167-179) - Option A (Recommended)**
```bash
# Check .env file directly - most reliable
if [[ -f "/opt/ai-admin/.env" ]]; then
    if grep -q "^USE_LEGACY_SUPABASE=false" /opt/ai-admin/.env; then
        log_success "Baileys is using Timeweb PostgreSQL (verified via .env)"
        # Also show when it was initialized (from logs if available)
        TIMEWEB_TIME=$(tail -20000 "$LOG_FILE_OUT" 2>/dev/null | grep "Using Timeweb PostgreSQL" | tail -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}' || echo '')
        if [[ -z "$TIMEWEB_TIME" ]]; then
            # Check yesterday's log
            YESTERDAY_LOG=$(ls -1t /opt/ai-admin/logs/baileys-service-out-8__*.log 2>/dev/null | head -1)
            if [[ -n "$YESTERDAY_LOG" && -f "$YESTERDAY_LOG" ]]; then
                TIMEWEB_TIME=$(tail -20000 "$YESTERDAY_LOG" | grep "Using Timeweb PostgreSQL" | tail -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}' || echo 'recent')
            fi
        fi
        if [[ -n "$TIMEWEB_TIME" ]]; then
            log "   Last initialized: $TIMEWEB_TIME"
        fi
    else
        log_error "Baileys is NOT using Timeweb PostgreSQL! (.env shows USE_LEGACY_SUPABASE=true)"
        send_telegram_alert "Baileys not using Timeweb - env rollback detected!"
    fi
else
    log_warning "Cannot verify Timeweb usage - .env file not found"
fi
```

---

### Phase 3: Test Updated Script (10 min)

**Local Test:**
```bash
# Copy to VPS
scp -i ~/.ssh/id_ed25519_ai_admin scripts/monitor-phase07-timeweb.sh root@46.149.70.219:/opt/ai-admin/scripts/

# Run manually
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && ./scripts/monitor-phase07-timeweb.sh"
```

**Expected Output:**
```
✅ Service is online
✅ Memory usage is normal
✅ WhatsApp is connected (2 connection(s) found)
✅ Baileys is using Timeweb PostgreSQL (verified via .env)
✅ No PostgreSQL errors found
```

---

### Phase 4: Deploy to Production (5 min)

**Steps:**
1. ✅ Script already copied to VPS during testing
2. Verify cron job configured: `crontab -l | grep phase07`
3. Wait for next automatic run (16:00) to verify
4. Check logs: `tail /var/log/ai-admin/phase07-monitor-cron.log`

---

### Phase 5: Update Documentation (10 min)

**Files to update:**

**1. database-migration-completion-context.md:**
- Update "Monitoring Script" section
- Mark as "FULLY FIXED"
- Document log rotation solution

**2. PHASE_0.7_COMPLETION_SUMMARY.md:**
- Update monitoring status
- Add note about log rotation fix

---

### Phase 6: Git Commit (5 min)

```bash
git add scripts/monitor-phase07-timeweb.sh
git add dev/active/monitoring-script-fix/
git add dev/active/database-migration-completion/*.md

git commit -m "fix: monitoring script handles log rotation correctly

Problem: Daily log rotation at 00:00 caused false negatives
- Baileys doesn't restart daily, so doesn't write new log messages
- Monitoring only checked current log file
- Result: False negatives every morning

Solution: Multi-source verification
- WhatsApp check: Search both current and archived logs
- Timeweb check: Verify .env file directly (USE_LEGACY_SUPABASE=false)
- Fallback: Check yesterday's archived log if current empty

Testing:
✅ Manual run shows all green
✅ Verified .env detection works
✅ Verified archived log search works

Next cron run: 16:00 (will verify automated execution)
"

git push origin main
```

---

## Risk Assessment

**Risk Level:** 🟢 **LOW**

**Why:**
- Monitoring-only change (no production code affected)
- No database changes
- No service restarts required
- Can rollback by reverting single file

**Mitigation:**
- Test thoroughly before deploy
- Keep old script as backup
- Monitor next automatic cron run

---

## Success Metrics

**Immediate (after deploy):**
- ✅ Manual script run shows all green
- ✅ No false negatives for WhatsApp connection
- ✅ No false negatives for Timeweb usage

**24-Hour (after next 6 cron runs):**
- ✅ All automated runs show green
- ✅ No Telegram alerts for false positives
- ✅ Monitoring log shows consistent results

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| 1. Dev docs | 15 min | ✅ Complete |
| 2. Update script | 20-30 min | ⏳ In Progress |
| 3. Test | 10 min | 🔲 Pending |
| 4. Deploy | 5 min | 🔲 Pending |
| 5. Docs | 10 min | 🔲 Pending |
| 6. Commit | 5 min | 🔲 Pending |
| **Total** | **65-75 min** | |

---

## Dependencies

**Prerequisites:**
- ✅ SSH access to VPS
- ✅ Monitoring script exists
- ✅ .env file on VPS

**Blocked By:** None

**Blocks:** Phase 1 migration (not a hard blocker, but good to have reliable monitoring)

---

## Next Steps

**After this fix:**
1. Monitor for 24 hours to confirm stability
2. Mark Phase 0.7 as "Production Stable with Reliable Monitoring"
3. Proceed to Phase 1 migration planning

---

**Last Updated:** 2025-11-08
**Owner:** Claude Code
**Reviewer:** vosarsen
