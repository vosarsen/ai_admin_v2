# Onboarding Critical Fixes - Context

**Last Updated:** 2025-12-04 21:10 MSK (pre-context-reset)
**Status:** Phase 1 & 2 COMPLETE ✅ | Phase 3 IN PROGRESS (Redis Pub/Sub)
**Current Phase:** Phase 3.2 - Ready to implement Redis Publisher

---

## CRITICAL: NEXT SESSION HANDOFF

### What Was Being Worked On
Phase 3: WebSocket fix via Redis Pub/Sub. Root cause found, architecture decision made.

### Immediate Next Steps (in order)
1. **Implement Redis Publisher in `scripts/baileys-service.js`**
2. **Implement Redis Subscriber in `src/index.js`**
3. **Add `broadcastConnected()` to `marketplace-socket.js`**
4. Deploy and test

### Files to Modify (code templates in tasks.md)
| File | Change |
|------|--------|
| `scripts/baileys-service.js` | Add Redis publisher on 'connected' event |
| `src/index.js` | Initialize Redis subscriber on startup |
| `src/api/websocket/marketplace-socket.js` | Add `broadcastConnected()` method |

### Test Command After Implementation
```bash
# Manual Redis test (will trigger WebSocket)
redis-cli PUBLISH whatsapp:events '{"type":"connected","companyId":"company_962302","phoneNumber":"79936363848"}'
```

---

## SESSION SUMMARY (2025-12-04)

### Completed This Session:
1. **Phase 1 (LID Fix):** ✅ commit `14a222a`
2. **Phase 2 (Company ID):** ✅ commit `74b4ce8`
3. **Phase 3 Root Cause Analysis:** ✅
   - Found IPC problem between PM2 processes
   - Decided on Redis Pub/Sub solution

### Key Discovery: IPC Architecture Problem

**Problem:** `ai-admin-api` and `baileys-whatsapp-service` are **separate PM2 processes** with separate `sessionPool` instances. Events in baileys-service never reach marketplace-socket.

**Solution:** Redis Pub/Sub for cross-process communication.

---

## ARCHITECTURE DIAGRAM

### Current (Broken)
```
┌─────────────────────┐     ┌─────────────────────┐
│  ai-admin-api       │     │ baileys-service     │
│  ┌───────────────┐  │     │  ┌───────────────┐  │
│  │ sessionPool   │  │     │  │ sessionPool   │  │ ← WhatsApp HERE
│  │ (empty)       │  │     │  │ (active)      │  │
│  └───────────────┘  │     │  └───────────────┘  │
│  marketplace-socket │ ✗   │  'connected' event  │
│  (never receives)   │     │  (never crosses)    │
└─────────────────────┘     └─────────────────────┘
```

### Solution: Redis Pub/Sub
```
┌─────────────────────┐          ┌─────────────────────┐
│  baileys-service    │ PUBLISH  │  ai-admin-api       │
│  pool.on('connected')│ ───────►│  subscriber.on()    │
│  → publisher.publish │  Redis  │  → socket.emit()    │
└─────────────────────┘          └─────────────────────┘
```

---

## IMPLEMENTATION CODE (Ready to Use)

### Step 1: baileys-service.js (add after line ~30)
```javascript
const Redis = require('ioredis');
const publisher = new Redis(process.env.REDIS_URL);

// After existing pool.on('connected'), add Redis publish:
pool.on('connected', async ({ companyId: cId, phoneNumber }) => {
  if (cId !== companyId) return;

  await publisher.publish('whatsapp:events', JSON.stringify({
    type: 'connected',
    companyId: cId,
    phoneNumber,
    timestamp: Date.now()
  }));
  logger.info('📤 Published connected event to Redis', { companyId: cId });
});
```

### Step 2: src/index.js (add after Socket.IO setup)
```javascript
// Redis subscriber for cross-process WhatsApp events
const Redis = require('ioredis');
const whatsappSubscriber = new Redis(process.env.REDIS_URL);

whatsappSubscriber.subscribe('whatsapp:events', (err) => {
  if (err) logger.error('Redis subscribe error:', err);
  else logger.info('✅ Subscribed to whatsapp:events');
});

whatsappSubscriber.on('message', (channel, message) => {
  if (channel === 'whatsapp:events') {
    const event = JSON.parse(message);
    logger.info('📥 Redis event:', event);
    if (event.type === 'connected') {
      marketplaceSocket.broadcastConnected(event);
    }
  }
});
```

### Step 3: marketplace-socket.js (add method to class)
```javascript
broadcastConnected(data) {
  const { companyId, phoneNumber } = data;
  const socket = this.connections.get(companyId);

  if (socket) {
    logger.info('📤 Broadcasting whatsapp-connected', { companyId });
    socket.emit('whatsapp-connected', {
      success: true,
      phone: phoneNumber,
      sessionId: companyId,
      message: 'WhatsApp успешно подключен!'
    });
  } else {
    // Fallback to room
    const salonId = companyId.replace('company_', '');
    this.namespace.to(`company-${salonId}`).emit('whatsapp-connected', {
      success: true,
      phone: phoneNumber,
      sessionId: companyId,
      message: 'WhatsApp успешно подключен!'
    });
  }
}
```

---

## COMPLETED PHASES

### Phase 1: LID Phone Fix ✅
- **Commit:** 14a222a
- **Fix:** `_extractPhoneNumber()` preserves `@lid` suffix
- **Test Results:** Both LID and regular phones work

### Phase 2: Company ID Unification ✅
- **Commit:** 74b4ce8
- **Format:** `company_{salon_id}` everywhere
- **Migration:** Deleted duplicates, unified 19 keys
- **DB State:** `whatsapp_auth` has 1 record: `company_962302`

---

## DEBUG LOGGING (to remove after fix)

Added in commit d84f778 (temporary):
- `marketplace-socket.js`: handleConnected debug logs
- `session-pool.js`: connected event emission logs

**Remove after Phase 3 complete.**

---

## TEST DATA

- **Salon ID:** 962302
- **Session ID:** `company_962302`
- **Redis Channel:** `whatsapp:events`
- **Test Phone:** 79686484488

---

## QUICK COMMANDS

```bash
# SSH
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Deploy
cd /opt/ai-admin && git pull && pm2 restart all

# Monitor Redis
redis-cli MONITOR | grep whatsapp

# Manual Redis test
redis-cli PUBLISH whatsapp:events '{"type":"connected","companyId":"company_962302","phoneNumber":"79936363848"}'

# Logs
pm2 logs baileys-whatsapp-service --lines 30
pm2 logs ai-admin-api --lines 30
```

---

## UNCOMMITTED CHANGES

Current git status: debug logging commits pushed (d84f778)
No uncommitted changes.
