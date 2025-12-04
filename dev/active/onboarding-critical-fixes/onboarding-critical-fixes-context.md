# Onboarding Critical Fixes - Context

**Last Updated:** 2025-12-04 20:55 MSK
**Status:** Phase 1 & 2 COMPLETE ✅ | Phase 3 & 4 Pending
**Current Phase:** Phase 3 (WebSocket) - Ready to Start

---

## SESSION SUMMARY (2025-12-04)

### What Was Accomplished:
1. **Phase 1 (LID Fix):** COMPLETE - commit `14a222a`
   - Fixed `_extractPhoneNumber()` to preserve `@lid` suffix
   - Both LID and regular phone tests passed

2. **Phase 2 (Company ID):** COMPLETE - commit `74b4ce8`
   - Updated `scripts/baileys-service.js` to use prefixed format
   - Ran database migration - deleted duplicates, unified format
   - All company_ids now use `company_962302` format

### What Remains:
- **Phase 3:** WebSocket `whatsapp-connected` event not reaching frontend
- **Phase 4:** Remove console.log from onboarding.html, add tests

### Key Commands Used:
```bash
# Test LID via client
ssh root@46.149.70.219 'cd /opt/ai-admin && node -e "require(\"./src/integrations/whatsapp/client\").sendMessage(\"152926689472618\", \"Test\")"'

# Check database company_ids
ssh root@46.149.70.219 'cd /opt/ai-admin && node -e "require(\"./src/database/postgres\").query(\"SELECT company_id FROM whatsapp_auth\").then(r => console.table(r.rows))"'
```

---

## Quick Summary

Three critical bugs block production deployment:

1. **LID Phone Fix (CRITICAL):** `_extractPhoneNumber()` strips `@lid` suffix → 400 errors
2. **Company ID (HIGH):** Dual formats cause duplicate credentials
3. **WebSocket (MEDIUM):** `whatsapp-connected` event not reaching frontend

---

## Key Files

### Primary Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `src/integrations/whatsapp/client.js` | WhatsApp message sending | Fix `_extractPhoneNumber()` |
| `src/api/websocket/marketplace-socket.js` | WebSocket events | Debug logging, verify event flow |
| `public/marketplace/onboarding.html` | Onboarding UI | Remove console.log, verify socket |
| `baileys-whatsapp-service/` | Baileys backend | Verify company_id format |

### Database Tables

| Table | Issue |
|-------|-------|
| `whatsapp_auth` | Duplicate company_ids (962302, company_962302) |
| `whatsapp_keys` | Same issue |
| `companies` | Uses numeric company_id |

---

## Key Decisions

### Decision 1: LID Handling Approach

**Options:**
1. Fix `_extractPhoneNumber()` to preserve `@lid`
2. Stop using `_extractPhoneNumber()` in sendMessage()
3. Store original JID format from incoming messages

**Chosen:** Option 1 - Simplest fix, minimal code changes

**Rationale:**
- `_extractPhoneNumber()` is only used in sendMessage and diagnoseProblem
- Adding @lid check is safe and backward-compatible

### Decision 2: Company ID Format

**Options:**
1. Use numeric everywhere (962302)
2. Use prefixed everywhere (company_962302)

**Chosen:** Option 2 - Use `company_{salon_id}` everywhere

**Rationale:**
- Already used in marketplace code
- Clear namespace separation
- Supports multi-tenant future
- marketplace-socket.js already expects this format

### Decision 3: WebSocket vs Polling

**Chosen:** Fix WebSocket but keep polling as fallback

**Rationale:**
- WebSocket is better UX
- Polling provides reliability
- Both should work for robustness

---

## Current Implementation State

### LID Fix Status ✅ COMPLETE
- [x] Root cause identified: `_extractPhoneNumber()` line 555
- [x] Fix designed
- [x] Fix implemented (commit 14a222a)
- [x] Tested locally
- [x] Deployed to production
- [x] Verified with real LID message
- **Test Results:**
  - LID (152926689472618): ✅ Success, messageId: 3EB08FCB8A87621721ED99
  - Regular (79686484488): ✅ Success, messageId: 3EB0CEEED27A8D00A77C43

### Company ID Status ✅ COMPLETE
- [x] All locations audited
- [x] Format decision made (prefixed)
- [x] Migration script created
- [x] baileys-service.js updated (commit 74b4ce8)
- [x] Backup created (whatsapp_auth_backup_20251204, whatsapp_keys_backup_20251204)
- [x] Production migration run (2025-12-04 20:50 MSK)
- [x] Verified no duplicates
- **Results:**
  - whatsapp_auth: 1 duplicate deleted, 1 record remains with `company_962302`
  - whatsapp_keys: 22 duplicates deleted, 19 converted to prefixed format

### WebSocket Status
- [x] Code analyzed
- [ ] Debug logging added
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] End-to-end tested

---

## Integration Points

### Message Flow (LID issue)
```
Worker → sendMessage() → _formatPhone() → _extractPhoneNumber() → Baileys API
                              ↓                    ↓
                         Adds @lid            Strips @lid (BUG!)
```

### Session ID Flow (Company ID issue)
```
Onboarding → JWT token (salon_id: 962302)
           → marketplace-socket.js → sessionId = `company_${salonId}` = "company_962302"
           → sessionPool.createSession("company_962302")
           → Baileys → stores in whatsapp_auth with company_id = "company_962302"

BUT baileys-service standalone uses:
           → companyId from .env = "962302"
           → stores in whatsapp_auth with company_id = "962302"

RESULT: Two records!
```

### WebSocket Event Flow
```
Baileys connects → sessionPool emits 'connected' with {companyId: "company_962302"}
                 → marketplace-socket handleConnected()
                 → checks: data.companyId === sessionId
                 → emits 'whatsapp-connected' to socket
                 → onboarding.html socket.on('whatsapp-connected')
```

---

## Test Data

### LID Test Number
- **LID:** 152926689472618
- **Format for Baileys:** 152926689472618@lid

### Regular Test Number
- **Phone:** 79686484488
- **Format for Baileys:** 79686484488@s.whatsapp.net

### Test Salon
- **Salon ID:** 962302
- **Company Name:** KULTURA Малаховка
- **Session ID:** company_962302

---

## Blockers & Workarounds

### Current Blocker: None
Ready to start implementation.

### Previous Blockers (Resolved)
1. ~~UTF-8 encoding~~ - Fixed (commit c5e70ba)
2. ~~JWT decoding~~ - Fixed (commit 3ec9f33)
3. ~~company_title display~~ - Fixed (commit 57cb7fa)

---

## Performance Considerations

- LID fix: No performance impact (simple string check)
- Company ID migration: One-time operation, run during low traffic
- WebSocket: No change in performance

---

## Testing Notes

### Manual Test Procedure

1. **LID Test:**
```bash
# On server
curl -X POST http://localhost:3003/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"152926689472618@lid","message":"LID test direct"}'
```

2. **Via WhatsApp Client:**
```bash
# Test through client.js
node -e "require('./src/integrations/whatsapp/client').sendMessage('152926689472618', 'Test via client')"
```

3. **WebSocket Test:**
- Open https://adminai.tech/marketplace/onboarding?token=...
- Open DevTools → Network → WS
- Scan QR code
- Look for 'whatsapp-connected' frame

---

## Next Session Continuation

If context resets, start here:

1. Read this file for current state
2. Check `onboarding-critical-fixes-tasks.md` for next task
3. Continue from where left off

**Priority order:**
1. Phase 1: LID Fix (CRITICAL)
2. Phase 2: Company ID (HIGH)
3. Phase 3: WebSocket (MEDIUM)
4. Phase 4: Cleanup (LOW)
