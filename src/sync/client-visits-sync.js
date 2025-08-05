const axios = require('axios');
const { supabase } = require('../database/supabase');
const logger = require('../utils/logger').child({ module: 'client-visits-sync' });

/**
 * Синхронизация истории визитов клиентов из YClients
 * Использует endpoint /company/{company_id}/clients/visits/search
 */
class ClientVisitsSync {
  constructor(config) {
    this.config = {
      COMPANY_ID: 962302,
      BASE_URL: 'https://api.yclients.com/api/v1',
      BEARER_TOKEN: process.env.YCLIENTS_BEARER_TOKEN,
      USER_TOKEN: process.env.YCLIENTS_USER_TOKEN,
      API_DELAY_MS: 250, // 4 запроса в секунду
      ...config
    };
    
    this.headers = {
      'Authorization': `Bearer ${this.config.BEARER_TOKEN}, User ${this.config.USER_TOKEN}`,
      'Accept': 'application/vnd.yclients.v2+json',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Синхронизировать историю визитов для всех клиентов
   */
  async syncAllClientsVisits() {
    logger.info('🔄 Starting full client visits synchronization...');
    const startTime = Date.now();
    
    try {
      // Получаем всех клиентов из базы
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, yclients_id, phone, name')
        .eq('company_id', this.config.COMPANY_ID)
        .not('yclients_id', 'is', null);
      
      if (error) {
        throw new Error(`Failed to fetch clients: ${error.message}`);
      }
      
      logger.info(`Found ${clients.length} clients to sync visits for`);
      
      let processed = 0;
      let errors = 0;
      let totalVisits = 0;
      
      // Обрабатываем клиентов порциями
      for (const client of clients) {
        try {
          const visits = await this.getClientVisits(client.yclients_id, client.phone);
          
          if (visits && visits.length > 0) {
            await this.saveClientVisits(client.id, client.yclients_id, visits);
            totalVisits += visits.length;
            logger.debug(`Client ${client.name}: ${visits.length} visits found`);
          }
          
          processed++;
          
          if (processed % 50 === 0) {
            logger.info(`Progress: ${processed}/${clients.length} clients, ${totalVisits} visits`);
          }
          
          // Соблюдаем rate limit
          await this.delay(this.config.API_DELAY_MS);
          
        } catch (error) {
          errors++;
          logger.error(`Error syncing visits for client ${client.name}:`, error.message);
          
          if (errors > 10) {
            logger.error('Too many errors, stopping sync');
            break;
          }
        }
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      logger.info(`✅ Visits sync completed in ${duration}s: ${processed} clients, ${totalVisits} visits, ${errors} errors`);
      
      return {
        success: true,
        processed,
        totalVisits,
        errors,
        duration
      };
      
    } catch (error) {
      logger.error('Failed to sync client visits:', error);
      throw error;
    }
  }

  /**
   * Получить историю визитов конкретного клиента
   */
  async getClientVisits(clientId, clientPhone) {
    try {
      logger.debug(`Requesting visits for client ${clientId}, phone: ${clientPhone}`);
      
      const requestData = {
        client_id: parseInt(clientId),
        client_phone: this.normalizePhone(clientPhone),
        from: '2020-01-01', // Берем историю с 2020 года
        to: new Date().toISOString().split('T')[0],
        payment_statuses: [], // Все статусы оплаты
        attendance: -1 // Все статусы посещения
      };
      
      logger.debug('Request data:', requestData);
      
      const response = await axios.post(
        `${this.config.BASE_URL}/company/${this.config.COMPANY_ID}/clients/visits/search`,
        requestData,
        { headers: this.headers }
      );
      
      logger.debug(`Response status: ${response.status}`);
      logger.debug(`Response data:`, JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.success !== false) {
        return this.processVisitsResponse(response.data);
      }
      
      return [];
      
    } catch (error) {
      logger.error('Error fetching visits:', error.message);
      if (error.response) {
        logger.error('Response status:', error.response.status);
        logger.error('Response data:', error.response.data);
      }
      
      if (error.response?.status === 404) {
        // Клиент не найден или нет визитов
        return [];
      }
      throw error;
    }
  }

  /**
   * Обработать ответ API с визитами
   */
  processVisitsResponse(data) {
    const visits = [];
    
    // API возвращает данные сгруппированные по визитам
    if (data.data && Array.isArray(data.data)) {
      for (const visit of data.data) {
        // Каждый визит может содержать несколько записей (услуг)
        const visitDate = visit.date || visit.datetime;
        const visitId = visit.id || visit.visit_id;
        
        // Обрабатываем записи внутри визита
        if (visit.records && Array.isArray(visit.records)) {
          for (const record of visit.records) {
            visits.push({
              visit_id: visitId,
              record_id: record.id,
              date: visitDate,
              datetime: record.datetime || visitDate,
              services: record.services || [],
              staff: record.staff || {},
              cost: record.cost || 0,
              paid: record.paid || 0,
              status: record.status,
              attendance: record.attendance || visit.attendance,
              comment: record.comment,
              duration: record.length || record.seance_length
            });
          }
        } else {
          // Если структура данных другая, сохраняем как есть
          visits.push({
            visit_id: visitId,
            date: visitDate,
            raw_data: visit
          });
        }
      }
    }
    
    return visits;
  }

  /**
   * Сохранить визиты клиента в базу
   */
  async saveClientVisits(clientId, yclientsClientId, visits) {
    if (!visits || visits.length === 0) return;
    
    try {
      // Извлекаем информацию для обновления клиента
      const lastVisit = visits[visits.length - 1];
      const firstVisit = visits[0];
      
      // Собираем все уникальные услуги
      const allServices = new Set();
      let totalSpent = 0;
      
      for (const visit of visits) {
        if (visit.services && Array.isArray(visit.services)) {
          visit.services.forEach(service => {
            if (service.title || service.name) {
              allServices.add(service.title || service.name);
            }
          });
        }
        totalSpent += visit.cost || 0;
      }
      
      // Последние 5 услуг
      const lastServices = Array.from(allServices).slice(-5);
      
      // Формируем историю визитов для сохранения
      const visitHistory = visits.map(visit => ({
        date: visit.date || visit.datetime,
        services: visit.services?.map(s => s.title || s.name).filter(Boolean) || [],
        staff: visit.staff?.name || 'Не указан',
        cost: visit.cost || 0,
        status: visit.status,
        attendance: visit.attendance
      }));
      
      // Обновляем данные клиента
      const { error } = await supabase
        .from('clients')
        .update({
          visit_count: visits.length,
          first_visit_date: firstVisit.date,
          last_visit_date: lastVisit.date,
          last_services: lastServices,
          visit_history: visitHistory,
          total_spent: totalSpent,
          average_bill: visits.length > 0 ? Math.round(totalSpent / visits.length) : 0,
          loyalty_level: this.calculateLoyaltyLevel(visits.length, totalSpent),
          last_sync_at: new Date().toISOString()
        })
        .eq('id', clientId);
      
      if (error) {
        throw error;
      }
      
      // Также сохраняем детальные записи в таблицу bookings если нужно
      await this.saveDetailedBookings(clientId, yclientsClientId, visits);
      
    } catch (error) {
      logger.error(`Failed to save visits for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Сохранить детальные записи в таблицу bookings
   */
  async saveDetailedBookings(clientId, yclientsClientId, visits) {
    const bookings = [];
    
    for (const visit of visits) {
      if (visit.record_id) {
        bookings.push({
          company_id: this.config.COMPANY_ID,
          client_id: clientId,
          yclients_client_id: yclientsClientId,
          yclients_record_id: visit.record_id,
          visit_id: visit.visit_id,
          datetime: visit.datetime || visit.date,
          services: visit.services || [],
          staff_name: visit.staff?.name || null,
          staff_id: visit.staff?.id || null,
          cost: visit.cost || 0,
          paid: visit.paid || 0,
          status: visit.status || 'unknown',
          attendance: visit.attendance || 0,
          comment: visit.comment || null,
          duration: visit.duration || null,
          created_at: new Date().toISOString()
        });
      }
    }
    
    if (bookings.length > 0) {
      // Вставляем записи, игнорируя дубликаты
      const { error } = await supabase
        .from('bookings')
        .upsert(bookings, { 
          onConflict: 'yclients_record_id,company_id',
          ignoreDuplicates: true 
        });
      
      if (error) {
        logger.error('Failed to save detailed bookings:', error);
      }
    }
  }

  /**
   * Синхронизировать визиты для конкретного клиента по телефону
   */
  async syncClientVisitsByPhone(phone) {
    logger.info(`Syncing visits for client with phone: ${phone}`);
    
    try {
      // Находим клиента в базе
      // Пробуем разные форматы телефона
      const normalizedPhone = this.normalizePhone(phone);
      
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
      
      // Получаем визиты
      const visits = await this.getClientVisits(client.yclients_id, phone);
      
      if (visits && visits.length > 0) {
        await this.saveClientVisits(client.id, client.yclients_id, visits);
        logger.info(`✅ Synced ${visits.length} visits for ${client.name}`);
        
        return {
          success: true,
          client: client.name,
          visitsCount: visits.length,
          visits
        };
      }
      
      logger.info(`No visits found for ${client.name}`);
      return {
        success: true,
        client: client.name,
        visitsCount: 0,
        visits: []
      };
      
    } catch (error) {
      logger.error('Failed to sync client visits by phone:', error);
      throw error;
    }
  }

  /**
   * Вспомогательные методы
   */
  
  normalizePhone(phone) {
    if (!phone) return null;
    return phone.replace(/\D/g, '').replace(/^8/, '7');
  }
  
  calculateLoyaltyLevel(visitsCount, totalSpent) {
    if (visitsCount >= 20 && totalSpent >= 50000) return 'VIP';
    if (visitsCount >= 10 && totalSpent >= 20000) return 'Gold';
    if (visitsCount >= 5 && totalSpent >= 8000) return 'Silver';
    if (visitsCount >= 2) return 'Bronze';
    return 'New';
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { ClientVisitsSync };