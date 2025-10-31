# 📊 Timeweb PostgreSQL - Краткая сводка

**Дата:** 2025-10-31
**Статус:** Подготовка к миграции
**Приоритет:** Высокий (152-ФЗ соответствие)

---

## ✅ Что уже сделано

### 1. Создана БД на Timeweb
- ✅ PostgreSQL создан
- ✅ Внутренняя сеть VPS: `192.168.0.4:5432`
- ✅ База данных: `default_db`
- ✅ Пользователь: `gen_user`
- ✅ Пароль: `}X|oM595A<7n?0`

### 2. Подготовлена инфраструктура
- ✅ Документация миграции: `docs/TIMEWEB_POSTGRES_MIGRATION.md`
- ✅ Quick Start: `QUICK_START_TIMEWEB_POSTGRES.md`
- ✅ Скрипты миграции:
  - `scripts/test-timeweb-connection.sh` - тест подключения
  - `scripts/apply-schema-timeweb.sh` - применение схемы

### 3. Обновлен код приложения
- ✅ PostgreSQL модуль: `src/database/postgres.js`
- ✅ Конфигурация: `src/config/index.js` (database section)
- ✅ .env файлы обновлены (локально + production example)

### 4. Режим dual-database
- ✅ `USE_LEGACY_SUPABASE=true` - использовать Supabase (по умолчанию)
- ✅ `USE_LEGACY_SUPABASE=false` - использовать Timeweb PostgreSQL

---

## 🎯 Следующие шаги

### Этап 1: Тест подключения (1-2 часа)
```bash
# На VPS
ssh root@46.149.70.219
cd /opt/ai-admin

# Тест подключения
./scripts/test-timeweb-connection.sh
```

**Ожидаемый результат:**
- ✅ Подключение работает
- ✅ Версия PostgreSQL 14+
- ✅ Права на CREATE/INSERT/SELECT есть

---

### Этап 2: Применение схемы (2-3 часа)
```bash
# Применить схему БД
./scripts/apply-schema-timeweb.sh

# Проверка
psql 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db' -c "\dt"
```

**Ожидаемый результат:**
- ✅ Таблицы созданы: companies, clients, bookings, services, staff, etc.
- ✅ Индексы созданы
- ✅ Триггеры работают

---

### Этап 3: Миграция данных (4-6 часов)

#### 3.1 Экспорт из Supabase
```bash
# Создать скрипты экспорта (TODO)
./scripts/export-supabase-data.sh
```

#### 3.2 Импорт в Timeweb
```bash
# Импортировать данные (TODO)
./scripts/import-timeweb-data.sh
```

#### 3.3 Валидация
```sql
-- Сравнить количество записей
SELECT 'clients' as table, COUNT(*) FROM clients
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'staff', COUNT(*) FROM staff;
```

---

### Этап 4: Тестирование (2-4 часа)
```bash
# Переключить на Timeweb PostgreSQL
export USE_LEGACY_SUPABASE=false

# Тест модуля
node -e "
require('dotenv').config();
const postgres = require('./src/database/postgres');
postgres.query('SELECT NOW()').then(r => console.log('✅', r.rows));
"

# Тест приложения
pm2 restart all
pm2 logs --lines 100
```

**Проверить:**
- ✅ WhatsApp сессии работают
- ✅ Сообщения обрабатываются
- ✅ Записи создаются
- ✅ Нет ошибок БД

---

### Этап 5: Production переключение (1 день)
```bash
# Обновить .env на VPS
echo "USE_LEGACY_SUPABASE=false" >> /opt/ai-admin/.env

# Restart
pm2 restart all

# Мониторинг 24 часа
pm2 monit
```

---

## 💰 Преимущества миграции

| Параметр | Supabase | Timeweb PostgreSQL |
|----------|----------|-------------------|
| **Локация** | За рубежом | РФ (152-ФЗ ✅) |
| **Латентность** | 50-100ms | <1ms (внутри VPS) |
| **Надежность** | Зависит от Supabase | Полный контроль |
| **Стоимость** | $0 (ограничения) | ~1,500₽/мес |
| **Производительность** | Базовая | 50-100x быстрее |

---

## 🔄 Rollback план

**Если что-то пошло не так:**
```bash
# Вернуть Supabase
export USE_LEGACY_SUPABASE=true
pm2 restart all

# Проверка
pm2 logs --lines 50
```

**Время отката:** <5 минут

---

## 📂 Структура файлов миграции

```
docs/
├── TIMEWEB_POSTGRES_MIGRATION.md     # Полная документация
├── TIMEWEB_POSTGRES_SUMMARY.md       # Эта сводка
└── QUICK_START_TIMEWEB_POSTGRES.md   # Быстрый старт

scripts/
├── test-timeweb-connection.sh         # Тест подключения
├── apply-schema-timeweb.sh            # Применение схемы
├── export-supabase-data.sh            # TODO: Экспорт данных
└── import-timeweb-data.sh             # TODO: Импорт данных

src/
├── database/
│   ├── supabase.js                    # Legacy Supabase
│   └── postgres.js                    # NEW: Timeweb PostgreSQL
└── config/
    └── index.js                       # Обновлен: database section

.env                                    # Локальные настройки
.env.production.example                 # Production шаблон
```

---

## 📋 Чеклист миграции

### Подготовка
- [x] PostgreSQL создан на Timeweb
- [x] Документация создана
- [x] Скрипты миграции созданы
- [x] Код обновлен

### Выполнение (TODO)
- [ ] Тест подключения
- [ ] Применение схемы
- [ ] Экспорт данных из Supabase
- [ ] Импорт данных в Timeweb
- [ ] Валидация данных
- [ ] Тестирование приложения
- [ ] Production переключение
- [ ] Мониторинг 24 часа

### Завершение (TODO)
- [ ] Отключение Supabase
- [ ] Документация обновлена
- [ ] Команда уведомлена

---

## 🚀 Готовность к старту

**Статус:** ✅ Готово к началу миграции

**Время выполнения:** 1-2 дня (в рабочее время)

**Следующий шаг:**
```bash
ssh root@46.149.70.219
cd /opt/ai-admin
./scripts/test-timeweb-connection.sh
```

---

## 📞 Контакты

**При проблемах:**
1. Проверить логи: `pm2 logs --lines 100`
2. Rollback на Supabase: `USE_LEGACY_SUPABASE=true`
3. Документация: `docs/TIMEWEB_POSTGRES_MIGRATION.md`

---

*Документ создан: 2025-10-31*
*Статус: Готов к миграции* 🚀
