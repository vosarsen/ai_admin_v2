// src/services/ai/proactive-suggestions.js
const logger = require('../../utils/logger');
const smartCache = require('../cache/smart-cache');

/**
 * 🤖 PROACTIVE AI SUGGESTIONS
 * Проактивные предложения при отсутствии слотов
 * 
 * По ТЗ: AI всегда проактивен:
 * - Если запрошенное время занято - сразу предлагает 3 ближайших альтернативы
 * - Предлагает популярные услуги на основе истории клиента
 * - Напоминает о необходимости регулярных процедур
 * - Предлагает записаться к любимому мастеру
 * - Никогда не говорит "это время недоступно" без альтернатив
 */
class ProactiveSuggestions {
  constructor() {
    this.suggestionTemplates = {
      noSlots: [
        "К сожалению, это время уже занято. Но у меня есть отличные альтернативы:",
        "Это время недоступно, зато я нашел другие варианты:",
        "В это время мастер занят, но посмотрите эти варианты:"
      ],
      alternativeTime: [
        "• {time} - {staff_name} свободен",
        "• {time} у {staff_name}",
        "• {date} в {time} с {staff_name}"
      ],
      alternativeStaff: [
        "Можно записаться к {staff_name} - у него отличные отзывы (рейтинг {rating})",
        "{staff_name} тоже отлично делает {service} (рейтинг {rating})",
        "Рекомендую {staff_name} - наш топ-мастер (рейтинг {rating})"
      ],
      popularServices: [
        "Кстати, многие клиенты также заказывают {service}",
        "Популярная комбинация: {service1} + {service2}",
        "Часто вместе с {current_service} делают {additional_service}"
      ],
      clientHistory: [
        "В прошлый раз вы делали {service} у {staff_name}. Повторить?",
        "Обычно вы приходите в {preferred_time}. Есть время в {time}",
        "Ваш любимый мастер {staff_name} свободен завтра"
      ],
      urgentSlots: [
        "🔥 Горящий слот: {time} со скидкой 10%",
        "⚡ Освободилось время сегодня: {time}",
        "🎯 Последний свободный слот на завтра: {time}"
      ]
    };
  }

  /**
   * 🚀 Главный метод - генерация проактивных предложений
   */
  async generateSuggestions(context) {
    const { originalRequest, noSlotsReason, availableSlots, client, companyId } = context;
    
    logger.info('🤖 Generating proactive suggestions:', {
      reason: noSlotsReason,
      availableSlots: availableSlots?.length || 0,
      hasClientHistory: !!client?.last_services
    });

    const suggestions = {
      primary: null,
      alternatives: [],
      additional: [],
      urgent: []
    };

    try {
      // 1. Основное сообщение о недоступности
      suggestions.primary = this._generateNoSlotsMessage(noSlotsReason);

      // 2. Альтернативные времена и мастера
      if (availableSlots && availableSlots.length > 0) {
        suggestions.alternatives = await this._generateTimeAlternatives(
          availableSlots, 
          originalRequest,
          companyId
        );
      }

      // 3. Альтернативные мастера (если запрашивался конкретный)
      if (originalRequest.staff_id && originalRequest.staff_id !== 'any') {
        const staffAlternatives = await this._generateStaffAlternatives(
          originalRequest,
          companyId
        );
        suggestions.alternatives.push(...staffAlternatives);
      }

      // 4. Персонализированные предложения на основе истории
      if (client?.last_services || client?.favorite_staff_ids) {
        const personalizedSuggestions = await this._generatePersonalizedSuggestions(
          client,
          originalRequest,
          companyId
        );
        suggestions.additional.push(...personalizedSuggestions);
      }

      // 5. Популярные услуги и комбинации
      const popularSuggestions = await this._generatePopularSuggestions(
        originalRequest.service_id,
        companyId
      );
      suggestions.additional.push(...popularSuggestions);

      // 6. Горящие предложения
      const urgentSuggestions = await this._generateUrgentSuggestions(
        originalRequest,
        companyId
      );
      suggestions.urgent.push(...urgentSuggestions);

      logger.info('✅ Generated suggestions:', {
        primary: !!suggestions.primary,
        alternatives: suggestions.alternatives.length,
        additional: suggestions.additional.length,
        urgent: suggestions.urgent.length
      });

      return suggestions;

    } catch (error) {
      logger.error('Error generating proactive suggestions:', error);
      
      // Fallback к простому сообщению
      return {
        primary: "К сожалению, это время недоступно. Попробуйте выбрать другое время.",
        alternatives: [],
        additional: [],
        urgent: []
      };
    }
  }

  /**
   * 📝 Форматирование предложений в текст для отправки
   */
  formatSuggestionsAsText(suggestions) {
    const parts = [];

    // Основное сообщение
    if (suggestions.primary) {
      parts.push(suggestions.primary);
    }

    // Альтернативы (максимум 3)
    if (suggestions.alternatives.length > 0) {
      parts.push('');
      suggestions.alternatives.slice(0, 3).forEach(alt => {
        parts.push(alt);
      });
    }

    // Дополнительные предложения (максимум 2)
    if (suggestions.additional.length > 0) {
      parts.push('');
      suggestions.additional.slice(0, 2).forEach(add => {
        parts.push(add);
      });
    }

    // Горящие предложения (максимум 1)
    if (suggestions.urgent.length > 0) {
      parts.push('');
      parts.push(suggestions.urgent[0]);
    }

    return parts.join('\n');
  }

  /**
   * 🔍 Анализ причин недоступности и адаптация сообщения
   */
  _generateNoSlotsMessage(reason) {
    const templates = this.suggestionTemplates.noSlots;
    
    switch (reason) {
      case 'staff_busy':
        return "Мастер в это время занят, но у меня есть отличные альтернативы:";
      case 'service_unavailable':
        return "Эта услуга недоступна в выбранное время, но есть другие варианты:";
      case 'no_working_hours':
        return "Салон в это время не работает, но могу предложить:";
      case 'fully_booked':
        return "К сожалению, на это время все места заняты. Но у меня есть альтернативы:";
      case 'no_slots':
        return "К сожалению, не нашлось подходящих слотов. Давайте попробуем другие варианты:";
      
      case 'no_matching_time':
        return `К сожалению, не нашлось свободных слотов ${searchDetails.timePreference || 'на указанное время'}. Но у меня есть другие предложения:`;
      default:
        return this._getRandomTemplate(templates);
    }
  }

  /**
   * ⏰ Генерация альтернативных времен
   */
  async _generateTimeAlternatives(availableSlots, originalRequest, companyId) {
    const alternatives = [];
    const template = this.suggestionTemplates.alternativeTime;

    // Сортируем слоты по близости к запрашиваемому времени
    const sortedSlots = this._sortSlotsByPreference(availableSlots, originalRequest);

    for (let i = 0; i < Math.min(3, sortedSlots.length); i++) {
      const slot = sortedSlots[i];
      const formatted = this._formatSlotTemplate(template[0], slot);
      alternatives.push(formatted);
    }

    return alternatives;
  }

  /**
   * 👤 Генерация альтернативных мастеров
   */
  async _generateStaffAlternatives(originalRequest, companyId) {
    const alternatives = [];
    
    try {
      // Получаем альтернативных мастеров (кэшируем на час)
      const alternativeStaff = await smartCache.getOrCompute(
        `alternative_staff_${originalRequest.service_id}_${companyId}`,
        async () => {
          // Здесь был бы запрос к Supabase за мастерами
          // Возвращаем мок для демонстрации
          return [
            { id: 2895125, name: 'Сергей', rating: 4.8 },
            { id: 3413963, name: 'Бари', rating: 4.9 },
            { id: 3820250, name: 'Рамзан', rating: 4.7 }
          ].filter(staff => staff.id !== originalRequest.staff_id);
        },
        { ttl: 3600, type: 'static' }
      );

      // Формируем предложения по мастерам
      const templates = this.suggestionTemplates.alternativeStaff;
      
      for (let i = 0; i < Math.min(2, alternativeStaff.length); i++) {
        const staff = alternativeStaff[i];
        const template = this._getRandomTemplate(templates);
        const formatted = template
          .replace('{staff_name}', staff.name)
          .replace('{rating}', staff.rating)
          .replace('{service}', originalRequest.service_name || 'эту услугу');
        
        alternatives.push(formatted);
      }

    } catch (error) {
      logger.error('Error generating staff alternatives:', error);
    }

    return alternatives;
  }

  /**
   * 🎯 Персонализированные предложения на основе истории клиента
   */
  async _generatePersonalizedSuggestions(client, originalRequest, companyId) {
    const suggestions = [];
    const templates = this.suggestionTemplates.clientHistory;

    try {
      // На основе последних услуг
      if (client.last_services && client.last_services.length > 0) {
        const lastService = client.last_services[0];
        const template = templates[0];
        const suggestion = template
          .replace('{service}', lastService.service_name || 'прошлую услугу')
          .replace('{staff_name}', lastService.staff_name || 'того же мастера');
        
        suggestions.push(suggestion);
      }

      // На основе предпочитаемого времени
      if (client.preferred_time_slots && client.preferred_time_slots.length > 0) {
        const preferredTime = client.preferred_time_slots[0];
        const template = templates[1];
        const suggestion = template
          .replace('{preferred_time}', preferredTime)
          .replace('{time}', this._findSimilarTime(preferredTime));
        
        suggestions.push(suggestion);
      }

      // На основе любимого мастера
      if (client.favorite_staff_ids && client.favorite_staff_ids.length > 0) {
        const favoriteStaffId = client.favorite_staff_ids[0];
        // Здесь был бы запрос имени мастера из БД
        const staffName = 'вашего любимого мастера'; // Мок
        const template = templates[2];
        const suggestion = template.replace('{staff_name}', staffName);
        
        suggestions.push(suggestion);
      }

    } catch (error) {
      logger.error('Error generating personalized suggestions:', error);
    }

    return suggestions.slice(0, 2); // Максимум 2 персонализированных предложения
  }

  /**
   * 🌟 Предложения популярных услуг и комбинаций
   */
  async _generatePopularSuggestions(currentServiceId, companyId) {
    const suggestions = [];
    const templates = this.suggestionTemplates.popularServices;

    try {
      // Получаем популярные комбинации (кэшируем на 6 часов)
      const popularCombos = await smartCache.getOrCompute(
        `popular_combos_${currentServiceId}_${companyId}`,
        async () => {
          // Мок популярных комбинаций
          return [
            { service: 'моделирование бороды', combo_rate: 0.7 },
            { service: 'укладка', combo_rate: 0.3 }
          ];
        },
        { ttl: 21600, type: 'static' }
      );

      if (popularCombos.length > 0) {
        const topCombo = popularCombos[0];
        const template = templates[0];
        const suggestion = template.replace('{service}', topCombo.service);
        suggestions.push(suggestion);
      }

    } catch (error) {
      logger.error('Error generating popular suggestions:', error);
    }

    return suggestions.slice(0, 1);
  }

  /**
   * 🔥 Горящие предложения и акции
   */
  async _generateUrgentSuggestions(originalRequest, companyId) {
    const suggestions = [];
    const templates = this.suggestionTemplates.urgentSlots;

    try {
      // Имитация поиска горящих слотов
      const urgentSlots = await smartCache.getOrCompute(
        `urgent_slots_${companyId}`,
        async () => {
          // Мок горящих слотов
          const now = new Date();
          const today = now.getHours() < 18; // До 18:00 есть слоты на сегодня
          
          if (today) {
            return [{
              time: `${now.getHours() + 2}:00`,
              type: 'today_discount',
              discount: 10
            }];
          }
          
          return [];
        },
        { ttl: 1800, type: 'urgent' } // Кэш на 30 минут
      );

      if (urgentSlots.length > 0) {
        const urgentSlot = urgentSlots[0];
        const template = templates[0]; // Горящий слот со скидкой
        const suggestion = template.replace('{time}', urgentSlot.time);
        suggestions.push(suggestion);
      }

    } catch (error) {
      logger.error('Error generating urgent suggestions:', error);
    }

    return suggestions;
  }

  // =============== HELPER METHODS ===============

  _getRandomTemplate(templates) {
    return templates[Math.floor(Math.random() * templates.length)];
  }

  _formatSlotTemplate(template, slot) {
    return template
      .replace('{time}', slot.time || slot.datetime)
      .replace('{staff_name}', slot.staff_name || 'мастер')
      .replace('{date}', slot.date || 'в удобный день');
  }

  _sortSlotsByPreference(slots, originalRequest) {
    // Простая сортировка по времени (в реальности была бы более сложная логика)
    return slots.sort((a, b) => {
      const timeA = a.time || a.datetime || '12:00';
      const timeB = b.time || b.datetime || '12:00';
      return timeA.localeCompare(timeB);
    });
  }

  _findSimilarTime(preferredTime) {
    // Простая логика поиска похожего времени
    const hour = parseInt(preferredTime.split(':')[0]);
    const similarHour = hour + 1; // На час позже
    return `${similarHour}:00`;
  }

  /**
   * Получение статистики предложений
   */
  async getStats() {
    return {
      templates: Object.keys(this.suggestionTemplates).length,
      cacheKeys: ['popular_combos', 'alternative_staff', 'urgent_slots']
    };
  }
}

// Singleton instance
module.exports = new ProactiveSuggestions();