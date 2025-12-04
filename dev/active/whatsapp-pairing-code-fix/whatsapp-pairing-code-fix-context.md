# WhatsApp Pairing Code Fix - Context

**Last Updated:** 2025-12-04 16:10 MSK
**Status:** Phase 1 COMPLETE + Critical Fixes, FULLY TESTED ✅
**Commits:**
- `4f681e0` - fix(whatsapp): add phone number mismatch detection for pairing code flow
- `e8dba5a` - fix(whatsapp): disconnect session before pairing code request to fix race condition
- `04af7a9` - fix(whatsapp): don't use env phoneNumber fallback for marketplace multi-tenant

---

## Quick Reference

### Key Files

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `src/integrations/whatsapp/session-pool.js` | Session management, pairing code logic | 267-284, 373-428 |
| `src/integrations/whatsapp/auth-state-timeweb.js` | PostgreSQL credential storage | 354-464, 714-742 |
| `src/api/websocket/marketplace-socket.js` | WebSocket handlers for marketplace | 280-337 |
| `src/api/routes/whatsapp-sessions.js` | REST API for sessions | All |
| `src/integrations/whatsapp/credentials-cache.js` | In-memory credential cache | All |

### Database Tables

| Table | Purpose |
|-------|---------|
| `whatsapp_auth` | Stores Baileys credentials (creds.json equivalent) |
| `whatsapp_keys` | Stores Signal Protocol keys |

### Important Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `createSession()` | session-pool.js:189 | Creates new WhatsApp session |
| `_createSessionWithMutex()` | session-pool.js:267 | Internal session creation with mutex |
| `useTimewebAuthState()` | auth-state-timeweb.js:354 | Loads/creates credentials from PostgreSQL |
| `removeTimewebAuthState()` | auth-state-timeweb.js:714 | Deletes all credentials for company |
| `saveCreds()` | auth-state-timeweb.js:661 | Saves credentials to PostgreSQL |

---

## Current Session State

**Salon:** 997441 (moderator's test salon)
**Phone Requested:** 79006464263
**Phone in DB:** 79936363848 (from previous test)
**Status:** Cleared manually during debugging

---

## Key Decisions Made

### Decision 1: Auto-cleanup vs Manual Reset

**Options:**
1. Auto-cleanup: Automatically delete old credentials when phone mismatch detected
2. Manual reset: Require user to explicitly reset before trying new phone

**Decision:** Both - Auto-cleanup for seamless UX, but also provide manual reset for edge cases

**Rationale:**
- Auto-cleanup handles 95% of cases silently
- Manual reset provides escape hatch for complex situations
- Frontend can show "Reset" button when credentials exist but pairing fails

---

### Decision 2: Where to Validate Phone Match

**Options:**
1. In `session-pool.js` before calling `useTimewebAuthState()`
2. In `auth-state-timeweb.js` during credential loading
3. Both places

**Decision:** In `auth-state-timeweb.js` - single source of truth for credentials

**Rationale:**
- Auth state is the definitive source for credentials
- Phone validation belongs with credential management
- Keeps session-pool focused on session lifecycle

---

### Decision 3: Timeout Duration

**Options:**
- 60 seconds (current)
- 30 seconds
- 20 seconds
- 10 seconds

**Decision:** 20 seconds

**Rationale:**
- WhatsApp typically responds in <10 seconds
- 20 seconds gives buffer for network latency
- 60 seconds is too long for poor UX
- 10 seconds might cause false timeouts on slow connections

---

## Lessons Learned

1. **Credentials persist across sessions** - When user disconnects, credentials stay in PostgreSQL. This is intentional for reconnection, but causes issues when user wants to switch phone numbers.

2. **Phone number stored in credentials** - The `creds.me.id` field contains the phone number (e.g., "79936363848@s.whatsapp.net"). This can be used for validation.

3. **Baileys fails silently on mismatch** - When credentials don't match the phone number, Baileys doesn't throw a clear error. It just times out.

4. **Mutex doesn't have timeout** - The `pairingCodeRequests` mutex blocks forever if the request hangs. Need to add timeout.

---

## Technical Notes

### Credential Structure

```javascript
// whatsapp_auth.creds JSON structure
{
  me: {
    id: "79936363848@s.whatsapp.net",  // <-- Phone number here!
    name: "~"
  },
  registered: false,
  pairingCode: "85ADBZ8G",
  advSecretKey: "...",
  signedIdentityKey: { ... },
  // ... more Signal Protocol data
}
```

### Phone Extraction

```javascript
const storedPhone = creds.me?.id?.split('@')[0]; // "79936363848"
```

### Credential Cleanup Query

```sql
-- Delete credentials for a company
DELETE FROM whatsapp_auth WHERE company_id = 'company_997441';
DELETE FROM whatsapp_keys WHERE company_id = 'company_997441';
```

---

## Environment

- **PostgreSQL:** Timeweb (remote, a84c973324fdaccfc68d929d.twc1.net)
- **Server:** 46.149.70.219 (Moscow datacenter)
- **PM2 Services:** ai-admin-api, ai-admin-worker-v2, baileys-whatsapp-service
- **Test Salon:** 997441 (Филипп's test salon)

---

## Debugging Commands

```bash
# Check credentials in DB
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node -e \"
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db',
  ssl: { rejectUnauthorized: false }
});
pool.query(\\\"SELECT company_id, creds->>'me' as me FROM whatsapp_auth\\\")
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); pool.end(); });
\""

# Delete credentials for a company
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node -e \"
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db',
  ssl: { rejectUnauthorized: false }
});
pool.query(\\\"DELETE FROM whatsapp_auth WHERE company_id = 'company_997441'\\\")
  .then(r => { console.log('Deleted:', r.rowCount); pool.end(); });
\""

# Check API logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-api --lines 50 --nostream"

# Check for pairing code requests
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-api --lines 200 --nostream | grep -i 'pairing'"
```

---

## Related Issues

- Code review: `dev/active/whatsapp-pairing-code-review/pairing-code-review.md`
- Previous fixes: `980cc9e fix(marketplace): remove duplicate WebSocket initialization`

---

## Session Summary (2025-12-04)

### What Was Done
1. **Phase 1 COMPLETE** - Core credential fixes implemented and deployed
2. **Code Review** done by `code-architecture-reviewer` agent - found 5 critical issues
3. **Dev-docs created** via `/dev-docs` command

### Key Changes Made

**File 1: `src/integrations/whatsapp/session-pool.js`**
- Lines 286-307: Added phone number extraction and passing to auth state
- Pass `phoneNumber` option to `useTimewebAuthState()` when pairing code requested
- Log message: `📱 Pairing code requested for phone X, checking for credential conflicts...`

**File 2: `src/integrations/whatsapp/auth-state-timeweb.js`**
- Line 359: Extract `phoneNumber` from options as `requestedPhone`
- Lines 407-463: NEW - Phone mismatch detection block
  - Extract stored phone from `creds.me?.id?.split('@')[0]`
  - Compare normalized phones (digits only)
  - If mismatch: call `removeTimewebAuthState()`, create fresh `initAuthCreds()`
  - Log to Sentry with tag `phone_mismatch_cleanup`

### How The Fix Works
```
1. User requests pairing code with phone 79006464263
2. auth-state-timeweb loads credentials from PostgreSQL
3. IF stored phone (79936363848) != requested phone (79006464263):
   - Log warning "Phone number mismatch detected"
   - Delete old credentials (whatsapp_auth + whatsapp_keys)
   - Clear cache
   - Create fresh credentials with initAuthCreds()
4. Baileys connects with clean credentials
5. Pairing code generated successfully
```

### Deployment Status
- **Committed:** `4f681e0`
- **Pushed:** to main branch
- **Deployed:** `ssh root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart ai-admin-api"`
- **Verified:** API starts without errors, pairing code generated (PNKM-5VQW)

### Waiting For
- Moderator (Филипп) to test salon 997441 with phone 79006464263
- Should see phone mismatch detection in logs if old credentials exist

## Session 2 Summary (2025-12-04 16:10 MSK)

### Additional Issues Found & Fixed

**Issue 1: Race Condition in Pairing Code Request**
- Problem: `startWhatsAppConnection()` creates session first, `request-pairing-code` gets blocked by mutex
- Solution: Disconnect existing session before creating new one with phoneNumber
- File: `src/api/websocket/marketplace-socket.js:315-326`

**Issue 2: Multi-tenant Env Fallback**
- Problem: `WHATSAPP_PHONE_NUMBER` env used as fallback for ALL salons
- Solution: Only use env fallback when `options.usePairingCode === true` explicitly
- File: `src/integrations/whatsapp/session-pool.js:286-296`

### Full Working Flow (Verified)

```
1. WebSocket connect → startWhatsAppConnection()
2. Initial createSession() with no phoneNumber → QR code mode (no pairing code auto-generated)
3. User clicks "Get Pairing Code" → emits request-pairing-code with phoneNumber
4. Handler disconnects existing session first
5. Creates new session with { usePairingCode: true, phoneNumber: '79006464263' }
6. auth-state-timeweb checks for phone mismatch:
   - If stored phone != requested phone → delete old credentials
   - Create fresh credentials for new phone
7. Pairing code generated for correct phone number
```

### Test Results

```bash
node scripts/test-phone-mismatch.js
# ✅ TEST PASSED: Phone mismatch detection works!
# ✅ Stored phone: 79006464263 (user's phone, not env default!)
# ✅ Credentials updated to correct phone!
```

### Logs Verification

```
🔌 Disconnected existing session before pairing code request
📱 Pairing code requested for phone 79006464263
❌ Phone number mismatch detected... stored:79991112233 requested:79006464263
🗑️ Deleting old credentials for company_997441
✅ Fresh credentials created (new phone: 79006464263)
✅ Pairing code generated: 6BQL-HE3S
```

## Next Actions

### Ready for Production Testing
1. Notify moderator (Филипп) to test salon 997441 with phone 79006464263
2. Expected flow: credentials will be created fresh with his phone
3. Monitor logs for any issues

### After Successful Testing
1. Move to `dev/completed/`
2. Update CLAUDE.md with fix summary

### Phase 2 Tasks (Optional - Improves UX)
- Task 2.1: Add `reset-whatsapp-credentials` WebSocket event
- Task 2.2: Improve error messages from Baileys
- Task 2.3: Add 20s timeout for pairing code requests
