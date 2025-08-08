/**
 * Синхронизация истории визитов из YClients в Supabase
 * Загружает полную историю визитов клиентов для персонализации и аналитики
 */

const axios = require('axios');
const { supabase } = require('../database/supabase');
const logger = require('../utils/logger').child({ module: 'visits-sync' });
const { 
  YCLIENTS_CONFIG, 
  createYclientsHeaders, 
  normalizePhone,
  delay 
} = require('./sync-utils');

class VisitsSync {
  constructor() {
    this.config = YCLIENTS_CONFIG;
    this.headers = createYclientsHeaders(true);
    this.BATCH_SIZE = 50; // Обрабатываем по 50 визитов за раз
    this.MAX_VISITS_PER_CLIENT = 100; // Максимум визитов на клиента
  }

  /**
   * Синхронизировать историю визитов всех клиентов
   * @param {Object} options - Опции синхронизации
   * @returns {Promise<Object>} Результат синхронизации
   */
  async syncAll(options = {}) {
    const startTime = Date.now();
    const { 
      limit = null, // Ограничение на количество клиентов
      onlyVip = false, // Синхронизировать только VIP клиентов
      minVisits = 1 // Минимальное количество визитов
    } = options;
    
    try {
      logger.info('📅 Starting visits synchronization...');
      
      // Получаем клиентов для синхронизации
      const clients = await this.getClientsForSync(limit, onlyVip, minVisits);
      
      if (!clients || clients.length === 0) {
        logger.warn('No clients found for visits sync');
        return { 
          success: true, 
          clientsProcessed: 0, 
          visitsProcessed: 0,
          errors: 0,
          duration: Date.now() - startTime 
        };
      }

      logger.info(`📋 Found ${clients.length} clients for visits sync`);
      
      let totalVisitsProcessed = 0;
      let totalErrors = 0;
      let clientsProcessed = 0;
      
      // Обрабатываем клиентов по одному
      for (const client of clients) {
        try {
          const result = await this.syncClientVisits(client);
          totalVisitsProcessed += result.visitsProcessed;
          totalErrors += result.errors;
          clientsProcessed++;
          
          if (clientsProcessed % 10 === 0) {
            logger.info(`Progress: ${clientsProcessed}/${clients.length} clients, ${totalVisitsProcessed} visits`);
          }
          
          // Задержка между клиентами для соблюдения rate limits
          await delay(500);
          
        } catch (error) {
          logger.error(`Failed to sync visits for client ${client.id}`, {
            error: error.message
          });
          totalErrors++;
        }
      }
      
      const duration = Date.now() - startTime;
      
      logger.info(`✅ Visits sync completed in ${Math.round(duration/1000)} seconds`, {
        clientsProcessed,
        visitsProcessed: totalVisitsProcessed,
        errors: totalErrors
      });

      return {
        success: true,
        clientsProcessed,
        visitsProcessed: totalVisitsProcessed,
        errors: totalErrors,
        duration
      };

    } catch (error) {
      logger.error('❌ Visits sync failed', {
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Получить клиентов для синхронизации
   */
  async getClientsForSync(limit, onlyVip, minVisits) {
    let query = supabase
      .from('clients')
      .select('id, yclients_id, phone, name, visit_count, loyalty_level')
      .eq('company_id', this.config.COMPANY_ID)
      .gte('visit_count', minVisits)
      .order('visit_count', { ascending: false });
    
    if (onlyVip) {
      query = query.in('loyalty_level', ['Gold', 'VIP']);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error('Failed to fetch clients for sync', error);
      throw error;
    }
    
    return data || [];
  }

  /**
   * Синхронизировать визиты конкретного клиента
   */
  async syncClientVisits(client) {
    try {
      logger.debug(`Syncing visits for client ${client.name} (${client.phone})`);
      
      // Получаем историю визитов через API
      const visits = await this.fetchClientVisits(client.yclients_id, client.phone);
      
      if (!visits || visits.length === 0) {
        logger.debug(`No visits found for client ${client.name}`);
        return { visitsProcessed: 0, errors: 0 };
      }
      
      logger.debug(`Found ${visits.length} visits for client ${client.name}`);
      
      // Сохраняем визиты пакетами
      const result = await this.saveVisitsBatch(visits, client);
      
      return result;
      
    } catch (error) {
      logger.error(`Error syncing visits for client ${client.name}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Получить историю визитов клиента из YClients API
   */
  async fetchClientVisits(clientYclientsId, clientPhone) {
    try {
      const url = `${this.config.BASE_URL}/company/${this.config.COMPANY_ID}/clients/visits/search`;
      
      const requestData = {
        client_id: clientYclientsId,
        client_phone: null, // Используем либо ID, либо телефон
        from: null, // Получаем всю историю
        to: null,
        payment_statuses: [], // Все статусы оплаты
        attendance: 1 // Только визиты где клиент пришел
      };
      
      const response = await axios.post(url, requestData, { 
        headers: {
          ...this.headers,
          'Accept': 'application/vnd.yclients.v2+json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.data?.success) {
        logger.error('API returned error:', response.data);
        return [];
      }
      
      const visitsData = response.data?.data?.visits || [];
      
      // Обрабатываем и форматируем визиты
      const formattedVisits = [];
      
      for (const visit of visitsData) {
        // Каждый визит может содержать несколько записей (услуг)
        if (visit.records && visit.records.length > 0) {
          for (const record of visit.records) {
            formattedVisits.push(this.formatVisitRecord(visit, record));
          }
        }
        
        // Также обрабатываем продажи товаров если есть
        if (visit.goods_transactions && visit.goods_transactions.length > 0) {
          // Создаем отдельную запись визита для продаж
          formattedVisits.push(this.formatGoodsVisit(visit));
        }
      }
      
      // Ограничиваем количество визитов
      return formattedVisits.slice(0, this.MAX_VISITS_PER_CLIENT);
      
    } catch (error) {
      if (error.response?.status === 404) {
        logger.debug('No visits found (404)');
        return [];
      }
      
      logger.error('Error fetching client visits', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Форматировать запись визита
   */
  formatVisitRecord(visit, record) {
    const services = record.services || [];
    const staff = record.staff || {};
    
    return {
      yclients_visit_id: visit.id,
      yclients_record_id: record.id,
      company_id: this.config.COMPANY_ID,
      
      // Информация о клиенте будет добавлена при сохранении
      client_yclients_id: record.client?.id || null,
      client_phone: normalizePhone(record.client?.phone || ''),
      client_name: record.client?.name || '',
      
      // Информация о мастере
      staff_id: staff.id || null,
      staff_name: staff.name || '',
      staff_yclients_id: staff.id || null,
      
      // Услуги
      services: services.map(s => ({
        id: s.id,
        name: s.title || s.name,
        cost: s.cost || 0,
        duration: s.duration || 0
      })),
      service_names: services.map(s => s.title || s.name),
      service_ids: services.map(s => s.id),
      services_cost: services.reduce((sum, s) => sum + (s.cost || 0), 0),
      
      // Время и дата
      visit_date: record.date || visit.date,
      visit_time: record.datetime ? record.datetime.split('T')[1]?.substring(0, 5) : null,
      datetime: record.datetime || visit.date + 'T12:00:00',
      duration: services.reduce((sum, s) => sum + (s.duration || 0), 0),
      
      // Финансы
      total_cost: record.cost_to_pay || 0,
      paid_amount: record.paid_full || 0,
      discount_amount: record.discount || 0,
      tips_amount: record.tips || 0,
      payment_status: this.getPaymentStatus(record),
      payment_method: record.payment_method || 'unknown',
      
      // Статус
      attendance: record.attendance || visit.attendance || 1,
      status: this.getVisitStatus(record, visit),
      is_online: record.online || false,
      
      // Дополнительно
      comment: record.comment || visit.comment || null,
      rating: record.rate || null,
      review: record.review || null,
      source: record.from_url ? 'online' : 'unknown',
      
      // Абонементы
      used_abonement: record.abonement_id ? true : false,
      abonement_id: record.abonement_id || null,
      loyalty_transactions: record.loyalty_transactions || []
    };
  }

  /**
   * Форматировать визит с продажей товаров
   */
  formatGoodsVisit(visit) {
    const goods = visit.goods_transactions || [];
    const totalCost = goods.reduce((sum, g) => sum + (g.amount || 0), 0);
    
    return {
      yclients_visit_id: visit.id,
      yclients_record_id: null, // Для продаж нет record_id
      company_id: this.config.COMPANY_ID,
      
      client_yclients_id: visit.client?.id || null,
      client_phone: normalizePhone(visit.client?.phone || ''),
      client_name: visit.client?.name || '',
      
      staff_id: goods[0]?.master?.id || null,
      staff_name: goods[0]?.master?.name || '',
      
      services: goods.map(g => ({
        id: g.good_id,
        name: g.title,
        cost: g.amount,
        duration: 0
      })),
      service_names: goods.map(g => g.title),
      service_ids: goods.map(g => g.good_id),
      services_cost: totalCost,
      
      visit_date: visit.date,
      datetime: visit.date + 'T12:00:00',
      duration: 0,
      
      total_cost: totalCost,
      paid_amount: totalCost,
      payment_status: 'paid_full',
      
      attendance: 1,
      status: 'completed',
      
      comment: 'Продажа товаров'
    };
  }

  /**
   * Определить статус оплаты
   */
  getPaymentStatus(record) {
    if (!record.paid_full || record.paid_full === 0) {
      return 'not_paid';
    }
    if (record.paid_full < record.cost_to_pay) {
      return 'paid_not_full';
    }
    if (record.paid_full > record.cost_to_pay) {
      return 'paid_over';
    }
    return 'paid_full';
  }

  /**
   * Определить статус визита
   */
  getVisitStatus(record, visit) {
    if (record.deleted || visit.deleted) {
      return 'cancelled';
    }
    if (record.attendance === -1 || visit.attendance === -1) {
      return 'no_show';
    }
    return 'completed';
  }

  /**
   * Сохранить визиты пакетами
   */
  async saveVisitsBatch(visits, client) {
    let processed = 0;
    let errors = 0;
    
    // Добавляем client_id ко всем визитам
    const visitsWithClientId = visits.map(v => ({
      ...v,
      client_id: client.id
    }));
    
    // Обрабатываем пакетами
    for (let i = 0; i < visitsWithClientId.length; i += this.BATCH_SIZE) {
      const batch = visitsWithClientId.slice(i, i + this.BATCH_SIZE);
      
      try {
        // Используем upsert для предотвращения дублей
        const { data, error } = await supabase
          .from('visits')
          .upsert(batch, {
            onConflict: 'company_id,yclients_record_id',
            ignoreDuplicates: true
          });
        
        if (error) {
          logger.error('Error saving visits batch', error);
          errors += batch.length;
        } else {
          processed += batch.length;
        }
        
      } catch (error) {
        logger.error('Error processing visits batch', {
          error: error.message
        });
        errors += batch.length;
      }
      
      // Небольшая задержка между пакетами
      if (i + this.BATCH_SIZE < visitsWithClientId.length) {
        await delay(100);
      }
    }
    
    logger.debug(`Saved ${processed} visits for client ${client.name}, ${errors} errors`);
    
    return { visitsProcessed: processed, errors };
  }

  /**
   * Обновить статистику после синхронизации
   */
  async updateSyncStats() {
    try {
      // Получаем общую статистику
      const { data: stats } = await supabase
        .from('visits')
        .select('client_id', { count: 'exact', head: true })
        .eq('company_id', this.config.COMPANY_ID);
      
      const { data: clientStats } = await supabase
        .from('visits')
        .select('client_id')
        .eq('company_id', this.config.COMPANY_ID)
        .limit(0);
      
      logger.info('📊 Visits sync statistics:', {
        totalVisits: stats?.count || 0,
        uniqueClients: clientStats?.length || 0
      });
      
      // Обновляем статус синхронизации
      await supabase
        .from('company_sync_status')
        .upsert({
          company_id: this.config.COMPANY_ID,
          table_name: 'visits',
          last_sync_at: new Date().toISOString(),
          records_count: stats?.count || 0,
          status: 'completed'
        });
      
    } catch (error) {
      logger.error('Failed to update sync stats', error);
    }
  }
}

module.exports = VisitsSync;