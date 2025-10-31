# WhatsApp Monitoring Guide

## 📊 Current Status

- **Current file count**: 162 files (Healthy ✅)
- **WhatsApp status**: Connected and operational
- **Last incident**: 230 files without any issues (2025-09-26)

## 🎯 Monitoring Thresholds

### File Count Levels

| Level | Files | Alert Frequency | Action Required | Risk |
|-------|-------|----------------|-----------------|------|
| ✅ **OK** | < 200 | No alerts | None | None |
| ⚠️ **WARNING** | 200-249 | Once per hour | Monitor closely | Low |
| 🟠 **CRITICAL** | 250-299 | Every 30 min | Plan cleanup within 24h | Medium |
| 🔴 **EMERGENCY** | 300+ | Every 15 min | Immediate cleanup | High (theoretical) |

### Auto-cleanup Triggers

- **Automatic cleanup**: 220+ files (runs via cron every 30 min)
- **Emergency cleanup**: 280+ files (immediate action)
- **Scheduled cleanup**: Daily at 3:00 AM

## 🔍 Understanding the Files

### What are these files?

Baileys (WhatsApp Web library) creates files for the Signal Protocol encryption:

```
baileys_sessions/company_962302/
├── creds.json                          # Main credentials (CRITICAL - backup regularly!)
├── app-state-sync-*.json              # Sync state files
├── pre-key-*.json                     # Pre-shared keys for new connections
├── sender-key-*.json                  # Encryption keys for each chat
├── session-*.json                     # Active session data
└── lid-mapping-*_reverse.json         # New WhatsApp ID system mappings
```

### Why do files accumulate?

- Each new chat/contact creates encryption keys
- WhatsApp's security protocol requires key storage
- Old keys aren't automatically deleted
- This is **normal behavior** for Signal Protocol

## ⚠️ Important Notes

### About "device_removed" warnings

**Reality Check**: After research and testing:
- No official documentation about file count limits exists
- We had 230 files without any disconnection
- The "180-200 files = device_removed" appears to be a **community myth**
- Real WhatsApp Web limits are about sessions (500) and devices (4), not file count

### Real reasons to clean files

1. **Performance**: Fewer files = faster startup and operations
2. **Disk space**: Prevents accumulation of unused data
3. **Maintenance**: Easier to manage and debug

## 🚨 Alert Management

### When you receive alerts

#### ⚠️ WARNING Alert (200+ files)
```
⚠️ Company 962302: 205 files
Monitor closely
```
**Action**: No immediate action needed, cleanup will happen automatically

#### 🟠 CRITICAL Alert (250+ files)
```
🟠 CRITICAL: Company 962302
Files: 265
Action: Cleanup recommended within 24h
```
**Action**: Check if auto-cleanup is working, manual cleanup if needed

#### 🔴 EMERGENCY Alert (300+ files)
```
🔴 EMERGENCY: WhatsApp auth files!
Company: 962302
Files: 310
Status: CRITICAL RISK of device_removed!
```
**Action**:
1. Don't panic - we've seen 230 files work fine
2. Backup creds.json
3. Run manual cleanup
4. Check WhatsApp connection status

## 🛠️ Manual Operations

### Check current file count
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "ls -1 /opt/ai-admin/baileys_sessions/company_962302/ | wc -l"
```

### Backup credentials
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cp /opt/ai-admin/baileys_sessions/company_962302/creds.json /opt/ai-admin/baileys_sessions/company_962302/creds.json.backup.$(date +%Y%m%d_%H%M%S)"
```

### Manual cleanup (safe)
```bash
# Delete files older than 1 day
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin/baileys_sessions/company_962302 && find . -name 'lid-mapping-*' -type f -mtime +1 -delete && find . -name 'sender-key-*' -type f -mtime +1 -delete && find . -name 'session-*' -type f -mtime +1 -delete"
```

### Run cleanup script
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "node /opt/ai-admin/scripts/baileys-multitenancy-cleanup.js"
```

### Check monitoring status
```bash
# View recent alerts
@logs logs_tail service:whatsapp-safe-monitor lines:50

# Check PM2 status
@logs pm2_status
```

### Restart monitoring
```bash
# If monitoring seems stuck
@logs pm2_restart service:whatsapp-safe-monitor
```

## 📅 Maintenance Schedule

| Task | Frequency | Automated | Description |
|------|-----------|-----------|-------------|
| Health check | Every minute | ✅ Yes | Monitor connection and file count |
| Alert check | Variable | ✅ Yes | Based on threshold levels |
| Auto-cleanup trigger | Every 30 min | ✅ Yes | Runs if > 220 files |
| Full cleanup | Daily 3:00 AM | ✅ Yes | Complete cleanup via cron |
| Credentials backup | Weekly | ❌ No | Manual backup recommended |

## 🔧 Configuration Files

### Monitor configuration
- **Location**: `/opt/ai-admin/scripts/whatsapp-safe-monitor.js`
- **Thresholds**: Lines with `fileCountWarning`, `fileCountCritical`, `fileCountEmergency`
- **Alert frequency**: Controlled by cooldown logic in each threshold section

### Auto-cleanup configuration
- **Location**: `/opt/ai-admin/scripts/baileys-auto-cleanup-trigger.js`
- **Triggers**: `TRIGGER_THRESHOLD` and `EMERGENCY_THRESHOLD`

### Cron jobs
```bash
# View current cron configuration
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "crontab -l"
```

## 📝 Recent Changes (2025-09-26)

1. **Fixed alert spam**: EMERGENCY alerts now limited to once per 15 minutes (was every minute)
2. **Adjusted thresholds**: Based on real experience (230 files worked fine)
   - WARNING: 150 → 200
   - CRITICAL: 170 → 250
   - EMERGENCY: 180 → 300
3. **Cleanup performed**: Reduced from 230 to 162 files
4. **Research completed**: Confirmed no official file count limits exist

## 💡 Key Takeaways

1. **File accumulation is normal** - Part of WhatsApp's encryption protocol
2. **No hard limits confirmed** - The 180-200 file "danger zone" appears to be a myth
3. **Monitoring is precautionary** - For performance and cleanliness, not critical safety
4. **Auto-cleanup works** - System self-maintains with proper configuration
5. **Don't panic on alerts** - We've tested with 230 files successfully

---

*Last updated: 2025-09-26*
*Current branch: feature/redis-context-cache*