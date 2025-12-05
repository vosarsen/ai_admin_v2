# Session 7 Context - Marketplace Registration Testing

**Date:** 2025-12-05
**Last Updated:** 2025-12-05 14:30 MSK

---

## Session Summary

### What We Did

1. **Reviewed Session 6 results** - QR + Pairing Code both working (commits 3db9ecc, f4ea16b)
2. **Live tested with YClients moderator** using salon 997441
3. **Discovered critical issue** - YClients activation fails with "Агрегатор не найден"

---

## Key Discovery: YClients Activation Error

### The Problem

WhatsApp connection works perfectly, but YClients callback fails:

```
✅ WhatsApp connected for company company_997441
✅ WhatsApp подключен! phone: 79006464263:13
🚀 Starting integration activation
🔒 Advisory lock acquired
📤 Sending callback to YClients
❌ YClients activation failed: 400 {"success":false,"data":null,"meta":{"message":"Агрегатор не найден"}}
```

### The Request That Fails

**Endpoint:**
```
POST https://api.yclients.com/marketplace/partner/callback/redirect
```

**Headers:**
```
Authorization: Bearer ${PARTNER_TOKEN}
Content-Type: application/json
Accept: application/vnd.yclients.v2+json
```

**Body:**
```json
{
  "salon_id": 997441,
  "application_id": 18289,
  "api_key": "<generated>",
  "webhook_urls": ["https://adminai.tech/webhook/yclients"]
}
```

### Root Cause (Probable)

"Агрегатор не найден" = YClients doesn't recognize application_id 18289 for salon 997441

Possible reasons:
1. Marketplace app not installed for test salon 997441
2. PARTNER_TOKEN doesn't have rights to this app
3. Test salon not in correct mode/status
4. Application ID mismatch in YClients admin

---

## Database State

### Companies Table (2 rows)

| company_id | title | whatsapp_connected | whatsapp_phone | integration_status |
|------------|-------|-------------------|----------------|-------------------|
| 997441 | Filipp Schigartcov (test!) | false | null | pending_whatsapp |
| 962302 | KULTURA Малаховка | true | 79686484488:35 | active |

**Note:** After session, 997441 briefly connected WhatsApp but activation failed.

---

## What Works

1. **QR Code flow** - Fully working
2. **Pairing Code flow** - Working (fixed in Session 6)
3. **WhatsApp connection** - Connects successfully
4. **Session management** - Credentials saved to PostgreSQL
5. **Event emission** - Messages upsert events fire

## What Doesn't Work

1. **YClients activation callback** - Returns 400 "Агрегатор не найден"
2. **Integration status update** - Never reaches "active" due to callback failure

---

## Files Involved

**Activation code location:**
- `src/api/routes/yclients-marketplace.js:800-830` - Callback sending logic
- Error thrown at line 831

**Code snippet:**
```javascript
const callbackData = {
  salon_id: salonId,
  application_id: parseInt(APP_ID),  // 18289
  api_key: apiKey,
  webhook_urls: [`${BASE_URL}/webhook/yclients`]
};

const yclientsResponse = await fetch(
  'https://api.yclients.com/marketplace/partner/callback/redirect',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PARTNER_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.yclients.v2+json'
    },
    body: JSON.stringify(callbackData)
  }
);
```

---

## Action Items for Next Session

### For YClients Team

1. Verify application 18289 is properly registered
2. Check if salon 997441 has access to marketplace app
3. Confirm PARTNER_TOKEN has correct permissions

### For Development

1. Add better error handling for activation failures
2. Consider allowing partial success (WhatsApp connected, YClients pending)
3. Add Sentry tracking for activation failures

---

## Session Commits

| Commit | Description |
|--------|-------------|
| (none this session) | Only log monitoring, no code changes |

---

## Environment Notes

- **Server:** 46.149.70.219
- **WhatsApp service:** baileys-whatsapp-service (online)
- **Test phone for 997441:** 79006464263
- **Test phone for 962302:** 79686484488

---

## How to Continue

1. Wait for YClients moderator to verify marketplace app setup
2. If app is correctly configured, investigate PARTNER_TOKEN permissions
3. Consider moving project to completed once YClients issue resolved (our code works)

---

## Log Evidence

```
11:28:22 - ✅ Loaded existing credentials for company_997441
11:28:22 - ✅ Session created for company company_997441
11:28:24 - ✅ WhatsApp connected for company company_997441 (phone: 79006464263:13)
11:28:24 - 🚀 Starting integration activation
11:28:24 - 🔒 Advisory lock acquired
11:28:24 - 📤 Sending callback to YClients (salon_id: 997441, application_id: 18289)
11:28:24 - ❌ YClients activation failed: 400 "Агрегатор не найден"
```
