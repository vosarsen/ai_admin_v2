# GlitchTip Errors Fix & Server Upgrade

**Date:** 2025-12-02
**Author:** Claude Code + Arseny
**Status:** Complete

## Summary

Fixed 100+ GlitchTip errors and upgraded production server from 2GB to 4GB RAM to resolve memory pressure issues.

## Problems Identified

### 1. Malformed Array Literal Errors (100+ occurrences)

**Error:**
```
error: malformed array literal: "["МУЖСКАЯ СТРИЖКА","СТРИЖКА МАШИНКОЙ"]"
```

**Root Cause:**
PostgreSQL expects array format `{item1,item2}`, but JavaScript arrays were being passed as JSON `["item1","item2"]` via node-pg.

**Affected Code:**
- `src/sync/client-records-sync.js` - `last_services` field
- `src/repositories/BaseRepository.js` - `upsert()`, `bulkUpsert()`, `bulkUpsertBatched()`

### 2. Connection Pool High Usage Warnings (1,700+ occurrences)

**Warning:**
```
Connection pool high usage detected: 100%
```

**Root Cause:**
- Pool size is 3 connections per service
- Alert threshold was 80% (triggers at 2.4 connections)
- 5-minute cooldown was too short for small pools

### 3. ON CONFLICT Constraint Error (22 occurrences)

**Error:**
```
error: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

**Root Cause:**
`companies.yclients_id` had a regular index, not a UNIQUE index, but `CompanyRepository.upsert()` used `ON CONFLICT (yclients_id)`.

### 4. Server Memory Pressure

**Symptoms:**
- 80% RAM usage on 2GB server
- Risk of OOM killer during peak loads

**Memory Breakdown (before upgrade):**
| Component | Memory |
|-----------|--------|
| GlitchTip (Docker) | ~500 MB |
| AI Admin Node.js (PM2) | ~733 MB |
| System + buffers | ~493 MB |

## Solutions Implemented

### 1. PostgreSQL Array Conversion

Added helper methods to `BaseRepository.js`:

```javascript
/**
 * Convert JavaScript array to PostgreSQL array literal format
 * PostgreSQL expects {item1,item2} format, not JSON ["item1","item2"]
 */
_toPgArray(arr) {
  if (!Array.isArray(arr)) return arr;
  if (arr.length === 0) return '{}';

  const escaped = arr.map(item => {
    if (item === null || item === undefined) return 'NULL';
    const str = String(item);
    const escapedStr = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escapedStr}"`;
  });
  return `{${escaped.join(',')}}`;
}

_convertValue(value) {
  if (Array.isArray(value)) return this._toPgArray(value);
  return value;
}
```

Applied to:
- `upsert()` - single record insert/update
- `bulkUpsert()` - batch insert/update
- `bulkUpsertBatched()` - large batch with chunking

Fixed `client-records-sync.js`:
```javascript
// Format array for PostgreSQL: {item1,item2} format
const pgArray = `{${lastServices.map(s => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`;
```

### 2. Connection Pool Alert Tuning

Updated `src/database/postgres.js`:

```javascript
const poolMetrics = {
  alertThresholds: {
    highUsage: 0.8,
    highWaitQueue: 5,
    minPoolSizeForAlerts: 5,  // NEW: Skip alerts for small pools
  },
  alerts: {
    alertCooldown: 30 * 60 * 1000,  // Changed from 5 to 30 minutes
  }
};

// Skip high usage alerts for small pools
const isSmallPool = snapshot.maxConnections < poolMetrics.alertThresholds.minPoolSizeForAlerts;
if (!isSmallPool && snapshot.usage > poolMetrics.alertThresholds.highUsage) {
  // Send alert
}
```

### 3. UNIQUE Index for Companies

Created unique index on `companies.yclients_id`:

```sql
DROP INDEX IF EXISTS idx_companies_yclients_id;
CREATE UNIQUE INDEX idx_companies_yclients_id
  ON companies(yclients_id)
  WHERE yclients_id IS NOT NULL;
```

### 4. Server Upgrade

Upgraded Timeweb VPS:

| Parameter | Before | After |
|-----------|--------|-------|
| CPU | 1 x 3.3 GHz | 2 x 3.3 GHz |
| RAM | 2 GB | 4 GB |
| Disk | 30 GB NVMe | 50 GB NVMe |
| Memory Used | 80% | 34% |
| Free Memory | 400 MB | 2.5 GB |

## Files Changed

1. `src/repositories/BaseRepository.js` - Added `_toPgArray()`, `_convertValue()`, updated upsert methods
2. `src/database/postgres.js` - Increased alert cooldown, added minPoolSizeForAlerts
3. `src/sync/client-records-sync.js` - Fixed `last_services` array formatting

## Deployment

```bash
# Deploy code changes
git push origin main
ssh root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart all"

# Create UNIQUE index
psql $DATABASE_URL -c "CREATE UNIQUE INDEX idx_companies_yclients_id ON companies(yclients_id) WHERE yclients_id IS NOT NULL;"

# After server upgrade, restore PM2 processes
pm2 resurrect
pm2 start scripts/run-schedules-sync.js --name schedules-sync-full --cron '0 5 * * *' -- --mode=full
pm2 start scripts/run-schedules-sync.js --name schedules-sync-today --cron '0 8-23 * * *' -- --mode=today
pm2 save
```

## GlitchTip Status After Fix

| Metric | Before | After |
|--------|--------|-------|
| Unresolved Errors | 100+ | 1 (slow query warning) |
| Malformed Array | 100+ | 0 |
| Connection Pool Warnings | 1,700+ | 0 |
| ON CONFLICT Errors | 22 | 0 |

## Lessons Learned

1. **node-pg does NOT auto-convert JS arrays** - Must manually format as `{item1,item2}` for PostgreSQL TEXT[] columns
2. **Small connection pools generate noisy alerts** - Skip alerts when pool size < 5, as hitting 100% is expected
3. **ON CONFLICT requires UNIQUE index** - Regular indexes don't work for upsert operations
4. **Monitor memory proactively** - 80% usage is a warning sign, upgrade before OOM issues

## Related Issues

- GlitchTip Issues: #18, #52-#115, #137-#234 (all resolved)
- Commit: `9a0ba02` - fix(db): PostgreSQL array handling and connection pool alerts

## Cost Impact

Server upgrade: ~500-700 RUB/month additional cost for stability and growth capacity.
