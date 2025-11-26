# Исправление сломанных ссылок на Supabase - Контекст

**Последнее обновление:** 2025-11-26 (v3 - после детального ревью plan-reviewer агентом)
**Статус проекта:** Планирование завершено (v3), готов к выполнению

---

## Текущее состояние

### Как была обнаружена проблема

1. При ревью плана `yclients-marketplace-full-integration` агентом `plan-reviewer` было обнаружено, что после проекта `supabase-full-removal` в файлах были удалены **только импорты**, а вызовы остались.

2. При дополнительном grep-поиске обнаружено **5 файлов** с 32 сломанными вызовами.

3. При проверке таблиц в Timeweb PostgreSQL обнаружено, что **3 таблицы отсутствуют**.

4. При анализе миграций обнаружено, что структура `appointments_cache` в миграции **не соответствует** тому, как её использует код.

---

## Результаты аудита

### Таблицы в Timeweb PostgreSQL (13 шт)
```
✅ booking_notifications    ✅ bookings
✅ clients                  ✅ companies
✅ messages                 ✅ services
✅ staff                    ✅ staff_schedules
✅ dialog_contexts          ✅ company_sync_status
✅ actions                  ✅ whatsapp_auth
✅ whatsapp_keys
```

### Отсутствующие таблицы (3 шт)
```
❌ webhook_events         - 3 вызова (webhook-processor + webhooks/yclients.js)
❌ marketplace_events     - 3 вызова в yclients-marketplace.js
❌ appointments_cache     - 5 вызовов в webhook-processor + 1 в booking-ownership
```

### Критическая проблема: appointments_cache

**Миграция Phase 08 создаёт:**
```sql
appointments_cache (
  id, company_id, cache_key, appointments JSONB, cached_at, expires_at
)
-- Это кэш по ДНЯМ, не отдельные записи!
```

**Код ожидает:**
```javascript
.insert({
  yclients_record_id,
  client_id,
  service_id,
  staff_id,
  appointment_datetime,
  cost,
  status,
  raw_data
})
-- Это ОТДЕЛЬНЫЕ записи!
```

**Решение:** Создать таблицу с правильной структурой под код.

---

## Ключевые файлы проекта

### Файлы для создания (репозитории)

| Файл | Таблица | Методы |
|------|---------|--------|
| `WebhookEventsRepository.js` | webhook_events | exists(), insert(), markProcessed() |
| `MarketplaceEventsRepository.js` | marketplace_events | insert(), findLatestByType(), findBySalonId() |
| `AppointmentsCacheRepository.js` | appointments_cache | insert(), updateByRecordId(), findByRecordId(), markCancelled(), findActive() |
| `MessageRepository.js` | messages | findRecent() |

### Файлы для расширения

| Файл | Добавить методы |
|------|-----------------|
| `CompanyRepository.js` | findByYclientsId(), updateByYclientsId(), upsertByYclientsId(), countConnected(), countTotal() |

### Сломанные файлы для миграции

| Файл | Вызовов | Таблицы |
|------|---------|---------|
| `webhook-processor/index.js` | 9 | messages, companies, booking_notifications, webhook_events, appointments_cache |
| `yclients-marketplace.js` | 12 | companies, marketplace_events |
| `marketplace-service.js` | 7 | companies |
| `webhooks/yclients.js` | 2 | webhook_events |
| `booking-ownership.js` | 2 | appointments_cache |

---

## Детальный аудит по файлам

### webhook-processor/index.js

| Строка | Метод | Таблица | Статус |
|--------|-------|---------|--------|
| 433 | shouldSkipNotification | messages | ✅ Есть |
| 462 | getCompanyInfo | companies | ✅ Есть |
| 485 | sendWhatsAppNotification | booking_notifications | ✅ Есть |
| 505 | markEventProcessed | webhook_events | ❌ НЕТ |
| 513 | saveBookingToCache | appointments_cache | ❌ НЕТ |
| 538 | updateBookingInCache | appointments_cache | ❌ НЕТ |
| 560 | markBookingAsCancelled | appointments_cache | ❌ НЕТ |
| 579 | getPreviousRecordData | appointments_cache | ❌ НЕТ |
| 589 | getCachedRecord | appointments_cache | ❌ НЕТ |

### yclients-marketplace.js

| Строка | Операция | Таблица | Статус |
|--------|----------|---------|--------|
| 79 | upsert | companies | ✅ Есть |
| 131 | insert | marketplace_events | ❌ НЕТ |
| 332 | select | marketplace_events | ❌ НЕТ |
| 361 | update | companies | ✅ Есть |
| 422 | update | companies | ✅ Есть |
| 432 | insert | marketplace_events | ❌ НЕТ |
| 459 | update | companies | ✅ Есть |
| 525 | health check | - | Исправить |
| 530 | health check | - | Исправить |
| 603 | update | companies | ✅ Есть |
| 621 | update | companies | ✅ Есть |
| 638 | update | companies | ✅ Есть |

### marketplace-service.js

| Строка | Операция | Таблица | Статус |
|--------|----------|---------|--------|
| 15 | this.supabase = | - | Удалить |
| 49 | select | companies | ✅ Есть |
| 91 | insert | companies | ✅ Есть |
| 239 | select | companies | ✅ Есть |
| 327 | update | companies | ✅ Есть |
| 350 | select count | companies | ✅ Есть |
| 360 | select count | companies | ✅ Есть |

### webhooks/yclients.js

| Строка | Операция | Таблица | Статус |
|--------|----------|---------|--------|
| 83 | select exists | webhook_events | ❌ НЕТ |
| 95 | insert | webhook_events | ❌ НЕТ |

### booking-ownership.js

| Строка | Операция | Таблица | Статус |
|--------|----------|---------|--------|
| 247 | syncFromDatabase(supabase) | - | Убрать параметр |
| 252 | select | appointments_cache | ❌ НЕТ |

---

## Существующие репозитории

```
src/repositories/
├── index.js                      # Экспорт
├── BaseRepository.js             # Базовый класс
├── BookingNotificationRepository.js  # ✅ Уже есть!
├── BookingRepository.js          # Записи
├── ClientRepository.js           # Клиенты
├── CompanyRepository.js          # Компании (расширить)
├── DialogContextRepository.js    # Контексты
├── ServiceRepository.js          # Услуги
├── StaffRepository.js            # Сотрудники
└── StaffScheduleRepository.js    # Расписания
```

---

## Принятые решения

### 1. Создать 3 недостающие таблицы
- `webhook_events` - для дедупликации и аудита webhook'ов
- `marketplace_events` - для логирования marketplace событий
- `appointments_cache` - **с ПРАВИЛЬНОЙ структурой** под код

### 2. Создать 4 новых репозитория
- WebhookEventsRepository
- MarketplaceEventsRepository
- AppointmentsCacheRepository
- MessageRepository

### 3. Расширить CompanyRepository
- Добавить 5 методов для marketplace

### 4. Удалить deprecated MCP
- supabase-server.js и связанные файлы больше не нужны

---

## SQL для создания таблиц

### webhook_events
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

CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_company_id ON webhook_events(company_id);
```

### marketplace_events
```sql
CREATE TABLE IF NOT EXISTS marketplace_events (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  salon_id INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marketplace_events_company_id ON marketplace_events(company_id);
CREATE INDEX idx_marketplace_events_salon_id ON marketplace_events(salon_id);
```

### appointments_cache (ПРАВИЛЬНАЯ структура)
```sql
CREATE TABLE IF NOT EXISTS appointments_cache (
  id SERIAL PRIMARY KEY,
  yclients_record_id INTEGER UNIQUE NOT NULL,
  company_id INTEGER NOT NULL,
  client_id INTEGER,
  client_phone VARCHAR(20),
  service_id INTEGER,
  staff_id INTEGER,
  appointment_datetime TIMESTAMPTZ,
  cost DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'confirmed',
  is_cancelled BOOLEAN DEFAULT FALSE,
  cancellation_reason TEXT,
  raw_data JSONB,
  deleted BOOLEAN DEFAULT FALSE,
  datetime TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_cache_record_id ON appointments_cache(yclients_record_id);
CREATE INDEX idx_appointments_cache_company ON appointments_cache(company_id);
CREATE INDEX idx_appointments_cache_datetime ON appointments_cache(appointment_datetime);
```

---

## Зависимости

### Блокирует
- `yclients-marketplace-full-integration` - не может продолжаться пока код сломан

### Зависит от
- Ничего

### Связан с
- `dev/completed/supabase-full-removal/` - это доработка основной миграции

---

## Тестовая стратегия

### После Фазы 0 (таблицы)
```bash
psql -c '\dt'  # Должно быть 16 таблиц
psql -c '\d webhook_events'
psql -c '\d marketplace_events'
psql -c '\d appointments_cache'
```

### После Фазы 1 (репозитории)
```bash
node -e "require('./src/repositories')"  # Без ошибок
```

### После Фазы 2 (миграция)
```bash
grep -r "await supabase" src/ --include="*.js" | grep -v archive  # Пусто
grep -r "this.supabase" src/ --include="*.js" | grep -v archive   # Пусто
```

### После Фазы 4 (деплой)
```bash
pm2 logs --lines 100 | grep -i "supabase\|undefined"  # Нет ошибок
```

---

## Заметки сессий

### Сессия 1 (2025-11-26)
- Обнаружена проблема при ревью yclients-marketplace плана
- Проведён grep поиск - найдено 5 файлов, 32 вызова
- Создан первоначальный план (9 часов)

### Сессия 2 (2025-11-26) - Ревью агентом
- Агент plan-reviewer нашёл ошибки в плане
- Неверно определены таблицы в webhook-processor
- Рекомендовано перечитать файлы и проверить таблицы

### Сессия 3 (2025-11-26) - Аудит таблиц
- Проверены таблицы в Timeweb PostgreSQL - 13 существуют
- Найдено 3 отсутствующие таблицы
- Обнаружено несоответствие структуры appointments_cache
- Найдены существующие миграции
- Обновлён план до 12.5 часов (+39%)

### Сессия 4 (2025-11-26) - Детальное ревью plan-reviewer агентом 🆕
**Оценка агента: 6.4/10 - ТРЕБУЕТ ДОРАБОТКИ**

**Критические проблемы найдены и исправлены:**

1. **Repository constructor pattern НЕПРАВИЛЬНЫЙ**
   - Проблема: План использовал `super('webhook_events')`, но `BaseRepository` требует `super(db)`
   - Решение: Исправлен паттерн во всех репозиториях на `constructor(db) { super(db); this.tableName = 'xxx'; }`

2. **Нет rollback/backup плана**
   - Проблема: Не было стратегии отката в случае проблем
   - Решение: Добавлена Фаза -1: Pre-migration Backup с командами backup/rollback

3. **datetime duplicate column**
   - Проблема: План содержал дублирующую колонку `datetime` как alias для `appointment_datetime`
   - Решение: Удалена дублирующая колонка, `booking-ownership.js` будет обновлён использовать `appointment_datetime`

4. **Время недооценено**
   - Было: 12.5 часов
   - Стало: 16 часов (+28%)

**Обновления в v3:**
- ✅ Добавлена Фаза -1: Pre-migration Backup
- ✅ Исправлен паттерн конструктора репозиториев
- ✅ Удалена duplicate datetime колонка
- ✅ Добавлены rollback команды в каждую фазу
- ✅ Обновлены оценки времени

**План готов к выполнению (v3)**

---

## Команды для работы

```bash
# Подключение к Timeweb PostgreSQL
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require"

# Проверка таблиц
\dt
\d webhook_events

# Grep проверки (локально)
grep -r "await supabase" src/ --include="*.js" | grep -v archive
grep -r "this.supabase" src/ --include="*.js" | grep -v archive

# Деплой
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull origin main && npm install && pm2 restart all"
```
