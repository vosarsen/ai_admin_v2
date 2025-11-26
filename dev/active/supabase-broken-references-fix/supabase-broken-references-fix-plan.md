# Исправление сломанных ссылок на Supabase

**Дата создания:** 2025-11-26
**Последнее обновление:** 2025-11-26 (v3 - после детального ревью plan-reviewer агентом)
**Статус:** Планирование завершено (v3)
**Приоритет:** КРИТИЧЕСКИЙ
**Оценка времени:** 15-16 часов (было 12-14, +24%)

---

## ⚠️ КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ (из ревью plan-reviewer)

> **Оценка агента: 6.4/10 - ТРЕБУЕТ ДОРАБОТКИ**

### Исправлено в v3:

1. **✅ Repository constructor pattern** — `BaseRepository` требует `db` в конструкторе, а не имя таблицы
2. **✅ Pre-migration backup** — добавлена Фаза -1 с backup стратегией
3. **✅ datetime duplicate column** — убрана дублирующая колонка, используем только `appointment_datetime`
4. **✅ Время пересмотрено** — 15-16 часов вместо 12-14 (+24%)
5. **✅ Rollback план** — добавлен в каждую фазу

### Найденные проблемы:

| Проблема | Серьёзность | Статус |
|----------|-------------|--------|
| Repository constructor без `db` | КРИТИЧЕСКАЯ | ✅ Исправлено |
| `marketplace-service.js` crash on startup | КРИТИЧЕСКАЯ | ✅ Учтено |
| Нет rollback/backup плана | ВЫСОКАЯ | ✅ Добавлено |
| datetime duplicate column | СРЕДНЯЯ | ✅ Удалено |

---

## Краткое описание

После завершения проекта `supabase-full-removal` (2025-11-26) было обнаружено, что в нескольких файлах были удалены только импорты `supabase`, но **фактические вызовы базы данных остались**. Кроме того, обнаружено, что **3 таблицы отсутствуют** в Timeweb PostgreSQL.

**Масштаб проблемы:**
- **5 файлов** с критически сломанным кодом
- **32 вызова** `supabase.*` которые выбросят ошибку
- **3 таблицы отсутствуют** в Timeweb PostgreSQL
- **3 файла** требуют очистки конфигурации
- **4 файла** можно удалить (deprecated MCP)

---

## Результаты аудита таблиц

### Таблицы в Timeweb PostgreSQL (13 шт):
```
✅ booking_notifications    ✅ bookings
✅ clients                  ✅ companies
✅ messages                 ✅ services
✅ staff                    ✅ staff_schedules
✅ dialog_contexts          ✅ company_sync_status
✅ actions                  ✅ whatsapp_auth
✅ whatsapp_keys
```

### ОТСУТСТВУЮЩИЕ таблицы (код ссылается!):
```
❌ appointments_cache     - 5 вызовов в webhook-processor
❌ webhook_events         - 3 вызова (webhook-processor + webhooks/yclients.js)
❌ marketplace_events     - 3 вызова в yclients-marketplace.js
```

### Миграции существуют:
- `scripts/database/create-webhook-events-table.sql` - webhook_events + booking_notifications
- `migrations/add_marketplace_events_table.sql` - marketplace_events
- `migrations/20251109_create_business_tables_phase_08.sql` - appointments_cache (но структура другая!)

---

## КРИТИЧЕСКАЯ ПРОБЛЕМА: appointments_cache

**Структура в миграции Phase 08:**
```sql
CREATE TABLE appointments_cache (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  cache_key VARCHAR(255) NOT NULL,    -- Формат: YYYY-MM-DD
  appointments JSONB NOT NULL,         -- JSON массив записей
  cached_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);
```

**Как код пытается использовать (webhook-processor):**
```javascript
await supabase.from('appointments_cache').insert({
  yclients_record_id: recordData.id,
  client_id: recordData.client?.id,
  service_id: recordData.services?.[0]?.id,
  staff_id: recordData.staff?.id,
  appointment_datetime: recordData.datetime,
  cost: ...,
  status: 'confirmed',
  raw_data: recordData
});
```

**Вывод:** Код ожидает таблицу для **отдельных записей**, а миграция создаёт **кэш по дням**. Это **разные структуры**!

**Решение:** Создать правильную таблицу appointments_cache или использовать существующую `bookings`.

---

## Детальный аудит сломанных файлов

### Файл 1: webhook-processor/index.js (9 вызовов)

| Строка | Метод | Таблица | Статус таблицы |
|--------|-------|---------|----------------|
| 433 | shouldSkipNotification | `messages` | ✅ Существует |
| 462 | getCompanyInfo | `companies` | ✅ Существует |
| 485 | sendWhatsAppNotification | `booking_notifications` | ✅ Существует |
| 505 | markEventProcessed | `webhook_events` | ❌ НЕТ |
| 513 | saveBookingToCache | `appointments_cache` | ❌ НЕТ (+ неверная структура) |
| 538 | updateBookingInCache | `appointments_cache` | ❌ НЕТ |
| 560 | markBookingAsCancelled | `appointments_cache` | ❌ НЕТ |
| 579 | getPreviousRecordData | `appointments_cache` | ❌ НЕТ |
| 589 | getCachedRecord | `appointments_cache` | ❌ НЕТ |

### Файл 2: yclients-marketplace.js (12 вызовов)

| Строка | Операция | Таблица | Статус таблицы |
|--------|----------|---------|----------------|
| 79 | upsert | `companies` | ✅ Существует |
| 131 | insert | `marketplace_events` | ❌ НЕТ |
| 332 | select | `marketplace_events` | ❌ НЕТ |
| 361 | update | `companies` | ✅ Существует |
| 422 | update | `companies` | ✅ Существует |
| 432 | insert | `marketplace_events` | ❌ НЕТ |
| 459 | update | `companies` | ✅ Существует |
| 525 | health check | - | Исправить на postgres: true |
| 530 | health check | - | Исправить на postgres: true |
| 603 | update (handleUninstall) | `companies` | ✅ Существует |
| 621 | update (handleFreeze) | `companies` | ✅ Существует |
| 638 | update (handlePayment) | `companies` | ✅ Существует |

### Файл 3: marketplace-service.js (7 вызовов)

| Строка | Операция | Таблица | Статус таблицы |
|--------|----------|---------|----------------|
| 15 | this.supabase = supabase | - | Удалить |
| 49 | select | `companies` | ✅ Существует |
| 91 | insert | `companies` | ✅ Существует |
| 239 | select | `companies` | ✅ Существует |
| 327 | update | `companies` | ✅ Существует |
| 350 | select (count connected) | `companies` | ✅ Существует |
| 360 | select (count total) | `companies` | ✅ Существует |

### Файл 4: webhooks/yclients.js (2 вызова)

| Строка | Операция | Таблица | Статус таблицы |
|--------|----------|---------|----------------|
| 83 | select (exists check) | `webhook_events` | ❌ НЕТ |
| 95 | insert | `webhook_events` | ❌ НЕТ |

### Файл 5: booking-ownership.js (2 вызова)

| Строка | Операция | Таблица | Статус таблицы |
|--------|----------|---------|----------------|
| 247 | syncFromDatabase(supabase) | - | Убрать параметр |
| 252 | select | `appointments_cache` | ❌ НЕТ (использовать bookings) |

---

## Обновлённый план по фазам

### Фаза -1: Pre-migration Backup (0.5 часа) 🆕
**Приоритет:** КРИТИЧЕСКИЙ - БЕЗ ЭТОГО НЕ НАЧИНАТЬ!

**Цель:** Создать точку восстановления перед любыми изменениями

**-1.1 Backup production базы:**
```bash
# На сервере
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Создать backup
cd /opt/ai-admin
node scripts/backup/backup-postgresql.js

# Проверить размер backup
ls -lh /var/backups/postgresql/daily/
```

**-1.2 Сохранить текущее состояние кода:**
```bash
# Локально
git stash  # если есть незакоммиченные изменения
git tag pre-supabase-fix-backup
git push origin pre-supabase-fix-backup
```

**Rollback план:**
```bash
# Если что-то пошло не так:
git checkout pre-supabase-fix-backup
# Восстановить базу из backup если нужно
```

---

### Фаза 0: Создание недостающих таблиц (2 часа, было 1.5ч)
**Приоритет:** КРИТИЧЕСКИЙ - без этого остальное не работает

**0.1 Создать webhook_events:**
```sql
-- Использовать scripts/database/create-webhook-events-table.sql
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  company_id INTEGER NOT NULL,
  record_id INTEGER,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**0.2 Создать marketplace_events:**
```sql
-- Использовать migrations/add_marketplace_events_table.sql
CREATE TABLE IF NOT EXISTS marketplace_events (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  salon_id INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**0.3 Создать appointments_cache (ПРАВИЛЬНАЯ структура):**
```sql
-- ⚠️ НЕ используем duplicate datetime колонку!
-- booking-ownership.js будет обновлён использовать appointment_datetime
CREATE TABLE IF NOT EXISTS appointments_cache (
  id SERIAL PRIMARY KEY,
  yclients_record_id INTEGER UNIQUE NOT NULL,
  company_id INTEGER NOT NULL,
  client_id INTEGER,
  client_phone VARCHAR(20),  -- ⚠️ Важно для booking-ownership.js!
  service_id INTEGER,
  staff_id INTEGER,
  appointment_datetime TIMESTAMPTZ,  -- Единственная колонка для даты/времени
  cost DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'confirmed',
  is_cancelled BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,  -- Для soft delete
  cancellation_reason TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_cache_record_id ON appointments_cache(yclients_record_id);
CREATE INDEX idx_appointments_cache_company ON appointments_cache(company_id);
CREATE INDEX idx_appointments_cache_datetime ON appointments_cache(appointment_datetime);
CREATE INDEX idx_appointments_cache_status ON appointments_cache(status);
```

**Rollback для таблиц:**
```sql
-- Если нужно откатить:
DROP TABLE IF EXISTS appointments_cache;
DROP TABLE IF EXISTS marketplace_events;
DROP TABLE IF EXISTS webhook_events;
```

---

### Фаза 1: Создание/расширение репозиториев (4.5 часа, было 3.5ч)

> ⚠️ **КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ:** `BaseRepository` требует `db` в конструкторе!
> Смотри `src/repositories/BaseRepository.js` строки 21-26.

**1.1 Создать WebhookEventsRepository** (новый)
```javascript
// src/repositories/WebhookEventsRepository.js
const BaseRepository = require('./BaseRepository');
const Sentry = require('@sentry/node');

class WebhookEventsRepository extends BaseRepository {
  // ✅ ПРАВИЛЬНО: передаём db в super()
  constructor(db) {
    super(db);
    this.tableName = 'webhook_events';
  }

  async exists(eventId) {
    const result = await this.findOne(this.tableName, { event_id: eventId });
    return !!result;
  }

  async insert(eventData) {
    // Используем raw SQL для INSERT с RETURNING
    const sql = `
      INSERT INTO ${this.tableName} (event_id, event_type, company_id, record_id, payload)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await this.db.query(sql, [
      eventData.event_id,
      eventData.event_type,
      eventData.company_id,
      eventData.record_id,
      JSON.stringify(eventData.payload)
    ]);
    return result.rows[0];
  }

  async markProcessed(eventId) {
    const sql = `UPDATE ${this.tableName} SET processed_at = NOW() WHERE event_id = $1`;
    await this.db.query(sql, [eventId]);
  }
}

module.exports = WebhookEventsRepository;
```

**1.2 Создать MarketplaceEventsRepository** (новый)
```javascript
// src/repositories/MarketplaceEventsRepository.js
const BaseRepository = require('./BaseRepository');

class MarketplaceEventsRepository extends BaseRepository {
  constructor(db) {
    super(db);  // ✅ ПРАВИЛЬНО
    this.tableName = 'marketplace_events';
  }

  async insert(eventData) {
    const sql = `
      INSERT INTO ${this.tableName} (company_id, salon_id, event_type, event_data)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await this.db.query(sql, [
      eventData.company_id,
      eventData.salon_id,
      eventData.event_type,
      JSON.stringify(eventData.event_data)
    ]);
    return result.rows[0];
  }

  async findLatestByType(salonId, eventType) {
    const result = await this.findMany(
      this.tableName,
      { salon_id: salonId, event_type: eventType },
      { orderBy: 'created_at', order: 'desc', limit: 1 }
    );
    return result[0] || null;
  }

  async findBySalonId(salonId) {
    return this.findMany(this.tableName, { salon_id: salonId });
  }
}

module.exports = MarketplaceEventsRepository;
```

**1.3 Создать AppointmentsCacheRepository** (новый)
```javascript
// src/repositories/AppointmentsCacheRepository.js
const BaseRepository = require('./BaseRepository');

class AppointmentsCacheRepository extends BaseRepository {
  constructor(db) {
    super(db);  // ✅ ПРАВИЛЬНО
    this.tableName = 'appointments_cache';
  }

  async insert(appointmentData) {
    // ⚠️ ВАЖНО: добавляем client_phone из raw_data если есть
    const sql = `
      INSERT INTO ${this.tableName}
      (yclients_record_id, company_id, client_id, client_phone, service_id, staff_id,
       appointment_datetime, cost, status, raw_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (yclients_record_id) DO UPDATE SET
        client_id = EXCLUDED.client_id,
        client_phone = EXCLUDED.client_phone,
        service_id = EXCLUDED.service_id,
        staff_id = EXCLUDED.staff_id,
        appointment_datetime = EXCLUDED.appointment_datetime,
        cost = EXCLUDED.cost,
        status = EXCLUDED.status,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
      RETURNING *
    `;
    const result = await this.db.query(sql, [
      appointmentData.yclients_record_id,
      appointmentData.company_id,
      appointmentData.client_id,
      appointmentData.client_phone || appointmentData.raw_data?.client?.phone,  // ⚠️ Извлекаем!
      appointmentData.service_id,
      appointmentData.staff_id,
      appointmentData.appointment_datetime,
      appointmentData.cost || 0,
      appointmentData.status || 'confirmed',
      JSON.stringify(appointmentData.raw_data)
    ]);
    return result.rows[0];
  }

  async updateByRecordId(recordId, data) {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
    setClauses.push(`updated_at = NOW()`);
    values.push(recordId);

    const sql = `
      UPDATE ${this.tableName}
      SET ${setClauses.join(', ')}
      WHERE yclients_record_id = $${paramIndex}
      RETURNING *
    `;
    const result = await this.db.query(sql, values);
    return result.rows[0];
  }

  async findByRecordId(recordId) {
    return this.findOne(this.tableName, { yclients_record_id: recordId });
  }

  async markCancelled(recordId, reason = null) {
    const sql = `
      UPDATE ${this.tableName}
      SET is_cancelled = true, cancellation_reason = $1, status = 'cancelled', updated_at = NOW()
      WHERE yclients_record_id = $2
      RETURNING *
    `;
    const result = await this.db.query(sql, [reason, recordId]);
    return result.rows[0];
  }

  // Для booking-ownership.js: находим активные записи
  async findActive(companyId) {
    return this.findMany(
      this.tableName,
      {
        company_id: companyId,
        deleted: false,
        is_cancelled: false
      },
      { orderBy: 'appointment_datetime', order: 'asc' }
    );
  }
}

module.exports = AppointmentsCacheRepository;
```

**1.4 Создать MessageRepository** (новый)
```javascript
// src/repositories/MessageRepository.js
const BaseRepository = require('./BaseRepository');

class MessageRepository extends BaseRepository {
  constructor(db) {
    super(db);  // ✅ ПРАВИЛЬНО
    this.tableName = 'messages';
  }

  // Используется в webhook-processor для проверки недавней активности
  async findRecent(phone, since) {
    return this.findMany(
      this.tableName,
      {
        phone: phone,
        direction: 'incoming',
        created_at: { gte: since }
      },
      { orderBy: 'created_at', order: 'desc', limit: 1 }
    );
  }
}

module.exports = MessageRepository;
```

**1.5 Расширить CompanyRepository**
```javascript
// Добавить в src/repositories/CompanyRepository.js:

async findByYclientsId(yclientsId) {
  return this.findOne('companies', { yclients_id: yclientsId });
}

async updateByYclientsId(yclientsId, data) {
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    setClauses.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }
  values.push(yclientsId);

  const sql = `
    UPDATE companies SET ${setClauses.join(', ')}, updated_at = NOW()
    WHERE yclients_id = $${paramIndex}
    RETURNING *
  `;
  const result = await this.db.query(sql, values);
  return result.rows[0];
}

async upsertByYclientsId(data) {
  return this.upsert('companies', data, ['yclients_id']);
}

async countConnected() {
  const sql = `SELECT COUNT(*) FROM companies WHERE whatsapp_connected = true`;
  const result = await this.db.query(sql);
  return parseInt(result.rows[0].count, 10);
}

async countTotal() {
  const sql = `SELECT COUNT(*) FROM companies`;
  const result = await this.db.query(sql);
  return parseInt(result.rows[0].count, 10);
}
```

**1.6 Обновить index.js экспорты**
```javascript
// src/repositories/index.js - добавить:
const WebhookEventsRepository = require('./WebhookEventsRepository');
const MarketplaceEventsRepository = require('./MarketplaceEventsRepository');
const AppointmentsCacheRepository = require('./AppointmentsCacheRepository');
const MessageRepository = require('./MessageRepository');

module.exports = {
  // ... существующие экспорты
  WebhookEventsRepository,
  MarketplaceEventsRepository,
  AppointmentsCacheRepository,
  MessageRepository
};
```

---

### Фаза 2: Миграция файлов (5 часов)

**2.1 webhook-processor/index.js** (~2h)
- Импортировать 4 репозитория
- Заменить 9 вызовов supabase
- Добавить Sentry error tracking

**2.2 yclients-marketplace.js** (~1.5h)
- Импортировать 2 репозитория
- Заменить 12 вызовов supabase
- Исправить health check

**2.3 marketplace-service.js** (~0.5h)
- Импортировать CompanyRepository
- Заменить 7 вызовов supabase

**2.4 webhooks/yclients.js** (~0.5h)
- Импортировать WebhookEventsRepository
- Заменить 2 вызова supabase

**2.5 booking-ownership.js** (~0.5h)
- Изменить syncFromDatabase() - использовать bookings вместо appointments_cache
- Или использовать AppointmentsCacheRepository

---

### Фаза 3: Очистка и удаление (1 час)

**3.1 Удалить deprecated MCP файлы:**
- `src/mcp-server/supabase-server.js`
- `src/mcp-server/test-server.js`
- `src/mcp-server/mcp.json`
- `src/mcp-server/README.md`

**3.2 Очистить конфигурацию:**
- `src/config/index.js` - удалить supabase*
- `src/config/secure-config.js` - удалить supabase-key
- `src/monitoring/health-check.js` - удалить 'supabase' из components
- `src/database/postgres.js` - удалить USE_LEGACY_SUPABASE логику

---

### Фаза 4: Тестирование и деплой (1.5 часа)

**4.1 Локальное тестирование**
- Запуск тестов
- Grep проверка на supabase
- Ручное тестирование endpoints

**4.2 Деплой**
- Git commit & push
- Деплой на сервер
- Мониторинг логов

---

## Обновлённая оценка времени (v3)

| Фаза | Задачи | Время v2 | Время v3 | Причина |
|------|--------|----------|----------|---------|
| -1. Pre-migration Backup 🆕 | Backup базы + git tag | - | 0.5h | Новая фаза |
| 0. Создание таблиц | 3 таблицы + индексы | 1.5h | 2h | +rollback SQL |
| 1. Репозитории | 4 новых + 1 расширение | 3.5h | 4.5h | Правильный паттерн |
| 2. Миграция файлов | 5 файлов, 32 вызова | 5h | 6h | Перепроверка строк |
| 3. Очистка | Удаление + конфиги | 1h | 1h | Без изменений |
| 4. Тестирование | Локально + деплой | 1.5h | 2h | +rollback тест |
| **ИТОГО** | | **12.5h** | **16h** | **+28%** |

**История оценок:**
- v1 (изначальная): 9 часов
- v2 (после аудита таблиц): 12.5 часов (+39%)
- v3 (после ревью plan-reviewer): **16 часов** (+78% от v1, +28% от v2)

---

## Риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Ошибки в структуре таблиц | Средняя | Высокое | Тестировать каждую миграцию |
| Несовместимость appointments_cache | Высокая | Среднее | Создать новую структуру под код |
| Пропущенные вызовы | Низкая | Среднее | Grep после каждой фазы |
| Проблемы foreign keys | Средняя | Высокое | Проверить связи перед созданием |

---

## Зависимости

- **Блокирует:** `yclients-marketplace-full-integration`
- **Зависит от:** Ничего
- **Связан с:** `dev/completed/supabase-full-removal/`

---

## Команды для выполнения миграций

```bash
# Подключение к Timeweb PostgreSQL
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Выполнить SQL
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require" -f script.sql

# Проверить таблицы
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require" -c '\dt'
```
