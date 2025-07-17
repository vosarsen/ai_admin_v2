# Supabase MCP Server

MCP (Model Context Protocol) сервер для интеграции Claude с базой данных Supabase проекта AI Admin v2.

## Возможности

### Инструменты (Tools)

1. **query_table** - Запрос любой таблицы с фильтрами
   - Поддержка фильтров, сортировки, лимитов
   - Возврат данных в JSON формате

2. **get_table_schema** - Получение схемы таблицы
   - Анализ структуры таблицы
   - Типы данных полей

3. **list_tables** - Список всех таблиц
   - Показывает доступные таблицы
   - Количество записей в каждой

4. **get_database_stats** - Статистика базы данных
   - Общее состояние БД
   - Последняя активность

5. **search_bookings** - Поиск записей
   - Сложные фильтры по записям
   - Связанные данные (клиенты, услуги, мастера)

6. **get_company_metrics** - Метрики компании
   - Статистика за период
   - Доходы, записи, сообщения

### Ресурсы (Resources)

- `supabase://tables` - Список таблиц БД
- `supabase://stats` - Текущая статистика

## Установка

1. Установите MCP SDK (уже выполнено):
```bash
npm install @modelcontextprotocol/sdk
```

2. Настройте переменные окружения в `.env`:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## Использование

### Запуск сервера вручную:
```bash
node src/mcp-server/supabase-server.js
```

### Интеграция с Claude Desktop:

1. Откройте настройки Claude Desktop
2. Перейдите в раздел "Developer"
3. Добавьте конфигурацию:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": ["/Users/vosarsen/Documents/GitHub/ai_admin_v2/src/mcp-server/supabase-server.js"]
    }
  }
}
```

### Использование в Claude:

После подключения вы можете использовать команды:

```
// Получить список таблиц
use supabase list_tables

// Запросить данные из таблицы
use supabase query_table {"table": "bookings", "limit": 10}

// Найти записи клиента
use supabase search_bookings {"clientPhone": "79001234567"}

// Получить метрики компании
use supabase get_company_metrics {"companyId": 1, "period": "month"}
```

## Примеры запросов

### Получить последние 5 записей:
```json
{
  "table": "bookings",
  "select": "*",
  "orderBy": {
    "column": "created_at",
    "ascending": false
  },
  "limit": 5
}
```

### Найти клиентов по телефону:
```json
{
  "table": "clients",
  "filters": {
    "phone": "79001234567"
  }
}
```

### Получить услуги компании:
```json
{
  "table": "services",
  "filters": {
    "company_id": 1,
    "active": true
  }
}
```

## Безопасность

- Используются те же credentials, что и в основном проекте
- Все запросы логируются
- Поддерживается только чтение данных (безопасный режим)

## Расширение функциональности

Для добавления новых инструментов:

1. Добавьте описание в `tools/list`
2. Реализуйте обработчик в `tools/call`
3. Добавьте метод в класс `SupabaseMCPServer`

## Отладка

Логи сохраняются через стандартный logger проекта.

Для включения debug режима:
```bash
DEBUG=ai-admin:* node src/mcp-server/supabase-server.js
```