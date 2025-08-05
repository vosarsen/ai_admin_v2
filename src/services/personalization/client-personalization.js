const logger = require('../../utils/logger');

/**
 * Сервис персонализации общения с клиентами
 * Использует историю визитов для создания персонального опыта
 */
class ClientPersonalizationService {
  constructor() {
    this.loyaltyThresholds = {
      VIP: 20,      // 20+ визитов
      Gold: 10,     // 10-19 визитов
      Silver: 5,    // 5-9 визитов
      Bronze: 2,    // 2-4 визита
      New: 0        // 0-1 визит
    };
  }

  /**
   * Анализировать клиента и вернуть персонализированный контекст
   */
  analyzeClient(client) {
    if (!client) {
      return {
        isNew: true,
        isVip: false,
        favoriteServices: [],
        favoriteMasters: [],
        visitPattern: null,
        daysSinceLastVisit: null,
        personalizationLevel: 'minimal'
      };
    }

    const analysis = {
      isNew: !client.visit_count || client.visit_count === 0,
      isVip: ['Gold', 'VIP'].includes(client.loyalty_level),
      favoriteServices: this.analyzeFavoriteServices(client),
      favoriteMasters: this.analyzeFavoriteMasters(client),
      visitPattern: this.analyzeVisitPattern(client),
      daysSinceLastVisit: this.calculateDaysSince(client.last_visit_date),
      averageVisitInterval: this.calculateAverageInterval(client),
      personalizationLevel: this.determinePersonalizationLevel(client),
      clientValue: this.calculateClientValue(client)
    };

    return analysis;
  }

  /**
   * Получить персонализированное приветствие
   */
  getGreeting(client, analysis = null) {
    if (!analysis) {
      analysis = this.analyzeClient(client);
    }

    // Новый клиент
    if (analysis.isNew) {
      return {
        text: "Здравствуйте! Рад приветствовать вас в нашем барбершопе! Чем могу помочь?",
        type: 'new_client'
      };
    }

    // Давно не был (более 60 дней)
    if (analysis.daysSinceLastVisit > 60) {
      return {
        text: `Здравствуйте, ${client.name || 'дорогой клиент'}! Давно не виделись - с ${this.formatDate(client.last_visit_date)}! Рады что вы снова с нами.`,
        type: 'returning_after_long'
      };
    }

    // VIP клиент
    if (analysis.isVip) {
      return {
        text: `Добро пожаловать, ${client.name || 'наш VIP клиент'}! Ваш ${client.loyalty_level} статус дает приоритет в записи. Подобрать удобное время?`,
        type: 'vip_client'
      };
    }

    // Регулярный клиент
    if (client.visit_count > 5) {
      const masterText = analysis.favoriteMasters.length > 0 
        ? ` Записать как обычно к ${analysis.favoriteMasters[0].name}?`
        : ' Чем могу помочь?';
      
      return {
        text: `Здравствуйте, ${client.name || 'дорогой клиент'}! Рад снова вас видеть!${masterText}`,
        type: 'regular_client'
      };
    }

    // Обычное приветствие
    return {
      text: `Здравствуйте${client.name ? ', ' + client.name : ''}! Чем могу помочь?`,
      type: 'standard'
    };
  }

  /**
   * Получить рекомендации услуг
   */
  getServiceRecommendations(client, analysis = null) {
    if (!analysis) {
      analysis = this.analyzeClient(client);
    }

    const recommendations = [];

    // Рекомендации на основе любимых услуг
    if (analysis.favoriteServices.length > 0) {
      const topService = analysis.favoriteServices[0];
      
      if (topService.percentage > 70) {
        // Клиент всегда берет одну услугу
        recommendations.push({
          type: 'usual_service',
          priority: 1,
          text: `Записать вас на ${topService.name} как обычно?`,
          service: topService.name
        });
      } else if (analysis.favoriteServices.length > 1) {
        // Клиент чередует услуги
        const services = analysis.favoriteServices
          .slice(0, 3)
          .map(s => s.name)
          .join(', ');
        
        recommendations.push({
          type: 'service_choice',
          priority: 1,
          text: `Что будем делать сегодня - ${services}?`,
          services: analysis.favoriteServices.slice(0, 3)
        });
      }
    }

    // Рекомендации по времени с последнего визита
    if (analysis.averageVisitInterval && analysis.daysSinceLastVisit) {
      if (analysis.daysSinceLastVisit >= analysis.averageVisitInterval * 0.9) {
        recommendations.push({
          type: 'time_for_visit',
          priority: 2,
          text: `Прошло ${analysis.daysSinceLastVisit} дней с последнего визита - пора обновить стрижку!`
        });
      }
    }

    // Комплексные предложения для премиум клиентов
    if (client.average_bill > 2000) {
      recommendations.push({
        type: 'premium_offer',
        priority: 3,
        text: 'Могу предложить комплекс "Стрижка + Борода + Уход" со скидкой 10%'
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Получить рекомендации мастеров
   */
  getMasterRecommendations(client, analysis = null) {
    if (!analysis) {
      analysis = this.analyzeClient(client);
    }

    const recommendations = [];

    if (analysis.favoriteMasters.length > 0) {
      const topMaster = analysis.favoriteMasters[0];
      
      if (topMaster.percentage > 70) {
        // Есть явный любимый мастер
        recommendations.push({
          type: 'favorite_master',
          text: `Записать к вашему мастеру ${topMaster.name}?`,
          master: topMaster.name,
          confidence: 'high'
        });
      } else if (analysis.favoriteMasters.length > 1) {
        // Несколько предпочитаемых мастеров
        const masters = analysis.favoriteMasters
          .slice(0, 2)
          .map(m => m.name)
          .join(' или ');
        
        recommendations.push({
          type: 'master_choice',
          text: `К кому записать - к ${masters}?`,
          masters: analysis.favoriteMasters.slice(0, 2),
          confidence: 'medium'
        });
      }
    }

    return recommendations;
  }

  /**
   * Анализировать любимые услуги
   */
  analyzeFavoriteServices(client) {
    if (!client.visit_history || client.visit_history.length === 0) {
      return [];
    }

    const serviceCounts = {};
    
    client.visit_history.forEach(visit => {
      if (visit.services && Array.isArray(visit.services)) {
        visit.services.forEach(service => {
          serviceCounts[service] = (serviceCounts[service] || 0) + 1;
        });
      }
    });

    const totalVisits = client.visit_history.length;
    
    return Object.entries(serviceCounts)
      .map(([service, count]) => ({
        name: service,
        count: count,
        percentage: Math.round((count / totalVisits) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Анализировать любимых мастеров
   */
  analyzeFavoriteMasters(client) {
    if (!client.visit_history || client.visit_history.length === 0) {
      return [];
    }

    const masterCounts = {};
    
    client.visit_history.forEach(visit => {
      if (visit.staff) {
        masterCounts[visit.staff] = (masterCounts[visit.staff] || 0) + 1;
      }
    });

    const totalVisits = client.visit_history.length;
    
    return Object.entries(masterCounts)
      .map(([master, count]) => ({
        name: master,
        count: count,
        percentage: Math.round((count / totalVisits) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Анализировать паттерн визитов
   */
  analyzeVisitPattern(client) {
    if (!client.visit_history || client.visit_history.length < 2) {
      return null;
    }

    const visits = client.visit_history
      .map(v => new Date(v.date))
      .sort((a, b) => a - b);

    const timePreferences = {
      morning: 0,    // 9-12
      afternoon: 0,  // 12-17
      evening: 0,    // 17-21
      weekday: 0,
      weekend: 0
    };

    visits.forEach(date => {
      const hour = date.getHours();
      const dayOfWeek = date.getDay();

      if (hour >= 9 && hour < 12) timePreferences.morning++;
      else if (hour >= 12 && hour < 17) timePreferences.afternoon++;
      else if (hour >= 17 && hour < 21) timePreferences.evening++;

      if (dayOfWeek >= 1 && dayOfWeek <= 5) timePreferences.weekday++;
      else timePreferences.weekend++;
    });

    return timePreferences;
  }

  /**
   * Рассчитать дни с последнего визита
   */
  calculateDaysSince(lastVisitDate) {
    if (!lastVisitDate) return null;
    
    const last = new Date(lastVisitDate);
    const now = new Date();
    const diffTime = Math.abs(now - last);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Рассчитать средний интервал между визитами
   */
  calculateAverageInterval(client) {
    if (!client.visit_history || client.visit_history.length < 2) {
      return null;
    }

    const dates = client.visit_history
      .map(v => new Date(v.date))
      .sort((a, b) => a - b);

    let totalDays = 0;
    for (let i = 1; i < dates.length; i++) {
      const diff = dates[i] - dates[i-1];
      totalDays += diff / (1000 * 60 * 60 * 24);
    }

    return Math.round(totalDays / (dates.length - 1));
  }

  /**
   * Определить уровень персонализации
   */
  determinePersonalizationLevel(client) {
    if (!client || !client.visit_count) return 'minimal';
    
    if (client.visit_count >= 10) return 'high';
    if (client.visit_count >= 5) return 'medium';
    if (client.visit_count >= 2) return 'low';
    
    return 'minimal';
  }

  /**
   * Рассчитать ценность клиента
   */
  calculateClientValue(client) {
    if (!client) return 'unknown';
    
    const factors = {
      visits: client.visit_count || 0,
      totalSpent: client.total_spent || 0,
      averageBill: client.average_bill || 0,
      loyalty: this.loyaltyLevelToScore(client.loyalty_level)
    };

    const score = 
      (factors.visits * 10) +
      (factors.totalSpent / 100) +
      (factors.averageBill / 10) +
      (factors.loyalty * 20);

    if (score > 1000) return 'premium';
    if (score > 500) return 'high';
    if (score > 200) return 'medium';
    return 'standard';
  }

  /**
   * Конвертировать уровень лояльности в числовой score
   */
  loyaltyLevelToScore(level) {
    const scores = {
      'VIP': 5,
      'Gold': 4,
      'Silver': 3,
      'Bronze': 2,
      'New': 1
    };
    return scores[level] || 1;
  }

  /**
   * Форматировать дату для отображения
   */
  formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options = { day: 'numeric', month: 'long' };
    return date.toLocaleDateString('ru-RU', options);
  }

  /**
   * Получить специальные предложения для клиента
   */
  getSpecialOffers(client, analysis = null) {
    if (!analysis) {
      analysis = this.analyzeClient(client);
    }

    const offers = [];

    // Юбилейный визит
    if (client.visit_count && [10, 20, 50, 100].includes(client.visit_count + 1)) {
      offers.push({
        type: 'milestone_visit',
        text: `Следующий визит будет ${client.visit_count + 1}-м! Скидка 20% в честь юбилея!`,
        discount: 20
      });
    }

    // Реактивация
    if (analysis.daysSinceLastVisit > 90) {
      offers.push({
        type: 'reactivation',
        text: 'Мы скучали! Специально для вас скидка 15% на возвращение',
        discount: 15
      });
    }

    // VIP предложения
    if (analysis.isVip) {
      offers.push({
        type: 'vip_privilege',
        text: `Для ${client.loyalty_level} клиентов - приоритетная запись и персональные условия`,
        priority: true
      });
    }

    return offers;
  }
}

module.exports = ClientPersonalizationService;