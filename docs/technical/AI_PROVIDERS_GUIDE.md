# AI Providers Guide

## Overview

AI Admin v2 поддерживает несколько AI провайдеров для генерации ответов. Система построена так, что позволяет легко переключаться между провайдерами без изменения кода.

## Доступные провайдеры

### 1. DeepSeek (Основной)
- **Модель**: `deepseek-chat`
- **Стоимость**: ~$0.14/1M input tokens, $0.28/1M output tokens
- **Время ответа**: 5-9 секунд
- **Особенности**:
  - Проверен в production
  - Хорошо работает с русским языком
  - Правильно генерирует команды
  - Самый дешевый вариант

### 2. Qwen Plus
- **Модель**: `qwen-plus`
- **Стоимость**: Средняя (точные цены на сайте Alibaba Cloud)
- **Время ответа**: 2-5 секунд
- **Особенности**:
  - Сбалансированная производительность
  - Хорошо для general-purpose задач
  - Быстрее DeepSeek

### 3. Qwen Max
- **Модель**: `qwen-max`
- **Стоимость**: Высокая
- **Время ответа**: 3-6 секунд
- **Особенности**:
  - Самая мощная модель
  - Для сложных multi-step задач
  - Лучшее качество reasoning

### 4. Qwen Turbo
- **Модель**: `qwen-turbo`
- **Стоимость**: Низкая
- **Время ответа**: 1-3 секунды
- **Особенности**:
  - Самая быстрая модель
  - Для простых задач
  - Оптимальна для high-throughput

## Настройка

### 1. Переменные окружения (.env)

```bash
# Выбор AI провайдера
AI_PROVIDER=deepseek  # Опции: deepseek, qwen-plus, qwen-max, qwen-turbo

# Настройки DeepSeek
DEEPSEEK_API_KEY=sk-ваш-ключ
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TEMPERATURE=0.7
DEEPSEEK_MAX_TOKENS=1500

# Настройки Qwen (если используется)
DASHSCOPE_API_KEY=sk-ваш-ключ-alibaba

# Выбор промпта
AI_PROMPT_VERSION=detailed-prompt  # Опции: base-prompt, enhanced-prompt, strict-prompt, detailed-prompt
```

### 2. Переключение провайдера

Для переключения достаточно изменить `AI_PROVIDER` в `.env`:

```bash
# Переключение на Qwen Plus
AI_PROVIDER=qwen-plus

# Вернуться на DeepSeek
AI_PROVIDER=deepseek
```

После изменения нужно перезапустить воркер:
```bash
pm2 restart ai-admin-worker-v2 --update-env
```

## Промпты

Система поддерживает несколько версий промптов:

### 1. base-prompt
- Минимальный промпт
- Только базовые инструкции
- Подходит для тестирования

### 2. enhanced-prompt
- Промпт с примерами
- Рекомендуется для DeepSeek
- Хороший баланс размера и детализации

### 3. strict-prompt
- Строгий формат команд
- Рекомендуется для Qwen
- Фокус на точном выполнении инструкций

### 4. detailed-prompt (По умолчанию)
- Самый подробный промпт
- Все правила и примеры
- Лучшее качество ответов
- Используется в production

## Архитектура

### Provider Factory (`src/services/ai/provider-factory.js`)

```javascript
// Получение провайдера
const provider = await providerFactory.getProvider(); // Использует AI_PROVIDER из .env

// Или явное указание
const provider = await providerFactory.getProvider('qwen-plus');

// Вызов AI
const response = await provider.call(prompt, {
  message: userMessage,
  temperature: 0.7,
  maxTokens: 1000
});
```

### Prompt Manager (`src/services/ai-admin-v2/prompt-manager.js`)

```javascript
// Получение активного промпта
const prompt = promptManager.getActivePrompt(context);

// A/B тестирование промптов
const abTestResult = promptManager.getPromptForABTest(context);

// Статистика использования
const stats = promptManager.getStats();
```

## Мониторинг и метрики

### Performance Metrics (`src/services/ai-admin-v2/modules/performance-metrics.js`)

Система автоматически собирает метрики:
- Время ответа AI
- Количество успешных/неудачных вызовов
- Статистика по каждому провайдеру
- Процентили (p95, p99)

Получение метрик:
```javascript
const metrics = aiAdminV2.getPerformanceMetrics();
```

## Troubleshooting

### Ошибка 401 с Qwen
- Проверьте правильность `DASHSCOPE_API_KEY`
- Убедитесь, что ключ активен на https://dashscope.aliyun.com/

### AI не генерирует команды
- Проверьте версию промпта (рекомендуется `detailed-prompt`)
- Для Qwen попробуйте `strict-prompt`
- Проверьте логи: команды должны быть в формате `[COMMAND_NAME params]`

### Fallback на DeepSeek
- Если выбранный провайдер недоступен, система автоматически использует DeepSeek
- Проверьте логи для точной причины

## Рекомендации

### Для production:
- Используйте **DeepSeek** - проверен, дешевый, стабильный
- Промпт: **detailed-prompt**
- Мониторьте метрики производительности

### Для экспериментов:
- **Qwen Plus** - хороший баланс скорости и качества
- **Qwen Max** - для сложных задач требующих reasoning
- Используйте A/B тестирование промптов

### Безопасность:
- Храните API ключи в переменных окружения
- Не коммитьте `.env` файл
- Регулярно ротируйте ключи

## Добавление нового провайдера

1. Добавьте в `provider-factory.js`:
```javascript
case 'new-provider':
  this.providers[providerName] = await this.createNewProvider();
  break;
```

2. Реализуйте метод создания:
```javascript
async createNewProvider() {
  return {
    name: 'new-provider',
    async call(prompt, options = {}) {
      // Реализация вызова API
    }
  };
}
```

3. Добавьте в список доступных:
```javascript
getAvailableProviders() {
  return ['deepseek', 'qwen-plus', 'qwen-max', 'qwen-turbo', 'new-provider'];
}
```

## Команды для быстрого управления

```bash
# Проверить текущего провайдера
cat .env | grep AI_PROVIDER

# Переключить на Qwen Plus
sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=qwen-plus/' .env

# Вернуться на DeepSeek
sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=deepseek/' .env

# Перезапустить с новыми настройками
pm2 restart ai-admin-worker-v2 --update-env
```