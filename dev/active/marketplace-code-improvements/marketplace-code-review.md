# YClients Marketplace Code Review - Phase 1, 2, 3 Implementation

**Last Updated:** 2025-12-02
**Reviewer:** Claude (Code Architecture Reviewer)
**Scope:** Phase 1, 2, and 3 improvements to marketplace module
**Files Reviewed:**
- `src/api/routes/yclients-marketplace.js` (2,053 lines)
- `src/utils/result.js` (242 lines)
- `src/utils/rate-limiter.js` (305 lines)
- `src/utils/admin-audit.js` (324 lines)
- `tests/integration/marketplace.test.js` (337 lines)
- `migrations/20251202_create_admin_audit_log.sql` (72 lines)

---

## Executive Summary

**Overall Grade: B+ (87/100)**

The implementation demonstrates solid engineering practices with strong security fundamentals, comprehensive error handling, and good test coverage. However, there are critical SQL injection vulnerabilities, memory leak risks, and architectural concerns that need immediate attention before production deployment.

**Key Strengths:**
- ✅ Excellent use of transactions with advisory locks (prevents race conditions)
- ✅ Comprehensive idempotency implementation with deterministic hashing
- ✅ Strong circuit breaker integration for resilience
- ✅ RBAC with timing-safe comparisons
- ✅ Non-blocking audit logging (failures don't affect main flow)
- ✅ 30 integration tests with good coverage

**Key Weaknesses:**
- 🔴 Critical SQL injection vulnerability in admin endpoints
- 🔴 Memory leak in rate limiter factory (unbounded Map growth)
- 🔴 Missing transaction isolation level specification
- 🟠 Audit log sensitive field detection can be bypassed
- 🟠 Redis connection lifecycle issues

---

## Critical Issues (Must Fix Before Production)

### 1. SQL Injection Vulnerability in Collector Events Query ⚠️ **CRITICAL**

**File:** `src/api/routes/yclients-marketplace.js`
**Lines:** 1010-1048
**Severity:** 🔴 **CRITICAL - Security**

**Issue:**
```javascript
// Line 1030: event_type interpolated directly into LIKE clause
sql += ` AND event_type LIKE $${paramIndex}`;
params.push(`%${event_type}%`);  // Unescaped user input
```

**Problem:**
- User-controlled `event_type` parameter is embedded in SQL LIKE pattern without proper escaping
- LIKE special characters (`%`, `_`, `\`) can be injected to bypass filtering or cause unexpected results
- While using parameterized queries ($1, $2) prevents classic SQL injection, LIKE patterns need additional escaping

**Attack Vector:**
```javascript
// Attacker sends: ?event_type=collector_%
// This bypasses filtering and returns ALL collector events
// Or: ?event_type=collector_payment%25admin  // %25 = URL encoded %
// This could potentially expose sensitive data
```

**Fix Required:**
```javascript
// Use escapeLikePattern utility from validators.js
const { escapeLikePattern } = require('../../utils/validators');

if (event_type) {
  sql += ` AND event_type LIKE $${paramIndex}`;
  params.push(`%${escapeLikePattern(event_type)}%`);  // Escape LIKE wildcards
  paramIndex++;
}
```

**Impact:** High - Data exposure, potential audit log manipulation

---

### 2. Memory Leak in Per-Key Rate Limiter Factory ⚠️ **CRITICAL**

**File:** `src/utils/rate-limiter.js`
**Lines:** 191-239
**Severity:** 🔴 **CRITICAL - Performance/Availability**

**Issue:**
```javascript
// Line 191: Unbounded Map - never cleaned up
const perKeyLimiters = new Map();

function getPerKeyLimiter(namespace, key, customConfig = {}) {
  const groupKey = `${namespace}:${key}`;

  // Return existing limiter if found
  if (perKeyLimiters.has(groupKey)) {
    return perKeyLimiters.get(groupKey);
  }

  // Create new limiter - NEVER REMOVED!
  const limiter = new RateLimiter(config);
  perKeyLimiters.set(groupKey, limiter);

  return limiter;
}
```

**Problem:**
- Every unique `salon_id` creates a new rate limiter instance that is **never garbage collected**
- With 10,000 salons, this creates 10,000+ permanent rate limiter objects
- Each limiter has Redis connections, timers, and in-memory stores
- Over time, memory usage grows unbounded → process crashes with OOM

**Evidence:**
```javascript
// Line 293: cleanupPerKeyLimiters exists but is NEVER CALLED!
function cleanupPerKeyLimiters() {
  for (const [key, limiter] of perKeyLimiters.entries()) {
    limiter.shutdown();
  }
  perKeyLimiters.clear();
}
```

**Fix Required:**
```javascript
// Option 1: TTL-based cleanup (recommended)
const PER_KEY_LIMITER_TTL = 3600000; // 1 hour

const perKeyLimiters = new Map();
const limiterLastUsed = new Map();

function getPerKeyLimiter(namespace, key, customConfig = {}) {
  const groupKey = `${namespace}:${key}`;
  limiterLastUsed.set(groupKey, Date.now());

  if (perKeyLimiters.has(groupKey)) {
    return perKeyLimiters.get(groupKey);
  }

  const limiter = new RateLimiter(config);
  perKeyLimiters.set(groupKey, limiter);

  return limiter;
}

// Cleanup stale limiters every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, lastUsed] of limiterLastUsed.entries()) {
    if (now - lastUsed > PER_KEY_LIMITER_TTL) {
      const limiter = perKeyLimiters.get(key);
      if (limiter) {
        limiter.shutdown();
        perKeyLimiters.delete(key);
        limiterLastUsed.delete(key);
        logger.debug('Cleaned up stale rate limiter', { key });
      }
    }
  }
}, 600000); // 10 minutes

// Option 2: LRU cache (better for high traffic)
// Use existing npm package like 'lru-cache'
```

**Impact:** High - Memory exhaustion, service crashes, Redis connection pool exhaustion

---

### 3. Missing Transaction Isolation Level for Advisory Locks

**File:** `src/api/routes/yclients-marketplace.js`
**Lines:** 679-757
**Severity:** 🔴 **CRITICAL - Data Integrity**

**Issue:**
```javascript
// Line 679: No isolation level specified
await companyRepository.withTransaction(async (txClient) => {
  // 1. Acquire advisory lock
  const lockResult = await txClient.query(
    'SELECT pg_try_advisory_xact_lock($1)',
    [parseInt(salon_id)]
  );
  // ...
});
```

**Problem:**
- PostgreSQL defaults to `READ COMMITTED` isolation level
- Advisory locks in `READ COMMITTED` can have subtle race conditions with concurrent transactions
- If two transactions acquire different locks and try to update the same row, one could block unexpectedly
- `pg_try_advisory_xact_lock` is transaction-scoped but doesn't prevent phantom reads

**Recommended Fix:**
```javascript
// Option 1: Explicit SERIALIZABLE isolation (safest)
await companyRepository.withTransaction(async (txClient) => {
  // Set isolation level first
  await txClient.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

  const lockResult = await txClient.query(
    'SELECT pg_try_advisory_xact_lock($1)',
    [parseInt(salon_id)]
  );
  // ...
}, { isolationLevel: 'SERIALIZABLE' });

// Option 2: Document the isolation level assumption
// Add comment explaining why READ COMMITTED is safe here
// (e.g., advisory lock prevents concurrent activations,
//  and we only update one row with known ID)
```

**Why This Matters:**
- Current implementation works in practice BUT lacks explicit guarantees
- Production bugs are hard to reproduce and debug
- Best practice: be explicit about concurrency expectations

**Impact:** Medium-High - Potential data corruption under high load, hard to debug

---

### 4. Unsafe Redis Client Lazy Initialization Pattern

**File:** `src/api/routes/yclients-marketplace.js`
**Lines:** 29-46
**Severity:** 🟠 **HIGH - Reliability**

**Issue:**
```javascript
let webhookRedisClient = null;

async function getWebhookRedisClient() {
  if (!webhookRedisClient) {
    try {
      webhookRedisClient = await createRedisClient();
    } catch (error) {
      logger.error('Failed to create Redis client:', error);
      return null;  // Fail-open: silently returns null
    }
  }
  return webhookRedisClient;
}
```

**Problems:**
1. **Race Condition:** Multiple concurrent calls can create multiple Redis clients
2. **Connection Leak:** If `createRedisClient()` throws after partial initialization, client may be in invalid state but cached
3. **No Retry Logic:** Once failed, never retries (manual restart required)
4. **Silent Degradation:** Returns `null` without logging severity level

**Fix Required:**
```javascript
// Use singleton pattern with lock
let webhookRedisClient = null;
let isInitializing = false;
let lastInitAttempt = 0;
const INIT_RETRY_DELAY = 60000; // 1 minute

async function getWebhookRedisClient() {
  // Fast path: already initialized
  if (webhookRedisClient) {
    return webhookRedisClient;
  }

  // Prevent concurrent initialization
  if (isInitializing) {
    logger.debug('Redis client initialization in progress, waiting...');
    // Wait for ongoing initialization (with timeout)
    return waitForInitialization();
  }

  // Check retry cooldown
  if (Date.now() - lastInitAttempt < INIT_RETRY_DELAY) {
    logger.debug('Redis initialization cooldown active');
    return null;
  }

  isInitializing = true;
  lastInitAttempt = Date.now();

  try {
    logger.info('Initializing webhook Redis client...');
    webhookRedisClient = await createRedisClient();
    logger.info('✅ Webhook Redis client initialized');
    return webhookRedisClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Redis client:', error);
    Sentry.captureException(error, {
      level: 'warning',
      tags: { component: 'redis', operation: 'init' }
    });
    return null;
  } finally {
    isInitializing = false;
  }
}

async function waitForInitialization(timeout = 5000) {
  const start = Date.now();
  while (isInitializing && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return webhookRedisClient;
}
```

**Impact:** Medium-High - Connection leaks, silent failures, manual restarts required

---

### 5. Audit Log Sensitive Field Detection Can Be Bypassed

**File:** `src/utils/admin-audit.js`
**Lines:** 14-53
**Severity:** 🟠 **HIGH - Security**

**Issue:**
```javascript
// Line 14: Case-sensitive matching only
const SENSITIVE_FIELDS = [
  'password', 'token', 'api_key', 'apiKey', 'secret', ...
];

function sanitizeBody(body) {
  // Line 39: Exact match only
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  // ...
}
```

**Problem:**
- Case variations bypass detection: `API_KEY`, `Api_Key`, `PASSWORD` are not redacted
- Nested fields beyond 1 level deep are not sanitized
- Array elements containing sensitive objects are not checked
- Field prefixes/suffixes not detected: `user_password`, `access_token_value`

**Fix Required:**
```javascript
// Use case-insensitive regex patterns
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /api[_-]?key/i,
  /secret/i,
  /private[_-]?key/i,
  /credentials/i,
  /authorization/i,
  /bearer/i
];

function sanitizeBody(body, depth = 0, maxDepth = 5) {
  if (depth > maxDepth || !body || typeof body !== 'object') {
    return body;
  }

  const sanitized = Array.isArray(body) ? [...body] : { ...body };

  for (const key of Object.keys(sanitized)) {
    // Check if key matches any sensitive pattern
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      // Recursively sanitize nested objects (limited depth)
      sanitized[key] = sanitizeBody(sanitized[key], depth + 1, maxDepth);
    }
  }

  return sanitized;
}
```

**Example Attack:**
```javascript
// This leaks the password to audit log:
POST /admin/action
{
  "USER_PASSWORD": "secret123",  // Not redacted (case mismatch)
  "auth": {
    "nested": {
      "token": "xyz"  // Not redacted (depth > 1)
    }
  }
}
```

**Impact:** Medium-High - Credential leakage in audit logs, compliance violations

---

## Important Improvements (Should Fix)

### 6. QR Circuit Breaker Timeout vs Operation Timeout Mismatch

**File:** `src/api/routes/yclients-marketplace.js`
**Lines:** 100-105, 495-527
**Severity:** 🟡 **MEDIUM - Reliability**

**Issue:**
```javascript
// Line 100: Circuit breaker timeout = 30s
const qrCircuitBreaker = getCircuitBreaker('qr-generation', {
  timeout: 30000,  // 30s
  // ...
});

// Line 506-524: Internal loop can run up to 33.25s
const maxAttempts = 5;
while (attempts < maxAttempts) {
  const delay = Math.min(1000 * Math.pow(1.5, attempts), 5000);
  // Total delay: 1 + 1.5 + 2.25 + 3.375 + 5 = 13.125s
  // Plus QR generation time per attempt (~4s each) = ~20s
  // Total worst case: 13.125 + 20 = 33.125s > 30s timeout!
  await new Promise(resolve => setTimeout(resolve, delay));
  qr = await sessionPool.getQR(sessionId);
  // ...
}
```

**Problem:**
- Circuit breaker will timeout at 30s, but loop can run longer
- This causes confusing errors: "Operation timeout" when QR is almost ready
- Circuit breaker opens unnecessarily (counts as failure)

**Fix:**
```javascript
// Option 1: Align timeouts
const qrCircuitBreaker = getCircuitBreaker('qr-generation', {
  timeout: 40000,  // 40s (leaves 7s buffer)
  // ...
});

// Option 2: Reduce attempts (cleaner)
const maxAttempts = 4; // 1 + 1.5 + 2.25 + 3.375 = 8.125s delay + ~16s ops = ~24s total
```

---

### 7. Missing Validation for Admin Role Hierarchy

**File:** `src/api/routes/yclients-marketplace.js`
**Lines:** 1429-1528, 1925-1935
**Severity:** 🟡 **MEDIUM - Security**

**Issue:**
```javascript
// Line 1446: Any admin role can pass auth
const allowedRoles = ['admin', 'superadmin', 'marketplace_admin'];
if (decoded.role && !allowedRoles.includes(decoded.role)) {
  return res.status(403).json({ error: 'Forbidden' });
}

// Line 1928: Audit log requires superadmin
if (req.adminUser?.role !== 'superadmin') {
  return res.status(403).json({ error: 'Access denied' });
}
```

**Problem:**
- No role hierarchy enforcement: `marketplace_admin` should not access audit logs
- No route-level permissions: all authenticated admins can disconnect salons
- Audit log endpoint checks role INSIDE handler (should be in middleware)

**Recommended Fix:**
```javascript
// Define role permissions
const ROLE_PERMISSIONS = {
  superadmin: ['*'], // All actions
  marketplace_admin: [
    'view_salons', 'view_status', 'generate_payment_link',
    'notify_payment', 'add_discounts', 'update_channels'
  ],
  admin: ['view_salons', 'view_status'] // Read-only
};

// Add permission check middleware
function requirePermission(requiredPermission) {
  return (req, res, next) => {
    const userRole = req.adminUser?.role;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    if (userPermissions.includes('*') || userPermissions.includes(requiredPermission)) {
      return next();
    }

    logger.warn('Insufficient permissions', {
      role: userRole,
      required: requiredPermission,
      path: req.path
    });

    return res.status(403).json({
      error: 'Forbidden',
      message: `This action requires: ${requiredPermission}`
    });
  };
}

// Usage:
router.post('/marketplace/admin/salon/:salonId/disconnect',
  adminRateLimiter,
  adminAuth,
  requirePermission('disconnect_salon'), // ← Add this
  disconnectHandler
);
```

---

### 8. Health Check Endpoint Returns Sensitive Configuration

**File:** `src/api/routes/yclients-marketplace.js`
**Lines:** 1196-1312
**Severity:** 🟡 **MEDIUM - Security**

**Issue:**
```javascript
// Line 1199-1208: Exposes too much information
const healthStatus = {
  environment: {
    partner_token: !!PARTNER_TOKEN,  // OK - boolean only
    app_id: !!APP_ID,  // OK
    jwt_secret: !!JWT_SECRET,  // OK
    base_url: BASE_URL,  // ⚠️ Full URL exposed
    node_version: process.version  // ℹ️ Version fingerprinting
  },
  dependencies: {
    express: !!express,  // ℹ️ Not useful
    jsonwebtoken: !!jwt,  // ℹ️ Not useful
    // ...
  }
}
```

**Problem:**
- `base_url` exposes internal infrastructure details
- `node_version` enables version-specific attacks
- `dependencies` boolean checks are always `true` (useless)
- No authentication required for sensitive operational data

**Fix:**
```javascript
// Add optional authentication for detailed health check
router.get('/marketplace/health', async (req, res) => {
  // Basic health (unauthenticated)
  const basicHealth = {
    status: 'ok',
    timestamp: new Date().toISOString()
  };

  // Detailed health requires auth
  const authHeader = req.headers.authorization;
  const isAuthenticated = authHeader && verifyHealthToken(authHeader);

  if (!isAuthenticated) {
    return res.json(basicHealth);
  }

  // Full health status (authenticated)
  const detailedHealth = {
    ...basicHealth,
    environment: {
      partner_token_configured: !!PARTNER_TOKEN,
      app_id_configured: !!APP_ID,
      jwt_secret_configured: !!JWT_SECRET,
      // Remove: base_url, node_version
    },
    services: {
      // ... database, redis, etc.
    }
  };

  res.json(detailedHealth);
});
```

---

### 9. Webhook Idempotency Key Has Weak TTL Management

**File:** `src/api/routes/yclients-marketplace.js`
**Lines:** 31, 62-83
**Severity:** 🟡 **MEDIUM - Reliability**

**Issue:**
```javascript
// Line 31: Fixed 1-hour TTL
const WEBHOOK_IDEMPOTENCY_TTL = 3600; // 1 hour

// Line 62-78: No error distinction
async function isWebhookDuplicate(webhookId) {
  const redis = await getWebhookRedisClient();
  if (!redis) {
    return false;  // Fail-open if Redis down
  }

  try {
    const result = await redis.set(
      `webhook:idempotency:${webhookId}`,
      '1',
      'EX',
      WEBHOOK_IDEMPOTENCY_TTL,
      'NX'
    );
    return result === null;
  } catch (error) {
    logger.error('Redis idempotency check failed:', error);
    return false;  // Fail-open on error
  }
}
```

**Problems:**
1. **TTL Too Short:** YClients may retry webhooks for up to 24 hours, but we only dedupe for 1 hour
2. **Fail-Open Risk:** If Redis is flaky, same webhook processed multiple times
3. **No Metrics:** Can't detect if deduplication is working

**Fix:**
```javascript
// Increase TTL to match YClients retry window
const WEBHOOK_IDEMPOTENCY_TTL = 86400; // 24 hours

// Add metrics and better error handling
const idempotencyMetrics = {
  hits: 0,      // Duplicate detected
  misses: 0,    // New webhook
  errors: 0     // Redis errors
};

async function isWebhookDuplicate(webhookId) {
  const redis = await getWebhookRedisClient();

  if (!redis) {
    idempotencyMetrics.errors++;
    logger.error('Idempotency check skipped - Redis unavailable', { webhookId });

    // ⚠️ Fail-open is dangerous here!
    // Consider: return true to reject webhook if Redis critical
    return false;
  }

  try {
    const result = await redis.set(
      `webhook:idempotency:${webhookId}`,
      '1',
      'EX',
      WEBHOOK_IDEMPOTENCY_TTL,
      'NX'
    );

    const isDuplicate = result === null;

    if (isDuplicate) {
      idempotencyMetrics.hits++;
      logger.info('Duplicate webhook detected', { webhookId });
    } else {
      idempotencyMetrics.misses++;
    }

    return isDuplicate;
  } catch (error) {
    idempotencyMetrics.errors++;
    logger.error('Redis idempotency check failed:', error);

    // Send alert if error rate high
    if (idempotencyMetrics.errors > 10) {
      Sentry.captureMessage('High idempotency check failure rate', {
        level: 'warning',
        extra: { metrics: idempotencyMetrics }
      });
    }

    return false;
  }
}

// Expose metrics for monitoring
router.get('/marketplace/metrics/idempotency', adminAuth, (req, res) => {
  res.json({
    metrics: idempotencyMetrics,
    total: idempotencyMetrics.hits + idempotencyMetrics.misses,
    hitRate: (idempotencyMetrics.hits / (idempotencyMetrics.hits + idempotencyMetrics.misses) * 100).toFixed(2) + '%'
  });
});
```

---

### 10. Rate Limiter In-Memory Store Has Unbounded Growth

**File:** `src/utils/rate-limiter.js`
**Lines:** 80-108
**Severity:** 🟡 **MEDIUM - Performance**

**Issue:**
```javascript
// Line 80-108: No max size limit
checkMemoryLimit(key) {
  const now = Date.now();
  const windowStart = now - this.windowMs;

  let entry = this.inMemoryStore.get(key);
  if (!entry) {
    entry = [];
    this.inMemoryStore.set(key, entry);  // Unbounded growth!
  }

  // Cleanup old keys periodically - but how often?
  this.cleanupMemoryStore();  // Called on EVERY request!

  return true;
}

// Line 113-125: Cleanup is O(n) - expensive!
cleanupMemoryStore() {
  const now = Date.now();
  const windowStart = now - this.windowMs;

  for (const [key, timestamps] of this.inMemoryStore.entries()) {
    // Iterates ALL keys on EVERY request when in-memory mode
    const filtered = timestamps.filter(t => t > windowStart);
    if (filtered.length === 0) {
      this.inMemoryStore.delete(key);
    }
  }
}
```

**Problems:**
1. **Performance:** O(n) cleanup on every request when Redis unavailable
2. **Memory:** No hard limit - can grow unbounded if Redis down for extended period
3. **Inefficiency:** Cleanup runs even when unnecessary

**Fix:**
```javascript
class RateLimiter {
  constructor(options = {}) {
    // ... existing code ...
    this.maxInMemoryKeys = options.maxInMemoryKeys || 10000; // Add limit
    this.lastCleanup = 0;
    this.cleanupInterval = 60000; // Cleanup every 60s, not every request
  }

  checkMemoryLimit(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create entry
    let entry = this.inMemoryStore.get(key);
    if (!entry) {
      // Check size limit before adding
      if (this.inMemoryStore.size >= this.maxInMemoryKeys) {
        logger.warn('In-memory rate limiter at capacity', {
          size: this.inMemoryStore.size,
          limit: this.maxInMemoryKeys
        });
        // Evict oldest key (LRU-like behavior)
        const firstKey = this.inMemoryStore.keys().next().value;
        this.inMemoryStore.delete(firstKey);
      }

      entry = [];
      this.inMemoryStore.set(key, entry);
    }

    // Filter old timestamps
    entry = entry.filter(timestamp => timestamp > windowStart);

    // Check if under limit
    if (entry.length >= this.maxRequests) {
      this.inMemoryStore.set(key, entry);
      return false;
    }

    // Add current timestamp
    entry.push(now);
    this.inMemoryStore.set(key, entry);

    // Periodic cleanup (not on every request)
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.cleanupMemoryStore();
      this.lastCleanup = now;
    }

    return true;
  }
}
```

---

## Minor Suggestions (Nice to Have)

### 11. Improve Error Messages for Better Debugging

**File:** `src/api/routes/yclients-marketplace.js`
**Lines:** Multiple locations

**Current:**
```javascript
// Line 122: Generic error response
function safeErrorResponse(res, error, statusCode = 500) {
  const message = process.env.NODE_ENV === 'production'
    ? 'An error occurred'  // Too generic
    : error.message;

  return res.status(statusCode).json({
    error: message,
    code: error.code || 'INTERNAL_ERROR'
  });
}
```

**Suggestion:**
```javascript
// Add error categories in production
function safeErrorResponse(res, error, statusCode = 500) {
  // Determine error category
  const category = categorizeError(error);

  const response = {
    error: process.env.NODE_ENV === 'production'
      ? getGenericMessage(category)  // Informative but safe
      : error.message,
    code: error.code || 'INTERNAL_ERROR',
    category  // Add category for debugging
  };

  // Add request_id for tracing
  if (res.locals.requestId) {
    response.request_id = res.locals.requestId;
  }

  return res.status(statusCode).json(response);
}

function categorizeError(error) {
  if (error.code?.startsWith('ER_')) return 'database';
  if (error.name === 'ValidationError') return 'validation';
  if (error.name === 'TimeoutError') return 'timeout';
  return 'internal';
}

function getGenericMessage(category) {
  const messages = {
    database: 'Database operation failed. Please try again.',
    validation: 'Invalid input data.',
    timeout: 'Operation timed out. Please try again.',
    internal: 'An error occurred. Please contact support.'
  };
  return messages[category] || messages.internal;
}
```

---

### 12. Add Request ID Tracing for Debugging

**File:** `src/api/routes/yclients-marketplace.js`
**Missing:** Request correlation

**Suggestion:**
```javascript
// Add middleware at the top of the file
const { v4: uuidv4 } = require('uuid');

// Request ID middleware (add before all routes)
router.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  res.locals.requestId = req.id;

  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  next();
});

// Use in all log statements
logger.info('Processing webhook', {
  requestId: req.id,  // Add this to all logs
  webhookId,
  eventType
});
```

**Benefits:**
- Trace requests across microservices
- Debug webhook processing issues
- Correlate logs in Sentry/GlitchTip

---

### 13. Add Prometheus Metrics for Observability

**File:** `src/api/routes/yclients-marketplace.js`
**Missing:** Metrics export

**Suggestion:**
```javascript
// Add prometheus client
const promClient = require('prom-client');

// Define metrics
const webhookCounter = new promClient.Counter({
  name: 'marketplace_webhooks_total',
  help: 'Total webhooks received',
  labelNames: ['event_type', 'status']
});

const activationDuration = new promClient.Histogram({
  name: 'marketplace_activation_duration_seconds',
  help: 'Activation duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// Use in handlers
router.post('/webhook/yclients', async (req, res) => {
  webhookCounter.inc({ event_type: eventType, status: 'received' });
  // ... processing ...
  webhookCounter.inc({ event_type: eventType, status: isDuplicate ? 'duplicate' : 'processed' });
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

---

### 14. Test Coverage Gaps

**File:** `tests/integration/marketplace.test.js`
**Coverage:** 30 tests, but missing critical scenarios

**Missing Tests:**
1. ✅ Has: Result type tests
2. ✅ Has: Rate limiter basic tests
3. ❌ **Missing:** Transaction rollback behavior
4. ❌ **Missing:** Concurrent activation attempts (advisory lock test)
5. ❌ **Missing:** Circuit breaker state transitions (closed → open → half-open)
6. ❌ **Missing:** Redis failure scenarios (fail-open behavior)
7. ❌ **Missing:** Webhook idempotency edge cases (TTL expiry, Redis down)
8. ❌ **Missing:** Admin RBAC tests (role hierarchy)
9. ❌ **Missing:** Audit log sanitization tests (nested objects, case variations)
10. ❌ **Missing:** QR generation timeout scenarios

**Recommended Additions:**
```javascript
describe('Transaction Integrity', () => {
  test('Activation rollback on YClients API failure', async () => {
    // Mock YClients API to fail
    // Verify database is unchanged
    // Verify audit log has failure event
  });

  test('Concurrent activations blocked by advisory lock', async () => {
    // Start 2 parallel activations for same salon
    // Verify only 1 succeeds, other gets 409
  });
});

describe('Circuit Breaker Behavior', () => {
  test('Opens after 5 consecutive failures', async () => {
    // Trigger 5 QR failures
    // Verify state = 'open'
    // Verify 6th request gets 503 SERVICE_UNAVAILABLE
  });

  test('Transitions to half-open after timeout', async () => {
    // Open circuit
    // Wait for resetTimeout
    // Verify next request attempts operation (half-open)
  });
});
```

---

## Architecture Considerations

### 15. Repository Pattern Missing Specification

**File:** `src/api/routes/yclients-marketplace.js`
**Lines:** 186-188

**Issue:**
```javascript
// Line 186-188: Direct instantiation
const companyRepository = new CompanyRepository(postgres);
const marketplaceEventsRepository = new MarketplaceEventsRepository(postgres);
```

**Concern:**
- Repositories are instantiated at module load time
- If `postgres` connection fails, entire module fails to load
- No dependency injection - hard to mock for testing
- Tight coupling to specific repository implementations

**Recommendation:**
```javascript
// Use factory pattern or lazy initialization
class RepositoryManager {
  constructor() {
    this._companyRepo = null;
    this._eventsRepo = null;
  }

  get companyRepository() {
    if (!this._companyRepo) {
      this._companyRepo = new CompanyRepository(postgres);
    }
    return this._companyRepo;
  }

  get marketplaceEventsRepository() {
    if (!this._eventsRepo) {
      this._eventsRepo = new MarketplaceEventsRepository(postgres);
    }
    return this._eventsRepo;
  }
}

const repositories = new RepositoryManager();
```

**Or use dependency injection:**
```javascript
// marketplace-routes.js becomes a factory
function createMarketplaceRoutes(dependencies) {
  const { companyRepository, marketplaceEventsRepository, sessionPool } = dependencies;
  const router = express.Router();

  // Use injected dependencies
  router.get('/auth/yclients/redirect', async (req, res) => {
    const company = await companyRepository.upsertByYclientsId({ ... });
    // ...
  });

  return router;
}

// In main app.js:
const repositories = {
  companyRepository: new CompanyRepository(postgres),
  marketplaceEventsRepository: new MarketplaceEventsRepository(postgres),
  sessionPool: getSessionPool()
};

app.use('/api', createMarketplaceRoutes(repositories));
```

---

### 16. Consider Splitting Large Route File

**File:** `src/api/routes/yclients-marketplace.js`
**Size:** 2,053 lines (very large)

**Recommendation:**
Split into focused modules:

```
src/api/routes/marketplace/
  ├── index.js                    # Main router registration
  ├── public-routes.js            # Registration, onboarding, QR
  ├── webhook-routes.js           # Webhook handlers
  ├── admin-routes.js             # Admin API endpoints
  ├── health-routes.js            # Health check
  ├── middleware/
  │   ├── rate-limiting.js        # Rate limiter setup
  │   ├── admin-auth.js           # Admin authentication
  │   └── webhook-validation.js   # Partner token validation
  ├── handlers/
  │   ├── activation-handler.js   # Activation logic
  │   ├── webhook-handler.js      # Event processing
  │   └── qr-handler.js           # QR generation
  └── utils/
      ├── webhook-idempotency.js  # Idempotency helpers
      └── error-responses.js      # Error formatting
```

**Benefits:**
- Easier to navigate and maintain
- Better test isolation
- Clearer ownership and responsibilities
- Reduced merge conflicts

---

## Testing & Validation Summary

### Test Coverage Analysis

**Total Tests:** 30 (Good start!)

**Covered:**
- ✅ Result type construction and methods (20 tests)
- ✅ ErrorCodes validation (3 tests)
- ✅ Rate limiter basic functionality (5 tests)
- ✅ Webhook idempotency determinism (3 tests)
- ✅ Circuit breaker initialization (2 tests)
- ✅ Admin audit function existence checks (3 tests)

**Missing (High Priority):**
- ❌ Transaction rollback on failure
- ❌ Advisory lock concurrent access
- ❌ Circuit breaker state machine
- ❌ Redis failure scenarios
- ❌ RBAC permission enforcement
- ❌ Audit log sanitization edge cases

**Test Quality Issues:**
```javascript
// Line 318-336: Tests only check function existence
test('logAdminAction function exists', () => {
  const { logAdminAction } = require('../../src/utils/admin-audit');
  expect(typeof logAdminAction).toBe('function');
});
```

**Recommendation:** Add behavioral tests for audit logging:
```javascript
test('logAdminAction sanitizes password fields', async () => {
  const mockDb = createMockDb();
  const mockReq = {
    adminUser: { id: 'admin-1', role: 'admin' },
    body: { password: 'secret123', name: 'Test' },
    method: 'POST',
    path: '/admin/action',
    ip: '127.0.0.1'
  };

  await logAdminAction(mockDb, mockReq, {
    action: 'test_action'
  });

  const insertCall = mockDb.query.mock.calls[0];
  const requestBody = JSON.parse(insertCall[1][11]); // request_body column

  expect(requestBody.password).toBe('[REDACTED]');
  expect(requestBody.name).toBe('Test');
});
```

---

## Security Checklist

| Check | Status | Notes |
|-------|--------|-------|
| SQL injection prevention | ⚠️ **PARTIAL** | LIKE pattern escaping missing (Issue #1) |
| XSS prevention | ✅ **GOOD** | sanitizeString removes HTML tags |
| CSRF protection | ℹ️ **N/A** | API-only (no cookies except JWT) |
| Authentication bypass | ✅ **GOOD** | JWT + API key with timing-safe comparison |
| Authorization checks | 🟡 **PARTIAL** | Missing role hierarchy (Issue #7) |
| Sensitive data exposure | 🟡 **PARTIAL** | Health check exposes base_url (Issue #8), audit log bypass (Issue #5) |
| Rate limiting | ✅ **GOOD** | Per-salon rate limiting implemented |
| Input validation | ✅ **GOOD** | Comprehensive validators.js |
| Error information leakage | ✅ **GOOD** | Production mode hides stack traces |
| Audit logging | ✅ **GOOD** | All admin actions logged |
| Advisory locks | ⚠️ **PARTIAL** | Missing isolation level (Issue #3) |
| Idempotency | ✅ **GOOD** | Deterministic webhook IDs |

**Overall Security Grade: B (82/100)**

---

## Performance Checklist

| Metric | Status | Notes |
|--------|--------|-------|
| Database connection pooling | ✅ **GOOD** | Timeweb PostgreSQL pool |
| N+1 query prevention | ℹ️ **UNKNOWN** | Repository implementation not reviewed |
| Redis connection management | 🟠 **ISSUES** | Lazy init race condition (Issue #4) |
| Memory leaks | 🔴 **CRITICAL** | Rate limiter unbounded growth (Issue #2) |
| Circuit breaker | ✅ **GOOD** | Prevents cascading failures |
| Rate limiting | ✅ **GOOD** | Webhook + admin endpoints protected |
| Async processing | ✅ **GOOD** | Webhooks use setImmediate |
| Transaction efficiency | ✅ **GOOD** | Advisory locks prevent conflicts |
| Query parameterization | ✅ **GOOD** | All queries use $1, $2, ... |
| Cleanup jobs | ⚠️ **PARTIAL** | Audit log cleanup exists but no scheduler |

**Overall Performance Grade: C+ (75/100)**

---

## Final Recommendations

### Immediate Actions (Before Production)

1. **Fix SQL Injection (Issue #1)** - 🔴 CRITICAL
   - Add `escapeLikePattern` to collector events query
   - Estimated time: 15 minutes

2. **Fix Memory Leak (Issue #2)** - 🔴 CRITICAL
   - Implement TTL-based cleanup for per-key limiters
   - Estimated time: 2 hours

3. **Fix Transaction Isolation (Issue #3)** - 🔴 CRITICAL
   - Add SERIALIZABLE isolation level or document assumptions
   - Estimated time: 30 minutes

4. **Fix Redis Initialization (Issue #4)** - 🟠 HIGH
   - Add singleton pattern with lock
   - Estimated time: 1 hour

5. **Fix Audit Log Sanitization (Issue #5)** - 🟠 HIGH
   - Use case-insensitive patterns, increase depth
   - Estimated time: 1.5 hours

**Total estimated time: ~5.5 hours**

### Short-Term Improvements (Next Sprint)

6. Fix QR timeout mismatch (Issue #6)
7. Implement role hierarchy (Issue #7)
8. Secure health check endpoint (Issue #8)
9. Increase webhook idempotency TTL (Issue #9)
10. Add max size limit to in-memory rate limiter (Issue #10)

### Long-Term Enhancements

11. Split large route file into modules (Issue #16)
12. Add Prometheus metrics (Issue #13)
13. Implement dependency injection (Issue #15)
14. Add comprehensive integration tests
15. Add request ID tracing (Issue #12)

---

## Code Review Sign-Off

**Approval Status:** ⚠️ **CONDITIONAL APPROVAL**

The code demonstrates strong engineering fundamentals and is well-structured. However, **production deployment is blocked** until the 5 critical/high-severity issues are resolved:

1. SQL injection in LIKE patterns
2. Memory leak in rate limiter factory
3. Missing transaction isolation level
4. Redis initialization race condition
5. Audit log sanitization bypass

Once these issues are addressed, the code will be **APPROVED** for production deployment.

**Estimated remediation time:** 5.5 hours
**Re-review required:** Yes, after fixes applied

---

**Next Steps:**
1. Review this document with the development team
2. Prioritize fixes based on severity
3. Create tickets for each issue
4. Implement fixes following the provided code examples
5. Add missing integration tests
6. Request re-review before deployment

Please let me know which changes you'd like to implement first, and I can provide more detailed implementation guidance.
