# AI Provider System Documentation

## Обзор

Новая система AI провайдеров позволяет легко переключаться между различными AI моделями и тестировать разные промпты без изменения кода.

## Архитектура

### 1. Provider Factory (`src/services/ai/provider-factory.js`)
- Централизованное управление AI провайдерами
- Поддержка: DeepSeek, Qwen (разные модели)
- Кэширование провайдеров для производительности

### 2. Prompt Manager (`src/services/ai-admin-v2/prompt-manager.js`)
- Управление различными версиями промптов
- A/B тестирование промптов
- Сбор статистики эффективности

### 3. AI Management API (`src/api/routes/ai-management.js`)
- REST API для управления провайдерами и промптами
- Просмотр статистики
- Тестирование промптов

## Использование

### Переключение AI провайдера

```bash
# Посмотреть доступные провайдеры
node scripts/switch-ai-provider.js list

# Переключиться на Qwen
node scripts/switch-ai-provider.js switch qwen

# Переключиться на DeepSeek
node scripts/switch-ai-provider.js switch deepseek

# Использовать Qwen 72B модель
node scripts/switch-ai-provider.js switch qwen-72b
```

### Управление промптами

```bash
# Посмотреть доступные промпты и статистику
node scripts/manage-prompts.js list

# Переключиться на другой промпт
node scripts/manage-prompts.js switch strict-prompt

# Включить A/B тестирование
node scripts/manage-prompts.js ab-test on

# Протестировать промпт
node scripts/manage-prompts.js test "Хочу записаться на стрижку"
node scripts/manage-prompts.js test "Когда свободно?" enhanced-prompt
```

### Переменные окружения

```bash
# Выбор AI провайдера (deepseek, qwen, qwen-plus, qwen-72b)
AI_PROVIDER=qwen

# Выбор активного промпта
AI_PROMPT_VERSION=strict-prompt

# Включение A/B тестирования промптов
AI_PROMPT_AB_TEST=true

# API ключи
DEEPSEEK_API_KEY=your_key
DASHSCOPE_API_KEY=your_key
```

## Доступные промпты

### 1. base-prompt (v1.0)
- Базовый промпт с минимальными инструкциями
- Подходит для простых запросов

### 2. enhanced-prompt (v2.0)
- Улучшенный промпт с примерами диалогов
- Рекомендуется для большинства случаев
- Включает эмодзи для визуального разделения

### 3. strict-prompt (v3.0)
- Строгий формат для Qwen
- Четкие шаблоны ответов
- Минималистичный стиль без лишних слов

## API Endpoints

### Провайдеры
- `GET /api/ai/providers` - список провайдеров
- `POST /api/ai/providers/switch` - переключить провайдера

### Промпты
- `GET /api/ai/prompts` - список промптов и статистика
- `POST /api/ai/prompts/switch` - переключить промпт
- `POST /api/ai/prompts/ab-test` - включить/выключить A/B тест
- `GET /api/ai/prompts/stats` - подробная статистика
- `POST /api/ai/prompts/test` - протестировать промпт

## Создание нового промпта

1. Создайте файл в `src/services/ai-admin-v2/prompts/`
2. Экспортируйте объект с методом `getPrompt(context)`:

```javascript
module.exports = {
  version: '1.0',
  name: 'my-prompt',
  
  getPrompt: (context) => {
    return `Ваш промпт здесь...
    
    Сообщение: {message}`;
  }
};
```

3. Промпт автоматически появится в списке доступных

## Статистика

Система собирает следующую статистику по каждому промпту:
- Количество использований
- Процент успешных ответов
- Среднее количество выполненных команд
- Среднее время ответа
- Количество ошибок

## Рекомендации

1. **Для Qwen**: используйте `strict-prompt` - он лучше работает с этой моделью
2. **Для DeepSeek**: `enhanced-prompt` показывает лучшие результаты
3. **A/B тестирование**: включайте на несколько часов для сбора статистики
4. **Мониторинг**: регулярно проверяйте статистику через `manage-prompts.js list`

## Troubleshooting

### Qwen не выполняет команды
1. Переключитесь на `strict-prompt`
2. Если не помогает, используйте DeepSeek: `AI_PROVIDER=deepseek`

### Ошибка API ключа
1. Проверьте переменные окружения
2. Убедитесь, что ключ активен в консоли провайдера

### Промпт не загружается
1. Проверьте синтаксис файла промпта
2. Убедитесь, что файл экспортирует правильную структуру