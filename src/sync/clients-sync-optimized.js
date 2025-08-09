/**
 * Оптимизированная синхронизация клиентов из YClients в Supabase
 * Использует пакетную обработку для ускорения
 */

const { supabase } = require('../database/supabase');
const logger = require('../utils/logger').child({ module: 'clients-sync-optimized' });
const { 
  YCLIENTS_CONFIG, 
  createYclientsHeaders, 
  normalizePhone,
  calculateLoyaltyLevel,
  calculateClientSegment,
  delay 
} = require('./sync-utils');
const axios = require('axios');

class ClientsSyncOptimized {
  constructor() {
    this.config = YCLIENTS_CONFIG;
    this.tableName = 'clients';
    this.BATCH_SIZE = 50; // Обрабатываем по 50 клиентов за раз
  }

  /**
   * Синхронизировать всех клиентов компании
   * @param {Object} options - Опции синхронизации
   * @returns {Promise<Object>} Результат синхронизации
   */
  async sync(options = {}) {
    const startTime = Date.now();
    const { syncVisitHistory = false, maxVisitsSync = 10000 } = options;  // Увеличено с 50 до 10000
    
    try {
      logger.info('👤 Starting OPTIMIZED clients synchronization...');
      
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

      // ОПТИМИЗАЦИЯ: Обрабатываем клиентов пакетами
      const result = await this.saveClientsBatch(clients);
      
      // Синхронизация истории визитов если включена
      if (syncVisitHistory) {
        logger.info('📅 Starting visit history sync...');
        const visitsResult = await this.syncVisitHistory(clients, maxVisitsSync);
        result.visitsProcessed = visitsResult.processed;
      }
      
      const duration = Date.now() - startTime;
      
      logger.info(`✅ Clients sync completed in ${duration}ms (${Math.round(duration/1000)} seconds)`, {
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
   * Получить всех клиентов из YClients API (без изменений)
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
   * ОПТИМИЗАЦИЯ: Сохранить клиентов пакетами
   * @param {Array} clients - Массив клиентов
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveClientsBatch(clients) {
    let processed = 0;
    let errors = 0;
    const errorDetails = [];
    
    // Разбиваем на пакеты
    for (let i = 0; i < clients.length; i += this.BATCH_SIZE) {
      const batch = clients.slice(i, i + this.BATCH_SIZE);
      
      try {
        // Подготавливаем данные для всего пакета
        const batchData = batch.map(client => this.prepareClientData(client));
        
        // Сохраняем весь пакет одним запросом
        const { error } = await supabase
          .from(this.tableName)
          .upsert(batchData, { 
            onConflict: 'yclients_id,company_id',
            ignoreDuplicates: false 
          });

        if (error) {
          errors += batch.length;
          errorDetails.push({
            batch: `${i}-${i + batch.length}`,
            error: error.message
          });
          
          logger.warn(`Failed to save batch ${i}-${i + batch.length}`, { error: error.message });
        } else {
          processed += batch.length;
          
          if (processed % 200 === 0 || processed === clients.length) {
            logger.info(`Progress: ${processed}/${clients.length} clients processed`);
          }
        }

      } catch (error) {
        errors += batch.length;
        errorDetails.push({
          batch: `${i}-${i + batch.length}`,
          error: error.message
        });
        
        logger.error('Error processing batch', {
          batch: `${i}-${i + batch.length}`,
          error: error.message
        });
      }
      
      // Небольшая задержка между пакетами чтобы не перегрузить БД
      if (i + this.BATCH_SIZE < clients.length) {
        await delay(100);
      }
    }

    if (errors > 0) {
      logger.warn(`Clients sync completed with ${errors} errors`, {
        errorCount: errors,
        firstErrors: errorDetails.slice(0, 5)
      });
    }
    
    // Добавляем статистику по total_spent
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

    return { processed, errors, errorDetails };
  }

  /**
   * Подготовить данные клиента для сохранения (без изменений)
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
   * Синхронизировать историю визитов для клиентов (без изменений)
   */
  async syncVisitHistory(clients, maxClients = 50) {
    const { ClientRecordsSync } = require('./client-records-sync');
    const recordsSync = new ClientRecordsSync();
    
    let processed = 0;
    const eligibleClients = clients
      .filter(c => c.visits_count >= 1 && c.phone)  // Изменено с >= 2 на >= 1
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
   * Обновить статус синхронизации (без изменений)
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

module.exports = { ClientsSyncOptimized };