# Onboarding Critical Fixes - Tasks

**Last Updated:** 2025-12-04 20:55 MSK
**Status:** Phase 1 & 2 COMPLETE ✅ | Phase 3 & 4 Pending

---

## Phase 1: LID Phone Handling Fix (CRITICAL) ✅ COMPLETE

### 1.1 Fix _extractPhoneNumber()
- [x] Open `src/integrations/whatsapp/client.js`
- [x] Locate `_extractPhoneNumber()` method (lines 548-556)
- [x] Add check for `@lid` suffix before stripping
- [x] Preserve `@lid` suffix for LID numbers

**Code Change:**
```javascript
_extractPhoneNumber(formattedPhone) {
  if (!formattedPhone) return '';

  // Preserve @lid suffix for WhatsApp internal IDs
  if (formattedPhone.includes('@lid')) {
    return formattedPhone;
  }

  return formattedPhone
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace(/[^\d]/g, '');
}
```

### 1.2 Add Phone Format Logging
- [x] Add debug logging in `_formatPhone()`
- [x] Log input, detected format (LID/regular), output
- [x] Use `logger.debug()` to avoid production noise

### 1.3 Test with LID Numbers ✅
- [x] SSH to server
- [x] Test direct API call: `curl -X POST http://localhost:3003/send -d '{"phone":"152926689472618@lid","message":"LID test"}'`
- [x] Verify success response with messageId
- **Result:** `{"success":true,"messageId":"3EB08FCB8A87621721ED99","phone":"152926689472618@lid"}`

### 1.4 Test with Regular Numbers ✅
- [x] Test via client.sendMessage(): `79686484488`
- [x] Verify success response
- **Result:** `{"success":true,"messageId":"3EB0CEEED27A8D00A77C43","phone":"79686484488"}`

### 1.5 Deploy and Verify ✅
- [x] Commit changes (14a222a)
- [x] Push to main
- [x] Deploy: `pm2 restart ai-admin-worker-v2 ai-admin-api`
- [x] Verify via client.sendMessage() - both LID and regular work!
- [x] Check logs for success

---

## Phase 2: Company ID Unification (HIGH) ✅ COMPLETE

### 2.1 Audit Code Locations ✅
- [x] `src/api/websocket/marketplace-socket.js` - uses `company_${salonId}`
- [x] `src/api/routes/yclients-marketplace.js` - uses `company_${salon_id}`
- [x] `scripts/baileys-service.js` - was using `962302`, now fixed
- [x] Document all locations found

### 2.2 Decision: Use Prefixed Format ✅
- [x] Decided: Use `company_{salon_id}` everywhere
- [x] Implemented in baileys-service.js

### 2.3 Update baileys-service ✅
- [x] Check current format - was using `process.env.COMPANY_ID || '962302'`
- [x] Updated to use `company_${salonId}` format (commit 74b4ce8)
- [x] Tested - logs show `company company_962302`

### 2.4 Create Database Migration ✅
- [x] Created `migrations/20251204_unify_company_id.sql`
- [x] Created backups: `whatsapp_auth_backup_20251204`, `whatsapp_keys_backup_20251204`
- [x] Deleted 1 duplicate from whatsapp_auth
- [x] Deleted 22 duplicates from whatsapp_keys
- [x] Converted 19 keys from numeric to prefixed format

**Migration Script:**
```sql
-- Backup
-- CREATE TABLE whatsapp_auth_backup AS SELECT * FROM whatsapp_auth;

-- Update numeric to prefixed
UPDATE whatsapp_auth
SET company_id = CONCAT('company_', company_id)
WHERE company_id NOT LIKE 'company_%'
  AND company_id ~ '^[0-9]+$';

-- Remove duplicates (keep newest)
DELETE FROM whatsapp_auth a
USING whatsapp_auth b
WHERE a.company_id = b.company_id
  AND a.created_at < b.created_at;

-- Same for keys
UPDATE whatsapp_keys
SET company_id = CONCAT('company_', company_id)
WHERE company_id NOT LIKE 'company_%'
  AND company_id ~ '^[0-9]+$';
```

### 2.5 Run Migration ✅
- [x] Created backup first (whatsapp_auth_backup_20251204, whatsapp_keys_backup_20251204)
- [x] Run migration on production (2025-12-04 20:50 MSK)
- [x] Verified changes

### 2.6 Verify No Duplicates ✅
- [x] whatsapp_auth: 1 record with `company_962302`
- [x] whatsapp_keys: all records use `company_962302`
- [x] No duplicates remaining!

---

## Phase 3: WebSocket Fix (MEDIUM)

### 3.1 Add Debug Logging
- [ ] Add logging in `handleConnected()` (marketplace-socket.js)
- [ ] Log received companyId vs expected sessionId
- [ ] Log when event is emitted

### 3.2 Verify Socket.IO Namespace
- [ ] Check namespace configuration in server
- [ ] Check namespace connection in client
- [ ] Verify client connects to `/marketplace`

### 3.3 Check Company ID in Events
- [ ] Verify sessionPool emits correct companyId format
- [ ] Verify marketplace-socket expects same format
- [ ] Check for format mismatch

### 3.4 End-to-End Test
- [ ] Open onboarding page
- [ ] Open DevTools Network tab (WS filter)
- [ ] Scan QR code or use pairing code
- [ ] Watch for `whatsapp-connected` event
- [ ] Verify page transitions automatically

### 3.5 Remove Debug Logging
- [ ] After fix confirmed, remove verbose logging
- [ ] Keep essential info logging

---

## Phase 4: Code Cleanup (LOW)

### 4.1 Remove console.log from Production
- [ ] Open `public/marketplace/onboarding.html`
- [ ] Remove or wrap console.log statements:
  - [ ] Line 493: Token data
  - [ ] Line 524: WebSocket connected
  - [ ] Line 529: QR received
  - [ ] Line 535: Status update
  - [ ] Line 540: WhatsApp connected
  - [ ] Line 572: Polling fallback
  - [ ] Line 591: Pairing code received
  - [ ] Line 803: Pairing code request

**Approach:**
```javascript
const DEBUG = false;
const debug = (...args) => DEBUG && console.log(...args);
```

### 4.2 Add LID Phone Test
- [ ] Create/update `tests/whatsapp/phone-format.test.js`
- [ ] Add test: LID numbers get @lid suffix
- [ ] Add test: Regular numbers get @c.us suffix

### 4.3 Add Regular Phone Test
- [ ] Test 10-digit numbers
- [ ] Test 11-digit numbers with country code
- [ ] Test international formats

### 4.4 Update Documentation
- [ ] Update onboarding-testing-report.md with fix status
- [ ] Add notes about LID format handling
- [ ] Document company_id format decision

---

## Verification Checklist

### After Phase 1
- [ ] LID message sends successfully
- [ ] Regular phone message sends successfully
- [ ] No regressions in existing functionality
- [ ] Logs show correct format detection

### After Phase 2
- [ ] Only one format in whatsapp_auth
- [ ] Only one format in whatsapp_keys
- [ ] Session lookup works correctly
- [ ] handleUninstall finds credentials

### After Phase 3
- [ ] WebSocket event reaches frontend
- [ ] Page transitions automatically on connect
- [ ] Polling fallback still works

### After Phase 4
- [ ] No console.log in production build
- [ ] All tests pass
- [ ] Documentation updated

---

## Quick Commands

```bash
# SSH to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Deploy
cd /opt/ai-admin && git pull && pm2 restart all

# Check logs
pm2 logs ai-admin-worker-v2 --lines 50

# Test LID message
curl -X POST http://localhost:3003/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"152926689472618@lid","message":"Test"}'

# Check database
psql $DATABASE_URL -c "SELECT company_id FROM whatsapp_auth"
```

---

## Notes

- Phase 1 is CRITICAL and should be done first
- Phase 2 requires careful migration planning
- Phase 3 can be done in parallel with Phase 2
- Phase 4 is cleanup and can wait
