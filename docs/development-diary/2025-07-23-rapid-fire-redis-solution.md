# Решение проблемы Rapid-Fire Protection через Redis батчинг

**Дата**: 23 июля 2025
**Автор**: AI Admin Team
**Статус**: Планирование

## Контекст и проблема

### Что произошло
При тестировании Phase 3 (Edge Cases и надежность) обнаружили критическую проблему с rapid-fire protection:

1. **Тест**: Отправка сообщения по частям (8 сообщений: "Привет," "запишите" "меня на" "стрижку" "к Бари" "на завтра" "в 8" "вечера")
2. **Ожидание**: Сообщения должны объединиться в одно: "Привет, запишите меня на стрижку к Бари на завтра в 8 вечера"
3. **Реальность**: Каждое сообщение обрабатывается отдельно через 5 секунд, бот не понимает контекст

### Почему текущее решение не работает

#### Первая попытка исправления (неудачная)
1. Создали новый webhook `/webhook/whatsapp/ai-admin` с rapid-fire protection
2. Перенесли rapid-fire из worker'а в webhook
3. **Проблема**: В webhook мы все равно вызываем rapid-fire для каждого сообщения отдельно:
```javascript
for (const message of messages) {
  // Каждое сообщение обрабатывается отдельно!
  rapidFireProtection.processMessage(msgFrom, msgText, async (combinedMessage) => {
    // Создается отдельная job
  });
}
```

#### Корневая проблема архитектуры
- Rapid-fire protection работает правильно, но используется неправильно
- Он должен быть единой точкой входа для накопления сообщений
- Текущая архитектура не позволяет накапливать сообщения между HTTP запросами

## Анализ решений

### Рассмотренные варианты

1. **Глобальный буфер сообщений** (6/10)
   - ❌ Теряется при рестарте
   - ❌ Не масштабируется

2. **Изменить rapid-fire API** (7/10)
   - ❌ Много рефакторинга
   - ❌ Риск сломать существующий код

3. **Умная очередь с группировкой** (8/10)
   - ✅ Работает с текущей архитектурой
   - ❌ Сложная реализация

4. **Webhook с состоянием** (5/10)
   - ✅ Быстрая реализация
   - ❌ "Грязное" решение
   - ❌ Не production-ready

5. **Redis-based батчинг** (9/10) ← **ВЫБРАНО**
   - ✅ Production-ready
   - ✅ Переживает рестарты
   - ✅ Масштабируется
   - ✅ Атомарные операции

## Детальный план решения: Redis-based батчинг

### Архитектура

```
WhatsApp → Webhook → Redis List → Batch Processor → Message Queue → Worker
                         ↓
                   [msg1, msg2, msg3]
                         ↓
                   TTL: 5-10 сек
```

### Компоненты

#### 1. Webhook (простой)
```javascript
// Просто добавляет сообщения в Redis
async function handleWebhook(req, res) {
  const { from, message } = req.body;
  const key = `rapid-fire:${from}`;
  
  await redis.rpush(key, message);
  await redis.expire(key, 10); // TTL 10 секунд
  
  res.json({ success: true });
}
```

#### 2. Redis Batch Service
```javascript
class RedisBatchService {
  // Проверяет и обрабатывает батчи
  async processPendingBatches() {
    const keys = await redis.keys('rapid-fire:*');
    
    for (const key of keys) {
      const messages = await redis.lrange(key, 0, -1);
      if (messages.length > 0) {
        // Проверяем, прошло ли 5 секунд с последнего сообщения
        const idleTime = await this.getIdleTime(key);
        
        if (idleTime >= 5000 || messages.length >= 10) {
          // Обрабатываем батч
          const combined = messages.join(' ');
          await messageQueue.addMessage(companyId, {
            from: phone,
            message: combined,
            metadata: { isRapidFireBatch: true }
          });
          
          await redis.del(key);
        }
      }
    }
  }
}
```

#### 3. Batch Processor (отдельный процесс)
```javascript
// Запускается каждую секунду
setInterval(async () => {
  await batchService.processPendingBatches();
}, 1000);
```

### Преимущества выбранного решения

1. **Надежность**: Сообщения не теряются при рестарте
2. **Масштабируемость**: Можно запустить несколько API серверов
3. **Гибкость**: Легко настроить таймауты и лимиты
4. **Простота**: Webhook остается простым
5. **Производительность**: Redis очень быстрый

### План реализации

1. **Создать RedisBatchService** (`src/services/redis-batch-service.js`)
   - Методы для добавления сообщений
   - Логика проверки таймаутов
   - Обработка батчей

2. **Создать Batch Processor** (`src/workers/batch-processor.js`)
   - Отдельный процесс/worker
   - Проверяет Redis каждую секунду
   - Создает jobs в очереди

3. **Упростить webhook**
   - Убрать сложную логику
   - Только добавление в Redis

4. **Обновить PM2 конфигурацию**
   - Добавить batch-processor в ecosystem.config.js

5. **Тестирование**
   - Unit тесты для batch service
   - Integration тесты для полного флоу
   - Нагрузочное тестирование

## Текущий статус

### Что сделано
- ✅ Исследована проблема rapid-fire protection
- ✅ Проанализированы 5 вариантов решения
- ✅ Выбран Redis-based подход
- ✅ Создан детальный план реализации

### Что НЕ работает сейчас
- ❌ Rapid-fire protection не объединяет сообщения
- ❌ Бот не понимает разбитые на части сообщения
- ❌ Текущий webhook создает отдельную job для каждого сообщения

### Следующие шаги
1. Реализовать RedisBatchService
2. Создать batch-processor
3. Обновить webhook
4. Протестировать решение
5. Задеплоить и проверить в production

## Выводы

Проблема rapid-fire protection оказалась сложнее, чем казалось. Простое перемещение логики из worker'а в webhook не решило проблему, так как архитектура HTTP запросов не позволяет накапливать состояние между запросами.

Redis-based решение - это правильный production-ready подход, который решит проблему раз и навсегда.