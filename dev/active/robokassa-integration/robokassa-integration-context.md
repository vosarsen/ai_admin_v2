# Robokassa Integration - Context

**Last Updated:** 2025-12-04 20:45 MSK
**Current Phase:** Phase 2 - Repository Layer (NEXT)
**Review Status:** ✅ APPROVED WITH REQUIRED CHANGES
**Session:** 1 - Infrastructure Complete

---

## Session 1 Summary (2025-12-04)

### Completed This Session
1. ✅ Created comprehensive plan from Robokassa screenshot
2. ✅ Ran plan through `plan-reviewer` agent - found 4 critical issues
3. ✅ Incorporated all critical fixes into plan
4. ✅ Created database migration
5. ✅ Ran migration on Timeweb PostgreSQL (table created)
6. ✅ Added Robokassa credentials to server .env
7. ✅ Committed and pushed changes to git

### Infrastructure Status
- **Database:** `robokassa_payments` table created ✅
- **Credentials:** Added to server .env ✅
- **PM2 Restart:** Pending (after code deployment)

### Critical Fixes from Plan Review

| # | Issue | Fix Applied |
|---|-------|-------------|
| 1 | Webhook responded BEFORE verification | Respond `OK{InvId}` only AFTER all checks |
| 2 | No amount verification | Compare OutSum with DB amount |
| 3 | No idempotency check | Check if already processed before re-processing |
| 4 | No urlencoded middleware | Use `express.urlencoded()` for form data |

---

## Next Steps (Start Here on Resume)

### Immediate Action: Create Repository

**File to create:** `src/repositories/RobokassaPaymentRepository.js`

**Pattern to follow:** `src/repositories/BaseRepository.js`

**Key methods needed:**
```javascript
class RobokassaPaymentRepository extends BaseRepository {
  // Create new payment record
  async insert(data) { ... }

  // Find by invoice ID (for Result URL)
  async findByInvoiceId(invoiceId) { ... }

  // Find with row lock for transaction (critical!)
  async findByInvoiceIdForUpdate(invoiceId, client) { ... }

  // Update status after payment confirmation
  async updateStatus(invoiceId, status, extra) { ... }

  // Generate unique invoice ID (16-digit max!)
  getNextInvoiceId() { ... }

  // Get payment history for salon
  async findBySalonId(salonId, options) { ... }
}
```

**After repository:** Add export to `src/repositories/index.js`

---

## Robokassa Credentials

```
Merchant Login: AdminAI
Password #1: hyEqH3K5t9kAIk10sSXA (for payment form signature)
Password #2: Y8NP8t2UI5EwGLIy3oGS (for Result URL verification)
Test Mode: true
```

**Signature Formulas:**
```javascript
// Payment Form: MD5(Login:Sum:InvId:Pass1).toUpperCase()
// Result URL:   MD5(Sum:InvId:Pass2).toUpperCase()
```

---

## Key Files

### Created This Session
- `migrations/20251204_create_robokassa_payments.sql` ✅
- `dev/active/robokassa-integration/robokassa-integration-plan.md` ✅
- `dev/active/robokassa-integration/robokassa-integration-context.md` ✅
- `dev/active/robokassa-integration/robokassa-integration-tasks.md` ✅

### Existing References
- `src/config/robokassa-config.js` - Config with merchant info, fiscal settings (180 lines)
- `src/repositories/BaseRepository.js` - Base class with transaction support
- `src/api/webhooks/yclients.js` - Webhook pattern reference

### To Create
- `src/repositories/RobokassaPaymentRepository.js` (~150 lines)
- `src/services/payment/robokassa-service.js` (~350 lines)
- `src/api/webhooks/robokassa.js` (~250 lines)
- `src/api/routes/robokassa.js` (~250 lines)
- `public/payment/success.html` (~150 lines)
- `public/payment/fail.html` (~150 lines)

---

## Critical Implementation Notes

### 1. Webhook Response Pattern (CORRECT)
```javascript
router.post('/result', limiter, async (req, res) => {
  const { OutSum, InvId, SignatureValue } = req.body;

  // 1. FIRST: Verify signature
  if (!verifySignature(OutSum, InvId, SignatureValue)) {
    return res.status(400).send('bad sign');
  }

  // 2. Find payment and verify amount
  const payment = await repository.findByInvoiceId(InvId);
  if (!payment) return res.status(400).send('bad sign');

  // 3. Verify amount matches (prevent fraud!)
  if (Math.abs(payment.amount - parseFloat(OutSum)) > 0.01) {
    return res.status(400).send('bad sign');
  }

  // 4. Idempotency check
  if (payment.status === 'success') {
    res.setHeader('Content-Type', 'text/plain');
    return res.send(`OK${InvId}`);
  }

  // 5. Process with timeout
  await processPaymentWithTimeout(InvId, OutSum, SignatureValue);

  // 6. LAST: Return OK
  res.setHeader('Content-Type', 'text/plain');
  res.send(`OK${InvId}`);
});
```

### 2. Invoice ID Format (16-digit max)
```javascript
getNextInvoiceId() {
  const timestamp = Date.now(); // 13 digits
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return parseInt(`${timestamp}${random}`); // 16 digits max
}
```

### 3. Transaction in processPayment
```javascript
async processPayment(invId, outSum, signatureValue) {
  return this.repository.withTransaction(async (client) => {
    const payment = await client.query(
      'SELECT * FROM robokassa_payments WHERE invoice_id = $1 FOR UPDATE',
      [invId]
    );
    // ... update status
  });
}
```

---

## Quick Verification Commands

```bash
# Verify table exists
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "PGPASSWORD='}X|oM595A<7n?0' psql -h a84c973324fdaccfc68d929d.twc1.net -U gen_user -d default_db -c '\dt robokassa*'"

# Verify credentials
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "cd /opt/ai-admin && grep ROBOKASSA .env"

# Check git status
git log --oneline -3
```

---

## Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Database | ✅ Complete | Migration ran successfully |
| 7. Environment | ✅ Complete | Credentials in .env |
| 2. Repository | ⬜ Next | Create RobokassaPaymentRepository |
| 3. Service | ⬜ Pending | After repository |
| 4. Webhook | ⬜ Pending | Critical fixes ready |
| 5. API Routes | ⬜ Pending | |
| 6. Frontend | ⬜ Pending | Can parallelize |
| 8. Robokassa Panel | ⬜ Pending | After deployment |

**Overall:** 14% complete (8/59 tasks)

---

## Robokassa Panel URLs (To Configure)

After deployment, configure in Robokassa panel:
- **Result URL:** `https://adminai.tech/api/payments/robokassa/result`
- **Success URL:** `https://adminai.tech/payment/success`
- **Fail URL:** `https://adminai.tech/payment/fail`

---

## Test Card

For testing payments:
- **Number:** `4111111111111111`
- **Expiry:** Any future date
- **CVV:** Any 3 digits
