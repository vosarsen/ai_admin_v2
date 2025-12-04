# Robokassa Integration - Tasks

**Last Updated:** 2025-12-04
**Overall Progress:** 0/34 tasks (0%)

---

## Phase 1: Database Schema (0/4)

- [ ] 1.1 Create migration file `migrations/20251204_create_robokassa_payments.sql`
- [ ] 1.2 Define table schema with all columns
- [ ] 1.3 Add indexes on `salon_id`, `status`, `invoice_id`
- [ ] 1.4 Run migration on Timeweb PostgreSQL server

**Acceptance:** Table `robokassa_payments` exists with correct structure

---

## Phase 2: Repository Layer (0/7)

- [ ] 2.1 Create `src/repositories/RobokassaPaymentRepository.js`
- [ ] 2.2 Implement `insert(data)` method
- [ ] 2.3 Implement `findByInvoiceId(invoiceId)` method
- [ ] 2.4 Implement `updateStatus(invoiceId, status, extra)` method
- [ ] 2.5 Implement `getNextInvoiceId()` method (timestamp + random)
- [ ] 2.6 Implement `findBySalonId(salonId, options)` method
- [ ] 2.7 Export from `src/repositories/index.js`

**Acceptance:** All methods work, can create and query payments

---

## Phase 3: Service Layer (0/7)

- [ ] 3.1 Create `src/services/payment/robokassa-service.js`
- [ ] 3.2 Implement `buildPaymentSignature(outSum, invId)` - MD5(Login:Sum:InvId:Pass1)
- [ ] 3.3 Implement `verifyResultSignature(outSum, invId, signature)` - MD5(Sum:InvId:Pass2)
- [ ] 3.4 Implement `generatePaymentUrl(salonId, amount, options)` - full URL with signature
- [ ] 3.5 Implement `processPayment(params)` - handles successful callback
- [ ] 3.6 Implement `buildReceipt(amount, description)` - 54-FZ compliant
- [ ] 3.7 Add Sentry error tracking to all methods

**Acceptance:** Can generate valid payment URLs and verify signatures

---

## Phase 4: Webhook Handler (0/8)

- [ ] 4.1 Create `src/api/webhooks/robokassa.js` router
- [ ] 4.2 Implement `/result` endpoint (handles both GET and POST)
- [ ] 4.3 Add parameter validation (OutSum, InvId, SignatureValue required)
- [ ] 4.4 Add MD5 signature verification
- [ ] 4.5 Call `processPayment()` service method
- [ ] 4.6 Return exact `OK{InvId}` response format
- [ ] 4.7 Add `/health` check endpoint
- [ ] 4.8 Register router in `src/index.js`

**Acceptance:** Webhook receives callbacks and responds correctly

---

## Phase 5: API Routes (0/6)

- [ ] 5.1 Create `src/api/routes/robokassa.js` router
- [ ] 5.2 Implement `POST /api/payments/robokassa/create` - generate payment link
- [ ] 5.3 Implement `GET /api/payments/robokassa/status/:invoiceId` - payment status
- [ ] 5.4 Implement `GET /api/payments/robokassa/history/:salonId` - payment list
- [ ] 5.5 Serve `success.html` at `/payment/success`
- [ ] 5.6 Serve `fail.html` at `/payment/fail`

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

## Phase 7: Environment Setup (0/4)

- [ ] 7.1 Get Password #1 from Robokassa panel
- [ ] 7.2 Get Password #2 from Robokassa panel
- [ ] 7.3 Add env vars to server `.env` (ROBOKASSA_MERCHANT_LOGIN, PASSWORD_1, PASSWORD_2, TEST_MODE)
- [ ] 7.4 Restart PM2 services to load new config

**Acceptance:** Service reads credentials correctly

---

## Phase 8: Robokassa Panel Configuration (0/5)

- [ ] 8.1 Set Result URL: `https://adminai.tech/api/payments/robokassa/result`
- [ ] 8.2 Set Success URL: `https://adminai.tech/payment/success`
- [ ] 8.3 Set Fail URL: `https://adminai.tech/payment/fail`
- [ ] 8.4 Verify hash algorithm is MD5
- [ ] 8.5 Enable test mode in panel

**Acceptance:** URLs configured, test payment possible

---

## Testing & Verification (0/5)

- [ ] T.1 Generate test payment link via API
- [ ] T.2 Complete test payment with card `4111111111111111`
- [ ] T.3 Verify webhook received and processed
- [ ] T.4 Verify database record created with `status: success`
- [ ] T.5 Verify Success page displays correctly

**Acceptance:** End-to-end payment flow works in test mode

---

## Summary

| Phase | Tasks | Done | Status |
|-------|-------|------|--------|
| 1. Database | 4 | 0 | ⬜ Not Started |
| 2. Repository | 7 | 0 | ⬜ Not Started |
| 3. Service | 7 | 0 | ⬜ Not Started |
| 4. Webhook | 8 | 0 | ⬜ Not Started |
| 5. API Routes | 6 | 0 | ⬜ Not Started |
| 6. Frontend | 5 | 0 | ⬜ Not Started |
| 7. Environment | 4 | 0 | ⬜ Not Started |
| 8. Robokassa Panel | 5 | 0 | ⬜ Not Started |
| Testing | 5 | 0 | ⬜ Not Started |
| **TOTAL** | **51** | **0** | **0%** |

---

## Quick Commands

```bash
# Run migration
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "cd /opt/ai-admin && psql \$DATABASE_URL -f migrations/20251204_create_robokassa_payments.sql"

# Test webhook locally
curl -X POST http://localhost:3000/api/payments/robokassa/result \
  -d "OutSum=100&InvId=123&SignatureValue=ABC123"

# Check logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs ai-admin-api --lines 50 | grep -i robokassa"

# Generate payment link
curl -X POST https://adminai.tech/api/payments/robokassa/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"salon_id": 962302, "amount": 100}'
```

---

## Notes

- Start with Phase 1-3 (backend infrastructure)
- Phase 6 (frontend) can be done in parallel
- Phase 7-8 require access to server and Robokassa panel
- Testing is the final validation step
