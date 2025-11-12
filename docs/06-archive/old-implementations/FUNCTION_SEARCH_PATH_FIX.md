# Исправление Function Search Path Warnings

## Проблема
Supabase Linter обнаружил 10 предупреждений уровня WARN о функциях без явно установленного `search_path`.

### Что такое search_path?
`search_path` определяет, в каких схемах PostgreSQL будет искать объекты (таблицы, функции) если они указаны без явной схемы. 

### Почему это важно?
Без явного `search_path` злоумышленник может:
1. Создать таблицу/функцию с таким же именем в другой схеме
2. Изменить search_path пользователя
3. Заставить функцию использовать подмененные объекты

## Решение
Создан скрипт `scripts/database/fix-function-search-path.sql`, который устанавливает `search_path = public, pg_catalog` для всех функций.

## Список исправляемых функций
1. `update_updated_at_column` - обновление timestamp
2. `get_service_categories_with_count` - получение категорий услуг
3. `cleanup_old_webhook_events` - очистка старых webhook событий
4. `get_ai_analytics` - аналитика AI
5. `get_top_ai_clients` - топ клиентов AI
6. `get_ai_client_segments` - сегменты клиентов
7. `update_services_updated_at` - обновление timestamp услуг
8. `update_staff_updated_at` - обновление timestamp персонала
9. `update_appointments_cache_updated_at` - обновление timestamp кэша
10. `update_staff_schedules_updated_at` - обновление timestamp расписания

## Как применить

### Через Supabase Dashboard
1. Откройте SQL Editor в Supabase Dashboard
2. Скопируйте содержимое `scripts/database/fix-function-search-path.sql`
3. Выполните скрипт
4. Проверьте результат - должны увидеть таблицу с "SET ✅" для всех функций

### Через psql
```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres" -f scripts/database/fix-function-search-path.sql
```

## Что делает скрипт

Для каждой функции выполняет:
```sql
ALTER FUNCTION public.function_name() 
SET search_path = public, pg_catalog;
```

Это означает:
- Функция всегда будет искать объекты сначала в схеме `public`
- Затем в `pg_catalog` (системные функции PostgreSQL)
- Игнорирует любые изменения search_path пользователя

## Проверка

После применения скрипта выполняется проверочный запрос, который покажет статус каждой функции:
- `SET ✅` - search_path установлен правильно
- `NOT SET ❌` - требуется исправление

## Влияние на производительность

**Никакого влияния!** Установка search_path:
- Не меняет логику функций
- Не влияет на скорость выполнения
- Только делает поведение предсказуемым и безопасным

## Обратная совместимость

Изменения **полностью обратно совместимы**:
- Функции продолжат работать как раньше
- Все вызовы функций остаются без изменений
- Только повышается безопасность

## Рекомендации на будущее

При создании новых функций всегда указывайте search_path:

```sql
CREATE OR REPLACE FUNCTION public.my_function()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    -- function body
END;
$$;
```

## Дополнительная информация

- [PostgreSQL Documentation: search_path](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)
- [Supabase Linter Rule 0011](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)