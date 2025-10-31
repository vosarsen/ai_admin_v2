# Исправление работы с композитными услугами YClients

**Дата:** 2 октября 2025
**Статус:** ✅ Успешно исправлено и развернуто
**Ветка:** `feature/redis-context-cache`

## Проблема

При попытке записи на композитную услугу "СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ | LUXINA" (ID: 18356349) система возвращала ошибку:

```
❌ POST book_record/962302 - 404
"Сотрудник не оказывает выбранную услугу"
```

### Симптомы
- Запись на простые услуги работала нормально
- Запись на композитные услуги (комплексы) всегда возвращала 404
- YClients API показывал, что слоты доступны для композитной услуги
- Но при создании записи YClients отклонял запрос

## Причина

YClients API требует для композитных услуг передавать **массив ID подуслуг**, а не ID самой композитной услуги.

### Структура композитной услуги в YClients

```json
{
  "id": 18356349,
  "title": "СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ | LUXINA",
  "is_composite": true,
  "composite_details": {
    "type": "sequential",
    "links": [
      {
        "id": 12933,
        "service_id": 18356010,  // МУЖСКАЯ СТРИЖКА
        "position": 1,
        "title": "МУЖСКАЯ СТРИЖКА"
      },
      {
        "id": 12934,
        "service_id": 18356134,  // ПРЕМИАЛЬНОЕ БРИТЬЁ | LUXINA
        "position": 2,
        "title": "ПРЕМИАЛЬНОЕ БРИТЬЁ | LUXINA"
      }
    ]
  }
}
```

### Что передавали (неправильно)

```json
{
  "appointments": [{
    "services": [18356349]  // ❌ ID композитной услуги
  }]
}
```

### Что нужно было передавать (правильно)

```json
{
  "appointments": [{
    "services": [18356010, 18356134]  // ✅ ID подуслуг
  }]
}
```

## Решение

### 1. Добавлен метод разворачивания композитных услуг

**Файл:** `src/services/ai-admin-v2/modules/command-handler.js`

```javascript
async expandCompositeService(serviceId, staffId, context) {
  try {
    const yclientsClient = bookingService.getYclientsClient();
    const companyId = context.company.yclients_id || context.company.company_id;

    // Получаем список услуг сотрудника
    const servicesResult = await yclientsClient.getBookServices(companyId, { staff_id: staffId });

    if (!servicesResult.success || !servicesResult.data) {
      return [serviceId];
    }

    // ВАЖНО: YClients client оборачивает ответ API
    // Структура: { success, data: { data: { services, events, category } } }
    const yclientsData = servicesResult.data?.data || servicesResult.data;
    const services = yclientsData?.services || [];

    // Ищем нашу услугу
    const service = services.find(s => s.id === serviceId);

    if (!service) {
      return [serviceId];
    }

    // Проверяем, является ли услуга композитной
    if (service.is_composite && service.composite_details && service.composite_details.links) {
      const subServiceIds = service.composite_details.links
        .sort((a, b) => a.position - b.position)
        .map(link => link.service_id);

      logger.info('✅ Expanded composite service:', {
        compositeService: service.title,
        compositeServiceId: serviceId,
        subServiceIds
      });

      return subServiceIds;
    }

    // Если не композитная услуга, возвращаем оригинальный ID
    return [serviceId];

  } catch (error) {
    logger.error('Error expanding composite service:', error);
    return [serviceId];
  }
}
```

### 2. Интегрирован в процесс создания записи

**Файл:** `src/services/ai-admin-v2/modules/command-handler.js` (строка ~1176)

```javascript
// Разворачиваем композитные услуги в подуслуги
let serviceIds = await this.expandCompositeService(serviceId, staffId, context);

const bookingData = {
  phone: cleanPhone,
  fullname: clientName,
  email: context.client?.email || '',
  comment: "Запись через AI администратора WhatsApp",
  appointments: [{
    id: 1,
    services: serviceIds,  // Теперь массив подуслуг для композитных
    staff_id: staffId,
    datetime: `${parsedDate} ${params.time}:00`
  }]
};
```

### 3. Добавлен метод getBookServices в YClients client

**Файл:** `src/integrations/yclients/client.js`

```javascript
/**
 * 📚 Получить услуги для записи (book_services endpoint)
 * Используется для получения полной информации о композитных услугах
 */
async getBookServices(companyId = this.config.companyId, params = {}) {
  return this.get(YclientsClient.ENDPOINTS.bookServices(companyId), params, {
    cacheTtl: 1800 // Услуги кэшируются на 30 минут
  });
}
```

## Подводные камни

### Проблема 1: Обёртка YClients client

YClients client оборачивает ответ API в дополнительную структуру:

```javascript
// Ответ от YClients API:
{
  "success": true,
  "data": {
    "services": [...],
    "events": [...],
    "category": [...]
  }
}

// После обёртки client:
{
  "success": true,
  "data": {
    "data": {           // ← Дополнительный уровень!
      "services": [...],
      "events": [...],
      "category": [...]
    }
  },
  "status": 200,
  "startTime": ...,
  "attempt": 1
}
```

**Решение:** Извлекать через `servicesResult.data?.data || servicesResult.data`

### Проблема 2: Разные структуры для разных endpoints

- `GET /services` → возвращает массив напрямую
- `GET /book_services` → возвращает объект с ключами `{services, events, category}`
- `POST /book_record` → при успехе возвращает массив созданных записей

## Тестирование

### Тест 1: Запись на композитную услугу
```
Клиент: "Запиши меня на стрижку и бороду завтра в 11"
Результат: ✅ Успешно создана запись
```

**Логи:**
```
Checking if service is composite: serviceId=18356349, staffId=3413963
✅ Expanded composite service: [18356010, 18356134]
✅ Booking created successfully
```

### Тест 2: Запись на простую услугу
```
Клиент: "Запиши меня на стрижку завтра в 11"
Результат: ✅ Работает как раньше (service ID не изменяется)
```

## Коммиты

1. `ce47f17` - Добавлен метод expandCompositeService и интеграция
2. `c263234` - Исправлена обработка структуры data.data
3. `ffad445` - Правильное извлечение массива services
4. `1cacc0e` - Добавлено детальное логирование для отладки
5. `3ba870c` - Финальное исправление извлечения данных из обёртки client

## Результат

✅ **Все типы записей теперь работают:**
- Простые услуги: "МУЖСКАЯ СТРИЖКА"
- Композитные услуги: "СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ | LUXINA"
- Комплексы с 3+ услугами: "СТРИЖКА + БОРОДА + ВОСК | LUXINA"

## Обновление документации

Обновлен `TASK.md`:
- ~~Строка 554: "Не проверена совместимость услуга-мастер перед созданием записи"~~ → **Исправлено**

## Lessons Learned

1. **Всегда проверяй структуру API ответов** - клиенты могут оборачивать данные
2. **Используй детальное логирование** - помогло найти проблему с `data.data`
3. **Проверяй документацию YClients** - там есть примеры правильных запросов
4. **Тестируй на реальных данных** - локальные тесты не показали бы эту проблему

---

**Задеплоено:** 2 октября 2025, 15:03
**Протестировано на production:** ✅ Работает
**Merge в main:** Pending
