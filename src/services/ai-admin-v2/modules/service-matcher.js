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
    
    // 4. Проверка на полное совпадение названия
    if (query === serviceTitle) {
      const exactMatchScore = 200; // Большой бонус за точное совпадение
      score += exactMatchScore;
      scoreDetails.components.push({ rule: 'exact_match', points: exactMatchScore });
    }
    // Проверка на вхождение полного названия услуги в запрос
    else if (query.includes(serviceTitle)) {
      const containsFullScore = 150; // Большой бонус если запрос содержит полное название
      score += containsFullScore;
      scoreDetails.components.push({ rule: 'query_contains_full_title', points: containsFullScore });
    }
    // Проверка на вхождение запроса в название услуги
    else if (serviceTitle.includes(query)) {
      const containsScore = config.serviceMatcher.scoring.queryContainsTitle || 100;
      score += containsScore;
      scoreDetails.components.push({ rule: 'title_contains_full_query', points: containsScore });
    }

    // Специальная проверка для ключевых фраз
    const keyPhrases = [
      { phrase: 'для студентов', bonus: 100 },
      { phrase: 'для школьников', bonus: 100 },
      { phrase: 'студентов и школьников', bonus: 120 },
      { phrase: 'счастливые часы', bonus: 80 },
      { phrase: 'утро', bonus: 50 },
      { phrase: 'день', bonus: 50 },
      { phrase: 'вечер', bonus: 50 }
    ];

    for (const { phrase, bonus } of keyPhrases) {
      if (query.includes(phrase) && serviceTitle.includes(phrase)) {
        score += bonus;
        scoreDetails.components.push({ rule: 'key_phrase_match', phrase, points: bonus });
        break; // Применяем только один бонус за ключевую фразу
      }
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
    if (serviceWords.length > config.serviceMatcher.thresholds.longTitleWords) {
      const penalty = config.serviceMatcher.scoring.longTitlePenalty;
      score += penalty;
      scoreDetails.components.push({ rule: 'long_title_penalty', points: penalty, words: serviceWords.length });
    }
    
    // Специальная логика для слова "комплекс"
    const isLookingForComplex = query.includes('комплекс') || query.includes('полный') || query.includes('все включено');
    const plusCount = (service.title.match(/\+/g) || []).length; // Используем оригинальный title для подсчета +
    
    if (isLookingForComplex) {
      // Когда ищут "комплекс", приоритизируем популярные комплексные услуги
      if (service.title.includes('СТРИЖКА') && service.title.includes('МОДЕЛИРОВАНИЕ') && service.title.includes('БОРОДЫ')) {
        // Максимальный приоритет для основной комплексной услуги
        const bonus = 200;
        score += bonus;
        scoreDetails.components.push({ rule: 'main_complex_service', points: bonus });
      } else if (plusCount > 0) {
        // БОНУС за другие комплексные услуги с "+"
        const bonus = 50 * plusCount; // +50 за каждый плюс
        score += bonus;
        scoreDetails.components.push({ rule: 'complex_service_bonus', points: bonus, plusCount });
      } else if (serviceTitle.includes('комплекс')) {
        // Средний бонус за услуги со словом "комплекс" в названии
        const bonus = 30;
        score += bonus;
        scoreDetails.components.push({ rule: 'has_complex_word', points: bonus });
      }
    } else if (!isLookingForComplex && plusCount > 0) {
      // Штраф за услуги с "+" когда НЕ ищут комплекс
      const penalty = config.serviceMatcher.scoring.complexServicePenalty * plusCount;
      score += penalty;
      scoreDetails.components.push({ rule: 'complex_service_penalty', points: penalty, plusCount });
    }
    
    // Бонус за простые базовые услуги
    // Исключаем служебные слова при подсчете
    const meaningfulWords = serviceWords.filter(word =>
      !['для', 'и', 'или', 'с', 'в', 'на', 'по', 'от', 'до'].includes(word)
    );

    if (meaningfulWords.length <= config.serviceMatcher.thresholds.maxSimpleServiceWords && !service.title.includes('+')) {
      const bonus = config.serviceMatcher.scoring.simpleServiceBonus;
      score += bonus;
      scoreDetails.components.push({ rule: 'simple_service_bonus', points: bonus });
    }
    
    // Штраф за премиум-услуги
    if (serviceTitle.includes('luxina') || serviceTitle.includes('премиум') || serviceTitle.includes('vip')) {
      const penalty = config.serviceMatcher.scoring.premiumPenalty;
      score += penalty;
      scoreDetails.components.push({ rule: 'premium_penalty', points: penalty });
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
    
    // Специальная проверка для детских услуг - высокий приоритет
    const childKeywords = ['ребенок', 'ребёнок', 'дети', 'сын', 'дочь', 'мальчик', 'девочка', 'школьник', 'подросток', 'ребенка', 'сына', 'дочку'];
    const hasChildKeyword = childKeywords.some(keyword => query.includes(keyword));
    const isChildService = serviceTitle.includes('детск');
    
    if (hasChildKeyword && isChildService) {
      // Большой бонус если упоминается ребенок и это детская услуга
      return 100;
    } else if (hasChildKeyword && !isChildService) {
      // Штраф если упоминается ребенок, но это НЕ детская услуга
      return -50;
    }
    
    // Расширенный словарь синонимов для барбершопа и beauty-индустрии
    const synonymGroups = [
      // Стрижки
      ['стрижка', 'подстричь', 'подстричься', 'постричь', 'постричься', 'стричь', 'стрич', 'подровнять', 'освежить'],
      
      // Детские услуги
      ['детская', 'детский', 'ребенок', 'ребёнок', 'дети', 'сын', 'дочь', 'мальчик', 'девочка', 'школьник', 'подросток'],
      
      // Борода и усы
      ['борода', 'бородка', 'бороды', 'моделирование', 'оформить', 'убрать', 'подровнять бороду', 'тримминг'],
      ['усы', 'усики', 'бакенбарды'],
      
      // Быстрые/дешевые услуги
      ['машинка', 'машинкой', 'быстро', 'экспресс', 'недорого', 'дешево', 'бюджетно', 'эконом', 'простая', 'обычная'],
      
      // Премиум услуги
      ['ножницы', 'ножницами', 'классическая', 'премиум', 'люкс', 'вип', 'luxina'],
      
      // Комплексные услуги
      ['комплекс', 'полный', 'все включено', 'всё включено', 'вместе', 'плюс', 'с бородой'],
      
      // Семейные
      ['отец', 'папа', 'батя', 'семейная', 'вместе с сыном'],
      
      // Счастливые часы
      ['акция', 'скидка', 'счастливые', 'выгодно', 'спецпредложение'],
      
      // Окрашивание/тонирование
      ['окрашивание', 'покраска', 'красить', 'покрасить', 'цвет', 'краска', 'окраска', 'тонирование', 'тонировка', 'камуфляж'],
      
      // Бритье
      ['бритье', 'побрить', 'бритва', 'выбрить', 'гладко'],
      
      // Общие beauty термины (оставляем для совместимости)
      ['маникюр', 'ногти', 'ноготки', 'маник'],
      ['педикюр', 'педик', 'ноги', 'стопы'],
      ['укладка', 'уложить', 'прическа', 'причёска'],
      ['брови', 'бровки', 'бровей'],
      ['ресницы', 'реснички', 'ресниц'],
      ['эпиляция', 'депиляция', 'воск', 'шугаринг', 'удаление волос'],
      ['массаж', 'масаж', 'массажик'],
      ['косметология', 'косметолог', 'уход', 'чистка'],
      
      // Общие термины барбершопа
      ['барбер', 'барбершоп', 'мужская', 'мужской', 'парикмахер', 'цирюльник']
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
          score += config.serviceMatcher.scoring.synonymMatch; // Найдено соответствие по синонимам
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
  
  /**
   * Поиск услуг с учетом персонализации
   * @param {string} query - Запрос клиента
   * @param {Service[]} services - Массив услуг
   * @param {Object} client - Информация о клиенте
   * @param {number} [limit=10] - Максимальное количество результатов
   * @returns {Service[]} - Массив услуг с персонализацией
   */
  findTopMatchesWithPersonalization(query, services, client, limit = 10) {
    if (!query || !services?.length) return [];
    
    logger.info('🎯 Personalized search activated:', {
      query,
      client_name: client?.name,
      visit_count: client?.visit_count || 0,
      has_visits: !!client?.visits,
      average_check: client?.average_check
    });
    
    const normalizedQuery = this.normalizeText(query);
    
    // Получаем базовые оценки
    const scoredServices = services.map(service => {
      const baseScore = this.calculateMatchScore(normalizedQuery, service);
      const personalizationBoost = this.calculatePersonalizationScore(service, client);
      const timeBoost = this.calculateTimeBasedScore(service);
      const genderPenalty = this.calculateGenderPenalty(service, client);
      
      return {
        ...service,
        base_score: baseScore,
        personalization_boost: personalizationBoost.score,
        personalization_reason: personalizationBoost.reason,
        time_boost: timeBoost.score,
        time_reason: timeBoost.reason,
        gender_penalty: genderPenalty,
        final_score: baseScore + personalizationBoost.score + timeBoost.score - genderPenalty
      };
    });
    
    // Логируем топ-3 услуги с персонализацией для отладки
    const top3 = scoredServices
      .filter(s => s.final_score > 0)
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, 3);

    logger.info('🏆 Top services with personalization:', {
      services: top3.map(s => ({
        title: s.title,
        base_score: s.base_score,
        personalization_boost: s.personalization_boost,
        time_boost: s.time_boost,
        gender_penalty: s.gender_penalty,
        final_score: s.final_score,
        reason: s.personalization_reason
      }))
    });

    // Фильтруем и сортируем
    return scoredServices
      .filter(s => s.final_score > 0)
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, limit);
  }
  
  /**
   * Рассчитать персонализированный бонус на основе истории клиента
   * @param {Service} service - Услуга
   * @param {Object} client - Информация о клиенте
   * @returns {{score: number, reason: string}} - Бонус и причина
   */
  calculatePersonalizationScore(service, client) {
    let score = 0;
    let reasons = [];
    
    if (!client) return { score: 0, reason: null };
    
    logger.debug('Calculating personalization for service:', {
      service: service.title,
      client_visits: client.visit_history?.length || 0,
      client_avg_check: client.average_bill || client.average_check
    });

    // 1. Любимые услуги (часто заказываемые)
    if (client.visit_history && client.visit_history.length > 0) {
      // Подсчитываем, сколько раз клиент заказывал услугу с похожим названием
      const serviceCount = client.visit_history.filter(v => {
        if (!v.services || !Array.isArray(v.services)) return false;
        const matches = v.services.some(serviceName => {
          const serviceNameNorm = this.normalizeText(serviceName);
          const serviceTitleNorm = this.normalizeText(service.title);
          const isMatch = serviceNameNorm.includes(serviceTitleNorm) || serviceTitleNorm.includes(serviceNameNorm);

          if (isMatch) {
            logger.debug(`Service match found: "${serviceName}" ~ "${service.title}"`);
          }
          return isMatch;
        });
        return matches;
      }).length;

      logger.info(`📊 Service frequency for "${service.title}": ${serviceCount}/${client.visit_history.length} visits`);

      if (serviceCount >= 3) {
        score += 100; // Большой бонус за частую услугу
        reasons.push(`часто заказываете (${serviceCount} раз)`);
        logger.info(`✅ Added 100 points for frequent service "${service.title}" (${serviceCount} times)`);
      } else if (serviceCount >= 1) {
        score += 30; // Средний бонус за знакомую услугу
        reasons.push('заказывали ранее');
        logger.info(`✅ Added 30 points for familiar service "${service.title}" (${serviceCount} times)`);
      }

      // Недавно заказанная услуга
      const lastVisit = client.visit_history
        .filter(v => {
          if (!v.services || !Array.isArray(v.services)) return false;
          return v.services.some(serviceName =>
            this.normalizeText(serviceName).includes(this.normalizeText(service.title)) ||
            this.normalizeText(service.title).includes(this.normalizeText(serviceName))
          );
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      
      if (lastVisit) {
        const daysSince = Math.floor((Date.now() - new Date(lastVisit.date)) / (1000 * 60 * 60 * 24));
        
        // Если прошло примерно месяц - время повторить
        if (daysSince >= 25 && daysSince <= 35) {
          score += 50;
          reasons.push('пора обновить стрижку');
        }
      }
    }
    
    // 2. Учет среднего чека
    const avgCheck = client.average_bill || client.average_check;
    if (avgCheck && avgCheck > 0) {
      const priceDiff = Math.abs(service.price_min - avgCheck);
      const priceRatio = priceDiff / avgCheck;
      
      // Бонус за услуги в привычном ценовом диапазоне
      if (priceRatio < 0.3) { // В пределах 30% от среднего чека
        score += 20;
        reasons.push('в вашем ценовом диапазоне');
      }
      // Штраф за слишком дорогие услуги
      else if (service.price_min > avgCheck * 2) {
        score -= 30;
        reasons.push('дороже обычного');
      }
    }
    
    // 3. Учет любимых услуг (если указаны явно)
    if (client.favorite_services && client.favorite_services.includes(service.id)) {
      score += 80;
      reasons.push('ваша любимая услуга');
    }
    
    // 4. Для родителей - бонус детским услугам
    if (client.visit_history && client.visit_history.some(v =>
      v.services && v.services.some(serviceName =>
        serviceName.toLowerCase().includes('детск')
      )
    )) {
      if (service.title.toLowerCase().includes('детск') || service.title.toLowerCase().includes('сын')) {
        score += 40;
        reasons.push('для вашего ребенка');
      }
    }
    
    return {
      score,
      reason: reasons.length > 0 ? reasons.join(', ') : null
    };
  }
  
  /**
   * Рассчитать бонус/штраф на основе времени суток и дня недели
   * @param {Service} service - Услуга
   * @returns {{score: number, reason: string}} - Бонус/штраф и причина
   */
  calculateTimeBasedScore(service) {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    
    let score = 0;
    let reasons = [];
    
    // Утреннее время (7-10) - предпочтение быстрым услугам
    if (hour >= 7 && hour < 10) {
      if (service.duration && service.duration <= 30) {
        score += 30;
        reasons.push('быстрая услуга для утра');
      }
      if (service.title.toLowerCase().includes('машинк') || service.title.toLowerCase().includes('экспресс')) {
        score += 20;
        reasons.push('экспресс для утра');
      }
      // Штраф для долгих услуг утром
      if (service.title.includes('+') || (service.duration && service.duration > 90)) {
        score -= 20;
        reasons.push('слишком долго для утра');
      }
    }
    
    // Вечер пятницы/субботы (17-21) - готовы на комплексные услуги
    if ((dayOfWeek === 5 || dayOfWeek === 6) && hour >= 17 && hour <= 21) {
      if (service.title.includes('+')) {
        score += 30;
        reasons.push('комплекс для выходных');
      }
      if (service.price >= 3500) {
        score += 15;
        reasons.push('премиум для вечера выходных');
      }
    }
    
    // Обеденное время (12-14) - быстрые услуги
    if (hour >= 12 && hour < 14) {
      if (service.duration && service.duration <= 45) {
        score += 20;
        reasons.push('успеете в обед');
      }
    }
    
    // Поздний вечер (после 20) - только быстрые
    if (hour >= 20) {
      if (service.duration && service.duration <= 30) {
        score += 25;
        reasons.push('быстро перед закрытием');
      }
      if (service.duration && service.duration > 60) {
        score -= 30;
        reasons.push('слишком поздно для долгой услуги');
      }
    }
    
    return {
      score,
      reason: reasons.length > 0 ? reasons.join(', ') : null
    };
  }
  
  /**
   * Рассчитать штраф за несоответствие полу клиента
   * @param {Service} service - Услуга
   * @param {Object} client - Информация о клиенте
   * @returns {number} - Штраф
   */
  calculateGenderPenalty(service, client) {
    if (!client || !client.gender) return 0;
    
    const serviceTitle = service.title.toLowerCase();
    let penalty = 0;
    
    // Для мужчин
    if (client.gender === 'male') {
      if (serviceTitle.includes('женск') || serviceTitle.includes('дамск')) {
        penalty = 100; // Большой штраф за женские услуги
      }
      if (serviceTitle.includes('маникюр') || serviceTitle.includes('педикюр')) {
        penalty = 50; // Средний штраф (некоторые мужчины делают)
      }
    }
    
    // Для женщин
    if (client.gender === 'female') {
      if (serviceTitle.includes('мужск') || serviceTitle.includes('барбер')) {
        penalty = 100; // Большой штраф за мужские услуги
      }
      if (serviceTitle.includes('борода') || serviceTitle.includes('усы')) {
        penalty = 150; // Очень большой штраф за услуги для бороды
      }
    }
    
    return penalty;
  }
  
  /**
   * Получить рекомендации на основе времени суток
   * @param {Service[]} services - Массив услуг
   * @returns {Service[]} - Отсортированные услуги
   */
  getTimeBasedRecommendations(services) {
    if (!services || services.length === 0) return [];
    
    // Добавляем временные бонусы к каждой услуге
    const servicesWithTimeScore = services.map(service => {
      const timeBoost = this.calculateTimeBasedScore(service);
      return {
        ...service,
        time_score: timeBoost.score,
        time_reason: timeBoost.reason
      };
    });
    
    // Сортируем по временному score
    return servicesWithTimeScore
      .sort((a, b) => b.time_score - a.time_score)
      .filter(s => s.time_score > 0);
  }
}

module.exports = new ServiceMatcher();