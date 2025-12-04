# WhatsApp Pairing Code Fix - Context

**Last Updated:** 2025-12-04
**Status:** In Progress

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

## Next Actions

1. Implement Task 1.1: Credential cleanup in session-pool.js
2. Implement Task 1.2: Phone validation in auth-state-timeweb.js
3. Test with moderator's salon (997441)
4. Deploy to production
