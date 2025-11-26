# Supabase Full Removal Plan

**Last Updated:** 2025-11-26
**Status:** Planning Complete, Ready for Implementation
**Estimated Effort:** 12-16 hours (3 days)
**Risk Level:** LOW (production already on Timeweb)
**Code Review Score:** 7.5/10 (see supabase-full-removal-code-review.md)

---

## Executive Summary

Полное удаление зависимости от Supabase из AI Admin v2 для соответствия 152-ФЗ. Production уже работает на Timeweb PostgreSQL с 11 ноября 2025, но кодовая база всё ещё содержит Supabase код, который нужно удалить.

### Key Decisions
- **Vector Memory Service:** Удалить полностью (dead code)
- **MCP Supabase Server:** Архивировать в archive/
- **Sync Modules:** Расширить существующие репозитории методом `bulkUpsert()`
- **SupabaseDataLayer:** Переименовать в `YClientsDataLayer`, удалить fallback логику

---

## Pre-Implementation Checklist

**ВАЖНО:** Перед началом Phase 2 убедись, что выполнены все пункты:

- [ ] Прочитан и понят дизайн SyncRepository (секция ниже)
- [ ] Feature flag аудит выполнен (38 ссылок проверены)
- [ ] Понятен порядок миграции sync модулей (по сложности)
- [ ] Backup создан и проверен
- [ ] Выбрано время деплоя (3-5 AM Moscow)

---

## Current State Analysis

### Production Environment
```bash
USE_LEGACY_SUPABASE=false      # ✅ Supabase отключен
USE_REPOSITORY_PATTERN=true    # ✅ Репозитории активны
```

### Code State (Problems)
| Category | Count | Status |
|----------|-------|--------|
| Files with supabase.from() | 30+ | ❌ Need removal |
| Sync modules using Supabase | 10 | ❌ Need migration |
| @supabase/supabase-js dependency | 1 | ❌ Need removal |
| SUPABASE_* env variables | 3 | ❌ Need removal |
| MCP Supabase server | 1 | ❌ Need archival |
| Dead code (vector-memory) | 1 dir | ❌ Need removal |

### Dead Code Identified
- `src/services/vector-memory/` - Never imported, OpenAI SDK not installed
- `src/database/optimized-supabase.js` - Replaced by Repository Pattern
- `src/integrations/whatsapp/auth-state-supabase.js` - Replaced by auth-state-timeweb.js

---

## Proposed Future State

### After Migration
- Zero Supabase dependencies in production code
- All data operations through Repository Pattern
- Clean sync modules using SyncRepository
- 152-ФЗ full compliance (all data in Russia)
- Reduced package size (~2MB less)

### Architecture
```
API Layer → Services → Repositories → PostgreSQL (Timeweb)
                                        ↓
                                   Russia Datacenter
```

---

## Implementation Phases

### Phase 1: Dead Code Removal (1-2 hours)

**Goal:** Remove all unused Supabase-related code

**Tasks:**
1. Delete `src/services/vector-memory/` directory
2. Delete `src/database/optimized-supabase.js`
3. Delete `src/integrations/whatsapp/auth-state-supabase.js`
4. Archive `mcp/mcp-supabase/` to `archive/mcp-supabase/`
5. Update `.mcp.json` to remove Supabase server reference

**Acceptance Criteria:**
- No unused Supabase files remain
- MCP config updated
- Git history preserved (archive, not delete MCP)

---

### Phase 2: Bulk Operations in Existing Repositories (3-4 hours)

**Goal:** Добавить `bulkUpsert()` методы в существующие репозитории

**Подход:** Расширяем существующие репозитории вместо создания отдельного SyncRepository.

**Обоснование:**
- Меньше дублирования кода
- Единый источник истины для каждой entity
- Проще тестировать
- Соответствует существующему Repository Pattern

**Изменения в BaseRepository:**
```javascript
// src/repositories/BaseRepository.js
class BaseRepository {
  // ... existing methods ...

  /**
   * Bulk upsert with optimized batching
   * @param {number} companyId - Company ID
   * @param {Array} items - Items to upsert
   * @param {Object} options - { batchSize: 100, conflictKey: 'yclients_id' }
   */
  async bulkUpsert(companyId, items, options = {}) {
    const { batchSize = 100, conflictKey = 'yclients_id' } = options;

    return this.withTransaction(async (client) => {
      const batches = this._chunk(items, batchSize);
      let totalUpserted = 0;

      for (const batch of batches) {
        const result = await this._bulkUpsertBatch(client, companyId, batch, conflictKey);
        totalUpserted += result.rowCount;
      }

      return { success: true, count: totalUpserted };
    });
  }

  _chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Subclasses implement this
  async _bulkUpsertBatch(client, companyId, batch, conflictKey) {
    throw new Error('bulkUpsertBatch must be implemented by subclass');
  }
}
```

**Изменения в каждом репозитории:**

| Repository | Method | Conflict Key | Batch Size |
|------------|--------|--------------|------------|
| ClientRepository | `bulkUpsert()` | `phone` | 100 |
| ServiceRepository | `bulkUpsert()` | `yclients_id` | 100 |
| StaffRepository | `bulkUpsert()` | `yclients_id` | 50 |
| StaffScheduleRepository | `bulkUpsert()` | `(staff_id, date)` | 200 |
| BookingRepository | `bulkUpsert()` | `yclients_id` | 100 |

**Performance Requirements:**
- 1,299 clients < 5 seconds
- 500 schedules < 3 seconds
- Must not exceed 2x Supabase baseline

**Acceptance Criteria:**
- [ ] BaseRepository.bulkUpsert() implemented
- [ ] All 5 repositories have _bulkUpsertBatch()
- [ ] Transaction support for bulk operations
- [ ] Sentry error tracking integrated
- [ ] Performance benchmarks passed

---

### Phase 3: Sync Modules Migration (5-6 hours)

**Goal:** Migrate all sync modules from Supabase to Repository Pattern

**Migration Order (by complexity, NOT criticality):**

⚠️ **ВАЖНО:** Порядок изменён! Начинаем с простых модулей без зависимостей.

| Order | Module | Complexity | Dependencies | Est. Time |
|-------|--------|------------|--------------|-----------|
| 1 | services-sync.js | LOW | None | 20 min |
| 2 | staff-sync.js | LOW | None | 20 min |
| 3 | company-info-sync.js | LOW | None | 15 min |
| 4 | clients-sync.js | MEDIUM | None | 30 min |
| 5 | schedules-sync.js | MEDIUM | staff | 30 min |
| 6 | visits-sync.js | MEDIUM | clients | 30 min |
| 7 | client-records-sync.js | MEDIUM | clients | 20 min |
| 8 | goods-transactions-sync.js | MEDIUM | clients | 20 min |
| 9 | **bookings-sync.js** | **HIGH** | clients, staff, services | **45 min** |

**Почему bookings последний:**
- Имеет foreign key зависимости на clients, staff, services
- Если они не работают - bookings точно сломается
- Наиболее критичный модуль = наиболее тщательное тестирование

**Pattern:**
```javascript
// BEFORE:
const { supabase } = require('../database/supabase');
await supabase.from('clients').upsert(clients, { onConflict: 'phone' });

// AFTER:
const postgres = require('../database/postgres');
const ClientRepository = require('../repositories/ClientRepository');
const clientRepo = new ClientRepository(postgres.pool);
await clientRepo.bulkUpsert(companyId, clients, { conflictKey: 'phone' });
```

**Testing After Each Module:**
```bash
# 1. Run sync manually
node -e "require('./src/sync/services-sync').syncServices()"

# 2. Check count
psql -c "SELECT COUNT(*) FROM services WHERE company_id = 962302"

# 3. Check Sentry (no new errors)

# 4. Commit only after success
git add src/sync/services-sync.js && git commit -m "refactor: migrate services-sync to Repository Pattern"
```

**Acceptance Criteria:**
- [ ] Each module tested individually BEFORE moving to next
- [ ] Sync cron jobs continue working
- [ ] No data loss during transition
- [ ] Sentry tracking for all errors
- [ ] Commit after each successful module

---

### Phase 4: Code Cleanup (2-3 hours)

**Goal:** Remove all remaining Supabase references

⚠️ **ВАЖНО:** Порядок операций критичен! Сначала убираем импорты, потом удаляем файлы.

**4.1 Clean Imports FIRST (6 files):**
```bash
# Сначала убираем все require('supabase') из сервисов
```
- [ ] `src/services/booking/index.js` - remove Supabase import
- [ ] `src/services/marketplace/marketplace-service.js` - remove Supabase usage
- [ ] `src/services/webhook-processor/index.js` - remove Supabase usage
- [ ] `src/services/whatsapp/database-cleanup.js` - use repository
- [ ] `src/services/ai-admin-v2/modules/data-loader.js` - use CompanyRepository
- [ ] `src/monitoring/health-check.js` - remove Supabase health check

**4.2 Rename and Simplify SupabaseDataLayer:**
```javascript
// src/integrations/yclients/data/supabase-data-layer.js
// → src/integrations/yclients/data/yclients-data-layer.js

// REMOVE: Fallback logic (dead code after migration)
// REMOVE: Constructor database parameter
// KEEP: Repository-based methods only
// ADD: Fail-fast if postgres.pool is null
```
- [ ] Rename file to `yclients-data-layer.js`
- [ ] Remove Supabase fallback logic (~200 lines)
- [ ] Update all imports (search: `supabase-data-layer`)
- [ ] Add startup validation: crash if postgres.pool is null

**4.3 Delete Core Supabase Files SECOND:**
```bash
# Только ПОСЛЕ того как все импорты убраны!
rm src/database/supabase.js
rm src/mcp-server/supabase-server.js  # if exists
```

**4.4 Update Configuration:**
- [ ] `npm uninstall @supabase/supabase-js`
- [ ] Remove `USE_LEGACY_SUPABASE` from `config/database-flags.js`
- [ ] Remove `SUPABASE_*` vars from `.env.example`

**4.5 Final Verification:**
```bash
# All must return 0 results:
grep -r "require.*supabase" src/
grep -r "from.*supabase" src/
grep -r "@supabase" package.json

# Run tests
npm test
```

**Acceptance Criteria:**
- [ ] `grep -r "supabase" src/` returns 0 results (except comments)
- [ ] Package size reduced (~2MB)
- [ ] All tests passing
- [ ] No runtime errors on startup

---

### Phase 5: Documentation & Deploy (1-2 hours)

**Goal:** Update documentation and deploy to production

**5.1 Documentation Updates:**
- [ ] `CLAUDE.md` - Remove Supabase references
- [ ] `docs/01-architecture/` - Update diagrams
- [ ] Create migration summary: `docs/03-development-diary/2025-XX-XX-supabase-removal.md`

---

## Production Deployment Checklist

### Pre-Deploy Checklist
- [ ] All Phase 1-4 tasks marked complete
- [ ] All tests passing (`npm test`)
- [ ] All sync modules migrated and tested individually
- [ ] Backup created and verified
- [ ] Rollback procedure reviewed
- [ ] Deploy window selected (3-5 AM Moscow time)

### Deploy Steps

```bash
# 1. SSH to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin

# 2. Create backup BEFORE any changes
node scripts/backup/backup-postgresql.js
# Verify: ls -la /var/backups/postgresql/daily/

# 3. Pull changes
git pull origin main

# 4. Install dependencies (removes @supabase/supabase-js)
npm install

# 5. Remove SUPABASE vars from .env
sed -i '/SUPABASE/d' .env

# 6. Restart with updated env
pm2 restart all --update-env

# 7. Monitor logs (5 minutes minimum)
pm2 logs --lines 100
```

### Post-Deploy Verification (Critical!)

| Check | Command | Expected |
|-------|---------|----------|
| PM2 status | `pm2 status` | All "online" |
| No errors | `pm2 logs --err --lines 50` | No DB errors |
| WhatsApp | Send to 89686484488 | Response <5s |
| Sync test | `node -e "require('./src/sync/schedules-sync').syncSchedules()"` | Success |
| Sentry | https://glitchtip.adminai.tech | No new errors |
| DB health | `npm run health-check` | All green |

### Rollback Trigger Conditions

🚨 **НЕМЕДЛЕННЫЙ ROLLBACK если:**
- Services won't start (PM2 shows "errored")
- WhatsApp bot not responding >2 minutes
- Sync fails with database errors
- Sentry shows >5 errors/minute
- Any "supabase" or "pool not available" errors

### Rollback Procedure

```bash
# Quick rollback (<5 min)
git revert HEAD
npm install  # Reinstalls @supabase/supabase-js
# Restore SUPABASE_* vars to .env
pm2 restart all --update-env

# Full rollback (<15 min) - if data corrupted
node scripts/backup/restore-postgresql.js --latest
git revert HEAD~N
npm install
pm2 restart all --update-env
```

**Acceptance Criteria:**
- [ ] All services running for 30+ minutes
- [ ] No Supabase errors in logs
- [ ] WhatsApp bot responding
- [ ] Sync jobs completing
- [ ] Sentry clean for 30 minutes

---

## Risk Assessment

### Risk Matrix (Updated from Code Review)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Sync fails after migration | LOW | HIGH | Test each module individually |
| Missing Supabase import | LOW | MEDIUM | grep verification before deploy |
| Production downtime | VERY LOW | HIGH | Rolling restart with PM2 |
| Data inconsistency | VERY LOW | HIGH | Backup before changes |
| **Performance degradation** | **MEDIUM** | **MEDIUM** | Benchmark bulkUpsert vs Supabase baseline |
| **postgres.pool null** | **LOW** | **HIGH** | Fail-fast validation on startup |

### New Risks (from Code Review)

#### Performance Degradation Risk
**Scenario:** Bulk operations без оптимизации могут быть в 10x медленнее.

```javascript
// BAD: Naive approach (64 seconds for 1,299 clients)
for (const client of clients) {
  await clientRepo.upsert(companyId, client);
}

// GOOD: Batched approach (<5 seconds for 1,299 clients)
await clientRepo.bulkUpsert(companyId, clients, { batchSize: 100 });
```

**Mitigation:**
1. Implement `bulkUpsert()` with batching (Phase 2)
2. Benchmark before/after: must be within 2x of Supabase
3. Set SLA: sync must complete in <5 seconds

#### postgres.pool Null Edge Case
**Scenario:** `postgres.pool` не инициализирован → fallback to Supabase → но Supabase уже удалён!

**Code Location:** `src/integrations/yclients/data/supabase-data-layer.js:55-59`

**Mitigation:**
1. Add startup validation (fail-fast if pool is null)
2. Remove fallback logic entirely in Phase 4.2
3. Monitor Sentry for "pool not available" errors

### Rollback Plan
```bash
# Quick rollback: < 5 minutes
git revert HEAD
ssh root@46.149.70.219 "cd /opt/ai-admin && git pull && npm install && pm2 restart all"

# Full rollback: < 15 minutes (if data corrupted)
node scripts/backup/restore-postgresql.js --latest
git revert HEAD~N
npm install
pm2 restart all --update-env
```

---

## Success Metrics

### Technical
- [ ] Zero `@supabase/supabase-js` in package.json
- [ ] Zero `SUPABASE_*` in production .env
- [ ] Zero `supabase.from()` in production code
- [ ] All sync modules passing
- [ ] All tests passing (165/167+)

### Functional
- [ ] WhatsApp bot responding
- [ ] YClients sync working
- [ ] Bookings being created
- [ ] No Sentry errors related to DB

### Compliance
- [ ] All data in Timeweb PostgreSQL (Russia)
- [ ] 152-ФЗ fully compliant
- [ ] No external database dependencies

---

## Timeline (Updated)

| Day | Phase | Hours | Deliverable |
|-----|-------|-------|-------------|
| 1 | Phase 1 | 1h | Dead code removed |
| 1 | Phase 2 | 3-4h | bulkUpsert() in all repositories |
| 2 | Phase 3 (modules 1-5) | 3h | services, staff, company, clients, schedules migrated |
| 2 | Phase 3 (modules 6-9) | 3h | visits, client-records, goods, bookings migrated |
| 3 | Phase 4 | 2-3h | Code cleanup complete |
| 3 | Phase 5 | 1-2h | Documentation + Deploy |

**Total: 3 days (12-16 hours)**

### Day-by-Day Breakdown

**Day 1 (4-5 hours):**
- Morning: Phase 1 - delete dead code, archive MCP
- Afternoon: Phase 2 - implement bulkUpsert() in BaseRepository + all repos
- Evening: Run benchmarks, verify performance

**Day 2 (5-6 hours):**
- Morning: Migrate modules 1-5 (simpler, no deps)
- Afternoon: Migrate modules 6-9 (including critical bookings-sync)
- Evening: Full sync cycle test, check Sentry

**Day 3 (3-5 hours):**
- Morning: Phase 4 - clean imports, rename DataLayer, delete files
- Afternoon: Phase 5 - docs + production deploy (3-5 AM window)
- Evening: Monitor for 2 hours, mark complete
