# Monitoring Script Fix - Context & Key Decisions

**Last Updated:** 2025-11-08 14:10 MSK
**Status:** In Progress
**Current Task:** Updating monitoring script logic

---

## Problem Context

### Discovery Timeline

**2025-11-07 20:50:** Initial monitoring script deployed
- Script worked correctly at deployment
- Showed: ✅ WhatsApp connected, ✅ Using Timeweb PostgreSQL

**2025-11-08 00:00:** First false negatives appeared
- Cron run at 00:00 showed: ❌ NOT connected, ❌ NOT using Timeweb
- Same false negatives at 04:00, 08:00, 12:00

**2025-11-08 14:00:** Root cause identified
- PM2 rotates logs daily at 00:00
- Baileys still running (PID 870068, 18+ hours uptime)
- Old messages moved to archived log file
- Monitoring only checks current log → false negatives

---

## Technical Details

### PM2 Log Rotation

**Log Files:**
```
/opt/ai-admin/logs/
├── baileys-service-out-8.log                           # Current (24M, starts empty at 00:00)
├── baileys-service-out-8__2025-11-07_00-00-00.log     # Yesterday (41M, archived)
└── baileys-service-out-8__2025-11-08_00-00-00.log     # Today's archived (42M)
```

**Rotation Schedule:** Daily at 00:00

**Impact:**
- Baileys writes "Using Timeweb PostgreSQL" only at startup
- Last startup: 2025-11-07 20:07
- Log rotated: 2025-11-08 00:00
- Result: Message in archived file, not in current file

### Actual System Status (Verified)

**Environment Variables:**
```bash
$ cat /opt/ai-admin/.env | grep USE_LEGACY
USE_DATABASE_AUTH_STATE=true
USE_LEGACY_SUPABASE=false  # ← Correct: using Timeweb
```

**Service Status:**
```
PID: 870068 (same since 2025-11-07 20:07)
Uptime: 18+ hours
Memory: 125 MB
Restarts: 0 (since deployment)
Status: online
```

**E2E Test (2025-11-08 14:00):**
```
Input: "Тест мониторинга Phase 0.7 - проверка Timeweb PostgreSQL"
Output: "Арсен, добрый день! Это тестовое сообщение от барбершопа KULTURA Малаховка..."
Processing: 5.3 seconds (Two-Stage + Gemini)
Result: ✅ SUCCESS
```

**Conclusion:** System IS working correctly. Monitoring has false negatives due to log rotation.

---

## Key Decisions

### Decision 1: Check .env File Directly

**Options Considered:**
1. **Option A:** Check .env file for `USE_LEGACY_SUPABASE=false` ✅ **CHOSEN**
2. Option B: Check both current and archived logs
3. Option C: Track service PID and assume no change if no restart

**Reasoning:**
- .env is source of truth for configuration
- Most reliable - doesn't depend on log messages
- Simplest implementation
- Detects actual rollback (if .env changed to `true`)

**Implementation:**
```bash
if grep -q "^USE_LEGACY_SUPABASE=false" /opt/ai-admin/.env; then
    log_success "Using Timeweb (verified via .env)"
fi
```

---

### Decision 2: Check Archived Logs for WhatsApp Connection

**Options Considered:**
1. **Option A:** Check current + yesterday's archived log ✅ **CHOSEN**
2. Option B: Check only current log
3. Option C: Check .env only (but WhatsApp connection is runtime state)

**Reasoning:**
- WhatsApp connection is runtime state (not in .env)
- Need to check logs to verify connection
- Yesterday's log likely has connection message
- If not in either log → legitimate issue

**Implementation:**
```bash
# Check current log
CONNECTION_COUNT=$(tail -20000 "$LOG_FILE_OUT" | grep -c "WhatsApp connected")

# If not found, check yesterday's log
if [[ "$CONNECTION_COUNT" -eq 0 ]]; then
    YESTERDAY_LOG=$(ls -1t /opt/ai-admin/logs/baileys-service-out-8__*.log | head -1)
    CONNECTION_COUNT=$(tail -20000 "$YESTERDAY_LOG" | grep -c "WhatsApp connected")
fi
```

---

### Decision 3: Keep Existing grep -c Pattern

**Why:**
- grep -c pattern already works (fixed in commit 561445a)
- No need to change working code
- Just extend to check archived logs

---

## File Locations

### Key Files

**Monitoring Script:**
- Path: `/opt/ai-admin/scripts/monitor-phase07-timeweb.sh`
- Lines to modify: 126-139 (WhatsApp), 167-179 (Timeweb)
- Current version: Uses grep -c pattern (working)

**Log Files (VPS):**
- Current: `/opt/ai-admin/logs/baileys-service-out-8.log`
- Archived: `/opt/ai-admin/logs/baileys-service-out-8__YYYY-MM-DD_HH-MM-SS.log`
- Pattern: `baileys-service-out-8__*.log`

**Environment File:**
- Path: `/opt/ai-admin/.env`
- Key variables: `USE_LEGACY_SUPABASE`, `USE_DATABASE_AUTH_STATE`

**Cron Log:**
- Path: `/var/log/ai-admin/phase07-monitor-cron.log`
- Shows: All automated monitoring runs
- Schedule: Every 4 hours (0 */4 * * *)

---

## Dependencies

**External:**
- PM2 log rotation (daily at 00:00) - CANNOT change
- Bash shell on VPS - available
- grep, tail commands - available

**Internal:**
- Phase 0.7 deployment complete ✅
- .env file exists on VPS ✅
- Monitoring script deployed ✅
- Cron job configured ✅

---

## Testing Strategy

### Manual Testing
1. Copy updated script to VPS
2. Run manually: `./scripts/monitor-phase07-timeweb.sh`
3. Verify output shows all green
4. Check specific detections:
   - ✅ Timeweb via .env
   - ✅ WhatsApp via archived log (if needed)
   - ✅ Service status
   - ✅ Memory usage

### Automated Testing
1. Wait for next cron run (16:00)
2. Check cron log: `tail /var/log/ai-admin/phase07-monitor-cron.log`
3. Verify no false negatives
4. Monitor for 24 hours (6 cron runs)

### Regression Testing
1. Verify script still works after Baileys restart
2. Verify script still works if logs are fresh
3. Verify script correctly detects actual issues

---

## Rollback Plan

**If monitoring breaks:**
1. SSH to VPS
2. Restore old script from git:
   ```bash
   cd /opt/ai-admin
   git checkout HEAD~1 scripts/monitor-phase07-timeweb.sh
   ```
3. Test: `./scripts/monitor-phase07-timeweb.sh`
4. Done (cron uses file from disk)

**Recovery Time:** <2 minutes

---

## Success Criteria

**Immediate:**
- ✅ Manual run shows correct Timeweb detection
- ✅ Manual run shows correct WhatsApp detection
- ✅ No false negatives

**24-Hour:**
- ✅ All 6 cron runs (16:00, 20:00, 00:00, 04:00, 08:00, 12:00) show green
- ✅ No Telegram false alerts
- ✅ Consistent results across all runs

---

## Related Documentation

**Phase 0.7 Docs:**
- `dev/active/database-migration-completion/database-migration-completion-context.md`
- `dev/active/database-migration-completion/PHASE_0.7_COMPLETION_SUMMARY.md`

**Monitoring Script History:**
- Commit 561445a: Fixed grep -c pattern (2025-11-07 20:48)
- Commit 8c2ecf4-be1b089: Initial monitoring script + 15 debug attempts

---

## Lessons Learned

**1. Log Rotation is Real**
- PM2 rotates logs daily
- Long-running services don't re-log startup messages
- Monitoring must account for this

**2. .env is Source of Truth**
- Configuration in .env is more reliable than log parsing
- Use .env for configuration verification
- Use logs for runtime state (connections, errors)

**3. Test After Midnight**
- Issues may appear after daily rotation
- Need 24h testing, not just deployment test
- Always consider log rotation in monitoring design

---

**Last Updated:** 2025-11-08 14:10 MSK
**Next Update:** After script testing complete
