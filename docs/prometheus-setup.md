# Настройка Prometheus метрик для AI Admin v2

## Обзор

AI Admin v2 теперь экспортирует метрики в формате Prometheus для мониторинга производительности, отслеживания ошибок и настройки алертов.

## Доступные метрики

### HTTP метрики
- `ai_admin_http_requests_total` - Общее количество HTTP запросов
- `ai_admin_http_request_duration_seconds` - Длительность HTTP запросов

### AI провайдер
- `ai_admin_ai_provider_duration_seconds` - Время ответа AI провайдера
- `ai_admin_ai_provider_errors_total` - Количество ошибок AI провайдера

### Команды
- `ai_admin_command_executions_total` - Количество выполненных команд
- `ai_admin_command_duration_seconds` - Длительность выполнения команд

### Бизнес-метрики
- `ai_admin_bookings_created_total` - Созданные записи
- `ai_admin_bookings_cancelled_total` - Отмененные записи
- `ai_admin_messages_processed_total` - Обработанные сообщения
- `ai_admin_message_processing_duration_seconds` - Время обработки сообщений
- `ai_admin_active_conversations` - Активные разговоры

### Кэш
- `ai_admin_cache_hits_total` - Попадания в кэш
- `ai_admin_cache_misses_total` - Промахи кэша
- `ai_admin_cache_hit_rate` - Процент попаданий в кэш

### Circuit Breaker
- `ai_admin_circuit_breaker_state` - Состояние (0=closed, 1=open, 0.5=half-open)
- `ai_admin_circuit_breaker_failures_total` - Количество ошибок

### Rate Limiter
- `ai_admin_rate_limiter_blocked_total` - Заблокированные запросы
- `ai_admin_rate_limiter_allowed_total` - Разрешенные запросы

### База данных
- `ai_admin_database_query_duration_seconds` - Время выполнения запросов
- `ai_admin_database_errors_total` - Ошибки БД

## Настройка

### 1. Добавление endpoint в Express приложение

```javascript
// В main файле API сервера
const metricsRouter = require('./src/api/routes/metrics');

// Добавить роут
app.use('/metrics', metricsRouter);
```

### 2. Настройка Prometheus

Добавьте в `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'ai_admin'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 15s
    metrics_path: '/metrics'
```

### 3. Настройка алертов

Скопируйте файл алертов:
```bash
cp src/services/ai-admin-v2/config/prometheus-alerts.yml /etc/prometheus/rules/
```

### 4. Настройка Grafana дашборда

Пример дашборда:

```json
{
  "dashboard": {
    "title": "AI Admin v2 Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "rate(ai_admin_messages_processed_total[5m])"
        }]
      },
      {
        "title": "AI Provider Latency (p95)",
        "targets": [{
          "expr": "histogram_quantile(0.95, rate(ai_admin_ai_provider_duration_seconds_bucket[5m]))"
        }]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [{
          "expr": "ai_admin_cache_hit_rate"
        }]
      },
      {
        "title": "Active Conversations",
        "targets": [{
          "expr": "ai_admin_active_conversations"
        }]
      }
    ]
  }
}
```

## Переменные окружения

Для защиты endpoint сброса метрик:
```bash
METRICS_API_KEY=your-secret-key
```

## Использование

### Получение метрик
```bash
curl http://localhost:3000/metrics
```

### Сброс метрик (требует API ключ)
```bash
curl -X POST http://localhost:3000/metrics/reset \
  -H "x-api-key: your-secret-key"
```

## Примеры запросов PromQL

### Процент ошибок за последние 5 минут
```promql
sum(rate(ai_admin_messages_processed_total{status="failure"}[5m])) /
sum(rate(ai_admin_messages_processed_total[5m]))
```

### Топ-5 самых медленных команд
```promql
topk(5, histogram_quantile(0.95, rate(ai_admin_command_duration_seconds_bucket[5m])) by (command))
```

### Процент заблокированных rate limiter
```promql
sum(rate(ai_admin_rate_limiter_blocked_total[5m])) /
(sum(rate(ai_admin_rate_limiter_blocked_total[5m])) + sum(rate(ai_admin_rate_limiter_allowed_total[5m])))
```

## Интеграция с существующим кодом

Метрики автоматически собираются в следующих модулях:
- `performance-metrics.js` - базовые метрики производительности
- `circuit-breaker.js` - состояние и ошибки circuit breaker
- `rate-limiter.js` - блокировки и разрешенные запросы
- `index.js` (AI Admin v2) - обработка сообщений и команд

## Алерты

Настроенные алерты включают:
- **HighErrorRate** - Высокий процент ошибок (>5%)
- **AIProviderDown** - AI провайдер недоступен (>50% ошибок)
- **CircuitBreakerOpen** - Circuit breaker открыт более 2 минут
- **HighAILatency** - Высокая латентность AI (p95 > 5s)
- **LowCacheHitRate** - Низкий hit rate кэша (<50%)
- **SlowMessageProcessing** - Медленная обработка сообщений (p95 > 10s)

## Troubleshooting

### Метрики не обновляются
1. Проверьте, что Prometheus может достучаться до endpoint
2. Проверьте логи на наличие ошибок в `prometheus-metrics.js`
3. Убедитесь, что все модули правильно импортируют `prometheus-metrics`

### Высокое потребление памяти
1. Проверьте количество уникальных label комбинаций
2. Рассмотрите уменьшение количества buckets для гистограмм
3. Используйте endpoint сброса метрик при необходимости

### Алерты не срабатывают
1. Проверьте, что правила загружены в Prometheus
2. Проверьте логи Prometheus на наличие ошибок парсинга правил
3. Убедитесь, что Alertmanager настроен и работает