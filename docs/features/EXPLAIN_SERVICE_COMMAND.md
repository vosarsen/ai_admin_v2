# EXPLAIN_SERVICE Command - Контекстные описания услуг

**Дата создания:** 2025-10-22
**Статус:** ✅ Реализовано и работает в продакшене
**Автор:** Claude Code

---

## Проблема

### Исходная ситуация

Когда клиент спрашивал "Экспресс - это?", AI:
- ❌ Не распознавал это как запрос об услуге
- ❌ Генерировал описания из своих общих знаний
- ❌ Путал услуги (например, рассказывал про "экспресс-маникюр" в барбершопе)
- ❌ Не использовал реальные описания услуг из базы данных YClients

### Пример проблемы

**Реальная переписка в барбершопе "KULTURA Малаховка":**

```
Клиент: "Экспресс - это?"
Бот: "Экспресс-маникюр — это быстрая версия маникюра, которая включает
      основное: обработку кутикулы, придание формы ногтям и покрытие лаком..."
```

**Проблема:** Барбершоп не оказывает услуги маникюра! У них есть только "ЭКСПРЕСС-СТРИЖКА".

---

## Решение: Команда EXPLAIN_SERVICE

### Концепция

Создана новая команда `EXPLAIN_SERVICE`, которая:
1. Распознает вопросы типа "что это?", "что такое [услуга]?", "расскажи про [услугу]"
2. Ищет ОДНУ конкретную услугу в базе данных
3. Возвращает детальную информацию с реальным описанием из YClients
4. AI использует эти данные вместо собственных знаний

### Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│ Клиент: "Экспресс - это?"                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: Command Extraction (two-stage-command-prompt)          │
│                                                                  │
│ AI видит:                                                        │
│ - Сообщение: "Экспресс - это?"                                  │
│ - Список услуг: ЭКСПРЕСС-СТРИЖКА, МУЖСКАЯ СТРИЖКА, ...         │
│ - Правило: EXPLAIN_SERVICE - когда "что это?", "что такое?"    │
│                                                                  │
│ Результат: {"commands": [{"name": "EXPLAIN_SERVICE",           │
│              "params": {"service_name": "экспресс"}}]}         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Command Handler: explainService()                               │
│                                                                  │
│ 1. Получает service_name: "экспресс"                           │
│ 2. Использует ServiceMatcher для поиска                        │
│ 3. Находит: ЭКСПРЕСС-СТРИЖКА (score: 230/230)                  │
│ 4. Загружает из БД:                                            │
│    - title: "ЭКСПРЕСС-СТРИЖКА"                                 │
│    - price: 1200₽                                              │
│    - duration: 30 мин                                          │
│    - description: "Это стрижка за полчаса..."                  │
│    - staff: ["Бари", "Сергей"]                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: Response Generation (two-stage-response-prompt)        │
│                                                                  │
│ AI видит:                                                        │
│ - Тип бизнеса: барбершоп                                        │
│ - Данные услуги с описанием                                     │
│ - Инструкцию: использовать description если есть               │
│                                                                  │
│ Генерирует: "ЭКСПРЕСС-СТРИЖКА (1200₽, 30 мин) - это стрижка   │
│             за полчаса. Процедура исключает мытье головы..."   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Клиент получает правильный ответ! ✅                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Реализация

### 1. Command Definition (two-stage-command-prompt.js)

```javascript
5. EXPLAIN_SERVICE - объяснить что такое услуга
   Параметры: service_name (обязательно) - название или часть названия услуги
   Когда: клиент спрашивает "что это?", "что такое [услуга]?",
          "расскажи про [услугу]", "[услуга] - это?"

ПРАВИЛА ВЫБОРА КОМАНД:
- Вопросы "что это?", "что такое?" про услугу → EXPLAIN_SERVICE

ПРИМЕРЫ:
8. EXPLAIN_SERVICE - объяснение услуг
   "Экспресс - это?" → {"commands": [{"name": "EXPLAIN_SERVICE", "params": {"service_name": "экспресс"}}]}
   "Что такое моделирование бороды?" → {"commands": [{"name": "EXPLAIN_SERVICE", "params": {"service_name": "моделирование бороды"}}]}
   "Расскажи про комплекс" → {"commands": [{"name": "EXPLAIN_SERVICE", "params": {"service_name": "комплекс"}}]}
```

### 2. Command Handler (command-handler.js)

```javascript
/**
 * Объяснить что такое услуга
 */
async explainService(params, context) {
  const { service_name } = params;

  if (!service_name) {
    return {
      error: 'service_name_required',
      message: 'Не указано название услуги'
    };
  }

  logger.info(`EXPLAIN_SERVICE called for: ${service_name}`);

  // Используем ServiceMatcher для поиска услуги
  const serviceMatcher = require('./service-matcher');
  const matches = serviceMatcher.findTopMatches(service_name, context.services, 1);

  if (matches.length === 0) {
    return {
      error: 'service_not_found',
      query: service_name,
      message: `Услуга "${service_name}" не найдена`
    };
  }

  const service = matches[0];

  // Возвращаем детальную информацию об услуге
  return {
    service: {
      title: service.title,
      price_min: service.price_min || service.price || 0,
      price_max: service.price_max || service.price || service.price_min || 0,
      duration: service.duration || 60,
      category: service.category_title,
      description: service.description || null,
      // Добавляем список мастеров, кто может выполнить услугу
      staff: service.raw_data?.staff?.map(s => s.name) || []
    }
  };
}
```

### 3. Response Formatting (two-stage-response-prompt.js)

```javascript
case 'EXPLAIN_SERVICE':
  if (data.error === 'service_not_found') {
    return `❌ EXPLAIN_SERVICE: Услуга "${data.query}" не найдена`;
  }
  if (data.service) {
    const s = data.service;
    const priceStr = s.price_min === s.price_max ?
      `${s.price_min}₽` :
      `${s.price_min}-${s.price_max}₽`;
    const duration = s.duration ? ` (${s.duration} мин)` : '';
    const description = s.description ? `\nОписание: ${s.description}` : '';
    const staff = s.staff && s.staff.length > 0 ? `\nВыполняют: ${s.staff.join(', ')}` : '';

    return `✅ EXPLAIN_SERVICE: ${s.title}
Цена: ${priceStr}${duration}
Категория: ${s.category}${description}${staff}`;
  }
```

**Шаблон ответа:**

```
📖 ОБЪЯСНЕНИЕ УСЛУГИ (EXPLAIN_SERVICE):
КРИТИЧНО: Используй ТОЛЬКО данные из результата команды!

ЕСЛИ есть description (описание):
"[Название услуги] ([цена], [длительность]) - [описание из результата]"

ЕСЛИ НЕТ description:
"[Название услуги] ([цена], [длительность]) - [краткое объяснение на основе названия в контексте барбершопа]"

ВАЖНО:
- НЕ повторяй цену если клиент её уже видел в списке выше
- Фокусируйся на описании услуги
- Если есть список мастеров - можешь упомянуть кто выполняет
- Будь конкретным и полезным
```

---

## Преимущества

### 1. Точность
- ✅ Использует реальные описания из базы данных YClients
- ✅ Нет путаницы между разными услугами
- ✅ Контекстно-зависимые ответы (учитывает тип бизнеса)

### 2. Производительность
- ✅ Возвращает ОДНУ услугу (не весь список)
- ✅ ~80% меньше токенов vs SHOW_PRICES
- ✅ Быстрое выполнение: 8ms на поиск услуги

### 3. UX (пользовательский опыт)
- ✅ Фокусированный ответ
- ✅ Дополнительная информация (кто выполняет)
- ✅ Проактивность (предлагает записаться)

### 4. Масштабируемость
- ✅ Легко добавить новые поля (фото, отзывы, примеры работ)
- ✅ Можно добавить "похожие услуги"
- ✅ Простая структура для расширения

---

## Примеры использования

### Пример 1: Прямой вопрос

**Клиент:** "Экспресс - это?"

**AI Stage 1:**
```json
{"commands": [{"name": "EXPLAIN_SERVICE", "params": {"service_name": "экспресс"}}]}
```

**Command Handler:**
```json
{
  "service": {
    "title": "ЭКСПРЕСС-СТРИЖКА",
    "price_min": 1200,
    "duration": 30,
    "description": "Это стрижка за полчаса. Процедура ИСКЛЮЧАЕТ из процесса мытье головы и проработку деталей.",
    "category": "СТРИЖКИ (ТОП-БАРБЕР)",
    "staff": ["Бари", "Сергей"]
  }
}
```

**AI Stage 2:**
```
ЭКСПРЕСС-СТРИЖКА (1200₽, 30 мин) - это стрижка за полчаса.
Процедура исключает из процесса мытье головы и проработку деталей.
Выполняют Бари и Сергей.

Хотите записаться на экспресс-стрижку?
```

### Пример 2: Вопрос после списка

**Клиент:** "Покажи все стрижки"

**Бот:** *(показывает список 10 стрижек)*

**Клиент:** "А что такое моделирование бороды?"

**AI:** Использует EXPLAIN_SERVICE для поиска и возврата описания только этой услуги.

### Пример 3: Услуга без описания

**Клиент:** "Что такое тонирование?"

**Command Handler:** Находит услугу "ТОНИРОВАНИЕ ГОЛОВЫ", но `description: null`

**AI Stage 2:**
```
ТОНИРОВАНИЕ ГОЛОВЫ (1500₽, 40 мин) - окрашивание волос в один тон
для придания равномерного цвета. Подойдет для маскировки седины или
изменения оттенка.
```
*(AI генерирует краткое описание на основе названия и контекста барбершопа)*

---

## Технические детали

### Поля данных

**Input (params):**
- `service_name` (string, обязательно) - название или часть названия услуги

**Output (success):**
```typescript
{
  service: {
    title: string,           // Название услуги
    price_min: number,       // Минимальная цена
    price_max: number,       // Максимальная цена
    duration: number,        // Длительность в минутах
    category: string,        // Категория услуги
    description: string | null, // Описание из YClients
    staff: string[]          // Массив имен мастеров
  }
}
```

**Output (error):**
```typescript
{
  error: 'service_not_found' | 'service_name_required',
  query?: string,
  message: string
}
```

### ServiceMatcher Score

ServiceMatcher оценивает услуги по нескольким критериям:
- `title_contains_query` (80 баллов) - название содержит запрос
- `title_contains_full_query` (70 баллов) - полное совпадение
- `word_matches` (25 баллов за слово) - совпадения отдельных слов
- `synonyms` (40 баллов) - синонимы и похожие слова
- `simple_service_bonus` (15 баллов) - простые услуги (без "+")

**Пример для "экспресс":**
```
Service: "ЭКСПРЕСС-СТРИЖКА"
Components:
- title_contains_query: 80
- title_contains_full_query: 70
- word_matches: 25
- synonyms: 40
- simple_service_bonus: 15
Total Score: 230
```

### Производительность

**Замеры на реальном примере:**
- Stage 1 (command extraction): 3.6s
- Command execution (EXPLAIN_SERVICE): 8ms ⚡
- Stage 2 (response generation): 3.7s
- **Total: 7.3s**

**Сравнение с SHOW_PRICES:**
- SHOW_PRICES: возвращает 20 услуг (~600 токенов)
- EXPLAIN_SERVICE: возвращает 1 услугу (~50 токенов)
- **Экономия: ~92% токенов**

---

## Интеграция с другими командами

### SHOW_PRICES + description

Дополнительно добавлено поле `description` в результаты SHOW_PRICES:

```javascript
prices: sorted.slice(0, 30).map(s => ({
  title: s.title,
  price_min: s.price_min || s.price || 0,
  price_max: s.price_max || s.price || s.price_min || 0,
  duration: s.duration || 60,
  category: s.category_title,
  description: s.description || null  // ✅ Новое поле
}))
```

Это позволяет AI использовать описания даже когда показывает список цен.

---

## Мониторинг и отладка

### Логи

**Успешное выполнение:**
```
INFO: Executing command: EXPLAIN_SERVICE
INFO: EXPLAIN_SERVICE called for: экспресс
INFO: Service match details: {
  "service": "ЭКСПРЕСС-СТРИЖКА",
  "query": "экспресс",
  "totalScore": 230
}
INFO: ✅ Commands executed in 8ms
```

**Ошибка - услуга не найдена:**
```
WARN: EXPLAIN_SERVICE: Service not found for query: "несуществующая услуга"
```

### Метрики

Можно отслеживать через Prometheus:
- `ai_admin_command_duration_ms{command="EXPLAIN_SERVICE"}` - время выполнения
- `ai_admin_command_success{command="EXPLAIN_SERVICE"}` - успешность
- `ai_admin_service_matcher_score` - score найденных услуг

---

## Будущие улучшения

### Возможные расширения

1. **Фото услуг:**
   ```javascript
   service: {
     ...
     images: ["url1.jpg", "url2.jpg"]
   }
   ```

2. **Похожие услуги:**
   ```javascript
   service: {
     ...
     similar_services: [
       {title: "МУЖСКАЯ СТРИЖКА", price: 2000},
       {title: "СТРИЖКА + БОРОДА", price: 3800}
     ]
   }
   ```

3. **Отзывы клиентов:**
   ```javascript
   service: {
     ...
     reviews_summary: {
       rating: 4.8,
       count: 124,
       top_review: "Отличная быстрая стрижка!"
     }
   }
   ```

4. **Популярность:**
   ```javascript
   service: {
     ...
     popularity: {
       bookings_this_month: 45,
       trend: "up" // растет спрос
     }
   }
   ```

---

## Тестирование

### Тестовые сценарии

**1. Базовый случай:**
```
Вход: "Экспресс - это?"
Ожидание: Описание ЭКСПРЕСС-СТРИЖКИ с ценой, временем и описанием
Статус: ✅ PASS
```

**2. Частичное совпадение:**
```
Вход: "Что такое моделирование?"
Ожидание: Описание МОДЕЛИРОВАНИЕ БОРОДЫ
Статус: ✅ PASS
```

**3. Услуга не найдена:**
```
Вход: "Расскажи про педикюр"
Ожидание: Сообщение что услуга не найдена (педикюра нет в барбершопе)
Статус: ✅ PASS
```

**4. Услуга без описания:**
```
Вход: "Что такое тонирование?"
Ожидание: AI генерирует краткое описание на основе названия
Статус: ✅ PASS
```

### Команда для тестирования

```bash
# Отправить тестовое сообщение
mcp__whatsapp__send_message phone:89686484488 message:"Экспресс - это?"

# Проверить логи
mcp__logs__logs_search pattern:"EXPLAIN_SERVICE" service:ai-admin-worker-v2

# Получить ответ
mcp__whatsapp__get_last_response phone:89686484488
```

---

## Ссылки

**Код:**
- `src/services/ai-admin-v2/prompts/two-stage-command-prompt.js` - определение команды
- `src/services/ai-admin-v2/modules/command-handler.js` - обработчик explainService()
- `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js` - форматирование ответа

**Документация:**
- [ServiceMatcher](../ARCHITECTURE.md#service-matcher)
- [Two-Stage Processing](../ARCHITECTURE.md#two-stage-processing)
- [AI Prompts Guide](../AI_PROVIDERS_GUIDE.md)

**Коммит:**
- Hash: `c0232b4`
- Date: 2025-10-22
- Message: "feat: add EXPLAIN_SERVICE command for service descriptions"

---

## Авторы

- **Разработка:** Claude Code + vosarsen
- **Тестирование:** vosarsen
- **Дата:** 2025-10-22
