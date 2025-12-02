# YClients Marketplace Security Fixes - Plan

**Last Updated:** 2025-12-02
**Priority:** CRITICAL - Blocking YClients moderation
**Estimated Time:** 3-4 hours
**Target:** Pass YClients Marketplace moderation

---

## Executive Summary

YClients Marketplace moderation revealed critical security vulnerabilities in our registration flow. This plan addresses 3 critical and 1 important issue that must be fixed before moderation approval.

**Current State:**
- Registration redirect now parses `salon_ids[]` and `user_data` correctly (fixed today)
- HMAC signature verification NOT implemented (security vulnerability)
- Input sanitization NOT implemented (XSS/injection risk)
- Database rollback has bug in error handler
- QR code generation lacks retry logic

**Target State:**
- All YClients requests verified with HMAC signature
- All user input sanitized before database storage
- Proper rollback on activation failure
- Robust QR generation with exponential backoff

---

## Phase 1: Critical Security Fixes (2 hours)

### Task 1.1: HMAC Signature Verification
**Priority:** CRITICAL
**Time:** 45 min
**File:** `src/api/routes/yclients-marketplace.js:149-170`

**Problem:**
YClients sends `user_data_sign` (HMAC-SHA256 signature) but we NEVER verify it. This allows attackers to forge registration requests.

**Solution:**
```javascript
// Verify HMAC BEFORE parsing user_data
if (user_data && user_data_sign) {
  const expectedSign = crypto
    .createHmac('sha256', PARTNER_TOKEN)
    .update(user_data)
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(user_data_sign),
    Buffer.from(expectedSign)
  )) {
    // Log security event to Sentry
    // Return 403 error page
  }
}
```

**Acceptance Criteria:**
- [ ] HMAC verification implemented with timing-safe comparison
- [ ] Invalid signatures logged to Sentry with `security: true` tag
- [ ] User-friendly error page shown on verification failure
- [ ] Test with real YClients signature from moderation

---

### Task 1.2: Input Sanitization
**Priority:** CRITICAL
**Time:** 30 min
**File:** `src/api/routes/yclients-marketplace.js:153-159`

**Problem:**
User data from `user_data` base64 decoded without sanitization:
- `user_name` - potential XSS
- `user_email` - needs email validation
- `user_phone` - needs normalization
- `salon_name` - potential XSS

**Solution:**
Use existing validators from `src/utils/validators.js`:
```javascript
const { sanitizeString, validateEmail, normalizePhone, validateId } = require('../../utils/validators');

user_id = validateId(decodedData.id);
user_name = sanitizeString(decodedData.name, 255);
user_phone = decodedData.phone ? normalizePhone(decodedData.phone) : null;
user_email = validateEmail(decodedData.email) ? decodedData.email : null;
salon_name = sanitizeString(decodedData.salon_name, 255);
```

**Acceptance Criteria:**
- [ ] All user_data fields sanitized before use
- [ ] Invalid user_id triggers error response
- [ ] Email validated with existing `validateEmail()`
- [ ] Phone normalized with existing `normalizePhone()`
- [ ] Strings sanitized with existing `sanitizeString()`

---

### Task 1.3: Database Rollback Fix
**Priority:** HIGH
**Time:** 30 min
**File:** `src/api/routes/yclients-marketplace.js:564-578`

**Problem:**
Current rollback code has bug:
```javascript
if (error.decoded && error.decoded.company_id) {  // BUG: error.decoded doesn't exist!
  await companyRepository.update(error.decoded.company_id, {
```

Also, API key not cleared on rollback - security leak.

**Solution:**
```javascript
} catch (error) {
  logger.error('❌ Activation error:', error);
  Sentry.captureException(error, {
    tags: { component: 'marketplace', operation: 'activate' },
    extra: { salon_id, company_id }
  });

  // Rollback: clear API key and set failed status
  if (company_id) {
    try {
      await companyRepository.update(company_id, {
        api_key: null,  // Clear leaked key!
        integration_status: 'activation_failed'
      });

      await marketplaceEventsRepository.insert({
        company_id,
        salon_id: parseInt(salon_id),
        event_type: 'activation_failed',
        event_data: { error: error.message }
      });
    } catch (rollbackError) {
      Sentry.captureException(rollbackError, { level: 'fatal' });
    }
  }
  // ...
}
```

**Acceptance Criteria:**
- [ ] Variable name fixed (`decoded` from outer scope, not `error.decoded`)
- [ ] API key cleared on rollback
- [ ] Failed activation logged to `marketplace_events`
- [ ] Rollback errors captured to Sentry with `level: 'fatal'`

---

## Phase 2: Robustness Improvements (1 hour)

### Task 2.1: QR Generation Retry Logic
**Priority:** MEDIUM
**Time:** 45 min
**File:** `src/api/routes/yclients-marketplace.js:355-374`

**Problem:**
Current code polls every 1 second (too frequent) with no:
- Error handling for `createSession()` failures
- Exponential backoff
- Sentry tracking on timeout

**Solution:**
```javascript
let qr = await sessionPool.getQR(sessionId);

if (!qr) {
  logger.info('🔄 Initializing new WhatsApp session...');

  try {
    await sessionPool.createSession(sessionId, { company_id, salon_id });
  } catch (sessionError) {
    Sentry.captureException(sessionError, {
      tags: { component: 'marketplace', operation: 'createSession' }
    });
    throw new Error('WhatsApp session creation failed');
  }

  // Exponential backoff: 1s, 1.5s, 2.25s, ... max 5s
  let attempts = 0;
  const maxAttempts = 10;

  while (!qr && attempts < maxAttempts) {
    const delay = Math.min(1000 * Math.pow(1.5, attempts), 5000);
    await new Promise(resolve => setTimeout(resolve, delay));
    qr = await sessionPool.getQR(sessionId);
    attempts++;
  }

  if (!qr) {
    Sentry.captureException(new Error('QR timeout'), {
      extra: { sessionId, attempts: maxAttempts }
    });
    throw new Error('QR code generation timeout');
  }
}
```

**Acceptance Criteria:**
- [ ] `createSession()` errors caught and logged to Sentry
- [ ] Exponential backoff implemented (1s → 5s max)
- [ ] Timeout errors logged to Sentry
- [ ] Better error messages for debugging

---

### Task 2.2: Webhook partner_token Enforcement
**Priority:** MEDIUM
**Time:** 15 min
**File:** `src/api/routes/yclients-marketplace.js:601-611`

**Problem:**
Current code only validates `partner_token` if it's present:
```javascript
if (partner_token && partner_token !== PARTNER_TOKEN) {  // If not sent, skipped!
```

**Solution:**
```javascript
// partner_token is REQUIRED for webhook security
if (!partner_token) {
  logger.error('❌ Webhook missing partner_token');
  Sentry.captureMessage('YClients webhook without partner_token', {
    level: 'warning',
    tags: { security: true }
  });
  return res.status(200).json({ success: false, error: 'Missing partner_token' });
}

if (partner_token !== PARTNER_TOKEN) {
  // existing validation...
}
```

**Acceptance Criteria:**
- [ ] Missing `partner_token` logged and rejected
- [ ] Sentry alert with `security: true` tag
- [ ] Returns 200 OK (prevent retry flooding) but doesn't process

---

## Implementation Order

1. **Task 1.1: HMAC Verification** (most critical - prevents forgery)
2. **Task 1.2: Input Sanitization** (prevents XSS)
3. **Task 1.3: Database Rollback** (prevents data leaks)
4. **Task 2.1: QR Retry Logic** (improves reliability)
5. **Task 2.2: Webhook Enforcement** (completes security)

---

## Testing Plan

### Manual Testing with Salon 997441

1. **HMAC Verification Test:**
   - Ask YClients moderator to click "Connect" again
   - Verify logs show signature validation
   - Confirm registration proceeds after valid signature

2. **Input Sanitization Test:**
   - Check DB record for salon 997441
   - Verify `marketplace_user_name` is sanitized
   - Verify no HTML/script tags stored

3. **Rollback Test:**
   - Temporarily block YClients API
   - Attempt activation
   - Verify API key NOT stored in DB
   - Verify status is `activation_failed`

4. **QR Generation Test:**
   - Monitor logs for exponential backoff delays
   - Verify timeout logged to Sentry

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| HMAC algorithm mismatch | Registration fails | Test with real YClients signature first |
| Sanitization breaks valid data | User experience | Test with edge cases (unicode, emojis) |
| Rollback fails silently | API key leak | Double-check with Sentry fatal alert |
| QR timeout increases | Slower onboarding | 10 attempts x 5s max = 50s worst case |

---

## Success Metrics

- [ ] YClients moderation test passes
- [ ] No security warnings in code review
- [ ] Sentry shows no critical errors
- [ ] Salon 997441 successfully connects WhatsApp

---

## Dependencies

- `YCLIENTS_PARTNER_TOKEN` must be correct for HMAC
- `BASE_URL` must be `https://adminai.tech` (already fixed)
- YClients moderator available for testing

---

## Deployment Checklist

- [ ] All fixes committed with descriptive messages
- [ ] Push to `main` branch
- [ ] Deploy to production: `ssh ... && git pull && pm2 restart`
- [ ] Verify health check: `curl https://adminai.tech/marketplace/health`
- [ ] Notify YClients moderator to retry connection
