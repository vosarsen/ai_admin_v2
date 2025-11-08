# Monitoring Script Fix - Task Checklist

**Last Updated:** 2025-11-08 14:10 MSK
**Status:** In Progress (2/17 tasks complete)

---

## Phase 1: Dev Docs Setup ✅ COMPLETE

- [x] **Task 1.1:** Create `dev/active/monitoring-script-fix/` directory
  - **Status:** ✅ Complete
  - **Time:** 2 min

- [x] **Task 1.2:** Create `monitoring-script-fix-plan.md`
  - **Status:** ✅ Complete
  - **File:** `/dev/active/monitoring-script-fix/monitoring-script-fix-plan.md`
  - **Size:** ~8KB
  - **Time:** 5 min

- [x] **Task 1.3:** Create `monitoring-script-fix-context.md`
  - **Status:** ✅ Complete
  - **File:** `/dev/active/monitoring-script-fix/monitoring-script-fix-context.md`
  - **Size:** ~6KB
  - **Time:** 5 min

- [x] **Task 1.4:** Create `monitoring-script-fix-tasks.md` (this file)
  - **Status:** ✅ Complete
  - **Time:** 3 min

**Phase 1 Total:** 15 minutes ✅

---

## Phase 2: Update Monitoring Script ⏳ IN PROGRESS

- [ ] **Task 2.1:** Read current monitoring script
  - **File:** `scripts/monitor-phase07-timeweb.sh`
  - **Focus:** Lines 126-139 (WhatsApp), 167-179 (Timeweb)
  - **Time:** 2 min

- [ ] **Task 2.2:** Update WhatsApp connection check (lines 126-139)
  - **Change:** Add archived log check
  - **Logic:**
    1. Check current log: `baileys-service-out-8.log`
    2. If not found → check yesterday: `baileys-service-out-8__*.log`
    3. If found in either → ✅ connected
  - **Pattern:** Keep grep -c approach (working)
  - **Time:** 10 min

- [ ] **Task 2.3:** Update Timeweb PostgreSQL check (lines 167-179)
  - **Change:** Check .env file directly
  - **Logic:**
    1. Check `/opt/ai-admin/.env` for `USE_LEGACY_SUPABASE=false`
    2. If true → ✅ using Timeweb
    3. Also show last initialization time from logs (if available)
  - **Fallback:** Check archived log if needed
  - **Time:** 10 min

- [ ] **Task 2.4:** Add comments explaining log rotation handling
  - **Purpose:** Future maintainability
  - **Location:** Above new code blocks
  - **Time:** 3 min

- [ ] **Task 2.5:** Verify no syntax errors
  - **Tool:** `bash -n scripts/monitor-phase07-timeweb.sh`
  - **Time:** 1 min

**Phase 2 Total:** 26 minutes

---

## Phase 3: Testing 🔲 PENDING

- [ ] **Task 3.1:** Test locally (MacBook)
  - **Command:** `bash -n scripts/monitor-phase07-timeweb.sh`
  - **Expected:** No syntax errors
  - **Time:** 1 min

- [ ] **Task 3.2:** Copy script to VPS
  - **Command:**
    ```bash
    scp -i ~/.ssh/id_ed25519_ai_admin \
      scripts/monitor-phase07-timeweb.sh \
      root@46.149.70.219:/opt/ai-admin/scripts/
    ```
  - **Time:** 1 min

- [ ] **Task 3.3:** Run script manually on VPS
  - **Command:**
    ```bash
    ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
      "cd /opt/ai-admin && ./scripts/monitor-phase07-timeweb.sh"
    ```
  - **Expected Output:**
    ```
    ✅ Service is online
    ✅ Memory usage is normal
    ✅ WhatsApp is connected (N connection(s) found)
    ✅ Baileys is using Timeweb PostgreSQL (verified via .env)
    ✅ No PostgreSQL errors found
    ```
  - **Time:** 2 min

- [ ] **Task 3.4:** Verify .env detection works
  - **Check:** Output includes "(verified via .env)"
  - **Time:** 1 min

- [ ] **Task 3.5:** Verify archived log search works (if applicable)
  - **Check:** If current log empty, searches archived
  - **Time:** 2 min

- [ ] **Task 3.6:** Check for any error messages
  - **Command:** Look for ❌ or errors in output
  - **Action:** Fix if found
  - **Time:** 2 min

**Phase 3 Total:** 9 minutes

---

## Phase 4: Production Deployment 🔲 PENDING

- [ ] **Task 4.1:** Verify script copied to VPS (already done in testing)
  - **Status:** Should be complete from Task 3.2
  - **Time:** 0 min

- [ ] **Task 4.2:** Verify cron job exists
  - **Command:**
    ```bash
    ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
      "crontab -l | grep phase07"
    ```
  - **Expected:** `0 */4 * * * /opt/ai-admin/scripts/monitor-phase07-timeweb.sh`
  - **Time:** 1 min

- [ ] **Task 4.3:** Wait for next cron run (16:00)
  - **Time:** Variable (max 4 hours)
  - **Action:** Can proceed with other tasks while waiting

- [ ] **Task 4.4:** Check cron execution log
  - **Command:**
    ```bash
    ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
      "tail -50 /var/log/ai-admin/phase07-monitor-cron.log"
    ```
  - **Expected:** Latest run shows all green
  - **Time:** 2 min

**Phase 4 Total:** 3 minutes (+ waiting time)

---

## Phase 5: Documentation Updates 🔲 PENDING

- [ ] **Task 5.1:** Update `database-migration-completion-context.md`
  - **File:** `dev/active/database-migration-completion/database-migration-completion-context.md`
  - **Changes:**
    - Update "Monitoring Script" section to "FULLY FIXED"
    - Add note about log rotation solution
    - Update "Last Updated" timestamp
  - **Time:** 5 min

- [ ] **Task 5.2:** Update `PHASE_0.7_COMPLETION_SUMMARY.md`
  - **File:** `dev/active/database-migration-completion/PHASE_0.7_COMPLETION_SUMMARY.md`
  - **Changes:**
    - Update monitoring status
    - Add log rotation fix details
    - Update "Last Updated" timestamp
  - **Time:** 5 min

**Phase 5 Total:** 10 minutes

---

## Phase 6: Git Commit 🔲 PENDING

- [ ] **Task 6.1:** Stage all changes
  - **Command:**
    ```bash
    git add scripts/monitor-phase07-timeweb.sh
    git add dev/active/monitoring-script-fix/
    git add dev/active/database-migration-completion/*.md
    ```
  - **Time:** 1 min

- [ ] **Task 6.2:** Create commit
  - **Message:**
    ```
    fix: monitoring script handles log rotation correctly

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

    Files changed:
    - scripts/monitor-phase07-timeweb.sh (logic update)
    - dev/active/monitoring-script-fix/ (dev docs created)
    - dev/active/database-migration-completion/*.md (status updates)

    Next: Monitor automated cron runs for 24h verification
    ```
  - **Time:** 3 min

- [ ] **Task 6.3:** Push to remote
  - **Command:** `git push origin main`
  - **Time:** 1 min

**Phase 6 Total:** 5 minutes

---

## Summary

### Progress Tracker

**Completed:** 4/17 tasks (24%)
**In Progress:** Phase 2
**Remaining:** Phases 3-6

### Time Tracker

| Phase | Est. Time | Actual Time | Status |
|-------|-----------|-------------|--------|
| Phase 1: Dev Docs | 15 min | 15 min | ✅ Complete |
| Phase 2: Update Script | 26 min | - | ⏳ In Progress |
| Phase 3: Testing | 9 min | - | 🔲 Pending |
| Phase 4: Deploy | 3 min | - | 🔲 Pending |
| Phase 5: Docs | 10 min | - | 🔲 Pending |
| Phase 6: Commit | 5 min | - | 🔲 Pending |
| **Total** | **68 min** | **15 min** | **22% done** |

---

## Next Actions

**Immediate:**
1. Start Task 2.1: Read current monitoring script
2. Complete Task 2.2: Update WhatsApp check
3. Complete Task 2.3: Update Timeweb check

**After Script Update:**
1. Test locally
2. Deploy to VPS
3. Verify manual run
4. Update documentation
5. Commit and push

---

**Last Updated:** 2025-11-08 14:10 MSK
**Current Focus:** Phase 2 - Updating monitoring script logic
