# Session 9 Context - YClients Callback HTML Issue

**Date:** 2025-12-05
**Last Updated:** 2025-12-05 16:17 MSK

---

## Session Summary

### Current Issue: YClients API Returns HTML Instead of JSON

**Problem:** The YClients callback endpoint `POST /marketplace/partner/callback/redirect` intermittently returns HTML pages instead of JSON responses, causing our JSON parser to fail.

**Error in logs:**
```
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

This happened **4+ times** during testing with salon 997441.

---

## What Was Fixed This Session

### 1. syncManager.syncAll Bug (Commit fae5602)
- **Issue:** `syncManager.syncAll is not a function`
- **Fix:** Added `syncAll()` method to `src/sync/sync-manager.js`
- **Includes:** Sentry error tracking, sequential sync of all modules
- **Deployed:** Yes, to production

### 2. Database Cleanup
Multiple full cleanups of salon 997441 data from all tables.

---

## Current State of Salon 997441

### In Our Database:
```
id:                  43
yclients_id:         997441
title:               Filipp Schigartcov (test!)
integration_status:  active
whatsapp_connected:  true
whatsapp_phone:      79006464263:15
ai_enabled:          false (needs to be enabled!)
connected_at:        2025-12-05 13:09:04
```

### In YClients:
- App is installed ("Пользователь уже установил это приложение")
- **Webhook NOT registered** (Филипп confirmed: "хука нет все равно")

---

## Root Cause Analysis

### The Callback Flow:
1. WhatsApp connects successfully (QR scanned)
2. Our code calls YClients API: `POST /marketplace/partner/callback/redirect`
3. **Expected:** JSON response with success/failure
4. **Actual:** Sometimes returns HTML page (CDN/proxy/5xx error page)
5. Our JSON.parse() fails
6. Transaction rolls back
7. Webhook is NOT registered with YClients

### Why HTML Response?
Possible causes:
- YClients CDN/Cloudflare protection
- Rate limiting
- Temporary server errors (5xx)
- IPv6 routing issues

---

## Attempted Solutions

1. **Multiple retries** - Still getting HTML responses
2. **Full DB cleanup + fresh install** - Same issue
3. **Manual callback call** - Returns JSON now (after delays), but says "already installed"

---

## Next Steps (For New Session)

### Option A: Fix on Our Side (Recommended)
Add retry logic with HTML detection:
```javascript
// In src/api/routes/yclients-marketplace.js around line 811-834
// When yclientsResponse.json() fails with HTML:
// 1. Log the HTML response for debugging
// 2. Retry after 2-3 seconds delay
// 3. Max 3 retries
// 4. If all fail, still save company but mark as "webhook_pending"
```

### Option B: Workaround
1. Ask Филипп to manually add webhook in YClients settings
2. Webhook URL: `https://adminai.tech/webhook/yclients`

### Option C: YClients Fix
Ask YClients team to investigate why their API returns HTML sometimes.

---

## Files Modified This Session

| File | Change |
|------|--------|
| `src/sync/sync-manager.js` | Added `syncAll()` method + Sentry import |
| `dev/active/marketplace-registration-review/SESSION-8-CONTEXT.md` | Updated with cleanup status |

---

## Commands to Resume

```bash
# Check salon 997441 status
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && psql 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require' -c \"SELECT id, yclients_id, integration_status, whatsapp_connected, whatsapp_phone, ai_enabled FROM companies WHERE yclients_id = 997441;\""

# Check recent logs for 997441
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-api --lines 100 --nostream | grep -E '997441|activation|callback|DOCTYPE'"

# Test YClients callback manually
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "curl -s -X POST 'https://api.yclients.com/marketplace/partner/callback/redirect' \
  -H 'Authorization: Bearer cfjbs9dpuseefh8ed5cp' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/vnd.yclients.v2+json' \
  -d '{\"salon_id\": 997441, \"application_id\": 18289, \"api_key\": \"test\", \"webhook_urls\": [\"https://adminai.tech/webhook/yclients\"]}'"

# Full cleanup if needed
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && psql 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require' << 'EOF'
DELETE FROM whatsapp_keys WHERE company_id = 'company_997441';
DELETE FROM whatsapp_auth WHERE company_id = 'company_997441';
DELETE FROM companies WHERE yclients_id = 997441;
EOF"
```

---

## Session Commits

| Commit | Description |
|--------|-------------|
| fae5602 | fix(sync): add syncAll method for onboarding |

---

## Key Contacts

**YClients Moderator:** Филипп Щигарцов
- Testing onboarding flow
- Confirmed webhook not appearing in salon settings
- Asked for example of HTML response issue

---

## Conversation Summary for Филипп

**Проблема:** При подключении WhatsApp наш callback в YClients API (`/marketplace/partner/callback/redirect`) иногда получает HTML страницу вместо JSON ответа.

**Результат:** WhatsApp подключается успешно, но webhook не регистрируется в настройках филиала.

**Варианты решения:**
1. Мы добавим retry logic на нашей стороне
2. Филипп проверит почему API возвращает HTML
3. Временно: добавить webhook вручную `https://adminai.tech/webhook/yclients`
