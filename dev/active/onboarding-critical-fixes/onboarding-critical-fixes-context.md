# Onboarding Critical Fixes - Context

**Last Updated:** 2025-12-04 21:25 MSK
**Status:** Phase 1, 2, 3 COMPLETE ✅ | Phase 4 (Cleanup) pending
**Current Phase:** Phase 3 COMPLETE - Redis Pub/Sub implemented and tested

---

## PROJECT COMPLETE STATUS

### All Critical Phases Done:
1. **Phase 1 (LID Fix):** ✅ commit `14a222a`
2. **Phase 2 (Company ID):** ✅ commit `74b4ce8`
3. **Phase 3 (WebSocket via Redis Pub/Sub):** ✅ commits `7c7297a`, `187bf5e`

### Remaining (LOW priority):
- Phase 4: Remove debug logging and console.log statements
- E2E testing with actual WhatsApp reconnection

---

## SESSION 2 SUMMARY (2025-12-04 21:15-21:25 MSK)

### Phase 3 Implementation Complete:
1. **Redis Publisher in baileys-service.js**
   - Uses `createRedisClient()` with proper auth (role: `baileys-publisher`)
   - Publishes `connected` events to `whatsapp:events` channel

2. **Redis Subscriber in src/api/index.js**
   - Uses `createRedisClient()` with proper auth (role: `whatsapp-subscriber`)
   - Subscribes to `whatsapp:events` channel
   - Forwards events to `marketplaceSocket.broadcastConnected()`

3. **broadcastConnected() in marketplace-socket.js**
   - Emits `whatsapp-connected` to WebSocket client
   - Fallback to room broadcast if no direct socket

### Verification:
```
baileys-service: 📤 Published connected event to Redis {"companyId":"company_962302"}
ai-admin-api:    📥 Received Redis event: {"companyId":"company_962302","type":"connected"}
ai-admin-api:    No socket found for company, broadcasting to room (expected - no client connected during test)
```

### Key Fix During Implementation:
Initially used `new Redis(process.env.REDIS_URL)` which caused `NOAUTH` errors.
Fixed by using `createRedisClient()` from `redis-factory.js` which properly reads `REDIS_PASSWORD`.

---

## FINAL ARCHITECTURE

```
┌─────────────────────────┐          ┌─────────────────────────┐
│  baileys-service        │ PUBLISH  │  ai-admin-api           │
│  (PM2 process)          │ ───────► │  (PM2 process)          │
│                         │  Redis   │                         │
│  pool.on('connected')   │ channel: │  subscriber.on('message')│
│  ↓                      │ whatsapp │  ↓                      │
│  redisPublisher.publish │ :events  │  marketplaceSocket      │
│  (role: baileys-publisher)        │  .broadcastConnected()  │
│                         │          │  (role: whatsapp-subscriber)
└─────────────────────────┘          └─────────────────────────┘
                                              ↓
                                     WebSocket emit to client
                                     'whatsapp-connected' event
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
