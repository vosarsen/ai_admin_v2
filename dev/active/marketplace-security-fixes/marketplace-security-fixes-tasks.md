# YClients Marketplace Security Fixes - Tasks

**Last Updated:** 2025-12-02
**Status:** IN PROGRESS

---

## Phase 1: Critical Security Fixes

### Task 1.1: HMAC Signature Verification
**Priority:** CRITICAL | **Time:** 45 min | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:149-170`

- [ ] Add HMAC calculation using `crypto.createHmac('sha256', PARTNER_TOKEN)`
- [ ] Implement `crypto.timingSafeEqual()` for comparison
- [ ] Log security failures to Sentry with `security: true` tag
- [ ] Return 403 with user-friendly error page on invalid signature
- [ ] Handle edge case: missing `user_data_sign` (graceful degradation or error?)
- [ ] Test with real YClients signature from URL provided by moderator

**Code Location:**
```javascript
// Line 149-170: After user_data parsing, before any other processing
const { user_data, user_data_sign } = req.query;

// ADD HMAC VERIFICATION HERE
```

---

### Task 1.2: Input Sanitization
**Priority:** CRITICAL | **Time:** 30 min | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:153-159`

- [ ] Import validators: `{ sanitizeString, validateEmail, normalizePhone, validateId }`
- [ ] Sanitize `user_name` with `sanitizeString(name, 255)`
- [ ] Validate `user_id` with `validateId(id)`
- [ ] Validate `user_email` with `validateEmail(email)`
- [ ] Normalize `user_phone` with `normalizePhone(phone)`
- [ ] Sanitize `salon_name` with `sanitizeString(salon_name, 255)`
- [ ] Return error if `user_id` is invalid (required field)
- [ ] Log sanitization results to debug any data loss

**Current Code (unsafe):**
```javascript
user_id = decodedData.id;           // ❌ No validation
user_name = decodedData.name;       // ❌ No sanitization
user_phone = decodedData.phone;     // ❌ No format check
user_email = decodedData.email;     // ❌ No validation
salon_name = decodedData.salon_name; // ❌ No sanitization
```

---

### Task 1.3: Database Rollback Fix
**Priority:** HIGH | **Time:** 30 min | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:564-578`

- [ ] Fix variable reference: use `company_id` not `error.decoded.company_id`
- [ ] Clear `api_key` on rollback (set to `null`)
- [ ] Set `integration_status` to `'activation_failed'`
- [ ] Log failed activation to `marketplace_events` table
- [ ] Wrap rollback in try-catch with Sentry `level: 'fatal'`
- [ ] Add Sentry exception capture for main error

**Current Code (buggy):**
```javascript
// BUG: error.decoded doesn't exist!
if (error.decoded && error.decoded.company_id) {
  await companyRepository.update(error.decoded.company_id, {
```

---

## Phase 2: Robustness Improvements

### Task 2.1: QR Generation Retry Logic
**Priority:** MEDIUM | **Time:** 45 min | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:355-374`

- [ ] Wrap `createSession()` in try-catch
- [ ] Log session creation errors to Sentry
- [ ] Implement exponential backoff: `Math.min(1000 * Math.pow(1.5, attempts), 5000)`
- [ ] Add progress logging every 3 attempts
- [ ] Log timeout to Sentry with session details
- [ ] Improve error message to include attempt count

**Current Code (basic):**
```javascript
let attempts = 0;
while (!qr && attempts < 10) {
  await new Promise(resolve => setTimeout(resolve, 1000)); // ❌ Fixed 1s delay
  qr = await sessionPool.getQR(sessionId);
  attempts++;
}
```

---

### Task 2.2: Webhook partner_token Enforcement
**Priority:** MEDIUM | **Time:** 15 min | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:601-611`

- [ ] Add check for missing `partner_token`
- [ ] Log missing token to Sentry with `security: true` tag
- [ ] Return 200 OK with `{ success: false, error: 'Missing partner_token' }`
- [ ] Keep existing invalid token check

**Current Code (incomplete):**
```javascript
// ❌ Only validates IF partner_token exists
if (partner_token && partner_token !== PARTNER_TOKEN) {
```

---

## Deployment Checklist

- [ ] All Phase 1 tasks completed
- [ ] All Phase 2 tasks completed
- [ ] Code committed with descriptive messages
- [ ] Push to main branch
- [ ] Deploy: `ssh ... && git pull && pm2 restart ai-admin-api`
- [ ] Health check: `curl https://adminai.tech/marketplace/health`
- [ ] Test with salon 997441 URL
- [ ] Notify moderator to retry

---

## Verification Checklist

- [ ] HMAC verification works with real YClients signature
- [ ] Invalid signatures rejected with 403
- [ ] User data sanitized in database
- [ ] Rollback clears API key on failure
- [ ] QR generation retries with backoff
- [ ] Webhooks require partner_token
- [ ] No errors in Sentry
- [ ] Moderator successfully connects salon

---

## Progress Summary

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| Phase 1 | 3 | 0 | ⬜ Not Started |
| Phase 2 | 2 | 0 | ⬜ Not Started |
| **Total** | **5** | **0** | **0%** |
