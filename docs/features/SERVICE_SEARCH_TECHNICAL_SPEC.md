# Техническая спецификация улучшения поиска услуг

## 🏗️ Архитектура решения

### Компонентная диаграмма
```
┌─────────────────┐
│   User Message  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         SmartServiceMatcher              │
│  ┌────────────────────────────────────┐  │
│  │ 1. Query Preprocessor              │  │
│  │    - Нормализация                  │  │
│  │    - Извлечение интента            │  │
│  │    - Токенизация                   │  │
│  └────────────┬───────────────────────┘  │
│               ▼                           │
│  ┌────────────────────────────────────┐  │
│  │ 2. Query Expander                  │  │
│  │    - Синонимы                      │  │
│  │    - Морфология                    │  │
│  │    - Транслитерация               │  │
│  └────────────┬───────────────────────┘  │
│               ▼                           │
│  ┌────────────────────────────────────┐  │
│  │ 3. Multi-Strategy Searcher         │  │
│  │    - Pattern Matching              │  │
│  │    - Fuzzy Search                  │  │
│  │    - Semantic Search (future)      │  │
│  └────────────┬───────────────────────┘  │
│               ▼                           │
│  ┌────────────────────────────────────┐  │
│  │ 4. Scoring Engine                  │  │
│  │    - Base Score                    │  │
│  │    - Context Boost                 │  │
│  │    - History Boost                 │  │
│  │    - ML Predictions (future)       │  │
│  └────────────┬───────────────────────┘  │
│               ▼                           │
│  ┌────────────────────────────────────┐  │
│  │ 5. Result Processor                │  │
│  │    - Deduplication                 │  │
│  │    - Ranking                       │  │
│  │    - Grouping                      │  │
│  └────────────────────────────────────┘  │
└─────────────────┬───────────────────────┘
                  ▼
         ┌────────────────┐
         │ Ranked Services │
         └────────────────┘
```

## 📦 Модули и их ответственность

### 1. Query Preprocessor
```javascript
class QueryPreprocessor {
  /**
   * Нормализует и подготавливает запрос
   * @param {string} query - Исходный запрос пользователя
   * @returns {ProcessedQuery}
   */
  process(query) {
    return {
      original: query,
      normalized: this.normalize(query),      // Lowercase, trim, etc
      tokens: this.tokenize(query),           // ["детская", "стрижка"]
      intent: this.detectIntent(query),       // "price_check" | "book" | "info"
      entities: this.extractEntities(query),  // {service: "стрижка", age: "детская"}
      language: this.detectLanguage(query)    // "ru" | "en"
    };
  }
  
  normalize(query) {
    return query
      .toLowerCase()
      .replace(/[^\wа-яё\s]/gi, ' ')  // Убираем спецсимволы
      .replace(/\s+/g, ' ')            // Нормализуем пробелы
      .trim();
  }
  
  tokenize(query) {
    // Используем простой токенизатор или библиотеку natural
    return query.split(/\s+/).filter(t => t.length > 2);
  }
  
  detectIntent(query) {
    const intents = {
      price: ['сколько', 'цена', 'стоит', 'стоимость', 'прайс'],
      book: ['записать', 'запись', 'хочу', 'можно'],
      info: ['какие', 'есть', 'доступно', 'работает']
    };
    
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(k => query.includes(k))) {
        return intent;
      }
    }
    return 'unknown';
  }
}
```

### 2. Query Expander
```javascript
class QueryExpander {
  constructor() {
    this.synonyms = require('../config/synonyms.json');
    this.morphology = new MorphologyAnalyzer();
  }
  
  /**
   * Расширяет запрос синонимами и вариациями
   * @param {ProcessedQuery} processed
   * @returns {ExpandedQuery}
   */
  expand(processed) {
    const expanded = new Set(processed.tokens);
    
    // Добавляем синонимы
    for (const token of processed.tokens) {
      const syns = this.findSynonyms(token);
      syns.forEach(s => expanded.add(s));
      
      // Добавляем морфологические варианты
      const forms = this.morphology.getAllForms(token);
      forms.forEach(f => expanded.add(f));
    }
    
    // Обрабатываем составные термины
    const compounds = this.expandCompounds(processed.normalized);
    compounds.forEach(c => expanded.add(c));
    
    return {
      ...processed,
      expandedTokens: Array.from(expanded),
      searchQueries: this.generateSearchQueries(expanded)
    };
  }
  
  findSynonyms(word) {
    const synonyms = [];
    for (const [key, values] of Object.entries(this.synonyms)) {
      if (key === word || values.includes(word)) {
        synonyms.push(key, ...values);
      }
    }
    return synonyms;
  }
  
  expandCompounds(query) {
    const compounds = {
      'детская стрижка': ['детская', 'стрижка', 'ребенок', 'дети'],
      'мужская стрижка': ['мужская', 'стрижка', 'барбер'],
      'женская стрижка': ['женская', 'стрижка', 'дамская']
    };
    
    const result = [];
    for (const [compound, parts] of Object.entries(compounds)) {
      if (query.includes(compound)) {
        result.push(...parts);
      }
    }
    return result;
  }
}
```

### 3. Multi-Strategy Searcher
```javascript
class MultiStrategySearcher {
  constructor(services) {
    this.services = services;
    this.buildIndices();
  }
  
  buildIndices() {
    // Инвертированный индекс для быстрого поиска
    this.invertedIndex = new Map();
    
    for (const service of this.services) {
      const tokens = this.tokenize(service.title);
      for (const token of tokens) {
        if (!this.invertedIndex.has(token)) {
          this.invertedIndex.set(token, new Set());
        }
        this.invertedIndex.get(token).add(service.id);
      }
    }
    
    // Триграммный индекс для fuzzy search
    this.trigramIndex = this.buildTrigramIndex();
  }
  
  /**
   * Поиск с использованием нескольких стратегий
   * @param {ExpandedQuery} query
   * @returns {SearchResults}
   */
  search(query) {
    const results = new Map(); // serviceId -> score
    
    // Стратегия 1: Точное совпадение
    const exactMatches = this.exactMatch(query);
    exactMatches.forEach(id => results.set(id, 100));
    
    // Стратегия 2: Поиск по токенам
    const tokenMatches = this.tokenSearch(query);
    tokenMatches.forEach(({id, score}) => {
      const current = results.get(id) || 0;
      results.set(id, Math.max(current, score));
    });
    
    // Стратегия 3: Fuzzy matching
    const fuzzyMatches = this.fuzzySearch(query);
    fuzzyMatches.forEach(({id, score}) => {
      const current = results.get(id) || 0;
      results.set(id, current + score * 0.5); // Уменьшаем вес fuzzy
    });
    
    // Стратегия 4: Паттерны категорий
    const patternMatches = this.patternSearch(query);
    patternMatches.forEach(({id, score}) => {
      const current = results.get(id) || 0;
      results.set(id, current + score * 0.7);
    });
    
    return this.convertToServices(results);
  }
  
  tokenSearch(query) {
    const results = [];
    const queryTokens = new Set(query.expandedTokens);
    
    for (const service of this.services) {
      const serviceTokens = new Set(this.tokenize(service.title));
      const intersection = new Set([...queryTokens].filter(x => serviceTokens.has(x)));
      
      if (intersection.size > 0) {
        const score = (intersection.size / queryTokens.size) * 80;
        results.push({id: service.id, score});
      }
    }
    
    return results;
  }
}
```

### 4. Scoring Engine
```javascript
class ScoringEngine {
  constructor() {
    this.weights = {
      exact: 100,
      category: 80,
      synonym: 70,
      partial: 50,
      fuzzy: 40,
      history: 35,
      popular: 30,
      context: 25,
      recent: 20,
      priceRange: 15
    };
  }
  
  /**
   * Рассчитывает финальный скор для услуги
   * @param {Service} service
   * @param {ExpandedQuery} query
   * @param {Context} context
   * @returns {number} score
   */
  score(service, query, context) {
    let totalScore = 0;
    const factors = [];
    
    // Базовый скор от поиска
    if (service.searchScore) {
      totalScore += service.searchScore;
      factors.push({type: 'search', score: service.searchScore});
    }
    
    // Бонус за историю клиента
    if (context.client?.history) {
      const historyScore = this.scoreByHistory(service, context.client.history);
      totalScore += historyScore;
      if (historyScore > 0) {
        factors.push({type: 'history', score: historyScore});
      }
    }
    
    // Бонус за популярность
    const popularityScore = this.scoreByPopularity(service);
    if (popularityScore > 0) {
      totalScore += popularityScore;
      factors.push({type: 'popularity', score: popularityScore});
    }
    
    // Контекстные бонусы
    const contextScore = this.scoreByContext(service, context);
    if (contextScore > 0) {
      totalScore += contextScore;
      factors.push({type: 'context', score: contextScore});
    }
    
    // Штрафы
    const penalties = this.calculatePenalties(service, context);
    totalScore -= penalties;
    
    // Логируем для отладки
    if (process.env.DEBUG_SCORING) {
      console.log(`Service: ${service.title}`, {
        totalScore,
        factors,
        penalties
      });
    }
    
    return Math.max(0, totalScore);
  }
  
  scoreByHistory(service, history) {
    let score = 0;
    
    // Часто заказываемая услуга
    const bookingCount = history.filter(h => h.serviceId === service.id).length;
    if (bookingCount > 3) score += this.weights.history;
    if (bookingCount > 5) score += 10; // Дополнительный бонус
    
    // Недавно заказывал
    const lastBooking = history.find(h => h.serviceId === service.id);
    if (lastBooking) {
      const daysSince = (Date.now() - lastBooking.date) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) score += this.weights.recent;
    }
    
    return score;
  }
  
  scoreByContext(service, context) {
    let score = 0;
    
    // Время суток
    const hour = new Date().getHours();
    if (hour < 10 && service.duration <= 30) {
      score += 10; // Утром предпочитают быстрые услуги
    }
    
    // День недели
    const day = new Date().getDay();
    if ((day === 5 || day === 6) && service.category === 'complex') {
      score += 15; // В выходные готовы на длительные процедуры
    }
    
    // Пол клиента
    if (context.client?.gender === 'male' && service.title.includes('мужск')) {
      score += 20;
    }
    
    return score;
  }
  
  calculatePenalties(service, context) {
    let penalty = 0;
    
    // Несоответствие полу
    if (context.client?.gender === 'male' && service.title.includes('женск')) {
      penalty += 50;
    }
    
    // Слишком дорого для клиента
    if (context.client?.averageCheck && service.price > context.client.averageCheck * 2) {
      penalty += 20;
    }
    
    return penalty;
  }
}
```

### 5. Feedback Learner
```javascript
class FeedbackLearner {
  constructor(redis) {
    this.redis = redis;
    this.PATTERN_KEY = 'search:patterns';
    this.SUCCESS_KEY = 'search:success';
  }
  
  /**
   * Записывает выбор пользователя
   */
  async recordChoice(query, shownServices, selectedService, context) {
    const pattern = {
      query: query.normalized,
      tokens: query.tokens,
      selectedId: selectedService?.id,
      shownIds: shownServices.map(s => s.id),
      position: shownServices.findIndex(s => s.id === selectedService?.id),
      timestamp: Date.now(),
      context: {
        clientId: context.client?.id,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay()
      }
    };
    
    // Сохраняем паттерн
    await this.redis.zadd(
      this.PATTERN_KEY,
      Date.now(),
      JSON.stringify(pattern)
    );
    
    // Увеличиваем счетчик успешных выборов
    if (selectedService) {
      const key = `${this.SUCCESS_KEY}:${query.normalized}:${selectedService.id}`;
      await this.redis.incr(key);
    }
    
    // Обновляем модель каждые 100 паттернов
    const count = await this.redis.zcard(this.PATTERN_KEY);
    if (count % 100 === 0) {
      await this.updateModel();
    }
  }
  
  /**
   * Получает boost для услуги на основе истории
   */
  async getBoost(query, serviceId) {
    const key = `${this.SUCCESS_KEY}:${query}:${serviceId}`;
    const count = await this.redis.get(key) || 0;
    
    // Логарифмическая шкала, чтобы не перевешивать
    return Math.min(Math.log(count + 1) * 10, 50);
  }
  
  /**
   * Обновляет веса на основе накопленных паттернов
   */
  async updateModel() {
    // Получаем последние 1000 паттернов
    const patterns = await this.redis.zrevrange(
      this.PATTERN_KEY,
      0,
      999,
      'WITHSCORES'
    );
    
    // Анализируем успешность
    const stats = this.analyzePatterns(patterns);
    
    // Обновляем веса в конфигурации
    await this.updateWeights(stats);
    
    // Логируем изменения
    logger.info('Model updated', stats);
  }
}
```

## 🗄️ Структура данных

### Конфигурация синонимов
```json
{
  "synonyms": {
    "стрижка": ["подстричься", "постричься", "подстричь", "стричь"],
    "детская": ["ребенок", "дети", "детский", "малыш", "школьник"],
    "борода": ["бородка", "усы", "бакенбарды"],
    "быстро": ["срочно", "экспресс", "быстрая"],
    "недорого": ["дешево", "бюджетно", "эконом", "дешевле"]
  },
  
  "categories": {
    "children": {
      "patterns": ["детск", "ребен", "малыш", "школьн"],
      "boost": ["ДЕТСКАЯ СТРИЖКА", "ОТЕЦ + СЫН"],
      "reduce": ["МУЖСКАЯ СТРИЖКА", "СТРИЖКА МАШИНКОЙ"]
    }
  },
  
  "stopwords": ["у", "в", "на", "и", "или", "для", "с", "по"],
  
  "weights": {
    "exact": 100,
    "synonym": 80,
    "category": 70,
    "partial": 50,
    "history": 40,
    "popular": 30
  }
}
```

### Схема кэширования
```javascript
// Redis структура
{
  // Кэш результатов поиска
  "search:cache:{query_hash}": {
    "services": [...],
    "timestamp": 1234567890,
    "ttl": 3600
  },
  
  // Паттерны выбора
  "search:patterns": [
    {
      "query": "детская стрижка",
      "selected": 73,
      "position": 0,
      "timestamp": 1234567890
    }
  ],
  
  // Счетчики успешности
  "search:success:детская:73": 15,
  "search:success:стрижка:42": 120,
  
  // Персональные предпочтения
  "client:79001234567:preferences": {
    "favoriteServices": [42, 73],
    "averageCheck": 2500,
    "lastVisit": 1234567890
  }
}
```

## 🧪 Тестирование

### Unit тесты
```javascript
describe('SmartServiceMatcher', () => {
  describe('Query Preprocessing', () => {
    it('should normalize query correctly', () => {
      const query = "  ДЕТСКАЯ  стрижка??? ";
      const processed = preprocessor.process(query);
      expect(processed.normalized).toBe("детская стрижка");
      expect(processed.tokens).toEqual(["детская", "стрижка"]);
    });
    
    it('should detect intent', () => {
      expect(preprocessor.detectIntent("сколько стоит")).toBe("price");
      expect(preprocessor.detectIntent("хочу записаться")).toBe("book");
    });
  });
  
  describe('Synonym Expansion', () => {
    it('should expand with synonyms', () => {
      const expanded = expander.expand({tokens: ["подстричься"]});
      expect(expanded.expandedTokens).toContain("стрижка");
    });
  });
  
  describe('Scoring', () => {
    it('should boost favorite services', () => {
      const service = {id: 42, title: "Стрижка"};
      const context = {client: {favoriteServices: [42]}};
      const score = scorer.score(service, {}, context);
      expect(score).toBeGreaterThan(50);
    });
  });
});
```

### Integration тесты
```javascript
describe('End-to-end service search', () => {
  it('should find children haircut', async () => {
    const matcher = new SmartServiceMatcher(services);
    const results = await matcher.match("детская сколько стоит", context);
    
    expect(results[0].title).toBe("ДЕТСКАЯ СТРИЖКА");
    expect(results[0].price).toBe(1800);
  });
  
  it('should personalize for returning client', async () => {
    const context = {
      client: {
        history: [
          {serviceId: 73, date: Date.now() - 86400000}
        ]
      }
    };
    
    const results = await matcher.match("стрижка", context);
    expect(results[0].id).toBe(73); // Детская стрижка
  });
});
```

## 📊 Мониторинг и метрики

### Метрики для отслеживания
```javascript
class SearchMetrics {
  constructor(prometheus) {
    this.metrics = {
      searchLatency: new prometheus.Histogram({
        name: 'service_search_duration_seconds',
        help: 'Service search duration in seconds',
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
      }),
      
      searchAccuracy: new prometheus.Gauge({
        name: 'service_search_accuracy',
        help: 'Percentage of searches with correct first result'
      }),
      
      cacheHitRate: new prometheus.Gauge({
        name: 'service_search_cache_hit_rate',
        help: 'Cache hit rate for service searches'
      }),
      
      userSatisfaction: new prometheus.Gauge({
        name: 'service_search_satisfaction',
        help: 'User satisfaction score (position of selected item)'
      })
    };
  }
  
  recordSearch(query, results, selected, duration) {
    this.metrics.searchLatency.observe(duration);
    
    const position = results.findIndex(r => r.id === selected?.id);
    if (position === 0) {
      this.metrics.searchAccuracy.inc();
    }
    
    if (position >= 0) {
      this.metrics.userSatisfaction.set(1 / (position + 1));
    }
  }
}
```

## 🚀 План развертывания

### Этап 1: Canary deployment (1 день)
1. Развернуть на 5% трафика
2. Мониторить метрики 24 часа
3. Сравнить с baseline

### Этап 2: A/B тестирование (1 неделя)
1. 50/50 split между старой и новой системой
2. Собрать статистически значимые данные
3. Принять решение о полном развертывании

### Этап 3: Full rollout (1 день)
1. Переключить 100% трафика
2. Мониторить первые 48 часов
3. Подготовить rollback план

## 🔧 Конфигурация окружения

### Переменные окружения
```bash
# Включение новой системы поиска
SMART_SEARCH_ENABLED=true

# Уровень логирования
SEARCH_LOG_LEVEL=info

# Redis для кэширования
SEARCH_REDIS_URL=redis://localhost:6379/2

# Веса для скоринга (можно переопределить)
SEARCH_WEIGHT_EXACT=100
SEARCH_WEIGHT_SYNONYM=80
SEARCH_WEIGHT_HISTORY=40

# ML features (future)
SEARCH_ML_ENABLED=false
SEARCH_ML_MODEL_PATH=/models/search_v1.pkl
```

---

**Версия спецификации**: 1.0
**Дата создания**: 16.08.2025
**Статус**: Draft