# Context Loss Due to Race Condition - August 1, 2025

## Context
При анализе диалога с клиентом Геннадием (+7 988 075-77-77) была обнаружена проблема потери контекста: когда клиент ответил "Борода и голова" на вопрос "вас на комплекс?", бот забыл весь диалог и начал заново.

## Problem Analysis

### Timeline
```
14:08:40 - Bot: "Какой комплекс вас интересует?"
14:08:58 - Client: "Борода и голова" (18 секунд спустя)
14:09:15 - Context от ПЕРВОГО сообщения сохранен
14:09:15 - Bot: "На какую услугу вам записать?" (забыл контекст)
```

### Root Cause
**Race Condition** между параллельной обработкой сообщений:
1. Первое сообщение еще обрабатывается (35 секунд!)
2. Второе сообщение уже поступило в очередь
3. Второе сообщение загружает контекст, но первое еще не сохранено
4. В результате второе сообщение обрабатывается без учета первого

### Why This Happens
- Долгая обработка (AI вызов + YClients API + сохранение)
- Параллельная обработка сообщений в очереди
- Отсутствие механизма ожидания завершения предыдущего сообщения

## Solution Options

### 1. Sequential Processing (Quick Fix)
Обрабатывать сообщения от одного клиента последовательно:
```javascript
// В message-queue.js
async shouldProcessMessage(phone, message) {
  // Проверяем, обрабатывается ли сообщение от этого номера
  const processingKey = `processing:${phone}`;
  const isProcessing = await redis.get(processingKey);
  
  if (isProcessing) {
    // Откладываем обработку на 2 секунды
    await queue.add('process-message', { phone, message }, {
      delay: 2000
    });
    return false;
  }
  
  // Помечаем как обрабатываемое
  await redis.setex(processingKey, 60, '1'); // TTL 60 секунд
  return true;
}
```

### 2. Optimistic Locking (Better)
Сохранять частичный контекст сразу:
```javascript
// В начале processMessage
await contextService.setPartialContext(phone, {
  processingStarted: Date.now(),
  lastMessage: message,
  previousMessages: context.conversation
});

// После обработки
await contextService.commitContext(phone, fullContext);
```

### 3. Message Batching (Best)
Использовать существующий механизм батчинга для группировки быстрых сообщений:
- Сообщения в течение 10 секунд объединяются
- Обрабатываются как одно сообщение
- Контекст сохраняется один раз

## Technical Details

### Current Flow
1. `loadFullContext()` загружает из БД и Redis параллельно
2. Обработка может занимать 30+ секунд
3. `saveContext()` сохраняет в БД и Redis после обработки
4. Нет блокировки между сообщениями

### Race Condition Window
- Между `loadFullContext()` и `saveContext()` - до 35 секунд
- Любое сообщение в этот период теряет контекст

## Immediate Workaround
Пока полное решение не реализовано, можно:
1. Увеличить время батчинга до 15-20 секунд
2. Добавить предупреждение в UI о необходимости дождаться ответа
3. Использовать Redis-блокировку для критичных операций

## Lessons Learned
1. **Async != Parallel** - асинхронная обработка требует синхронизации
2. **Context is King** - потеря контекста критична для UX
3. **Race Conditions** - всегда учитывать при параллельной обработке
4. **Quick Messages** - пользователи отправляют сообщения быстрее, чем система обрабатывает

## Related Issues
- Похожая проблема может быть при одновременных сообщениях от разных каналов
- Батчинг частично решает проблему, но не полностью
- Нужна общая стратегия управления состоянием диалога