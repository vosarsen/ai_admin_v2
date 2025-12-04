# Robokassa Integration - Context

**Last Updated:** 2025-12-04 21:15 MSK
**Current Phase:** Testing - Ready for first test payment
**Session:** 2 - Code Complete, Deployed, Configured

---

## Session 2 Summary (2025-12-04)

### Completed This Session
1. ✅ Created RobokassaPaymentRepository (~320 lines)
2. ✅ Created robokassa-service.js (~380 lines)
3. ✅ Created webhook handler with security checks (~200 lines)
4. ✅ Created API routes (~270 lines)
5. ✅ Created success/fail HTML pages (~340 lines)
6. ✅ Registered routes in src/api/index.js
7. ✅ Committed and pushed to git (commit: c0ea6cc)
8. ✅ Deployed to server
9. ✅ Updated server .env with TEST passwords
10. ✅ Verified all endpoints working

### Key Decision: Test vs Production Passwords

**IMPORTANT:** Robokassa uses DIFFERENT passwords for test and production!

**Current Server Config (TEST MODE):**
```bash
ROBOKASSA_MERCHANT_LOGIN=AdminAI
ROBOKASSA_PASSWORD_1=d28GWMrIuLClJ99M8TJk  # TEST
ROBOKASSA_PASSWORD_2=s4ZOHV8I31j1fPPkBSGu  # TEST
ROBOKASSA_TEST_MODE=true
```

**Production Passwords (save for later):**
```bash
ROBOKASSA_PASSWORD_1=hyEqH3K5t9kAIk10sSXA  # PROD
ROBOKASSA_PASSWORD_2=Y8NP8t2UI5EwGLIy3oGS  # PROD
```

### Robokassa Panel Configuration (DONE)

All configured in Robokassa panel:
- ✅ Алгоритм хеша: MD5 (both test and prod)
- ✅ Result URL: https://adminai.tech/api/payments/robokassa/result
- ✅ Result URL Method: **POST** (changed from GET)
- ✅ Success URL: https://adminai.tech/payment/success (GET)
- ✅ Fail URL: https://adminai.tech/payment/fail (GET)
- ✅ Test passwords configured

---

## Next Steps (Start Here on Resume)

### IMMEDIATE: Test Payment

```bash
# 1. Create test payment
curl -X POST https://adminai.tech/api/payments/robokassa/create \
  -H "Content-Type: application/json" \
  -d '{"salon_id": 962302, "amount": 100, "description": "Test payment"}'

# 2. Open returned URL in browser
# 3. Pay with test card: 4111 1111 1111 1111 (any expiry, any CVV)
# 4. Verify redirect to success page
# 5. Check webhook was processed:
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs ai-admin-api --lines 50 | grep -i robokassa"

# 6. Check database for payment record:
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "PGPASSWORD='}X|oM595A<7n?0' psql -h a84c973324fdaccfc68d929d.twc1.net -U gen_user -d default_db -c 'SELECT * FROM robokassa_payments ORDER BY created_at DESC LIMIT 5'"
```

### After Testing: Switch to Production

```bash
# Update passwords on server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && \
  sed -i 's/ROBOKASSA_PASSWORD_1=d28GWMrIuLClJ99M8TJk/ROBOKASSA_PASSWORD_1=hyEqH3K5t9kAIk10sSXA/' .env && \
  sed -i 's/ROBOKASSA_PASSWORD_2=s4ZOHV8I31j1fPPkBSGu/ROBOKASSA_PASSWORD_2=Y8NP8t2UI5EwGLIy3oGS/' .env && \
  sed -i 's/ROBOKASSA_TEST_MODE=true/ROBOKASSA_TEST_MODE=false/' .env && \
  pm2 restart ai-admin-api --update-env"
```

---

## API Endpoints (All Working)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/api/payments/robokassa/create` | Generate payment URL | ✅ |
| GET | `/api/payments/robokassa/status/:invoiceId` | Payment status | ✅ |
| GET | `/api/payments/robokassa/history/:salonId` | Payment history | ✅ |
| GET | `/api/payments/robokassa/config` | Config status | ✅ |
| POST | `/api/payments/robokassa/result` | Webhook (Robokassa) | ✅ |
| GET | `/api/payments/robokassa/health` | Health check | ✅ |
| GET | `/payment/success` | Success page | ✅ |
| GET | `/payment/fail` | Fail page | ✅ |

---

## Files Created/Modified

### New Files
- `src/repositories/RobokassaPaymentRepository.js` - Data access
- `src/services/payment/robokassa-service.js` - Business logic
- `src/api/webhooks/robokassa.js` - Webhook handler
- `src/api/routes/robokassa.js` - API endpoints
- `public/payment/success.html` - Success page
- `public/payment/fail.html` - Fail page

### Modified Files
- `src/repositories/index.js` - Added export
- `src/api/index.js` - Registered routes

### Existing (unchanged)
- `src/config/robokassa-config.js` - Config
- `migrations/20251204_create_robokassa_payments.sql` - DB schema

---

## Security Implementation (All Critical Fixes Done)

1. ✅ Signature verification FIRST (before any DB operations)
2. ✅ Amount verification (compare OutSum with DB amount)
3. ✅ Idempotency check (return OK for already processed)
4. ✅ 25s timeout wrapper (Robokassa expects response < 30s)
5. ✅ express.urlencoded() for form data
6. ✅ MD5 with toUpperCase()
7. ✅ Password2 for Result URL verification
8. ✅ Transaction with SELECT FOR UPDATE

---

## Progress Summary

| Phase | Status |
|-------|--------|
| 1. Database Schema | ✅ Complete |
| 2. Repository | ✅ Complete |
| 3. Service | ✅ Complete |
| 4. Webhook | ✅ Complete |
| 5. API Routes | ✅ Complete |
| 6. Frontend Pages | ✅ Complete |
| 7. Environment | ✅ Complete |
| 8. Robokassa Panel | ✅ Complete |
| 9. Testing | ⬜ Ready to test |

**Overall:** 90% complete - Ready for test payment!

---

## Test Card

- **Number:** `4111 1111 1111 1111`
- **Expiry:** Any future date
- **CVV:** Any 3 digits
