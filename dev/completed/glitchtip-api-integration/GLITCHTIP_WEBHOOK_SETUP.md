# GlitchTip Webhook Configuration Guide

## 📋 Step-by-Step Setup

### 1. Access GlitchTip UI

```bash
# Ensure SSH tunnel is active
ssh -i ~/.ssh/id_ed25519_ai_admin -L 9090:localhost:8080 -N -f root@46.149.70.219

# Open in browser
open http://localhost:9090
```

**Login credentials:**
- Email: `support@adminai.tech`
- Password: `AdminSecure2025`

### 2. Navigate to Organization Settings

1. Click on **"Admin AI"** organization (top left)
2. Click **"Settings"** in sidebar
3. Select **"Webhooks"** tab

### 3. Create New Webhook

Click **"Add Webhook"** button and configure:

**Webhook Settings:**
```
Name: Telegram Alerts
URL: http://localhost:3000/api/webhooks/glitchtip
Events:
  ☑ Issue Created (issue.created)
  ☑ Issue Reopened (issue.reopened)
  ☐ Issue Resolved (not needed)
  ☐ Issue Archived (not needed)
Active: ☑ Yes
```

### 4. Test Webhook

After saving, GlitchTip should show a **"Send Test Payload"** button.

**Click it** to test:
- GlitchTip sends test payload to webhook
- Webhook processes and sends Telegram alert
- Check Telegram bot for test message

**Expected Telegram message:**
```
🔴 НОВАЯ ОШИБКА

**Test Issue from GlitchTip**

• ID: `123`
• Уровень: error
• Компонент: test
• Счётчик: 1
...
```

### 5. Verify Webhook Status

After test:
1. Check webhook status in GlitchTip (should show green checkmark)
2. View delivery logs (if available)
3. Check API server logs:
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-api --lines 50 | grep glitchtip"
   ```

### 6. Test with Real Error

Create a test error to verify end-to-end:

```bash
# Option 1: Use test script
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node -e \"
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });
Sentry.captureException(new Error('Test error for webhook verification'));
setTimeout(() => process.exit(0), 2000);
\""

# Option 2: Manually create in GlitchTip UI
# Projects → Select Project → Click "Create Test Issue"
```

**Expected flow:**
1. Error captured by Sentry/GlitchTip (~2-5 seconds)
2. GlitchTip fires webhook to our API (~1 second)
3. Webhook processes and sends Telegram alert (~1 second)
4. You receive Telegram notification (~1 second)
5. **Total:** ~5-8 seconds from error to notification

### 7. Troubleshooting

**Webhook not firing:**
```bash
# Check GlitchTip logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker compose logs web | tail -100 | grep webhook"

# Check API server logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-api --err --lines 100"

# Test webhook endpoint directly
curl -X POST http://localhost:3000/api/webhooks/glitchtip \
  -H "Content-Type: application/json" \
  -d '{
    "action": "created",
    "data": {
      "issue": {
        "id": "999",
        "title": "Manual test issue",
        "level": "error",
        "culprit": "test.js",
        "count": 1,
        "firstSeen": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "lastSeen": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "tags": {}
      }
    }
  }'
```

**Telegram alert not received:**
```bash
# Verify Telegram bot token
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && grep TELEGRAM_BOT_TOKEN .env.production"

# Test Telegram API directly
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"601999","text":"Test from webhook setup"}'
```

**Webhook returns 500 error:**
- Check API server logs for stack trace
- Verify all dependencies installed (`npm list @sentry/node axios`)
- Check Sentry integration (errors should be captured)

### 8. Health Check

Verify webhook is healthy:

```bash
curl http://localhost:3000/api/webhooks/glitchtip/health | jq
```

**Expected output:**
```json
{
  "status": "healthy",
  "config": {
    "telegramConfigured": true,
    "chatIdConfigured": true,
    "glitchtipUrl": "http://localhost:8080"
  }
}
```

---

## 🎯 Success Criteria

✅ Webhook configured in GlitchTip UI
✅ Test payload sends Telegram alert
✅ Real errors trigger Telegram notifications
✅ Webhook status shows green (healthy)
✅ Telegram messages contain:
   - Error title and details
   - Stack trace (first 500 chars)
   - Tags and component
   - Quick action commands
   - GlitchTip link

---

## 📊 Expected Performance

- **Latency:** 5-8 seconds (error → Telegram notification)
- **Reliability:** 99%+ (retry logic in webhook)
- **Volume:** Up to 100 errors/hour (no rate limiting)

---

**Last Updated:** 2025-11-24
**Version:** 1.0
**Author:** Claude Code
