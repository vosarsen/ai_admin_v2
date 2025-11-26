/**
 * Синхронизация истории визитов из YClients в PostgreSQL
 * Migrated from Supabase to Repository Pattern (2025-11-26)
 * Загружает полную историю визитов клиентов для персонализации и аналитики
 */

const axios = require('axios');
const postgres = require('../database/postgres');
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
    let sql = `
      SELECT id, yclients_id, phone, name, visit_count, loyalty_level
      FROM clients
      WHERE company_id = $1 AND visit_count >= $2
    `;
    const params = [this.config.COMPANY_ID, minVisits];

    if (onlyVip) {
      sql += ` AND loyalty_level IN ('Gold', 'VIP')`;
    }

    sql += ` ORDER BY visit_count DESC`;

    if (limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    try {
      const result = await postgres.query(sql, params);
      return result.rows || [];
    } catch (error) {
      logger.error('Failed to fetch clients for sync', error);
      throw error;
    }
  }

  /**
   * Синхронизировать визиты конкретного клиента
   */
  async syncClientVisits(client) {
    try {
      logger.debug(`Syncing visits for client ${client.name} (${client.phone})`);
      
      // Получаем историю визитов через API
      let visits = await this.fetchClientVisits(client.yclients_id, client.phone);
      
      // Если не нашли через visits/search, пробуем через records
      if (!visits || visits.length === 0) {
        logger.debug(`No visits found via visits/search, trying /records endpoint`);
        visits = await this.fetchClientRecords(client.yclients_id, client.phone);
      }
      
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
      
      // Создаем правильные headers с USER token (не API key!)
      const userToken = process.env.YCLIENTS_USER_TOKEN;
      const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
      
      const response = await axios.post(url, requestData, { 
        headers: {
          'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
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
   * Альтернативный метод - получить записи через /records endpoint
   */
  async fetchClientRecords(clientYclientsId, clientPhone) {
    try {
      const userToken = process.env.YCLIENTS_USER_TOKEN;
      const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
      
      // Получаем записи за последние 2 года
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      const endDate = new Date();
      
      const url = `${this.config.BASE_URL}/records/${this.config.COMPANY_ID}`;
      
      logger.debug(`Fetching records from ${url}`);
      
      const response = await axios.get(url, {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          client_id: clientYclientsId,
          include_finance_transactions: 1
        },
        headers: {
          'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
          'Accept': 'application/vnd.api.v2+json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.data?.success) {
        logger.error('Records API returned error:', response.data);
        return [];
      }
      
      const records = response.data?.data || [];
      logger.debug(`Found ${records.length} total records`);
      
      // Фильтруем записи по клиенту
      const clientRecords = records.filter(record => {
        const recordClientId = record.client?.id;
        const recordPhone = this.normalizePhone(record.client?.phone);
        const targetPhone = this.normalizePhone(clientPhone);
        
        return recordClientId === parseInt(clientYclientsId) || 
               (recordPhone && targetPhone && recordPhone === targetPhone);
      });
      
      logger.debug(`Found ${clientRecords.length} records for client ${clientYclientsId}`);
      
      // Форматируем записи в формат визитов
      return clientRecords.map(record => this.formatRecordToVisit(record));
      
    } catch (error) {
      logger.error('Error fetching client records', {
        error: error.message,
        response: error.response?.data
      });
      return [];
    }
  }
  
  /**
   * Форматировать запись из /records в формат визита
   */
  formatRecordToVisit(record) {
    const services = record.services || [];
    const staff = record.staff || {};
    
    return {
      yclients_visit_id: record.visit_id || null,
      yclients_record_id: record.id,
      company_id: this.config.COMPANY_ID,
      
      client_yclients_id: record.client?.id || null,
      client_phone: this.normalizePhone(record.client?.phone || ''),
      client_name: record.client?.name || '',
      
      staff_id: staff.id || null,
      staff_name: staff.name || '',
      staff_yclients_id: staff.id || null,
      
      services: services.map(s => ({
        id: s.id,
        name: s.title || s.name,
        cost: s.cost || s.price_min || 0,
        duration: s.duration || 0
      })),
      service_names: services.map(s => s.title || s.name),
      service_ids: services.map(s => s.id),
      services_cost: services.reduce((sum, s) => sum + (s.cost || s.price_min || 0), 0),
      
      visit_date: record.date,
      visit_time: record.datetime ? record.datetime.split('T')[1]?.substring(0, 5) : null,
      datetime: record.datetime || record.date + 'T12:00:00',
      duration: services.reduce((sum, s) => sum + (s.duration || 0), 0),
      
      total_cost: record.cost || 0,
      paid_amount: record.paid_full || record.paid || 0,
      discount_amount: record.discount || 0,
      tips_amount: record.tips || 0,
      payment_status: this.getPaymentStatus(record),
      payment_method: record.payment_method || 'unknown',
      
      attendance: record.attendance || 1,
      status: record.deleted ? 'cancelled' : (record.attendance === -1 ? 'no_show' : 'completed'),
      is_online: record.online || false,
      
      comment: record.comment || null,
      rating: record.rate || null,
      review: record.review || null,
      source: record.from_url ? 'online' : 'unknown'
    };
  }
  
  /**
   * Нормализация телефонного номера
   */
  normalizePhone(phone) {
    if (!phone) return null;
    return phone.toString().replace(/\D/g, '').replace(/^8/, '7');
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
   * Сохранить визиты пакетами (PostgreSQL)
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
        // Строим INSERT ON CONFLICT для upsert
        for (const visit of batch) {
          const columns = Object.keys(visit).filter(k => visit[k] !== undefined);
          const values = columns.map(k => {
            const val = visit[k];
            if (val === null) return 'NULL';
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            return val;
          });

          const sql = `
            INSERT INTO visits (${columns.join(', ')})
            VALUES (${values.join(', ')})
            ON CONFLICT (company_id, yclients_record_id)
            DO UPDATE SET
              ${columns.map(c => `${c} = EXCLUDED.${c}`).join(', ')}
          `;

          await postgres.query(sql);
          processed++;
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
      const countResult = await postgres.query(
        `SELECT COUNT(*) as total, COUNT(DISTINCT client_id) as unique_clients
         FROM visits WHERE company_id = $1`,
        [this.config.COMPANY_ID]
      );

      const stats = countResult.rows[0] || { total: 0, unique_clients: 0 };

      logger.info('📊 Visits sync statistics:', {
        totalVisits: stats.total,
        uniqueClients: stats.unique_clients
      });

      // Статус синхронизации логируется, но не сохраняется в БД (deprecated)
      logger.debug('updateSyncStats completed (status update is no-op)');

    } catch (error) {
      logger.error('Failed to update sync stats', error);
    }
  }
}

module.exports = VisitsSync;