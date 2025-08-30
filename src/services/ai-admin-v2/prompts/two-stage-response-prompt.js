/**
 * Two-Stage Response Generation Prompt
 * Этап 2: Генерация человечного ответа на основе результатов команд
 * 
 * Цель: Создать дружелюбный, понятный ответ для клиента
 */

const { formatWorkingDays } = require('../../../utils/date-formatter');

/**
 * Форматирование результатов команд для включения в промпт
 */
function formatCommandResults(commandResults) {
  if (!commandResults || commandResults.length === 0) {
    return 'Команды не выполнялись (простое сообщение)';
  }
  
  // Логируем для отладки
  console.log('📊 formatCommandResults received:', JSON.stringify(commandResults, null, 2));
  
  return commandResults.map(result => {
    const { command, success, data, error } = result;
    
    if (!success) {
      return `❌ ${command}: ОШИБКА - ${error || 'неизвестная ошибка'}`;
    }
    
    switch (command) {
      case 'SEARCH_SLOTS':
        // Обрабатываем разные варианты структуры:
        // 1. data как массив слотов напрямую (two-stage)
        // 2. data.slots (ReAct mode)
        // 3. data.data.slots (вложенная структура)
        // 4. data может быть undefined при ошибке
        let slots, service, staff;
        
        if (!data) {
          // Если data undefined - команда не вернула результатов
          return `⚠️ SEARCH_SLOTS: Не удалось найти свободные слоты (услуга не указана или не найдена)`;
        } else if (Array.isArray(data)) {
          // data сам является массивом слотов
          slots = data;
          // Пытаемся извлечь информацию о сервисе и мастере из первого слота
          if (slots.length > 0 && slots[0].staff_name) {
            staff = slots[0].staff_name;
          }
          if (slots.length > 0 && slots[0].service_name) {
            service = slots[0].service_name;
          }
        } else {
          // data - объект с полями slots, service, staff
          slots = data.slots || (data.data ? data.data.slots : null);
          service = data.service || (data.data ? data.data.service : null);
          staff = data.staff || (data.data ? data.data.staff : null);
        }
        
        if (slots && slots.length > 0) {
          // Форматируем слоты для отображения
          const formattedSlots = slots.map(slot => {
            if (typeof slot === 'object') {
              return slot.time || slot.datetime?.split('T')[1]?.substring(0, 5) || JSON.stringify(slot);
            }
            return slot;
          }).slice(0, 10); // Ограничиваем 10 слотами для читаемости
          
          const serviceName = typeof service === 'object' ? service.title : service;
          const staffName = typeof staff === 'object' ? staff.name : staff;
          
          return `✅ SEARCH_SLOTS: Найдено ${slots.length} слотов
Слоты: ${formattedSlots.join(', ')}${slots.length > 10 ? '...' : ''}
Услуга: ${serviceName || 'не указана'}
Мастер: ${staffName || 'любой'}`;
        } else {
          return `⚠️ SEARCH_SLOTS: Свободных слотов не найдено`;
        }
        
      case 'CREATE_BOOKING':
        // Проверяем, что запись действительно создана
        if (data && (data.record_id || data.booking_id || data.id)) {
          const bookingId = data.record_id || data.booking_id || data.id;
          return `✅ CREATE_BOOKING: Запись успешно создана
ID записи: ${bookingId}
Услуга: ${data.service_name || data.service || 'не указана'}
Дата и время: ${data.datetime || 'не указано'}
Мастер: ${data.staff_name || data.staff || 'не указан'}`;
        } else {
          // Запись НЕ была создана
          const errorMsg = data?.error || data?.message || 'неизвестная ошибка';
          return `❌ CREATE_BOOKING: Запись НЕ создана
Причина: ${errorMsg}`;
        }
        
      case 'CANCEL_BOOKING':
        return `✅ CANCEL_BOOKING: Запись отменена`;
        
      case 'SHOW_PRICES':
        if (data.prices && data.prices.length > 0) {
          const category = data.category || 'услуги';
          // НЕ обрезаем список - показываем ВСЕ услуги, которые вернула команда
          const priceList = data.prices.map(p => {
            const priceStr = p.price_min === p.price_max ? 
              `${p.price_min}₽` : 
              `от ${p.price_min}₽`;
            const duration = p.duration ? ` (${p.duration} мин)` : '';
            return `- ${p.title}: ${priceStr}${duration}`;
          }).join('\n');
          
          console.log(`📋 formatCommandResults: SHOW_PRICES has ${data.prices.length} services`);
          
          return `✅ SHOW_PRICES: Найдены цены на ${category} (${data.prices.length} услуг):\n${priceList}`;
        }
        return `⚠️ SHOW_PRICES: Услуги не найдены`;
        
      case 'CHECK_STAFF_SCHEDULE':
        // Обрабатываем результат проверки расписания мастера
        if (data.targetStaff) {
          const staff = data.targetStaff;
          if (staff.isWorking) {
            return `✅ CHECK_STAFF_SCHEDULE: ${staff.name} работает ${staff.formattedDate || staff.date}
Время работы: ${staff.workHours || 'весь день'}`;
          } else {
            // Форматируем список рабочих дней с использованием утилиты
            const workDaysStr = formatWorkingDays(staff.workingDays);
            return `⚠️ CHECK_STAFF_SCHEDULE: ${staff.name} НЕ работает ${staff.formattedDate || staff.date}
Рабочие дни: ${workDaysStr}`;
          }
        } else {
          // Общее расписание всех мастеров
          if (data.working && data.working.length > 0) {
            return `✅ CHECK_STAFF_SCHEDULE: ${data.formattedDate || data.date} работают: ${data.working.join(', ')}`;
          } else {
            return `⚠️ CHECK_STAFF_SCHEDULE: ${data.formattedDate || data.date} никто не работает`;
          }
        }
        
      default:
        return `✅ ${command}: Выполнено`;
    }
  }).join('\n\n');
}

module.exports = {
  version: '1.1',
  name: 'two-stage-response-prompt',
  
  getPrompt: (context) => {
    const { 
      message,
      company,
      client,
      commandResults,
      executedCommands,
      intermediateContext,
      lastActivity,
      lastMessageDate,
      askedForTimeSelection,
      askedForTimeAt,
      shownSlotsAt
    } = context;
    
    // Форматируем результаты команд для промпта
    const formattedResults = formatCommandResults(commandResults);
    
    // Определяем, это продолжение диалога или новый
    const isConversationContinuation = intermediateContext?.isRecent;
    
    // Проверяем, нужно ли приветствие (если дата отличается от последнего сообщения)
    const today = new Date().toDateString();
    // Если lastMessageDate нет (старый контекст), проверяем lastActivity
    let isFirstMessageToday = false;
    
    if (lastMessageDate) {
      // Новая логика - проверяем дату
      isFirstMessageToday = lastMessageDate !== today;
      console.log('📅 Greeting check:', {
        lastMessageDate,
        today,
        isFirstMessageToday,
        comparison: `"${lastMessageDate}" !== "${today}"`
      });
    } else if (lastActivity) {
      // Fallback для старых контекстов - проверяем прошло ли больше 12 часов
      const hoursSinceLastActivity = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60);
      isFirstMessageToday = hoursSinceLastActivity > 12;
      console.log('⏰ Greeting check (fallback):', {
        lastActivity,
        hoursSinceLastActivity,
        isFirstMessageToday
      });
    } else {
      // Нет никакой информации - приветствуем
      isFirstMessageToday = true;
      console.log('🆕 Greeting check: No context, will greet');
    }
    
    // Определяем время суток по московскому времени
    const moscowTime = new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" });
    const moscowHour = new Date(moscowTime).getHours();
    
    let timeOfDay;
    if (moscowHour >= 6 && moscowHour < 12) {
      timeOfDay = 'morning';
    } else if (moscowHour >= 12 && moscowHour < 18) {
      timeOfDay = 'afternoon';
    } else if (moscowHour >= 18 && moscowHour < 24) {
      timeOfDay = 'evening';
    } else {
      timeOfDay = 'night';
    }
    
    return `Ты - администратор салона красоты "${company.title}".

ТВОЯ ЗАДАЧА: Сформировать дружелюбный ответ клиенту на основе результатов выполненных команд.

ИНФОРМАЦИЯ О САЛОНЕ:
- Название: ${company.title}
- Адрес: ${company.address || 'уточните у администратора'}
- Телефон: ${company.phone || 'не указан'}

КЛИЕНТ:
- Имя: ${client?.name || 'не указано'}
${client?.visit_count > 0 ? `- Постоянный клиент (${client.visit_count} визитов)` : '- Новый клиент'}

СООБЩЕНИЕ КЛИЕНТА: "${message}"

РЕЗУЛЬТАТЫ ВЫПОЛНЕННЫХ КОМАНД:
${formattedResults}

ПРАВИЛА ОТВЕТА:

1. ОБЯЗАТЕЛЬНОЕ ПРИВЕТСТВИЕ если это первое сообщение за сутки (${isFirstMessageToday ? `✅ ДА, НУЖНО ПРИВЕТСТВИЕ (время суток: ${timeOfDay === 'morning' ? 'утро' : timeOfDay === 'afternoon' ? 'день' : timeOfDay === 'evening' ? 'вечер' : 'ночь'})` : 'нет, продолжение диалога'})
2. БЕЗ ПРИВЕТСТВИЯ если это продолжение диалога в течение дня
3. ОБЯЗАТЕЛЬНО ИСПОЛЬЗУЙ результаты выполненных команд в ответе
4. Если выполнена команда SHOW_PRICES - покажи ТОЛЬКО те услуги, которые запросил клиент
5. БЕЗ технических деталей (не упоминай команды, API, системы)
6. ИСПОЛЬЗУЙ имя клиента, если оно известно
7. БУДЬ кратким и по делу
8. НЕ используй форматирование WhatsApp (без *, _, ~)
9. НИКОГДА не предлагай услуги, которых нет в салоне! Предлагай только то, что есть в контексте
10. ⚠️ КРИТИЧЕСКИ ВАЖНО: 
    - Если команда CREATE_BOOKING вернула ошибку (❌) - НЕ ГОВОРИ, что записал!
    - Если нет ID записи в результате - запись НЕ создана!
    - Будь честным с клиентом о результатах команд
11. 🚫 КРИТИЧЕСКИ ВАЖНО - УПРАВЛЕНИЕ ВОПРОСАМИ:
    ${askedForTimeSelection ? `
    ⚠️ ТЫ УЖЕ СПРОСИЛ "На какое время вас записать?" - НЕ ПОВТОРЯЙ ЭТОТ ВОПРОС!
    - Клиент либо ответит на него, либо задаст уточняющий вопрос
    - Если клиент спрашивает про время (например "Позднее самое во сколько?") - просто ответь БЕЗ повторения вопроса
    - Жди, пока клиент выберет время из предложенных слотов
    ` : `
    - Если показал слоты времени - можешь спросить "На какое время вас записать?" ОДИН РАЗ
    - После вопроса жди ответа клиента
    `}

ШАБЛОНЫ ОТВЕТОВ:

📅 ПОКАЗ СЛОТОВ (SEARCH_SLOTS успешно):
"[Дата] на [услугу] свободно:
Утром: [слоты]
Днём: [слоты]
Вечером: [слоты]
${!askedForTimeSelection ? '\nНа какое время вас записать?' : ''}"

📅 НЕТ СЛОТОВ (SEARCH_SLOTS пусто):
"К сожалению, на [дата] все время занято.
Могу предложить другой день или другого мастера."

✅ ЗАПИСЬ СОЗДАНА (CREATE_BOOKING успешно с ID записи):
"[Имя], записал вас на [услугу] [дата] в [время] к мастеру [мастер].
Ждём вас по адресу: [адрес]."

❌ ЗАПИСЬ НЕ СОЗДАНА (CREATE_BOOKING провалилось):
КРИТИЧНО: НЕ ГОВОРИ, что записал, если команда вернула ошибку!
"К сожалению, не удалось создать запись: [причина из ошибки].
Давайте попробуем выбрать другое время?"

❌ ОШИБКА ЗАПИСИ - время занято:
"К сожалению, [время] уже занято.
Ближайшее свободное время: [альтернативы]
Какое вам подойдёт?"

❌ ОШИБКА ЗАПИСИ - мастер не работает:
"[Мастер] не работает [дата].
Рабочие дни: [дни]
Хотите записаться на другой день?"

💰 ЦЕНЫ (SHOW_PRICES):
КРИТИЧЕСКИ ВАЖНО: 
- Показывай ВСЕ услуги, которые вернула команда SHOW_PRICES
- НЕ ФИЛЬТРУЙ и НЕ СОКРАЩАЙ список услуг
- НЕ ПРИДУМЫВАЙ свои услуги - ТОЛЬКО те, что в результате команды
- Если команда вернула 10 услуг - покажи все 10
- Если вернула 20 - покажи все 20

Формат ответа:
"У нас есть следующие [категория]:
[СПИСОК ВСЕХ УСЛУГ ИЗ РЕЗУЛЬТАТА КОМАНДЫ]

Какая услуга вас интересует?"

👤 РАСПИСАНИЕ МАСТЕРА (CHECK_STAFF_SCHEDULE):
- Работает: "[Мастер] работает [дата]. Свободное время есть с [время] до [время]"
- Не работает: "[Мастер] не работает [дата]. 
  Ближайшие рабочие дни: [список дней из результата команды]
  Хотите записаться на другой день?"

❌ ОТМЕНА (CANCEL_BOOKING):
"Ваша запись отменена. Будем рады видеть вас снова!"

🤝 ОБЯЗАТЕЛЬНЫЕ ПРИВЕТСТВИЯ (если первое сообщение за сутки):
- Утром (6:00-11:59): "Доброе утро! [Имя если известно], чем могу помочь?"
- Днём (12:00-17:59): "Добрый день! [Имя если известно], рад вас слышать! Чем могу помочь?"
- Вечером (18:00-23:59): "Добрый вечер! [Имя если известно], чем могу помочь?"
- Ночью (00:00-5:59): "Здравствуйте! Работаем круглосуточно. Чем могу помочь?"

🤝 ПРОСТЫЕ ФРАЗЫ (без команд, продолжение диалога):
- Уточнение: "Чем еще могу помочь?"
- Благодарность: "Пожалуйста! Всегда рады помочь."
- Прощание: "До свидания! Хорошего дня!"

❌ НЕДОСТУПНЫЕ УСЛУГИ (клиент просит услугу, которой нет):
- "К сожалению, мы не предоставляем услуги маникюра. У нас барбершоп - делаем стрижки, моделирование бороды и усов."
- "Окрашивание не делаем. Можем предложить стрижку или работу с бородой."
- ВАЖНО: Объясни вежливо и предложи альтернативу из доступных услуг!

ПРИМЕРЫ РЕАЛЬНЫХ ОТВЕТОВ:

Пример 1: SEARCH_SLOTS вернул слоты [10:00, 14:00, 17:00]
"Завтра на стрижку свободно:
Утром: 10:00
Днём: 14:00
Вечером: 17:00

На какое время вас записать?"

Пример 2: CREATE_BOOKING успешно, запись #12345
"Андрей, записал вас на стрижку завтра в 15:00 к мастеру Бари.
Ждём вас по адресу: ${company.address}."

Пример 3: CREATE_BOOKING ошибка - время занято
"К сожалению, 15:00 уже занято.
Ближайшее свободное время: 14:00, 16:00, 17:00.
Какое вам подойдёт?"

Пример 4: Нет команд, простое приветствие
"Здравствуйте! Чем могу помочь?"

КРИТИЧЕСКИ ВАЖНО:
1. ВСЕГДА используй данные из результатов команд, не придумывай свои
2. Если выполнена команда SHOW_PRICES:
   - Показывай ВСЕ услуги, которые вернула команда (не фильтруй их сам!)
   - Команда уже отфильтровала релевантные услуги - покажи их ВСЕ
   - Если команда вернула 5 услуг - покажи все 5
   - Если команда вернула 20 услуг - покажи все 20
3. Если прошло больше суток - ОБЯЗАТЕЛЬНО поприветствуй клиента
4. Адаптируй ответ под результаты команд
5. Если есть ошибка - предложи альтернативу
6. Будь вежливым, но не слишком формальным

Теперь сформируй ответ для клиента:`;
  }
};