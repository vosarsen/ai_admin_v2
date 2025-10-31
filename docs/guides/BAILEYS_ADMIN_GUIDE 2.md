# 👨‍💼 Baileys Cleanup System - Administrator Guide

## 🚀 Quick Start Guide

### Daily Operations Checklist

#### Morning Check (5 minutes)
```bash
# 1. Check overnight cleanup results
ssh root@46.149.70.219 "tail -20 /opt/ai-admin/logs/baileys-cleanup.log | grep SUMMARY"

# 2. Check current file counts
ssh root@46.149.70.219 "cd /opt/ai-admin/baileys_sessions && for dir in company_*; do echo \"\$dir: \$(ls -1 \$dir | wc -l) files\"; done"

# 3. Check for any alerts
ssh root@46.149.70.219 "grep -E 'CRITICAL|EMERGENCY' /opt/ai-admin/logs/auto-cleanup-trigger.log | tail -5"
```

### 🚨 Emergency Response

#### Scenario 1: File Count > 180 (CRITICAL)
```bash
# Step 1: Check which company
ssh root@46.149.70.219 "cd /opt/ai-admin/baileys_sessions && for dir in company_*; do count=\$(ls -1 \$dir | wc -l); [ \$count -gt 180 ] && echo \"CRITICAL: \$dir has \$count files\"; done"

# Step 2: Force immediate cleanup
ssh root@46.149.70.219 "node /opt/ai-admin/scripts/baileys-multitenancy-cleanup.js --company COMPANY_ID"

# Step 3: Verify reduction
ssh root@46.149.70.219 "ls -1 /opt/ai-admin/baileys_sessions/company_COMPANY_ID | wc -l"
```

#### Scenario 2: Cleanup Not Working
```bash
# Check for lock files
ssh root@46.149.70.219 "ls -la /opt/ai-admin/baileys_sessions/company_*/.cleanup.lock"

# Remove stale locks (if older than 1 hour)
ssh root@46.149.70.219 "find /opt/ai-admin/baileys_sessions -name '.cleanup.lock' -mmin +60 -delete"

# Check script errors
ssh root@46.149.70.219 "tail -50 /opt/ai-admin/logs/baileys-cleanup.log | grep -i error"

# Manually run with verbose
ssh root@46.149.70.219 "node /opt/ai-admin/scripts/baileys-multitenancy-cleanup.js --verbose --dry-run"
```

## 📊 Monitoring Dashboard

### Create Simple Monitoring Script
```bash
#!/bin/bash
# Save as: check-baileys-status.sh

echo "====================================="
echo "📊 BAILEYS CLEANUP STATUS DASHBOARD"
echo "====================================="
echo ""

# File counts
echo "📁 Current File Counts:"
ssh root@46.149.70.219 "cd /opt/ai-admin/baileys_sessions && for dir in company_*; do
    count=\$(ls -1 \$dir 2>/dev/null | wc -l)
    if [ \$count -gt 180 ]; then
        echo \"  🔴 \$dir: \$count files (EMERGENCY)\"
    elif [ \$count -gt 170 ]; then
        echo \"  🟠 \$dir: \$count files (CRITICAL)\"
    elif [ \$count -gt 150 ]; then
        echo \"  ⚠️  \$dir: \$count files (WARNING)\"
    else
        echo \"  ✅ \$dir: \$count files\"
    fi
done"

echo ""
echo "⏰ Last Cleanup Runs:"
ssh root@46.149.70.219 "grep 'Cleanup process completed' /opt/ai-admin/logs/baileys-cleanup.log | tail -3"

echo ""
echo "🚨 Recent Alerts:"
ssh root@46.149.70.219 "grep -E 'CRITICAL|WARNING' /opt/ai-admin/logs/auto-cleanup-trigger.log | tail -3"

echo ""
echo "📈 System Health:"
ssh root@46.149.70.219 "pm2 status | grep -E 'whatsapp|baileys'"
```

## 🔧 Common Tasks

### Add New Company
When a new company is onboarded:
```bash
# 1. Create directory (automatic when WhatsApp connects)
# 2. Monitor will auto-discover it
# 3. Verify detection:
ssh root@46.149.70.219 "node /opt/ai-admin/scripts/baileys-auto-cleanup-trigger.js"
```

### Adjust Cleanup Thresholds
```bash
# Edit trigger thresholds
ssh root@46.149.70.219 "vi /opt/ai-admin/scripts/baileys-auto-cleanup-trigger.js"
# Change: TRIGGER_THRESHOLD and EMERGENCY_THRESHOLD

# Edit cleanup rules
ssh root@46.149.70.219 "vi /opt/ai-admin/scripts/baileys-multitenancy-cleanup.js"
# Change: SESSION_MAX_AGE_DAYS, SENDER_KEY_MAX_AGE_DAYS, MAX_PRE_KEYS
```

### Setup Notifications
```bash
# Add webhook to environment
ssh root@46.149.70.219 "echo 'export NOTIFICATION_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL' >> ~/.bashrc"

# Or for Telegram
ssh root@46.149.70.219 "echo 'export NOTIFICATION_WEBHOOK=https://api.telegram.org/bot{TOKEN}/sendMessage?chat_id={CHAT_ID}' >> ~/.bashrc"

# Reload environment
ssh root@46.149.70.219 "source ~/.bashrc"
```

## 📈 Performance Tuning

### Optimize for Heavy Load (>10 companies)
```javascript
// In baileys-auto-cleanup-trigger.js
const CONFIG = {
  TRIGGER_THRESHOLD: 160,    // Lower threshold
  EMERGENCY_THRESHOLD: 175,  // Lower emergency
  // Run more frequently
  CRON_SCHEDULE: "*/15 * * * *"  // Every 15 minutes
}
```

### Optimize for Light Load (<3 companies)
```javascript
// Can be more relaxed
const CONFIG = {
  TRIGGER_THRESHOLD: 180,    // Higher threshold
  EMERGENCY_THRESHOLD: 190,  // Higher emergency
  // Run less frequently
  CRON_SCHEDULE: "0 */2 * * *"  // Every 2 hours
}
```

## 🔍 Troubleshooting Guide

### Problem: "Cleanup already in progress" errors
```bash
# Find and remove lock files
ssh root@46.149.70.219 "find /opt/ai-admin/baileys_sessions -name '.cleanup.lock' -delete"
ssh root@46.149.70.219 "rm -f /tmp/baileys-auto-cleanup.lock"
```

### Problem: Files not being deleted
```bash
# Check file ages
ssh root@46.149.70.219 "ls -lt /opt/ai-admin/baileys_sessions/company_*/session-*.json | head -10"

# If files are too new (< 14 days), this is normal
# To force cleanup of newer files (CAREFUL!):
# Temporarily edit SESSION_MAX_AGE_DAYS to lower value
```

### Problem: Cron jobs not running
```bash
# Check cron service
ssh root@46.149.70.219 "systemctl status cron"

# Check cron logs
ssh root@46.149.70.219 "grep baileys /var/log/syslog | tail -20"

# Reinstall cron jobs
ssh root@46.149.70.219 "crontab -l > /tmp/cron.backup"
ssh root@46.149.70.219 "crontab -r"
# Then re-add using setup scripts
```

## 📊 Metrics & KPIs

### Track These Weekly:
1. **Average file count per company** (target: < 150)
2. **Number of emergency cleanups** (target: 0)
3. **Files removed per cleanup** (healthy: 5-20)
4. **Cleanup success rate** (target: 100%)

### Monthly Review:
```bash
# Generate monthly report
ssh root@46.149.70.219 "
echo 'MONTHLY BAILEYS CLEANUP REPORT'
echo '=============================='
echo ''
echo 'Total cleanups run:'
grep -c 'Cleanup process completed' /opt/ai-admin/logs/baileys-cleanup.log
echo ''
echo 'Total files removed:'
grep 'Total files removed:' /opt/ai-admin/logs/baileys-cleanup.log | awk '{sum+=\$4} END {print sum}'
echo ''
echo 'Emergency cleanups:'
grep -c 'EMERGENCY' /opt/ai-admin/logs/auto-cleanup-trigger.log
echo ''
echo 'Average file count:'
cd /opt/ai-admin/baileys_sessions && for dir in company_*; do ls -1 \$dir | wc -l; done | awk '{sum+=\$1; count++} END {print sum/count}'
"
```

## 🛠️ Maintenance Schedule

### Daily (Automated)
- ✅ 3:00 AM - Scheduled cleanup runs
- ✅ Every 30 min - Auto-trigger checks

### Weekly (Manual - 10 minutes)
- [ ] Monday: Review weekend logs
- [ ] Wednesday: Check file accumulation trends
- [ ] Friday: Verify all automation working

### Monthly (Manual - 30 minutes)
- [ ] Generate metrics report
- [ ] Review and adjust thresholds
- [ ] Test emergency procedures
- [ ] Update documentation if needed

## 🔒 Security Considerations

### Do's ✅
- Always use `--dry-run` first when testing
- Keep backups before major changes
- Monitor logs after changes
- Use lock files to prevent conflicts

### Don'ts ❌
- Never delete `creds.json`
- Never delete `lid-mapping-*.json`
- Never delete `app-state-sync-*.json`
- Never run multiple cleanups simultaneously
- Never set thresholds too low (< 150)

## 📞 Escalation Path

### Level 1: Automated Systems
- Monitor alerts at 150+ files
- Auto-trigger at 175+ files
- Emergency cleanup at 185+ files

### Level 2: Administrator Action
- Manual cleanup if auto fails
- Adjust thresholds if needed
- Check logs for errors

### Level 3: Developer Support
- Session rotation needed (190+ files)
- Script modifications required
- Persistent errors after troubleshooting

## 📚 Quick Reference

### Key Files
```
/opt/ai-admin/
├── scripts/
│   ├── baileys-multitenancy-cleanup.js      # Main cleanup
│   ├── baileys-auto-cleanup-trigger.js      # Auto-trigger
│   └── whatsapp-safe-monitor.js            # Monitor
├── logs/
│   ├── baileys-cleanup.log                 # Cleanup logs
│   ├── auto-cleanup-trigger.log            # Trigger logs
│   └── whatsapp-safe-monitor-*.log         # Monitor logs
└── baileys_sessions/
    └── company_*/                          # Session files
```

### Key Commands
```bash
# Check status
for dir in company_*; do echo "$dir: $(ls -1 $dir | wc -l) files"; done

# Force cleanup
node scripts/baileys-multitenancy-cleanup.js --company COMPANY_ID

# Test cleanup
node scripts/baileys-multitenancy-cleanup.js --dry-run

# Check logs
tail -f logs/auto-cleanup-trigger.log

# PM2 management
pm2 status
pm2 restart whatsapp-safe-monitor
pm2 logs whatsapp-safe-monitor
```

---

**Last Updated**: September 24, 2025
**Version**: 1.0.0
**Support Contact**: DevOps Team