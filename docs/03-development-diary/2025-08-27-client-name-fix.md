# Исправление использования имени клиента из БД в Two-Stage процессоре

## Дата: 27 августа 2025

## Проблема
AI не использовал имя клиента из базы данных, несмотря на то, что клиент был в БД с полной информацией. Вместо приветствия по имени, бот спрашивал "Как вас зовут?".

## Анализ проблемы

### Что происходило:
1. Клиент "Арсен" существовал в БД с полной информацией
2. `data-loader.js` успешно загружал клиента из БД
3. НО данные клиента НЕ попадали в Redis кэш
4. `context-service-v2` проверял только Redis, не находил там данные
5. AI получал контекст без информации о клиенте

### Архитектурная проблема:
В методе `_enrichContextWithDatabaseData` в `context-manager-v2.js` загружались:
- company
- services  
- staff
- staffSchedules
- businessStats

Но НЕ загружался client из БД!

## Решение

### 1. Добавлена загрузка клиента из БД в context-manager-v2
```javascript
// В методе _enrichContextWithDatabaseData добавлено:
const [company, services, staff, staffSchedules, businessStats, client] = await Promise.all([
  // ... другие загрузки ...
  
  // Загружаем клиента из БД если его нет в Redis контексте
  context.client || dataLoader.loadClient(phone, companyId).catch(e => {
    logger.error('Failed to load client:', e.message);
    return null;
  })
]);
```

### 2. Добавлено сохранение клиента в Redis после загрузки
```javascript
// Если загрузили клиента из БД - сохраним его в Redis для будущих запросов
if (client && !context.client) {
  logger.info(`Saving client ${client.name} to Redis cache`);
  await contextServiceV2.saveClientCache(phone, companyId, client).catch(e => {
    logger.error('Failed to save client to Redis:', e.message);
  });
}
```

### 3. Включен Two-Stage процессор в production
```javascript
// ecosystem.config.js
env: {
  NODE_ENV: 'production',
  AI_PROVIDER: 'deepseek',
  AI_PROMPT_VERSION: 'two-stage',  // Two-stage для быстрой обработки
  USE_TWO_STAGE: 'true'  // Явно включаем two-stage процессор
}
```

## Архитектура Two-Stage процессора

Two-stage процессор использует два отдельных промпта:
1. **Stage 1: Command Extraction** (`two-stage-command-prompt.js`)
   - Извлекает команды из сообщения клиента
   - Возвращает JSON с командами
   - ~8 секунд

2. **Stage 2: Response Generation** (`two-stage-response-prompt.js`)
   - Получает результаты выполненных команд
   - Генерирует человечный ответ
   - Использует имя клиента из контекста
   - ~5 секунд

Общее время: ~13 секунд (vs 33 секунды для ReAct)

## Результат

✅ **Проблема решена:**
- Клиент загружается из БД если его нет в Redis
- Данные клиента сохраняются в Redis для будущих запросов
- AI теперь использует имя клиента в приветствии
- Two-stage процессор работает корректно

## Тестирование

```javascript
// Пример ответа бота после исправлений:
Клиент: "Привет! Хочу записаться на стрижку"
Бот: "Привет, Арсен! На какой день хотите записаться на стрижку?"
// ✅ Имя используется!
```

## Важные заметки

1. **Предупреждение о промпте** - prompt-manager выдает предупреждение "Prompt two-stage not found", но это не критично. Two-stage процессор загружает промпты напрямую через require.

2. **Redis fallback** - Если Redis недоступен, система использует fallback на memory cache.

3. **Производительность** - Первый запрос загружает данные из БД (~1-2 сек), последующие используют кэш (~50ms).

## Файлы изменены
- `src/services/ai-admin-v2/modules/context-manager-v2.js` - добавлена загрузка клиента
- `ecosystem.config.js` - включен two-stage процессор