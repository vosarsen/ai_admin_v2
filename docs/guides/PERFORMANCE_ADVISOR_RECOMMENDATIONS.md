# Performance Advisor - Рекомендации Supabase

## Текущий статус
- **1 отсутствующий индекс** на foreign key
- **49 неиспользуемых индексов** (созданы, но не используются)

## Важно понимать

### Почему индексы показаны как неиспользуемые?
1. **Мало данных в БД** - большинство таблиц пустые или содержат мало записей
2. **PostgreSQL оптимизатор** предпочитает full table scan при малом объеме данных
3. **Индексы начнут использоваться** когда данных станет больше (обычно >1000 записей)

### Стоит ли удалять неиспользуемые индексы?
**НЕТ!** Не рекомендуется удалять эти индексы, потому что:
- Они созданы для будущей оптимизации
- Начнут работать при росте данных
- Удаление и пересоздание индексов дороже, чем их хранение
- Занимают минимум места при пустых таблицах

## Рекомендации

### 1. Добавить отсутствующий индекс (РЕКОМЕНДУЕТСЯ)

```sql
-- Создать индекс для foreign key в таблице visits
CREATE INDEX IF NOT EXISTS idx_visits_client_id 
ON public.visits(client_id);
```

**Почему важно**: Foreign key без индекса может сильно замедлить:
- Удаление записей из родительской таблицы (clients)
- JOIN операции между visits и clients
- Проверку целостности данных

### 2. Оставить существующие индексы (РЕКОМЕНДУЕТСЯ)

Не удаляйте "неиспользуемые" индексы, они нужны для:

#### Критичные для производительности:
- `idx_clients_phone_company` - поиск клиентов по телефону
- `idx_services_company_active` - получение активных услуг
- `idx_staff_company_active` - получение активных мастеров
- `idx_dialog_contexts_user` - контекст диалогов

#### Для будущей оптимизации:
- `idx_bookings_*` - все индексы по записям (когда начнутся бронирования)
- `idx_appointments_cache_*` - кэш расписания
- `idx_clients_ai_*` - AI аналитика по клиентам

### 3. Мониторинг использования индексов

Через месяц работы проверьте статистику:

```sql
-- Проверить использование индексов
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 4. Когда действительно удалять индексы?

Удаляйте индекс ТОЛЬКО если:
- Прошло >3 месяца активной работы
- В таблице >10,000 записей
- idx_scan = 0 (ни разу не использовался)
- Индекс занимает >100MB места
- Есть дублирующий индекс с теми же колонками

## Скрипт для добавления отсутствующего индекса

```sql
-- fix-missing-index.sql
-- Добавляет отсутствующий индекс для foreign key

CREATE INDEX IF NOT EXISTS idx_visits_client_id 
ON public.visits(client_id);

-- Проверка что индекс создан
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
    AND tablename = 'visits'
    AND indexname = 'idx_visits_client_id';
```

## План действий

### Сейчас (необязательно):
1. ✅ Добавить индекс `idx_visits_client_id` - исправит единственное предупреждение
2. ✅ Оставить все остальные индексы как есть

### Через 1 месяц:
1. Проверить статистику использования индексов
2. Оценить какие индексы начали использоваться
3. Рассмотреть удаление только явно лишних индексов

### Через 3 месяца:
1. Провести полный аудит индексов
2. Удалить индексы с 0 использований при объеме данных >10k записей
3. Добавить новые индексы based on slow query log

## Важные метрики для мониторинга

```sql
-- Общая статистика по таблицам
SELECT 
    schemaname,
    tablename,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Размер таблиц и индексов
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Заключение

**Текущие рекомендации Performance Advisor не критичны!**

- 49 "неиспользуемых" индексов - это нормально для БД с малым объемом данных
- Они начнут использоваться при росте данных
- Единственное действие: добавить индекс для foreign key в visits

**Приоритеты оптимизации:**
1. 🟢 Безопасность (исправлено ✅)
2. 🟡 Производительность (текущий статус OK)
3. 🔵 Мониторинг (настроить в будущем)