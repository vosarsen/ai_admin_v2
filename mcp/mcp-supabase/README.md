# Supabase MCP Server для AI Admin v2

MCP (Model Context Protocol) сервер для интеграции Claude с базой данных Supabase.

## Установка

1. Перейдите в директорию MCP сервера:
```bash
cd mcp-supabase
```

2. Установите зависимости (уже выполнено):
```bash
npm install
```

## Конфигурация Claude Desktop

1. Откройте настройки Claude Desktop
2. Перейдите в раздел "Developer" → "Edit Config"
3. Добавьте следующую конфигурацию:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": ["/Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp-supabase/server.js"]
    }
  }
}
```

4. Сохраните и перезапустите Claude Desktop

## Доступные инструменты

### query_table
Запрос любой таблицы с фильтрами:
```
use supabase query_table {"table": "bookings", "limit": 10}
```

### list_tables
Список всех таблиц и количество записей:
```
use supabase list_tables
```

### get_database_stats
Статистика базы данных:
```
use supabase get_database_stats
```

### search_bookings
Поиск записей с расширенными фильтрами:
```
use supabase search_bookings {"companyId": 1, "status": "confirmed"}
```

## Примеры использования

### Получить последние записи:
```
use supabase query_table {
  "table": "bookings",
  "orderBy": {"column": "created_at", "ascending": false},
  "limit": 5
}
```

### Найти клиента по телефону:
```
use supabase query_table {
  "table": "clients",
  "filters": {"phone": "79001234567"}
}
```

### Получить услуги компании:
```
use supabase query_table {
  "table": "services",
  "filters": {"company_id": 1, "active": true}
}
```

## Отладка

Для просмотра логов сервера:
```bash
node server.js 2>&1 | tee server.log
```

## Структура проекта

```
mcp-supabase/
├── server.js       # Основной файл MCP сервера
├── package.json    # Конфигурация npm
└── README.md      # Эта документация
```

## Требования

- Node.js v18+
- Настроенные переменные окружения в ../.env:
  - SUPABASE_URL
  - SUPABASE_KEY