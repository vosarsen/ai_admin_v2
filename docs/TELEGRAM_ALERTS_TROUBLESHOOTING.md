# Telegram Alerts Troubleshooting Guide

## 🚨 Common Alert Types

### 1. WhatsApp File Count Alerts

#### ⚠️ WARNING (Yellow)
```
⚠️ Company 962302: 205 files
Monitor closely
```
- **Frequency**: Once per hour
- **Severity**: Low
- **Action**: None required, auto-cleanup will handle

#### 🟠 CRITICAL (Orange)
```
🟠 CRITICAL: Company 962302
Files: 265
Action: Cleanup recommended within 24h
```
- **Frequency**: Every 30 minutes
- **Severity**: Medium
- **Action**: Verify auto-cleanup is scheduled

#### 🔴 EMERGENCY (Red)
```
🔴 EMERGENCY: WhatsApp auth files!
Company: 962302
Files: 310
Status: CRITICAL RISK of device_removed!

IMMEDIATE ACTION REQUIRED:
1. Backup creds.json NOW
2. Run cleanup: node scripts/baileys-multitenancy-cleanup.js
3. Consider emergency rotation
```
- **Frequency**: Every 15 minutes (was every minute - fixed!)
- **Severity**: High (but likely false alarm)
- **Action**: Follow steps below

### 2. WhatsApp Disconnection Alert
```
⚠️ WhatsApp отключен!
Компания: 962302
Неудачных проверок: 3
Файлов: 162
```
- **Severity**: High
- **Action**: Check connection immediately

## 🔧 Troubleshooting Steps

### For File Count Alerts

#### Step 1: Check actual file count
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "ls -1 /opt/ai-admin/baileys_sessions/company_962302/ | wc -l"
```

#### Step 2: Check WhatsApp connection
```bash
# Test message
@whatsapp send_message phone:89686484488 message:"Test after alert"

# Check logs
@logs logs_tail service:baileys-whatsapp lines:30
```

#### Step 3: If needed, manual cleanup
```bash
# Backup first
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cp /opt/ai-admin/baileys_sessions/company_962302/creds.json /opt/ai-admin/baileys_sessions/company_962302/creds.json.backup.$(date +%Y%m%d)"

# Clean old files
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin/baileys_sessions/company_962302 && find . -name 'lid-mapping-*' -type f -mtime +1 -delete && find . -name 'sender-key-*' -type f -mtime +1 -delete"
```

### For Disconnection Alerts

#### Step 1: Check service status
```bash
@logs pm2_status
```

#### Step 2: Check recent errors
```bash
@logs logs_errors service:baileys-whatsapp
```

#### Step 3: Restart if needed
```bash
@logs pm2_restart service:baileys-whatsapp
```

## ❓ FAQ

### Q: Getting EMERGENCY alerts every minute?
**A**: This was a bug, now fixed. Alerts limited to every 15 minutes. If still occurring:
```bash
# Restart monitor with updated config
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart whatsapp-safe-monitor"
```

### Q: Alert says "CRITICAL RISK of device_removed!" - should I panic?
**A**: No! This is likely a false alarm. We've tested with 230 files without issues. The alert is precautionary. Just run cleanup when convenient.

### Q: How to stop alerts temporarily?
```bash
# Stop monitoring (NOT recommended)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 stop whatsapp-safe-monitor"

# Resume monitoring
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 start whatsapp-safe-monitor"
```

### Q: How to check if auto-cleanup is working?
```bash
# Check cleanup logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "tail -n 50 /opt/ai-admin/logs/auto-cleanup-trigger.log"

# Check cron jobs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "crontab -l"
```

### Q: Alerts stopped coming - is monitoring broken?
```bash
# Check if monitor is running
@logs pm2_status

# Check monitor logs
@logs logs_tail service:whatsapp-safe-monitor lines:50

# Check Telegram bot
@logs logs_tail service:ai-admin-telegram-bot lines:20
```

## 📊 Alert Thresholds Reference

| Files | Alert Type | Frequency | Real Risk |
|-------|-----------|-----------|-----------|
| < 200 | None | - | None |
| 200-249 | ⚠️ WARNING | 1/hour | None (tested OK) |
| 250-299 | 🟠 CRITICAL | 1/30min | Low (cleanup recommended) |
| 300+ | 🔴 EMERGENCY | 1/15min | Unknown (but likely safe) |

## 🛠️ Configuration Adjustment

### To change alert frequency
Edit `/opt/ai-admin/scripts/whatsapp-safe-monitor.js`:
```javascript
// For EMERGENCY alerts (line ~197)
if (minutesSinceLastAlert > 15) {  // Change 15 to desired minutes

// For CRITICAL alerts (line ~216)
if (minutesSinceLastAlert > 30) {  // Change 30 to desired minutes

// For WARNING alerts (line ~231)
if (hoursSinceLastAlert > 1) {     // Change 1 to desired hours
```

### To change file thresholds
```bash
# Current: 200/250/300
# To change to more relaxed 250/350/450:

ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "sed -i 's/fileCountWarning: 200/fileCountWarning: 250/g' /opt/ai-admin/scripts/whatsapp-safe-monitor.js"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "sed -i 's/fileCountCritical: 250/fileCountCritical: 350/g' /opt/ai-admin/scripts/whatsapp-safe-monitor.js"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "sed -i 's/fileCountEmergency: 300/fileCountEmergency: 450/g' /opt/ai-admin/scripts/whatsapp-safe-monitor.js"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart whatsapp-safe-monitor"
```

## 📝 Alert History Analysis

### Check patterns
```bash
# Count alerts per day
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "grep EMERGENCY /opt/ai-admin/logs/whatsapp-monitor-error-18.log | cut -d' ' -f1 | sort | uniq -c"

# See alert frequency
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "grep 'alert suppressed' /opt/ai-admin/logs/whatsapp-monitor-out-18.log | tail -20"
```

## 💡 Best Practices

1. **Don't disable monitoring** - It's better to have false alarms than miss real issues
2. **Weekly backup** - Manually backup creds.json weekly
3. **Monthly review** - Check if thresholds need adjustment based on patterns
4. **Document changes** - Update this guide when changing configurations

---

*Last updated: 2025-09-26*
*Fixed: Alert spam issue (EMERGENCY now every 15min, not 1min)*