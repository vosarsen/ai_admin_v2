/**
 * Обработчик условных ответов AI
 * Парсит и обрабатывает условные блоки в ответах AI
 */

const logger = require('../../../utils/logger').child({ module: 'conditional-response-processor' });

class ConditionalResponseProcessor {
  /**
   * Обработка условного ответа на основе результатов команд
   */
  async processConditionalResponse(aiResponse, commandResults, context) {
    logger.info('Processing conditional response');
    
    // Проверяем есть ли условные блоки
    if (!this.hasConditionalBlocks(aiResponse)) {
      logger.debug('No conditional blocks found, returning original response');
      return aiResponse;
    }
    
    // Извлекаем параметры проверки
    const checkTime = this.extractCheckTime(aiResponse);
    if (!checkTime) {
      logger.warn('CHECK_TIME not found in conditional response');
      return aiResponse;
    }
    
    logger.info(`Checking availability for time: ${checkTime}`);
    
    // Находим результаты SEARCH_SLOTS
    const slotsResult = commandResults.find(r => r.type === 'slots');
    if (!slotsResult || !slotsResult.data) {
      logger.error('No slots data found in command results');
      return this.extractBlock(aiResponse, 'IF_NOT_AVAILABLE');
    }
    
    // Проверяем доступность времени
    const isAvailable = this.checkTimeAvailability(checkTime, slotsResult.data);
    logger.info(`Time ${checkTime} is ${isAvailable ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
    
    // Выбираем нужный блок
    let finalResponse;
    if (isAvailable) {
      finalResponse = this.extractBlock(aiResponse, 'IF_AVAILABLE');
    } else {
      finalResponse = this.extractBlock(aiResponse, 'IF_NOT_AVAILABLE');
      // Подставляем ближайшие слоты
      const nearestSlots = this.findNearestSlots(checkTime, slotsResult.data);
      finalResponse = finalResponse.replace('{NEAREST_SLOTS}', nearestSlots.join(', '));
    }
    
    // Удаляем условные блоки и метаданные
    finalResponse = this.cleanupConditionalBlocks(finalResponse);
    
    logger.info('Conditional response processed successfully');
    return finalResponse;
  }
  
  /**
   * Проверка наличия условных блоков
   */
  hasConditionalBlocks(response) {
    return response.includes('{IF_AVAILABLE:') || response.includes('{IF_NOT_AVAILABLE:');
  }
  
  /**
   * Извлечение времени для проверки
   */
  extractCheckTime(response) {
    const match = response.match(/\{CHECK_TIME:\s*(\d{1,2}:\d{2})\}/);
    return match ? match[1] : null;
  }
  
  /**
   * Проверка доступности времени в списке слотов
   */
  checkTimeAvailability(requestedTime, slots) {
    // Нормализуем время к формату HH:MM
    const normalizedTime = this.normalizeTime(requestedTime);
    
    // Проверяем наличие в списке слотов
    return slots.some(slot => {
      const slotTime = slot.time || (slot.datetime ? slot.datetime.split('T')[1]?.substring(0, 5) : null);
      return this.normalizeTime(slotTime) === normalizedTime;
    });
  }
  
  /**
   * Нормализация времени к формату HH:MM
   */
  normalizeTime(time) {
    if (!time) return null;
    
    // Убираем секунды если есть
    let normalized = time.split(':').slice(0, 2).join(':');
    
    // Добавляем ведущий ноль если нужно
    if (normalized.length === 4) {
      normalized = '0' + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Извлечение условного блока
   */
  extractBlock(response, blockName) {
    const regex = new RegExp(`\\{${blockName}:\\s*([^}]+)\\}`, 's');
    const match = response.match(regex);
    
    if (match) {
      return match[1].trim();
    }
    
    // Если блок не найден, возвращаем весь ответ без условных блоков
    return this.cleanupConditionalBlocks(response);
  }
  
  /**
   * Поиск ближайших доступных слотов
   */
  findNearestSlots(targetTime, slots, count = 3) {
    const targetMinutes = this.timeToMinutes(targetTime);
    
    // Сортируем слоты по близости к запрошенному времени
    const sortedSlots = slots
      .map(slot => {
        const slotTime = slot.time || (slot.datetime ? slot.datetime.split('T')[1]?.substring(0, 5) : null);
        const slotMinutes = this.timeToMinutes(slotTime);
        const diff = Math.abs(slotMinutes - targetMinutes);
        return { time: slotTime, diff };
      })
      .filter(s => s.time)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, count);
    
    return sortedSlots.map(s => s.time);
  }
  
  /**
   * Конвертация времени в минуты
   */
  timeToMinutes(time) {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  /**
   * Очистка условных блоков из ответа
   */
  cleanupConditionalBlocks(response) {
    // Удаляем все условные блоки
    let cleaned = response;
    
    // Удаляем CHECK_TIME
    cleaned = cleaned.replace(/\{CHECK_TIME:[^}]+\}/g, '');
    
    // Удаляем IF_AVAILABLE и IF_NOT_AVAILABLE блоки
    cleaned = cleaned.replace(/\{IF_AVAILABLE:[^}]+\}/g, '');
    cleaned = cleaned.replace(/\{IF_NOT_AVAILABLE:[^}]+\}/g, '');
    
    // Удаляем пустые строки
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();
    
    return cleaned;
  }
}

module.exports = new ConditionalResponseProcessor();