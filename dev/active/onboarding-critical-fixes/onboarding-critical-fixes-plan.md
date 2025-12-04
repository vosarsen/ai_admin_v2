# Onboarding Critical Fixes - Implementation Plan

**Last Updated:** 2025-12-04
**Status:** Planning
**Priority:** CRITICAL (Production Blocker)
**Estimated Effort:** 8-12 hours

---

## Executive Summary

This plan addresses three critical bugs discovered during onboarding testing that block production deployment:

1. **LID Phone Handling (CRITICAL):** `_extractPhoneNumber()` strips `@lid` suffix after `_formatPhone()` adds it, causing 400 errors when sending messages to WhatsApp internal IDs
2. **Company ID Format Inconsistency (HIGH):** Dual formats (`962302` vs `company_962302`) cause duplicate credentials and lookup failures
3. **WebSocket Notifications (MEDIUM):** `whatsapp-connected` event not reaching frontend, forcing fallback to polling

Additionally:
- Remove debug `console.log` statements from production
- Add tests for regular phone numbers (non-LID)

---

## Current State Analysis

### Problem 1: LID Phone Handling

**Root Cause Analysis:**

```javascript
// src/integrations/whatsapp/client.js

// Line 170-171 in sendMessage():
const formattedPhone = this._formatPhone(phone);    // Returns "152926689472618@lid"
const cleanPhone = this._extractPhoneNumber(formattedPhone);  // Returns "152926689472618" (BROKEN!)

// _formatPhone() correctly adds @lid (lines 503-539):
if (cleanPhone.length >= 15) {
  return `${cleanPhone}@lid`;  // Correct!
}

// BUT _extractPhoneNumber() strips it (lines 548-556):
return formattedPhone
  .replace('@c.us', '')
  .replace('@s.whatsapp.net', '')
  .replace(/[^\d]/g, '');  // <-- THIS REMOVES @lid TOO!
```

**Impact:**
- Messages to LID contacts (152926689472618) fail with 400 error
- All AI responses to clients using LID format are lost
- ~Unknown % of clients affected (depends on WhatsApp internal routing)

### Problem 2: Company ID Format Inconsistency

**Current State:**

| Location | Format Used | Example |
|----------|-------------|---------|
| `.env` (YCLIENTS_COMPANY_ID) | numeric | `962302` |
| `baileys-service` | numeric | `962302` |
| `companies.company_id` (DB) | numeric | `962302` |
| `whatsapp_auth.company_id` | prefixed | `company_962302` |
| `whatsapp_keys.company_id` | prefixed | `company_962302` |
| Onboarding sessionId | prefixed | `company_962302` |
| marketplace-socket.js | prefixed | `company_${salonId}` |

**Evidence of Corruption:**
```sql
SELECT company_id FROM whatsapp_auth;
-- 962302
-- company_962302  -- DUPLICATE!
```

**Impact:**
- Duplicate credentials in database
- Session lookup failures when formats mismatch
- `handleUninstall()` may not find credentials to delete
- Potential data corruption during company operations

### Problem 3: WebSocket Notifications

**Expected Flow:**
```
Baileys connects → sessionPool emits 'connected'
→ marketplace-socket.js catches it → emits 'whatsapp-connected' to frontend
→ onboarding.html receives event → calls activateIntegration()
```

**Current State:**
- Backend emits `whatsapp-connected` correctly (lines 204-209 in marketplace-socket.js)
- Frontend has handler (line 539 in onboarding.html)
- BUT: Event not reaching frontend
- Fallback polling works (lines 552-582 in onboarding.html)

**Possible Causes:**
1. Socket.IO namespace mismatch
2. Event listener setup timing issue
3. Session pool event not propagating correctly
4. Company ID format mismatch in event data

---

## Proposed Future State

### After Fixes:

1. **LID Handling:**
   - Messages to LID contacts sent with `@lid` suffix preserved
   - Regular phone numbers continue to work with `@s.whatsapp.net`
   - Clear logging of phone format detection

2. **Company ID:**
   - Single format used everywhere: `company_{salon_id}`
   - Database migration to unify existing records
   - Clear documentation of format

3. **WebSocket:**
   - `whatsapp-connected` event reliably reaches frontend
   - Automatic step transition on connect
   - Polling fallback as backup only

4. **Code Quality:**
   - No debug console.log in production
   - Test coverage for both LID and regular phone formats

---

## Implementation Phases

### Phase 1: LID Phone Handling Fix (CRITICAL)
**Effort:** 2-3 hours
**Risk:** Medium (core messaging functionality)

**Tasks:**
1.1. Fix `_extractPhoneNumber()` to preserve `@lid` suffix
1.2. Add comprehensive logging for phone format detection
1.3. Test with LID numbers (152926689472618)
1.4. Test with regular numbers (79001234567)
1.5. Deploy and verify in production

### Phase 2: Company ID Unification (HIGH)
**Effort:** 3-4 hours
**Risk:** High (database migration, multi-component)

**Tasks:**
2.1. Audit all code locations using company_id
2.2. Decide on canonical format (recommend: `company_{salon_id}`)
2.3. Update baileys-service to use prefixed format
2.4. Create database migration script
2.5. Run migration on production
2.6. Verify no duplicate credentials

### Phase 3: WebSocket Fix (MEDIUM)
**Effort:** 2-3 hours
**Risk:** Low (isolated to onboarding UI)

**Tasks:**
3.1. Add debug logging to trace event flow
3.2. Verify Socket.IO namespace configuration
3.3. Check company ID format in event data
3.4. Test event delivery end-to-end
3.5. Remove debug logging after fix

### Phase 4: Code Cleanup & Testing (LOW)
**Effort:** 1-2 hours
**Risk:** Low

**Tasks:**
4.1. Remove console.log from onboarding.html
4.2. Add test case for LID phone format
4.3. Add test case for regular phone format
4.4. Update documentation

---

## Detailed Task Breakdown

### Phase 1: LID Phone Handling

#### Task 1.1: Fix _extractPhoneNumber()
**File:** `src/integrations/whatsapp/client.js`
**Lines:** 548-556

**Current Code:**
```javascript
_extractPhoneNumber(formattedPhone) {
  if (!formattedPhone) return '';
  return formattedPhone
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace(/[^\d]/g, '');  // PROBLEM: removes @lid
}
```

**Proposed Fix:**
```javascript
_extractPhoneNumber(formattedPhone) {
  if (!formattedPhone) return '';

  // Preserve @lid suffix for WhatsApp internal IDs
  if (formattedPhone.includes('@lid')) {
    return formattedPhone;  // Return as-is, Baileys needs @lid
  }

  // Remove WhatsApp suffixes for regular numbers
  return formattedPhone
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace(/[^\d]/g, '');
}
```

**Alternative Approach (Recommended):**
Don't use `_extractPhoneNumber()` for sending - use `_formatPhone()` directly:

```javascript
// In sendMessage(), line 170-171:
// OLD:
const formattedPhone = this._formatPhone(phone);
const cleanPhone = this._extractPhoneNumber(formattedPhone);

// NEW:
const phoneForBaileys = this._formatPhone(phone);
// Remove @c.us suffix if present (Baileys adds its own)
const cleanPhone = phoneForBaileys.replace('@c.us', '').replace('@s.whatsapp.net', '');
// BUT preserve @lid suffix!
```

**Acceptance Criteria:**
- [ ] LID numbers (15+ digits) sent with @lid suffix
- [ ] Regular numbers (10-13 digits) work without suffix
- [ ] Test message: `curl POST /send {"phone":"152926689472618","message":"test"}` succeeds
- [ ] Existing functionality not broken

#### Task 1.2: Add Phone Format Logging
**File:** `src/integrations/whatsapp/client.js`

Add debug logging to trace phone format decisions:
```javascript
_formatPhone(phone) {
  // ... existing code ...

  logger.debug('📞 Phone formatting:', {
    input: this._sanitizePhone(phone),
    isLID: cleanPhone.length >= 15,
    output: result,
    suffix: result.includes('@lid') ? '@lid' :
            result.includes('@c.us') ? '@c.us' : 'none'
  });

  return result;
}
```

**Acceptance Criteria:**
- [ ] Logs show phone format detection for each message
- [ ] Can trace LID vs regular number handling

#### Task 1.3: Test LID Numbers
**Test Command:**
```bash
curl -X POST http://localhost:3003/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"152926689472618","message":"LID test"}'
```

**Expected Result:** Success with messageId

#### Task 1.4: Test Regular Numbers
**Test Command:**
```bash
curl -X POST http://localhost:3003/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"79686484488","message":"Regular phone test"}'
```

**Expected Result:** Success with messageId

#### Task 1.5: Deploy and Verify
```bash
# Deploy
ssh root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart all"

# Test via WhatsApp MCP
@whatsapp send_message phone:152926689472618 message:"Production LID test"
```

---

### Phase 2: Company ID Unification

#### Task 2.1: Audit Code Locations
**Files to check:**

1. `src/integrations/whatsapp/client.js` - uses cleanPhone
2. `src/api/websocket/marketplace-socket.js` - line 111: `company_${salonId}`
3. `src/api/routes/yclients-marketplace.js` - creates sessionId
4. `baileys-whatsapp-service/` - session management
5. `src/services/ai-admin-v2/` - message processing
6. Database tables: `whatsapp_auth`, `whatsapp_keys`, `companies`

#### Task 2.2: Decide Canonical Format
**Recommendation:** Use `company_{salon_id}` everywhere

**Rationale:**
- Already used in marketplace (WebSocket, REST API)
- Clear namespace separation
- Consistent with multi-tenant future

#### Task 2.3: Update baileys-service
**File:** `baileys-whatsapp-service/src/index.js` (or similar)

Ensure session ID uses prefixed format.

#### Task 2.4: Database Migration Script
**File:** `migrations/20251204_unify_company_id.sql`

```sql
-- Backup first!
-- CREATE TABLE whatsapp_auth_backup AS SELECT * FROM whatsapp_auth;

-- Update numeric IDs to prefixed format
UPDATE whatsapp_auth
SET company_id = CONCAT('company_', company_id)
WHERE company_id NOT LIKE 'company_%'
  AND company_id ~ '^[0-9]+$';

-- Remove duplicates (keep newest)
DELETE FROM whatsapp_auth a
USING whatsapp_auth b
WHERE a.company_id = b.company_id
  AND a.created_at < b.created_at;

-- Same for whatsapp_keys
UPDATE whatsapp_keys
SET company_id = CONCAT('company_', company_id)
WHERE company_id NOT LIKE 'company_%'
  AND company_id ~ '^[0-9]+$';

DELETE FROM whatsapp_keys a
USING whatsapp_keys b
WHERE a.company_id = b.company_id
  AND a.key_id = b.key_id
  AND a.created_at < b.created_at;
```

#### Task 2.5: Run Migration
```bash
ssh root@46.149.70.219 "cd /opt/ai-admin && psql $DATABASE_URL < migrations/20251204_unify_company_id.sql"
```

#### Task 2.6: Verify No Duplicates
```sql
SELECT company_id, COUNT(*)
FROM whatsapp_auth
GROUP BY company_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

---

### Phase 3: WebSocket Fix

#### Task 3.1: Add Debug Logging
**File:** `src/api/websocket/marketplace-socket.js`

Add logging around event emission:
```javascript
const handleConnected = async (data) => {
  logger.info('🔔 SessionPool connected event received:', {
    dataCompanyId: data.companyId,
    expectedSessionId: sessionId,
    match: data.companyId === sessionId
  });

  if (data.companyId === sessionId) {
    logger.info('✅ WhatsApp подключен! Sending whatsapp-connected event');
    socket.emit('whatsapp-connected', { ... });
  }
};
```

#### Task 3.2: Verify Socket.IO Namespace
**File:** `public/marketplace/onboarding.html`

Check namespace connection:
```javascript
socket = io('/marketplace', {
  auth: { token: token },
  transports: ['websocket', 'polling']  // Ensure WebSocket first
});

socket.on('connect', () => {
  console.log('WebSocket connected, socket.id:', socket.id);
  console.log('Namespace:', socket.nsp);
});
```

#### Task 3.3: Check Company ID in Event Data
Verify `data.companyId` matches `sessionId` format.

#### Task 3.4: End-to-End Test
1. Open onboarding page with DevTools Network tab
2. Watch for `whatsapp-connected` event
3. Scan QR code
4. Verify event received

#### Task 3.5: Remove Debug Logging
After fix confirmed, remove verbose logging.

---

### Phase 4: Code Cleanup

#### Task 4.1: Remove console.log
**File:** `public/marketplace/onboarding.html`

Remove or conditionally disable:
- Line 493: `console.log('Token data:', tokenData);`
- Line 524: `console.log('WebSocket connected');`
- Line 529: `console.log('QR received:', data);`
- Line 535: `console.log('Status update:', data);`
- Line 540: `console.log('WhatsApp connected!', data);`
- Line 572: `console.log('WhatsApp connected via polling fallback!');`
- Line 591: `console.log('Pairing code received:', data);`
- Line 803: `console.log('Pairing code request sent:', phoneNumber);`

**Approach:**
```javascript
// Replace console.log with conditional debug
const DEBUG = false;
const debug = (...args) => DEBUG && console.log(...args);

debug('Token data:', tokenData);
```

#### Task 4.2: Add LID Phone Test
**File:** `tests/whatsapp/phone-format.test.js`

```javascript
describe('Phone Format', () => {
  test('LID numbers should preserve @lid suffix', () => {
    const client = require('../../src/integrations/whatsapp/client');
    const result = client._formatPhone('152926689472618');
    expect(result).toBe('152926689472618@lid');
  });

  test('Regular numbers should use @c.us suffix', () => {
    const result = client._formatPhone('79686484488');
    expect(result).toBe('79686484488@c.us');
  });
});
```

#### Task 4.3: Add Regular Phone Test
See above.

#### Task 4.4: Update Documentation
Update `dev/active/onboarding-testing/onboarding-testing-report.md` with fix status.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LID fix breaks regular numbers | Medium | High | Test both formats before deploy |
| DB migration corrupts data | Low | Critical | Backup before migration |
| WebSocket fix causes race conditions | Low | Medium | Keep polling fallback |
| Company ID change breaks sessions | Medium | High | Coordinate restart of all services |

## Success Metrics

1. **LID Messages:** 100% delivery success rate for LID contacts
2. **Regular Messages:** No regression in regular phone delivery
3. **Company ID:** Zero duplicate credentials in database
4. **WebSocket:** >90% of connections receive event (vs polling)
5. **Code Quality:** Zero console.log in production build

## Dependencies

- Access to production server (SSH)
- Database backup before migration
- Coordinate service restarts
- Test phone numbers for both LID and regular

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: LID Fix | 2-3 hours | None |
| Phase 2: Company ID | 3-4 hours | Phase 1 complete |
| Phase 3: WebSocket | 2-3 hours | Independent |
| Phase 4: Cleanup | 1-2 hours | Phases 1-3 complete |

**Total Estimated:** 8-12 hours
**Recommended Order:** 1 → 2 → 3 → 4 (Phase 3 can run in parallel)

---

## References

- Original testing report: `dev/active/onboarding-testing/onboarding-testing-report.md`
- WhatsApp client: `src/integrations/whatsapp/client.js`
- Marketplace WebSocket: `src/api/websocket/marketplace-socket.js`
- Onboarding page: `public/marketplace/onboarding.html`
- Plan reviewer findings: See session notes
