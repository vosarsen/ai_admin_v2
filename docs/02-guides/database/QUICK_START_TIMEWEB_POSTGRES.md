# 🚀 Quick Start: Timeweb PostgreSQL

**Цель:** Быстро подключиться к Timeweb PostgreSQL и протестировать

**Время:** 10-15 минут

---

## 📋 Что у нас есть

**Timeweb PostgreSQL:**
- Host: `192.168.0.4` (внутренняя сеть VPS)
- Port: `5432`
- Database: `default_db`
- User: `gen_user`
- Password: `}X|oM595A<7n?0`

**Connection String:**
```
postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db
```

---

## 🎯 Быстрые шаги

### 1. Тест подключения (с VPS)

```bash
# SSH на VPS
ssh root@46.149.70.219

# Подключение к Timeweb PostgreSQL
psql 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db'

# Проверка
SELECT NOW();
SELECT version();
\dt  # Список таблиц (пока пусто)
\q   # Выход
```

**Ожидаем:** ✅ Подключение работает

---

### 2. Применить схему БД

```bash
# На VPS
cd /opt/ai-admin

# Применить схему
./scripts/apply-schema-timeweb.sh
```

**Ожидаем:**
- ✅ Таблицы созданы (companies, clients, bookings, etc.)
- ✅ Индексы созданы
- ✅ Триггеры работают

---

### 3. Проверка через приложение

```bash
# На VPS
cd /opt/ai-admin

# Установить зависимость (если нет)
npm install pg

# Тест через Node.js
node << 'EOF'
const { Client } = require('pg');

const client = new Client({
    user: 'gen_user',
    host: '192.168.0.4',
    database: 'default_db',
    password: '}X|oM595A<7n?0',
    port: 5432
});

(async () => {
  try {
    await client.connect();
    console.log('✅ Connected to Timeweb PostgreSQL');

    const res = await client.query('SELECT NOW()');
    console.log('Current time:', res.rows[0].now);

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));

    await client.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
EOF
```

**Ожидаем:** ✅ Подключение через Node.js работает

---

### 4. Локальное подключение (через SSH tunnel)

```bash
# Локально (открыть tunnel)
ssh -L 5433:192.168.0.4:5432 root@46.149.70.219 -N &

# В другом терминале
psql 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@localhost:5433/default_db'
```

**Использование в коде:**
```javascript
// .env (локально)
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
```

---

## ⚡ Быстрый тест приложения

### Обновить .env на VPS

```bash
# SSH на VPS
ssh root@46.149.70.219
cd /opt/ai-admin

# Добавить настройки Timeweb PostgreSQL
cat >> .env << 'EOF'

# Timeweb PostgreSQL
POSTGRES_HOST=192.168.0.4
POSTGRES_PORT=5432
POSTGRES_DATABASE=default_db
POSTGRES_USER=gen_user
POSTGRES_PASSWORD=}X|oM595A<7n?0

# Пока оставляем Supabase (для обратной совместимости)
USE_LEGACY_SUPABASE=true
EOF
```

### Тест модуля подключения

```bash
# Тест нового PostgreSQL модуля
node << 'EOF'
require('dotenv').config();
const postgres = require('./src/database/postgres');

(async () => {
  try {
    const res = await postgres.query('SELECT NOW() as time, version() as version');
    console.log('✅ Timeweb PostgreSQL ready!');
    console.log('Time:', res.rows[0].time);
    console.log('Version:', res.rows[0].version);

    // Статистика pool
    console.log('Pool stats:', postgres.getPoolStats());

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
EOF
```

**Ожидаем:** ✅ Модуль работает

---

## 📊 Что дальше?

### Этап 1: Миграция схемы ✅ (сделано выше)
- [x] Тест подключения
- [x] Применение схемы
- [x] Проверка таблиц

### Этап 2: Миграция данных (следующий шаг)
```bash
# Экспорт данных из Supabase
./scripts/export-supabase-data.sh

# Импорт в Timeweb PostgreSQL
./scripts/import-timeweb-data.sh
```

### Этап 3: Переключение приложения
```bash
# Обновить код для использования Timeweb PostgreSQL
# Тестирование
# Переключение USE_LEGACY_SUPABASE=false
```

---

## 🔧 Troubleshooting

### Ошибка подключения

```bash
# Проверка сети
ping 192.168.0.4

# Проверка порта
nc -zv 192.168.0.4 5432

# Проверка credentials
psql 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db' -c "SELECT 1"
```

### Медленные запросы

```sql
-- Проверить индексы
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public';

-- Проверить размер таблиц
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 📞 Полезные ссылки

- **Полная документация:** `docs/TIMEWEB_POSTGRES_MIGRATION.md`
- **Migration scripts:** `scripts/apply-schema-timeweb.sh`
- **PostgreSQL module:** `src/database/postgres.js`
- **Config:** `src/config/index.js` (database section)

---

## ✅ Чеклист готовности

- [ ] Подключение к Timeweb PostgreSQL работает
- [ ] Схема БД применена
- [ ] Node.js модуль работает
- [ ] SSH tunnel работает (для локальной разработки)
- [ ] .env файлы обновлены

**Всё готово?** → Переходим к миграции данных! 🚀

---

*Документ создан: 2025-10-31*
