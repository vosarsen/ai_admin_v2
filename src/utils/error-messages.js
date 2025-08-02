// src/utils/error-messages.js
const logger = require('./logger');

/**
 * Централизованная система управления сообщениями об ошибках
 * Преобразует технические ошибки в понятные пользователям сообщения
 */
class ErrorMessages {
  constructor() {
    // Карта технических ошибок на user-friendly сообщения
    this.errorMap = {
      // Сетевые ошибки
      'ECONNREFUSED': 'Сервис временно недоступен. Попробуйте через несколько минут.',
      'ETIMEDOUT': 'Превышено время ожидания ответа. Проверьте подключение к интернету.',
      'ENOTFOUND': 'Не удалось подключиться к сервису. Попробуйте позже.',
      'ECONNRESET': 'Соединение было прервано. Попробуйте еще раз.',
      'ENETUNREACH': 'Нет доступа к сети. Проверьте подключение к интернету.',
      
      // Ошибки YClients API
      'занят': 'К сожалению, это время уже занято. Пожалуйста, выберите другое время.',
      'недоступ': 'Выбранное время недоступно. Попробуйте выбрать другое.',
      'не работает': 'Мастер не работает в выбранное время. Выберите другое время или мастера.',
      'Не найдены услуги': 'К сожалению, запрашиваемая услуга не найдена. Уточните название.',
      'No available slots': 'На выбранную дату нет свободного времени. Попробуйте другую дату.',
      'fully_booked': 'На эту дату всё занято. Давайте посмотрим другие дни?',
      'All slots are booked': 'Все слоты заняты. Хотите записаться на другой день?',
      
      // Ошибки валидации
      'Invalid phone': 'Пожалуйста, укажите корректный номер телефона.',
      'Phone number is required': 'Для записи необходим номер телефона.',
      'Invalid date': 'Неверный формат даты. Укажите дату в формате ДД.ММ или "завтра".',
      'Date is too far': 'Запись возможна максимум на 30 дней вперёд.',
      'Date is in the past': 'Нельзя записаться на прошедшую дату.',
      
      // Ошибки бизнес-логики
      'No staff available': 'Сейчас нет доступных мастеров. Попробуйте позже.',
      'Service not found': 'Услуга не найдена. Проверьте название.',
      'Booking not found': 'Запись не найдена. Проверьте детали.',
      'Already cancelled': 'Эта запись уже отменена.',
      'Cannot cancel past booking': 'Нельзя отменить прошедшую запись.',
      'TIME_UNAVAILABLE': 'Это время уже занято. Выберите другое время из предложенных.',
      'CLIENT_NAME_REQUIRED': 'Пожалуйста, сначала представьтесь. Как вас зовут?',
      'STAFF_NOT_SPECIFIED': 'Пожалуйста, укажите конкретного мастера для записи.',
      
      // Общие ошибки
      'Internal server error': 'Произошла внутренняя ошибка. Мы уже работаем над решением.',
      'Unknown error': 'Что-то пошло не так. Попробуйте еще раз.',
      'Database error': 'Ошибка при работе с данными. Попробуйте позже.',
      'Permission denied': 'У вас нет доступа к этой операции.',
      
      // Ошибки Redis/кэша
      'Redis connection failed': 'Проблема с кэшем. Операция может занять больше времени.',
      'Cache error': 'Временная проблема с быстродействием. Попробуйте еще раз.',
      
      // HTTP статусы
      '400': 'Неверный запрос. Проверьте введенные данные.',
      '401': 'Требуется авторизация. Пожалуйста, представьтесь.',
      '403': 'Доступ запрещен.',
      '404': 'Информация не найдена. Проверьте правильность данных.',
      '429': 'Слишком много запросов. Подождите немного.',
      '500': 'Ошибка сервера. Мы уже работаем над исправлением.',
      '502': 'Сервис временно недоступен. Попробуйте через минуту.',
      '503': 'Сервис на обслуживании. Попробуйте позже.',
      '504': 'Превышено время ожидания. Попробуйте еще раз.'
    };
    
    // Контекстные подсказки для определенных ошибок
    this.contextualHelp = {
      'занят': ['Могу предложить ближайшее свободное время', 'Хотите посмотреть другого мастера?'],
      'fully_booked': ['Давайте посмотрим следующий день?', 'Могу показать другого мастера'],
      'Invalid phone': ['Пример: +7 900 123-45-67', 'Или просто: 79001234567'],
      'Invalid date': ['Примеры: "завтра", "25 июля", "пятница"', 'Или конкретная дата: 25.07'],
      'Service not found': ['Попробуйте: "стрижка", "маникюр", "массаж"', 'Или скажите "покажи все услуги"']
    };
    
    // Фразы вежливости для разных типов ошибок
    this.politePhrases = {
      retry: 'Пожалуйста, попробуйте еще раз',
      apologize: 'Извините за неудобства',
      help: 'Чем еще могу помочь?',
      alternative: 'Давайте попробуем по-другому'
    };
  }
  
  /**
   * Получить user-friendly сообщение об ошибке
   * @param {Error|string} error - Ошибка или сообщение об ошибке
   * @param {Object} context - Дополнительный контекст
   * @returns {Object} - Объект с основным сообщением и дополнительными подсказками
   */
  getUserMessage(error, context = {}) {
    let errorKey = '';
    let technicalError = '';
    
    // Извлекаем ключ ошибки
    if (error instanceof Error) {
      technicalError = error.message;
      errorKey = error.code || error.message;
      
      // Проверяем HTTP статус
      if (error.response?.status) {
        errorKey = String(error.response.status);
      }
    } else if (typeof error === 'string') {
      technicalError = error;
      errorKey = error;
    }
    
    // Логируем техническую ошибку для отладки
    logger.debug('Translating error:', {
      technicalError,
      errorKey,
      context
    });
    
    // Ищем подходящее сообщение
    let userMessage = this.findBestMatch(errorKey);
    
    // Если не нашли точное совпадение, используем общее сообщение
    if (!userMessage) {
      userMessage = this.getGenericMessage(context);
    }
    
    // Добавляем контекстные подсказки
    const help = this.getContextualHelp(errorKey, context);
    
    // Формируем финальный результат
    const result = {
      message: userMessage,
      help: help,
      technical: technicalError, // Для логирования
      needsRetry: this.isRetryableError(errorKey),
      severity: this.getErrorSeverity(errorKey)
    };
    
    // Логируем результат
    logger.info('User-friendly error generated:', {
      original: technicalError,
      userMessage: result.message,
      hasHelp: help.length > 0
    });
    
    return result;
  }
  
  /**
   * Найти наиболее подходящее сообщение
   */
  findBestMatch(errorKey) {
    // Точное совпадение
    if (this.errorMap[errorKey]) {
      return this.errorMap[errorKey];
    }
    
    // Частичное совпадение (case-insensitive)
    const lowerKey = errorKey.toLowerCase();
    for (const [key, message] of Object.entries(this.errorMap)) {
      if (lowerKey.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerKey)) {
        return message;
      }
    }
    
    return null;
  }
  
  /**
   * Получить общее сообщение в зависимости от контекста
   */
  getGenericMessage(context) {
    if (context.operation === 'booking' || (context.operation === 'command_execution' && context.command === 'CREATE_BOOKING')) {
      return 'Не удалось создать запись. Давайте попробуем еще раз?';
    } else if (context.operation === 'search' || (context.operation === 'command_execution' && context.command === 'SEARCH_SLOTS')) {
      return 'Не удалось найти подходящие варианты. Уточните запрос.';
    } else if (context.operation === 'cancel' || (context.operation === 'command_execution' && context.command === 'CANCEL_BOOKING')) {
      return 'Не удалось отменить запись. Попробуйте позже или позвоните нам.';
    }
    
    return 'Что-то пошло не так. Давайте попробуем еще раз?';
  }
  
  /**
   * Получить контекстные подсказки
   */
  getContextualHelp(errorKey, context) {
    const helps = [];
    
    // Проверяем по точному ключу
    if (this.contextualHelp[errorKey]) {
      helps.push(...this.contextualHelp[errorKey]);
    }
    
    // Проверяем по частичному совпадению
    const lowerKey = errorKey.toLowerCase();
    for (const [key, suggestions] of Object.entries(this.contextualHelp)) {
      if (lowerKey.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerKey)) {
        helps.push(...suggestions);
        break;
      }
    }
    
    // Добавляем контекстные подсказки
    if (context.operation === 'booking' && lowerKey.includes('занят')) {
      helps.push('Хотите, я покажу ближайшее свободное время?');
    }
    
    if (context.hasAlternatives) {
      helps.push('У меня есть другие варианты, хотите посмотреть?');
    }
    
    return helps;
  }
  
  /**
   * Определить, можно ли повторить операцию
   */
  isRetryableError(errorKey) {
    const retryableErrors = [
      'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENETUNREACH',
      '500', '502', '503', '504', '429',
      'временно недоступен', 'попробуйте позже'
    ];
    
    return retryableErrors.some(err => 
      errorKey.toLowerCase().includes(err.toLowerCase())
    );
  }
  
  /**
   * Определить серьезность ошибки
   */
  getErrorSeverity(errorKey) {
    if (errorKey.includes('занят') || errorKey.includes('недоступ')) {
      return 'low'; // Обычная ситуация
    } else if (errorKey.includes('ECONNREFUSED') || errorKey.includes('500')) {
      return 'high'; // Серьезная проблема
    }
    
    return 'medium';
  }
  
  /**
   * Форматировать полное сообщение для пользователя
   */
  formatUserResponse(errorResult, includeHelp = true) {
    let response = errorResult.message;
    
    // Добавляем вежливую фразу в начало для серьезных ошибок
    if (errorResult.severity === 'high') {
      response = `${this.politePhrases.apologize}. ${response}`;
    }
    
    // Добавляем подсказки
    if (includeHelp && errorResult.help.length > 0) {
      response += '\n\n' + errorResult.help.join('\n');
    }
    
    // Добавляем предложение повторить для временных ошибок
    if (errorResult.needsRetry) {
      response += `\n\n${this.politePhrases.retry}.`;
    }
    
    return response;
  }
}

// Экспортируем singleton
module.exports = new ErrorMessages();