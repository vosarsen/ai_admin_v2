# 📚 Redis Schema Documentation

## Обзор
Документация по структуре ключей Redis в проекте AI Admin v2.

## 🔑 Схема именования ключей

### Общий формат
```
{entity}:{companyId}:{identifier}
```

- **entity** - тип данных (preferences, dialog, client, etc.)
- **companyId** - ID компании для мультитенантности
- **identifier** - уникальный идентификатор (обычно телефон в формате E.164)

### Формат телефонных номеров
Используется формат **E.164 без знака +**: `79001234567`

## 📦 Типы ключей

### 1. preferences (Предпочтения клиентов)
**Паттерн**: `preferences:{companyId}:{phone}`  
**Тип**: String (JSON)  
**TTL**: 90 дней  
**Пример**: `preferences:962302:79001234567`

**Структура данных**:
```json
{
  "favoriteService": "МУЖСКАЯ СТРИЖКА",
  "favoriteStaff": "Сергей",
  "preferredTime": "evening",
  "lastBookingDate": "2025-08-30",
  "visitCount": 5
}
```

### 2. dialog (Контекст диалога)
**Паттерн**: `dialog:{companyId}:{phone}`  
**Тип**: Hash  
**TTL**: 24 часа  
**Пример**: `dialog:962302:79001234567`

**Поля**:
- `companyId` - ID компании
- `state` - текущее состояние диалога
- `phone` - телефон клиента
- `selection` - текущий выбор
- `clientName` - имя клиента
- `lastUpdated` - timestamp последнего обновления

### 3. client (Кэш клиента)
**Паттерн**: `client:{companyId}:{phone}`  
**Тип**: String (JSON)  
**TTL**: 7 дней  
**Пример**: `client:962302:79001234567`

**Структура данных**:
```json
{
  "id": 95406,
  "name": "Иван Иванов",
  "phone": "79001234567",
  "email": "ivan@example.com",
  "visitCount": 10,
  "totalSpent": 15000
}
```

### 4. messages (История сообщений)
**Паттерн**: `messages:{companyId}:{phone}`  
**Тип**: List  
**TTL**: 30 дней  
**Пример**: `messages:962302:79001234567`

Хранит последние N сообщений диалога для контекста.

### 5. booking:owner (Владельцы букингов)
**Паттерн**: `booking:owner:{bookingId}`  
**Тип**: String  
**TTL**: 365 дней  
**Пример**: `booking:owner:1224758990`

Хранит phone владельца букинга для быстрого поиска.

### 6. reminder_context (Контекст напоминаний)
**Паттерн**: `reminder_context:{phone}`  
**Тип**: String (JSON)  
**TTL**: 24 часа  
**Пример**: `reminder_context:79001234567`

### 7. rate (Rate Limiting)
**Паттерны**:
- `rate:day:{phone}` - дневной лимит (TTL: 24 часа)
- `rate:hour:{phone}` - часовой лимит (TTL: 1 час)
- `rate:minute:{phone}` - минутный лимит (TTL: 1 минута)

**Тип**: ZSet (sorted set)

### 8. bull (BullMQ очереди)
**Паттерны**:
- `bull:company-{companyId}-messages:*` - очереди сообщений
- `bull:reminders:*` - очереди напоминаний

Системные ключи BullMQ для управления очередями.

## ⏰ TTL Политика

| Тип ключа | TTL | Обоснование |
|-----------|-----|-------------|
| preferences | 90 дней | Долгосрочные предпочтения клиента |
| dialog | 24 часа | Активный диалог |
| client | 7 дней | Кэш данных из БД |
| messages | 30 дней | История для контекста |
| booking | 365 дней | Архив букингов |
| reminder_context | 24 часа | Временный контекст |
| rate:day | 24 часа | Дневные лимиты |
| rate:hour | 1 час | Часовые лимиты |

## 🛠️ Управление ключами

### Скрипты
- `scripts/migrate-redis-keys.js` - миграция и унификация ключей
- `scripts/clean-redis-keys.js` - регулярная очистка
- `scripts/analyze-redis-keys.js` - анализ структуры

### Команды
```bash
# Миграция ключей
node scripts/migrate-redis-keys.js

# Очистка (запускать еженедельно)
node scripts/clean-redis-keys.js

# Анализ
node scripts/analyze-redis-keys.js
```

### Cron задача для автоочистки
```cron
# Еженедельная очистка Redis (воскресенье, 3:00)
0 3 * * 0 cd /opt/ai-admin && node scripts/clean-redis-keys.js >> logs/redis-clean.log 2>&1
```

## ✅ Best Practices

1. **Всегда используйте E.164 формат** для телефонов (без +)
2. **Устанавливайте TTL** для всех временных данных
3. **Используйте единый паттерн** именования
4. **Валидируйте companyId** перед созданием ключа
5. **Регулярно очищайте** старые данные
6. **Мониторьте** использование памяти

## 🚫 Чего избегать

1. ❌ Не используйте объекты в названиях ключей (`[object Object]`)
2. ❌ Не дублируйте паттерны (`prefs` vs `preferences`)
3. ❌ Не создавайте ключи без TTL для временных данных
4. ❌ Не используйте + в телефонных номерах
5. ❌ Не храните большие объекты в Redis (>1MB)

## 📊 Мониторинг

### Проверка состояния
```bash
redis-cli -p 6380 info memory
redis-cli -p 6380 dbsize
```

### Поиск проблемных ключей
```bash
redis-cli -p 6380 --scan --pattern "*\[object Object\]*"
redis-cli -p 6380 --scan --pattern "*+7*"
```

## 🔄 Миграция данных

При изменении схемы:
1. Обновите `scripts/migrate-redis-keys.js`
2. Запустите миграцию
3. Обновите код для использования новой схемы
4. Обновите эту документацию