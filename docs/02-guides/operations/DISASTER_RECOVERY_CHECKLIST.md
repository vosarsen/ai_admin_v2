# Disaster Recovery Checklist

**Last Updated:** November 25, 2025
**Version:** 1.0
**Status:** Active

---

## Quick Reference

| Metric | Target | Actual (Tested) |
|--------|--------|-----------------|
| **RTO** (Recovery Time Objective) | <30 minutes | **1-3 seconds** ✅ |
| **RPO** (Recovery Point Objective) | <24 hours | **<24 hours** (daily backups) ✅ |
| **Backup Retention** | 7 daily + 4 monthly | 7/7 daily ✅ |
| **Data Verified** | 100% | 100% ✅ |

---

## Emergency Contacts

| Role | Contact | Method |
|------|---------|--------|
| **DevOps Lead** | @vosarsen | Telegram |
| **Support** | support@adminai.tech | Email |
| **Timeweb Support** | 8-800-775-25-89 | Phone (24/7) |

---

## Scenario 1: PostgreSQL Database Failure

### Symptoms
- WhatsApp service fails to start
- Logs show "ECONNREFUSED" or "ETIMEDOUT" to PostgreSQL
- GlitchTip shows database connection errors

### Recovery Steps

**Step 1: Diagnose (2 min)**
```bash
# Check PostgreSQL status via psql
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
psql "$POSTGRES_CONNECTION_STRING" -c "SELECT 1;"

# If fails, check Timeweb Cloud console:
# https://cloud.timeweb.cloud/databases
```

**Step 2A: If Timeweb PostgreSQL is down (contact support)**
```bash
# 1. Contact Timeweb support (8-800-775-25-89)
# 2. While waiting, use emergency file fallback:
cd /opt/ai-admin
node scripts/emergency/restore-file-sessions.js
```

**Step 2B: If connection issue (restart services)**
```bash
pm2 restart baileys-whatsapp-service
pm2 logs baileys-whatsapp-service --lines 50
```

**Step 3: Verify Recovery**
```bash
# Check WhatsApp connected
pm2 logs baileys-whatsapp-service --lines 10 --nostream | grep "WhatsApp connected"

# Test message
@whatsapp send_message phone:89686484488 message:"DR test"
```

---

## Scenario 2: App Server Failure (Moscow)

### Symptoms
- SSH to 46.149.70.219 fails
- All services down
- Telegram bot not responding

### Recovery Steps

**Step 1: Check Timeweb Cloud Console (1 min)**
```
URL: https://cloud.timeweb.cloud/servers
Server: ai-admin (46.149.70.219)
Check: Status, restart if needed
```

**Step 2: If Server Unrecoverable - Deploy to New Server**
```bash
# 1. Create new VPS in Timeweb (Moscow datacenter)
# 2. Clone repository
git clone https://github.com/YOUR_ORG/ai-admin.git /opt/ai-admin
cd /opt/ai-admin

# 3. Copy environment
scp .env NEW_SERVER:/opt/ai-admin/

# 4. Install dependencies
npm install

# 5. Restore PostgreSQL data (already on SPb server - no action needed!)

# 6. Start services
pm2 start ecosystem.config.js
pm2 save

# 7. Update DNS/Telegram webhook if needed
```

**Step 3: Restore WhatsApp Session**
```bash
# Session data is in PostgreSQL (SPb datacenter)
# Just restart baileys-whatsapp-service
pm2 restart baileys-whatsapp-service

# If QR scan needed:
pm2 logs baileys-whatsapp-service
# Scan QR code displayed in logs
```

---

## Scenario 3: Data Corruption / Accidental Deletion

### Symptoms
- WhatsApp authentication fails
- Missing keys in database
- Corrupted credentials

### Recovery Steps

**Step 1: Identify Scope (2 min)**
```bash
# Check current data
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin

# Count records
psql "$POSTGRES_CONNECTION_STRING" -c "SELECT COUNT(*) FROM whatsapp_auth;"
psql "$POSTGRES_CONNECTION_STRING" -c "SELECT COUNT(*) FROM whatsapp_keys;"
```

**Step 2: Restore from Backup (3 min)**
```bash
# List available backups
ls -la /var/backups/postgresql/daily/

# Choose backup (latest before corruption)
BACKUP="/var/backups/postgresql/daily/backup-2025-11-25.sql.gz"

# Create test schema first
psql "$POSTGRES_CONNECTION_STRING" -c "DROP SCHEMA IF EXISTS restore_temp CASCADE;"
psql "$POSTGRES_CONNECTION_STRING" -c "CREATE SCHEMA restore_temp;"

# Restore to temp schema
gunzip -c "$BACKUP" | \
  sed -e '/DROP DATABASE/d' \
      -e '/CREATE DATABASE/d' \
      -e '/\\connect/d' \
      -e 's/public\./restore_temp./g' | \
  psql "$POSTGRES_CONNECTION_STRING"

# Verify restored data
psql "$POSTGRES_CONNECTION_STRING" -c "SELECT COUNT(*) FROM restore_temp.whatsapp_auth;"
psql "$POSTGRES_CONNECTION_STRING" -c "SELECT COUNT(*) FROM restore_temp.whatsapp_keys;"

# If good, swap schemas
psql "$POSTGRES_CONNECTION_STRING" -c "
  DROP TABLE IF EXISTS public.whatsapp_keys;
  DROP TABLE IF EXISTS public.whatsapp_auth;
  ALTER TABLE restore_temp.whatsapp_auth SET SCHEMA public;
  ALTER TABLE restore_temp.whatsapp_keys SET SCHEMA public;
  DROP SCHEMA restore_temp;
"

# Restart WhatsApp service
pm2 restart baileys-whatsapp-service
```

**Step 3: Verify Recovery**
```bash
# Check service logs
pm2 logs baileys-whatsapp-service --lines 30

# Test message
@whatsapp send_message phone:89686484488 message:"DR recovery test"
```

---

## Scenario 4: Complete Datacenter Loss

### Symptoms
- Both Moscow and SPb servers unreachable
- Complete service outage

### Recovery Steps (2+ hours)

**Step 1: Contact Timeweb Support**
```
Phone: 8-800-775-25-89 (24/7)
Account: Check cloud.timeweb.cloud
```

**Step 2: If Timeweb Down - Deploy Elsewhere**

**Option A: Local Backup Available**
```bash
# If you have local backup copies:
# 1. Deploy to new cloud provider (DigitalOcean, Hetzner, etc.)
# 2. Restore from local backup
# 3. Update DNS
```

**Option B: No Local Backup**
```
# Full service rebuild required
# WhatsApp will require re-authentication (QR scan)
# Historical message context will be lost
# Clients/services data from YClients API still available
```

---

## Backup Verification Commands

### Daily Check (Automated)
```bash
# Run validation on all backups
node scripts/backup/validate-backup.js --all
```

### Manual Verification
```bash
# Check backup contents
gunzip -c /var/backups/postgresql/daily/backup-2025-11-25.sql.gz | head -50

# Count records in backup
gunzip -c /var/backups/postgresql/daily/backup-2025-11-25.sql.gz | \
  sed -n '/COPY.*whatsapp_keys/,/^\\.$/p' | wc -l

# Test restoration (non-destructive)
node scripts/backup/test-restore-backup.js
```

### Checksum Verification
```bash
# View stored checksums
cat /var/backups/postgresql/checksums.json

# Verify specific backup
sha256sum /var/backups/postgresql/daily/backup-2025-11-25.sql.gz
```

---

## Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────────┐         │
│  │   MOSCOW         │         │   ST. PETERSBURG      │         │
│  │   App Server     │────────▶│   PostgreSQL Server   │         │
│  │                  │         │                       │         │
│  │  46.149.70.219   │   SSL   │  a84c9733...twc1.net │         │
│  │                  │         │                       │         │
│  │  - PM2 services  │         │  - whatsapp_auth     │         │
│  │  - WhatsApp      │         │  - whatsapp_keys     │         │
│  │  - Redis cache   │         │  - Timeweb backups   │         │
│  │  - Xray VPN      │         │                       │         │
│  └──────────────────┘         └──────────────────────────┘      │
│          │                              │                        │
│          │                              │                        │
│          ▼                              ▼                        │
│  ┌──────────────────┐         ┌──────────────────────┐         │
│  │  LOCAL BACKUPS   │         │  TIMEWEB BACKUPS     │         │
│  │                  │         │  (Server-level)      │         │
│  │  /var/backups/   │         │  00:15 MSK daily     │         │
│  │  postgresql/     │         │  1 version retained  │         │
│  │  - 7 daily       │         │                       │         │
│  │  - 4 monthly     │         │                       │         │
│  └──────────────────┘         └──────────────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recovery Metrics (Tested Nov 25, 2025)

### Backup Restoration Test
| Metric | Value |
|--------|-------|
| Backup file | backup-2025-11-25.sql.gz |
| Backup size | 479 KB |
| Records (auth) | 1 |
| Records (keys) | 2,317 |
| **Restoration time** | **1.0 seconds** |
| Data integrity | 100% verified |

### All Backups Validation
| Date | Size | Keys | Status |
|------|------|------|--------|
| 2025-11-25 | 479 KB | 2,317 | ✅ Valid |
| 2025-11-24 | 478 KB | 2,314 | ✅ Valid |
| 2025-11-23 | 421 KB | 2,125 | ✅ Valid |
| 2025-11-22 | 406 KB | 2,049 | ✅ Valid |
| 2025-11-21 | 392 KB | 1,942 | ✅ Valid |
| 2025-11-20 | 366 KB | 1,745 | ✅ Valid |
| 2025-11-19 | 353 KB | 1,647 | ✅ Valid |

---

## Automated Jobs Summary

| Job | Schedule | Purpose |
|-----|----------|---------|
| backup-postgresql | 03:00 UTC daily | Create PostgreSQL backup |
| cleanup-expired-keys | 03:00 UTC daily | Remove keys >30 days old |
| test-restore-monthly | 04:00 UTC 1st of month | Test backup restoration |
| Timeweb backup | 00:15 MSK daily | Full server backup |

---

## Appendix: Quick Commands

### Check System Status
```bash
# All services
pm2 status

# WhatsApp specifically
pm2 logs baileys-whatsapp-service --lines 20 --nostream

# Database connection
psql "$POSTGRES_CONNECTION_STRING" -c "SELECT 1;"
```

### Emergency Fallback to File-Based Auth
```bash
cd /opt/ai-admin
node scripts/emergency/restore-file-sessions.js

# This will:
# 1. Export PostgreSQL data to files
# 2. Switch to file-based authentication
# 3. Restart WhatsApp service
# Duration: ~12 seconds
```

### Manual Backup Now
```bash
cd /opt/ai-admin
node scripts/backup/backup-postgresql.js
```

### Validate All Backups
```bash
cd /opt/ai-admin
node scripts/backup/validate-backup.js --all
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-25 | Initial release with tested metrics |

---

**Document Owner:** DevOps Team
**Review Frequency:** Quarterly
**Next Review:** February 2026
