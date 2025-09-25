# Development Diary: 2025-09-25 - Service Personalization Fix

## 🎯 Проблема
Бот предлагал недоступные слоты и выбирал неправильные услуги для клиентов с историей.

### Конкретный кейс:
- Клиент: Арсен (79686484488)
- История: 6 визитов, чаще всего "СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ" (60%)
- **Проблема 1:** Бот выбирал "СТРИЖКА: УТРО" вместо любимой услуги клиента
- **Проблема 2:** Предлагал слоты 15:00, 16:00, 14:30, которые уже были заняты
- **Проблема 3:** "СТРИЖКА: УТРО" доступна только до 13:00, но бот пытался записать на 14:30

## 🔍 Анализ причин

### 1. Неполная загрузка данных клиента
**Где:** `src/services/ai-admin-v2/modules/context-manager-v2.js`
**Проблема:** Условие проверки `context.client && context.client.name` не учитывало `visit_history`
**Результат:** История клиента не загружалась из БД

### 2. Несоответствие структур данных
**Где:** `src/services/ai-admin-v2/modules/service-matcher.js`
**Проблема:**
- Код ожидал: `client.visits`
- БД возвращала: `client.visit_history`
- Код ожидал: `client.average_check`
- БД возвращала: `client.average_bill`
- Код ожидал: `v.service_id`
- БД возвращала: `v.services` (массив названий)

### 3. Отсутствие учета времени при выборе услуги
**Проблема:** При одинаковом score (160) для услуг УТРО/ДЕНЬ/ВЕЧЕР всегда выбиралась первая
**Результат:** Выбиралась "СТРИЖКА: УТРО" даже для времени после 13:00

## ✅ Что исправлено

### 1. Загрузка полных данных клиента
```javascript
// context-manager-v2.js - строка 77
// БЫЛО:
if (context.company && context.services && context.staff &&
    context.client && context.client.name) {
  return context;
}

// СТАЛО:
if (context.company && context.services && context.staff &&
    context.client && context.client.name && context.client.visit_history) {
  return context;
}
```

### 2. Исправлен маппинг полей в ServiceMatcher
```javascript
// service-matcher.js - строка 407
// БЫЛО:
if (client.visits && client.visits.length > 0) {
  const serviceCount = client.visits.filter(v => v.service_id === service.id).length;

// СТАЛО:
if (client.visit_history && client.visit_history.length > 0) {
  const serviceCount = client.visit_history.filter(v => {
    if (!v.services || !Array.isArray(v.services)) return false;
    return v.services.some(serviceName =>
      this.normalizeText(serviceName).includes(this.normalizeText(service.title)) ||
      this.normalizeText(service.title).includes(this.normalizeText(serviceName))
    );
  }).length;
```

### 3. Добавлено логирование для отладки
```javascript
// data-loader.js - строка 187
logger.info(`✅ Client found: ${data.name} (${data.phone})`, {
  visitHistoryLength: data.visit_history?.length || 0,
  lastServices: data.last_services || [],
  visitCount: data.visit_count || 0
});
```

## ❌ Что НЕ исправлено (требует доработки)

### 1. Персонализация не вызывается
**Проблема:** Метод `findTopMatchesWithPersonalization` должен вызываться, но в логах не видно
**Где искать:** `src/services/ai-admin-v2/modules/command-handler.js` строка 421-436
**Что проверить:**
- Почему `context.client` может быть undefined на момент вызова
- Отладочный лог `Service search context check` не выводится

### 2. Учет времени дня при выборе услуги
**Задача:** Если клиент просит "стрижку" без уточнения:
- До 13:00 → выбирать "СТРИЖКА: УТРО"
- 13:00-17:00 → выбирать "СТРИЖКА: ДЕНЬ"
- После 17:00 → выбирать "СТРИЖКА: ВЕЧЕР"

**Предлагаемое решение:**
```javascript
// service-matcher.js - добавить новый метод
findBestMatchWithTime(query, services, preferredTime) {
  const scoredServices = // ... обычная логика

  // При одинаковых score проверяем время
  const topScore = scoredServices[0].score;
  const topServices = scoredServices.filter(s => s.score === topScore);

  if (topServices.length > 1 && preferredTime) {
    const hour = parseInt(preferredTime.split(':')[0]);

    for (const service of topServices) {
      const title = service.title.toLowerCase();
      if (title.includes('утро') && hour < 13) return service;
      if (title.includes('день') && hour >= 13 && hour < 17) return service;
      if (title.includes('вечер') && hour >= 17) return service;
    }
  }

  return scoredServices[0];
}
```

### 3. Валидация доступности слотов
**Проблема:** API YClients возвращает слоты для услуги "СТРИЖКА: УТРО" даже после 13:00
**Решение:** Добавить дополнительную валидацию на стороне бота

## 📋 План доработки

### Шаг 1: Исправить вызов персонализации
1. Добавить больше логирования в `command-handler.js`
2. Проверить, почему `context.client` может быть пустым
3. Убедиться, что персонализация вызывается для всех клиентов с историей

### Шаг 2: Реализовать учет времени
1. Добавить метод `findBestMatchWithTime` в `ServiceMatcher`
2. Передавать желаемое время из контекста
3. Приоритизировать услуги по времени дня

### Шаг 3: Улучшить валидацию
1. Добавить проверку временных ограничений услуг
2. Фильтровать слоты, недоступные для конкретной услуги
3. Учитывать рабочие часы и перерывы

## 🧪 Тестовые сценарии

### Тест 1: Персонализация для постоянного клиента
```
Клиент: 89686484488
Сообщение: "Хочу записаться на стрижку"
Ожидаемый результат: Выбор "СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ" (60% истории)
```

### Тест 2: Учет времени дня
```
Сообщение: "Хочу записаться на стрижку в 10:00"
Ожидаемый результат: "СТРИЖКА: УТРО"

Сообщение: "Хочу записаться на стрижку в 15:00"
Ожидаемый результат: "СТРИЖКА: ДЕНЬ"

Сообщение: "Хочу записаться на стрижку в 19:00"
Ожидаемый результат: "СТРИЖКА: ВЕЧЕР"
```

### Тест 3: Валидация недоступных слотов
```
Услуга: "СТРИЖКА: УТРО"
Время: 14:30
Ожидаемый результат: Ошибка "Эта услуга доступна только до 13:00"
```

## 📊 Метрики успеха

1. **Персонализация работает:** В логах видно "🎯 Personalized search activated"
2. **Правильный выбор услуги:** Для клиентов с историей выбирается их любимая услуга
3. **Корректные слоты:** Не предлагаются занятые или недоступные времена
4. **Учет времени:** Услуги УТРО/ДЕНЬ/ВЕЧЕР выбираются правильно

## 🔗 Связанные файлы

- `src/services/ai-admin-v2/modules/context-manager-v2.js`
- `src/services/ai-admin-v2/modules/service-matcher.js`
- `src/services/ai-admin-v2/modules/command-handler.js`
- `src/services/ai-admin-v2/modules/data-loader.js`
- `src/services/booking/slot-validator.js`

## 📝 Коммиты

1. `46f58be` - fix: service personalization now properly uses client.visit_history
2. `8037bcb` - fix: add debug logging for service personalization
3. `14e481e` - fix: add debug logging for client data loading
4. `83f4e27` - fix: ensure client visit_history is always loaded from database

---
**Статус:** Частично исправлено, требует доработки
**Дата:** 25 сентября 2025
**Автор:** AI Admin Team