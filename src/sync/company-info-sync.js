const logger = require('../utils/logger').child({ module: 'company-info-sync' });
const { supabase } = require('../database/supabase');
const { YclientsClient } = require('../integrations/yclients/client');

/**
 * Синхронизация информации о компании из YClients API
 * Автоматически загружает и обновляет данные компании в таблице companies
 */
class CompanyInfoSync {
  constructor() {
    this.yclientsClient = new YclientsClient();
  }

  /**
   * Синхронизировать информацию о компании
   * @param {number} companyId - ID компании в системе
   * @param {number} yclientsId - ID компании в YClients (опционально)
   */
  async syncCompanyInfo(companyId, yclientsId = null) {
    try {
      logger.info(`Starting company info sync for company ${companyId}`);

      // Используем yclientsId если передан, иначе используем companyId
      const ycId = yclientsId || companyId;
      
      // Получаем данные из YClients API
      const ycData = await this.yclientsClient.getCompanyInfo(ycId);
      
      if (!ycData || !ycData.success || !ycData.data) {
        throw new Error('Failed to fetch company data from YClients');
      }

      // Данные могут быть вложены дважды из-за особенностей клиента
      const companyData = ycData.data.data || ycData.data;
      
      // Подготавливаем данные для сохранения
      const companyRecord = {
        company_id: companyId,
        yclients_id: companyData.id,
        title: companyData.title || 'Без названия',
        address: companyData.address || '',
        phone: companyData.phone || '',
        email: companyData.email || '',
        website: companyData.site || '',
        timezone: companyData.timezone_name || 'Europe/Moscow',
        working_hours: companyData.schedule || '10:00-22:00', // В БД хранится как строка
        coordinate_lat: companyData.coordinate_lat || null,
        coordinate_lon: companyData.coordinate_lon || null,
        raw_data: companyData, // Сохраняем все данные из YClients
        updated_at: new Date().toISOString()
      };

      // Сохраняем или обновляем запись в БД
      const { data: existingCompany, error: fetchError } = await supabase
        .from('companies')
        .select('id')
        .eq('company_id', companyId)
        .single();

      let result;
      if (fetchError && fetchError.code === 'PGRST116') {
        // Запись не найдена, создаем новую
        logger.info(`Creating new company record for ${companyId}`);
        const { data, error } = await supabase
          .from('companies')
          .insert([companyRecord])
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      } else if (existingCompany) {
        // Обновляем существующую запись
        logger.info(`Updating existing company record for ${companyId}`);
        const { data, error } = await supabase
          .from('companies')
          .update(companyRecord)
          .eq('company_id', companyId)
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      } else if (fetchError) {
        throw fetchError;
      }

      logger.info(`Company info sync completed for ${companyId}`, {
        title: result.title,
        address: result.address,
        phone: result.phone,
        timezone: result.timezone
      });

      // Добавляем business_type из raw_data для использования в AI
      result.business_type = this.detectBusinessType(result.raw_data?.short_descr);
      
      return result;
    } catch (error) {
      logger.error(`Error syncing company info for ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Парсинг расписания работы из строки YClients
   * @param {string} schedule - Строка расписания из YClients
   * @returns {object} - Объект с расписанием по дням недели
   */
  parseWorkingHours(schedule) {
    // YClients часто возвращает пустую строку или неструктурированный текст
    // Пытаемся распарсить если есть данные, иначе возвращаем дефолтное расписание
    
    if (!schedule || schedule.trim() === '') {
      // Дефолтное расписание для барбершопа
      return {
        monday: { start: '10:00', end: '22:00' },
        tuesday: { start: '10:00', end: '22:00' },
        wednesday: { start: '10:00', end: '22:00' },
        thursday: { start: '10:00', end: '22:00' },
        friday: { start: '10:00', end: '22:00' },
        saturday: { start: '10:00', end: '22:00' },
        sunday: { start: '10:00', end: '20:00' }
      };
    }

    // Попытка распарсить строку расписания
    // Формат может быть разным, например:
    // "Пн-Пт: 10:00-22:00, Сб-Вс: 10:00-20:00"
    // "Ежедневно 10:00-22:00"
    // и т.д.
    
    try {
      const workingHours = {};
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      // Простой парсер для распространенных форматов
      if (schedule.toLowerCase().includes('ежедневно')) {
        const timeMatch = schedule.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
        if (timeMatch) {
          const [, start, end] = timeMatch;
          days.forEach(day => {
            workingHours[day] = { start, end };
          });
        }
      }
      
      // Если не удалось распарсить, возвращаем дефолт
      if (Object.keys(workingHours).length === 0) {
        return this.parseWorkingHours(''); // Вернуть дефолт
      }
      
      return workingHours;
    } catch (error) {
      logger.warn('Failed to parse working hours, using defaults', { schedule, error: error.message });
      return this.parseWorkingHours(''); // Вернуть дефолт
    }
  }

  /**
   * Определить тип бизнеса по описанию из YClients
   * @param {string} shortDescr - Краткое описание из YClients
   * @returns {string} - Тип бизнеса для AI Admin
   */
  detectBusinessType(shortDescr) {
    if (!shortDescr) return 'beauty';
    
    const description = shortDescr.toLowerCase();
    
    // Маппинг описаний YClients на типы бизнеса AI Admin
    const businessTypeMap = {
      'барбершоп': 'barbershop',
      'barbershop': 'barbershop',
      'мужская парикмахерская': 'barbershop',
      'для мужчин': 'barbershop',
      'маникюр': 'nails',
      'ногти': 'nails',
      'ногтевая': 'nails',
      'nail': 'nails',
      'массаж': 'massage',
      'спа': 'massage',
      'spa': 'massage',
      'эпиляция': 'epilation',
      'депиляция': 'epilation',
      'шугаринг': 'epilation',
      'воск': 'epilation',
      'брови': 'brows',
      'ресницы': 'brows',
      'brow': 'brows',
      'lash': 'brows'
    };

    // Ищем совпадения
    for (const [keyword, type] of Object.entries(businessTypeMap)) {
      if (description.includes(keyword)) {
        return type;
      }
    }

    // По умолчанию - универсальный салон красоты
    return 'beauty';
  }

  /**
   * Синхронизировать все компании (для batch операций)
   * @param {Array<number>} companyIds - Массив ID компаний
   */
  async syncMultipleCompanies(companyIds) {
    const results = {
      success: [],
      failed: []
    };

    for (const companyId of companyIds) {
      try {
        await this.syncCompanyInfo(companyId);
        results.success.push(companyId);
      } catch (error) {
        logger.error(`Failed to sync company ${companyId}:`, error);
        results.failed.push({ companyId, error: error.message });
      }
    }

    logger.info('Batch company sync completed', results);
    return results;
  }
}

module.exports = new CompanyInfoSync();