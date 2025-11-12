# Миграция на Timeweb PostgreSQL

**Дата:** 2025-10-31
**Текущая БД:** Supabase PostgreSQL
**Новая БД:** Timeweb PostgreSQL (192.168.0.4:5432)
**Статус:** Планирование

---

## 📋 Текущее состояние

### Данные подключения Timeweb PostgreSQL

```bash
Host: 192.168.0.4
Port: 5432
Database: default_db
User: gen_user
Password: }X|oM595A<7n?0

# Node.js connection
const { Client } = require('pg');
const client = new Client({
    user: 'gen_user',
    host: '192.168.0.4',
    database: 'default_db',
    password: '}X|oM595A<7n?0',
    port: 5432
});
```

### Текущие таблицы в Supabase

| Таблица | Записей | Описание |
|---------|---------|----------|
| **companies** | 1 | Конфигурация компаний |
| **clients** | 1,292 | Клиенты салонов |
| **bookings** | 49 | Текущие записи |
| **services** | 63 | Услуги |
| **staff** | 12 | Мастера |
| **staff_schedules** | 56 | Расписания |
| **dialog_contexts** | 21 | AI контексты |
| **whatsapp_auth** | 1 | WhatsApp сессии |
| **whatsapp_keys** | ~100+ | WhatsApp ключи |
| **messages** | варьируется | История сообщений (партиционирована) |

---

## 🚀 План миграции (6 этапов)

### Этап 1: Подготовка и тестирование (День 1-2)

#### Шаг 1.1: Тест подключения к Timeweb PostgreSQL

```bash
# Локально (с VPS через SSH tunnel)
ssh -L 5433:192.168.0.4:5432 root@46.149.70.219 -N &

# Подключение через туннель
psql postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@localhost:5433/default_db

# Или напрямую с VPS
ssh root@46.149.70.219
psql postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db
```

#### Шаг 1.2: Проверка версии PostgreSQL

```sql
SELECT version();
-- Ожидаем: PostgreSQL 14 или выше

SHOW max_connections;
SHOW shared_buffers;
SHOW work_mem;
```

#### Шаг 1.3: Создать тестовую таблицу

```sql
-- Проверка прав
CREATE TABLE test_migration (
    id SERIAL PRIMARY KEY,
    data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO test_migration (data) VALUES ('Test from Timeweb');
SELECT * FROM test_migration;

-- Очистка
DROP TABLE test_migration;
```

**✅ Критерий успеха:**
- Подключение работает
- Права на CREATE/INSERT/SELECT есть
- Версия PostgreSQL 14+

---

### Этап 2: Экспорт схемы из Supabase (День 2-3)

#### Шаг 2.1: Создать скрипт экспорта схемы

Используем `pg_dump` для экспорта только схемы (без данных):

```bash
#!/bin/bash
# scripts/export-supabase-schema.sh

# Supabase connection (из .env)
SUPABASE_URL="https://yazteodihdglhoxgqunp.supabase.co"
SUPABASE_DB="postgresql://postgres:[PASSWORD]@db.yazteodihdglhoxgqunp.supabase.co:5432/postgres"

# Export schema only (no data)
pg_dump "$SUPABASE_DB" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  --no-security-labels \
  --no-subscriptions \
  --no-publications \
  --file=migrations/supabase-schema-export.sql

echo "✅ Schema exported to migrations/supabase-schema-export.sql"
```

#### Шаг 2.2: Очистка экспортированной схемы

После экспорта нужно:
1. Удалить Supabase-specific расширения (`supabase_*`, `realtime`, `pgsodium`, etc.)
2. Удалить RLS policies (если не поддерживаются)
3. Удалить `storage` таблицы (не используются)
4. Проверить совместимость с PostgreSQL 14+

**Создадим скрипт очистки:**

```bash
#!/bin/bash
# scripts/clean-exported-schema.sh

# Remove Supabase-specific extensions and features
sed -i '' '/CREATE EXTENSION.*supabase/d' migrations/supabase-schema-export.sql
sed -i '' '/CREATE EXTENSION.*realtime/d' migrations/supabase-schema-export.sql
sed -i '' '/CREATE EXTENSION.*pgsodium/d' migrations/supabase-schema-export.sql
sed -i '' '/storage\./d' migrations/supabase-schema-export.sql

echo "✅ Schema cleaned"
```

#### Шаг 2.3: Альтернатива - использовать существующие миграции

Вместо экспорта можно использовать:
1. `scripts/setup-database.sql` - основная схема
2. `migrations/*.sql` - все миграции

Создадим единый скрипт применения:

```bash
#!/bin/bash
# scripts/apply-all-migrations-timeweb.sh

TIMEWEB_DB="postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db"

# Apply base schema
psql "$TIMEWEB_DB" < scripts/setup-database.sql

# Apply all migrations in order
for migration in migrations/*.sql; do
  echo "Applying: $migration"
  psql "$TIMEWEB_DB" < "$migration"
done

echo "✅ All migrations applied to Timeweb PostgreSQL"
```

---

### Этап 3: Применение схемы в Timeweb PostgreSQL (День 3-4)

#### Шаг 3.1: Создать БД структуру

```bash
# С VPS
ssh root@46.149.70.219

# Применить базовую схему
cd /opt/ai-admin
./scripts/apply-all-migrations-timeweb.sh
```

#### Шаг 3.2: Проверка созданных таблиц

```sql
-- Подключение к Timeweb PostgreSQL
\c postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db

-- Список таблиц
\dt

-- Проверка конкретных таблиц
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Проверка индексов
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public';
```

**Ожидаемые таблицы:**
- ✅ companies
- ✅ clients
- ✅ bookings
- ✅ services
- ✅ staff
- ✅ staff_schedules
- ✅ dialog_contexts
- ✅ whatsapp_auth
- ✅ whatsapp_keys
- ✅ messages (партиции)
- ✅ analytics_events

---

### Этап 4: Обновление конфигурации приложения (День 4-5)

#### Шаг 4.1: Создать Database Adapter

Создадим универсальный адаптер для работы с любой PostgreSQL БД:

**Файл:** `src/database/postgres.js`

```javascript
// src/database/postgres.js
const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

// Создание connection pool для Timeweb PostgreSQL
const pool = new Pool({
  host: config.database.postgresHost || '192.168.0.4',
  port: config.database.postgresPort || 5432,
  database: config.database.postgresDatabase || 'default_db',
  user: config.database.postgresUser || 'gen_user',
  password: config.database.postgresPassword,
  max: 20, // Максимум connections в pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Обработка ошибок pool
pool.on('error', (err) => {
  logger.error('❌ Unexpected error on idle PostgreSQL client', err);
});

// Проверка подключения
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('❌ Failed to connect to Timeweb PostgreSQL:', err);
  } else {
    logger.info('✅ Connected to Timeweb PostgreSQL:', res.rows[0].now);
  }
});

// Экспорт pool и query helper
module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
```

#### Шаг 4.2: Обновить конфигурацию

**Файл:** `src/config/index.js`

```javascript
// Добавить в get database()
get database() {
  return {
    // Supabase (deprecated - будет удалено после миграции)
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: getConfig('SUPABASE_KEY'),

    // Timeweb PostgreSQL (новый)
    postgresHost: process.env.POSTGRES_HOST || '192.168.0.4',
    postgresPort: parseInt(process.env.POSTGRES_PORT) || 5432,
    postgresDatabase: process.env.POSTGRES_DATABASE || 'default_db',
    postgresUser: process.env.POSTGRES_USER || 'gen_user',
    postgresPassword: getConfig('POSTGRES_PASSWORD'),

    // Режим миграции
    useLegacySupabase: process.env.USE_LEGACY_SUPABASE === 'true',
  };
},
```

#### Шаг 4.3: Обновить .env файлы

**Локально:** `.env`

```bash
# Timeweb PostgreSQL (via SSH tunnel)
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DATABASE=default_db
POSTGRES_USER=gen_user
POSTGRES_PASSWORD=}X|oM595A<7n?0

# Legacy Supabase (для dual-write режима)
USE_LEGACY_SUPABASE=true
SUPABASE_URL=https://yazteodihdglhoxgqunp.supabase.co
SUPABASE_KEY=...
```

**Production (VPS):** `/opt/ai-admin/.env`

```bash
# Timeweb PostgreSQL (direct внутренняя сеть)
POSTGRES_HOST=192.168.0.4
POSTGRES_PORT=5432
POSTGRES_DATABASE=default_db
POSTGRES_USER=gen_user
POSTGRES_PASSWORD=}X|oM595A<7n?0

# Legacy Supabase (для dual-write режима)
USE_LEGACY_SUPABASE=true
SUPABASE_URL=https://yazteodihdglhoxgqunp.supabase.co
SUPABASE_KEY=...
```

---

### Этап 5: Миграция данных (День 5-7)

#### Шаг 5.1: Экспорт данных из Supabase

```bash
#!/bin/bash
# scripts/export-supabase-data.sh

SUPABASE_DB="postgresql://postgres:[PASSWORD]@db.yazteodihdglhoxgqunp.supabase.co:5432/postgres"
OUTPUT_DIR="migrations/data"

mkdir -p "$OUTPUT_DIR"

# Export каждой таблицы отдельно (для больших данных)
TABLES=(
  "companies"
  "clients"
  "bookings"
  "services"
  "staff"
  "staff_schedules"
  "dialog_contexts"
  "whatsapp_auth"
  "whatsapp_keys"
)

for table in "${TABLES[@]}"; do
  echo "Exporting $table..."
  pg_dump "$SUPABASE_DB" \
    --data-only \
    --table="$table" \
    --file="$OUTPUT_DIR/$table.sql"
done

echo "✅ Data exported to $OUTPUT_DIR/"
```

#### Шаг 5.2: Импорт данных в Timeweb PostgreSQL

```bash
#!/bin/bash
# scripts/import-timeweb-data.sh

TIMEWEB_DB="postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db"
DATA_DIR="migrations/data"

# Import в правильном порядке (с учетом foreign keys)
IMPORT_ORDER=(
  "companies"       # Сначала companies
  "clients"         # Потом clients (зависит от companies)
  "staff"           # Мастера
  "services"        # Услуги
  "staff_schedules" # Расписания
  "bookings"        # Записи (зависит от clients)
  "dialog_contexts" # Контексты
  "whatsapp_auth"   # WhatsApp сессии
  "whatsapp_keys"   # WhatsApp ключи
)

for table in "${IMPORT_ORDER[@]}"; do
  echo "Importing $table..."
  psql "$TIMEWEB_DB" < "$DATA_DIR/$table.sql"

  if [ $? -eq 0 ]; then
    echo "✅ $table imported successfully"
  else
    echo "❌ Failed to import $table"
    exit 1
  fi
done

echo "✅ All data imported to Timeweb PostgreSQL"
```

#### Шаг 5.3: Проверка импортированных данных

```sql
-- Подключение
\c postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db

-- Проверка количества записей
SELECT 'companies' as table_name, COUNT(*) FROM companies
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'staff', COUNT(*) FROM staff
UNION ALL
SELECT 'services', COUNT(*) FROM services
UNION ALL
SELECT 'dialog_contexts', COUNT(*) FROM dialog_contexts
UNION ALL
SELECT 'whatsapp_auth', COUNT(*) FROM whatsapp_auth
UNION ALL
SELECT 'whatsapp_keys', COUNT(*) FROM whatsapp_keys;
```

**Сравнить с Supabase:**
```sql
-- В Supabase
\c supabase_connection

SELECT 'companies' as table_name, COUNT(*) FROM companies
UNION ALL
...
```

**✅ Критерий успеха:** Количество записей совпадает

---

### Этап 6: Переключение на Timeweb PostgreSQL (День 7-8)

#### Шаг 6.1: Обновить код для использования Timeweb PostgreSQL

Заменить все импорты:

```javascript
// СТАРЫЙ КОД (Supabase)
const { supabase } = require('../database/supabase');
const { data } = await supabase.from('clients').select('*');

// НОВЫЙ КОД (Timeweb PostgreSQL)
const { query } = require('../database/postgres');
const { rows } = await query('SELECT * FROM clients');
```

Создадим универсальный адаптер:

**Файл:** `src/database/adapter.js`

```javascript
// src/database/adapter.js
const config = require('../config');
const logger = require('../utils/logger');

// Динамический выбор БД
let db;

if (config.database.useLegacySupabase) {
  // Legacy Supabase
  const { supabase } = require('./supabase');
  db = {
    async query(table, options = {}) {
      const query = supabase.from(table);

      if (options.select) query.select(options.select);
      if (options.where) query.match(options.where);
      if (options.order) query.order(options.order.column, { ascending: options.order.asc });
      if (options.limit) query.limit(options.limit);

      const { data, error } = await query;
      if (error) throw error;
      return { rows: data };
    }
  };
} else {
  // Timeweb PostgreSQL
  db = require('./postgres');
}

module.exports = db;
```

#### Шаг 6.2: Тестирование

```bash
# Локально
export USE_LEGACY_SUPABASE=false
npm run test

# Production
ssh root@46.149.70.219
cd /opt/ai-admin
export USE_LEGACY_SUPABASE=false
pm2 restart all

# Тест через MCP
@whatsapp send_message phone:89686484488 message:"Тест Timeweb PostgreSQL"

# Проверка логов
@logs logs_tail service:ai-admin-worker-v2 lines:100
```

#### Шаг 6.3: Мониторинг 24 часа

Проверять:
- ✅ Сообщения обрабатываются
- ✅ Записи создаются
- ✅ WhatsApp сессии сохраняются
- ✅ Нет ошибок подключения к БД

#### Шаг 6.4: Отключение Supabase

После 24 часов успешной работы:

```bash
# Обновить .env
sed -i 's/USE_LEGACY_SUPABASE=true/USE_LEGACY_SUPABASE=false/' /opt/ai-admin/.env

# Удалить SUPABASE_URL и SUPABASE_KEY (опционально, можно оставить на случай rollback)
# sed -i '/SUPABASE_URL/d' /opt/ai-admin/.env
# sed -i '/SUPABASE_KEY/d' /opt/ai-admin/.env

# Restart
pm2 restart all
```

---

## 💰 Преимущества миграции

### 1. **152-ФЗ Соответствие**
- ✅ Данные хранятся в РФ
- ✅ Персональные данные не покидают страну

### 2. **Производительность**
- ✅ Внутренняя сеть VPS ↔ PostgreSQL (<1ms latency)
- ✅ Нет интернет-задержек (vs 50-100ms в Supabase)
- ✅ Быстрее на 50-100x для запросов

### 3. **Надежность**
- ✅ Не зависит от доступности Supabase из РФ
- ✅ Локальные бэкапы
- ✅ Полный контроль

### 4. **Стоимость**
- **Текущая:** Supabase Free (но ограничения: 500MB, 2GB bandwidth)
- **Timeweb PostgreSQL:** ~1,500₽/мес (неограниченно)
- **Экономия:** 0₽/мес (но снимаем риски блокировки)

### 5. **Упрощение архитектуры**
- ✅ Один провайдер (Timeweb) для VPS + PostgreSQL
- ✅ Единое управление
- ✅ Меньше зависимостей

---

## 🔄 Rollback Plan

**Если миграция не удалась:**

```bash
# 1. Вернуть USE_LEGACY_SUPABASE=true
sed -i 's/USE_LEGACY_SUPABASE=false/USE_LEGACY_SUPABASE=true/' /opt/ai-admin/.env

# 2. Restart
pm2 restart all

# 3. Проверка
pm2 logs --lines 50
```

**Быстрота отката:** <5 минут

---

## 📋 Чеклист миграции

### Подготовка
- [ ] Timeweb PostgreSQL создан (192.168.0.4:5432)
- [ ] Тест подключения успешен
- [ ] Версия PostgreSQL 14+
- [ ] Права на CREATE/INSERT/SELECT

### Экспорт схемы
- [ ] Схема экспортирована из Supabase
- [ ] Схема очищена от Supabase-specific
- [ ] Скрипты миграций собраны

### Применение схемы
- [ ] Схема применена в Timeweb PostgreSQL
- [ ] Все таблицы созданы
- [ ] Индексы созданы
- [ ] Триггеры работают

### Миграция данных
- [ ] Данные экспортированы из Supabase
- [ ] Данные импортированы в Timeweb PostgreSQL
- [ ] Количество записей совпадает
- [ ] Foreign keys валидны

### Обновление кода
- [ ] Database adapter создан
- [ ] Конфигурация обновлена
- [ ] .env файлы обновлены (локально + production)
- [ ] Код протестирован

### Переключение
- [ ] USE_LEGACY_SUPABASE=false
- [ ] Приложение перезапущено
- [ ] Тесты пройдены
- [ ] Мониторинг 24 часа OK

### Финализация
- [ ] Supabase отключен
- [ ] Документация обновлена
- [ ] Команда уведомлена

---

## 📞 Поддержка

**Если возникли проблемы:**
1. Проверить логи: `@logs logs_tail service:ai-admin-worker-v2`
2. Проверить подключение: `psql postgresql://gen_user:...@192.168.0.4:5432/default_db`
3. Rollback на Supabase (см. Rollback Plan)

---

## ✅ Следующие шаги

**Сегодня (День 1):**
1. [ ] Тест подключения к Timeweb PostgreSQL
2. [ ] Создать скрипты экспорта схемы
3. [ ] Применить схему в Timeweb PostgreSQL

**Завтра (День 2-3):**
4. [ ] Экспорт данных из Supabase
5. [ ] Импорт данных в Timeweb PostgreSQL
6. [ ] Проверка данных

**Через 3-5 дней:**
7. [ ] Обновить код приложения
8. [ ] Тестирование
9. [ ] Переключение на Timeweb PostgreSQL

---

**Готов начать миграцию!** 🚀

*Документ создан: 2025-10-31*
*Следующий шаг: Тест подключения к Timeweb PostgreSQL*
