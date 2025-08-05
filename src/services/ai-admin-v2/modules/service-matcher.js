const logger = require('../../../utils/logger').child({ module: 'ai-admin-v2:service-matcher' });
const config = require('../config/modules-config');

/**
 * @typedef {Object} Service
 * @property {number} id - Service ID
 * @property {string} title - Service title
 * @property {number} price - Service price
 * @property {string} [category] - Service category
 * @property {string} [comment] - Service comment
 * @property {number} [booking_count] - Number of bookings
 */

/**
 * @typedef {Object} ScoredService
 * @property {Service} service - Service object
 * @property {number} score - Match score
 */

/**
 * @typedef {Object} ScoreComponent
 * @property {string} rule - Scoring rule name
 * @property {number} points - Points awarded
 */

/**
 * @typedef {Object} ScoreDetails
 * @property {string} service - Service title
 * @property {string} normalizedTitle - Normalized title
 * @property {string} query - Search query
 * @property {ScoreComponent[]} components - Score components
 * @property {number} [totalScore] - Total score
 */

class ServiceMatcher {
  /**
   * Интеллектуальный поиск услуги по запросу клиента
   * @param {string} query - Запрос клиента (например "стрижка", "подстричься")
   * @param {Service[]} services - Массив доступных услуг
   * @returns {Service|null} - Найденная услуга или null
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
    
    // Логируем топ совпадений для отладки с полными деталями
    logger.info(`Top ${config.serviceMatcher.topMatchesLimit} service matches for query:`, query);
    scoredServices.slice(0, config.serviceMatcher.topMatchesLimit).forEach((item, index) => {
      logger.info(`  ${index + 1}. "${item.service.title}" - Score: ${item.score}`);
    });
    
    // Возвращаем лучшее совпадение если score > 0
    return scoredServices[0]?.score > 0 ? scoredServices[0].service : null;
  }
  
  /**
   * Нормализация текста для сравнения
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
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
   * @param {string} query - Normalized query
   * @param {Service} service - Service to match
   * @returns {number} Match score
   */
  calculateMatchScore(query, service) {
    const serviceTitle = this.normalizeText(service.title);
    let score = 0;
    
    // Подробное логирование для отладки
    const scoreDetails = {
      service: service.title,
      normalizedTitle: serviceTitle,
      query: query,
      components: []
    };
    
    // 1. Точное совпадение (максимальный приоритет)
    if (serviceTitle === query) {
      const exactScore = config.serviceMatcher.scoring.exactMatch;
      scoreDetails.components.push({ rule: 'exact_match', points: exactScore });
      scoreDetails.totalScore = exactScore;
      logger.info('Service match details:', scoreDetails);
      return exactScore;
    }
    
    // Разбиваем на слова для последующих проверок
    const queryWords = query.split(' ');
    const serviceWords = serviceTitle.split(' ');
    
    // 2. Проверка, что все слова запроса есть в названии услуги
    const significantQueryWords = queryWords.filter(w => w.length > config.serviceMatcher.thresholds.minWordLength);
    const allQueryWordsInService = significantQueryWords.length > 1 && 
      significantQueryWords.every(qWord => 
        serviceWords.some(sWord => sWord.includes(qWord))
      );
    
    if (allQueryWordsInService) {
      const allWordsScore = config.serviceMatcher.scoring.allWordsMatch;
      score += allWordsScore;
      scoreDetails.components.push({ rule: 'all_words_match', points: allWordsScore });
    }
    
    // 3. Услуга содержит запрос
    if (serviceTitle.includes(query)) {
      const containsScore = config.serviceMatcher.scoring.titleContainsQuery;
      score += containsScore;
      scoreDetails.components.push({ rule: 'title_contains_query', points: containsScore });
    }
    
    // 4. Запрос содержит услугу
    if (query.includes(serviceTitle)) {
      const containsScore = config.serviceMatcher.scoring.queryContainsTitle;
      score += containsScore;
      scoreDetails.components.push({ rule: 'query_contains_title', points: containsScore });
    }
    
    // Каждое слово из запроса найдено в услуге
    let wordMatchCount = 0;
    const wordMatchScore = config.serviceMatcher.scoring.wordMatch;
    queryWords.forEach(qWord => {
      if (serviceWords.some(sWord => sWord.includes(qWord) || qWord.includes(sWord))) {
        score += wordMatchScore;
        wordMatchCount++;
      }
    });
    if (wordMatchCount > 0) {
      scoreDetails.components.push({ rule: 'word_matches', points: wordMatchScore * wordMatchCount, count: wordMatchCount });
    }
    
    // 5. Проверка синонимов и связанных слов
    const synonymScore = this.checkSynonyms(query, serviceTitle);
    if (synonymScore > 0) {
      score += synonymScore;
      scoreDetails.components.push({ rule: 'synonyms', points: synonymScore });
    }
    
    // 6. Штраф за слишком длинное название (вероятно комплексная услуга)
    if (serviceWords.length > 5) {
      score -= 20;
      scoreDetails.components.push({ rule: 'long_title_penalty', points: -20, words: serviceWords.length });
    }
    
    // Дополнительный штраф за услуги с "+"
    const plusCount = (service.title.match(/\+/g) || []).length; // Используем оригинальный title для подсчета +
    if (plusCount > 0) {
      const penalty = -30 * plusCount;
      score += penalty; // Изменено с -= на +=, чтобы корректно добавить отрицательное значение
      scoreDetails.components.push({ rule: 'complex_service_penalty', points: penalty, plusCount });
    }
    
    // Бонус за простые базовые услуги
    if (serviceWords.length <= 2 && !service.title.includes('+')) {
      score += 25;
      scoreDetails.components.push({ rule: 'simple_service_bonus', points: 25 });
    }
    
    // Штраф за премиум-услуги
    if (serviceTitle.includes('luxina') || serviceTitle.includes('премиум') || serviceTitle.includes('vip')) {
      score -= 15;
      scoreDetails.components.push({ rule: 'premium_penalty', points: -15 });
    }
    
    // 7. Бонус за популярные услуги (если есть статистика)
    if (service.booking_count > 100) {
      score += 5;
      scoreDetails.components.push({ rule: 'popular_bonus', points: 5, bookings: service.booking_count });
    }
    
    scoreDetails.totalScore = score;
    
    // Логируем только для услуг с высоким score или содержащих ключевые слова
    if (score > 50 || serviceTitle.includes(query)) {
      logger.info('Service match details:', scoreDetails);
    }
    
    return score;
  }
  
  /**
   * Проверка синонимов и связанных слов
   * @param {string} query - Search query
   * @param {string} serviceTitle - Service title
   * @returns {number} Synonym match score
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
   * @param {Service[]} services - Массив услуг
   * @param {number} [limit=3] - Максимальное количество результатов
   * @returns {Service[]} - Массив подходящих услуг
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