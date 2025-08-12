/**
 * Синхронизация товарных транзакций из YClients
 * Загружает финансовые транзакции с expense_id=7 (Продажа товаров)
 */

const { supabase } = require('../database/supabase');
const logger = require('../utils/logger').child({ module: 'goods-transactions-sync' });
const { 
  YCLIENTS_CONFIG, 
  createYclientsHeaders,
  delay 
} = require('./sync-utils');
const axios = require('axios');

class GoodsTransactionsSync {
  constructor() {
    this.config = YCLIENTS_CONFIG;
    this.headers = createYclientsHeaders(true);
    this.GOODS_EXPENSE_ID = 7; // ID для "Продажа товаров"
  }

  /**
   * Синхронизировать товарные транзакции для всех клиентов
   */
  async sync() {
    const startTime = Date.now();
    
    try {
      logger.info('🛍️ Starting goods transactions synchronization...');
      
      // 1. Получаем все товарные транзакции компании
      const transactions = await this.fetchGoodsTransactions();
      
      if (!transactions || transactions.length === 0) {
        logger.info('No goods transactions found');
        return {
          success: true,
          processed: 0,
          duration: Date.now() - startTime
        };
      }
      
      logger.info(`Found ${transactions.length} goods transactions`);
      
      // 2. Группируем транзакции по клиентам
      const clientTransactions = this.groupTransactionsByClient(transactions);
      
      // 3. Обновляем данные клиентов в базе
      const result = await this.updateClientsWithGoods(clientTransactions);
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Goods transactions sync completed in ${duration}ms`, {
        processed: result.processed,
        errors: result.errors,
        totalAmount: result.totalAmount
      });
      
      return {
        success: true,
        ...result,
        duration
      };
      
    } catch (error) {
      logger.error('❌ Goods transactions sync failed', {
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
   * Получить все товарные транзакции из YClients
   */
  async fetchGoodsTransactions() {
    const allTransactions = [];
    let page = 1;
    const maxPages = 10; // Ограничение для безопасности
    
    try {
      while (page <= maxPages) {
        const url = `${this.config.BASE_URL}/transactions/${this.config.COMPANY_ID}`;
        
        const params = {
          page: page,
          count: 200, // Максимум записей на страницу
          start_date: this.getStartDate(), // За последние 2 года
          end_date: this.getEndDate()
        };
        
        logger.debug(`Fetching transactions page ${page}...`);
        
        const response = await axios.get(url, {
          headers: this.headers,
          params: params
        });
        
        if (!response.data?.success) {
          logger.warn(`Failed to fetch page ${page}`);
          break;
        }
        
        const transactions = response.data.data || [];
        
        // Фильтруем только товарные транзакции
        const goodsTransactions = transactions.filter(t => 
          t.expense_id === this.GOODS_EXPENSE_ID || 
          (t.expense?.title && t.expense.title.includes('товар')) ||
          t.sold_item_type === 'goods_transaction'
        );
        
        allTransactions.push(...goodsTransactions);
        
        // Проверяем, есть ли еще страницы
        if (transactions.length < 200) {
          break; // Последняя страница
        }
        
        page++;
        await delay(200); // Задержка между запросами
      }
      
      return allTransactions;
      
    } catch (error) {
      logger.error('Failed to fetch goods transactions', {
        error: error.message,
        page: page
      });
      throw error;
    }
  }

  /**
   * Группировать транзакции по клиентам
   */
  groupTransactionsByClient(transactions) {
    const clientMap = {};
    
    transactions.forEach(t => {
      const clientId = t.client_id;
      if (!clientId) return; // Пропускаем транзакции без клиента
      
      if (!clientMap[clientId]) {
        clientMap[clientId] = {
          client_id: clientId,
          client_name: t.client?.name || 'Unknown',
          client_phone: t.client?.phone || null,
          total_amount: 0,
          transactions_count: 0,
          purchases: []
        };
      }
      
      // Добавляем транзакцию
      clientMap[clientId].total_amount += t.amount || 0;
      clientMap[clientId].transactions_count++;
      clientMap[clientId].purchases.push({
        date: t.date,
        amount: t.amount || 0,
        document_id: t.document_id,
        comment: t.comment || '',
        account: t.account?.title || 'Unknown'
      });
    });
    
    return clientMap;
  }

  /**
   * Обновить данные клиентов с информацией о товарах
   */
  async updateClientsWithGoods(clientTransactions) {
    let processed = 0;
    let errors = 0;
    let totalAmount = 0;
    
    for (const [yclientsId, data] of Object.entries(clientTransactions)) {
      try {
        // Находим клиента в нашей базе по yclients_id
        const { data: client, error: findError } = await supabase
          .from('clients')
          .select('id, services_amount, total_spent')
          .eq('yclients_id', yclientsId)
          .eq('company_id', this.config.COMPANY_ID)
          .single();
        
        if (findError || !client) {
          logger.debug(`Client not found in database: ${yclientsId}`);
          errors++;
          continue;
        }
        
        // Подготавливаем данные для обновления
        const updateData = {
          goods_amount: data.total_amount,
          goods_count: data.transactions_count,
          goods_purchases: data.purchases,
          // Пересчитываем services_amount если нужно
          services_amount: client.total_spent - data.total_amount
        };
        
        // Обновляем клиента
        const { error: updateError } = await supabase
          .from('clients')
          .update(updateData)
          .eq('id', client.id);
        
        if (updateError) {
          logger.error(`Failed to update client ${client.id}:`, updateError);
          errors++;
        } else {
          processed++;
          totalAmount += data.total_amount;
          
          if (processed % 50 === 0) {
            logger.info(`Progress: ${processed} clients updated`);
          }
        }
        
      } catch (error) {
        logger.error(`Error processing client ${yclientsId}:`, error);
        errors++;
      }
    }
    
    return {
      processed,
      errors,
      totalAmount
    };
  }

  /**
   * Получить дату начала периода (2 года назад)
   */
  getStartDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    return date.toISOString().split('T')[0];
  }

  /**
   * Получить дату конца периода (сегодня)
   */
  getEndDate() {
    return new Date().toISOString().split('T')[0];
  }
}

module.exports = { GoodsTransactionsSync };