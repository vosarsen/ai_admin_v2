# YClients Marketplace Integration - Code Review Summary

**Review Completed:** 2025-12-02
**Scope:** Complete registration flow (redirect → QR → activation)
**Grade:** C+ (76/100)

---

## Critical Findings (Must Fix Before Moderation)

### 🔴 CRITICAL 1: Missing HMAC Signature Verification
**File:** `src/api/routes/yclients-marketplace.js:149`
**Risk:** HIGH - Request forgery, fake salon registrations

YClients sends `user_data_sign` parameter but code **never verifies it**. Attacker can:
- Forge salon registrations
- Inject malicious user data
- Steal integrations

**Fix Required:** Add HMAC-SHA256 verification before parsing `user_data`:
```javascript
const expectedSign = crypto
  .createHmac('sha256', PARTNER_TOKEN)
  .update(user_data)
  .digest('hex');

if (!crypto.timingSafeEqual(Buffer.from(user_data_sign), Buffer.from(expectedSign))) {
  return res.status(403).send(renderErrorPage('Ошибка безопасности', ...));
}
```

**Estimated Fix Time:** 2 hours

---

### 🔴 CRITICAL 2: Missing Input Sanitization
**File:** `src/api/routes/yclients-marketplace.js:153-159`
**Risk:** MEDIUM-HIGH - XSS via stored user names, invalid emails

Decoded `user_data` fields used directly without validation:
- `user_name` → potential XSS (displayed in UI)
- `user_email` → no format validation
- `user_phone` → no normalization

**Fix Required:** Use existing validators from `src/utils/validators.js`:
```javascript
const { sanitizeString, validateEmail, normalizePhone } = require('../../utils/validators');

user_name = sanitizeString(decodedData.name, 255);
user_email = validateEmail(decodedData.email) ? decodedData.email : null;
user_phone = normalizePhone(decodedData.phone);
```

**Estimated Fix Time:** 1 hour

---

### 🔴 CRITICAL 3: Database Rollback Bug
**File:** `src/api/routes/yclients-marketplace.js:568-571`
**Issue:** If YClients API fails AFTER saving `api_key`, key is leaked (not rolled back)

Current code references non-existent `error.decoded` variable. Should use transaction rollback.

**Estimated Fix Time:** 1 hour

---

## Important Issues

### 🟠 Webhook partner_token Validation is Optional
**File:** `src/api/routes/yclients-marketplace.js:603`

Code only validates if `partner_token` exists - allows unauthenticated webhooks!

**Fix:** Make validation mandatory (fail if missing)

### 🟠 QR Generation Retry Logic Missing
**File:** `src/api/routes/yclients-marketplace.js:356-374`

No retry if `createSession()` fails, no exponential backoff, generic errors.

### 🟠 Variable Name Typo
**File:** `src/services/marketplace/marketplace-service.js:76`

Uses `existingCompany` but variable is named `company` (copy-paste error)

---

## Security Concerns Summary

| Issue | Severity | Status |
|-------|----------|--------|
| HMAC verification missing | CRITICAL | ❌ Not implemented |
| Input sanitization missing | CRITICAL | ❌ Not implemented |
| Database rollback bug | HIGH | ❌ Broken |
| Webhook auth optional | MEDIUM | ⚠️ Weak |
| JWT validation incomplete | LOW | ⚠️ Needs improvement |

---

## Testing Status

**Current:**
- ✅ Repository unit tests (165/167 passing)
- ❌ No integration tests for registration flow
- ❌ No HMAC verification tests
- ❌ No webhook processing tests

**Required Before Moderation:**
- [ ] Test HMAC verification with real YClients signature
- [ ] Manual end-to-end test with salon 997441
- [ ] Test database rollback on API failure

---

## Architecture Assessment

**Strengths:**
- ✅ Clean repository pattern with PostgreSQL
- ✅ Comprehensive Sentry error tracking
- ✅ Transaction support for atomic operations
- ✅ Proper admin RBAC with rate limiting
- ✅ Timing-safe API key comparison

**Weaknesses:**
- ❌ 1,275 lines in single route file (too large)
- ⚠️ Direct SQL in transactions (bypasses repositories)
- ⚠️ No integration tests
- ⚠️ Missing security documentation

---

## Edge Cases Identified

1. **Multiple salon_ids** - Only handles first salon (should parse all)
2. **QR expires during scan** - No grace period guidance
3. **Existing WhatsApp session** - No cleanup of stale sessions

---

## Deployment Readiness

### ✅ Ready for Staging
- PostgreSQL migration complete
- Sentry operational
- Basic security in place

### 🔴 NOT Ready for Production
**Blockers:**
1. Missing HMAC verification (CRITICAL #1)
2. Missing input sanitization (CRITICAL #2)
3. Database rollback bug (CRITICAL #3)

**Estimated Total Fix Time:** 4-6 hours

---

## Recommendation

**DO NOT PROCEED** with YClients moderation until critical issues are fixed.

**Action Plan:**
1. Fix 3 critical issues (4-6 hours)
2. Add integration tests (2-3 hours)
3. Manual testing with salon 997441 (1 hour)
4. Request re-moderation

---

**Full Report:** See `marketplace-integration-code-review.md` (3,200+ lines)
**Files Reviewed:**
- `src/api/routes/yclients-marketplace.js` (1,275 lines)
- `src/repositories/CompanyRepository.js` (262 lines)
- `src/repositories/MarketplaceEventsRepository.js` (119 lines)
- `src/services/marketplace/marketplace-service.js` (785 lines)
- `public/marketplace/onboarding.html` (802 lines)

**Total Lines Analyzed:** 3,243
