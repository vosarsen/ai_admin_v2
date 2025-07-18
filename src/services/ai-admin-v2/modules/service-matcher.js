const logger = require('../../../utils/logger').child({ module: 'ai-admin-v2:service-matcher' });

class ServiceMatcher {
  /**
   * Интеллектуальный поиск услуги по запросу клиента
   * @param {string} query - Запрос клиента (например "стрижка", "подстричься")
   * @param {Array} services - Массив доступных услуг
   * @returns {Object|null} - Найденная услуга или null
   */
  findBestMatch(query, services) {
    if (!query || !services?.length) return null;
    
    const normalizedQuery = this.normalizeText(query);
    logger.debug('Searching for service', { query, normalizedQuery });
    
    // Создаем массив с оценками совпадения для каждой услуги
    const scoredServices = services.map(service => ({
      service,
      score: this.calculateMatchScore(normalizedQuery, service)
    }));
    
    // Сортируем по убыванию score
    scoredServices.sort((a, b) => b.score - a.score);
    
    // Логируем топ-5 для отладки
    logger.debug('Top 5 service matches:', 
      scoredServices.slice(0, 5).map(s => ({
        title: s.service.title,
        score: s.score
      }))
    );
    
    // Возвращаем лучшее совпадение если score > 0
    return scoredServices[0]?.score > 0 ? scoredServices[0].service : null;
  }
  
  /**
   * Нормализация текста для сравнения
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\wа-яё\s]/gi, ' ') // Убираем спецсимволы
      .replace(/\s+/g, ' ') // Множественные пробелы в один
      .trim();
  }
  
  /**
   * Расчет оценки совпадения
   */
  calculateMatchScore(query, service) {
    const serviceTitle = this.normalizeText(service.title);
    let score = 0;
    
    // 1. Точное совпадение = 100 баллов
    if (serviceTitle === query) {
      return 100;
    }
    
    // 2. Услуга содержит запрос = 80 баллов
    if (serviceTitle.includes(query)) {
      score += 80;
    }
    
    // 3. Запрос содержит услугу = 70 баллов
    if (query.includes(serviceTitle)) {
      score += 70;
    }
    
    // 4. Проверка по словам
    const queryWords = query.split(' ');
    const serviceWords = serviceTitle.split(' ');
    
    // Каждое слово из запроса найдено в услуге = +20 баллов
    queryWords.forEach(qWord => {
      if (serviceWords.some(sWord => sWord.includes(qWord) || qWord.includes(sWord))) {
        score += 20;
      }
    });
    
    // 5. Проверка синонимов и связанных слов
    score += this.checkSynonyms(query, serviceTitle);
    
    // 6. Штраф за слишком длинное название (вероятно комплексная услуга)
    if (serviceWords.length > 5) {
      score -= 20;
    }
    
    // Дополнительный штраф за услуги с "+"
    if (serviceTitle.includes('+')) {
      score -= 30; // Комплексная услуга
    }
    
    // Штраф за премиум-услуги
    if (serviceTitle.includes('luxina') || serviceTitle.includes('премиум') || serviceTitle.includes('vip')) {
      score -= 15;
    }
    
    // 7. Бонус за популярные услуги (если есть статистика)
    if (service.booking_count > 100) {
      score += 5;
    }
    
    return score;
  }
  
  /**
   * Проверка синонимов и связанных слов
   */
  checkSynonyms(query, serviceTitle) {
    let score = 0;
    
    // Словарь синонимов для beauty-индустрии
    const synonymGroups = [
      ['стрижка', 'подстричь', 'подстричься', 'постричь', 'постричься', 'стричь', 'стрич'],
      ['маникюр', 'ногти', 'ноготки', 'маник'],
      ['педикюр', 'педик', 'ноги', 'стопы'],
      ['окрашивание', 'покраска', 'красить', 'покрасить', 'цвет', 'краска', 'окраска'],
      ['укладка', 'уложить', 'прическа', 'причёска'],
      ['брови', 'бровки', 'бровей'],
      ['ресницы', 'реснички', 'ресниц'],
      ['эпиляция', 'депиляция', 'воск', 'шугаринг', 'удаление волос'],
      ['массаж', 'масаж', 'массажик'],
      ['косметология', 'косметолог', 'уход', 'чистка'],
      ['барбер', 'барбершоп', 'мужская', 'борода', 'бороды', 'усы']
    ];
    
    // Находим группу синонимов для запроса
    for (const group of synonymGroups) {
      const queryInGroup = group.some(synonym => 
        query.includes(synonym) || synonym.includes(query)
      );
      
      if (queryInGroup) {
        // Проверяем, есть ли в названии услуги слова из этой же группы
        const serviceInGroup = group.some(synonym => 
          serviceTitle.includes(synonym)
        );
        
        if (serviceInGroup) {
          score += 30; // Найдено соответствие по синонимам
          break;
        }
      }
    }
    
    return score;
  }
  
  /**
   * Поиск нескольких подходящих услуг
   * @param {string} query - Запрос клиента
   * @param {Array} services - Массив услуг
   * @param {number} limit - Максимальное количество результатов
   * @returns {Array} - Массив подходящих услуг
   */
  findTopMatches(query, services, limit = 3) {
    if (!query || !services?.length) return [];
    
    const normalizedQuery = this.normalizeText(query);
    
    // Создаем массив с оценками
    const scoredServices = services.map(service => ({
      service,
      score: this.calculateMatchScore(normalizedQuery, service)
    }));
    
    // Фильтруем только с положительным score и сортируем
    return scoredServices
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.service);
  }
}

module.exports = new ServiceMatcher();