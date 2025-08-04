const logger = require('../../../utils/logger').child({ module: 'message-processor' });

/**
 * Модуль для разделения processMessage на более мелкие методы
 */
class MessageProcessor {
  constructor(dataLoader, contextService, intermediateContext) {
    this.dataLoader = dataLoader;
    this.contextService = contextService;
    this.intermediateContext = intermediateContext;
  }

  /**
   * Обработка ожидающей отмены записи
   */
  async handlePendingCancellation(message, phone, companyId, redisContext) {
    const selectedNumber = parseInt(message.trim());
    
    if (!isNaN(selectedNumber) && 
        selectedNumber > 0 && 
        selectedNumber <= redisContext.pendingCancellation.length) {
      
      // Получаем выбранную запись
      const selectedBooking = redisContext.pendingCancellation[selectedNumber - 1];
      
      // Импортируем bookingService здесь, чтобы избежать циклических зависимостей
      const { bookingService } = require('../../booking');
      
      // Отменяем запись
      const cancelResult = await bookingService.cancelBooking(selectedBooking.id, companyId);
      
      // Очищаем состояние ожидания
      delete redisContext.pendingCancellation;
      await this.contextService.setContext(phone.replace('@c.us', ''), redisContext);
      
      if (cancelResult.success) {
        return {
          handled: true,
          response: `✅ Запись успешно отменена!\n\n${selectedBooking.date} в ${selectedBooking.time}\n${selectedBooking.services}\nМастер: ${selectedBooking.staff}\n\nЕсли захотите записаться снова - обращайтесь! 😊`
        };
      } else {
        return {
          handled: true,
          response: `❌ Не удалось отменить запись: ${cancelResult.error}\n\nПопробуйте позже или свяжитесь с администратором.`
        };
      }
    }
    
    // Если ввели не номер - очищаем состояние и продолжаем
    delete redisContext.pendingCancellation;
    await this.contextService.setContext(phone.replace('@c.us', ''), redisContext);
    
    return { handled: false };
  }

  /**
   * Проверка и ожидание завершения предыдущей обработки
   */
  async checkAndWaitForPreviousProcessing(phone) {
    const intermediate = await this.intermediateContext.getIntermediateContext(phone);
    
    if (intermediate && intermediate.isRecent && intermediate.processingStatus === 'started') {
      logger.info('Found recent processing, waiting for completion...');
      
      const waitResult = await this.intermediateContext.waitForCompletion(phone, 3000);
      
      if (!waitResult) {
        logger.warn('Previous message still processing after 3s, continuing anyway');
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Загрузка контекста с учетом различных источников
   */
  async loadContext(phone, companyId) {
    const startTime = Date.now();
    
    // Отмечаем начало обработки
    await this.intermediateContext.setProcessingStatus(phone, 'started');
    
    // Загружаем полный контекст
    const context = await this.dataLoader.loadFullContext(phone, companyId);
    
    logger.info(`Context loaded in ${Date.now() - startTime}ms`, {
      hasCompany: !!context.company,
      hasClient: !!context.client,
      servicesCount: context.services?.length || 0,
      staffCount: context.staff?.length || 0
    });
    
    return context;
  }

  /**
   * Сохранение контекста после обработки
   */
  async saveContext(context, phone, aiResponse, executedCommands) {
    // Сохраняем контекст
    await this.dataLoader.saveContext(context);
    
    // Обновляем промежуточный контекст
    await this.intermediateContext.updateAfterAIAnalysis(phone, aiResponse, executedCommands || []);
    
    // Отмечаем завершение обработки
    await this.intermediateContext.setProcessingStatus(phone, 'completed');
  }

  /**
   * Обработка ошибок с правильным форматированием
   */
  formatErrorResponse(error, context) {
    const baseMessage = 'Извините, произошла ошибка. Попробуйте еще раз или позвоните нам напрямую.';
    
    // Проверяем тип ошибки
    if (error.code === 'BOOKING_ERROR' || error.message?.includes('запись')) {
      return 'Не удалось создать запись. Попробуйте выбрать другое время или позвоните нам.';
    }
    
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('network')) {
      return 'Проблема с подключением. Попробуйте еще раз через несколько секунд.';
    }
    
    return baseMessage;
  }

  /**
   * Определение нужно ли инвалидировать кэш
   */
  shouldInvalidateCache(executedCommands) {
    const cacheInvalidatingCommands = [
      'CREATE_BOOKING',
      'CANCEL_BOOKING',
      'RESCHEDULE_BOOKING',
      'SAVE_CLIENT_NAME'
    ];
    
    return executedCommands.some(cmd => 
      cacheInvalidatingCommands.includes(cmd.command)
    );
  }
}

module.exports = MessageProcessor;