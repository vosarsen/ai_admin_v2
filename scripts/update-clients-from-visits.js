#!/usr/bin/env node

/**
 * Обновление таблицы clients данными из таблицы visits
 * Заполняет пустые поля истории и обновляет статистику
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const logger = require('../src/utils/logger').child({ module: 'update-clients' });

class ClientsUpdater {
  constructor() {
    this.BATCH_SIZE = 50;
    this.updatedCount = 0;
    this.errorCount = 0;
  }

  /**
   * Главный метод обновления
   */
  async updateAllClients() {
    const startTime = Date.now();
    
    try {
      logger.info('🔄 Starting clients update from visits data...');
      
      // Получаем всех клиентов у которых есть визиты
      const { data: clientsWithVisits } = await supabase
        .from('visits')
        .select('client_id')
        .not('client_id', 'is', null)
        .order('client_id');
      
      // Уникальные client_id
      const uniqueClientIds = [...new Set(clientsWithVisits?.map(v => v.client_id))];
      
      logger.info(`Found ${uniqueClientIds.length} clients with visits to update`);
      
      // Обрабатываем батчами
      for (let i = 0; i < uniqueClientIds.length; i += this.BATCH_SIZE) {
        const batch = uniqueClientIds.slice(i, i + this.BATCH_SIZE);
        await this.updateClientsBatch(batch);
        
        logger.info(`Progress: ${Math.min(i + this.BATCH_SIZE, uniqueClientIds.length)}/${uniqueClientIds.length} clients`);
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      logger.info(`✅ Update completed in ${duration} seconds`, {
        updated: this.updatedCount,
        errors: this.errorCount
      });
      
      return {
        success: true,
        updated: this.updatedCount,
        errors: this.errorCount,
        duration
      };
      
    } catch (error) {
      logger.error('Update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Обновить батч клиентов
   */
  async updateClientsBatch(clientIds) {
    const updates = [];
    
    for (const clientId of clientIds) {
      try {
        const updateData = await this.calculateClientData(clientId);
        if (updateData) {
          updates.push({
            id: clientId,
            ...updateData
          });
        }
      } catch (error) {
        logger.error(`Failed to calculate data for client ${clientId}:`, error.message);
        this.errorCount++;
      }
    }
    
    // Массовое обновление
    if (updates.length > 0) {
      for (const update of updates) {
        try {
          // Удаляем id из объекта обновления (нельзя обновлять id)
          const clientId = update.id;
          delete update.id;
          
          const { error } = await supabase
            .from('clients')
            .update(update)
            .eq('id', clientId);
          
          if (error) {
            logger.error(`Failed to update client ${clientId}:`, error);
            this.errorCount++;
          } else {
            this.updatedCount++;
          }
        } catch (error) {
          logger.error(`Error updating client ${clientId}:`, error.message);
          this.errorCount++;
        }
      }
    }
  }

  /**
   * Рассчитать данные для клиента на основе визитов
   */
  async calculateClientData(clientId) {
    // Получаем все визиты клиента
    const { data: visits, error } = await supabase
      .from('visits')
      .select('*')
      .eq('client_id', clientId)
      .order('visit_date', { ascending: false });
    
    if (error || !visits || visits.length === 0) {
      return null;
    }
    
    // Последние услуги (из последнего визита)
    const lastVisit = visits[0];
    const last_services = lastVisit.service_names || [];
    const last_service_ids = lastVisit.service_ids || [];
    
    // Любимые мастера (топ-3 по частоте)
    const staffFrequency = {};
    visits.forEach(v => {
      if (v.staff_id) {
        staffFrequency[v.staff_id] = (staffFrequency[v.staff_id] || 0) + 1;
      }
    });
    
    const favorite_staff_ids = Object.entries(staffFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([staffId]) => parseInt(staffId));
    
    // Предпочитаемое время (анализ времени визитов)
    const timeSlots = visits.map(v => {
      if (v.visit_time) {
        const hour = parseInt(v.visit_time.split(':')[0]);
        if (hour < 12) return 'morning';
        if (hour < 17) return 'afternoon';
        return 'evening';
      }
      return null;
    }).filter(Boolean);
    
    const slotFrequency = {};
    timeSlots.forEach(slot => {
      slotFrequency[slot] = (slotFrequency[slot] || 0) + 1;
    });
    
    const preferred_time_slots = Object.entries(slotFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([slot]) => slot);
    
    // История визитов (краткая информация о последних 10 визитах)
    const visit_history = visits.slice(0, 10).map(v => ({
      date: v.visit_date,
      services: v.service_names,
      staff: v.staff_name,
      cost: v.paid_amount || v.total_cost || 0,
      id: v.yclients_record_id
    }));
    
    // Статистика
    const visit_count = visits.length;
    const total_spent = visits.reduce((sum, v) => sum + (v.paid_amount || v.total_cost || 0), 0);
    const average_bill = visit_count > 0 ? Math.round(total_spent / visit_count) : 0;
    
    // Даты
    const first_visit_date = visits[visits.length - 1].visit_date;
    const last_visit_date = visits[0].visit_date;
    
    // Loyalty level на основе реальных данных
    let loyalty_level = 'New';
    if (visit_count >= 20 && total_spent >= 50000) {
      loyalty_level = 'VIP';
    } else if (visit_count >= 10 && total_spent >= 20000) {
      loyalty_level = 'Gold';
    } else if (visit_count >= 5 && total_spent >= 8000) {
      loyalty_level = 'Silver';
    } else if (visit_count >= 2) {
      loyalty_level = 'Bronze';
    }
    
    // Анализ предпочтений
    const serviceFrequency = {};
    visits.forEach(v => {
      v.service_names?.forEach(service => {
        serviceFrequency[service] = (serviceFrequency[service] || 0) + 1;
      });
    });
    
    const topServices = Object.entries(serviceFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([service]) => service);
    
    const preferences = {
      top_services: topServices,
      favorite_time: preferred_time_slots[0] || null,
      visit_frequency: visit_count > 0 ? Math.round(365 / visit_count) : null, // дней между визитами
      last_staff: lastVisit.staff_name,
      regular_client: visit_count >= 5
    };
    
    return {
      // Массивы
      last_services,
      last_service_ids,
      favorite_staff_ids,
      preferred_time_slots,
      visit_history,
      
      // Статистика
      visit_count,
      total_spent,
      average_bill,
      first_visit_date,
      last_visit_date,
      
      // Дополнительно
      loyalty_level,
      client_segment: loyalty_level,
      preferences,
      
      // Метаданные
      last_sync_at: new Date().toISOString()
    };
  }
}

async function main() {
  try {
    console.log('\n📊 ОБНОВЛЕНИЕ ДАННЫХ КЛИЕНТОВ ИЗ ИСТОРИИ ВИЗИТОВ');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Проверяем текущее состояние
    const { data: sample } = await supabase
      .from('clients')
      .select('last_services, favorite_staff_ids, visit_history')
      .eq('company_id', 962302)
      .gt('visit_count', 5)
      .limit(10);
    
    const emptyCount = sample?.filter(c => 
      c.last_services?.length === 0 && 
      c.favorite_staff_ids?.length === 0
    ).length || 0;
    
    console.log('Текущее состояние:');
    console.log(`  • Клиентов с пустыми полями истории: ${emptyCount}/${sample?.length || 0}`);
    console.log('');
    
    // Запускаем обновление
    const updater = new ClientsUpdater();
    const result = await updater.updateAllClients();
    
    if (result.success) {
      console.log('\n✅ ОБНОВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО!');
      console.log('═══════════════════════════════════════════════════');
      console.log(`  • Обновлено клиентов: ${result.updated}`);
      console.log(`  • Ошибок: ${result.errors}`);
      console.log(`  • Время выполнения: ${result.duration} секунд`);
      
      // Проверяем результат
      const { data: after } = await supabase
        .from('clients')
        .select('name, last_services, favorite_staff_ids, visit_history')
        .eq('company_id', 962302)
        .not('last_services', 'is', null)
        .limit(3);
      
      if (after && after.length > 0) {
        console.log('\n📋 Примеры обновленных клиентов:');
        after.forEach(client => {
          console.log(`\n  ${client.name}:`);
          console.log(`    • Последние услуги: ${client.last_services?.join(', ')}`);
          console.log(`    • Любимые мастера: ${client.favorite_staff_ids?.length || 0} мастеров`);
          console.log(`    • История визитов: ${client.visit_history?.length || 0} записей`);
        });
      }
    } else {
      console.error('\n❌ Обновление не удалось:', result.error);
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Запуск
main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});