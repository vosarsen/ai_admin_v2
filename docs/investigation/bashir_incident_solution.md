# 🔍 Анализ проблемы: "Нет свободных мест" при наличии слотов

**Дата:** 28 октября 2025
**Клиент:** Башир (+7 915 111-05-53)
**Проблема:** Система ответила "все время занято", хотя были свободные слоты

---

## 🔎 СИМПТОМЫ

### Что произошло:

1. **Нет логов вызова YClients API:**
   - Отсутствуют логи `findSuitableSlot`, `getAvailableSlots`, `book_times`
   - Это означает что цикл `for (const staff of staffToCheck)` не выполнился

2. **Мгновенный переход к fallback:**
   ```
   11:59:20: SEARCH_SLOTS date parsing
   11:59:20: No fully available slots found, checking for partial windows...
   ```
   Между этими строками **0 миллисекунд** - цикл не выполнился!

3. **Мастера есть в базе:**
   - Сергей (yclients_id: 2895125) - оказывает услугу ✅
   - Бари (yclients_id: 3413963) - оказывает услугу ✅
   - Оба активны (`is_active = true`)

4. **Контекст загружался из БД:**
   ```
   11:59:16: Enriching context with database data...
   11:59:17: ✅ Context loaded in 479ms
   ```
   Значит данные ДОЛЖНЫ были загрузиться

---

## ❓ ПРОБЛЕМА: НЕДОСТАТОЧНО ДАННЫХ

### Что мы НЕ знаем:

1. ❌ Сколько мастеров в `context.staff`?
2. ❌ Загрузились ли мастера через `loadStaff()`?
3. ❌ Сколько мастеров в `staffToCheck`?
4. ❌ Почему цикл не выполнился?

### Почему не знаем:

**ОТСУТСТВУЕТ КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ:**

1. `dataLoader.loadStaff()` (строка 253) - **НЕ логирует** результат загрузки
2. `command-handler.js` перед циклом (строка 576) - **НЕ логирует** `staffToCheck`
3. Внутри цикла (строка 594) - **НЕ логирует** попытки вызова API

---

## 🎯 РЕШЕНИЕ: ДОБАВИТЬ ЛОГИРОВАНИЕ

### ⚠️ ВАЖНО:
**Сначала добавляем логирование, чтобы понять проблему. Только потом исправляем.**

Применять "исправления" без понимания причины - **опасно и неэффективно**.

---

## 🛠️ ШАГ 1: ДОБАВИТЬ ЛОГИРОВАНИЕ

### Изменение 1: Логирование загрузки мастеров

**Файл:** `src/services/ai-admin-v2/modules/data-loader.js`
**Строка:** 253

```javascript
async loadStaff(companyId) {
  logger.info('📥 Loading staff from database', { companyId });

  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('rating', { ascending: false });

  if (error) {
    logger.error('❌ Error loading staff:', {
      companyId,
      error: error.message,
      code: error.code
    });
    return [];
  }

  logger.info('✅ Staff loaded successfully', {
    companyId,
    count: data?.length || 0,
    staff: data?.map(s => ({
      id: s.yclients_id,
      name: s.name,
      is_active: s.is_active
    })) || []
  });

  return data || [];
}
```

### Изменение 2: Логирование выбора мастеров для поиска

**Файл:** `src/services/ai-admin-v2/modules/command-handler.js`
**Строка:** 576 (после формирования staffToCheck, перед циклом)

```javascript
// Если мастер не указан, используем любимых мастеров клиента
const staffToCheck = targetStaff ? [targetStaff] :
  (context.client?.favorite_staff_ids?.length ?
    context.staff.filter(s => context.client.favorite_staff_ids.includes(s.yclients_id)) :
    context.staff.slice(0, 3));

// ✅ КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ:
logger.info('🔍 Staff selection for slot search:', {
  service: service?.title,
  serviceId: service?.yclients_id,
  date: dateToSearch,
  totalStaffInContext: context.staff?.length || 0,
  staffToCheckCount: staffToCheck?.length || 0,
  targetStaff: targetStaff?.name,
  favoriteStaffIds: context.client?.favorite_staff_ids,
  selectedStaff: staffToCheck?.map(s => ({
    id: s.yclients_id,
    name: s.name
  })) || []
});

// Проверка на пустой массив
if (!staffToCheck || staffToCheck.length === 0) {
  logger.error('❌ CRITICAL: No staff available for slot search!', {
    contextStaffLength: context.staff?.length || 0,
    contextStaffSample: context.staff?.slice(0, 3).map(s => ({ id: s.yclients_id, name: s.name })),
    targetStaff: targetStaff?.name,
    favoriteStaffIds: context.client?.favorite_staff_ids
  });

  return {
    service,
    staff: null,
    slots: [],
    partialWindows: [],
    error: 'No staff available for this service'
  };
}

// Проверяем слоты для нескольких мастеров
const allSlots = [];
```

### Изменение 3: Логирование внутри цикла поиска

**Файл:** `src/services/ai-admin-v2/modules/command-handler.js`
**Строка:** 593 (начало цикла)

```javascript
for (const staff of staffToCheck) {
  try {
    logger.info('🔎 Checking slots for staff:', {
      staffId: staff.yclients_id,
      staffName: staff.name,
      serviceId: service?.yclients_id,
      serviceName: service?.title,
      date: parsedDate
    });

    // ВАЖНО: Проверяем слоты передавая и serviceId и staffId
    const result = await bookingService.findSuitableSlot({
      companyId: context.company.yclients_id || context.company.company_id,
      serviceId: service?.yclients_id,
      staffId: staff?.yclients_id,
      preferredDate: parsedDate,
      timePreference: params.time_preference
    });

    logger.info('📊 Slot search result for staff:', {
      staffName: staff.name,
      slotsFound: result.data?.data?.length || result.data?.length || 0,
      hasData: !!result.data
    });

    // Проверяем структуру результата
    const slots = result.data?.data || result.data || [];

    // ... остальной код
```

---

## 🧪 ШАГ 2: ДЕПЛОЙ И НАБЛЮДЕНИЕ

### Применить изменения:

```bash
cd /Users/vosarsen/Documents/GitHub/ai_admin_v2
git add -A
git commit -m "debug: добавлено критическое логирование для поиска слотов

- Логирование загрузки мастеров в loadStaff()
- Логирование формирования staffToCheck
- Логирование попыток поиска слотов для каждого мастера
- Проверка на пустой staffToCheck с детальным выводом

Relates-to: bashir_no_slots_incident_2025-10-28"
```

### Деплой:

```bash
git push origin feature/redis-context-cache
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart all"
```

### Тест:

```bash
# Отправить тестовое сообщение (через WhatsApp)
# "Здравствуйте, есть свободные окошки?"

# Сразу смотрим логи
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 200 | grep -E 'Loading staff|Staff selection|Checking slots'"
```

---

## 🔍 ШАГ 3: АНАЛИЗ НОВЫХ ДАННЫХ

### После получения логов ответим на вопросы:

1. **Загрузились ли мастера?**
   - Смотрим: `✅ Staff loaded successfully { count: X }`
   - Если `count: 0` - проблема в БД или запросе
   - Если `count: 2` - мастера есть, идем дальше

2. **Попали ли мастера в staffToCheck?**
   - Смотрим: `🔍 Staff selection { staffToCheckCount: X }`
   - Если `staffToCheckCount: 0` - проблема в логике выбора
   - Если `staffToCheckCount: 2` - идем дальше

3. **Вызывался ли findSuitableSlot?**
   - Смотрим: `🔎 Checking slots for staff`
   - Если нет логов - цикл не выполнился (но почему?)
   - Если есть - проблема в самом `findSuitableSlot`

4. **Что вернул findSuitableSlot?**
   - Смотрим: `📊 Slot search result { slotsFound: X }`
   - Если `slotsFound: 0` - проблема в YClients API или данных
   - Если `slotsFound: 7` - значит слоты были, но потерялись дальше

---

## 🎯 ШАГ 4: ЦЕЛЕВОЕ ИСПРАВЛЕНИЕ

**ТОЛЬКО ПОСЛЕ** получения данных из логов делаем исправление:

### Сценарий A: `context.staff` пустой
→ Исправляем кэширование или условие загрузки

### Сценарий B: `staffToCheck` пустой при непустом `context.staff`
→ Исправляем логику фильтрации (favorite_staff_ids)

### Сценарий C: Цикл выполняется, но findSuitableSlot не находит слоты
→ Проблема в YClients API или валидации слотов

### Сценарий D: Слоты находятся, но теряются
→ Проблема в последующей обработке (фильтрация, группировка)

---

## ⚠️ ПОЧЕМУ НЕ ПРИМЕНЯЕМ "ИСПРАВЛЕНИЯ" СЕЙЧАС

### Предложенные ранее изменения были **недоказанными**:

1. **Валидация массивов (Исправление #1):**
   - Хорошая практика, НО не устранит причину
   - Применять после понимания проблемы

2. **Инвалидация кэша (Исправление #3):**
   - Может скрыть реальную проблему
   - Нет доказательств что проблема в кэше

### Правильный подход в разработке:

```
❌ НЕПРАВИЛЬНО:
Проблема → Догадка → Исправление → Надежда

✅ ПРАВИЛЬНО:
Проблема → Логирование → Данные → Понимание → Целевое исправление → Проверка
```

---

## 📊 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После применения логирования мы получим **точные данные**:

```json
{
  "11:59:16": "📥 Loading staff { count: 2, staff: [...] }",
  "11:59:20": "🔍 Staff selection { totalStaff: 2, staffToCheck: 2 }",
  "11:59:20": "🔎 Checking slots for Сергей { serviceId: 18356010 }",
  "11:59:20": "📊 Result for Сергей { slotsFound: 0 }",
  "11:59:20": "🔎 Checking slots for Бари { serviceId: 18356010 }",
  "11:59:20": "📊 Result for Бари { slotsFound: 0 }"
}
```

Или:

```json
{
  "11:59:16": "📥 Loading staff { count: 0, staff: [] }",
  "11:59:20": "❌ CRITICAL: No staff available { contextStaffLength: 0 }"
}
```

Тогда мы **ТОЧНО** будем знать где проблема!

---

## 🎓 ВЫВОД

### Что мы узнали:

1. ✅ Цикл поиска слотов не выполнился
2. ✅ Мастера есть в БД
3. ❌ НЕ знаем был ли `context.staff` пустым
4. ❌ НЕ знаем был ли `staffToCheck` пустым

### Что делаем:

1. ✅ **Добавляем логирование** (3 изменения выше)
2. ✅ **Деплоим и ждем данных**
3. ✅ **Анализируем логи**
4. ✅ **Применяем целевое исправление**

### Чего НЕ делаем:

1. ❌ Не применяем недоказанные исправления
2. ❌ Не строим догадки без данных
3. ❌ Не надеемся что "авось пройдет"

---

**Статус:** 🔬 Требуется дополнительное логирование для выявления причины
**Следующий шаг:** Применить изменения и собрать данные
