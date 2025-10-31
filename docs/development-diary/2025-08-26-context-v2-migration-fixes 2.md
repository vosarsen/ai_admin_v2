# AI Admin v2 - Исправление критических ошибок после миграции на Context v2

## Дата: 26 августа 2025
## Автор: AI Assistant

## Контекст
После миграции на новую систему контекста v2 бот перестал отвечать на сообщения из-за критических ошибок в коде.

## Проблемы обнаружены

### 1. Ошибка `contextService is not defined`
**Симптом**: Worker постоянно рестартовал с ошибкой в конструкторе AIAdminV2
**Причина**: После удаления старой версии context-service остались ссылки на старый API

### 2. Ошибка `circuitBreakerFactory.getBreaker is not a function`
**Симптом**: WhatsApp клиент не мог инициализироваться
**Причина**: Изменился API circuit-breaker, но WhatsApp client использовал старый метод

### 3. Проблема с Redis батчингом
**Симптом**: Сообщения добавляются в батч, но не обрабатываются
**Причина**: Batch processor не находит ключи `rapid-fire:*` в Redis
**Статус**: Требует дополнительного исследования

## Решения примененные

### 1. Исправление contextService references

#### В data-loader.js:
```javascript
// Было:
const contextService = require('../../context');
await contextService.setContext(cleanPhone, companyId, {
  data: contextData
});

// Стало:
const contextServiceV2 = require('../../context/context-service-v2');
await contextServiceV2.updateDialogContext(cleanPhone, companyId, contextUpdates);
// Плюс правильная обработка сообщений через addMessage
```

#### В command-handler.js:
```javascript
// Заменены все вызовы:
- contextService.savePreferences → contextServiceV2.savePreferences
- contextService.invalidateCachedContext → contextServiceV2.invalidateFullContextCache
- contextService.updateContext → contextServiceV2.updateDialogContext
- contextService.setContext → удалено (не нужно)
```

### 2. Исправление circuit-breaker

#### В whatsapp/client.js:
```javascript
// Было:
const circuitBreakerFactory = require('../../utils/circuit-breaker');
this.circuitBreaker = circuitBreakerFactory.getBreaker('whatsapp', {
  timeout: this.timeout,
  errorThreshold: 5,
  resetTimeout: 60000
});

// Стало:
const { CircuitBreakerFactory: circuitBreakerFactory } = require('../../utils/circuit-breaker');
this.circuitBreaker = circuitBreakerFactory.get('whatsapp', {
  timeout: this.timeout,
  failureThreshold: 5,  // также изменено название параметра
  resetTimeout: 60000
});
```

## Результаты

### ✅ Успешно исправлено:
1. Worker v2 теперь запускается без ошибок
2. Context v2 система работает корректно
3. Circuit breaker инициализируется правильно
4. Сообщения обрабатываются AI системой

### ⚠️ Требует дополнительного внимания:
1. **Redis батчинг не работает корректно**:
   - Сообщения попадают в систему
   - AI обрабатывает их
   - Но ответы не отправляются из-за таймаутов WhatsApp
   - Batch processor не видит ключи rapid-fire в Redis

2. **Venom Bot имеет проблемы с Puppeteer**:
   - Частые timeout ошибки
   - Требует перезапуска

## Файлы измененные
1. `src/services/ai-admin-v2/modules/data-loader.js` - исправлены вызовы context API
2. `src/services/ai-admin-v2/modules/command-handler.js` - исправлены все references на contextServiceV2
3. `src/integrations/whatsapp/client.js` - исправлен импорт и использование circuit breaker

## Команды для проверки
```bash
# Проверка логов worker
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50"

# Проверка статуса процессов
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"

# Перезапуск Venom Bot при проблемах
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart venom-bot"
```

## Выводы
Миграция на Context v2 прошла успешно после исправления критических ошибок. Основная проблема была в несоответствии API старого и нового context service. Требуется дополнительное исследование проблемы с Redis батчингом и стабильностью Venom Bot.

## Следующие шаги
1. Исследовать проблему с Redis батчингом - почему ключи rapid-fire не сохраняются
2. Рассмотреть альтернативы Venom Bot или исправить проблемы с Puppeteer
3. Добавить мониторинг для автоматического обнаружения подобных проблем