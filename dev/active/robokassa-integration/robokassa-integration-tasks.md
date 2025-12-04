# Robokassa Integration - Tasks

**Last Updated:** 2025-12-04 20:45 MSK
**Overall Progress:** 8/59 tasks (14%)
**Review Status:** ✅ Critical fixes incorporated
**Session:** 1 - Infrastructure setup complete

---

## Phase 1: Database Schema (4/4) ✅ COMPLETE

- [x] 1.1 Create migration file `migrations/20251204_create_robokassa_payments.sql`
- [x] 1.2 Define table schema with all columns
- [x] 1.3 Add indexes on `salon_id`, `status`, `invoice_id`
- [x] 1.4 Run migration on Timeweb PostgreSQL server ✅

**Acceptance:** ✅ Table `robokassa_payments` created successfully

---

## Phase 7: Environment Setup (4/4) ✅ COMPLETE

- [x] 7.1 Get Password #1 from Robokassa panel ✅
- [x] 7.2 Get Password #2 from Robokassa panel ✅
- [x] 7.3 Add env vars to server `.env` ✅
  - `ROBOKASSA_MERCHANT_LOGIN=AdminAI`
  - `ROBOKASSA_PASSWORD_1=hyEqH3K5t9kAIk10sSXA`
  - `ROBOKASSA_PASSWORD_2=Y8NP8t2UI5EwGLIy3oGS`
  - `ROBOKASSA_TEST_MODE=true`
- [ ] 7.4 Restart PM2 services to load new config (after code deployed)

**Acceptance:** ✅ Credentials added to .env, verified

---

## Phase 2: Repository Layer (0/8) ⬜ NEXT

- [ ] 2.1 Create `src/repositories/RobokassaPaymentRepository.js`
- [ ] 2.2 Implement `insert(data)` method
- [ ] 2.3 Implement `findByInvoiceId(invoiceId)` method
- [ ] 2.4 **NEW:** Implement `findByInvoiceIdForUpdate(invoiceId, client)` - SELECT FOR UPDATE
- [ ] 2.5 Implement `updateStatus(invoiceId, status, extra)` method
- [ ] 2.6 **FIX:** Implement `getNextInvoiceId()` method (16-digit max: timestamp + 3 random)
- [ ] 2.7 Implement `findBySalonId(salonId, options)` method
- [ ] 2.8 Export from `src/repositories/index.js`

**Acceptance:** All methods work, can create and query payments

**Reference:** `src/repositories/BaseRepository.js` - base class with `withTransaction()`, `findOne()`, `update()` etc.

---

## Phase 3: Service Layer (0/10)

- [ ] 3.1 Create `src/services/payment/robokassa-service.js`
- [ ] 3.2 Implement `buildPaymentSignature(outSum, invId)` - MD5 with **toUpperCase()**
- [ ] 3.3 Implement `verifyResultSignature(outSum, invId, signature)` - MD5 with **toUpperCase()** comparison
- [ ] 3.4 Implement `generatePaymentUrl(salonId, amount, options)` - full URL with signature
- [ ] 3.5 **FIX:** Implement `processPayment(params)` - with **TRANSACTION** and SELECT FOR UPDATE
- [ ] 3.6 **NEW:** Implement `verifyAmount(payment, outSum)` - compare OutSum vs DB
- [ ] 3.7 **NEW:** Implement `processPaymentWithTimeout(invId, outSum, signature)` - 25s timeout wrapper
- [ ] 3.8 Implement `buildReceipt(amount, description)` - 54-FZ compliant
- [ ] 3.9 Add Sentry error tracking to all methods
- [ ] 3.10 **NEW:** Add test mode warning on startup if `NODE_ENV=production`

**Acceptance:** Can generate valid payment URLs and verify signatures

---

## Phase 4: Webhook Handler (0/11) ⚠️ CRITICAL FIXES

> **CRITICAL ORDER OF OPERATIONS:**
> 1. Parse form data (urlencoded)
> 2. Verify signature **FIRST**
> 3. Check amount matches DB
> 4. Check idempotency
> 5. Process payment
> 6. **ONLY THEN** respond `OK{InvId}`

- [ ] 4.1 **FIX:** Create router with `express.urlencoded({ extended: true })` middleware
- [ ] 4.2 **NEW:** Add rate limiter (10 req/min per IP)
- [ ] 4.3 Implement `/result` POST endpoint (handles form data)
- [ ] 4.4 Implement `/result` GET endpoint (fallback for edge cases)
- [ ] 4.5 **CRITICAL:** Verify MD5 signature **FIRST** (before any DB operations)
- [ ] 4.6 **CRITICAL:** Verify amount matches DB (prevent fraud)
- [ ] 4.7 **CRITICAL:** Check idempotency (already processed → return OK immediately)
- [ ] 4.8 Call `processPaymentWithTimeout()` service method
- [ ] 4.9 **FIX:** Return `OK{InvId}` with `Content-Type: text/plain`
- [ ] 4.10 Add `/health` check endpoint with config validation
- [ ] 4.11 Register router in `src/index.js`

**Acceptance:** Webhook receives callbacks, verifies properly, responds correctly

### ❌ WRONG Pattern (DO NOT USE)
```javascript
// DON'T DO THIS!
res.status(200).json({ success: true }); // WRONG: Responds before verification!
// ... then verifies
```

### ✅ CORRECT Pattern
```javascript
// 1. Verify signature FIRST
if (!isValid) return res.status(400).send('bad sign');
// 2. Verify amount
// 3. Check idempotency
// 4. Process
// 5. ONLY THEN respond
res.setHeader('Content-Type', 'text/plain');
res.send(`OK${InvId}`);
```

---

## Phase 5: API Routes (0/7)

- [ ] 5.1 Create `src/api/routes/robokassa.js` router
- [ ] 5.2 Implement `POST /api/payments/robokassa/create` - generate payment link
- [ ] 5.3 Implement `GET /api/payments/robokassa/status/:invoiceId` - payment status
- [ ] 5.4 Implement `GET /api/payments/robokassa/history/:salonId` - payment list
- [ ] 5.5 Serve `success.html` at `/payment/success`
- [ ] 5.6 **NEW:** Verify signature on success page query params (prevent XSS/fraud)
- [ ] 5.7 Serve `fail.html` at `/payment/fail`

**Acceptance:** All endpoints work with proper authentication

---

## Phase 6: Frontend Pages (0/5)

- [ ] 6.1 Create `public/payment/` directory
- [ ] 6.2 Create `success.html` - branded success page
- [ ] 6.3 Add payment details display (InvId, amount from query params)
- [ ] 6.4 Create `fail.html` - user-friendly error page
- [ ] 6.5 Add retry/support links on both pages

**Acceptance:** Pages render correctly and look professional

---

## Phase 8: Robokassa Panel Configuration (0/5)

- [ ] 8.1 Set Result URL: `https://adminai.tech/api/payments/robokassa/result`
- [ ] 8.2 Set Success URL: `https://adminai.tech/payment/success`
- [ ] 8.3 Set Fail URL: `https://adminai.tech/payment/fail`
- [ ] 8.4 Verify hash algorithm is MD5
- [ ] 8.5 Enable test mode in panel

**Acceptance:** URLs configured, test payment possible

---

## Testing & Verification (0/9)

### Basic Flow
- [ ] T.1 Generate test payment link via API
- [ ] T.2 Complete test payment with card `4111111111111111`
- [ ] T.3 Verify webhook received and processed
- [ ] T.4 Verify database record created with `status: success`
- [ ] T.5 Verify Success page displays correctly

### Security Tests (NEW!)
- [ ] T.6 **NEW:** Test invalid signature → should reject with `bad sign`
- [ ] T.7 **NEW:** Test amount mismatch → should reject with `bad sign`
- [ ] T.8 **NEW:** Test duplicate callback → should return `OK` without re-processing
- [ ] T.9 **NEW:** Test timeout scenario → should NOT return `OK`

**Acceptance:** End-to-end payment flow works in test mode, security tests pass

---

## Summary

| Phase | Tasks | Done | Status |
|-------|-------|------|--------|
| 1. Database | 4 | 4 | ✅ Complete |
| 7. Environment | 4 | 4 | ✅ Complete |
| 2. Repository | 8 | 0 | ⬜ **NEXT** |
| 3. Service | 10 | 0 | ⬜ Not Started |
| 4. Webhook | 11 | 0 | ⬜ **CRITICAL** |
| 5. API Routes | 7 | 0 | ⬜ Not Started |
| 6. Frontend | 5 | 0 | ⬜ Not Started |
| 8. Robokassa Panel | 5 | 0 | ⬜ Not Started |
| Testing | 9 | 0 | ⬜ Not Started |
| **TOTAL** | **59** | **8** | **14%** |

---

## Quick Commands

```bash
# Verify migration ran
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "PGPASSWORD='}X|oM595A<7n?0' psql -h a84c973324fdaccfc68d929d.twc1.net -U gen_user -d default_db -c '\dt robokassa*'"

# Verify env vars
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "cd /opt/ai-admin && grep ROBOKASSA .env"

# Test webhook (after deployment)
curl -X POST https://adminai.tech/api/payments/robokassa/result \
  -d "OutSum=100&InvId=123&SignatureValue=INVALID"
# Expected: 400 "bad sign"

# Check logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs ai-admin-api --lines 50 | grep -i robokassa"
```

---

## Critical Reminders

### Webhook Response Rules
1. **NEVER** respond `OK` before signature verification
2. **ALWAYS** verify amount matches DB
3. **ALWAYS** check idempotency before processing
4. **ALWAYS** use `Content-Type: text/plain`
5. **ALWAYS** use `express.urlencoded()` middleware

### Signature Rules
1. **ALWAYS** use `toUpperCase()` for comparison
2. **ALWAYS** use Password2 for Result URL verification
3. **NEVER** use Password1 for verification (that's for payment form)

### Invoice ID Rules
1. **NEVER** exceed 16 digits (JS MAX_SAFE_INTEGER issue)
2. Use `Date.now() + 3-digit-random` format

---

## Notes

- ✅ Infrastructure complete (DB + env vars)
- Next: Create Repository → Service → Webhook → API Routes
- Critical fixes from plan review are marked with **FIX** or **NEW**
- Security tests are mandatory before going to production
