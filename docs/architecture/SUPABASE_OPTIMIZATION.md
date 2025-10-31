# Оптимизация работы с Supabase для AI Admin v2

## 🚀 Что мы оптимизировали

### 1. **Connection Pooling**
- Создали пул из 5 Supabase клиентов
- Round-robin распределение запросов
- Избегаем лимитов на количество соединений

### 2. **Многоуровневое кэширование**
```
Запрос → Redis (1-5ms) → Supabase (50-200ms)
```

### 3. **Умное кэширование по типам данных**
- **Статичные данные** (services, staff): 30 минут
- **Динамические данные** (schedules, slots): 2-5 минут
- **Контекст диалога**: 5 минут

### 4. **Параллельная загрузка**
```javascript
// Было: последовательные запросы (500-1000ms)
const company = await getCompany();
const client = await getClient();
const services = await getServices();

// Стало: параллельные запросы (150-300ms)
const [company, client, services] = await Promise.all([...]);
```

### 5. **Оптимизация запросов**
- Выбираем только нужные поля
- Ограничиваем количество записей
- Используем индексы

## 📊 Результаты оптимизации

### До оптимизации:
- Загрузка контекста: 800-1500ms
- Холодный старт: 2-3 секунды
- Нагрузка на Supabase: высокая

### После оптимизации:
- Загрузка контекста: 50-300ms (кэш хит: 5-10ms)
- Холодный старт: 500-800ms
- Нагрузка на Supabase: снижена на 70-80%

## 🔧 Как использовать

### 1. Замените импорты:
```javascript
// Было
const { supabase } = require('./database/supabase');

// Стало
const { 
  loadFullContext, 
  getServices, 
  getStaff 
} = require('./database/optimized-supabase');
```

### 2. Используйте оптимизированные методы:
```javascript
// Загрузка полного контекста для AI
const context = await loadFullContext(phone, companyId);

// Получение услуг с кэшированием
const services = await getServices(companyId, { 
  limit: 20, 
  activeOnly: true 
});
```

### 3. Прогревайте кэш:
```javascript
// При старте приложения для активных компаний
await warmupCache(companyId);
```

### 4. Инвалидируйте кэш при изменениях:
```javascript
// После синхронизации с YClients
await invalidateCache('services', companyId);
await invalidateCache('staff', companyId);
```

## 📈 Мониторинг

### Запустите монитор производительности:
```bash
npm run monitor
# или
node scripts/monitor-performance.js
```

### Проверяйте статистику:
```javascript
const stats = await getStats();
console.log('Cache hit rate:', stats.redis.hitRate);
console.log('Avg context load time:', stats.avgContextLoadTime);
```

## ⚙️ Настройки

### Переменные окружения:
```env
# Redis для кэширования
REDIS_URL=redis://localhost:6379

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-service-key

# Оптимизация
CACHE_TTL_STATIC=1800  # 30 минут для статичных данных
CACHE_TTL_DYNAMIC=300  # 5 минут для динамичных данных
SUPABASE_POOL_SIZE=5   # Размер пула соединений
```

## 🎯 Best Practices

### 1. **Используйте select для выбора полей**
```javascript
// ❌ Плохо - загружаем все поля
.select('*')

// ✅ Хорошо - только нужные поля
.select('id, title, price_min, price_max, duration')
```

### 2. **Ограничивайте количество записей**
```javascript
// ❌ Плохо - загружаем все услуги
const services = await getServices(companyId);

// ✅ Хорошо - только топ-20
const services = await getServices(companyId, { limit: 20 });
```

### 3. **Фильтруйте на уровне БД**
```javascript
// ❌ Плохо - фильтрация в коде
const activeServices = services.filter(s => s.is_active);

// ✅ Хорошо - фильтрация в запросе
.eq('is_active', true)
```

### 4. **Используйте индексы**
Убедитесь, что созданы все необходимые индексы из `create-indexes-final.sql`

## 🚨 Troubleshooting

### Проблема: Высокая латентность
1. Проверьте cache hit rate
2. Увеличьте TTL для статичных данных
3. Проверьте индексы в БД

### Проблема: Устаревшие данные в кэше
1. Уменьшите TTL для динамичных данных
2. Используйте invalidateCache после обновлений
3. Настройте webhook для инвалидации

### Проблема: Лимиты Supabase
1. Увеличьте размер пула соединений
2. Оптимизируйте запросы (меньше данных)
3. Рассмотрите self-hosted PostgreSQL

## 🔮 Будущие улучшения

1. **Query batching** - объединение запросов
2. **Predictive caching** - предзагрузка вероятных запросов
3. **Edge caching** - кэширование на CDN
4. **GraphQL** - для более гибких запросов