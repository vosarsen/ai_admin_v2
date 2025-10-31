# WhatsApp Authentication File Management Guide

## Executive Summary

This document outlines the critical knowledge and best practices for managing WhatsApp authentication files in Baileys-based implementations. Following these guidelines will prevent the catastrophic `device_removed` error that requires QR code rescanning and causes service downtime.

## Critical Understanding

### The `device_removed` Problem

WhatsApp can revoke device authorization when it detects anomalies in session management, specifically:
- Accumulation of stale encryption keys
- Too many pre-key files (>200)
- Rapid session cycling
- Improper cleanup of Signal Protocol files

**Impact**: Complete loss of WhatsApp connection, requiring manual QR code scanning.

## File Types and Their Purpose

### 1. Critical Files (NEVER DELETE)
- **`creds.json`** - Main authentication credentials
  - Contains device identity and authentication tokens
  - Deletion = Immediate need for QR rescan

- **`app-state-sync-*.json`** - Application state synchronization
  - Maintains sync with WhatsApp servers
  - Critical for message delivery

### 2. Session Files
- **`session-[phone].json`** - Active chat sessions
  - One file per active conversation
  - Contains Signal Protocol encryption state
  - Safe to delete if >14 days old AND not recently modified

### 3. Pre-Key Files
- **`pre-key-*.json`** - Signal Protocol pre-keys
  - Used for establishing new encrypted sessions
  - WhatsApp generates batches of these
  - Safe range: 30-100 files
  - Safe to delete excess if >50 files (keep newest)

### 4. Sender Key Files
- **`sender-key-*.json`** - Group chat encryption
  - Used for group message encryption
  - Regenerate automatically
  - Safe to delete if >3 days old

## Safety Thresholds

```
Files Count | Status      | Action Required
------------|-------------|------------------
0-50        | ✅ Excellent | None
50-100      | ✅ Healthy   | None
100-120     | ⚠️  Monitor  | Watch closely
120-150     | ⚠️  Warning  | Plan cleanup soon
150-180     | 🔴 Critical  | Cleanup within 24h
180-200     | 💀 DANGER    | Immediate cleanup!
200+        | ☠️  FATAL    | QR rescan required
```

## Cleanup Rules

### Golden Rules

1. **NEVER cleanup while WhatsApp is connected**
   - Signal Protocol requires stable state during operation
   - Deleting files during operation causes encryption failures

2. **NEVER delete files younger than 7 days**
   - Active sessions may still be in use
   - WhatsApp may interpret as suspicious activity

3. **ALWAYS preserve minimum viable set**
   - Keep at least 30 pre-keys
   - Keep all app-state-sync files
   - Keep creds.json

### Safe Cleanup Procedure

1. **Stop WhatsApp connection**
   ```bash
   pm2 stop ai-admin-api
   ```

2. **Run smart cleanup**
   ```bash
   # Dry run first
   node scripts/whatsapp-smart-cleanup.js --dry-run

   # If safe, run actual cleanup
   node scripts/whatsapp-smart-cleanup.js
   ```

3. **Restart WhatsApp**
   ```bash
   pm2 restart ai-admin-api
   ```

4. **Verify connection**
   ```bash
   curl http://localhost:3000/webhook/whatsapp/baileys/status/962302
   ```

## Monitoring

### Key Warning Signs in Logs

1. **"Closing stale open session"**
   - Indicates accumulating stale sessions
   - Precursor to device_removed
   - Action: Schedule cleanup

2. **"waiting for message"**
   - Encryption state problems
   - Messages stuck in queue
   - Action: Check session files

3. **"device_removed"**
   - Fatal - authorization revoked
   - Requires QR rescan
   - Action: Full cleanup and reauth

### Automated Monitoring

The system includes three levels of monitoring:

1. **WhatsApp Auto-Recovery** (`whatsapp-auto-recovery.js`)
   - Checks file count every hour
   - Alerts at 120+ files
   - Attempts cleanup at 150+ files

2. **Signal Protocol Monitor** (`monitor-signal-warnings.js`)
   - Scans logs for warning patterns
   - Alerts on critical patterns
   - Early warning system

3. **Manual Monitoring Commands**
   ```bash
   # Check file count
   ls -la /opt/ai-admin/baileys_sessions/company_962302 | wc -l

   # Check for warnings
   pm2 logs ai-admin-api --lines 100 | grep "Closing stale"

   # Check connection status
   curl http://localhost:3000/webhook/whatsapp/baileys/status/962302
   ```

## Prevention Strategy

### Daily Monitoring
- Check file count each morning
- Review logs for warnings
- Plan cleanup if >120 files

### Weekly Maintenance
- Run cleanup during low-traffic hours
- Only if file count >100
- Always during planned maintenance window

### Emergency Response
If file count >180:
1. **Immediate Telegram alert sent**
2. **Stop all WhatsApp operations**
3. **Run emergency cleanup**
4. **Restart and monitor**

## What NOT to Do

### ❌ Never Do These:

1. **Delete files while bot is running**
   - Causes immediate encryption failures
   - Clients see "security code changed" warnings
   - Can trigger device_removed

2. **Aggressive cleanup (daily, <50 files)**
   - Disrupts active sessions
   - Creates connection instability
   - WhatsApp sees as suspicious

3. **Ignore warning signs**
   - File count >150 = ticking time bomb
   - "Closing stale" messages = immediate attention needed
   - Multiple reconnections = investigate immediately

4. **Wait for automatic recovery at 200+ files**
   - Too late - QR rescan inevitable
   - Customer impact severe
   - Manual intervention required

## Recovery Procedures

### If Cleanup Fails
1. Stop WhatsApp completely
2. Backup critical files (creds.json, app-state-sync)
3. Try force cleanup: `node scripts/whatsapp-smart-cleanup.js --force`
4. If still failing, prepare for QR rescan

### If QR Rescan Required
1. Alert customers about temporary outage
2. Clear entire auth directory
3. Restart WhatsApp service
4. Access QR interface: `http://SERVER:3000/whatsapp-connect.html?company=962302`
5. Scan with phone
6. Verify connection restored

## Implementation Details

### Smart Cleanup Script
- Location: `scripts/whatsapp-smart-cleanup.js`
- Safe thresholds: 50 pre-keys, 14-day sessions
- Safety check: Won't run if connected
- Preserves all critical files

### Auto-Recovery Monitor
- Location: `scripts/whatsapp-auto-recovery.js`
- Runs every minute
- Progressive alerts at 120, 150, 180 files
- Auto-cleanup only when disconnected

### Signal Warning Monitor
- Location: `scripts/monitor-signal-warnings.js`
- Scans logs for danger patterns
- Telegram alerts on critical issues
- Early warning system

## Lessons Learned

1. **Signal Protocol is strict** - Any deviation from expected behavior triggers security measures
2. **Prevention > Recovery** - Never let files exceed 150
3. **Gradual accumulation** - Files build slowly, then suddenly critical
4. **WhatsApp security** - Designed to prevent automated abuse, strict on anomalies
5. **Customer impact** - QR rescan is unacceptable in production

## Backup and Recovery System (NEW - September 2025)

### Automatic Backups
System now creates automatic backups before ANY cleanup operation:
- Preserves `creds.json` to prevent QR rescans
- Keeps last 5 backups per company
- Can restore from backup if something goes wrong

### Backup Commands
```bash
# Create manual backup
node scripts/whatsapp-backup-manager.js backup 962302

# Restore from latest backup
node scripts/whatsapp-backup-manager.js restore 962302

# List available backups
node scripts/whatsapp-backup-manager.js list 962302

# Verify backup integrity
node scripts/whatsapp-backup-manager.js verify 962302

# Backup all companies
node scripts/whatsapp-backup-manager.js backup-all
```

## Health Check Dashboard (NEW - September 2025)

### Quick System Check
```bash
# One command to check everything
node scripts/whatsapp-health-check.js

# Live monitoring mode
node scripts/whatsapp-health-check.js --watch
```

Shows:
- Process status (API, workers, monitors)
- WhatsApp connection status per company
- File counts with health indicators
- Backup status and age
- Actionable recommendations

## Enhanced Recovery System (UPDATED - September 2025)

### Key Improvements:
1. **15-minute timeout** (was 5) - Better tolerance for network issues
2. **Network detection** - Distinguishes network vs WhatsApp issues
3. **Smart recovery** - Tries reconnection WITHOUT cleanup first
4. **Backup before cleanup** - Always preserves critical files
5. **No more rm -rf** - Smart cleanup preserves creds.json

### Recovery Flow:
1. Disconnected 0-10 min: Wait for auto-reconnect
2. Disconnected 10 min: Warning alert sent
3. Disconnected 15 min: Try reconnect without cleanup
4. If files >150: Smart cleanup (preserves creds.json)
5. If files >200: Last resort - full cleanup (requires QR)

## Quick Reference Card

```bash
# HEALTH CHECK (Do this first!)
node scripts/whatsapp-health-check.js

# Check status
pm2 status | grep whatsapp
ls -la /opt/ai-admin/baileys_sessions/company_962302 | wc -l

# Create backup (always safe)
node scripts/whatsapp-backup-manager.js backup 962302

# Safe cleanup (when disconnected)
pm2 stop ai-admin-api
node scripts/whatsapp-smart-cleanup.js
pm2 restart ai-admin-api

# Restore from backup if needed
node scripts/whatsapp-backup-manager.js restore 962302

# Emergency (180+ files)
pm2 stop ai-admin-api
node scripts/whatsapp-smart-cleanup.js --force
pm2 restart ai-admin-api

# Monitor logs
pm2 logs ai-admin-api --lines 100 | grep -E "(Closing stale|device_removed|waiting)"

# Start all monitors
pm2 start scripts/whatsapp-auto-recovery.js --name whatsapp-monitor
pm2 start scripts/whatsapp-multi-company-monitor.js --name whatsapp-multi-monitor
```

## Multi-Company Support

### Important: Multi-Tenant Monitoring

Each connected company/salon has its own WhatsApp session and auth files:
```
/opt/ai-admin/baileys_sessions/
├── company_962302/  (Salon A)
├── company_123456/  (Salon B)
└── company_789012/  (Salon C)
```

**Each company needs individual monitoring!** One company can reach 200+ files while others are healthy.

### Multi-Company Monitoring

Use the multi-company monitor for all companies:
```bash
# Start multi-company monitor
node scripts/whatsapp-multi-company-monitor.js

# Or as PM2 service
pm2 start scripts/whatsapp-multi-company-monitor.js --name whatsapp-multi-monitor
```

### Per-Company Cleanup

Clean specific company when needed:
```bash
# Check specific company
ls -la /opt/ai-admin/baileys_sessions/company_XXXXXX | wc -l

# Cleanup specific company (when disconnected)
AUTH_PATH=/opt/ai-admin/baileys_sessions/company_XXXXXX \
  node scripts/whatsapp-smart-cleanup.js
```

### Scaling Considerations

- Each company = separate monitoring
- Each company = separate cleanup schedule
- Each company = separate QR code if needed
- One company's issues don't affect others

## Support Contacts

- **Telegram Alerts**: Configured in TELEGRAM_BOT_TOKEN
- **Manual Monitoring**: Check every morning at 9 AM for ALL companies
- **Emergency Cleanup**: If ANY company >180 files, act immediately

---

**Last Updated**: September 19, 2025
**Version**: 3.0
**Major Update**: Added backup system, health dashboard, and enhanced recovery after critical incident

**⚠️ CRITICAL**: This document contains production-critical information. All team members must understand these procedures.

**🆕 NEW FEATURES (v3.0)**:
- Automatic backup system prevents data loss
- Health check dashboard for instant status
- 15-minute recovery timeout (was 5)
- Network failure detection
- Multi-company support
- No more accidental QR rescans