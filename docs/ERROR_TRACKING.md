# Error Tracking with GlitchTip

**Status:** Production Active
**Migrated from:** Sentry SaaS (2025-11-24)
**Savings:** $348/year

## Quick Access

**GlitchTip UI:** http://localhost:8080 (via SSH tunnel)

```bash
# Open SSH tunnel for UI access
ssh -i ~/.ssh/id_ed25519_ai_admin -L 8080:localhost:8080 root@46.149.70.219

# Then open in browser: http://localhost:8080
```

**Credentials:**
- Email: support@adminai.tech
- Password: AdminSecure2025

## Architecture

```
AI Admin Services → Sentry SDK → GlitchTip (localhost:8080)
                                      ↓
                               PostgreSQL + Redis
                                      ↓
                                 Web UI + Alerts
```

**Components:**
- `web` - Django/uWSGI web server (256 MB limit)
- `worker` - Celery background worker (200 MB limit)
- `postgres` - PostgreSQL 16 database
- `redis` - Redis 7 message queue

## Configuration

**Environment (.env):**
```env
SENTRY_DSN=http://304929daf8ea494d89c853a7fce277ce@localhost:8080/1
SENTRY_ENABLED=true
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

**SDK Compatibility:** @sentry/node v10.24.0 (100% compatible)

## Common Tasks

### Check Service Status

```bash
# GlitchTip containers
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker compose ps"

# Resource usage
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker stats --no-stream"

# View logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker compose logs -f"
```

### Send Test Error

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node -e \"
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });
Sentry.captureException(new Error('Test error - ' + new Date().toISOString()));
console.log('Test error sent');
setTimeout(() => process.exit(0), 2000);
\""
```

### View Worker Activity

```bash
# Last 20 events processed
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker compose logs worker --tail 20"
```

### Manual Backup

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "/opt/glitchtip/backup.sh"
```

### Restart Services

```bash
# Restart GlitchTip
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker compose restart"

# Restart single container
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker compose restart worker"
```

## Monitoring

### Health Check

```bash
# Quick status
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/glitchtip && docker compose ps && docker stats --no-stream"
```

**Expected State:**
- All containers: `Up`
- web RAM: <256 MiB
- worker RAM: <200 MiB
- Total RAM: <500 MiB

### Resource Limits

| Container | RAM Limit | CPU Limit |
|-----------|-----------|-----------|
| web | 256 MB | 0.5 |
| worker | 200 MB | 0.3 |
| postgres | unlimited | unlimited |
| redis | 100 MB | unlimited |

## Backups

**Schedule:** Daily at 3:00 AM (cron)
**Location:** `/var/backups/glitchtip/`
**Retention:** 30 days
**Format:** `glitchtip-YYYYMMDD-HHMM.sql.gz`

### Check Recent Backups

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "ls -lh /var/backups/glitchtip/"
```

### Restore from Backup

```bash
# Stop services
cd /opt/glitchtip && docker compose down

# Restore database
gunzip -c /var/backups/glitchtip/glitchtip-YYYYMMDD-HHMM.sql.gz | docker compose exec -T postgres psql -U glitchtip glitchtip

# Start services
docker compose up -d
```

## Troubleshooting

### Container Won't Start

```bash
# View startup logs
docker compose logs web --tail 50
docker compose logs worker --tail 50

# Check disk space
df -h

# Recreate containers
docker compose down && docker compose up -d
```

### High Memory Usage

```bash
# Check container stats
docker stats --no-stream

# Restart high-memory container
docker compose restart worker
```

### Errors Not Appearing

1. Check DSN in `.env`: `grep SENTRY_DSN /opt/ai-admin/.env`
2. Check worker logs: `docker compose logs worker --tail 20`
3. Send test error and verify capture
4. Check PM2 services are running: `pm2 status`

### Cannot Access UI

1. Ensure SSH tunnel is active
2. Check web container: `docker compose ps web`
3. Check port binding: `ss -tlnp | grep 8080`

## Rollback to Sentry

**If GlitchTip fails and needs rollback:**

```bash
# 1. Restore Sentry DSN
cd /opt/ai-admin
cp .env.backup-phase3-20251124-1654 .env

# 2. Restart services
pm2 restart all

# 3. Verify
grep SENTRY_DSN .env
# Should show: https://...@o4510346290069504.ingest.de.sentry.io/...

# 4. Stop GlitchTip (optional)
cd /opt/glitchtip && docker compose down
```

## File Locations

| File | Purpose |
|------|---------|
| `/opt/glitchtip/` | GlitchTip installation |
| `/opt/glitchtip/docker-compose.yml` | Service configuration |
| `/opt/glitchtip/.env` | GlitchTip secrets |
| `/opt/glitchtip/backup.sh` | Backup script |
| `/var/backups/glitchtip/` | Backup files |
| `/opt/ai-admin/.env` | AI Admin DSN config |
| `/opt/ai-admin/.env.backup-phase3-20251124-1654` | Sentry DSN backup |

## Support

**Documentation:**
- Migration docs: `dev/active/sentry-to-glitchtip-migration/`
- GlitchTip docs: https://glitchtip.com/documentation

**Issues:**
- Check logs first
- Review this troubleshooting guide
- Check GlitchTip GitHub issues

---

*Migrated 2025-11-24 | Updated 2025-11-25*
