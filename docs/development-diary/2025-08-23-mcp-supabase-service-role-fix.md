# MCP Supabase Service Role Key Update

**Date**: 2025-08-23
**Author**: Claude
**Status**: Completed

## Context

Supabase ключ был изменен с anon key на service_role key для получения полного доступа к базе данных. MCP Supabase сервер требовал обновления конфигурации и исправления кода.

## Problem

1. MCP Supabase использовал старый anon ключ
2. В коде `server.js` были ошибки с инициализацией Supabase клиента
3. Ошибка: `Cannot read properties of null (reading 'from')`

## Solution

### 1. Обновление конфигурации MCP

```bash
# Удаление старой конфигурации
claude mcp remove supabase

# Добавление с новым service_role ключом
claude mcp add supabase "node" "/Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-supabase/server.js" \
  --env SUPABASE_URL=https://yazteodihdglhoxgqunp.supabase.co \
  --env SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhenRlb2RpaGRnbGhveGdxdW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDI5NTQ3NywiZXhwIjoyMDU5ODcxNDc3fQ.43Hq1KlOaTnkhddnybWZWgKlbHGK0FCuhytXVTUBhgY
```

### 2. Исправление кода server.js

Проблема: Функции использовали глобальную переменную `supabase` напрямую, которая была `null` до первого вызова.

Решение: Добавлен вызов `getSupabaseClient()` в начале каждой функции:

```javascript
// Было (неправильно):
async () => {
  const { count } = await supabase.from(table)...
}

// Стало (правильно):
async () => {
  const supabase = getSupabaseClient();
  const { count } = await supabase.from(table)...
}
```

Исправлены функции:
- `list_tables` (строка 112)
- `get_database_stats` (строка 162)
- `search_bookings` (строка 220)

### 3. Файлы изменены

- `/mcp/mcp-supabase/server.js` - исправлена инициализация Supabase клиента
- `~/.claude.json` - обновлена конфигурация MCP с новым ключом

## Testing

```bash
# Локальный тест
cd mcp/mcp-supabase
SUPABASE_URL=https://yazteodihdglhoxgqunp.supabase.co \
SUPABASE_KEY=<service_role_key> \
node test-mcp.js

# Результат: ✅ Server started successfully
```

## Important Notes

1. **Service Role Key** дает полный доступ к базе данных без ограничений RLS
2. **Требуется перезапуск** Claude Code для применения изменений MCP
3. **Путь к серверу**: `/mcp/mcp-supabase/server.js` (не index.js!)

## Verification Steps

После перезапуска Claude Code:
1. Использовать команду `/mcp` для проверки статуса
2. Выполнить `@supabase list_tables` для проверки подключения
3. Проверить количество записей в таблицах

## Lessons Learned

1. MCP серверы кешируются и требуют перезапуска Claude Code
2. Всегда использовать функцию-геттер для инициализации клиентов
3. Service role key необходим для полного доступа к Supabase