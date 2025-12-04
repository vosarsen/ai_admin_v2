# WhatsApp Pairing Code Fix - Implementation Plan

**Last Updated:** 2025-12-04
**Status:** In Progress
**Priority:** CRITICAL - Blocks marketplace onboarding
**Estimated Time:** 4-6 hours

---

## Executive Summary

The WhatsApp pairing code connection flow has 5 critical bugs that prevent marketplace onboarding when old credentials exist in PostgreSQL. The moderator (Филипп) testing salon 997441 with phone 79006464263 gets "Timeout подключения WhatsApp" because old credentials from phone 79936363848 persist in the database.

**Root Cause:** No credential lifecycle management. Old phone credentials are never cleaned up, causing silent pairing failures when user tries to connect a different phone number.

---

## Current State Analysis

### Problem Statement

When a salon owner tries to connect WhatsApp:
1. User enters new phone number (79006464263)
2. System loads OLD credentials from PostgreSQL (79936363848)
3. Baileys tries to pair with mismatched credentials
4. WhatsApp silently rejects pairing code request
5. User sees generic "Timeout" error

### Affected Files

| File | Issue |
|------|-------|
| `src/integrations/whatsapp/session-pool.js` | No credential cleanup before new session |
| `src/integrations/whatsapp/auth-state-timeweb.js` | No phone number validation on load |
| `src/api/websocket/marketplace-socket.js` | Race condition, poor error handling |
| `src/api/routes/whatsapp-sessions.js` | Missing reset endpoint |

### Current Flow (Broken)

```
User enters phone → Load old credentials from DB → Baileys tries pairing →
WhatsApp rejects (wrong phone) → Generic "Timeout" error → User stuck
```

### Expected Flow (Fixed)

```
User enters phone → Check if old credentials exist →
If different phone: Delete old + Create new →
Baileys pairs with correct credentials → Success!
```

---

## Proposed Solution

### Architecture Changes

1. **Credential Validation Layer** - Add phone number validation before using stored credentials
2. **Explicit Reset Mechanism** - Allow frontend to trigger credential cleanup
3. **Improved Error Propagation** - Convert Baileys errors to user-actionable messages
4. **Timeout Protection** - Prevent infinite waits with configurable timeouts

### Implementation Phases

| Phase | Description | Est. Time | Priority |
|-------|-------------|-----------|----------|
| 1 | Core Credential Fixes | 2 hours | CRITICAL |
| 2 | WebSocket Improvements | 1.5 hours | HIGH |
| 3 | REST API Enhancements | 1 hour | MEDIUM |
| 4 | Testing & Deployment | 1 hour | CRITICAL |

---

## Phase 1: Core Credential Fixes (CRITICAL)

### Task 1.1: Add Credential Cleanup Before Session Creation

**File:** `src/integrations/whatsapp/session-pool.js`
**Lines:** 267-284

**Change:**
- Before creating new session with pairing code, check if credentials exist
- If usePairingCode option provided with phoneNumber, delete old credentials
- Call `removeTimewebAuthState(companyId)` to clear PostgreSQL data

**Code Location:**
```javascript
// _createSessionWithMutex() - Before useTimewebAuthState() call
```

**Acceptance Criteria:**
- [ ] Old credentials deleted when new phone number provided
- [ ] Cleanup logged for debugging
- [ ] Errors handled gracefully (don't block if cleanup fails)

---

### Task 1.2: Add Phone Number Validation on Credential Load

**File:** `src/integrations/whatsapp/auth-state-timeweb.js`
**Lines:** 354-464 (useTimewebAuthState function)

**Change:**
- Accept `options.phoneNumber` parameter
- After loading credentials, check if stored phone matches requested phone
- If mismatch: delete old credentials, create fresh ones
- Log mismatch clearly for debugging

**Code Location:**
```javascript
// useTimewebAuthState() - After loading credentials, before return
```

**Acceptance Criteria:**
- [ ] Phone mismatch detected and logged
- [ ] Old credentials automatically deleted on mismatch
- [ ] Fresh credentials created for new phone
- [ ] Works for both pairing code and QR code flows

---

### Task 1.3: Pass Phone Number Through Session Creation Chain

**File:** `src/integrations/whatsapp/session-pool.js`
**Lines:** 286-289

**Change:**
- Pass `options.phoneNumber` to `useTimewebAuthState()`
- Ensure phone number flows from WebSocket → session-pool → auth-state

**Acceptance Criteria:**
- [ ] Phone number passed through entire chain
- [ ] Auth state can validate phone match

---

## Phase 2: WebSocket Improvements (HIGH)

### Task 2.1: Add Credential Reset Event Handler

**File:** `src/api/websocket/marketplace-socket.js`
**Lines:** After 337 (after request-pairing-code handler)

**Change:**
- Add `socket.on('reset-whatsapp-credentials')` handler
- Delete session, PostgreSQL credentials, and cache
- Emit success/error event to frontend

**Acceptance Criteria:**
- [ ] Handler implemented and tested
- [ ] All credential sources cleaned (memory, DB, cache)
- [ ] Frontend can trigger reset via WebSocket

---

### Task 2.2: Improve Error Messages from Baileys

**File:** `src/integrations/whatsapp/session-pool.js`
**Lines:** 373-428 (pairing code catch block)

**Change:**
- Parse Baileys error types
- Map to user-actionable messages:
  - `CREDENTIALS_CONFLICT` - "Обнаружен конфликт учетных данных"
  - `INVALID_PHONE` - "Номер не зарегистрирован в WhatsApp"
  - `RATE_LIMITED` - "Слишком много попыток, подождите"
- Include error code for frontend handling

**Acceptance Criteria:**
- [ ] Different error types produce different messages
- [ ] Frontend can show specific guidance based on error code
- [ ] Sentry captures parsed error context

---

### Task 2.3: Add Timeout Protection for Pairing Code Requests

**File:** `src/api/websocket/marketplace-socket.js`
**Lines:** 311-336

**Change:**
- Wrap pairing code request in Promise.race with timeout
- Reduce timeout from 60s to 20s
- Emit specific timeout error to frontend

**Acceptance Criteria:**
- [ ] Requests timeout after 20 seconds
- [ ] User notified of timeout with suggestion to retry
- [ ] Mutex released on timeout

---

## Phase 3: REST API Enhancements (MEDIUM)

### Task 3.1: Add Credentials Status Endpoint

**File:** `src/api/routes/whatsapp-sessions.js`

**New Endpoint:**
```
GET /api/whatsapp/sessions/:companyId/credentials/status
```

**Response:**
```json
{
  "hasCredentials": true,
  "storedPhone": "79936363848",
  "canReset": true
}
```

**Acceptance Criteria:**
- [ ] Endpoint returns credential status
- [ ] Shows stored phone number for debugging
- [ ] Can be used by frontend to show "Reset" button when needed

---

### Task 3.2: Add Credentials Reset Endpoint

**File:** `src/api/routes/whatsapp-sessions.js`

**New Endpoint:**
```
DELETE /api/whatsapp/sessions/:companyId/credentials
```

**Response:**
```json
{
  "success": true,
  "message": "Credentials deleted"
}
```

**Acceptance Criteria:**
- [ ] Endpoint deletes all credentials for company
- [ ] Clears session, auth, keys, and cache
- [ ] Returns success/error status

---

## Phase 4: Testing & Deployment (CRITICAL)

### Task 4.1: Manual Testing

**Test Cases:**
1. Fresh salon (no credentials) - Should work
2. Existing credentials, same phone - Should work
3. Existing credentials, different phone - Should auto-cleanup and work
4. Rapid retries - Should not cause race conditions
5. WebSocket disconnect during pairing - Should cleanup properly
6. Reset credentials via REST/WebSocket - Should work

**Acceptance Criteria:**
- [ ] All 6 test cases pass
- [ ] Moderator (Филипп) can successfully pair salon 997441

---

### Task 4.2: Deployment

**Steps:**
1. Commit changes with conventional commit message
2. Push to main branch
3. Deploy to production server
4. Verify no errors in PM2 logs
5. Test with moderator's salon

**Acceptance Criteria:**
- [ ] Code deployed without errors
- [ ] PM2 shows all services online
- [ ] Moderator confirms pairing works

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Break existing QR code flow | Low | High | Test QR flow after changes |
| PostgreSQL deletion fails | Low | Medium | Handle errors gracefully, log for debugging |
| WebSocket race conditions | Medium | Low | Mutex already exists, improve timeout handling |
| Frontend not updated | Medium | Low | REST API provides fallback |

---

## Success Metrics

1. **Pairing Success Rate:** 100% for fresh connections
2. **Error Message Clarity:** Users understand what action to take
3. **Recovery Time:** <30 seconds from error to successful retry
4. **Support Tickets:** Zero tickets for "WhatsApp timeout" after fix

---

## Dependencies

- PostgreSQL database access
- WhatsApp credentials tables (`whatsapp_auth`, `whatsapp_keys`)
- Baileys library (no changes needed)
- Frontend updates (optional, improves UX)

---

## Rollback Plan

If issues occur:
1. Revert commit: `git revert HEAD`
2. Redeploy: `pm2 restart ai-admin-api`
3. Manually clean credentials for affected salons

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/integrations/whatsapp/session-pool.js` | Credential cleanup, error parsing |
| `src/integrations/whatsapp/auth-state-timeweb.js` | Phone validation |
| `src/api/websocket/marketplace-socket.js` | Reset handler, timeout |
| `src/api/routes/whatsapp-sessions.js` | New REST endpoints |

---

**Next Step:** Start with Phase 1, Task 1.1 - Add credential cleanup before session creation.
