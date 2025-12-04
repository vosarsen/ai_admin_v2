# Robokassa Integration - Tasks

**Last Updated:** 2025-12-04 21:15 MSK
**Overall Progress:** 54/59 tasks (92%)
**Session:** 2 - Ready for Testing

---

## Phase 1: Database Schema (4/4) ✅ COMPLETE

- [x] 1.1 Create migration file
- [x] 1.2 Define table schema
- [x] 1.3 Add indexes
- [x] 1.4 Run migration on server

---

## Phase 2: Repository Layer (8/8) ✅ COMPLETE

- [x] 2.1 Create `RobokassaPaymentRepository.js`
- [x] 2.2 Implement `insert(data)`
- [x] 2.3 Implement `findByInvoiceId(invoiceId)`
- [x] 2.4 Implement `findByInvoiceIdForUpdate(invoiceId, client)` - SELECT FOR UPDATE
- [x] 2.5 Implement `updateStatus(invoiceId, status, extra)`
- [x] 2.6 Implement `getNextInvoiceId()` - 16-digit max
- [x] 2.7 Implement `findBySalonId(salonId, options)`
- [x] 2.8 Export from `index.js`

---

## Phase 3: Service Layer (10/10) ✅ COMPLETE

- [x] 3.1 Create `robokassa-service.js`
- [x] 3.2 Implement `buildPaymentSignature()` - MD5 toUpperCase
- [x] 3.3 Implement `verifyResultSignature()` - MD5 toUpperCase
- [x] 3.4 Implement `generatePaymentUrl()`
- [x] 3.5 Implement `processPayment()` - with TRANSACTION
- [x] 3.6 Implement `verifyAmount()` - fraud prevention
- [x] 3.7 Implement `processPaymentWithTimeout()` - 25s timeout
- [x] 3.8 Implement `buildReceipt()` - 54-FZ
- [x] 3.9 Add Sentry error tracking
- [x] 3.10 Add test mode warning

---

## Phase 4: Webhook Handler (11/11) ✅ COMPLETE

- [x] 4.1 Create router with urlencoded middleware
- [x] 4.2 Add rate limiter
- [x] 4.3 Implement `/result` POST
- [x] 4.4 Implement `/result` GET
- [x] 4.5 Verify signature FIRST
- [x] 4.6 Verify amount matches DB
- [x] 4.7 Check idempotency
- [x] 4.8 Call processPaymentWithTimeout()
- [x] 4.9 Return `OK{InvId}` with text/plain
- [x] 4.10 Add `/health` endpoint
- [x] 4.11 Register in index.js

---

## Phase 5: API Routes (7/7) ✅ COMPLETE

- [x] 5.1 Create routes file
- [x] 5.2 POST /create
- [x] 5.3 GET /status/:invoiceId
- [x] 5.4 GET /history/:salonId
- [x] 5.5 GET /payment/success
- [x] 5.6 GET /config
- [x] 5.7 GET /payment/fail

---

## Phase 6: Frontend Pages (5/5) ✅ COMPLETE

- [x] 6.1 Create public/payment/ directory
- [x] 6.2 Create success.html
- [x] 6.3 Add payment details display
- [x] 6.4 Create fail.html
- [x] 6.5 Add retry/support links

---

## Phase 7: Environment Setup (4/4) ✅ COMPLETE

- [x] 7.1 Get Password #1
- [x] 7.2 Get Password #2
- [x] 7.3 Add env vars to server
- [x] 7.4 Restart PM2 (done with --update-env)

**Note:** Server now uses TEST passwords. Production passwords saved in context.md

---

## Phase 8: Robokassa Panel Configuration (5/5) ✅ COMPLETE

- [x] 8.1 Set Result URL (POST method)
- [x] 8.2 Set Success URL (GET method)
- [x] 8.3 Set Fail URL (GET method)
- [x] 8.4 Set hash algorithm to MD5 (both test and prod)
- [x] 8.5 Configure test mode passwords

---

## Phase 9: Testing & Verification (0/5) ⬜ NEXT

### Basic Flow
- [ ] T.1 Generate test payment link via API
- [ ] T.2 Complete test payment with card `4111111111111111`
- [ ] T.3 Verify webhook received and processed
- [ ] T.4 Verify database record created with `status: success`
- [ ] T.5 Verify Success page displays correctly

### Security Tests (optional but recommended)
- [ ] T.6 Test invalid signature → should reject
- [ ] T.7 Test amount mismatch → should reject
- [ ] T.8 Test duplicate callback → should return OK without re-processing
- [ ] T.9 Test timeout scenario

---

## Summary

| Phase | Tasks | Done | Status |
|-------|-------|------|--------|
| 1. Database | 4 | 4 | ✅ |
| 2. Repository | 8 | 8 | ✅ |
| 3. Service | 10 | 10 | ✅ |
| 4. Webhook | 11 | 11 | ✅ |
| 5. API Routes | 7 | 7 | ✅ |
| 6. Frontend | 5 | 5 | ✅ |
| 7. Environment | 4 | 4 | ✅ |
| 8. Robokassa Panel | 5 | 5 | ✅ |
| 9. Testing | 5 | 0 | ⬜ **NEXT** |
| **TOTAL** | **59** | **54** | **92%** |

---

## Quick Test Command

```bash
# Create test payment and get URL
curl -X POST https://adminai.tech/api/payments/robokassa/create \
  -H "Content-Type: application/json" \
  -d '{"salon_id": 962302, "amount": 100, "description": "Test payment"}'
```

---

## Switch to Production (after testing)

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && \
  sed -i 's/d28GWMrIuLClJ99M8TJk/hyEqH3K5t9kAIk10sSXA/' .env && \
  sed -i 's/s4ZOHV8I31j1fPPkBSGu/Y8NP8t2UI5EwGLIy3oGS/' .env && \
  sed -i 's/ROBOKASSA_TEST_MODE=true/ROBOKASSA_TEST_MODE=false/' .env && \
  pm2 restart ai-admin-api --update-env"
```
