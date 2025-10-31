# План миграции на Yandex Cloud Database

**Статус:** Планирование
**Дата создания:** 2025-10-31
**Грант:** Yandex Cloud 4000₽ (ожидание одобрения, до 7 дней)

---

## Текущее состояние БД в Supabase

### Таблицы и объем данных

| Таблица | Записей | Назначение |
|---------|---------|------------|
| `companies` | 1 | Конфигурация салона KULTURA |
| `clients` | 1,292 | Клиентская база с историей визитов |
| `bookings` | 49 | Текущие записи клиентов |
| `services` | 63 | Услуги салона |
| `staff` | 12 | Мастера |
| `staff_schedules` | 56 | Расписание мастеров |
| `dialog_contexts` | 21 | История AI диалогов |
| `messages` | 0 | Сообщения (пустая) |
| `actions` | 0 | Действия (пустая) |
| `company_sync_status` | 0 | Синхронизация (пустая) |

**Общий объем:** ~1,500 записей + JSON history в clients

---

## Архитектура Dual-Database

```
┌─────────────────────────────────────────────────────┐
│              Application Layer                       │
│         src/services/ai-admin-v2/                   │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │      Database Adapter (NEW)                  │  │
│  │      src/integrations/database/              │  │
│  │                                              │  │
│  │  Режимы работы (env: DB_MODE):              │  │
│  │  - supabase     → только Supabase (default)  │  │
│  │  - dual-write   → запись в обе, чтение из SB │  │
│  │  - dual-read    → запись в обе, чтение из YC │  │
│  │  - yandex       → только Yandex Cloud        │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
              │                    │
              │                    │
      ┌───────▼───────┐    ┌──────▼───────┐
      │   Supabase    │    │ Yandex Cloud │
      │   (Primary)   │    │  (Secondary) │
      │               │    │              │
      │  PostgreSQL   │    │  PostgreSQL  │
      │   Current     │    │  Managed DB  │
      └───────────────┘    └──────────────┘
            │                      │
            │   Sync Monitor       │
            └──────► ◄─────────────┘
              (Валидация данных)
```

---

## Этапы миграции

### Этап 1: Подготовка инфраструктуры (1-2 дня)

**Ожидание:**
- ✅ Заявка на грант Yandex Cloud подана
- ⏳ Ожидание одобрения (до 7 дней)
- 💰 Грант: 4000₽ стартовый капитал

**После получения гранта:**

1. **Создать Managed PostgreSQL в Yandex Cloud**
   ```bash
   # Через Yandex Cloud Console:
   # 1. Managed Service for PostgreSQL
   # 2. Создать кластер:
   #    - Версия: PostgreSQL 15
   #    - Класс хоста: s2.small (2 vCPU, 8 GB RAM) - старт
   #    - Диск: 10 GB SSD (можно увеличить)
   #    - Доступ: только с сервера AI Admin (whitelist IP)
   ```

2. **Экспортировать схему из Supabase**
   ```bash
   # С локальной машины:
   pg_dump -h <supabase_host> -U postgres -d postgres \
     --schema-only -n public -f schema.sql
   ```

3. **Применить схему в Yandex Cloud**
   ```bash
   psql -h <yandex_host> -U admin -d postgres -f schema.sql
   ```

4. **Настроить подключение**
   ```bash
   # .env на сервере:
   YANDEX_DB_HOST=c-xxx.rw.mdb.yandexcloud.net
   YANDEX_DB_PORT=6432
   YANDEX_DB_USER=admin
   YANDEX_DB_PASSWORD=<password>
   YANDEX_DB_NAME=postgres
   YANDEX_DB_SSL=true
   ```

---

### Этап 2: Разработка Database Adapter (3-5 дней)

**Цель:** Создать прозрачный слой для работы с двумя БД одновременно.

**Структура кода:**
```
src/integrations/database/
├── adapter.js          # Главный адаптер
├── supabase-client.js  # Клиент Supabase (существующий)
├── yandex-client.js    # Клиент Yandex Cloud (NEW)
├── sync-validator.js   # Валидация синхронизации (NEW)
└── index.js           # Экспорт
```

**Основной функционал:**
```javascript
// adapter.js
class DatabaseAdapter {
  constructor(mode = 'supabase') {
    this.mode = process.env.DB_MODE || mode;
    this.supabase = new SupabaseClient();
    this.yandex = new YandexClient();
    this.validator = new SyncValidator();
  }

  async query(table, filter) {
    switch (this.mode) {
      case 'supabase':
        return this.supabase.query(table, filter);

      case 'dual-write':
        // Запись в обе, чтение из Supabase
        const result = await this.supabase.query(table, filter);
        await this.yandex.query(table, filter).catch(err => {
          console.error('Yandex write failed:', err);
        });
        return result;

      case 'dual-read':
        // Запись в обе, чтение из Yandex
        const yandexResult = await this.yandex.query(table, filter);
        await this.supabase.query(table, filter).catch(err => {
          console.error('Supabase write failed:', err);
        });
        return yandexResult;

      case 'yandex':
        return this.yandex.query(table, filter);
    }
  }
}
```

**Интеграция:**
- Заменить все прямые вызовы Supabase на DatabaseAdapter
- Минимальные изменения в существующем коде
- Fallback на Supabase при ошибках

---

### Этап 3: Миграция данных (1 день)

**Первичная миграция:**
```bash
# Скрипт миграции: scripts/migrate-to-yandex.js
node scripts/migrate-to-yandex.js --tables all --validate
```

**Таблицы для миграции (в порядке зависимостей):**
1. `companies` (1 запись) - без зависимостей
2. `services` (63 записи) - зависит от companies
3. `staff` (12 записей) - зависит от companies
4. `staff_schedules` (56) - зависит от staff
5. `clients` (1,292) - зависит от companies
6. `bookings` (49) - зависит от clients, staff, services
7. `dialog_contexts` (21) - зависит от clients (опционально)
8. `messages`, `actions`, `company_sync_status` (пустые)

**Валидация после миграции:**
```javascript
// Проверить количество записей
const supabaseCount = await supabase.from('clients').select('count');
const yandexCount = await yandex.query('SELECT COUNT(*) FROM clients');
assert(supabaseCount === yandexCount);

// Проверить контрольные суммы критичных данных
const supabaseHash = await computeHash('clients', ['phone', 'name']);
const yandexHash = await computeHash('clients', ['phone', 'name']);
assert(supabaseHash === yandexHash);
```

---

### Этап 4: Dual-Write режим (7-14 дней тестирования)

**Цель:** Убедиться, что запись в Yandex работает корректно.

**Действия:**
```bash
# На сервере:
export DB_MODE=dual-write
pm2 restart ai-admin-worker-v2
```

**Мониторинг:**
- Логи ошибок записи в Yandex
- Сравнение данных между БД каждый день
- Производительность (latency запросов)

**Метрики успеха:**
- ✅ 99.9% успешных записей в Yandex
- ✅ Данные идентичны в обеих БД
- ✅ Latency < 100ms разницы

---

### Этап 5: Dual-Read режим (7 дней тестирования)

**Цель:** Проверить чтение из Yandex в production.

**Действия:**
```bash
# На сервере:
export DB_MODE=dual-read
pm2 restart ai-admin-worker-v2
```

**Мониторинг:**
- Производительность AI ответов
- Корректность данных в ответах бота
- Latency запросов к Yandex
- Ошибки соединения

**Сравнение производительности:**
```bash
# Скрипт benchmark: scripts/benchmark-databases.js
node scripts/benchmark-databases.js --queries 1000 --mode dual-read
```

**Rollback plan:**
```bash
# При проблемах:
export DB_MODE=dual-write  # Вернуться на чтение из Supabase
pm2 restart ai-admin-worker-v2
```

---

### Этап 6: Финальный переход (после 14 дней успешного тестирования)

**Действия:**
```bash
# На сервере:
export DB_MODE=yandex
pm2 restart ai-admin-worker-v2
```

**Supabase в режиме резервной копии:**
- Оставить Supabase активным 30 дней
- Ежедневные бэкапы из Yandex в Supabase
- После 30 дней стабильной работы - отключить Supabase

---

## Преимущества Yandex Cloud

### Технические
1. **Managed PostgreSQL** - автоматические бэкапы, патчи, мониторинг
2. **Низкая латентность** - серверы в РФ (vs Supabase в Европе)
3. **Масштабируемость** - легко увеличить CPU/RAM/диск
4. **Высокая доступность** - SLA 99.95%

### Финансовые
1. **Бесплатный грант 4000₽** для старта
2. **Прозрачные цены** - оплата за ресурсы
3. **Калькулятор расходов** - прогноз трат

### Операционные
1. **Поддержка на русском** - быстрая помощь
2. **Российская юрисдикция** - соответствие ФЗ-152
3. **Интеграция с другими сервисами** - Object Storage, Functions, Monitoring

---

## Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Проблемы с синхронизацией данных | Средняя | Высокое | Dual-write режим с валидацией, алерты |
| Потеря данных при миграции | Низкая | Критическое | Supabase остается активным 30 дней, ежедневные бэкапы |
| Низкая производительность Yandex | Низкая | Среднее | Rollback на Supabase одной переменной (DB_MODE) |
| Превышение гранта 4000₽ | Средняя | Среднее | Мониторинг расходов, алерты при 80% использования |
| Проблемы с SSL/сертификатами | Низкая | Среднее | Документация Yandex, поддержка |
| Несовместимость версий PostgreSQL | Низкая | Низкое | Использовать ту же версию (PostgreSQL 15) |

---

## Оценка стоимости Yandex Cloud

### Начальная конфигурация
- **Класс хоста:** s2.small (2 vCPU, 8 GB RAM)
- **Диск:** 10 GB SSD
- **Трафик:** ~100 GB/месяц

### Примерная стоимость
```
CPU:     2 vCPU × 720 часов × 1.28₽/час = 1,843₽
RAM:     8 GB × 720 часов × 0.34₽/час = 1,958₽
Диск:    10 GB × 720 часов × 0.104₽/час = 749₽
Backup:  10 GB × 2.20₽/GB = 22₽
────────────────────────────────────────────
Итого:   ~4,572₽/месяц
```

**С грантом 4000₽:** первый месяц почти бесплатно!

---

## Мониторинг и алерты

### Telegram алерты (расширить существующую систему)

```javascript
// Добавить в src/utils/telegram-alerts.js
async function sendDatabaseAlert(message, level = 'warning') {
  await sendTelegramMessage(`
🗄️ Database Alert [${level.toUpperCase()}]

${message}

Time: ${new Date().toISOString()}
Server: ${process.env.SERVER_HOST}
DB Mode: ${process.env.DB_MODE}
  `);
}
```

### Алерты:
1. **Sync failures** - ошибки синхронизации > 1% в час
2. **High latency** - latency > 500ms в 5% запросов
3. **Connection errors** - не удается подключиться к Yandex
4. **Cost alerts** - использование гранта > 80%
5. **Data mismatch** - расхождения данных между БД

---

## Rollback Strategy

### Быстрый откат (< 5 минут)
```bash
# На сервере:
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Изменить режим:
cd /opt/ai-admin
sed -i 's/DB_MODE=.*/DB_MODE=supabase/' .env

# Перезапустить:
pm2 restart ai-admin-worker-v2

# Проверить:
pm2 logs ai-admin-worker-v2 --lines 50
```

### Полный откат (если Yandex не работает)
1. Вернуть `DB_MODE=supabase`
2. Остановить запись в Yandex
3. Восстановить недостающие данные из Yandex в Supabase
4. Анализ причин и планирование повторной миграции

---

## Чеклист перед каждым этапом

### Перед миграцией данных
- [ ] Yandex PostgreSQL кластер создан и доступен
- [ ] Схема БД применена в Yandex
- [ ] Подключение с сервера работает (тест `psql`)
- [ ] Созданы бэкапы Supabase
- [ ] Telegram алерты настроены

### Перед dual-write
- [ ] Database Adapter разработан и протестирован локально
- [ ] Данные мигрированы и валидированы
- [ ] Мониторинг настроен
- [ ] План rollback подготовлен
- [ ] Команда уведомлена

### Перед dual-read
- [ ] Dual-write работает 7+ дней без ошибок
- [ ] Данные синхронизированы (проверка)
- [ ] Latency Yandex < Supabase + 50ms
- [ ] Алерты настроены на чтение

### Перед финальным переходом
- [ ] Dual-read работает 7+ дней без ошибок
- [ ] Производительность Yandex >= Supabase
- [ ] Все тесты пройдены
- [ ] Команда готова к переходу
- [ ] План отключения Supabase (через 30 дней)

---

## Следующие шаги

### Сейчас (ожидание гранта)
1. ✅ Изучить текущую структуру БД - **DONE**
2. ✅ Спланировать архитектуру миграции - **DONE**
3. ✅ Создать документацию - **DONE**
4. ⏳ Дождаться одобрения гранта Yandex Cloud (до 7 дней)

### После получения гранта
1. Создать PostgreSQL кластер в Yandex Cloud
2. Экспортировать и применить схему БД
3. Разработать Database Adapter
4. Мигрировать данные и начать dual-write

### Timeline
- **День 0-7:** Ожидание гранта (текущий этап)
- **День 8-10:** Подготовка инфраструктуры
- **День 11-15:** Разработка Database Adapter
- **День 16:** Миграция данных
- **День 17-30:** Dual-write режим (тестирование)
- **День 31-37:** Dual-read режим (тестирование)
- **День 38+:** Финальный переход на Yandex

**Итого:** ~38 дней от получения гранта до полного перехода.

---

## Контакты и ресурсы

**Yandex Cloud:**
- Консоль: https://console.yandex.cloud/
- Документация: https://yandex.cloud/docs/managed-postgresql/
- Поддержка: support@cloud.yandex.ru

**Текущая БД (Supabase):**
- Host: aws-0-eu-central-1.pooler.supabase.com
- Dashboard: https://supabase.com/dashboard

**Контакты команды:**
- Арсен (разработчик): vosarsen
- Сервер: root@46.149.70.219

---

**Документ обновлен:** 2025-10-31
**Статус:** Ожидание гранта Yandex Cloud
