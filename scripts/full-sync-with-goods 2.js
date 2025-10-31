#!/usr/bin/env node
/**
 * Полная синхронизация клиентов с разделением на услуги и товары
 * 
 * Этот скрипт:
 * 1. Синхронизирует всех клиентов из YClients
 * 2. Загружает историю визитов (услуги)
 * 3. Загружает финансовые транзакции (товары)
 * 4. Правильно разделяет total_spent на services_amount и goods_amount
 */

require('dotenv').config();
const logger = require('../src/utils/logger');

async function runFullSync() {
  const startTime = Date.now();
  
  try {
    logger.info('🚀 Starting FULL synchronization with goods transactions...');
    logger.info('='.repeat(60));
    
    // 1. Синхронизация клиентов с визитами
    logger.info('\n📋 Step 1: Syncing clients with visit history...');
    const { ClientsSyncOptimized } = require('../src/sync/clients-sync-optimized');
    const clientsSync = new ClientsSyncOptimized();
    
    const clientsResult = await clientsSync.sync({
      syncVisitHistory: true,
      maxVisitsSync: 10000 // Синхронизируем всех
    });
    
    logger.info(`✅ Clients synced: ${clientsResult.processed}`);
    logger.info(`   - With visits: ${clientsResult.visitsProcessed || 0}`);
    logger.info(`   - With goods: ${clientsResult.goodsProcessed || 0}`);
    
    // 2. Дополнительная синхронизация товарных транзакций
    // (уже включена в ClientsSyncOptimized, но для надежности можем запустить отдельно)
    logger.info('\n🛍️ Step 2: Ensuring goods transactions are synced...');
    const { GoodsTransactionsSync } = require('../src/sync/goods-transactions-sync');
    const goodsSync = new GoodsTransactionsSync();
    
    const goodsResult = await goodsSync.sync();
    logger.info(`✅ Goods transactions processed: ${goodsResult.processed}`);
    logger.info(`   - Total amount: ${goodsResult.totalAmount || 0} руб`);
    
    // 3. Проверка результатов
    logger.info('\n📊 Step 3: Verifying results...');
    const { supabase } = require('../src/database/supabase');
    
    // Статистика по клиентам
    const { data: stats } = await supabase
      .from('clients')
      .select('*')
      .gt('total_spent', 0);
    
    const clientsWithGoods = stats.filter(c => c.goods_amount > 0);
    const clientsWithServices = stats.filter(c => c.services_amount > 0);
    
    logger.info('\n📈 Final Statistics:');
    logger.info(`   Total clients with purchases: ${stats.length}`);
    logger.info(`   Clients with services: ${clientsWithServices.length}`);
    logger.info(`   Clients with goods: ${clientsWithGoods.length}`);
    
    // Топ клиентов по товарам
    const topGoodsClients = stats
      .filter(c => c.goods_amount > 0)
      .sort((a, b) => b.goods_amount - a.goods_amount)
      .slice(0, 5);
    
    if (topGoodsClients.length > 0) {
      logger.info('\n🏆 Top 5 clients by goods purchases:');
      topGoodsClients.forEach((c, i) => {
        const goodsPercent = Math.round(c.goods_amount * 100 / c.total_spent);
        logger.info(`   ${i + 1}. ${c.name}: ${c.goods_amount} руб (${goodsPercent}% of total)`);
      });
    }
    
    // Проверка корректности данных
    logger.info('\n🔍 Data validation:');
    let validationErrors = 0;
    
    stats.forEach(client => {
      const calculatedTotal = (client.services_amount || 0) + (client.goods_amount || 0);
      const difference = Math.abs(client.total_spent - calculatedTotal);
      
      // Допускаем небольшую погрешность из-за округления
      if (difference > 1) {
        validationErrors++;
        if (validationErrors <= 5) {
          logger.warn(`   ⚠️ ${client.name}: total_spent=${client.total_spent}, services+goods=${calculatedTotal}, diff=${difference}`);
        }
      }
    });
    
    if (validationErrors === 0) {
      logger.info('   ✅ All data is consistent!');
    } else {
      logger.warn(`   ⚠️ Found ${validationErrors} clients with data inconsistencies`);
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    logger.info('\n' + '='.repeat(60));
    logger.info(`✅ FULL SYNC COMPLETED in ${duration} seconds`);
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Full sync failed:', error);
    process.exit(1);
  }
}

// Запуск
runFullSync();