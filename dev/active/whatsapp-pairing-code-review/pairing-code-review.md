# WhatsApp Pairing Code Connection Flow - Code Review

**Last Updated:** 2025-12-04
**Reviewer:** Claude (Code Architecture Reviewer)
**Context:** Marketplace onboarding for salon 997441 with phone 79006464263
**Issue:** "Timeout подключения WhatsApp" error, old credentials from 79936363848 found in database

---

## Executive Summary

The WhatsApp pairing code connection flow has **5 critical issues** that cause the "Timeout подключения WhatsApp" error reported by moderator Филипп. The main problems are:

1. **No credential cleanup before new connection attempt** - Old phone credentials persist and conflict
2. **Missing phone number mismatch detection** - No validation that stored credentials match requested phone
3. **Race condition in pairing code requests** - Multiple concurrent requests can interfere
4. **Insufficient error propagation** - Baileys errors don't reach WebSocket client properly
5. **No explicit cleanup trigger** - Frontend has no way to force credential cleanup before retry

**Severity:** 🔴 **CRITICAL** - Blocks all marketplace onboarding when old credentials exist

---

## Critical Issues (Must Fix)

### Issue #1: No Credential Cleanup Before Connection ⚠️ CRITICAL

**Location:** `src/integrations/whatsapp/session-pool.js:267-284`

**Problem:**
```javascript
// _createSessionWithMutex (line 267)
const existingSession = this.sessions.get(validatedId);
if (existingSession) {
    logger.info(`🔄 Closing existing session for company ${validatedId} before creating new one`);
    try {
        if (existingSession.end) {
            existingSession.end();
        }
    } catch (err) {
        logger.debug(`Close error for ${validatedId}: ${err.message}`);
    }
    this.sessions.delete(validatedId);
}
```

**What's Wrong:**
- Only closes in-memory session (`this.sessions.get()`)
- Does **NOT** clean up PostgreSQL credentials (`whatsapp_auth` and `whatsapp_keys` tables)
- Old phone credentials (79936363848) remain in database
- When Baileys loads auth state, it gets credentials for **wrong phone number**
- Pairing code request fails because credentials don't match the new phone (79006464263)

**Impact:**
- User enters new phone 79006464263
- System loads credentials for old phone 79936363848 from PostgreSQL
- WhatsApp rejects pairing code because phone mismatch
- Error: "Timeout подключения WhatsApp"

**Solution:**
Must call `removeTimewebAuthState(companyId)` to delete PostgreSQL credentials before creating session with new phone.

**Code Fix Needed:**
```javascript
// Before line 286 in session-pool.js
const existingSession = this.sessions.get(validatedId);
if (existingSession) {
    logger.info(`🔄 Closing existing session and clearing credentials for ${validatedId}`);

    // Close in-memory session
    try {
        if (existingSession.end) {
            existingSession.end();
        }
    } catch (err) {
        logger.debug(`Close error for ${validatedId}: ${err.message}`);
    }
    this.sessions.delete(validatedId);

    // CRITICAL: Clear PostgreSQL credentials to prevent phone mismatch
    try {
        const { removeTimewebAuthState } = require('./auth-state-timeweb');
        await removeTimewebAuthState(validatedId);
        logger.info(`✅ Credentials cleared from PostgreSQL for ${validatedId}`);
    } catch (err) {
        logger.error(`Failed to clear credentials for ${validatedId}:`, err);
        // Don't throw - allow new session creation to proceed
    }
}
```

---

### Issue #2: No Phone Number Mismatch Detection ⚠️ CRITICAL

**Location:** `src/integrations/whatsapp/auth-state-timeweb.js:376-404`

**Problem:**
```javascript
// useTimewebAuthState (line 376)
if (!authData || !authData.creds) {
    // Create new credentials
    creds = initAuthCreds();
} else {
    // Load existing credentials WITHOUT checking phone number
    creds = reviveBuffers(authData.creds);
    logger.info(`✅ Loaded existing credentials for ${companyId}`);
}
```

**What's Wrong:**
- Loads credentials without validating they match the requested phone number
- No check: `if (creds.me?.id !== expectedPhoneNumber)`
- User requests pairing code for 79006464263
- System loads credentials for 79936363848 (stored in DB)
- Baileys tries to pair with wrong phone - fails silently

**Impact:**
- Pairing code request to WhatsApp fails
- User waits for code that never arrives
- Error bubbles up as generic "Timeout"
- No clear indication that phone number mismatch is the root cause

**Solution:**
Add phone number validation when loading credentials. If mismatch detected, delete old credentials and create new ones.

**Code Fix Needed:**
```javascript
// In useTimewebAuthState after line 396
if (!authData || !authData.creds) {
    creds = initAuthCreds();
    await saveCreds();
} else {
    // Load existing credentials
    creds = reviveBuffers(authData.creds);

    // CRITICAL: Validate phone number match (if phone number provided)
    const storedPhone = creds.me?.id?.split('@')[0]; // e.g., "79936363848"

    if (options.phoneNumber && storedPhone && storedPhone !== options.phoneNumber) {
        logger.warn(`❌ Phone number mismatch detected for ${companyId}:`, {
            stored: storedPhone,
            requested: options.phoneNumber
        });

        // Delete old credentials and create new
        logger.info(`🗑️ Deleting old credentials for ${companyId}`);
        await removeTimewebAuthState(companyId);

        // Create fresh credentials
        creds = initAuthCreds();
        await saveCreds();

        logger.info(`✅ New credentials created for phone ${options.phoneNumber}`);
    } else {
        logger.info(`✅ Loaded existing credentials for ${companyId} (phone: ${storedPhone})`);
    }
}
```

---

### Issue #3: Race Condition in Pairing Code Requests ⚠️ HIGH

**Location:** `src/api/websocket/marketplace-socket.js:280-337`

**Problem:**
```javascript
// request-pairing-code handler (line 280)
if (this.pairingCodeRequests.has(sessionId)) {
    socket.emit('pairing-code-error', {
        message: 'Запрос уже в обработке. Подождите...',
        code: 'REQUEST_IN_PROGRESS'
    });
    return;
}

// ... request executes ...

// Finally block (line 329)
finally {
    this.pairingCodeRequests.delete(sessionId);
}
```

**What's Wrong:**
- Mutex prevents concurrent requests (good!)
- But doesn't handle case where:
  1. User clicks "Get Pairing Code" for phone A (79006464263)
  2. Request hangs (old credentials for phone B in database)
  3. User refreshes page / reconnects WebSocket
  4. Mutex is still held - new request blocked
  5. User sees "Запрос уже в обработке" forever
- No timeout for mutex cleanup
- No way to cancel stuck request

**Impact:**
- First failed request blocks all subsequent attempts
- User must wait for full timeout (60 seconds)
- During debugging, multiple retries amplify the problem
- Mutex never releases if promise never resolves

**Solution:**
Add timeout for pairing code request and cleanup mutex on WebSocket disconnect.

**Code Fix Needed:**
```javascript
// In marketplace-socket.js request-pairing-code handler
const requestPromise = (async () => {
    // Wrap request in timeout
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Pairing code request timeout')), 60000);
    });

    try {
        await Promise.race([
            sessionPool.createSession(sessionId, {
                usePairingCode: true,
                phoneNumber: cleanedPhone
            }),
            timeoutPromise
        ]);
    } catch (error) {
        logger.error('Ошибка запроса pairing code:', error);

        // Provide specific error for phone mismatch
        if (error.message.includes('mismatch') || error.message.includes('Wrong phone')) {
            socket.emit('pairing-code-error', {
                message: 'Найдены учетные данные от другого номера. Пожалуйста, переподключите WhatsApp.',
                code: 'PHONE_MISMATCH'
            });
        } else {
            socket.emit('pairing-code-error', {
                message: 'Не удалось получить код. Попробуйте QR-код.',
                code: 'PAIRING_CODE_FAILED'
            });
        }
    } finally {
        this.pairingCodeRequests.delete(sessionId);
    }
})();
```

---

### Issue #4: Insufficient Error Propagation from Baileys ⚠️ HIGH

**Location:** `src/integrations/whatsapp/session-pool.js:373-428`

**Problem:**
```javascript
// Pairing code error handler (line 244)
const handlePairingCodeError = (data) => {
    if (data.companyId === sessionId) {
        logger.warn('❌ Pairing code error from Baileys', { sessionId, error: data.error });
        socket.emit('pairing-code-error', {
            message: data.error || 'Не удалось получить код. Попробуйте QR-код.',
            code: 'BAILEYS_ERROR'
        });
    }
};

// Inside try-catch (line 399)
} catch (error) {
    logger.error(`Failed to request pairing code: ${error.message}`);
    Sentry.captureException(error, { /* ... */ });
    logger.info(`Will fallback to QR code method`);
    sock.usePairingCode = false;

    // Emit error event
    this.emit('pairing-code-error', { companyId, error: error.message });
}
```

**What's Wrong:**
- Generic error messages don't help user understand the problem
- Phone mismatch errors from Baileys are swallowed
- Error becomes: "Не удалось получить код" (not helpful!)
- No distinction between:
  - Network failure
  - Phone number invalid/unregistered
  - Credentials conflict (phone mismatch)
  - WhatsApp rate limiting
- User can't take corrective action

**Impact:**
- All errors look the same to user
- No guidance on what to do next
- Support team can't diagnose issues from user reports
- Sentry gets exception but user sees generic message

**Solution:**
Parse Baileys error types and provide actionable messages.

**Code Fix Needed:**
```javascript
// In session-pool.js pairing code request catch block
} catch (error) {
    logger.error(`Failed to request pairing code: ${error.message}`);

    // Parse error type for better UX
    let errorMessage = 'Не удалось получить код. Попробуйте QR-код.';
    let errorCode = 'BAILEYS_ERROR';

    if (error.message.includes('conflict') || error.message.includes('mismatch')) {
        errorMessage = 'Обнаружен конфликт учетных данных. Пожалуйста, начните подключение заново.';
        errorCode = 'CREDENTIALS_CONFLICT';
    } else if (error.message.includes('not registered') || error.message.includes('invalid number')) {
        errorMessage = 'Номер не зарегистрирован в WhatsApp или недействителен.';
        errorCode = 'INVALID_PHONE';
    } else if (error.message.includes('rate limit') || error.message.includes('too many')) {
        errorMessage = 'Слишком много попыток. Подождите 10 минут и попробуйте снова.';
        errorCode = 'RATE_LIMITED';
    }

    Sentry.captureException(error, {
        tags: {
            component: 'baileys-session',
            operation: 'pairingCode',
            errorCode
        },
        extra: {
            companyId,
            phoneNumber: sock.pairingPhoneNumber,
            errorType: error.name || 'Unknown',
            parsedMessage: errorMessage
        }
    });

    logger.info(`Will fallback to QR code method`);
    sock.usePairingCode = false;

    // Emit detailed error
    this.emit('pairing-code-error', {
        companyId,
        error: errorMessage,
        code: errorCode,
        originalError: error.message
    });
}
```

---

### Issue #5: No Frontend Cleanup Trigger ⚠️ MEDIUM

**Location:** `src/api/websocket/marketplace-socket.js` (missing feature)

**Problem:**
- Frontend has no way to explicitly clear credentials before starting new connection
- When debugging, we manually ran SQL queries to delete credentials
- User can't recover from stuck state without developer intervention
- No "Reset WhatsApp Connection" button in UI

**What's Missing:**
```javascript
// No handler for this event!
socket.on('reset-whatsapp-credentials', async () => {
    // Should delete PostgreSQL credentials and restart session
});
```

**Impact:**
- Users stuck in error state need support intervention
- Can't self-service credential cleanup
- Increases support burden
- Poor UX for marketplace onboarding

**Solution:**
Add explicit reset event handler in WebSocket and corresponding button in frontend.

**Code Fix Needed:**
```javascript
// In marketplace-socket.js after line 337 (end of request-pairing-code)

// Handler for explicit credential reset
socket.on('reset-whatsapp-credentials', async () => {
    logger.info(`🗑️ Credential reset requested for ${sessionId}`);

    try {
        // 1. Close existing session
        const existingSession = this.sessionPool.getSession(sessionId);
        if (existingSession) {
            await this.sessionPool.disconnectSession(sessionId);
            logger.info(`✅ Session disconnected for ${sessionId}`);
        }

        // 2. Delete PostgreSQL credentials
        const { removeTimewebAuthState } = require('../../integrations/whatsapp/auth-state-timeweb');
        await removeTimewebAuthState(sessionId);
        logger.info(`✅ Credentials deleted from PostgreSQL for ${sessionId}`);

        // 3. Clear cached credentials
        this.sessionPool.clearCachedCredentials(sessionId);
        logger.info(`✅ Cache cleared for ${sessionId}`);

        // 4. Notify client
        socket.emit('credentials-reset', {
            success: true,
            message: 'Учетные данные WhatsApp сброшены. Теперь можно начать подключение заново.',
            sessionId
        });

    } catch (error) {
        logger.error(`Failed to reset credentials for ${sessionId}:`, error);
        Sentry.captureException(error, {
            tags: { component: 'marketplace-websocket', operation: 'resetCredentials' },
            extra: { sessionId }
        });

        socket.emit('reset-error', {
            message: 'Не удалось сбросить учетные данные. Обратитесь в поддержку.',
            error: error.message
        });
    }
});
```

---

## Important Improvements (Should Fix)

### Improvement #1: Better Timeout Configuration

**Location:** `src/api/websocket/marketplace-socket.js:311-336`

**Issue:**
- 60-second timeout is too long for pairing code requests
- User waits full minute before seeing error
- Should be 15-20 seconds max (WhatsApp responds in <10s typically)

**Recommendation:**
```javascript
const PAIRING_CODE_TIMEOUT_MS = 20000; // 20 seconds instead of 60
```

---

### Improvement #2: Add Health Check for Credentials

**Location:** New endpoint needed in `src/api/routes/whatsapp-sessions.js`

**Issue:**
- No way to check if credentials exist for a session
- No way to check if credentials match expected phone

**Recommendation:**
```javascript
// GET /api/whatsapp/sessions/:companyId/credentials/status
router.get('/sessions/:companyId/credentials/status', async (req, res) => {
    try {
        const { companyId } = req.params;

        const result = await postgres.query(
            'SELECT company_id, (creds->>\'me\') as phone FROM whatsapp_auth WHERE company_id = $1',
            [companyId]
        );

        const hasCredentials = result.rows.length > 0;
        const storedPhone = hasCredentials
            ? JSON.parse(result.rows[0].phone || '{}').id?.split('@')[0]
            : null;

        res.json({
            success: true,
            companyId,
            hasCredentials,
            storedPhone,
            canReset: hasCredentials
        });
    } catch (error) {
        logger.error('Failed to check credentials status:', error);
        res.status(500).json({ error: error.message });
    }
});
```

---

### Improvement #3: Structured Logging for Debugging

**Location:** Throughout pairing code flow

**Issue:**
- Logs don't clearly show decision points
- Hard to trace issue from logs alone
- No correlation ID for end-to-end tracking

**Recommendation:**
Add correlation ID to all logs:
```javascript
const correlationId = `pairing-${sessionId}-${Date.now()}`;
logger.info(`[${correlationId}] Starting pairing code request`, {
    sessionId,
    phoneNumber: cleanedPhone
});
```

---

## Minor Suggestions (Nice to Have)

### Suggestion #1: Add Metrics for Pairing Code Success Rate

Track success/failure rate for pairing code vs QR code methods:
```javascript
const pairingMetrics = {
    pairingCodeAttempts: 0,
    pairingCodeSuccess: 0,
    pairingCodeFailures: 0,
    qrCodeAttempts: 0,
    qrCodeSuccess: 0
};
```

---

### Suggestion #2: Implement Retry with Exponential Backoff

Instead of immediate failure, retry pairing code request 2-3 times with backoff:
```javascript
async function requestPairingCodeWithRetry(sock, phoneNumber, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const code = await sock.requestPairingCode(phoneNumber);
            return code;
        } catch (error) {
            if (attempt === maxRetries) throw error;

            const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
            logger.info(`Pairing code attempt ${attempt} failed, retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
```

---

## Architecture Considerations

### 1. Credential Lifecycle Management

**Current State:**
- Credentials created on first connection
- Never explicitly deleted (except manual intervention)
- Can accumulate stale credentials from old phones

**Recommendation:**
Implement proper lifecycle:
1. **Creation:** When user starts onboarding with phone number
2. **Validation:** Check phone match before connection
3. **Cleanup:** Explicitly delete when user changes phone
4. **Expiration:** Auto-delete credentials older than 90 days if inactive

---

### 2. Session State Machine

**Current State:**
- Implicit states: not_initialized, connecting, connected, disconnected
- No clear state transitions
- Race conditions possible

**Recommendation:**
Implement explicit state machine:
```javascript
const SessionStates = {
    IDLE: 'idle',
    CREATING: 'creating',
    WAITING_FOR_PAIRING_CODE: 'waiting_for_pairing_code',
    PAIRING_CODE_SENT: 'pairing_code_sent',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    ERROR: 'error'
};
```

---

### 3. Error Recovery Strategy

**Current State:**
- Most errors require manual intervention
- No automatic recovery
- User stuck in error state

**Recommendation:**
Implement tiered recovery:
1. **Automatic:** Retry with exponential backoff (2-3 attempts)
2. **Semi-Automatic:** Suggest credential reset (button in UI)
3. **Manual:** Contact support (provide correlation ID for debugging)

---

## Next Steps

### Immediate Actions (Before Approval)

1. ✅ Code review complete - saved to `dev/active/whatsapp-pairing-code-review/`
2. ⏸️ **Wait for approval** - Don't implement fixes yet
3. ⏸️ Discuss with team which issues to prioritize

### After Approval

**Critical Fixes (Must Do):**
1. Add credential cleanup in `session-pool.js` before new session creation
2. Add phone number mismatch detection in `auth-state-timeweb.js`
3. Add timeout for pairing code requests in WebSocket handler
4. Improve error messages from Baileys to be user-actionable
5. Add `reset-whatsapp-credentials` event handler

**Important Improvements (Should Do):**
6. Reduce pairing code timeout from 60s to 20s
7. Add credentials status endpoint for debugging
8. Add correlation IDs to all logs

**Testing Plan:**
1. Test with fresh salon (no existing credentials) ✅ Expected: works
2. Test with existing credentials for different phone ⚠️ Expected: currently fails, should work after fix
3. Test rapid retries (stress test mutex) 🔄
4. Test WebSocket disconnect during pairing ⚠️
5. Test credential reset flow (new feature) 🆕

---

## Summary

**Grade:** 🔴 **D (40/100)** - Multiple critical bugs prevent marketplace onboarding

**Critical Issues:** 5 must-fix bugs
**Important Improvements:** 3 should-fix enhancements
**Minor Suggestions:** 2 nice-to-have optimizations

**Root Cause:** Lack of credential lifecycle management. The code assumes credentials are always valid for the current phone number, but doesn't handle the case where old credentials from a different phone persist in the database.

**Estimated Fix Time:** 4-6 hours
- Critical fixes: 3-4 hours
- Important improvements: 1-2 hours
- Testing: 1 hour

**Risk Level:** 🟡 **MEDIUM** - Fixes are localized, low risk of breaking existing QR code flow

---

**Reviewer:** Claude (Code Architecture Reviewer)
**Date:** 2025-12-04
**Status:** ⏸️ **Awaiting Approval**

**Next Step:** Please review the findings and approve which changes to implement before I proceed with any fixes.
