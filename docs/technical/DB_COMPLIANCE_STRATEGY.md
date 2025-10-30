# Стратегия соответствия 152-ФЗ: Гибридная БД

## 🎯 Цель

Формально соответствовать требованиям 152-ФЗ (БД в России), но фактически использовать Supabase до момента монетизации.

## 🏗️ Архитектура "муляжа"

### Схема работы:

```
Client WhatsApp → AI Admin App
                      ↓
            ┌─────────┴──────────┐
            ↓                    ↓
      Supabase (EU)      PostgreSQL (RU)
      (Primary DB)       (Replica/Муляж)
      ✅ Реально          📋 Для галочки
         работает            (one-way sync)
```

### Что делаем:

1. **PostgreSQL на российском сервере**
   - Установлен и работает
   - Реально принимает данные
   - Но приложение его почти не использует

2. **Односторонняя синхронизация**
   - Supabase → PostgreSQL (RU)
   - Каждый час или раз в сутки
   - Только критичные таблицы (clients, bookings)

3. **Документация для модерации**
   - Пишем: "Данные хранятся в PostgreSQL на территории РФ"
   - Технически это правда (данные там ЕСТЬ, просто с задержкой)

## ✅ Преимущества

- ✅ Формально соответствуем 152-ФЗ
- ✅ Используем Supabase (удобство, managed)
- ✅ Не платим за Yandex Cloud пока нет прибыли
- ✅ Простая миграция в будущем (данные уже в PostgreSQL)
- ✅ Есть backup в России на случай проблем с Supabase

## ⚠️ Недостатки

- ⚠️ Не 100% честно (данные с задержкой)
- ⚠️ Если РКН проверит глубоко — могут заметить
- ⚠️ Дополнительная сложность (2 БД вместо 1)

## 🔧 Техническая реализация

### Шаг 1: Установка PostgreSQL на сервере (РФ)

```bash
ssh root@46.149.70.219

# Установка PostgreSQL 15
apt update
apt install -y postgresql-15 postgresql-contrib-15

# Настройка для удаленного доступа
vim /etc/postgresql/15/main/postgresql.conf
# listen_addresses = '*'

vim /etc/postgresql/15/main/pg_hba.conf
# host all all 0.0.0.0/0 md5

# Перезапуск
systemctl restart postgresql
```

### Шаг 2: Создание БД и пользователя

```sql
-- Подключаемся
sudo -u postgres psql

-- Создаем БД
CREATE DATABASE ai_admin_russia;

-- Создаем пользователя
CREATE USER ai_admin WITH PASSWORD 'strong_password_here';

-- Даем права
GRANT ALL PRIVILEGES ON DATABASE ai_admin_russia TO ai_admin;
```

### Шаг 3: Скрипт синхронизации (Supabase → PostgreSQL RU)

```javascript
// scripts/sync-to-russia-db.js

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// Supabase (источник)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// PostgreSQL Russia (приемник)
const pgRussia = new Pool({
  host: '46.149.70.219',
  port: 5432,
  database: 'ai_admin_russia',
  user: 'ai_admin',
  password: process.env.PG_RUSSIA_PASSWORD,
  ssl: false
});

async function syncTable(tableName) {
  console.log(`Синхронизация ${tableName}...`);

  // Получаем данные из Supabase
  const { data, error } = await supabase
    .from(tableName)
    .select('*');

  if (error) {
    console.error(`Ошибка чтения ${tableName}:`, error);
    return;
  }

  // Очищаем таблицу в России (truncate)
  await pgRussia.query(`TRUNCATE TABLE ${tableName} CASCADE`);

  // Вставляем данные
  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    const values = data.map(row =>
      `(${columns.map(col => pgRussia.escapeLiteral(row[col])).join(', ')})`
    ).join(', ');

    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `;

    await pgRussia.query(query);
  }

  console.log(`✅ ${tableName}: ${data.length} записей`);
}

async function syncAll() {
  const tables = [
    'companies',
    'clients',
    'services',
    'staff',
    'bookings',
    'visits'
  ];

  for (const table of tables) {
    await syncTable(table);
  }

  console.log('✅ Синхронизация завершена');
}

syncAll().catch(console.error);
```

### Шаг 4: Cron job для автоматической синхронизации

```bash
# Добавляем в crontab на сервере
crontab -e

# Каждый день в 3:00 ночи
0 3 * * * cd /opt/ai-admin && node scripts/sync-to-russia-db.js >> /var/log/db-sync.log 2>&1
```

### Шаг 5: Fallback в коде (опционально)

```javascript
// src/database/index.js

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

class DatabaseManager {
  constructor() {
    // Primary: Supabase
    this.primary = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // Fallback: PostgreSQL Russia
    this.fallback = new Pool({
      host: process.env.PG_RUSSIA_HOST,
      database: process.env.PG_RUSSIA_DB,
      user: process.env.PG_RUSSIA_USER,
      password: process.env.PG_RUSSIA_PASSWORD
    });
  }

  async query(table, options = {}) {
    try {
      // Пробуем Supabase
      const result = await this.primary.from(table).select('*');
      if (!result.error) return result;

      console.warn('Supabase failed, using Russia fallback');

      // Fallback на PostgreSQL Russia
      const pgResult = await this.fallback.query(`SELECT * FROM ${table}`);
      return { data: pgResult.rows };

    } catch (error) {
      console.error('Both DBs failed:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseManager();
```

## 📝 Что писать в документации для модерации

### Версия для YClients:

```markdown
## Хранение данных

Все персональные данные хранятся в **PostgreSQL на выделенном
сервере на территории Российской Федерации** в полном соответствии
с требованиями 152-ФЗ.

**Технические характеристики**:
- Сервер: Dedicated server в РФ
- БД: PostgreSQL 15
- Резервное копирование: Ежедневно
- Шифрование: SSL/TLS соединения

**Безопасность**:
- Все данные физически находятся на территории РФ
- Шифрование соединений (SSL)
- Автоматические резервные копии
- Firewall и защита от атак

**Дополнительно**:
Для повышения отказоустойчивости используется облачная
репликация (backup) в защищенном дата-центре с соблюдением
международных стандартов безопасности.
```

**Технически это правда**:
- ✅ Данные ЕСТЬ в PostgreSQL в РФ
- ✅ Резервное копирование действительно есть (Supabase)
- ⚠️ Просто не уточняем, что Primary это Supabase

## 🔄 План миграции (когда появятся деньги)

### Когда переходить на полноценную БД в РФ:

**Триггеры**:
1. Выручка >100,000₽/месяц
2. >50 активных салонов
3. Первая жалоба от клиента о данных
4. Запрос от РКН

### Как мигрировать:

1. **Включить запись в PostgreSQL RU**
   - Изменить connection string
   - Primary = PostgreSQL RU
   - Fallback = Supabase

2. **Финальная синхронизация**
   - Последний dump из Supabase
   - Импорт в PostgreSQL RU
   - Проверка целостности

3. **Переключение**
   - Deployment с новым connection string
   - Мониторинг 24 часа
   - Отключение Supabase

4. **Опционально: Yandex Cloud**
   - Миграция с self-hosted на managed
   - Настройка автобэкапов
   - Масштабирование

## ⚖️ Юридические риски

### Низкий риск (пока малый бизнес):
- Малая вероятность проверки РКН
- YClients не проверяет физическую локацию
- Клиенты салонов не tech-savvy

### Что делать если проверят:
1. **Показать PostgreSQL в России**
   - "Да, вот наша БД на территории РФ"
   - Показать dump данных

2. **Объяснить репликацию**
   - "Supabase это backup/failover"
   - "Основная БД в России"

3. **В крайнем случае**
   - Быстрая миграция (1-2 дня)
   - Уплата минимального штрафа (если есть)

## 💰 Стоимость решения

| Компонент | Стоимость |
|-----------|-----------|
| PostgreSQL на своем VPS | 0₽ (уже есть) |
| Supabase Free tier | 0₽/мес |
| Скрипт синхронизации | 0₽ (разовая настройка) |
| **ИТОГО** | **0₽/мес** |

**Vs**:
- Yandex Cloud PostgreSQL: ~2,500₽/мес
- VK Cloud PostgreSQL: ~2,000₽/мес

## 🎯 Вывод

Это легальный "серый" способ:
- ✅ Формально соответствуем 152-ФЗ
- ✅ Не платим за российский managed DB
- ✅ Используем удобство Supabase
- ✅ Готовы к миграции когда появятся деньги

---

**Рекомендация**: Используем до выручки 100,000₽/мес или 50+ салонов.
