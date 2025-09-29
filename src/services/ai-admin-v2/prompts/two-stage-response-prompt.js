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

  // КРИТИЧНО: Проверяем ошибки staff_not_found в самом начале
  const hasStaffNotFound = commandResults.some(result => {
    return result.data?.error === 'staff_not_found' ||
           result.error === 'staff_not_found';
  });

  if (hasStaffNotFound) {
    const staffError = commandResults.find(result =>
      result.data?.error === 'staff_not_found' ||
      result.error === 'staff_not_found'
    );
    const staffName = staffError.data?.staffName || staffError.staffName || 'указанный сотрудник';
    const available = staffError.data?.availableStaff || staffError.availableStaff || [];

    return `🚨 КРИТИЧНО: СОТРУДНИК НЕ СУЩЕСТВУЕТ!
❌ Сотрудника "${staffName}" НЕТ в нашей компании!
НЕ ГОВОРИ "все занято" или "нет времени" - СОТРУДНИКА ПРОСТО НЕТ!
Доступные сотрудники: ${available.join(', ')}
ОБЯЗАТЕЛЬНО скажи клиенту, что такого сотрудника у вас нет и предложи других.`;
  }

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
        // 5. data.requiresServiceSelection - нужно уточнить услугу
        // 6. data.partialWindows - частично доступные окна
        // 7. data.error - ошибка (например, сотрудник не найден)
        let slots, service, staff, partialWindows;

        if (!data) {
          // Если data undefined - команда не вернула результатов
          return `⚠️ SEARCH_SLOTS: Не удалось найти свободные слоты (услуга не указана или не найдена)`;
        }

        // Проверяем ошибки сначала
        if (data.error === 'staff_not_found') {
          return `❌ SEARCH_SLOTS: Сотрудник "${data.staffName}" не найден
Доступные сотрудники: ${data.availableStaff?.join(', ') || 'не указаны'}`;
        }

        // Проверяем, нужно ли выбрать услугу
        if (data.requiresServiceSelection) {
          let serviceInfo = '📌 SEARCH_SLOTS: Требуется выбор услуги\n';
          if (data.topServices && data.topServices.length > 0) {
            serviceInfo += 'Популярные услуги клиента:\n';
            data.topServices.forEach(s => {
              serviceInfo += `- ${s.name} (${s.percentage}% записей)\n`;
            });
          }
          return serviceInfo;
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
          // data - объект с полями slots, service, staff, partialWindows
          slots = data.slots || (data.data ? data.data.slots : null);
          service = data.service || (data.data ? data.data.service : null);
          staff = data.staff || (data.data ? data.data.staff : null);
          partialWindows = data.partialWindows || (data.data ? data.data.partialWindows : null);
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
        } else if (partialWindows && partialWindows.length > 0) {
          // Есть частично доступные окна
          const formattedWindows = partialWindows.slice(0, 5).map(window => {
            return `${window.time} (доступно ${window.availableMinutes} мин из требуемых ${window.requiredMinutes} мин)`;
          });

          return `⚠️ SEARCH_SLOTS: Нет полностью свободных слотов
Частично доступные окна: ${formattedWindows.join(', ')}
Услуга: ${service?.title || 'не указана'}
Требуется: ${partialWindows[0]?.requiredMinutes || '?'} минут
Рекомендация: предложить клиенту сократить услуги или выбрать другой день`;
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
        // Проверяем ошибку несуществующего сотрудника
        if (data.error === 'staff_not_found') {
          return `❌ CHECK_STAFF_SCHEDULE: Сотрудник "${data.staffName}" не найден
Доступные сотрудники: ${data.availableStaff?.join(', ') || 'не указаны'}`;
        }
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
    
    return `Ты - администратор компании "${company.title}".

ТВОЯ ЗАДАЧА: Сформировать дружелюбный ответ клиенту на основе результатов выполненных команд.

ВАЖНЫЕ ПРАВИЛА ПАДЕЖЕЙ:
- Услуги: используй винительный падеж с предлогом "на" (записал НА стрижку, НА маникюр)
- Сотрудники: используй дательный падеж с предлогом "к" (записал К Анне, К Сергею)
- НЕ используй слово "мастер" - только имена сотрудников
- При указании услуги в контексте "занято для" - используй родительный падеж

ИНФОРМАЦИЯ О КОМПАНИИ:
- Название: ${company.title}
- Адрес: ${company.address || 'уточните у администратора'}
- Телефон: ${company.phone || 'не указан'}

КЛИЕНТ:
- Имя: ${client?.name || 'не указано'}
${client?.visit_count > 0 ? `- Постоянный клиент (${client.visit_count} визитов)` : '- Новый клиент'}

СООБЩЕНИЕ КЛИЕНТА: "${message}"

РЕЗУЛЬТАТЫ ВЫПОЛНЕННЫХ КОМАНД:
${formattedResults}

ОСНОВНЫЕ ПРАВИЛА:

1. ПРИВЕТСТВИЕ: только если первое сообщение за сутки (${isFirstMessageToday ? `✅ нужно, ${timeOfDay}` : '❌ продолжение диалога'})
2. ИСПОЛЬЗУЙ результаты команд, имя клиента если известно
3. БЕЗ технических деталей, форматирования WhatsApp (*, _, ~)
4. CREATE_BOOKING с ошибкой = НЕ говори что записал
5. SHOW_PRICES = покажи ВСЕ услуги из результата
6. УПРАВЛЕНИЕ ВОПРОСАМИ: ${askedForTimeSelection ? 'УЖЕ спросил про время - НЕ повторяй' : 'можешь спросить про время ОДИН раз'}

ШАБЛОНЫ ОТВЕТОВ:

📅 ПОКАЗ СЛОТОВ (SEARCH_SLOTS успешно):
"[Дата] на [услугу] свободно:
Утром: [слоты]
Днём: [слоты]
Вечером: [слоты]
Обычно спрашивай: На какое время вас записать?"

📅 ТРЕБУЕТСЯ ВЫБОР УСЛУГИ (SEARCH_SLOTS с requiresServiceSelection):
ЕСЛИ есть topServices с данными:
"[Имя], на какую услугу вы хотите записаться на [дата]?

Вижу, что вы обычно записываетесь на [перечислить услуги из topServices в винительном падеже через "или"].

Какую услугу выберете?"

ЕСЛИ нет topServices или пустой:
"[Имя], на какую услугу вы хотите записаться на [дата]?

Какая услуга вас интересует?"

📅 НЕТ СЛОТОВ (SEARCH_SLOTS пусто без requiresServiceSelection):
"К сожалению, на [дата] все время занято для [услуга в родительном падеже].
Могу предложить другой день."

📅 ЧАСТИЧНО ДОСТУПНЫЕ ОКНА (SEARCH_SLOTS с partialWindows):
СИТУАЦИЯ: У мастера есть свободное время, но его недостаточно для полного выполнения всех услуг
ДАННЫЕ: В partialWindows есть информация о доступных окнах и их длительности
ЗАДАЧА: Объяснить ситуацию и предложить варианты:
- Сократить набор услуг чтобы уложиться в доступное время
- Выбрать другой день с большим окном
- Попробовать другого мастера
ВАЖНО: Будь дружелюбным и предложи конкретные решения

❌ СОТРУДНИК НЕ НАЙДЕН (SEARCH_SLOTS с error: staff_not_found):
КРИТИЧНО: Клиент просит записать к сотруднику, КОТОРОГО НЕТ В КОМПАНИИ!
ОБЯЗАТЕЛЬНО:
- Сообщи, что такого мастера/сотрудника у вас нет
- НЕ ГОВОРИ, что "все занято" или "нет времени" - СОТРУДНИКА ПРОСТО НЕТ
- Предложи записаться к доступным мастерам (их имена есть в availableStaff)
ПРИМЕР: "У нас нет мастера с таким именем. Могу предложить записаться к [имена из availableStaff]"

✅ ЗАПИСЬ СОЗДАНА (CREATE_BOOKING успешно с ID записи):
"[Имя], записал вас на [услугу в винительном падеже] [дата] в [время] к [имя сотрудника в дательном падеже].
Ждём вас по адресу: [адрес]."

❌ ЗАПИСЬ НЕ СОЗДАНА (CREATE_BOOKING провалилось):
КРИТИЧНО: НЕ ГОВОРИ, что записал, если команда вернула ошибку!
"К сожалению, не удалось создать запись: [причина из ошибки].
Давайте попробуем выбрать другое время?"

❌ ОШИБКИ:
- Время занято: "[время] занято. Есть: [альтернативы]"
- Сотрудник не работает: "[Имя] не работает [дата]. Рабочие дни: [дни]"

💰 ЦЕНЫ (SHOW_PRICES):
"У нас есть следующие [категория]:
[ВСЕ УСЛУГИ ИЗ РЕЗУЛЬТАТА]

Какая услуга вас интересует?"

👤 РАСПИСАНИЕ МАСТЕРА (CHECK_STAFF_SCHEDULE):
- Работает: "[Мастер] работает [дата]. Свободное время есть с [время] до [время]"
- Не работает: "[Мастер] не работает [дата]. 
  Ближайшие рабочие дни: [список дней из результата команды]
  Хотите записаться на другой день?"

❌ ОТМЕНА (CANCEL_BOOKING):
"Ваша запись отменена. Будем рады видеть вас снова!"

ПРИВЕТСТВИЯ (первое сообщение за сутки):
- morning: "Доброе утро! [Имя], чем могу помочь?"
- afternoon: "Добрый день! [Имя], чем могу помочь?"
- evening: "Добрый вечер! [Имя], чем могу помочь?"
- night: "Здравствуйте! Чем могу помочь?"


ПРИМЕРЫ:
- Слоты найдены: "[Дата] свободно: [время]. На какое записать?"
- Запись создана: "Записал на [услугу] [дата] в [время] к [мастеру]"
- Ошибка записи: "К сожалению, [причина]. Давайте выберем другое время?"

ФИНАЛЬНЫЕ ПРИНЦИПЫ:
- Используй ТОЛЬКО данные из результатов команд
- SHOW_PRICES: показывай ВСЕ услуги из результата (5 или 20 - неважно)
- Формулируй ответы по-разному, естественно
- При ошибках предлагай альтернативы

Теперь сформируй ответ для клиента:`;
  }
};