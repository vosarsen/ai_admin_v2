# YClients Marketplace Salon Registration - Comprehensive Code Review

**Last Updated:** 2025-12-04
**Reviewer:** Claude Code
**Context:** Модерация приложения YClients, тестирование подключения салона 997441

---

## Executive Summary

**Status:** 🟡 **Critical Issues Found - Immediate Action Required**

Обнаружено **7 критических проблем** и **4 важных несоответствия**, которые могут блокировать успешное подключение салона через маркетплейс. Основные риски:

1. **Конфликт двух систем роутинга** - старый `marketplace.js` и новый `yclients-marketplace.js`
2. **Несоответствие session ID форматов** между REST API и WebSocket
3. **Отсутствующие WebSocket origin** в проверке безопасности
4. **Потенциальные race conditions** при генерации QR кода

**Grade:** C (60/100)
- Security: 7/10 (HMAC fixed, but origin validation incomplete)
- Architecture: 5/10 (route conflicts, inconsistent sessionId formats)
- Error Handling: 6/10 (good logging, but missing error cases)
- Integration: 6/10 (WebSocket disconnects from REST API flow)

---

## 🔴 Critical Issues (Must Fix Before Production)

### 1. Route Conflict - Two Marketplace Routers Active

**File:** `src/api/index.js:136` + `src/api/routes/marketplace.js` + `src/api/routes/yclients-marketplace.js`

**Problem:**
```javascript
// Line 136: yclientsMarketplaceRoutes is mounted
app.use('', yclientsMarketplaceRoutes);

// BUT: marketplace.js still exists with DIFFERENT implementations!
// marketplace.js has: GET /marketplace/qr/:token (uses token-based auth)
// yclients-marketplace.js has: POST /marketplace/api/qr (uses JWT bearer)
```

**Impact:**
- Express will use **первый совпадающий роут**
- Неопределенное поведение при конфликте
- Тестирующий модератор может получить неожиданные ошибки

**Evidence:**
```
marketplace.js:
- GET /marketplace → index.html (старый)
- GET /marketplace/connect → connect.html (старый)
- POST /marketplace/register → старая логика
- GET /marketplace/qr/:token → GET endpoint с token в URL

yclients-marketplace.js:
- GET /auth/yclients/redirect → точка входа из маркетплейса (NEW)
- GET /marketplace/onboarding → onboarding.html (NEW)
- POST /marketplace/api/qr → POST endpoint с JWT bearer (NEW)
- POST /marketplace/activate → активация интеграции (NEW)
```

**Рекомендация:**
```bash
# CRITICAL: Remove old marketplace.js or rename to marketplace.legacy.js
mv src/api/routes/marketplace.js src/api/routes/marketplace.legacy.js
# OR: Delete completely if no longer used
rm src/api/routes/marketplace.js

# Verify no other files import marketplace.js
grep -r "require.*marketplace\.js" src/
```

---

### 2. Session ID Format Mismatch - REST vs WebSocket

**Files:**
- `src/api/routes/yclients-marketplace.js:558`
- `src/api/websocket/marketplace-socket.js:104, 228`

**Problem:**
```javascript
// REST API (line 558):
const sessionId = `company_${salon_id}`;  // ✅ Format: "company_123"

// WebSocket (line 104):
socket.companyId = companyId;  // ❌ Format: just "123" (from JWT)

// Session pool expects (line 228):
await this.sessionPool.createSession(companyId);  // ❌ Receiving "123"
```

**Impact:**
- QR код генерируется для `company_123` через REST API
- WebSocket слушает события для `123` (без префикса)
- **События никогда не доставятся клиенту** → белый экран, timeout

**Root Cause:**
```javascript
// JWT payload (line 549):
const decoded = jwt.verify(token, JWT_SECRET);
const { company_id, salon_id } = decoded;  // company_id = internal DB ID (integer)

// But session pool uses:
await this.sessionPool.createSession(companyId);  // Expects string "company_123"
```

**Рекомендация:**
```javascript
// Option 1: FIX WebSocket to use consistent format
// marketplace-socket.js line 104:
const sessionId = `company_${companyId}`;
socket.sessionId = sessionId;  // Store formatted version

// marketplace-socket.js line 228:
await this.sessionPool.createSession(sessionId);  // Use formatted ID

// Option 2: FIX REST API to NOT use prefix
// yclients-marketplace.js line 558:
const sessionId = salon_id.toString();  // Just use salon_id
```

**My Recommendation:** Use Option 1 (fix WebSocket) because:
- Session pool already uses `company_` prefix throughout codebase
- Less changes required (only WebSocket file)
- Maintains consistency with existing sessions

---

### 3. Missing Origin Validation for Marketplace Moderator

**File:** `src/api/websocket/marketplace-socket.js:41-57`

**Problem:**
```javascript
// Line 42-48: Only checks these origins
const allowedOrigins = [
  'https://adminai.tech',
  'https://ai-admin.app',
  'https://yclients.com',
  'https://n962302.yclients.com'  // Only YOUR salon!
];

// ❌ MISSING: Moderator's salon (997441) origin
// When moderator opens onboarding page:
// Origin: https://n997441.yclients.com  → REJECTED!
```

**Impact:**
- Модератор получит `Недопустимый источник запроса`
- WebSocket disconnect сразу после подключения
- QR код не отобразится

**Evidence from Recent Fix:**
```javascript
// commit 5868744: "Fix WebSocket origin validation"
// You added adminai.tech, but forgot about dynamic salon IDs!
```

**Рекомендация:**
```javascript
// marketplace-socket.js line 42-57:
const allowedOrigins = [
  'https://adminai.tech',
  'https://ai-admin.app'
];

// Dynamic origin validation for YClients subdomains
const origin = socket.handshake.headers.origin;
const isYclientsOrigin = origin && origin.match(/^https:\/\/n\d+\.yclients\.com$/);

if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed)) && !isYclientsOrigin) {
  logger.warn('Недопустимый origin:', origin);
  socket.emit('error', { message: 'Недопустимый источник запроса' });
  socket.disconnect();
  return;
}
```

---

### 4. QR Generation Race Condition - Circuit Breaker Timeout Risk

**File:** `src/api/routes/yclients-marketplace.js:539-655`

**Problem:**
```javascript
// Line 574: Circuit breaker execute
const result = await qrCircuitBreaker.execute(async () => {
  // Line 578: Create session (async, may take 5-15s)
  await sessionPool.createSession(sessionId, { company_id, salon_id });

  // Line 585: Wait for QR with max 5 attempts * 5s delay = ~25s
  while (attempts < maxAttempts) {
    const delay = Math.min(1000 * Math.pow(1.5, attempts), 5000);
    await new Promise(resolve => setTimeout(resolve, delay));
    qr = await sessionPool.getQR(sessionId);
    // ...
  }
});

// Line 143: Circuit breaker timeout = 40s
// ⚠️ BUT: Total execution time can be ~25-30s
// ⚠️ Risk: If PostgreSQL is slow, timeout may trigger prematurely
```

**Impact:**
- Circuit breaker может открыться после 5 неудачных попыток
- Последующие запросы QR получат 503 Service Unavailable
- Модератору придется ждать 60 секунд (line 142: resetTimeout)

**Evidence:**
```javascript
// session-pool.js line 286-288:
const { state, saveCreds } = await useTimewebAuthState(validatedId, { sessionPool: this });
// ☝️ This can take 5-15 seconds if database is slow!

// + QR generation loop: 5 attempts * exponential backoff
// = Total 25-35 seconds BEST case
```

**Рекомендация:**
```javascript
// Option 1: Increase circuit breaker timeout
const qrCircuitBreaker = getCircuitBreaker('qr-generation', {
  timeout: 50000,  // 50s instead of 40s (buffer for slow DB)
});

// Option 2: Reduce max attempts in QR loop
const maxAttempts = 3;  // Down from 5

// Option 3: Add caching check BEFORE circuit breaker
let qr = await sessionPool.getQR(sessionId);
if (qr) {
  return res.json({ success: true, qr, session_id: sessionId });
}
// Then proceed to circuit breaker only if no cached QR
```

**My Recommendation:** Use Option 1 + Option 3 combined:
- Check cache first (fast path, 99% of retries)
- Increase timeout to 50s (safety margin)
- Keep 5 attempts (more chances for success)

---

### 5. No Error Recovery for Failed QR Generation

**File:** `src/api/routes/yclients-marketplace.js:615-654`

**Problem:**
```javascript
// Line 624: Circuit breaker OPEN state
if (error.code === 'CIRCUIT_OPEN') {
  return res.status(503).json({
    error: 'Service temporarily unavailable',
    code: 'SERVICE_UNAVAILABLE',
    retry_after: 60  // ❌ Client gets 503, но frontend НЕ знает что делать!
  });
}
```

**Frontend Impact:**
```javascript
// onboarding.html line 629-632:
if (!response.ok) {
  throw new Error('Failed to get QR');
}
// ☝️ Generic error, user sees "Не удалось получить QR-код. Обновите страницу."
// NO automatic retry, NO countdown timer, NO user guidance
```

**Рекомендация:**
```javascript
// Backend: Add recovery instructions
if (error.code === 'CIRCUIT_OPEN') {
  return res.status(503).json({
    error: 'QR service temporarily overloaded',
    code: 'CIRCUIT_OPEN',
    retry_after: 60,
    recovery: {
      message_ru: 'Слишком много запросов. Попробуйте снова через минуту.',
      message_en: 'Too many requests. Please try again in 1 minute.',
      auto_retry: true,
      retry_in_seconds: 60
    }
  });
}

// Frontend: Handle circuit breaker gracefully
// onboarding.html:
if (data.code === 'CIRCUIT_OPEN' && data.recovery?.auto_retry) {
  const retryIn = data.recovery.retry_in_seconds;
  showError(`${data.recovery.message_ru} Автоматическая попытка через ${retryIn}с...`);
  setTimeout(() => requestNewQR(), retryIn * 1000);
}
```

---

### 6. WebSocket Authentication Token Exposure in Query Params

**File:** `src/api/websocket/marketplace-socket.js:69-73`

**Problem:**
```javascript
// Line 69-73: FALLBACK to query params (INSECURE!)
} else if (socket.handshake.query.token) {
  token = socket.handshake.query.token;
  logger.warn('Токен передан через query параметры - небезопасно!');
}

// Frontend line 499-503:
socket = io('/marketplace', {
  auth: { token: token }  // ✅ GOOD: Uses auth object
});
```

**Why This Matters:**
- Query params are logged in server access logs
- JWT tokens в логах = security risk
- Лучше удалить fallback полностью

**Рекомендация:**
```javascript
// REMOVE query param fallback completely
// marketplace-socket.js line 69-73: DELETE these lines

// If token missing after checking headers/auth:
if (!token) {
  logger.error('WebSocket: отсутствует токен авторизации');
  socket.emit('error', { message: 'Требуется авторизация (токен должен быть в заголовке Authorization или auth)' });
  socket.disconnect();
  return;
}
```

---

### 7. Session Pool Event Listeners Memory Leak Risk

**File:** `src/api/websocket/marketplace-socket.js:222-225`

**Problem:**
```javascript
// Line 222-225: Global event listeners registered
this.sessionPool.on('qr', handleQR);
this.sessionPool.on('connected', handleConnected);
this.sessionPool.on('logout', handleLogout);
this.sessionPool.on('pairing-code', handlePairingCode);

// Line 265-269: Cleanup on disconnect
socket.on('disconnect', () => {
  this.sessionPool.off('qr', handleQR);
  // ...
});
```

**Problem:**
- Session pool - это **singleton** (line 987: `let sessionPoolInstance = null`)
- EventEmitter has default limit of 10 listeners per event
- **Каждый WebSocket добавляет 4 listener'а**
- After 3-4 concurrent connections: `MaxListenersExceededWarning`

**Evidence:**
```javascript
// session-pool.js line 45:
class WhatsAppSessionPool extends EventEmitter {
  // No setMaxListeners() call!
}
```

**Impact:**
- Warning при 3+ одновременных подключениях
- Потенциальная утечка памяти если disconnect не срабатывает
- Degraded performance при большом количестве listeners

**Рекомендация:**
```javascript
// session-pool.js line 96 (в конструкторе):
constructor() {
  super();
  this.setMaxListeners(100);  // Allow up to 100 concurrent WebSocket connections
  // ...
}

// marketplace-socket.js: Add safety check
socket.on('disconnect', () => {
  // Ensure cleanup even if errors occur
  try {
    this.sessionPool.off('qr', handleQR);
    this.sessionPool.off('connected', handleConnected);
    this.sessionPool.off('logout', handleLogout);
    this.sessionPool.off('pairing-code', handlePairingCode);
  } catch (error) {
    logger.error('Error cleaning up event listeners:', error);
  }
  // ...
});
```

---

## 🟡 Important Improvements (Should Fix)

### 8. Inconsistent Session Status Check Flow

**File:** `src/api/routes/yclients-marketplace.js:662-696`

**Problem:**
```javascript
// Line 675: Get session status
const status = await sessionPool.getSessionStatus(sessionId);
const connected = status === 'connected' || status === 'open';

// ❌ BUT: session-pool.js returns OBJECT, not string!
// session-pool.js line 872-887:
getSessionStatus(companyId) {
  return {
    status: session.user ? 'connected' : 'disconnected',
    connected: !!session.user,
    // ...
  };
}
```

**Impact:**
- Type mismatch: expecting string, receiving object
- `status === 'connected'` will ALWAYS be false
- Frontend polling will never detect connection

**Рекомендация:**
```javascript
// yclients-marketplace.js line 675:
const statusObj = await sessionPool.getSessionStatus(sessionId);
const connected = statusObj.connected;  // Use boolean property
const status = statusObj.status;  // Use status string

res.json({
  success: true,
  status,
  connected,
  session_id: sessionId,
  user: statusObj.user,
  phoneNumber: statusObj.phoneNumber
});
```

---

### 9. Missing Transaction Rollback for QR Generation Failures

**File:** `src/api/routes/yclients-marketplace.js:706-1039`

**Problem:**
```javascript
// Line 753: Transaction-based activation starts
if (USE_TRANSACTION_ACTIVATION) {
  await companyRepository.withTransaction(async (txClient) => {
    // 1. Save API key (line 783-786)
    // 2. Call YClients API (line 805-816)
    // 3. Update status to 'active' (line 832-836)
  });
}

// ❌ BUT: QR generation happens OUTSIDE transaction (line 539-655)
// If QR fails AFTER registration_started event, no cleanup!
```

**Impact:**
- Database shows `registration_started` but no WhatsApp connection
- Company stuck in `pending_whatsapp` status
- Admin must manually fix database

**Рекомендация:**
```javascript
// Add cleanup endpoint
router.post('/marketplace/cleanup/:companyId', adminAuth, async (req, res) => {
  const { companyId } = req.params;

  // Check if stuck in pending_whatsapp > 1 hour
  const company = await companyRepository.findOne('companies', { id: companyId });
  const timeSince = Date.now() - new Date(company.connected_at).getTime();

  if (company.integration_status === 'pending_whatsapp' && timeSince > 3600000) {
    // Reset to allow retry
    await companyRepository.update(companyId, {
      integration_status: 'registration_failed',
      whatsapp_connected: false
    });

    res.json({ success: true, message: 'Company reset for retry' });
  } else {
    res.status(400).json({ error: 'Company not in stuck state' });
  }
});
```

---

### 10. Frontend Activation Polling Creates N+1 Queries

**File:** `public/marketplace/onboarding.html:532-559`

**Problem:**
```javascript
// Line 532-559: Polling every 1 second for 30 seconds
const checkConnectionStatus = setInterval(async () => {
  const response = await fetch(`/marketplace/api/status/${sessionId}`);
  // ...
}, 1000);

// ❌ 30 requests per user
// ❌ Each request queries database (session-pool.js line 873-887)
// ❌ No exponential backoff
```

**Impact:**
- Database load при большом количестве одновременных регистраций
- Wasted bandwidth (most responses will be "not connected yet")

**Рекомендация:**
```javascript
// Use exponential backoff polling
let pollInterval = 1000;  // Start at 1s
let pollAttempts = 0;
const maxPolls = 20;

const checkConnectionStatus = async () => {
  if (pollAttempts >= maxPolls) {
    clearTimeout(pollTimer);
    showError('Timeout...');
    return;
  }

  const response = await fetch(`/marketplace/api/status/${sessionId}`);
  const data = await response.json();

  if (data.connected) {
    await activateIntegration();
    handleWhatsAppConnected();
  } else {
    pollAttempts++;
    pollInterval = Math.min(pollInterval * 1.3, 5000);  // Max 5s
    pollTimer = setTimeout(checkConnectionStatus, pollInterval);
  }
};

let pollTimer = setTimeout(checkConnectionStatus, 1000);
```

---

### 11. Missing Idempotency for Activation Endpoint

**File:** `src/api/routes/yclients-marketplace.js:706-1039`

**Problem:**
```javascript
// Line 706: POST /marketplace/activate
// ❌ No idempotency check!
// If frontend retries, creates duplicate activation requests

// Line 793: YClients API call
const yclientsResponse = await fetch('https://api.yclients.com/marketplace/partner/callback/redirect');
// ☝️ YClients may receive duplicate activations!
```

**Impact:**
- Если пользователь нажмет "Активировать" дважды
- Или frontend retry logic сработает
- YClients может зарегистрировать duplicate activation

**Рекомендация:**
```javascript
// Add idempotency check at start of activation
router.post('/marketplace/activate', async (req, res) => {
  const { token } = req.body;
  const decoded = jwt.verify(token, JWT_SECRET);
  const { salon_id, company_id } = decoded;

  // Check if already activated
  const latestActivation = await marketplaceEventsRepository.findLatestByType(
    salon_id,
    'integration_activated'
  );

  if (latestActivation) {
    const timeSince = Date.now() - new Date(latestActivation.created_at).getTime();
    if (timeSince < 60000) {  // Within last 1 minute
      logger.info('Duplicate activation request detected, returning previous result');
      return res.json({
        success: true,
        message: 'Already activated',
        company_id,
        salon_id,
        yclients_response: latestActivation.event_data.yclients_response
      });
    }
  }

  // ... proceed with activation
});
```

---

## 🔵 Minor Suggestions (Nice to Have)

### 12. Add Structured Logging for Debugging

**Files:** Multiple

**Problem:**
- Current logging is good but missing correlation IDs
- Hard to trace a single user's journey through logs

**Рекомендация:**
```javascript
// Generate correlation ID at entry point
router.get('/auth/yclients/redirect', async (req, res) => {
  const correlationId = crypto.randomUUID();
  req.correlationId = correlationId;

  logger.info('📍 Registration redirect', {
    correlationId,
    salon_id,
    user_id
  });

  // Pass to all subsequent log calls
});

// WebSocket connection
const correlationId = socket.handshake.query.correlation_id || crypto.randomUUID();
socket.correlationId = correlationId;
logger.info('🔌 WebSocket connected', { correlationId, companyId });
```

---

### 13. Add Health Check for Session Pool

**File:** `src/api/routes/yclients-marketplace.js:1278-1408`

**Problem:**
```javascript
// Line 1304-1316: Health check doesn't verify session pool
services: {
  whatsapp_pool_ready: !!sessionPool  // Just checks if exists
}

// ❌ Doesn't verify if pool can actually create sessions
```

**Рекомендация:**
```javascript
// Test session pool functionality
try {
  const poolMetrics = sessionPool.getMetrics();
  healthStatus.services.whatsapp_pool = {
    status: 'healthy',
    total_sessions: poolMetrics.totalSessions,
    active_connections: poolMetrics.activeConnections,
    circuit_breaker: qrCircuitBreaker.getState().state
  };
} catch (poolError) {
  healthStatus.services.whatsapp_pool = {
    status: 'unhealthy',
    error: poolError.message
  };
}
```

---

## Architecture Considerations

### Session ID Standardization Strategy

**Current State:**
```
REST API:        `company_${salon_id}`
WebSocket:       just `companyId` (integer)
Session Pool:    expects `company_${companyId}` OR just integer
Database:        stores integer `id` and integer `yclients_id`
```

**Recommended Standard:**
```javascript
// EVERYWHERE in codebase, use this convention:
const sessionId = `company_${internalCompanyId}`;  // e.g., "company_42"

// Never use:
const sessionId = salonId;  // ❌ ambiguous (internal ID or external salon_id?)
const sessionId = `salon_${salonId}`;  // ❌ inconsistent naming

// Why this format:
// 1. Clear distinction: "company_" prefix = internal AI Admin ID
// 2. Consistent with existing session-pool.js usage
// 3. Easy to parse and validate
```

**Migration Plan:**
1. Update WebSocket to generate `company_${companyId}` (Critical Issue #2)
2. Verify all session pool calls use this format
3. Add validation helper:
```javascript
function parseSessionId(sessionId) {
  const match = sessionId.match(/^company_(\d+)$/);
  if (!match) {
    throw new Error(`Invalid session ID format: ${sessionId}`);
  }
  return parseInt(match[1], 10);
}
```

---

## Next Steps

### Immediate Actions (Today)

1. **Remove Route Conflict** (Issue #1)
   ```bash
   mv src/api/routes/marketplace.js src/api/routes/marketplace.legacy.js
   ```

2. **Fix Session ID Mismatch** (Issue #2)
   - Edit `src/api/websocket/marketplace-socket.js`
   - Change line 104: `const sessionId = \`company_${companyId}\``
   - Change line 228: `await this.sessionPool.createSession(sessionId)`

3. **Fix Origin Validation** (Issue #3)
   - Edit `src/api/websocket/marketplace-socket.js`
   - Add regex check for `https://n\d+\.yclients\.com`

### Before Moderator Testing (This Week)

4. **Fix QR Generation Timeout** (Issue #4)
   - Increase circuit breaker timeout to 50s
   - Add cache check before circuit breaker

5. **Fix Status Check** (Issue #8)
   - Update `getSessionStatus` return type handling

### Before Production Launch (Next Sprint)

6. **Add Idempotency** (Issue #11)
7. **Add Error Recovery UI** (Issue #5)
8. **Fix Memory Leak Risk** (Issue #7)
9. **Add Health Checks** (Issue #13)

---

## Testing Checklist

После исправления критических ошибок, протестируйте:

```bash
# 1. Clean slate test
curl -X POST http://localhost:3000/marketplace/cleanup/TEST_COMPANY_ID

# 2. Registration flow
# Open in browser:
https://adminai.tech/auth/yclients/redirect?salon_id=997441&user_data=...

# 3. Verify WebSocket connection
# Check browser console for:
# - WebSocket connected
# - QR received
# - No origin errors

# 4. Verify QR generation
curl -X POST http://localhost:3000/marketplace/api/qr \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# 5. Check session status
curl http://localhost:3000/marketplace/api/status/company_997441 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 6. Activate integration
curl -X POST http://localhost:3000/marketplace/activate \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_JWT_TOKEN"}'
```

---

## Summary of File Changes Required

| File | Lines | Changes | Priority |
|------|-------|---------|----------|
| `src/api/routes/marketplace.js` | ALL | **DELETE or RENAME** | 🔴 CRITICAL |
| `src/api/websocket/marketplace-socket.js` | 42-57 | Fix origin validation | 🔴 CRITICAL |
| `src/api/websocket/marketplace-socket.js` | 104, 228 | Fix sessionId format | 🔴 CRITICAL |
| `src/api/routes/yclients-marketplace.js` | 143, 585 | Adjust circuit breaker | 🔴 CRITICAL |
| `src/api/routes/yclients-marketplace.js` | 675 | Fix status check type | 🟡 IMPORTANT |
| `src/api/routes/yclients-marketplace.js` | 706 | Add idempotency | 🟡 IMPORTANT |
| `src/integrations/whatsapp/session-pool.js` | 96 | Increase max listeners | 🟡 IMPORTANT |
| `public/marketplace/onboarding.html` | 532-559 | Add exponential backoff | 🔵 MINOR |

---

## Review Completed

**Total Issues Found:** 13
- 🔴 Critical: 7
- 🟡 Important: 4
- 🔵 Minor: 2

**Estimated Fix Time:**
- Critical fixes: 2-3 hours
- Important fixes: 3-4 hours
- Minor improvements: 2-3 hours
- **Total: 7-10 hours**

**Risk Assessment:**
- **High Risk:** Issues #1, #2, #3 will cause immediate test failures
- **Medium Risk:** Issues #4, #8 may cause intermittent failures
- **Low Risk:** Other issues won't block testing but affect production quality

**Recommendation:** Fix Critical issues #1-3 **today** before moderator continues testing. The moderator is likely experiencing failures due to these exact issues.

---

**Code review saved to:** `/Users/vosarsen/Documents/GitHub/ai_admin_v2.nosync/dev/active/marketplace-registration-review/salon-registration-code-review.md`

**Please review the findings and approve which changes to implement before I proceed with any fixes.**
