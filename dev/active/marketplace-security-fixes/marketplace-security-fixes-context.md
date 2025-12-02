# YClients Marketplace Security Fixes - Context

**Last Updated:** 2025-12-02
**Status:** IN PROGRESS

---

## Current Session Summary

### What Happened
1. YClients moderator (Шигарцов Филипп) connected test salon 997441
2. Registration failed - `salon_id` not parsed from `salon_ids[0]` array
3. Fixed parameter parsing for `salon_ids[]` and `user_data` base64
4. Deployed fix, but discovered more issues in code review

### Code Review Results
- **Grade:** C+ (76/100)
- **2 CRITICAL security issues** blocking moderation
- **2 IMPORTANT issues** for robustness
- Full review: `dev/active/marketplace-code-review/marketplace-integration-code-review.md`

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/api/routes/yclients-marketplace.js` | Main integration routes | 1,275 |
| `src/utils/validators.js` | Input validation helpers | 206 |
| `src/repositories/CompanyRepository.js` | Company data access | 262 |
| `src/repositories/MarketplaceEventsRepository.js` | Event logging | ~100 |

---

## Environment Configuration

### Production Server
```bash
# Server access
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Path
/opt/ai-admin

# Key environment variables (in .env)
YCLIENTS_PARTNER_TOKEN=***  # Required for HMAC
YCLIENTS_APP_ID=18289
JWT_SECRET=***
BASE_URL=https://adminai.tech  # Fixed today!
```

### YClients Marketplace Settings
```
Callback URL: https://adminai.tech/webhook/yclients
Registration Redirect URL: https://adminai.tech/auth/yclients/redirect
```

**NOTE:** Moderator mentioned these were `ai-admin.app` - MUST be changed to `adminai.tech`!

---

## Key Decisions Made

### 1. HMAC Algorithm
**Decision:** Use HMAC-SHA256 with `PARTNER_TOKEN` as secret
**Rationale:** YClients documentation specifies this algorithm
**Implementation:**
```javascript
crypto.createHmac('sha256', PARTNER_TOKEN).update(user_data).digest('hex')
```

### 2. Timing-Safe Comparison
**Decision:** Use `crypto.timingSafeEqual()` for signature comparison
**Rationale:** Prevents timing attacks that could leak signature information

### 3. Input Sanitization Strategy
**Decision:** Use existing `src/utils/validators.js` functions
**Rationale:** Already tested, consistent with codebase patterns
**Functions:**
- `sanitizeString()` - removes HTML, control chars
- `validateEmail()` - RFC-compliant email check
- `normalizePhone()` - 7xxx format for Russian numbers
- `validateId()` - positive integer validation

### 4. Error Response Strategy
**Decision:** Return 200 OK for webhook validation failures
**Rationale:** Prevents YClients from retrying and flooding our logs
**Pattern:** Log error, capture to Sentry, return `{ success: false }`

---

## Technical Notes

### salon_ids[] Parameter Format
YClients sends:
```
?salon_ids[0]=997441&user_data=eyJpZCI6NjQxOTYzMiwi...&user_data_sign=bff620a90...
```

Express parses this as:
- `req.query['salon_ids[0]']` = '997441' (string key)
- OR `req.query.salon_ids` = ['997441'] (array, depending on config)

**Current handling (line 137-145):**
```javascript
let salon_id = req.query.salon_id;
if (!salon_id && req.query['salon_ids[0]']) {
  salon_id = req.query['salon_ids[0]'];
}
if (!salon_id && req.query.salon_ids && Array.isArray(req.query.salon_ids)) {
  salon_id = req.query.salon_ids[0];
}
```

### user_data Base64 Structure
```json
{
  "id": 6419632,
  "name": "Шигарцов Филипп",
  "phone": "79006464263",
  "email": "f.schigartcov@yclients.tech",
  "is_approved": true,
  "avatar": "https://assets.yclients.com/...",
  "salon_name": "Filipp Schigartsov (test!)"
}
```

### Database Schema - companies table
Key columns for marketplace:
- `yclients_id` - YClients salon ID
- `marketplace_user_id` - YClients user who connected
- `marketplace_user_name` - User name (needs sanitization!)
- `marketplace_user_phone` - User phone
- `marketplace_user_email` - User email
- `integration_status` - 'pending_whatsapp', 'activating', 'active', 'activation_failed'
- `api_key` - Generated on activation (must be cleared on rollback!)
- `whatsapp_connected` - Boolean flag

---

## Blockers & Dependencies

### Blocking Moderation
1. **HMAC not verified** - Security requirement
2. **Input not sanitized** - Could fail security audit

### Dependencies
- YClients moderator must change URLs from `ai-admin.app` to `adminai.tech`
- Moderator must retry connection after fixes deployed

---

## Testing Data

### Test Salon
- **Salon ID:** 997441
- **Salon Name:** "Filipp Schigartsov (test!)"
- **Moderator:** Шигарцов Филипп
- **User ID:** 6419632

### Test URL (from moderator)
```
https://adminai.tech/auth/yclients/redirect?salon_ids%5B0%5D=997441&user_data=eyJpZCI6NjQxOTYzMiwibmFtZSI6ItCo0LjQs9Cw0YDRhtC%2B0LIg0KTQuNC70LjQv9C%2FIiwicGhvbmUiOiI3OTAwNjQ2NDI2MyIsImVtYWlsIjoiZi5zaGNoaWdhcnRzb3ZAeWNsaWVudHMudGVjaCIsImlzX2FwcHJvdmVkIjp0cnVlLCJhdmF0YXIiOiJodHRwczovL2Fzc2V0cy55Y2xpZW50cy5jb20vZ2VuZXJhbC9iL2IwL2IwYTY4OTY0YWZiZTQwMV8yMDI0MDIyNTEzMzAwMy5wbmciLCJzYWxvbl9uYW1lIjoiRmlsaXBwIFNjaGlnYXJ0Y292ICh0ZXN0ISkifQ%3D%3D&user_data_sign=bff620a90b29b491ca3f232103ae65ba2d0cf79b94932b6b2c61adfcd37d282a
```

---

## Rollback Plan

If fixes cause issues:
1. `git revert HEAD` on server
2. `pm2 restart ai-admin-api`
3. Notify moderator to wait

---

## Next Steps After Fixes

1. Deploy all fixes
2. Ask moderator to:
   - Update URLs in YClients settings
   - Retry "Connect" button
3. Monitor logs for successful registration
4. Complete WhatsApp QR scanning
5. Verify activation callback to YClients

---

## Related Documentation

- Code Review: `dev/active/marketplace-code-review/`
- YClients Marketplace Docs: https://docs.yclients.com/marketplace
- Authorization Guide: `docs/marketplace/AUTHORIZATION_QUICK_REFERENCE.md`
