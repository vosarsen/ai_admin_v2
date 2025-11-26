# Исправление сломанных ссылок на Supabase - Задачи

**Последнее обновление:** 2025-11-26 (v3 - после детального ревью plan-reviewer)
**Прогресс:** 0/55 задач (0%)

---

## Фаза -1: Pre-migration Backup 🆕
**Оценка:** 0.5 часа | **Статус:** Не начата | **Приоритет:** КРИТИЧЕСКИЙ

> **⚠️ БЕЗ ЭТОГО НЕ НАЧИНАТЬ ОСТАЛЬНЫЕ ФАЗЫ!**

### -1.1 Backup production базы
- [ ] SSH на сервер: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- [ ] Выполнить backup: `cd /opt/ai-admin && node scripts/backup/backup-postgresql.js`
- [ ] Проверить backup создан: `ls -lh /var/backups/postgresql/daily/`
- [ ] Записать имя backup файла: ____________

### -1.2 Сохранить состояние кода
- [ ] `git stash` если есть незакоммиченные изменения
- [ ] `git tag pre-supabase-fix-backup`
- [ ] `git push origin pre-supabase-fix-backup`
- [ ] Проверить tag создан: `git tag -l | grep pre-supabase`

**Rollback команды (сохранить!):**
```bash
# Код:
git checkout pre-supabase-fix-backup

# База (если нужно):
# Восстановить из backup файла
```

---

## Фаза 0: Создание недостающих таблиц
**Оценка:** 2 часа (было 1.5ч) | **Статус:** Не начата | **Приоритет:** КРИТИЧЕСКИЙ

> **ВАЖНО:** Без этих таблиц остальной код не будет работать!

### 0.1 Создать таблицу webhook_events
- [ ] Подключиться к Timeweb PostgreSQL
- [ ] Выполнить SQL из `scripts/database/create-webhook-events-table.sql`
- [ ] Проверить создание таблицы: `\d webhook_events`
- [ ] Проверить индексы созданы

**SQL:**
```sql
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

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_company_id ON webhook_events(company_id);
```

### 0.2 Создать таблицу marketplace_events
- [ ] Выполнить SQL из `migrations/add_marketplace_events_table.sql`
- [ ] Проверить создание таблицы: `\d marketplace_events`
- [ ] Проверить foreign key на companies

**SQL:**
```sql
CREATE TABLE IF NOT EXISTS marketplace_events (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  salon_id INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_events_company_id ON marketplace_events(company_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_salon_id ON marketplace_events(salon_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_type ON marketplace_events(event_type);
```

### 0.3 Создать таблицу appointments_cache (ПРАВИЛЬНАЯ структура)
- [ ] Создать новый SQL файл с правильной структурой
- [ ] Выполнить SQL
- [ ] Проверить создание таблицы: `\d appointments_cache`
- [ ] Проверить индексы созданы

**SQL (v3 - без duplicate datetime колонки):**
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

CREATE INDEX IF NOT EXISTS idx_appointments_cache_record_id ON appointments_cache(yclients_record_id);
CREATE INDEX IF NOT EXISTS idx_appointments_cache_company ON appointments_cache(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_cache_datetime ON appointments_cache(appointment_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_cache_status ON appointments_cache(status);
```

### 0.4 Rollback SQL (сохранить на случай проблем!)
```sql
-- Если нужно откатить создание таблиц:
DROP TABLE IF EXISTS appointments_cache;
DROP TABLE IF EXISTS marketplace_events;
DROP TABLE IF EXISTS webhook_events;
```

### 0.5 Проверка всех таблиц
- [ ] Выполнить `\dt` и убедиться что 16 таблиц (было 13 + 3 новые)
- [ ] Проверить что нет ошибок в логах PostgreSQL

---

## Фаза 1: Создание/расширение репозиториев
**Оценка:** 4.5 часа (было 3.5ч) | **Статус:** Не начата | **Приоритет:** P0

> ⚠️ **КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ (v3):** `BaseRepository` требует `db` в конструкторе!
> Смотри `src/repositories/BaseRepository.js` строки 21-26.
> **НЕПРАВИЛЬНО:** `constructor() { super('table_name'); }`
> **ПРАВИЛЬНО:** `constructor(db) { super(db); this.tableName = 'table_name'; }`

### 1.1 Создать WebhookEventsRepository
- [ ] Создать файл `src/repositories/WebhookEventsRepository.js`
- [ ] **⚠️ Наследовать от BaseRepository с `constructor(db) { super(db); }`**
- [ ] Добавить `this.tableName = 'webhook_events'` в конструктор
- [ ] Реализовать метод `exists(eventId)` - использовать `this.findOne()`
- [ ] Реализовать метод `insert(eventData)` - raw SQL с RETURNING
- [ ] Реализовать метод `markProcessed(eventId)` - UPDATE processed_at
- [ ] Добавить Sentry error tracking
- [ ] Добавить экспорт в `src/repositories/index.js`

### 1.2 Создать MarketplaceEventsRepository
- [ ] Создать файл `src/repositories/MarketplaceEventsRepository.js`
- [ ] **⚠️ Наследовать от BaseRepository с `constructor(db) { super(db); }`**
- [ ] Добавить `this.tableName = 'marketplace_events'` в конструктор
- [ ] Реализовать метод `insert(eventData)` - raw SQL с RETURNING
- [ ] Реализовать метод `findLatestByType(salonId, eventType)` - использовать `this.findMany()`
- [ ] Реализовать метод `findBySalonId(salonId)`
- [ ] Добавить Sentry error tracking
- [ ] Добавить экспорт в `src/repositories/index.js`

### 1.3 Создать AppointmentsCacheRepository
- [ ] Создать файл `src/repositories/AppointmentsCacheRepository.js`
- [ ] **⚠️ Наследовать от BaseRepository с `constructor(db) { super(db); }`**
- [ ] Добавить `this.tableName = 'appointments_cache'` в конструктор
- [ ] Реализовать метод `insert(appointmentData)` - **⚠️ извлекать client_phone из raw_data!**
- [ ] Реализовать метод `updateByRecordId(recordId, data)`
- [ ] Реализовать метод `findByRecordId(recordId)` - использовать `this.findOne()`
- [ ] Реализовать метод `markCancelled(recordId, reason)`
- [ ] Реализовать метод `findActive(companyId)` - WHERE deleted = false AND is_cancelled = false
- [ ] Добавить Sentry error tracking
- [ ] Добавить экспорт в `src/repositories/index.js`

### 1.4 Создать MessageRepository
- [ ] Создать файл `src/repositories/MessageRepository.js`
- [ ] **⚠️ Наследовать от BaseRepository с `constructor(db) { super(db); }`**
- [ ] Добавить `this.tableName = 'messages'` в конструктор
- [ ] Реализовать метод `findRecent(phone, since)` - использовать `this.findMany()`
- [ ] Добавить Sentry error tracking
- [ ] Добавить экспорт в `src/repositories/index.js`

### 1.5 Расширить CompanyRepository
- [ ] Добавить метод `findByYclientsId(yclientsId)` - использовать `this.findOne()`
- [ ] Добавить метод `updateByYclientsId(yclientsId, data)` - raw SQL
- [ ] Добавить метод `upsertByYclientsId(data)` - использовать `this.upsert()`
- [ ] Добавить метод `countConnected()` - raw SQL COUNT
- [ ] Добавить метод `countTotal()` - raw SQL COUNT
- [ ] Добавить Sentry к новым методам

### 1.6 Проверить BookingNotificationRepository
- [ ] Проверить существует ли файл
- [ ] Если нет - создать с методом insert()
- [ ] Если есть - проверить что метод insert() работает

### 1.7 Обновить index.js экспорты
- [ ] Добавить импорт WebhookEventsRepository
- [ ] Добавить импорт MarketplaceEventsRepository
- [ ] Добавить импорт AppointmentsCacheRepository
- [ ] Добавить импорт MessageRepository
- [ ] Добавить все в module.exports

---

## Фаза 2: Миграция файлов
**Оценка:** 6 часов (было 5ч) | **Статус:** Не начата | **Приоритет:** P0

### 2.0 Перепроверка grep ПЕРЕД началом миграции 🆕
- [ ] Выполнить: `grep -rn "await supabase\|this\.supabase" src/ --include="*.js" | grep -v archive | grep -v mcp-server`
- [ ] Сравнить результат с планом (должно быть 31 вызов в 5 файлах)
- [ ] Записать актуальные номера строк если изменились

**Ожидаемый результат grep (31 вызов):**
```
marketplace-service.js: 7 вызовов (строки 15, 49, 91, 239, 327, 350, 360)
webhook-processor/index.js: 9 вызовов (строки 433, 462, 485, 505, 513, 538, 560, 579, 589)
yclients-marketplace.js: 12 вызовов (строки 79, 131, 332, 361, 422, 432, 459, 603, 621, 638 + health)
webhooks/yclients.js: 2 вызова (строки 83, 95)
booking-ownership.js: 1 вызов (строка 252)
```

### 2.1 Мигрировать webhook-processor/index.js (9 вызовов, ~2h)
- [ ] Импортировать репозитории: MessageRepository, CompanyRepository, WebhookEventsRepository, AppointmentsCacheRepository, BookingNotificationRepository
- [ ] Инициализировать репозитории в конструкторе или в начале файла
- [ ] Строка 433: `supabase.from('messages')` → `messageRepository.findRecent()`
- [ ] Строка 462: `supabase.from('companies')` → `companyRepository.findByYclientsId()`
- [ ] Строка 485: `supabase.from('booking_notifications')` → `bookingNotificationRepository.insert()`
- [ ] Строка 505: `supabase.from('webhook_events')` → `webhookEventsRepository.markProcessed()`
- [ ] Строка 513: `supabase.from('appointments_cache').insert()` → `appointmentsCacheRepository.insert()`
- [ ] Строка 538: `supabase.from('appointments_cache').update()` → `appointmentsCacheRepository.updateByRecordId()`
- [ ] Строка 560: `supabase.from('appointments_cache').update()` → `appointmentsCacheRepository.markCancelled()`
- [ ] Строка 579: `supabase.from('appointments_cache').select()` → `appointmentsCacheRepository.findByRecordId()`
- [ ] Строка 589: `supabase.from('appointments_cache').select()` → `appointmentsCacheRepository.findByRecordId()`
- [ ] Удалить комментарий про Supabase (строка 2)
- [ ] Добавить Sentry error tracking
- [ ] Протестировать локально

### 2.2 Мигрировать yclients-marketplace.js (12 вызовов, ~1.5h)
- [ ] Импортировать репозитории: CompanyRepository, MarketplaceEventsRepository
- [ ] Инициализировать репозитории
- [ ] Строка 79: `supabase.from('companies').upsert()` → `companyRepository.upsertByYclientsId()`
- [ ] Строка 131: `supabase.from('marketplace_events').insert()` → `marketplaceEventsRepository.insert()`
- [ ] Строка 332: `supabase.from('marketplace_events').select()` → `marketplaceEventsRepository.findLatestByType()`
- [ ] Строка 361: `supabase.from('companies').update()` → `companyRepository.update()`
- [ ] Строка 422: `supabase.from('companies').update()` → `companyRepository.update()`
- [ ] Строка 432: `supabase.from('marketplace_events').insert()` → `marketplaceEventsRepository.insert()`
- [ ] Строка 459: `supabase.from('companies').update()` → `companyRepository.update()`
- [ ] Строка 525: `supabase: !!supabase` → `postgres: true`
- [ ] Строка 530: `database_connected: !!supabase` → `database_connected: true`
- [ ] Строка 603: handleUninstall → `companyRepository.updateByYclientsId()`
- [ ] Строка 621: handleFreeze → `companyRepository.updateByYclientsId()`
- [ ] Строка 638: handlePayment → `companyRepository.updateByYclientsId()`
- [ ] Удалить комментарий про Supabase (строка 4)
- [ ] Добавить Sentry error tracking
- [ ] Протестировать локально

### 2.3 Мигрировать marketplace-service.js (7 вызовов, ~0.5h)
- [ ] Импортировать CompanyRepository
- [ ] Удалить строку 15: `this.supabase = supabase`
- [ ] Инициализировать `this.companyRepository = new CompanyRepository()` в конструкторе
- [ ] Строка 49: `this.supabase.from('companies').select()` → `this.companyRepository.findByYclientsId()`
- [ ] Строка 91: `this.supabase.from('companies').insert()` → `this.companyRepository.create()`
- [ ] Строка 239: `this.supabase.from('companies').select()` → `this.companyRepository.findById()`
- [ ] Строка 327: `this.supabase.from('companies').update()` → `this.companyRepository.update()`
- [ ] Строка 350: подсчёт connected → `this.companyRepository.countConnected()`
- [ ] Строка 360: подсчёт total → `this.companyRepository.countTotal()`
- [ ] Удалить комментарий про Supabase (строка 3)
- [ ] Добавить Sentry error tracking
- [ ] Протестировать локально

### 2.4 Мигрировать webhooks/yclients.js (2 вызова, ~0.5h)
- [ ] Импортировать WebhookEventsRepository
- [ ] Инициализировать репозиторий
- [ ] Строка 83: `supabase.from('webhook_events').select()` → `webhookEventsRepository.exists()`
- [ ] Строка 95: `supabase.from('webhook_events').insert()` → `webhookEventsRepository.insert()`
- [ ] Добавить Sentry error tracking
- [ ] Протестировать локально

### 2.5 Мигрировать booking-ownership.js (2 вызова, ~0.5h)
- [ ] Импортировать AppointmentsCacheRepository или BookingRepository
- [ ] Изменить сигнатуру `syncFromDatabase(supabase)` → `syncFromDatabase()`
- [ ] Строка 252: `supabase.from('appointments_cache')` → `appointmentsCacheRepository.findActive()`
- [ ] Найти все вызовы `syncFromDatabase()` в других файлах и убрать параметр supabase
- [ ] Добавить Sentry error tracking
- [ ] Протестировать локально

---

## Фаза 3: Очистка и удаление
**Оценка:** 1 час | **Статус:** Не начата | **Приоритет:** P1

### 3.1 Удалить deprecated MCP файлы
- [ ] Удалить `src/mcp-server/supabase-server.js`
- [ ] Удалить `src/mcp-server/test-server.js`
- [ ] Удалить `src/mcp-server/mcp.json`
- [ ] Удалить `src/mcp-server/README.md`
- [ ] Проверить нет ли ссылок на эти файлы

### 3.2 Очистить config/index.js
- [ ] Удалить `supabaseUrl: process.env.SUPABASE_URL`
- [ ] Удалить `supabaseKey: getConfig('SUPABASE_KEY')`
- [ ] Удалить `useLegacySupabase: process.env.USE_LEGACY_SUPABASE`

### 3.3 Очистить config/secure-config.js
- [ ] Удалить `'supabase-key': 'SUPABASE_KEY'`

### 3.4 Очистить monitoring/health-check.js
- [ ] Удалить `'supabase'` из массива components (строка 55)

### 3.5 Очистить database/postgres.js
- [ ] Удалить проверки `USE_LEGACY_SUPABASE`
- [ ] Удалить fallback сообщения про Supabase
- [ ] Упростить логику инициализации

---

## Фаза 4: Тестирование и деплой
**Оценка:** 1.5 часа | **Статус:** Не начата | **Приоритет:** P0

### 4.1 Grep проверка
- [ ] `grep -r "await supabase" src/ --include="*.js" | grep -v archive` → должно быть пусто
- [ ] `grep -r "this.supabase" src/ --include="*.js" | grep -v archive` → должно быть пусто
- [ ] `grep -r "from.*supabase" src/ --include="*.js" | grep -v archive` → только комментарии

### 4.2 Локальное тестирование
- [ ] `npm test` - все тесты проходят
- [ ] Запустить приложение локально
- [ ] Проверить health endpoint
- [ ] Нет ошибок в консоли

### 4.3 Деплой на сервер
- [ ] `git add -A && git commit -m "fix: complete supabase removal - migrate broken references"`
- [ ] `git push origin main`
- [ ] SSH на сервер: `cd /opt/ai-admin && git pull origin main && npm install && pm2 restart all`

### 4.4 Мониторинг после деплоя
- [ ] `pm2 logs --lines 100` - нет ошибок supabase
- [ ] Отправить тестовое сообщение WhatsApp
- [ ] Проверить webhook обработку
- [ ] Проверить что записи создаются

---

## Сводка прогресса (v3)

| Фаза | Задач | Выполнено | Прогресс |
|------|-------|-----------|----------|
| Фаза -1: Backup 🆕 | 2 | 0 | 0% |
| Фаза 0: Таблицы | 5 | 0 | 0% |
| Фаза 1: Репозитории | 7 | 0 | 0% |
| Фаза 2: Миграция | 5 | 0 | 0% |
| Фаза 3: Очистка | 5 | 0 | 0% |
| Фаза 4: Тестирование | 4 | 0 | 0% |
| **Итого** | **28** | **0** | **0%** |

*Внутри каждой задачи ~55 подзадач (чекбоксов)*
*Оценка времени (v3): 16 часов*

---

## Команды для работы

```bash
# Подключение к PostgreSQL
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require"

# Проверка таблиц
\dt
\d webhook_events
\d marketplace_events
\d appointments_cache

# Grep проверки
grep -r "await supabase" src/ --include="*.js" | grep -v archive
grep -r "this.supabase" src/ --include="*.js" | grep -v archive

# Деплой
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull origin main && npm install && pm2 restart all"

# Логи
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs --lines 100"
```

---

## Заметки

### Открытия при ревью
- Структура appointments_cache в миграции Phase 08 **не соответствует** тому как её использует код
- Нужно создать **правильную структуру** под webhook-processor

### Вопросы
- Использовать ли datetime как alias для appointment_datetime в appointments_cache?

### Блокеры
- Нет (можем начинать)
