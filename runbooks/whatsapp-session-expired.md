# WhatsApp Session Expired - Runbook

**Pattern:** `(session.*expir|Expired session keys|device.*removed|logged.*out|authentication.*fail|baileys.*session)`
**Severity:** Critical
**MTTR Target:** 10-15 minutes
**Last Updated:** 2025-11-24

---

## 📋 Symptoms

**How to identify this error:**

- Error message contains: `Expired session keys`, `device was removed`, `logged out`, `session expired`
- Stack trace shows: `baileys-whatsapp-service`, `auth-state-timeweb.js`, `useTimewebAuthState`
- Component tags: `whatsapp`, `baileys`, `authentication`
- Typically occurs: After 7-14 days without activity or after WhatsApp app updates
- **Impact:** Bot stops responding to ALL messages until fixed

**Examples:**
```
Error: Expired session keys - device was removed or logged out
  at auth-state-timeweb.js:89
  at useTimewebAuthState
```

---

## 🔍 Diagnosis

**Root Cause:**
WhatsApp invalidated the session (security measure, inactivity, or app update).

**How to verify:**
```bash
# Step 1: Check Baileys service status
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status baileys-whatsapp-service"

# Step 2: Check for session errors in logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs baileys-whatsapp-service --lines 50 | grep -i 'session\|expir\|auth'"

# Step 3: Verify WhatsApp files count (high count = potential issue)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "find /root/.baileys_auth_info -type f | wc -l"
```

**Common Triggers:**
1. WhatsApp app detected automation (if bot behaves unnaturally)
2. Phone number logged in on another device
3. WhatsApp session expired after 14 days inactivity
4. WhatsApp Business API policy change
5. Database session keys corrupted

---

## 🛠️ Fix

**Immediate Actions:**
```bash
# Step 1: Stop Baileys service
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 stop baileys-whatsapp-service"

# Step 2: Clear old session data (from database)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "psql postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require -c \"DELETE FROM baileys_auth WHERE key LIKE 'app-state%' OR key LIKE 'pre-key%';\""

# Step 3: Clean WhatsApp files directory
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "rm -rf /root/.baileys_auth_info/*"

# Step 4: Restart service (will trigger QR code generation)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart baileys-whatsapp-service"

# Step 5: Get QR code (check logs within 30 seconds)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs baileys-whatsapp-service --lines 100 | grep -A 30 'QR'"
```

**Verification:**
```bash
# Step 1: Wait 30 seconds after scanning QR code

# Step 2: Check if connection successful
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs baileys-whatsapp-service --lines 50 | grep -i 'open\|connected\|ready'"

# Step 3: Test with test phone number
# Send message to bot: "тест"
# Should respond within 10 seconds
```

**Expected Result:**
- QR code appears in logs within 30 seconds
- After scanning: "connection opened" message
- Bot responds to test message
- No more session errors in logs

**Rollback Plan (if fix fails):**
```bash
# If QR code doesn't appear or scanning fails:

# 1. Check baileys library version compatibility
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && npm list @whiskeysockets/baileys"

# 2. Check for baileys issues on GitHub
# Visit: https://github.com/WhiskeySockets/Baileys/issues

# 3. Consider switching phone number (last resort)
# Follow guide in docs/02-guides/whatsapp/WHATSAPP_SETUP.md
```

---

## 🚫 Prevention

**Configuration Changes:**
- [ ] Enable session backup (implemented in Phase 3, Baileys Resilience)
  - Location: `/var/backups/baileys-session/`
  - Frequency: Every 6 hours
- [ ] Reduce WhatsApp file accumulation threshold
  - Current: 300 files = emergency
  - Proposed: 200 files = warning
- [ ] Add session validation before each operation
  - Check creds exist before sending message

**Monitoring:**
- Add alert for: Session health check failure
- Threshold: No successful message sent in 30 minutes
- Action: Send Telegram alert "WhatsApp session may be dead"

**Code Changes:**
- [ ] Add session keepalive (send heartbeat every 12 hours)
  ```javascript
  setInterval(() => sock.sendPresenceUpdate('available'), 12 * 60 * 60 * 1000);
  ```
- [ ] Add graceful session refresh before expiry
  - Detect "session expiring soon" condition
  - Proactively re-authenticate
- [ ] Improve error messages (distinguish session vs network errors)

**Documentation:**
- [ ] Update docs at: `docs/02-guides/whatsapp/WHATSAPP_TROUBLESHOOTING.md`
- [ ] Add test case: Simulate session expiry
- [ ] Create video guide for QR code scanning process

---

## 📊 History

**Occurrences:**
- 2025-11-19 - After 7 days no messages, session expired (resolved in 12 min)
- 2025-11-06 - During Baileys migration, session recreated (Phase 0.7)
- 2025-10-15 - WhatsApp app update caused session invalidation

**Related Issues:**
- GlitchTip #2 - Expired session keys critical
- GitHub PR - Phase 3 Baileys Resilience (session backup)
- GitHub Issue - WhatsApp monitoring improvements

**Improvements Made:**
- 2025-11-19 - Added database session backup (Phase 3, Task 4.1)
- 2025-11-08 - Improved monitoring script (Phase 0.7)
- 2025-11-06 - Migrated to Timeweb PostgreSQL for session storage

---

## 🔗 Related Resources

**Internal Docs:**
- `dev/active/baileys-resilience-improvements/` - Session backup implementation
- `docs/02-guides/whatsapp/WHATSAPP_MONITORING_GUIDE.md`
- `docs/WHATSAPP_MONITORING_GUIDE.md` - File monitoring thresholds
- `src/integrations/whatsapp/auth-state-timeweb.js` - Session management code

**External Resources:**
- [Baileys Documentation](https://whiskeysockets.github.io/)
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy)
- [Baileys Auth State Guide](https://github.com/WhiskeySockets/Baileys#handling-authentication)

**Team Contacts:**
- Primary: WhatsApp Integration Developer
- Backup: DevOps Engineer (for server access)
- Escalation: None (self-service with QR code)

---

**Runbook Version:** 1.0
**Author:** Claude Code
**Reviewed By:** [Pending]
**Next Review:** 2025-12-24
