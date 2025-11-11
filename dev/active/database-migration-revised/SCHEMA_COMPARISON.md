# Schema Comparison: Supabase (Legacy) vs Timeweb (New)

**Date:** 2025-11-11
**Purpose:** Understand architectural differences between old and new schemas

---

## Key Architectural Differences

### **Philosophy:**

**Supabase (Legacy):**
- **"YClients-centric"** - Schema mirrors YClients API structure
- Stores **full API response** in `raw_data` JSONB column
- Rich client analytics (visit_history, loyalty_level, segments)
- AI integration fields (ai_context, ai_messages, satisfaction)
- Optimized for current WhatsApp bot functionality

**Timeweb (New - Phase 0.8):**
- **"Marketplace-centric"** - Schema designed for YClients Marketplace app
- Focused on **marketplace integration** (marketplace_app_id, permissions)
- Cleaner, normalized structure
- Subscription management (subscription_status)
- Multi-locale support (locale field)

---

## COMPANIES Table Comparison

### Supabase (Legacy) - 30+ columns
```sql
id                          integer PK
company_id                  integer           -- YClients company ID
yclients_id                 integer           -- Same as company_id
title                       varchar           -- Company name
address                     varchar           -- Full address
phone                       varchar
email                       varchar
website                     varchar
timezone                    varchar           -- "Europe/Moscow"
working_hours               varchar           -- "10:00-22:00"
coordinate_lat              numeric           -- Геолокация
coordinate_lon              numeric
currency                    varchar           -- "RUB"
ai_enabled                  boolean           -- AI бот включен
sync_enabled                boolean           -- Синхронизация включена
created_at                  timestamp
updated_at                  timestamp
last_sync_at                timestamp         -- Последняя синхронизация
raw_data                    jsonb             -- Полный ответ API YClients
whatsapp_enabled            boolean
whatsapp_config             jsonb
whatsapp_connected          boolean
whatsapp_phone              varchar
whatsapp_connected_at       timestamp
integration_status          varchar           -- "pending_whatsapp"
connected_at                timestamp
marketplace_user_id         varchar
marketplace_user_name       varchar
marketplace_user_phone      varchar
marketplace_user_email      varchar
whatsapp_session_data       jsonb
api_key                     varchar
webhook_secret              varchar
last_payment_date           timestamp
```

**Характеристика:**
- Хранит **всё** о компании
- Дублирование (company_id = yclients_id)
- Много полей для WhatsApp интеграции
- `raw_data` содержит полный API response

### Timeweb (New) - 16 columns
```sql
id                          integer PK
name                        varchar           -- Company name (НЕ title!)
yclients_company_id         integer           -- YClients ID (НЕ company_id!)
phone                       varchar
email                       varchar
website                     varchar
marketplace_app_id          varchar           -- NEW: Marketplace app ID
marketplace_connected_at    timestamp         -- NEW: Когда подключили
marketplace_permissions     jsonb             -- NEW: Разрешения marketplace
settings                    jsonb             -- Настройки (НЕ raw_data!)
timezone                    varchar
locale                      varchar           -- NEW: Язык интерфейса
is_active                   boolean           -- NEW: Активна ли компания
subscription_status         varchar           -- NEW: Статус подписки
created_at                  timestamp
updated_at                  timestamp
```

**Характеристика:**
- **Минимализм** - только необходимое
- Marketplace-первый подход
- `settings` вместо `raw_data`
- Нет WhatsApp полей (вынесены в отдельные таблицы?)
- Нет геолокации, адреса, часов работы
- Добавлена поддержка подписок

---

## Key Conceptual Differences

### 1. **Data Storage Philosophy**

**Legacy (Supabase):**
```javascript
// Хранит ВСЁ из YClients API
raw_data: {
  id: 962302,
  title: "KULTURA",
  address: "Малаховка, Южная 1",
  coordinate_lat: 55.646223,
  coordinate_lon: 38.006287,
  schedule: "10:00-22:00",
  // ... ещё 50+ полей
}
```

**New (Timeweb):**
```javascript
// Хранит только необходимое
settings: {
  // Минимальные настройки
  notifications: true,
  auto_sync: false
}
```

### 2. **Naming Convention**

**Legacy:**
- `company_id` - прямо из YClients API
- `title` - как в YClients
- `yclients_id` - дубликат для ясности

**New:**
- `yclients_company_id` - четкая привязка к источнику
- `name` - общепринятое имя поля
- Убран дубликат

### 3. **Integration Focus**

**Legacy: WhatsApp Integration**
```sql
whatsapp_enabled          boolean
whatsapp_config           jsonb
whatsapp_connected        boolean
whatsapp_phone            varchar
whatsapp_connected_at     timestamp
whatsapp_session_data     jsonb
```
6 колонок для WhatsApp!

**New: Marketplace Integration**
```sql
marketplace_app_id          varchar
marketplace_connected_at    timestamp
marketplace_permissions     jsonb
subscription_status         varchar
```
4 колонки для Marketplace

### 4. **Denormalization vs Normalization**

**Legacy:** Денормализация
- Всё в одной таблице
- `raw_data` = полный дамп API
- Дублирование данных для производительности

**New:** Нормализация
- Чистая структура
- Только актуальные поля
- Вероятно, связи с другими таблицами

---

## CLIENTS Table (Partial Comparison)

### Legacy: 40+ columns including:
```
yclients_id, name, phone, raw_phone, email, discount,
company_id, branch_ids[], tags[], status, source,
visit_count, total_spent, first_visit_date, last_visit_date,
last_services[], visit_history (jsonb),
preferences, last_sync_at, loyalty_level, client_segment,
average_bill, last_service_ids[], favorite_staff_ids[],
preferred_time_slots[], blacklisted, notes,
created_by_ai, last_ai_interaction, ai_context,
ai_messages_count, ai_satisfaction_score,
services_amount, goods_amount, goods_purchases[], goods_count
```

**Особенности:**
- **Аналитика**: visit_history, loyalty_level, segments
- **AI интеграция**: 7 полей для AI бота
- **Предпочтения**: favorite_staff, preferred_time_slots
- **Товары**: goods_amount, goods_purchases, goods_count

### New: Неизвестно точно, но вероятно:
```
id, yclients_id, name, phone, email, company_id,
created_at, updated_at
... (основные поля)
```

**Вероятно убрано:**
- visit_history (вынесено в отдельную таблицу?)
- AI поля (отдельная таблица?)
- Аналитика (вычисляется динамически?)

---

## Why "New" Schema Exists

### Hypothesis: Different Use Case

**Legacy schema (Supabase):**
- Создана для **WhatsApp бота**
- Оптимизирована под **быстрые запросы** (денормализация)
- Хранит **всю историю** для AI контекста
- **Монолит** - всё в одной таблице

**New schema (Timeweb/Phase 0.8):**
- Создана для **YClients Marketplace app**
- Оптимизирована под **CRUD операции** (нормализация)
- **Микросервисы** - данные разделены
- Подготовлена для **масштабирования**

### Evidence from column names:

**Marketplace focus:**
- `marketplace_app_id`
- `marketplace_connected_at`
- `marketplace_permissions`
- `subscription_status`

**Cleaned up:**
- No `raw_data` dump
- No WhatsApp fields in companies
- Shorter column names
- Standard naming (`name` not `title`)

---

## Problem Statement

**Current Situation:**
1. **Phases 1-3 written for Legacy schema**
   - Repository Pattern expects `company_id`, `yclients_id`
   - SupabaseDataLayer queries `title`, `raw_data`
   - Tests verify old column names

2. **Timeweb has New schema**
   - Different column names (`yclients_company_id`, `name`)
   - Different structure (no `raw_data`)
   - Missing fields (address, coordinates, etc.)

3. **Cannot migrate data without transformation**
   - Column name mismatch
   - Missing columns on both sides
   - Different data formats

---

## Is "New" Schema Better?

### Pros of New Schema ✅

1. **Cleaner naming**
   - `yclients_company_id` more explicit than `company_id`
   - No duplicate columns (company_id = yclients_id)

2. **Marketplace-ready**
   - Built-in subscription management
   - Permissions system
   - Multi-app support

3. **Normalization**
   - Less data duplication
   - Easier to maintain consistency

4. **Scalability**
   - Smaller tables → faster queries
   - Better for microservices architecture

### Cons of New Schema ❌

1. **Loses rich analytics**
   - No visit_history
   - No loyalty_level, client_segment
   - No AI integration fields

2. **Missing practical fields**
   - No address, coordinates (важно для карт)
   - No working_hours (важно для расписания)
   - No currency (важно для цен)

3. **Requires JOIN queries**
   - Data split across tables
   - Slower for dashboard queries
   - More complex SQL

4. **Not compatible with current bot**
   - All Phase 1-3 code needs rewrite
   - Tests need rewrite
   - High migration risk

---

## Recommendation: Which Schema to Use?

### For Current Project (AI Admin WhatsApp Bot):

**Legacy (Supabase) schema is better** ✅

**Why:**
1. **Optimized for bot use case**
   - visit_history for context
   - AI fields for bot state
   - Rich analytics for personalization

2. **Proven in production**
   - Works for 6+ months
   - All queries optimized
   - No unknown edge cases

3. **Fast queries**
   - Denormalization = no JOINs
   - All data in one SELECT
   - Critical for bot response time

4. **Phases 1-3 already done**
   - 2,500 LOC ready
   - All tests written
   - Zero rewrite needed

### For Future Marketplace App:

**New (Timeweb) schema makes sense** ⚠️

**But:**
- Different product
- Different requirements
- Can build alongside bot schema

---

## Decision Matrix

| Criteria | Legacy Schema | New Schema |
|----------|--------------|------------|
| **Bot Performance** | ✅ Excellent | ❌ Slower (JOINs) |
| **AI Integration** | ✅ Rich fields | ❌ Missing |
| **Analytics** | ✅ Built-in | ❌ Need computation |
| **Marketplace Ready** | ❌ No | ✅ Yes |
| **Code Compatibility** | ✅ 100% | ❌ 0% |
| **Migration Effort** | ✅ 2-3 hours | ❌ 1-2 weeks |
| **Future Scalability** | ⚠️ Adequate | ✅ Better |
| **Maintenance** | ⚠️ Some redundancy | ✅ Cleaner |

**Score: Legacy 6/8 vs New 3/8** for current bot use case

---

## Conclusion

**"New" schema (Timeweb) is architecturally cleaner but functionally insufficient for AI WhatsApp bot.**

**Recommendation:**
1. **Short term:** Use Legacy schema (Option 1 from PHASE_4_BLOCKER.md)
   - Migrate Supabase → Timeweb as-is
   - Keep denormalized structure
   - Bot works immediately

2. **Long term:** Gradually refactor
   - Phase 6+: Extract analytics to separate tables
   - Phase 7+: Normalize where beneficial
   - Keep what works (visit_history, AI fields)

**The "new" schema was designed for a different product (marketplace app), not for the WhatsApp bot we're building.**

---

**Decision:** Use Legacy (Supabase) schema for migration ✅

**Rationale:** Better fit for bot, preserves work, proven in production

**Next Step:** Re-create Timeweb schema to match Supabase (Option 1)

---

**Date:** 2025-11-11
**Author:** Analysis based on Phase 4 discovery
**Status:** Recommendation - awaiting confirmation
