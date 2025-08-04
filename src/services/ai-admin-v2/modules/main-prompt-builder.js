const logger = require('../../../utils/logger').child({ module: 'main-prompt-builder' });

/**
 * Построитель основного промпта для AI Admin v2
 * Выделен из index.js для улучшения поддерживаемости
 */
class MainPromptBuilder {
  /**
   * Построить основной промпт
   */
  buildPrompt(message, context, terminology) {
    const sections = [];
    
    // 1. Роль и компания
    sections.push(this.buildRoleSection(terminology, context.company));
    
    // 2. Дополнительный контекст
    sections.push(this.buildAdditionalContext(context));
    
    // 3. Промежуточный контекст
    sections.push(this.buildIntermediateContext(context));
    
    // 4. Redis контекст
    sections.push(this.buildRedisContext(context));
    
    // 5. Информация о салоне
    sections.push(this.buildSalonInfo(context));
    
    // 6. Информация о клиенте
    sections.push(this.buildClientInfo(context, terminology));
    
    // 7. Предпочтения клиента
    sections.push(this.buildPreferences(context));
    
    // 8. Услуги
    sections.push(this.buildServices(context));
    
    // 9. Мастера
    sections.push(this.buildStaffInfo(context));
    
    // 10. История диалога
    sections.push(this.buildConversationHistory(context));
    
    // 11. Текущее сообщение
    sections.push(`ТЕКУЩЕЕ СООБЩЕНИЕ: "${message}"`);
    
    // 12. Анализ намерения
    sections.push(this.buildIntentAnalysis());
    
    // 13. Критические правила
    sections.push(this.buildCriticalRules(terminology));
    
    // 14. Команды
    sections.push(this.buildCommands());
    
    // 15. Правила работы
    sections.push(this.buildWorkingRules(context));
    
    // 16. Правила общения
    sections.push(this.buildCommunicationRules(terminology));
    
    // 17. Приветствие вернувшихся
    sections.push(this.buildReturningClientRules(context));
    
    // 18. Грамматика
    sections.push(this.buildGrammarRules());
    
    // 19. Проактивные предложения
    sections.push(this.buildProactiveRules(terminology, context));
    
    // 20. Важная информация
    sections.push(this.buildImportantInfo(context));
    
    // 21. Финальная инструкция
    sections.push('Ответь клиенту и выполни нужное действие:');
    
    // Фильтруем пустые секции и объединяем
    return sections.filter(section => section && section.trim()).join('\n');
  }
  
  buildRoleSection(terminology, company) {
    return `Ты - ${terminology.role} "${company.title}".`;
  }
  
  buildAdditionalContext(context) {
    let additionalContext = '';
    
    // Информация о продолжении диалога
    if (context.canContinueConversation && context.conversationSummary?.recentMessages?.length > 0) {
      additionalContext += `
ВАЖНО: Это продолжение прерванного диалога. Последние сообщения:
${context.conversationSummary.recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

Учти контекст предыдущего разговора при ответе.
`;
    }
    
    return additionalContext;
  }
  
  buildIntermediateContext(context) {
    let intermediateInfo = '';
    
    if (context.intermediateContext && context.intermediateContext.isRecent) {
      const ic = context.intermediateContext;
      intermediateInfo = `
🔴 КОНТЕКСТ ПРЕДЫДУЩЕГО СООБЩЕНИЯ (отправлено ${Math.round(ic.age / 1000)} секунд назад):
Предыдущее сообщение: "${ic.currentMessage}"
${ic.lastBotQuestion ? `Твой последний вопрос: "${ic.lastBotQuestion}"` : ''}
${ic.expectedReplyType ? `Ожидаемый тип ответа: ${ic.expectedReplyType}` : ''}
${ic.processingStatus === 'completed' ? 'Предыдущее сообщение было обработано' : ''}

КРИТИЧЕСКИ ВАЖНО: Это продолжение разговора! Клиент отвечает на твой вопрос!

${ic.lastBotQuestion && ic.lastBotQuestion.includes('мастер') ? `
🔴 КРИТИЧЕСКИ ВАЖНО: Ты спросил про мастера!
Если клиент назвал мастера (например "к Бари", "Сергей", "давайте к Сергею") - 
ИСПОЛЬЗУЙ ЭТО ИМЯ в команде CREATE_BOOKING!
НЕ ПЫТАЙСЯ создать запись без мастера если ты только что спросил о нем!
` : ''}`;
    }
    
    return intermediateInfo;
  }
  
  buildRedisContext(context) {
    let redisContextInfo = '';
    
    if (context.redisContext?.data) {
      const data = typeof context.redisContext.data === 'string' 
        ? JSON.parse(context.redisContext.data) 
        : context.redisContext.data;
      
      if (data.lastService || data.lastStaff) {
        redisContextInfo = `
🔴 КОНТЕКСТ ИЗ ПРЕДЫДУЩИХ СООБЩЕНИЙ:
${data.lastService ? `- Клиент хотел услугу: ${data.lastService}` : ''}
${data.lastStaff ? `- Клиент хотел к мастеру: ${data.lastStaff}` : ''}
${data.lastCommand ? `- Последняя команда: ${data.lastCommand}` : ''}

ИСПОЛЬЗУЙ ЭТУ ИНФОРМАЦИЮ если клиент не указывает явно другую услугу или мастера!
`;
      }
    }
    
    return redisContextInfo;
  }
  
  buildSalonInfo(context) {
    const formatter = require('./formatter');
    
    return `ИНФОРМАЦИЯ О САЛОНЕ:
Название: ${context.company.title}
Адрес: ${context.company.address || 'Не указан'}
Телефон: ${context.company.phone || 'Не указан'}
Часы работы: ${formatter.formatWorkingHours(context.company.working_hours || {})}
Загруженность сегодня: ${context.businessStats.todayLoad}% (${context.businessStats.bookedSlots}/${context.businessStats.totalSlots} слотов)`;
  }
  
  buildClientInfo(context, terminology) {
    const formatter = require('./formatter');
    const { client, phone } = context;
    
    if (client) {
      return `
КЛИЕНТ:
Имя: ${client.name || 'Не указано'}
Телефон: ${phone}
История: ${formatter.formatVisitHistory(client.visit_history)}
Любимые услуги: ${client.last_service_ids?.join(', ') || 'нет данных'}
Любимые мастера: ${client.favorite_staff_ids?.join(', ') || 'нет данных'}
ВАЖНО: Клиент УЖЕ ИЗВЕСТЕН! НЕ спрашивай как его зовут! Используй имя из базы!`;
    } else {
      return `
КЛИЕНТ:
Новый клиент, телефон: ${phone}
ВАЖНО: У нас нет имени клиента в базе! Спроси имя при создании записи!`;
    }
  }
  
  buildPreferences(context) {
    if (!context.preferences || Object.keys(context.preferences).length === 0) {
      return '';
    }
    
    return `
ПРЕДПОЧТЕНИЯ КЛИЕНТА:
${context.preferences.favoriteService ? `- Любимая услуга: ${context.preferences.favoriteService}` : ''}
${context.preferences.favoriteStaff ? `- Предпочитаемый мастер: ${context.preferences.favoriteStaff}` : ''}
${context.preferences.preferredTime ? `- Предпочитаемое время: ${context.preferences.preferredTime}` : ''}
${context.preferences.notes ? `- Заметки: ${context.preferences.notes}` : ''}`;
  }
  
  buildServices(context) {
    const formatter = require('./formatter');
    return `
ДОСТУПНЫЕ УСЛУГИ (топ-10):
${formatter.formatServices(context.services.slice(0, 10), context.company.type)}`;
  }
  
  buildStaffInfo(context) {
    const formatter = require('./formatter');
    return `
МАСТЕРА СЕГОДНЯ:
${formatter.formatTodayStaff(context.staffSchedules, context.staff)}

РАСПИСАНИЕ МАСТЕРОВ (ближайшие дни):
${formatter.formatStaffSchedules(context.staffSchedules, context.staff)}`;
  }
  
  buildConversationHistory(context) {
    const formatter = require('./formatter');
    return `
ИСТОРИЯ ДИАЛОГА:
${formatter.formatConversation(context.conversation)}`;
  }
  
  buildIntentAnalysis() {
    return `
АНАЛИЗ НАМЕРЕНИЯ КЛИЕНТА:
Определи, что хочет клиент, и используй соответствующую команду.`;
  }
  
  buildCriticalRules(terminology) {
    // Здесь только самые критичные правила, полный список в отдельном файле
    return `
🔴 КРИТИЧЕСКИ ВАЖНО - ИСПОЛЬЗУЙ КОНТЕКСТ ДИАЛОГА:
Если клиент продолжает предыдущий разговор и не указывает явно услугу или мастера:
1. Проверь ИСТОРИЮ ДИАЛОГА - какую услугу клиент хотел изначально?
2. Проверь какого мастера клиент упоминал в предыдущих сообщениях
3. ИСПОЛЬЗУЙ эту информацию в командах

🔴 КРИТИЧЕСКИ ВАЖНО - ПРОВЕРЬ СЕКЦИЮ "КЛИЕНТ":
- Если там есть имя (не "Не указано") → НИКОГДА НЕ СПРАШИВАЙ как зовут!
- Используй имя из базы ТОЛЬКО в приветствии: "Здравствуйте, {имя}!"
- НЕ ПОВТОРЯЙ имя в каждом сообщении - это выглядит неестественно!

🔴 КРИТИЧЕСКИ ВАЖНО - ПОЛНЫЙ ОТВЕТ В ОДНОМ СООБЩЕНИИ:
- Если клиент хочет записаться к конкретному мастеру на конкретное время
- И клиент УЖЕ ИЗВЕСТЕН (есть имя в базе)
- ТО: приветствие + проверка + создание записи - ВСЁ В ОДНОМ ОТВЕТЕ!`;
  }
  
  buildCommands() {
    // Команды вынесены в отдельный файл commands-reference.js
    return require('./commands-reference').getCommandsReference();
  }
  
  buildWorkingRules(context) {
    return require('./working-rules').getWorkingRules(context);
  }
  
  buildCommunicationRules(terminology) {
    return require('./communication-rules').getCommunicationRules(terminology);
  }
  
  buildReturningClientRules(context) {
    if (!context.isReturningClient || !context.client?.name) {
      return '';
    }
    
    return `
ПРИВЕТСТВИЕ ВЕРНУВШИХСЯ КЛИЕНТОВ:
- Обращайся по имени: "${context.client.name}"
- Если это продолжение диалога в течение дня - НЕ здоровайся повторно
- Если прошло больше суток - поздоровайся кратко: "Привет, ${context.client.name}!"
${context.preferences?.favoriteService ? `- Можешь предложить любимую услугу: "${context.preferences.favoriteService}"` : ''}
${context.preferences?.favoriteStaff ? `- Можешь предложить любимого мастера: "${context.preferences.favoriteStaff}"` : ''}
${context.canContinueConversation ? '- Учти контекст предыдущего разговора при ответе' : ''}`;
  }
  
  buildGrammarRules() {
    return `
ГРАММАТИКА РУССКОГО ЯЗЫКА (КРИТИЧЕСКИ ВАЖНО):
Имена в РОДИТЕЛЬНОМ падеже (у кого? чего?):
- "У Сергея свободно" (НЕ "У Сергей")
- "У Марии есть время" (НЕ "У Мария")
- "У Рамзана окна" (НЕ "У Рамзан")

Имена в ДАТЕЛЬНОМ падеже (к кому? чему?):
- "Записать вас к Сергею" (НЕ "к Сергей")
- "К Марии на маникюр" (НЕ "к Мария")

Правильные вопросы:
- "На какую услугу вас записать?" (НЕ "Какую услугу вы хотели бы записать?")
- "К какому мастеру вас записать?" (НЕ "Какого мастера вы хотели бы?")
- "На какое время вас записать?" (НЕ "Во сколько вы хотели бы записать?")`;
  }
  
  buildProactiveRules(terminology, context) {
    return `
ПРОАКТИВНЫЕ ПРЕДЛОЖЕНИЯ (используй разумно):
- Если клиент постоянный - предложи его любимую услугу
- Если большая загруженность - предложи менее загруженное время
- Если выходные - напомни о необходимости заранее записываться
- Предлагай ${terminology.suggestions} когда уместно
- Используй информацию о клиенте если он постоянный`;
  }
  
  buildImportantInfo(context) {
    const config = require('../../../config');
    
    return `
ВАЖНО:
- Сегодня: ${context.currentTime}
- Часовой пояс: ${context.timezone}
- Минимальное время для записи: ${config.business.minBookingMinutesAhead} минут

ПОНИМАНИЕ ДНЕЙ:
- "сегодня" = ${new Date().toISOString().split('T')[0]}
- "завтра" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
- "послезавтра" = ${new Date(Date.now() + 172800000).toISOString().split('T')[0]}

🔴 КРИТИЧЕСКИ ВАЖНО - РАЗБОР ВРЕМЕНИ И ДАТ:
Когда клиент использует число с временным контекстом, ВСЕГДА интерпретируй как ВРЕМЯ, а НЕ дату:
- "утро 10" = время 10:00 (НЕ 10 число месяца!)
- "на утро 10" = время 10:00 утра
- "вечер 8" = время 20:00 (НЕ 8 число!)
- "день 3" = время 15:00 (НЕ 3 число!)

ФОРМАТ ОТВЕТА:
1. Сначала напиши короткий естественный ответ клиенту (1-2 предложения)
2. Затем добавь нужную команду: [КОМАНДА параметры] ТОЛЬКО если это нужно
3. НЕ ДОБАВЛЯЙ КОМАНДУ если просто спрашиваешь время у клиента!`;
  }
}

module.exports = new MainPromptBuilder();