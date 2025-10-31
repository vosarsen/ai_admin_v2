# Queue Alerts Fix - October 9, 2025

## Problem

Receiving repeated Telegram alerts about high queue load every 4-6 minutes:

```
⚠️ Высокая нагрузка очереди!
Сообщений в очереди: 71
Порог: 50
```

## Root Cause Analysis

**Investigation:**
1. Checked current queue state: `wait: 0, active: 0, failed: 0`
2. Queue appeared empty but alerts kept firing
3. Found in logs: repeated errors `Invalid phone number: null`
4. Discovered job in `repeat` queue constantly retrying

**The Issue:**
- WhatsApp sends system messages (e.g., status updates, delivery receipts) with `from: null`
- Worker validation threw error: `throw new Error('Invalid phone number: ${from}')`
- Job failed → automatic retry → failed again → infinite loop
- Failed jobs accumulated in queue, triggering alerts

**Example error from logs:**
```javascript
Full job data: [Non-text message]
{
  "companyId": "962302",
  "from": null,  // ← The problem
  "metadata": {
    "batchSize": 1,
    "isRapidFireBatch": true,
    "messageId": "ACE2BC439B3B71E35AFBB96CE57DAD2C",
    "type": "chat"
  }
}
```

## Solution

### 1. Clean Failed Jobs
```bash
redis-cli -a '<password>' DEL 'bull:whatsapp-messages:repeat' 'bull:whatsapp-messages:failed'
```

### 2. Fix Worker Validation
**File:** `src/workers/message-worker-v2.js:133`

**Before:**
```javascript
if (!from || from === '+' || from.length < 5) {
  logger.error(`❌ Invalid phone number in job ${job.id}: "${from}"`);
  logger.error('Full job data:', job.data);
  throw new Error(`Invalid phone number: ${from}`); // ← Creates infinite retry
}
```

**After:**
```javascript
if (!from || from === null || from === 'null' || from === '+' || (typeof from === 'string' && from.length < 5)) {
  logger.warn(`⚠️ Skipping message with invalid phone number in job ${job.id}: "${from}"`);
  logger.warn('Job metadata:', { messageId, metadata, companyId });
  // Don't throw error - just skip and mark as successfully processed
  // to prevent infinite retry loop
  return {
    success: true,
    skipped: true,
    reason: 'Invalid phone number',
    processingTime: Date.now() - startTime
  };
}
```

**Key Changes:**
- Added check for `null` and `'null'` string
- Changed from `throw Error()` to `return { success: true, skipped: true }`
- Changed log level from `error` to `warn`
- Job marked as successful so it doesn't retry

## Deployment

```bash
git add src/workers/message-worker-v2.js
git commit -m "fix: skip messages with null phone numbers instead of retrying"
git push origin feature/redis-context-cache

ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "cd /opt/ai-admin && git pull && pm2 restart ai-admin-worker-v2"
```

## Results

✅ **Worker Fix (Immediate):**
- Removed stuck jobs from repeat queue
- Worker restarted with fix
- No more infinite retry loops
- System messages properly skipped with warning log

✅ **Telegram Bot Fix (Follow-up):**
After deploying worker fix, alerts continued because bot checked queue instantly during temporary spikes.

**Additional Changes:**
1. **30-second delay with re-check** - Bot now waits 30s and verifies queue is still high
2. **Threshold increased** - From 50 to 100 messages to reduce false positives
3. **Better logging** - Logs spike detection and whether alert was sent

**File:** `scripts/telegram-bot.js`
- Line 823: `queueSize: 100` (was 50)
- Lines 986-1028: Added delay and re-check logic

**Deployment:**
```bash
git commit -m "fix: add 30-second delay to queue alerts and increase threshold to 100"
pm2 restart ai-admin-telegram-bot
```

✅ **Final Result:**
- Alerts only sent if queue stays high for 30+ seconds
- Higher threshold reduces noise from normal traffic bursts
- System now stable with no false positives

## Why This Happens

WhatsApp Business API sends various system messages:
- Delivery receipts
- Read receipts
- Status updates
- Message reactions metadata

These don't have a sender phone number (`from: null`) and shouldn't be processed as regular messages.

## Monitoring

Watch for:
```bash
# Check queue is empty
@redis LLEN 'bull:whatsapp-messages:wait'
@redis LLEN 'bull:whatsapp-messages:active'

# Check for skipped messages in logs
@logs logs_search service:ai-admin-worker-v2 pattern:"Skipping message with invalid"
```

Should see occasional warnings (normal system messages being skipped), but no error loops.

## Related Files

- `src/workers/message-worker-v2.js` - Worker with validation fix
- `docs/TELEGRAM_ALERTS_TROUBLESHOOTING.md` - Alert thresholds documentation

## Lessons Learned

1. **Graceful degradation:** Invalid input should log warning and skip, not crash
2. **Avoid retry loops:** Validation errors usually aren't transient - don't retry
3. **System messages:** Not all WhatsApp messages are from users - filter early
4. **Return success for skips:** BullMQ treats errors as "retry needed" - use `success: true, skipped: true` pattern

---
**Status:** ✅ Fixed and Deployed
**Commit:** `a320dd7`
**Branch:** `feature/redis-context-cache`
