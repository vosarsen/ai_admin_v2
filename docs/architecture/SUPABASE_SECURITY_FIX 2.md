# Исправление проблем безопасности Supabase

## Обнаруженные проблемы

### 1. SECURITY DEFINER Views (2 ошибки)
- `notification_stats_24h` - view использует права создателя
- `webhook_stats_24h` - view использует права создателя

**Риск**: Views с SECURITY DEFINER выполняются с правами создателя, что может привести к обходу RLS политик.

### 2. RLS отключен (14 ошибок)
Row Level Security не включен на следующих таблицах:
- reminders
- visits
- clients
- dialog_contexts
- services
- staff_schedules
- appointments_cache
- sync_status
- staff
- webhook_events
- booking_notifications
- companies
- bookings

**Риск**: Без RLS любой пользователь с доступом к БД может читать/изменять все данные.

## Решение

Создан SQL скрипт `scripts/database/fix-security-issues.sql`, который:

1. **Включает RLS** на всех таблицах
2. **Создает политики** для service_role (используется нашим backend)
3. **Исправляет views** - меняет SECURITY DEFINER на SECURITY INVOKER

## Как применить исправления

### Вариант 1: Через Supabase Dashboard

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в SQL Editor
4. Скопируйте содержимое `scripts/database/fix-security-issues.sql`
5. Выполните скрипт
6. Проверьте результаты в разделе Table Editor → каждая таблица должна показывать "RLS enabled"

### Вариант 2: Через Supabase CLI

```bash
# Установите Supabase CLI если еще не установлен
brew install supabase/tap/supabase

# Примените миграцию
supabase db push scripts/database/fix-security-issues.sql
```

### Вариант 3: Через psql

```bash
# Используйте connection string из Supabase Dashboard
psql "postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres" -f scripts/database/fix-security-issues.sql
```

## Важные замечания

### О политиках RLS

Скрипт создает политики только для `service_role`:
- **service_role** - используется нашим backend с service key
- **Полный доступ** - service_role имеет доступ ко всем операциям
- **Другие роли** - не имеют доступа (anon, authenticated)

Это безопасная конфигурация для backend-only приложения.

### О views

Views изменены с `SECURITY DEFINER` на `SECURITY INVOKER`:
- **SECURITY INVOKER** - view использует права вызывающего пользователя
- **Более безопасно** - соблюдаются все RLS политики

### Проверка после применения

После применения скрипта выполните проверочные запросы (они включены в конец скрипта):

1. **Проверка RLS статуса**:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```
Все таблицы должны показывать `rowsecurity = true`

2. **Проверка политик**:
```sql
SELECT tablename, policyname, roles 
FROM pg_policies 
WHERE schemaname = 'public';
```
Каждая таблица должна иметь политику `service_role_all`

## Тестирование приложения

После применения исправлений **обязательно протестируйте**:

1. Отправьте тестовое сообщение боту
2. Проверьте создание записи
3. Проверьте синхронизацию с YClients
4. Убедитесь что все функции работают

```bash
# Тест через MCP
@whatsapp send_message phone:79001234567 message:"Привет"

# Проверка логов
@logs logs_tail service:ai-admin-worker-v2 lines:50

# Проверка данных
@supabase query_table table:clients limit:5
```

## Откат изменений (если нужно)

Если после применения что-то сломалось:

```sql
-- Отключить RLS на всех таблицах
ALTER TABLE public.reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits DISABLE ROW LEVEL SECURITY;
-- ... и так далее для всех таблиц

-- Удалить все политики
DROP POLICY IF EXISTS "service_role_all" ON public.reminders;
DROP POLICY IF EXISTS "service_role_all" ON public.visits;
-- ... и так далее для всех таблиц
```

## Рекомендации на будущее

1. **Всегда включайте RLS** при создании новых таблиц
2. **Создавайте политики** сразу после создания таблицы
3. **Используйте SECURITY INVOKER** для views
4. **Регулярно проверяйте** Database Linter в Supabase Dashboard

## Контакты для помощи

Если возникли проблемы:
1. Проверьте логи: `@logs logs_errors service:ai-admin-worker-v2`
2. Проверьте подключение: `@supabase list_tables`
3. Создайте issue в GitHub с описанием проблемы