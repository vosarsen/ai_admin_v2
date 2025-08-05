# Исправление потери контекста между сообщениями

**Дата**: 05.08.2025  
**Автор**: Арсен  
**Тип работы**: Bug fix  
**Приоритет**: High  

## Контекст проблемы

Пользователь сообщил о критической проблеме: бот "забывал" информацию между сообщениями. В конкретном примере:
1. Клиент выбрал услугу "детская стрижка"
2. Бот предложил время
3. Клиент сказал "на 2" (имея в виду 14:00)
4. Бот не понял и снова спросил про услугу и время

## Выявленные проблемы

1. **Потеря контекста выбранной услуги** - бот не сохранял информацию о выбранной услуге между сообщениями
2. **Непонимание времени** - бот не интерпретировал "на 2" как 14:00
3. **Запрос имени у существующего клиента** - бот спрашивал имя, хотя клиент был в базе
4. **Отсутствие загрузки промежуточного контекста** - intermediate context не загружался в `loadFullContext`

## Технические детали решения

### 1. Добавление загрузки промежуточного контекста
В файле `src/services/ai-admin-v2/modules/cached-data-loader.js`:
```javascript
// Загружаем промежуточный контекст
const intermediateContext = require('../../context/intermediate-context');
const intermediate = await intermediateContext.getIntermediateContext(phone);

const context = {
  ...
  intermediateContext: intermediate,
```

### 2. Сохранение контекста после выполнения команд
В файле `src/services/ai-admin-v2/index.js`:
```javascript
// Сохраняем информацию о выбранных услуге и времени из выполненных команд
if (result.executedCommands && result.executedCommands.length > 0) {
  const normalizedPhone = phone.replace('@c.us', '');
  const contextData = {};
  
  // Извлекаем информацию из выполненных команд
  result.executedCommands.forEach(cmd => {
    if (cmd.params?.service_name) {
      contextData.lastService = cmd.params.service_name;
    }
    if (cmd.params?.time) {
      contextData.lastTime = cmd.params.time;
    }
    if (cmd.params?.staff_name) {
      contextData.lastStaff = cmd.params.staff_name;
    }
    if (cmd.params?.date) {
      contextData.lastDate = cmd.params.date;
    }
    contextData.lastCommand = cmd.command;
  });
  
  // Сохраняем в Redis контекст
  if (Object.keys(contextData).length > 0) {
    await contextService.setContext(normalizedPhone, companyId, {
      data: contextData,
      state: 'active'
    });
  }
}
```

### 3. Обновление промпта для понимания времени
В файле `src/services/ai-admin-v2/prompts/optimized-prompt.js`:
```javascript
8️⃣ ПОНИМАНИЕ ВРЕМЕНИ
   "на 2" = 14:00 (на два часа)
   "на 3" = 15:00 (на три часа)
   "на час" = 13:00
   "на 11" = 11:00
   ВСЕГДА интерпретируй числа как время в 24-часовом формате!
```

### 4. Отображение сохранённого контекста в промпте
```javascript
${redisContext?.data ? (() => {
  try {
    const data = JSON.parse(redisContext.data);
    const parts = [];
    if (data.lastService) parts.push(`Услуга: ${data.lastService}`);
    if (data.lastTime) parts.push(`Время: ${data.lastTime}`);
    if (data.lastStaff) parts.push(`Мастер: ${data.lastStaff}`);
    if (data.lastDate) parts.push(`Дата: ${data.lastDate}`);
    return parts.length > 0 ? `\n🔴 КЛИЕНТ УЖЕ ВЫБРАЛ: ${parts.join(', ')}` : '';
  } catch (e) {
    return '';
  }
})() : ''}
```

## Критическая ошибка после деплоя

После развертывания изменений возникла критическая ошибка:
```
ReferenceError: redisContext is not defined
```

**Быстрый фикс**: Добавлен `redisContext = null` в деструктуризацию параметров в `optimized-prompt.js`:
```javascript
const { 
  businessInfo, 
  company = {},
  client = null,
  phone = '',
  services = [], 
  staff = [], 
  staffSchedules = {},
  conversation = [],
  redisContext = null,  // <-- Добавлено
  intermediate = null,
  intermediateContext = null
} = context;
```

## Результаты

1. ✅ Бот теперь помнит выбранную услугу между сообщениями
2. ✅ Бот правильно интерпретирует "на 2" как 14:00
3. ✅ Контекст сохраняется в Redis и используется в следующих сообщениях
4. ✅ Промпт показывает AI ранее выбранную информацию
5. ✅ Критическая ошибка `redisContext is not defined` исправлена

## Проверка клиента в базе

При проверке выяснилось, что номер телефона из примера диалога (79068831915) не был в базе данных. Однако основной номер пользователя (+79686484488) присутствовал в базе с именем "Арсен" и 5 визитами.

## Уроки и выводы

1. **Важность сохранения контекста** - необходимо явно сохранять выбранные пользователем параметры между сообщениями
2. **Обработка разговорного языка** - нужно учитывать различные способы указания времени ("на 2", "на час" и т.д.)
3. **Тестирование после деплоя** - критически важно проверять работу после развертывания, особенно при изменении структуры данных
4. **Быстрая реакция на ошибки** - благодаря мониторингу логов удалось быстро обнаружить и исправить критическую ошибку

## Связанные файлы

- `src/services/ai-admin-v2/modules/cached-data-loader.js`
- `src/services/ai-admin-v2/index.js`
- `src/services/ai-admin-v2/prompts/optimized-prompt.js`
- `test-arsen-client.js` (создан для проверки)

## Статус

✅ Проблема решена, изменения развернуты в production