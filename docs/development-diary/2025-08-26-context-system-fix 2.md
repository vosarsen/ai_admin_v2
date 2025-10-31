# Исправление системы контекста между сообщениями

**Дата**: 26 августа 2025
**Автор**: Команда разработки
**Статус**: ✅ Решено и протестировано

## Контекст проблемы

При тестировании реальных диалогов из базы данных была обнаружена критическая проблема: AI Admin терял контекст между сообщениями, несмотря на то что контекст сохранялся в Redis.

### Пример проблемы:
```
Пользователь: хочу записаться в четверг
AI: На четверг есть время... [находит правильно]
Пользователь: Давайте на 16:00  
AI: На какую услугу хотите записаться? [забыл что уже обсуждали]
```

## Анализ

### Две системы контекста
В проекте работают параллельно две системы:
1. **Старая система** (`src/services/context/index.js`)
   - Ключи в Redis: `context:companyId:phone`
   - Сохраняет контекст в поле `data` как JSON строку
   
2. **Новая система context-v2** (`src/services/context/context-service-v2.js`)  
   - Ключи в Redis: `dialog:companyId:phone`
   - Структурированное хранение с полем `selection`

### Корень проблемы
При отладке выяснилось:
1. Контекст СОХРАНЯЛСЯ в Redis: `"dataField":"{\"lastDate\":\"четверг\",\"lastService\":\"СТРИЖКА\"}"`
2. Но НЕ ПЕРЕДАВАЛСЯ в Stage 1 процессор
3. Метод `getContext()` старой системы не возвращал поле `data`
4. two-stage-processor не передавал `currentSelection` из context-v2

## Решение

### 1. Исправлен contextService (`src/services/context/index.js`)
```javascript
return {
  // ... другие поля
  // ВАЖНО: Добавляем поле data для передачи в two-stage processor
  data: contextData?.data
};
```

### 2. Обновлен two-stage-processor
```javascript
const commandPromptText = this.commandPrompt.getPrompt({
  // ... другие параметры
  currentSelection: context.currentSelection // Передаем из context-v2
});
```

### 3. Улучшен промпт (`two-stage-command-prompt.js`)
```javascript
// Проверяем ТРИ источника контекста
const previousContext = {
  lastService: currentSelection.service || parsedRedisData.lastService || parsedRedisData.selectedService,
  lastDate: currentSelection.date || parsedRedisData.lastDate || parsedRedisData.selectedDate,
  // ...
};
```

## Тестирование

### Тестовый диалог:
```
Message 1: "хочу записаться в четверг"
Результат: AI нашел слоты на четверг, сохранил контекст

Message 2: "Давайте на 16:00"  
Результат: ✅ AI использовал сохраненный контекст и создал запись
```

### Логи подтверждают:
```
📝 Previous context for Stage 1: {
  lastService: 'СТРИЖКА',
  lastStaff: 'Бари',
  lastDate: 'четверг'
}

✅ CREATE_BOOKING успешно создала запись id: 1241378607
🤖 Bot: "Отлично! Записал вас на мужскую стрижку 28 августа в 16:00 к мастеру Бари."
```

## Технические детали

### Измененные файлы:
1. `/src/services/context/index.js` - добавлено поле `data` в return
2. `/src/services/ai-admin-v2/modules/two-stage-processor.js` - передача currentSelection
3. `/src/services/ai-admin-v2/prompts/two-stage-command-prompt.js` - проверка всех источников

### Ключевые изменения:
- Обеспечена совместимость между двумя системами контекста
- Контекст из старой системы теперь доступен в новой
- Поддержка различных форматов полей (lastService/selectedService)

## Выводы

1. **Проблема решена полностью** - контекст теперь сохраняется и используется между сообщениями
2. **Обратная совместимость** - работают обе системы контекста
3. **Производительность** - изменения не влияют на скорость работы

## Рекомендации на будущее

1. Постепенно мигрировать на единую систему context-v2
2. Удалить старую систему после полной миграции
3. Добавить автотесты для проверки сохранения контекста