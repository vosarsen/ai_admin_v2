/**
 * Синхронизация клиентов из YClients в PostgreSQL
 * Migrated from Supabase to Repository Pattern (2025-11-26)
 */

const postgres = require('../database/postgres');
const ClientRepository = require('../repositories/ClientRepository');
const logger = require('../utils/logger').child({ module: 'clients-sync' });
const {
  YCLIENTS_CONFIG,
  createYclientsHeaders,
  normalizePhone,
  calculateLoyaltyLevel,
  calculateClientSegment,
  delay
} = require('./sync-utils');
const axios = require('axios');

class ClientsSync {
  constructor() {
    this.config = YCLIENTS_CONFIG;
    this.tableName = 'clients';
    this.clientRepo = new ClientRepository(postgres.pool);
  }

  /**
   * Синхронизировать всех клиентов компании
   * @param {Object} options - Опции синхронизации
   * @returns {Promise<Object>} Результат синхронизации
   */
  async sync(options = {}) {
    const startTime = Date.now();
    const { syncVisitHistory = false, maxVisitsSync = 50 } = options;
    
    try {
      logger.info('👤 Starting clients synchronization...');
      
      // Получаем клиентов из YClients API
      const clients = await this.fetchAllClients();
      
      if (!clients || clients.length === 0) {
        logger.warn('No clients found in YClients');
        return { 
          success: true, 
          processed: 0, 
          errors: 0, 
          total: 0,
          duration: Date.now() - startTime 
        };
      }

      logger.info(`📋 Found ${clients.length} clients to sync`);

      // Обрабатываем и сохраняем клиентов
      const result = await this.saveClients(clients);
      
      // Синхронизация истории визитов если включена
      if (syncVisitHistory) {
        logger.info('📅 Starting visit history sync...');
        const visitsResult = await this.syncVisitHistory(clients, maxVisitsSync);
        result.visitsProcessed = visitsResult.processed;
      }
      
      const duration = Date.now() - startTime;
      
      logger.info(`✅ Clients sync completed in ${duration}ms`, {
        processed: result.processed,
        errors: result.errors,
        total: clients.length,
        visitsProcessed: result.visitsProcessed || 0
      });

      return {
        success: true,
        ...result,
        duration
      };

    } catch (error) {
      logger.error('❌ Clients sync failed', {
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
   * Получить всех клиентов из YClients API
   * @returns {Promise<Array>} Массив клиентов
   */
  async fetchAllClients() {
    const allClients = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= this.config.MAX_PAGES) {
      try {
        const url = `${this.config.BASE_URL}/company/${this.config.COMPANY_ID}/clients/search`;
        const headers = createYclientsHeaders(true);
        
        const requestData = {
          page: page,
          page_size: this.config.PAGE_SIZE,
          fields: [
            "id", "name", "phone", "email", "discount",
            "first_visit_date", "last_visit_date",
            "spent", "sold_amount", "visits_count"
          ],
          order_by: "name",
          order_by_direction: "ASC"
        };
        
        logger.debug(`Fetching clients page ${page}...`);
        
        const response = await axios.post(url, requestData, { headers });
        
        if (response.data?.success === false) {
          logger.warn(`Failed to fetch page ${page}:`, response.data?.meta?.message);
          break;
        }
        
        const clients = response.data?.data || [];
        allClients.push(...clients);
        
        // Логируем пример данных для отладки
        if (page === 1 && clients.length > 0) {
          const sampleClient = clients.find(c => c.sold_amount > 100000) || clients[0];
          logger.info('Sample client data from API:', {
            name: sampleClient.name,
            phone: sampleClient.phone,
            sold_amount: sampleClient.sold_amount,
            spent: sampleClient.spent,
            visits_count: sampleClient.visits_count
          });
        }
        
        logger.debug(`Page ${page}: ${clients.length} clients`);
        
        // Проверяем есть ли еще страницы
        const totalCount = response.data?.meta?.total_count || 0;
        hasMore = allClients.length < totalCount && clients.length === this.config.PAGE_SIZE;
        page++;
        
        // Задержка между запросами
        await delay(this.config.API_DELAY_MS);
        
      } catch (error) {
        logger.error(`Failed to fetch clients page ${page}`, {
          error: error.message,
          response: error.response?.data
        });
        hasMore = false;
      }
    }
    
    return allClients;
  }

  /**
   * Сохранить клиентов в PostgreSQL (батчевый upsert)
   * @param {Array} clients - Массив клиентов
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveClients(clients) {
    // Подготавливаем данные для всех клиентов
    const preparedClients = clients.map(client => this.prepareClientData(client));

    // Добавляем статистику по total_spent перед сохранением
    const statsClients = clients.filter(c => (c.sold_amount || c.spent || 0) > 0);
    logger.info(`💰 Financial stats: ${statsClients.length}/${clients.length} clients have total_spent > 0`);

    if (statsClients.length > 0) {
      const topClients = statsClients
        .sort((a, b) => (b.sold_amount || b.spent || 0) - (a.sold_amount || a.spent || 0))
        .slice(0, 3);
      logger.info('Top 3 clients by spending:', topClients.map(c => ({
        name: c.name,
        phone: c.phone,
        amount: c.sold_amount || c.spent || 0
      })));
    }

    try {
      // Используем батчевый upsert через репозиторий
      const result = await this.clientRepo.syncBulkUpsert(preparedClients);

      logger.info(`✅ Batch upsert completed: ${result.count} clients in ${result.duration}ms`);

      return {
        processed: result.count,
        errors: 0,
        errorDetails: [],
        duration: result.duration
      };
    } catch (error) {
      logger.error('❌ Batch upsert failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Подготовить данные клиента для сохранения
   * @param {Object} client - Сырые данные клиента из API
   * @returns {Object} Подготовленные данные
   */
  prepareClientData(client) {
    const totalSpent = client.sold_amount || client.spent || 0;
    const visitsCount = client.visits_count || 0;
    
    return {
      yclients_id: client.id,
      company_id: this.config.COMPANY_ID,
      name: client.name || 'Unnamed Client',
      phone: normalizePhone(client.phone),
      raw_phone: client.phone,
      email: client.email || null,
      discount: client.discount || 0,
      branch_ids: client.branch_ids || [],
      tags: client.tags || [],
      status: client.status || null,
      source: 'yclients',
      visit_count: visitsCount,
      total_spent: totalSpent,
      first_visit_date: client.first_visit_date || null,
      last_visit_date: client.last_visit_date || null,
      last_services: client.last_services || [],
      visit_history: client.visit_history || [],
      preferences: client.custom_fields || {},
      loyalty_level: calculateLoyaltyLevel(visitsCount, totalSpent),
      client_segment: calculateClientSegment(visitsCount, totalSpent),
      average_bill: visitsCount > 0 ? Math.round(totalSpent / visitsCount) : 0,
      blacklisted: client.status === 'blocked',
      notes: client.comment || null,
      last_sync_at: new Date().toISOString(),
      created_by_ai: false
    };
  }

  /**
   * Синхронизировать историю визитов для клиентов
   * @param {Array} clients - Массив клиентов
   * @param {number} maxClients - Максимальное количество клиентов для синхронизации
   * @returns {Promise<Object>} Результат синхронизации
   */
  async syncVisitHistory(clients, maxClients = 50) {
    const { ClientRecordsSync } = require('./client-records-sync');
    const recordsSync = new ClientRecordsSync();

    let processed = 0;
    const eligibleClients = clients
      .filter(c => c.visits_count >= 2 && c.phone)
      .sort((a, b) => b.visits_count - a.visits_count)
      .slice(0, maxClients);

    for (const client of eligibleClients) {
      try {
        const records = await recordsSync.getClientRecords(client.id, client.phone);

        if (records && records.length > 0) {
          // Получаем ID клиента из базы через Repository
          const dbClient = await this.clientRepo.findById(client.id, this.config.COMPANY_ID);

          if (dbClient) {
            await recordsSync.saveClientVisits(dbClient.id, client.id, records);
            processed++;

            if (processed % 10 === 0) {
              logger.debug(`Visit history synced for ${processed} clients`);
            }
          }
        }

        // Задержка для соблюдения rate limits
        await delay(500);

      } catch (error) {
        logger.warn(`Failed to sync visits for client ${client.name}`, {
          error: error.message
        });
      }
    }

    logger.info(`Visit history synced for ${processed} clients`);
    return { processed };
  }

  /**
   * Обновить статус синхронизации (deprecated - не используется)
   * TODO: Удалить после полной миграции с Supabase
   */
  async updateSyncStatus(status, recordsProcessed = 0, errorMessage = null) {
    // Метод не используется в текущей реализации
    // Статус синхронизации логируется, но не сохраняется в БД
    logger.debug('updateSyncStatus called (no-op)', { status, recordsProcessed });
  }
}

module.exports = { ClientsSync };