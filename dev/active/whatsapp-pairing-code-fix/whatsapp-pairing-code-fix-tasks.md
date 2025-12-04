# WhatsApp Pairing Code Fix - Tasks

**Last Updated:** 2025-12-04
**Status:** In Progress

---

## Phase 1: Core Credential Fixes (CRITICAL)

### Task 1.1: Add Credential Cleanup Before Session Creation
- [ ] Add option to delete old credentials in `_createSessionWithMutex()`
- [ ] Call `removeTimewebAuthState()` when `usePairingCode` and `phoneNumber` provided
- [ ] Handle cleanup errors gracefully (log but don't block)
- [ ] Add logging for credential cleanup
- **File:** `src/integrations/whatsapp/session-pool.js`
- **Lines:** 267-284
- **Est:** 30 min

### Task 1.2: Add Phone Number Validation on Credential Load
- [ ] Accept `options.phoneNumber` in `useTimewebAuthState()`
- [ ] Extract stored phone from `creds.me.id`
- [ ] Compare stored phone with requested phone
- [ ] If mismatch: delete old credentials, create fresh
- [ ] Log phone mismatch for debugging
- **File:** `src/integrations/whatsapp/auth-state-timeweb.js`
- **Lines:** 354-464
- **Est:** 45 min

### Task 1.3: Pass Phone Number Through Session Chain
- [ ] Update `createSession()` options interface
- [ ] Pass `options.phoneNumber` to `useTimewebAuthState()`
- [ ] Ensure phone flows from WebSocket handler through to auth state
- **File:** `src/integrations/whatsapp/session-pool.js`
- **Lines:** 286-289
- **Est:** 15 min

---

## Phase 2: WebSocket Improvements (HIGH)

### Task 2.1: Add Credential Reset Event Handler
- [ ] Add `socket.on('reset-whatsapp-credentials')` handler
- [ ] Disconnect existing session if any
- [ ] Delete PostgreSQL credentials via `removeTimewebAuthState()`
- [ ] Clear cached credentials
- [ ] Emit `credentials-reset` success event
- [ ] Emit `reset-error` on failure
- **File:** `src/api/websocket/marketplace-socket.js`
- **Lines:** After 337
- **Est:** 30 min

### Task 2.2: Improve Error Messages from Baileys
- [ ] Parse error types in pairing code catch block
- [ ] Map errors to user-actionable codes:
  - [ ] `CREDENTIALS_CONFLICT` for phone mismatch
  - [ ] `INVALID_PHONE` for unregistered numbers
  - [ ] `RATE_LIMITED` for too many attempts
- [ ] Include error code in WebSocket emission
- [ ] Update Sentry capture with parsed context
- **File:** `src/integrations/whatsapp/session-pool.js`
- **Lines:** 373-428
- **Est:** 30 min

### Task 2.3: Add Timeout Protection
- [ ] Create timeout promise (20 seconds)
- [ ] Use `Promise.race()` for pairing code request
- [ ] Emit specific timeout error on expiration
- [ ] Ensure mutex released on timeout
- **File:** `src/api/websocket/marketplace-socket.js`
- **Lines:** 311-336
- **Est:** 20 min

---

## Phase 3: REST API Enhancements (MEDIUM)

### Task 3.1: Add Credentials Status Endpoint
- [ ] Create `GET /api/whatsapp/sessions/:companyId/credentials/status`
- [ ] Query `whatsapp_auth` for company
- [ ] Extract stored phone from credentials
- [ ] Return `{ hasCredentials, storedPhone, canReset }`
- **File:** `src/api/routes/whatsapp-sessions.js`
- **Est:** 20 min

### Task 3.2: Add Credentials Reset Endpoint
- [ ] Create `DELETE /api/whatsapp/sessions/:companyId/credentials`
- [ ] Call `removeTimewebAuthState()`
- [ ] Clear session pool and cache
- [ ] Return success/error response
- **File:** `src/api/routes/whatsapp-sessions.js`
- **Est:** 20 min

---

## Phase 4: Testing & Deployment (CRITICAL)

### Task 4.1: Manual Testing
- [ ] Test fresh salon (no credentials) - Should work
- [ ] Test same phone reconnection - Should work
- [ ] Test different phone (main bug case) - Should auto-cleanup and work
- [ ] Test rapid retries - Should not cause race conditions
- [ ] Test WebSocket disconnect during pairing - Should cleanup
- [ ] Test credential reset via WebSocket - Should work

### Task 4.2: Deployment
- [ ] Commit with conventional commit message
- [ ] Push to main branch
- [ ] Deploy to production: `git pull && pm2 restart ai-admin-api`
- [ ] Verify PM2 shows all services online
- [ ] Check logs for errors
- [ ] Notify moderator to test

### Task 4.3: Verification
- [ ] Moderator (Филипп) tests salon 997441
- [ ] Pairing code received successfully
- [ ] WhatsApp connected
- [ ] No errors in logs

---

## Progress Summary

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| Phase 1 | 3 | 0 | Not Started |
| Phase 2 | 3 | 0 | Not Started |
| Phase 3 | 2 | 0 | Not Started |
| Phase 4 | 3 | 0 | Not Started |
| **Total** | **11** | **0** | **0%** |

---

## Notes

- Start with Phase 1, Task 1.1 - most critical fix
- Phase 2 improves UX but Phase 1 is minimum viable fix
- Phase 3 can be skipped for MVP if time constrained
- Phase 4 testing is mandatory before closing
