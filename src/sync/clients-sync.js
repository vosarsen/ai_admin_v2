/**
 * Синхронизация клиентов из YClients в Supabase
 */

const { supabase } = require('../database/supabase');
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
   * Сохранить клиентов в Supabase
   * @param {Array} clients - Массив клиентов
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveClients(clients) {
    let processed = 0;
    let errors = 0;
    const errorDetails = [];

    for (const client of clients) {
      try {
        const clientData = this.prepareClientData(client);
        
        const { error } = await supabase
          .from(this.tableName)
          .upsert(clientData, { 
            onConflict: 'yclients_id,company_id',
            ignoreDuplicates: false 
          });

        if (error) {
          errors++;
          errorDetails.push({
            client: client.name,
            error: error.message
          });
          
          if (errors <= 5) {
            logger.warn(`Failed to save client: ${client.name}`, { error: error.message });
          }
        } else {
          processed++;
          
          if (processed % 100 === 0) {
            logger.debug(`Progress: ${processed}/${clients.length} clients processed`);
          }
        }

      } catch (error) {
        errors++;
        errorDetails.push({
          client: client.name || 'Unknown',
          error: error.message
        });
        
        if (errors <= 5) {
          logger.error('Error processing client', {
            client: client.name,
            error: error.message
          });
        }
      }
    }

    if (errors > 0) {
      logger.warn(`Clients sync completed with ${errors} errors`, {
        errorCount: errors,
        firstErrors: errorDetails.slice(0, 5)
      });
    }

    return { processed, errors, errorDetails };
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
          // Получаем ID клиента из базы
          const { data: dbClient } = await supabase
            .from(this.tableName)
            .select('id')
            .eq('yclients_id', client.id)
            .eq('company_id', this.config.COMPANY_ID)
            .single();
          
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
   * Обновить статус синхронизации
   * @param {string} status - Статус синхронизации
   * @param {number} recordsProcessed - Количество обработанных записей
   * @param {string} errorMessage - Сообщение об ошибке
   */
  async updateSyncStatus(status, recordsProcessed = 0, errorMessage = null) {
    try {
      await supabase
        .from('sync_status')
        .upsert({
          table_name: this.tableName,
          company_id: this.config.COMPANY_ID,
          sync_status: status,
          last_sync_at: new Date().toISOString(),
          records_processed: recordsProcessed,
          error_message: errorMessage
        }, {
          onConflict: 'table_name,company_id'
        });
    } catch (error) {
      logger.error('Failed to update sync status', { error: error.message });
    }
  }
}

module.exports = { ClientsSync };