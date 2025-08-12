const axios = require('axios');
const { supabase } = require('../database/supabase');
const logger = require('../utils/logger').child({ module: 'client-records-sync' });
const { 
  normalizePhone, 
  calculateLoyaltyLevel, 
  YCLIENTS_CONFIG, 
  createYclientsHeaders 
} = require('./sync-utils');

/**
 * Альтернативный подход к синхронизации записей клиентов
 * Использует endpoint /records/{company_id} с фильтрацией
 */
class ClientRecordsSync {
  constructor(config) {
    this.config = {
      ...YCLIENTS_CONFIG,
      ...config
    };
    
    this.headers = createYclientsHeaders(true);
  }

  /**
   * Получить все записи компании и отфильтровать по клиенту
   */
  async getClientRecords(clientId, clientPhone) {
    try {
      logger.info(`Fetching records for client ${clientId}`);
      
      // Получаем записи за последние 2 года
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      
      const params = new URLSearchParams({
        start_date: startDate.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        client_id: clientId,
        include_finance_transactions: 1
      });
      
      const url = `${this.config.BASE_URL}/records/${this.config.COMPANY_ID}?${params}`;
      logger.debug(`Request URL: ${url}`);
      
      const response = await axios.get(url, { headers: this.headers });
      
      logger.debug(`Response status: ${response.status}`);
      logger.debug(`Found ${response.data?.data?.length || 0} records`);
      
      if (response.data?.success === false) {
        logger.error('API returned error:', response.data);
        return [];
      }
      
      const records = response.data?.data || [];
      
      // Фильтруем записи по клиенту
      const clientRecords = records.filter(record => {
        return record.client?.id === parseInt(clientId) || 
               normalizePhone(record.client?.phone) === normalizePhone(clientPhone);
      });
      
      logger.info(`Found ${clientRecords.length} records for client`);
      
      return this.processRecords(clientRecords);
      
    } catch (error) {
      logger.error('Error fetching records:', error.message);
      if (error.response) {
        logger.error('Response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Альтернативный метод через поиск записей
   */
  async searchClientRecords(clientId) {
    try {
      logger.info(`Searching records for client ${clientId} via search endpoint`);
      
      const requestData = {
        client_id: parseInt(clientId),
        page: 1,
        count: 300
      };
      
      const response = await axios.post(
        `${this.config.BASE_URL}/records/${this.config.COMPANY_ID}/search`,
        requestData,
        { headers: this.headers }
      );
      
      logger.debug(`Search response: ${response.status}`);
      
      if (response.data?.data) {
        logger.info(`Found ${response.data.data.length} records via search`);
        return this.processRecords(response.data.data);
      }
      
      return [];
      
    } catch (error) {
      logger.error('Search error:', error.message);
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Обработать записи и преобразовать в формат визитов
   */
  processRecords(records) {
    const visits = [];
    
    for (const record of records) {
      const visit = {
        record_id: record.id,
        date: record.date,
        datetime: record.datetime,
        services: [],
        staff: {},
        cost: 0,
        paid: 0,
        status: record.visit_attendance === 1 ? 'attended' : 
                record.visit_attendance === -1 ? 'not_attended' : 
                record.deleted ? 'cancelled' : 'confirmed',
        attendance: record.visit_attendance || 0,
        comment: record.comment
      };
      
      // Обрабатываем услуги
      if (record.services && Array.isArray(record.services)) {
        visit.services = record.services.map(service => ({
          id: service.id,
          title: service.title,
          cost: service.cost,
          discount: service.discount || 0,
          duration: service.seance_length
        }));
        
        visit.cost = record.services.reduce((sum, s) => sum + (s.cost || 0), 0);
      }
      
      // Информация о мастере
      if (record.staff) {
        visit.staff = {
          id: record.staff.id,
          name: record.staff.name,
          specialization: record.staff.specialization
        };
      }
      
      // Информация об оплате
      if (record.finances_summary) {
        visit.paid = record.finances_summary.payment || 0;
      }
      
      visits.push(visit);
    }
    
    // Сортируем по дате
    visits.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    
    return visits;
  }

  /**
   * Синхронизировать записи для клиента по телефону
   */
  async syncClientRecordsByPhone(phone) {
    logger.info(`Syncing records for client with phone: ${phone}`);
    
    try {
      // Находим клиента в базе
      const normalizedPhone = normalizePhone(phone);
      
      const { data: client, error } = await supabase
        .from('clients')
        .select('id, yclients_id, name')
        .or(`phone.eq.${phone},phone.eq.+${normalizedPhone},phone.eq.${normalizedPhone}`)
        .eq('company_id', this.config.COMPANY_ID)
        .single();
      
      if (error || !client) {
        throw new Error(`Client not found with phone: ${phone}`);
      }
      
      logger.info(`Found client: ${client.name} (ID: ${client.yclients_id})`);
      
      // Пробуем разные методы получения записей
      let records = [];
      
      // Метод 1: через общий список с фильтрацией
      try {
        records = await this.getClientRecords(client.yclients_id, phone);
      } catch (error) {
        logger.warn('Method 1 failed:', error.message);
      }
      
      // Метод 2: через поиск записей
      if (records.length === 0) {
        try {
          records = await this.searchClientRecords(client.yclients_id);
        } catch (error) {
          logger.warn('Method 2 failed:', error.message);
        }
      }
      
      if (records && records.length > 0) {
        // Сохраняем историю визитов
        await this.saveClientVisits(client.id, client.yclients_id, records);
        
        logger.info(`✅ Synced ${records.length} records for ${client.name}`);
        
        return {
          success: true,
          client: client.name,
          recordsCount: records.length,
          records
        };
      }
      
      logger.info(`No records found for ${client.name}`);
      return {
        success: true,
        client: client.name,
        recordsCount: 0,
        records: []
      };
      
    } catch (error) {
      logger.error('Failed to sync client records:', error);
      throw error;
    }
  }

  /**
   * Сохранить визиты клиента
   */
  async saveClientVisits(clientId, yclientsClientId, visits) {
    if (!visits || visits.length === 0) return;
    
    try {
      // Обновляем статистику клиента
      const lastVisit = visits[visits.length - 1];
      const firstVisit = visits[0];
      
      // Собираем уникальные услуги
      const allServices = new Set();
      let totalSpent = 0;
      
      for (const visit of visits) {
        if (visit.services) {
          visit.services.forEach(service => {
            if (service.title) {
              allServices.add(service.title);
            }
          });
        }
        totalSpent += visit.cost || 0;
      }
      
      const lastServices = Array.from(allServices).slice(-5);
      
      // Формируем историю визитов
      const visitHistory = visits.map(visit => ({
        date: visit.date || visit.datetime,
        services: visit.services?.map(s => s.title).filter(Boolean) || [],
        staff: visit.staff?.name || 'Не указан',
        cost: visit.cost || 0,
        status: visit.status,
        attendance: visit.attendance
      }));
      
      // Получаем текущий total_spent для расчета loyalty_level
      const { data: currentClient } = await supabase
        .from('clients')
        .select('total_spent')
        .eq('id', clientId)
        .single();
      
      const originalTotalSpent = currentClient?.total_spent || 0;
      
      // Вычисляем предполагаемую сумму товаров
      // total_spent (из YClients sold_amount) - сумма услуг из визитов = товары
      const estimatedGoodsAmount = originalTotalSpent - totalSpent;
      
      // Обновляем клиента (НЕ трогаем total_spent - он приходит из YClients API!)
      const updateData = {
        visit_count: visits.length,
        first_visit_date: firstVisit.date,
        last_visit_date: lastVisit.date,
        last_services: lastServices,
        visit_history: visitHistory,
        // НЕ обновляем total_spent! Он должен оставаться из YClients sold_amount
        services_amount: totalSpent, // Сумма только услуг
        goods_amount: estimatedGoodsAmount > 0 ? estimatedGoodsAmount : 0, // Предполагаемая сумма товаров
        average_bill: visits.length > 0 ? Math.round(totalSpent / visits.length) : 0,
        loyalty_level: calculateLoyaltyLevel(visits.length, originalTotalSpent),
        last_sync_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', clientId);
      
      if (error) {
        throw error;
      }
      
      logger.info(`Updated client statistics: ${visits.length} visits, ${totalSpent} руб total`);
      
    } catch (error) {
      logger.error('Failed to save client visits:', error);
      throw error;
    }
  }

  // Вспомогательные методы перенесены в sync-utils.js
}

module.exports = { ClientRecordsSync };