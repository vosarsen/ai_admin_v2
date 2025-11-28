# Missing Command Handlers - Tasks

**Last Updated:** 2025-11-28
**Version:** 2.0 (Updated after plan review)

## Phase 1: Implementation - Estimated: 20 min

### 1.1 Add HIGH priority handlers
- [ ] Add SHOW_BOOKINGS / SHOWBOOKINGS case (with correct data structure)
- [ ] Add CONFIRM_BOOKING case (with temporaryLimitation handling)

### 1.2 Add LOW priority handlers
- [ ] Add SAVE_CLIENT_NAME case (check data.name, NOT data.success)
- [ ] Add MARK_NO_SHOW case (with temporaryLimitation handling)
- [ ] Add SHOW_PORTFOLIO case (handles empty array)

### 1.3 Verify syntax
- [ ] `node -c src/services/ai-admin-v2/prompts/two-stage-response-prompt.js`

## Phase 2: Testing - Estimated: 20 min

### 2.1 Unit test each handler
- [ ] Test SHOW_BOOKINGS with bookings
- [ ] Test SHOW_BOOKINGS empty
- [ ] Test CONFIRM_BOOKING (temporaryLimitation)
- [ ] Test SAVE_CLIENT_NAME success
- [ ] Test MARK_NO_SHOW (temporaryLimitation)
- [ ] Test SHOW_PORTFOLIO empty array

### 2.2 Regression tests
- [ ] Verify RESCHEDULE_BOOKING still works
- [ ] Verify CREATE_BOOKING still works
- [ ] Verify CANCEL_BOOKING still works

## Phase 3: Deploy - Estimated: 10 min

### 3.1 Commit and push
- [ ] `git add -A && git commit -m "feat: add missing command handlers"`
- [ ] `git push origin main`

### 3.2 Deploy to production
- [ ] `ssh ... "cd /opt/ai-admin && git pull && pm2 restart ai-admin-worker-v2"`
- [ ] Verify version loaded in logs

---

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Implementation | ⬜ Pending | 6 handlers with corrected code |
| Phase 2: Testing | ⬜ Pending | Unit + regression |
| Phase 3: Deploy | ⬜ Pending | |

**Total Estimated Time:** ~50 min
