# Onboarding Critical Fixes - Tasks

**Last Updated:** 2025-12-04 21:05 MSK
**Status:** Phase 1 & 2 COMPLETE ✅ | Phase 3 IN PROGRESS (Redis Pub/Sub)

---

## Phase 1: LID Phone Handling Fix (CRITICAL) ✅ COMPLETE

### 1.1 Fix _extractPhoneNumber()
- [x] Open `src/integrations/whatsapp/client.js`
- [x] Locate `_extractPhoneNumber()` method (lines 548-556)
- [x] Add check for `@lid` suffix before stripping
- [x] Preserve `@lid` suffix for LID numbers

**Code Change:**
```javascript
_extractPhoneNumber(formattedPhone) {
  if (!formattedPhone) return '';

  // Preserve @lid suffix for WhatsApp internal IDs
  if (formattedPhone.includes('@lid')) {
    return formattedPhone;
  }

  return formattedPhone
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace(/[^\d]/g, '');
}
```

### 1.2 Add Phone Format Logging
- [x] Add debug logging in `_formatPhone()`
- [x] Log input, detected format (LID/regular), output
- [x] Use `logger.debug()` to avoid production noise

### 1.3 Test with LID Numbers ✅
- [x] SSH to server
- [x] Test direct API call: `curl -X POST http://localhost:3003/send -d '{"phone":"152926689472618@lid","message":"LID test"}'`
- [x] Verify success response with messageId
- **Result:** `{"success":true,"messageId":"3EB08FCB8A87621721ED99","phone":"152926689472618@lid"}`

### 1.4 Test with Regular Numbers ✅
- [x] Test via client.sendMessage(): `79686484488`
- [x] Verify success response
- **Result:** `{"success":true,"messageId":"3EB0CEEED27A8D00A77C43","phone":"79686484488"}`

### 1.5 Deploy and Verify ✅
- [x] Commit changes (14a222a)
- [x] Push to main
- [x] Deploy: `pm2 restart ai-admin-worker-v2 ai-admin-api`
- [x] Verify via client.sendMessage() - both LID and regular work!
- [x] Check logs for success

---

## Phase 2: Company ID Unification (HIGH) ✅ COMPLETE

### 2.1 Audit Code Locations ✅
- [x] `src/api/websocket/marketplace-socket.js` - uses `company_${salonId}`
- [x] `src/api/routes/yclients-marketplace.js` - uses `company_${salon_id}`
- [x] `scripts/baileys-service.js` - was using `962302`, now fixed
- [x] Document all locations found

### 2.2 Decision: Use Prefixed Format ✅
- [x] Decided: Use `company_{salon_id}` everywhere
- [x] Implemented in baileys-service.js

### 2.3 Update baileys-service ✅
- [x] Check current format - was using `process.env.COMPANY_ID || '962302'`
- [x] Updated to use `company_${salonId}` format (commit 74b4ce8)
- [x] Tested - logs show `company company_962302`

### 2.4 Create Database Migration ✅
- [x] Created `migrations/20251204_unify_company_id.sql`
- [x] Created backups: `whatsapp_auth_backup_20251204`, `whatsapp_keys_backup_20251204`
- [x] Deleted 1 duplicate from whatsapp_auth
- [x] Deleted 22 duplicates from whatsapp_keys
- [x] Converted 19 keys from numeric to prefixed format

### 2.5 Run Migration ✅
- [x] Created backup first
- [x] Run migration on production (2025-12-04 20:50 MSK)
- [x] Verified changes

### 2.6 Verify No Duplicates ✅
- [x] whatsapp_auth: 1 record with `company_962302`
- [x] whatsapp_keys: all records use `company_962302`
- [x] No duplicates remaining!

---

## Phase 3: WebSocket Fix via Redis Pub/Sub (MEDIUM) 🔄 IN PROGRESS

### 3.0 Root Cause Analysis ✅ COMPLETE
- [x] Added debug logging to marketplace-socket.js (commit d84f778)
- [x] Deployed and analyzed logs
- [x] **ROOT CAUSE FOUND:** `ai-admin-api` and `baileys-service` are separate PM2 processes
- [x] Each has its own `sessionPool` instance - events don't cross process boundaries
- [x] This is an **IPC problem**, not a code bug

### 3.1 Architecture Decision ✅ COMPLETE
- [x] Evaluated 4 options (DB Polling, Redis Pub/Sub, HTTP Webhook, Unified Process)
- [x] **CHOSEN:** Redis Pub/Sub
- [x] Documented decision in context.md

### 3.2 Implement Redis Publisher (baileys-service)
- [ ] Add ioredis dependency (already installed)
- [ ] Create Redis publisher connection
- [ ] Publish `whatsapp:events` on 'connected' event
- [ ] Publish `whatsapp:events` on 'disconnected' event
- [ ] Publish `whatsapp:events` on 'qr' event (optional)

**Code to add to `scripts/baileys-service.js`:**
```javascript
const Redis = require('ioredis');
const publisher = new Redis(process.env.REDIS_URL);

// After pool setup, add:
pool.on('connected', async ({ companyId: cId, phoneNumber }) => {
  if (cId !== companyId) return;

  // Publish to Redis for cross-process communication
  await publisher.publish('whatsapp:events', JSON.stringify({
    type: 'connected',
    companyId: cId,
    phoneNumber,
    timestamp: Date.now()
  }));

  logger.info('📤 Published connected event to Redis', { companyId: cId });
});
```

### 3.3 Implement Redis Subscriber (ai-admin-api)
- [ ] Create Redis subscriber connection in `src/index.js`
- [ ] Subscribe to `whatsapp:events` channel
- [ ] Forward events to marketplace-socket

**Code to add to `src/index.js` (after Socket.IO setup):**
```javascript
const Redis = require('ioredis');
const subscriber = new Redis(process.env.REDIS_URL);

subscriber.subscribe('whatsapp:events', (err) => {
  if (err) {
    logger.error('Failed to subscribe to whatsapp:events:', err);
  } else {
    logger.info('✅ Subscribed to Redis channel: whatsapp:events');
  }
});

subscriber.on('message', (channel, message) => {
  if (channel === 'whatsapp:events') {
    try {
      const event = JSON.parse(message);
      logger.info('📥 Received Redis event:', event);

      if (event.type === 'connected') {
        marketplaceSocket.broadcastConnected(event);
      }
    } catch (error) {
      logger.error('Failed to parse Redis event:', error);
    }
  }
});
```

### 3.4 Add broadcastConnected Method
- [ ] Add method to `marketplace-socket.js`
- [ ] Lookup socket by companyId
- [ ] Emit 'whatsapp-connected' event

**Code to add to `MarketplaceSocket` class:**
```javascript
/**
 * Broadcast WhatsApp connected event from Redis pub/sub
 * @param {Object} data - Event data from baileys-service
 */
broadcastConnected(data) {
  const { companyId, phoneNumber } = data;
  const socket = this.connections.get(companyId);

  if (socket) {
    logger.info('📤 Broadcasting whatsapp-connected via Redis', { companyId, socketId: socket.id });

    socket.emit('whatsapp-connected', {
      success: true,
      phone: phoneNumber,
      sessionId: companyId,
      message: 'WhatsApp успешно подключен!'
    });
  } else {
    logger.warn('No socket found for company, broadcasting to room', { companyId });
    // Fallback: broadcast to room
    this.namespace.to(`company-${companyId.replace('company_', '')}`).emit('whatsapp-connected', {
      success: true,
      phone: phoneNumber,
      sessionId: companyId,
      message: 'WhatsApp успешно подключен!'
    });
  }
}
```

### 3.5 Deploy and Test
- [ ] Commit changes
- [ ] Push to main
- [ ] Deploy: `cd /opt/ai-admin && git pull && pm2 restart all`
- [ ] Monitor Redis: `redis-cli MONITOR | grep whatsapp`
- [ ] Test WebSocket flow end-to-end

### 3.6 Remove Debug Logging
- [ ] Remove verbose DEBUG logs from marketplace-socket.js
- [ ] Remove verbose DEBUG logs from session-pool.js
- [ ] Keep essential info logging

---

## Phase 4: Code Cleanup (LOW)

### 4.1 Remove console.log from Production
- [ ] Open `public/marketplace/onboarding.html`
- [ ] Remove or wrap console.log statements:
  - [ ] Line 493: Token data
  - [ ] Line 524: WebSocket connected
  - [ ] Line 529: QR received
  - [ ] Line 535: Status update
  - [ ] Line 540: WhatsApp connected
  - [ ] Line 572: Polling fallback
  - [ ] Line 591: Pairing code received
  - [ ] Line 803: Pairing code request

**Approach:**
```javascript
const DEBUG = false;
const debug = (...args) => DEBUG && console.log(...args);
```

### 4.2 Add LID Phone Test
- [ ] Create/update `tests/whatsapp/phone-format.test.js`
- [ ] Add test: LID numbers get @lid suffix
- [ ] Add test: Regular numbers get @c.us suffix

### 4.3 Update Documentation
- [ ] Update onboarding-testing-report.md with fix status
- [ ] Add notes about LID format handling
- [ ] Document company_id format decision
- [ ] Document Redis Pub/Sub architecture

---

## Verification Checklist

### After Phase 1 ✅
- [x] LID message sends successfully
- [x] Regular phone message sends successfully
- [x] No regressions in existing functionality
- [x] Logs show correct format detection

### After Phase 2 ✅
- [x] Only one format in whatsapp_auth
- [x] Only one format in whatsapp_keys
- [x] Session lookup works correctly
- [x] handleUninstall finds credentials

### After Phase 3
- [ ] Redis events published from baileys-service
- [ ] Redis events received in ai-admin-api
- [ ] WebSocket event reaches frontend
- [ ] Page transitions automatically on connect
- [ ] Polling fallback still works

### After Phase 4
- [ ] No console.log in production build
- [ ] All tests pass
- [ ] Documentation updated

---

## Quick Commands

```bash
# SSH to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Deploy
cd /opt/ai-admin && git pull && pm2 restart all

# Check logs
pm2 logs baileys-whatsapp-service --lines 30
pm2 logs ai-admin-api --lines 30

# Monitor Redis pub/sub (debug)
redis-cli MONITOR | grep whatsapp

# Test Redis publish manually
redis-cli PUBLISH whatsapp:events '{"type":"connected","companyId":"company_962302","phoneNumber":"79936363848"}'
```

---

## Notes

- Phase 1 is CRITICAL ✅ DONE
- Phase 2 requires careful migration ✅ DONE
- Phase 3 is architectural fix (Redis Pub/Sub) 🔄 IN PROGRESS
- Phase 4 is cleanup and can wait
