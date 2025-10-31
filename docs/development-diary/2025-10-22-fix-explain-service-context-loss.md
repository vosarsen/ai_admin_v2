# Исправление потери контекста после EXPLAIN_SERVICE (НЕПОЛНОЕ РЕШЕНИЕ)

**Дата:** 22 октября 2025
**Ветка:** `feature/redis-context-cache`
**Статус:** ⚠️ НЕПОЛНОЕ РЕШЕНИЕ - решило только потерю контекста, но НЕ решило персонализацию
**Коммиты:** `47447f2`, `8d1b88b`, `30d3b93`, `d5c76a0`

> **⚠️ ВАЖНО:** Это исправление решило проблему **потери контекста** (бот переспрашивал "На какую услугу?"),
> но **НЕ решило** проблему **персонализации** (бот записывал на неправильную услугу).
> Полное решение см. в `2025-10-22-fix-personalization-overriding-context.md`

---

## 🐛 Проблема

После внедрения команды `EXPLAIN_SERVICE` обнаружили баг в диалоге:

```
Бот: "ЭКСПРЕСС-СТРИЖКА (1200₽, 30 мин) - это стрижка за полчаса..."
Бот: "Хотите записаться на экспресс-стрижку?"
Клиент: "Да. Сегодня можно?"
Бот: "Сегодня свободно: 17:00, 17:30, 18:00..."
Бот: "На какую услугу хотите записаться?" ❌
```

**Ожидаемое поведение:**
```
Бот: "На какое время вас записать?" ✅
```

Система **теряла контекст** выбранной услуги и переспрашивала.

---

## 🔍 Анализ

### Глубокое исследование показало **4 связанные проблемы**:

#### 1. `explainService()` не сохранял услугу в Redis
**Файл:** `src/services/ai-admin-v2/modules/command-handler.js:2302`

```javascript
// ❌ Было
async explainService(params, context) {
  const service = matches[0];
  return { service: { title: service.title, ... } };
  // НЕ сохраняет в Redis!
}
```

**Проблема:** После объяснения услуги контекст терялся при следующем сообщении.

---

#### 2. Stage 1 использовал историю клиента вместо `lastService`
**Файл:** `src/services/ai-admin-v2/prompts/two-stage-command-prompt.js`

**Логи показали:**
```javascript
📝 Previous context for Stage 1: {
  lastService: 'экспресс-стрижка',  // ✅ Есть!
  ...
}

// ❌ НО Stage 1 выдал:
Executing command: SEARCH_SLOTS {
  service_name: "СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ"  // ❌ Неправильно!
  // Использовал частую услугу клиента (4/8 визитов)
}
```

**Проблема:** Stage 1 игнорировал `lastService` в пользу персонализированного поиска по истории.

---

#### 3. `command-handler` не передавал `service` в результатах
**Файл:** `src/services/ai-admin-v2/modules/command-handler.js:197`

```javascript
// ❌ Было
results.push({
  type: 'slots',
  data: slotsResult.slots,  // Только массив слотов
  // НЕТ service/staff метаданных!
});
```

**Результат в `formatCommandResults()`:**
```javascript
✅ SEARCH_SLOTS: Найдено 6 слотов
Слоты: 17:00, 17:30...
Услуга: не указана  ❌
Мастер: Бари
```

**Проблема:** Stage 2 не видел название услуги в результатах команды.

---

#### 4. Stage 2 не проверял наличие услуги
**Файл:** `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js:330`

```javascript
// ❌ Было
📅 ПОКАЗ СЛОТОВ:
"[Дата] свободно: [слоты]
Обычно спрашивай: На какое время вас записать?"
// Всегда один и тот же вопрос!
```

**Проблема:** Промпт не инструктировал Stage 2 проверять, указана ли услуга.

---

## ✅ Решение

### Исправление #1: Сохранение услуги в контекст
**Commit:** `47447f2`
**Файл:** `src/services/ai-admin-v2/modules/command-handler.js`

```javascript
async explainService(params, context) {
  const service = matches[0];

  // ✅ СОХРАНЯЕМ услугу в контекст после объяснения
  await contextServiceV2.updateDialogContext(context.phone, context.company.id, {
    selection: {
      service: service.title,
      lastCommand: 'EXPLAIN_SERVICE',
      explainedServiceAt: new Date().toISOString()
    }
  });

  return { service: { title: service.title, ... } };
}
```

**Результат:** `lastService` теперь доступен в следующем сообщении.

---

### Исправление #2: Усиление промпта Stage 1
**Commit:** `8d1b88b`
**Файл:** `src/services/ai-admin-v2/prompts/two-stage-command-prompt.js`

```javascript
3. ПОДТВЕРЖДЕНИЯ И КОНТЕКСТ:
- ⚠️ КРИТИЧНО: Всегда используй lastService, lastDate, lastStaff из контекста - НЕ меняй их!
- ⚠️ КРИТИЧНО: Если есть lastService + утвердительный ответ ("Да", "можно", "давай")
  → ВСЕГДА используй lastService, НЕ ищи другую услугу!

// Пример:
lastService="экспресс-стрижка", "Да. Сегодня можно?"
→ SEARCH_SLOTS с service_name="экспресс-стрижка" (НЕ меняй на другую услугу!)
```

**Результат:** Stage 1 теперь приоритизирует `lastService` над историей клиента.

---

### Исправление #3: Передача service/staff в результатах
**Commit:** `d5c76a0`
**Файл:** `src/services/ai-admin-v2/modules/command-handler.js:197-204`

```javascript
results.push({
  type: 'slots',
  data: slotsResult.slots,
  partialWindows: slotsResult.partialWindows,
  // ✅ КРИТИЧНО: Передаём service и staff для Stage 2
  service: slotsResult.service?.title || cmd.params.service_name,
  staff: slotsResult.staff?.name || cmd.params.staff_name
});
```

**Файл:** `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js:85-94`

```javascript
} else if (Array.isArray(data)) {
  slots = data;
  // Извлекаем service и staff из result (верхний уровень)
  service = result.service;  // ✅
  staff = result.staff;
  // Fallback: из первого слота
  if (!service && slots.length > 0) {
    service = slots[0].service_name;
  }
}
```

**Результат в `formatCommandResults()`:**
```javascript
✅ SEARCH_SLOTS: Найдено 6 слотов
Слоты: 17:00, 17:30...
Услуга: ЭКСПРЕСС-СТРИЖКА  ✅
Мастер: Бари
```

---

### Исправление #4: Условная логика в Stage 2
**Commit:** `30d3b93`
**Файл:** `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js:330-348`

```javascript
📅 ПОКАЗ СЛОТОВ (SEARCH_SLOTS успешно):

⚠️ КРИТИЧНО: Проверь, указана ли услуга в результате!

ЕСЛИ в результате "Услуга: [название]" (услуга УЖЕ выбрана):
→ "[Имя], [дата] есть свободное время у [мастер]:
   [слоты]

   На какое время вас записать?"

   ❌ НЕ спрашивай "На какую услугу?" - услуга УЖЕ выбрана!

ЕСЛИ в результате "Услуга: не указана" (услуга НЕ выбрана):
→ "[Имя], [дата] свободно:
   [слоты]

   На какую услугу хотите записаться?"
```

**Результат:** Stage 2 теперь проверяет наличие услуги перед генерацией вопроса.

---

## 🧪 Тестирование

### Полный сценарий (тестовый номер: 89686484488)

```
1️⃣ Клиент: "Что такое экспресс-стрижка?"
   Бот: "ЭКСПРЕСС-СТРИЖКА (1200₽, 30 мин) - это стрижка за полчаса..."
   Бот: "Хотите записаться на экспресс-стрижку?"

   ✅ Redis context: selection.service = "ЭКСПРЕСС-СТРИЖКА"

2️⃣ Клиент: "Да. Сегодня можно?"

   ✅ Stage 1 context: lastService = "экспресс-стрижка"
   ✅ Stage 1 command: SEARCH_SLOTS(service_name="экспресс-стрижка")
   ✅ Command results: service="ЭКСПРЕСС-СТРИЖКА", staff="Бари"
   ✅ formatCommandResults: "Услуга: ЭКСПРЕСС-СТРИЖКА"

   Бот: "Арсен, сегодня есть свободное время у Бари на экспресс-стрижку:"
   Бот: "17:00, 17:30, 18:00, 18:30, 21:00, 21:30"
   Бот: "На какое время вас записать?" ✅
```

### Ключевые логи

```javascript
// ✅ Сохранение в explainService
💾 Saving explained service to context: ЭКСПРЕСС-СТРИЖКА
✅ Context updated: service="ЭКСПРЕСС-СТРИЖКА" saved for 79686484488

// ✅ Stage 1 правильно использовал контекст
📝 Previous context for Stage 1: {
  lastService: 'экспресс-стрижка',
  lastStaff: 'Бари',
  lastDate: 'сегодня'
}
Executing command: SEARCH_SLOTS {
  service_name: "экспресс-стрижка",  // ✅
  staff_name: "Бари",
  date: "сегодня"
}

// ✅ formatCommandResults получил service
📊 formatCommandResults received: [{
  "data": [...],
  "service": "ЭКСПРЕСС-СТРИЖКА",  // ✅
  "staff": "Бари"
}]

// ✅ Stage 2 правильный ответ
"На какое время вас записать?"
```

---

## 📊 Метрики

| Метрика | Значение |
|---------|----------|
| Файлов изменено | 2 |
| Строк добавлено | +47 |
| Строк удалено | -10 |
| Время на исправление | ~2 часа |
| Коммитов | 4 |

---

## 🎯 Влияние

### ДО исправления:
- ❌ Клиент спрашивал про услугу → бот объяснял → клиент соглашался → **бот переспрашивал**
- Негативный UX: клиент чувствует, что бот его не слушает
- Потеря контекста в 100% случаев после EXPLAIN_SERVICE

### ПОСЛЕ этого исправления (неполного):
- ✅ Клиент спрашивает про услугу → бот объясняет → клиент соглашается → **бот сразу показывает время**
- ✅ Естественный диалог без повторений
- ✅ Контекст сохраняется через весь диалоговый флоу
- ❌ **НО:** Бот всё ещё записывает на **неправильную услугу** (персонализированную)

### ПОСЛЕ полного исправления (коммиты da00871, 39adeb0, 922c5e0):
- ✅ Бот записывает на **правильную услугу** (ту, о которой спрашивал клиент)
- См. подробности в `2025-10-22-fix-personalization-overriding-context.md`

---

## 🔄 Архитектурное понимание

### Поток данных в Two-Stage:

```
explainService()
    ↓ сохраняет в Redis
context.selection.service = "X"
    ↓
Stage 1 (command extraction)
    ↓ читает context.lastService
SEARCH_SLOTS(service_name="X")
    ↓
command-handler
    ↓ добавляет service в результаты
results.push({ data, service: "X", staff: "Y" })
    ↓
formatCommandResults()
    ↓ извлекает из result.service
"Услуга: X"
    ↓
Stage 2 (response generation)
    ↓ проверяет наличие услуги
"На какое время?" ✅ или "На какую услугу?" в зависимости от наличия
```

### Ключевые инсайты:

1. **Redis контекст критичен** - без сохранения в Redis, Stage 1 не видит выбор
2. **Метаданные должны быть на верхнем уровне** - `formatCommandResults()` не может извлекать из вложенных структур
3. **Stage 2 нужны явные инструкции** - AI не делает предположений о том, что нужно проверить
4. **Персонализация может конфликтовать с контекстом** - нужны приоритеты

---

## 🚀 Деплой

```bash
# Ветка
git push origin feature/redis-context-cache

# Сервер
ssh root@46.149.70.219
cd /opt/ai-admin
git pull
pm2 restart ai-admin-worker-v2
```

**Проверено в production:** ✅
**Тестовый номер:** 89686484488
**Результат:** Все 4 исправления работают корректно

---

## 📚 Связанные документы

- `docs/features/EXPLAIN_SERVICE_COMMAND.md` - Документация команды
- `docs/development-diary/2025-10-22-explain-service-command.md` - История внедрения
- `src/services/ai-admin-v2/modules/command-handler.js` - Обработчик команд
- `src/services/ai-admin-v2/prompts/two-stage-command-prompt.js` - Stage 1 prompt
- `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js` - Stage 2 prompt
- `src/services/context/context-service-v2.js` - Redis контекст

---

## ✅ Чек-лист

- [x] Баг воспроизведён
- [x] Корневая причина найдена (4 связанные проблемы)
- [x] Исправления реализованы
- [x] Протестировано локально
- [x] Задеплоено в production
- [x] Протестировано в production
- [x] Документировано в дневнике
- [ ] ⚠️ **Обнаружена дополнительная проблема (персонализация)** - см. продолжение ниже

---

## ⚠️ ПРОДОЛЖЕНИЕ: Обнаружена дополнительная проблема

**Статус:** Эти исправления решили **потерю контекста**, но не решили **персонализацию**.

### Что было решено:
✅ Бот больше НЕ переспрашивает "На какую услугу?" после показа слотов
✅ Контекст сохраняется через весь диалоговый флоу
✅ Stage 2 видит название услуги в результатах

### Что НЕ было решено:
❌ Бот всё ещё записывает клиента на **неправильную услугу** (персонализированную)
❌ Пример: клиент просит экспресс-стрижку → бот записывает на стрижку+бороду

### Почему это произошло:
Мы исправили передачу метаданных (`service` и `staff` в результатах), но **НЕ исправили** сам поиск услуги в `searchSlots()` и `createBooking()`. Эти функции продолжали использовать персонализацию вместо `lastSearch.service_id`.

### Решение:
Полное решение реализовано в **3 коммитах** (da00871, 39adeb0, 922c5e0).
См. подробности в: `docs/development-diary/2025-10-22-fix-personalization-overriding-context.md`

---

**Автор:** Claude & Arsen
**Дата завершения первой части:** 22 октября 2025, 16:46 MSK
**Дата обнаружения дополнительной проблемы:** 22 октября 2025, 17:00 MSK
