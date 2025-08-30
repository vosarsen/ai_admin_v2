# Руководство по Two-Stage процессору

## Обзор

Two-Stage процессор - это упрощённая и быстрая альтернатива ReAct паттерну для обработки сообщений в AI Admin v2. Он обеспечивает **2.5x ускорение** ответов при сохранении качества.

## Архитектура

```mermaid
graph LR
    A[Сообщение клиента] --> B[Stage 1: Извлечение команд]
    B --> C[JSON с командами]
    C --> D[Параллельное выполнение]
    D --> E[Результаты команд]
    E --> F[Stage 2: Генерация ответа]
    F --> G[Ответ клиенту]
```

### Этап 1: Извлечение команд
- **Вход**: Сообщение клиента + контекст
- **AI задача**: Определить какие команды выполнить
- **Выход**: JSON массив команд
- **Время**: ~8 секунд

### Этап 2: Генерация ответа
- **Вход**: Результаты выполненных команд
- **AI задача**: Сформировать человечный ответ
- **Выход**: Текст для клиента
- **Время**: ~5 секунд

## Сравнение с ReAct

| Характеристика | Two-Stage | ReAct |
|----------------|-----------|--------|
| **Скорость** | 13 сек | 33 сек |
| **Итерации** | Всегда 2 | 2-4 |
| **Предсказуемость** | Высокая | Средняя |
| **Сложность отладки** | Простая | Сложная |
| **Формат данных** | JSON | Текстовые блоки |

## Активация

### Через переменные окружения

```bash
# В файле .env
AI_PROMPT_VERSION=two-stage
USE_TWO_STAGE=true
```

### Через командную строку

```bash
# Активировать Two-Stage
export USE_TWO_STAGE=true
export AI_PROMPT_VERSION=two-stage

# Вернуться на ReAct
export USE_TWO_STAGE=false
export AI_PROMPT_VERSION=react-prompt
```

### На сервере

```bash
# Переключиться на Two-Stage
ssh ai-admin-server "cd /opt/ai-admin && \
  sed -i 's/AI_PROMPT_VERSION=.*/AI_PROMPT_VERSION=two-stage/' .env && \
  sed -i 's/USE_TWO_STAGE=.*/USE_TWO_STAGE=true/' .env && \
  pm2 restart ai-admin-worker-v2"

# Проверить статус
ssh ai-admin-server "grep -E 'TWO_STAGE|AI_PROMPT' /opt/ai-admin/.env"
```

## Структура файлов

```
src/services/ai-admin-v2/
├── modules/
│   └── two-stage-processor.js    # Основной процессор
├── prompts/
│   ├── two-stage-command-prompt.js   # Промпт для этапа 1
│   └── two-stage-response-prompt.js  # Промпт для этапа 2
└── index.js                      # Интеграция
```

## Поддерживаемые команды

| Команда | Описание | Параметры |
|---------|----------|-----------|
| `SEARCH_SLOTS` | Поиск свободного времени | service_name, date, staff_name |
| `CREATE_BOOKING` | Создание записи | service_name, date, time, staff_name |
| `CANCEL_BOOKING` | Отмена записи | - |
| `SHOW_PRICES` | Показать цены | - |
| `CHECK_STAFF_SCHEDULE` | Проверить расписание мастера | staff_name, date |

## Примеры работы

### Пример 1: Запрос слотов

**Клиент**: "Какое время свободно на стрижку завтра?"

**Stage 1 выход (JSON)**:
```json
{
  "commands": [
    {
      "name": "SEARCH_SLOTS",
      "params": {
        "service_name": "стрижка",
        "date": "завтра"
      }
    }
  ]
}
```

**Stage 2 ответ**: "Завтра на стрижку свободно: 10:00, 14:00, 17:00. На какое время вас записать?"

### Пример 2: Создание записи

**Клиент**: "Запишите меня на стрижку завтра в 15:00"

**Stage 1 выход (JSON)**:
```json
{
  "commands": [
    {
      "name": "CREATE_BOOKING",
      "params": {
        "service_name": "стрижка",
        "date": "завтра",
        "time": "15:00",
        "staff_name": "Бари"
      }
    }
  ]
}
```

**Stage 2 ответ**: "Арсен, записал вас на стрижку завтра в 15:00 к мастеру Бари. Ждём вас по адресу: Малаховка, Южная улица, 38."

## Тестирование

### Локальное тестирование

```bash
# Запустить тестовый скрипт
node test-two-stage.js

# Тестировать конкретное сообщение
USE_TWO_STAGE=true node test-direct-webhook.js "Ваше сообщение"
```

### Мониторинг в продакшене

```bash
# Проверить логи Two-Stage
ssh ai-admin-server "pm2 logs ai-admin-worker-v2 | grep -E 'Two-Stage|Stage [12]'"

# Посмотреть метрики производительности
ssh ai-admin-server "pm2 logs ai-admin-worker-v2 | grep 'completed in.*ms'"
```

## Отладка

### Частые проблемы

1. **Промпт не найден**
   - Проверьте что файлы промптов существуют
   - Убедитесь что `AI_PROMPT_VERSION=two-stage`

2. **AI не возвращает валидный JSON**
   - Проверьте промпт для Stage 1
   - Есть fallback на regex парсинг

3. **Команды не выполняются**
   - Проверьте логи command-handler
   - Убедитесь что API YClients доступен

### Полезные логи

```bash
# Общий процесс
"🎯 Using Two-Stage processor"
"🚀 Starting Two-Stage processing"

# Stage 1
"📋 Stage 1: Command extraction"
"✅ Stage 1 completed in Xms, found Y commands"

# Выполнение команд
"⚙️ Executing N commands"
"✅ Commands executed in Xms"

# Stage 2
"💬 Stage 2: Response generation"
"✅ Stage 2 completed in Xms"

# Завершение
"🎉 Two-Stage processing completed in Xms"
```

## Метрики производительности

### Средние показатели (продакшен)

- **Stage 1**: 7-9 секунд
- **Выполнение команд**: 10-500 мс (зависит от API)
- **Stage 2**: 4-6 секунд
- **Общее время**: 12-15 секунд

### Сравнение с ReAct

- **Ускорение**: 2.5x
- **Снижение вызовов AI**: 40%
- **Уменьшение вариативности**: 60%

## Расширение функционала

### Добавление новой команды

1. Обновите промпт в `two-stage-command-prompt.js`:
```javascript
// Добавьте в список команд
"5. NEW_COMMAND - описание
   Параметры: param1, param2"
```

2. Добавьте обработку в `command-handler.js`:
```javascript
case 'NEW_COMMAND':
  const result = await this.executeNewCommand(cmd.params, context);
  results.push({ type: 'new_command', data: result });
  break;
```

3. Обновите форматирование в `two-stage-response-prompt.js`:
```javascript
case 'NEW_COMMAND':
  return `✅ NEW_COMMAND: ${data.description}`;
```

## Лучшие практики

1. **Используйте Two-Stage для**:
   - Стандартных запросов на запись
   - Запросов информации (цены, расписание)
   - Простых команд управления

2. **Переключайтесь на ReAct для**:
   - Сложных многоэтапных диалогов
   - Нестандартных запросов
   - Отладки сложных проблем

3. **Мониторинг**:
   - Отслеживайте среднее время ответа
   - Логируйте ошибки парсинга JSON
   - Следите за успешностью команд

## Заключение

Two-Stage процессор обеспечивает оптимальный баланс между скоростью и качеством ответов. При правильной настройке он способен обрабатывать 95% запросов быстрее и эффективнее, чем ReAct, сохраняя при этом гибкость для сложных сценариев.