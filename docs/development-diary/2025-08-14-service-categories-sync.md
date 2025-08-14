# Синхронизация категорий услуг из YClients API

**Дата**: 14 августа 2025
**Автор**: AI Admin v2 Team

## Контекст и проблема

При работе с фильтрацией услуг обнаружилось, что в базе данных поле `category_title` у всех услуг было `null`, хотя в YClients у компаний есть категории услуг. Это делало невозможной правильную фильтрацию и группировку услуг по категориям.

### Проблемы:
1. YClients API endpoint `/company/{id}/services` не возвращает категории в ответе
2. Поле `category_title` всегда было пустым
3. Фильтрация услуг работала только по названию услуги

## Решение

### 1. Поиск правильного API endpoint

После анализа документации YClients API был найден правильный endpoint для получения категорий:
```
GET /api/v1/company/{company_id}/service_categories
```

Этот endpoint возвращает массив категорий с полями:
- `id` - идентификатор категории
- `title` - название категории
- `salon_service_id` - внутренний ID
- `weight` - порядок сортировки
- `staff` - массив ID сотрудников

### 2. Реализация двухэтапной синхронизации

Обновлен файл `src/sync/services-sync.js`:

```javascript
async sync() {
  // Шаг 1: Загружаем категории
  const categories = await this.fetchServiceCategories();
  
  // Шаг 2: Создаем маппинг category_id -> title
  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat.id] = cat.title;
  });
  
  // Шаг 3: Загружаем услуги
  const services = await this.fetchServices();
  
  // Шаг 4: Добавляем category_title к каждой услуге
  services.forEach(service => {
    if (service.category_id && categoryMap[service.category_id]) {
      service.category_title_from_api = categoryMap[service.category_id];
    }
  });
  
  // Шаг 5: Сохраняем в БД
  await this.saveServices(services);
}
```

### 3. Обработка ошибок

Если загрузка категорий не удается (например, нет прав доступа), метод `fetchServiceCategories()` возвращает пустой массив, и синхронизация продолжается без категорий.

## Реализация интеллектуальной фильтрации услуг

### FuzzyMatcher

Создан новый модуль `src/utils/fuzzy-matcher.js` для интеллектуального поиска услуг:

```javascript
class FuzzyMatcher {
  // Алгоритм Левенштейна для сравнения строк
  static levenshteinDistance(str1, str2) { ... }
  
  // Вычисление схожести (0-1)
  static similarity(str1, str2) { ... }
  
  // Fuzzy поиск с учетом частичных совпадений
  static fuzzyContains(text, pattern) { ... }
  
  // Поиск лучших совпадений
  static findBestMatches(query, items, options) { ... }
  
  // Извлечение ключевых слов с фильтрацией стоп-слов
  static extractKeywords(query) { ... }
}
```

#### Особенности:
- Не требует внешних библиотек
- Поддерживает различные стратегии поиска (точное, частичное, по словам)
- Учитывает опечатки и неточности
- Фильтрует стоп-слова на русском языке

### Обновление command-handler

В `src/services/ai-admin-v2/modules/command-handler.js` метод `getPrices()` теперь:

1. **Использует реальные категории из БД** (когда они доступны)
2. **Применяет fuzzy matching** для поиска услуг
3. **Динамически определяет категорию** по найденным услугам
4. **Не зависит от хардкода** - адаптируется к любому салону

```javascript
async getPrices(params, context) {
  const { services, message } = context;
  
  // Извлекаем ключевые слова из запроса
  const keywords = FuzzyMatcher.extractKeywords(message);
  const searchQuery = keywords.join(' ') || message;
  
  // Используем fuzzy matching для поиска
  filteredServices = FuzzyMatcher.findBestMatches(searchQuery, services, {
    keys: ['title', 'category_title'],
    threshold: 0.15,
    limit: 30
  });
  
  // Возвращаем структурированные данные
  return {
    category: detectedCategory,
    count: sorted.length,
    prices: sorted.map(s => ({
      title: s.title,
      price_min: s.price_min || 0,
      price_max: s.price_max || 0,
      duration: s.duration || 60,
      category: s.category_title
    }))
  };
}
```

## Результаты

### До:
- 0/45 услуг имели категории
- Фильтрация работала только по хардкоду
- Невозможно было группировать услуги

### После:
- **45/45 услуг имеют категории**
- Категории автоматически обновляются при каждой синхронизации
- Фильтрация адаптируется к любому салону
- Поддержка fuzzy поиска с опечатками

### Примеры категорий:
- "СТРИЖКИ (ТОП-БАРБЕР)"
- "БРИТЬЁ (ТОП-БАРБЕР)"
- "УХОД ЗА ЛИЦОМ"
- "ДОП. УСЛУГИ"
- "Акции (ТОП-БАРБЕР)"

## Тестирование

### Тестовые скрипты:
- `test-sync-categories.js` - проверка загрузки категорий
- `test-sync-with-categories.js` - полная синхронизация с категориями
- `test-greeting-and-prices.js` - тест фильтрации услуг

### Команды для проверки:
```bash
# Запустить синхронизацию
node scripts/manual-sync.js services

# Проверить категории в БД
node test-categories.js

# Протестировать фильтрацию
node test-greeting-and-prices.js
```

## Производительность

- Загрузка категорий: ~500ms
- Синхронизация 45 услуг: ~13 секунд
- Fuzzy matching для поиска: <10ms
- Дополнительная нагрузка минимальна

## Планы на будущее

1. **Кэширование категорий** - можно кэшировать на 24 часа
2. **Синонимы категорий** - маппинг "стрижка" → "СТРИЖКИ (ТОП-БАРБЕР)"
3. **ML-based matching** - использование embeddings для семантического поиска
4. **Автоматическая группировка** - создание виртуальных категорий для салонов без них

## Выводы

Реализация синхронизации категорий и интеллектуальной фильтрации значительно улучшила качество работы бота. Теперь система:
- Автоматически адаптируется к структуре услуг любого салона
- Правильно группирует и фильтрует услуги
- Понимает запросы с опечатками и неточностями
- Не требует ручной настройки или хардкода