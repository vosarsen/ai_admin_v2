#!/usr/bin/env node

/**
 * ПОЛНАЯ синхронизация клиентов из YClients
 * 1. Получает ВСЕХ клиентов из YClients
 * 2. Обновляет существующих или создает новых
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');

class FullClientsSync {
  constructor() {
    this.COMPANY_ID = 962302;
    this.bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
    this.userToken = process.env.YCLIENTS_USER_TOKEN;
    this.stats = {
      total: 0,
      created: 0,
      updated: 0,
      errors: 0
    };
  }

  async syncAll() {
    const startTime = Date.now();
    
    console.log('\n🚀 ПОЛНАЯ СИНХРОНИЗАЦИЯ КЛИЕНТОВ ИЗ YCLIENTS');
    console.log('═══════════════════════════════════════════════════\n');
    
    try {
      // Получаем всех клиентов из YClients через пагинацию
      const allClients = await this.fetchAllClients();
      console.log(`\n📊 Получено ${allClients.length} клиентов из YClients\n`);
      
      if (allClients.length === 0) {
        console.log('❌ Не удалось получить клиентов');
        return;
      }
      
      // Получаем существующих клиентов из БД
      console.log('📋 Загружаем существующих клиентов из БД...');
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id, yclients_id')
        .eq('company_id', this.COMPANY_ID);
      
      const existingMap = new Map();
      existingClients?.forEach(c => {
        if (c.yclients_id) {
          existingMap.set(c.yclients_id, c.id);
        }
      });
      
      console.log(`✅ В БД найдено ${existingMap.size} клиентов\n`);
      
      // Готовим данные для upsert
      console.log('💾 Подготовка данных для сохранения...\n');
      
      const clientsToSave = [];
      
      for (const ycClient of allClients) {
        const clientData = {
          yclients_id: ycClient.id,
          company_id: this.COMPANY_ID,
          name: ycClient.name || 'Клиент',
          phone: this.normalizePhone(ycClient.phone) || '',
          email: ycClient.email || null,
          
          // Статистика
          visit_count: ycClient.visits_count || 0,
          total_spent: ycClient.spent || ycClient.sold_amount || 0,
          
          // Даты
          first_visit_date: ycClient.first_visit_date || null,
          last_visit_date: ycClient.last_visit_date || null,
          
          // Дополнительная информация
          birthday: ycClient.birth_date || null,
          gender: this.detectGender(ycClient.sex_id, ycClient.name),
          comment: ycClient.comment || null,
          
          // Категория клиента
          loyalty_level: this.calculateLoyaltyLevel(ycClient.visits_count, ycClient.spent),
          
          created_at: ycClient.create_date || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Удаляем пустые поля
        Object.keys(clientData).forEach(key => {
          if (clientData[key] === '' || clientData[key] === null) {
            delete clientData[key];
          }
        });
        
        clientsToSave.push(clientData);
        this.stats.total++;
      }
      
      // Сохраняем батчами
      console.log(`📦 Сохраняем ${clientsToSave.length} клиентов...\n`);
      
      const BATCH_SIZE = 100;
      for (let i = 0; i < clientsToSave.length; i += BATCH_SIZE) {
        const batch = clientsToSave.slice(i, i + BATCH_SIZE);
        const progress = Math.round((i / clientsToSave.length) * 100);
        
        console.log(`  Сохраняем клиентов ${i + 1}-${Math.min(i + BATCH_SIZE, clientsToSave.length)} (${progress}%)...`);
        
        try {
          const { data, error } = await supabase
            .from('clients')
            .upsert(batch, {
              onConflict: 'company_id,yclients_id',
              ignoreDuplicates: false
            })
            .select();
          
          if (error) {
            console.error(`  ❌ Ошибка:`, error.message);
            this.stats.errors += batch.length;
          } else {
            // Подсчитываем created vs updated
            data?.forEach(client => {
              if (existingMap.has(client.yclients_id)) {
                this.stats.updated++;
              } else {
                this.stats.created++;
              }
            });
          }
        } catch (error) {
          console.error(`  ❌ Ошибка:`, error.message);
          this.stats.errors += batch.length;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('✅ СИНХРОНИЗАЦИЯ КЛИЕНТОВ ЗАВЕРШЕНА!\n');
      console.log('📊 Итоговая статистика:');
      console.log(`  • Всего обработано: ${this.stats.total}`);
      console.log(`  • Создано новых: ${this.stats.created}`);
      console.log(`  • Обновлено существующих: ${this.stats.updated}`);
      console.log(`  • Ошибок: ${this.stats.errors}`);
      console.log(`  • Время выполнения: ${duration} секунд`);
      
      // Финальная проверка
      const { count: finalCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', this.COMPANY_ID);
      
      console.log(`\n📊 Всего клиентов в БД после синхронизации: ${finalCount}`);
      
    } catch (error) {
      console.error('\n❌ Критическая ошибка:', error);
    }
  }
  
  async fetchAllClients() {
    const allClients = [];
    let page = 1;
    let hasMore = true;
    
    console.log('📡 Получаем клиентов из YClients API...\n');
    
    while (hasMore) {
      try {
        const url = `https://api.yclients.com/api/v1/company/${this.COMPANY_ID}/clients/search`;
        
        console.log(`  Страница ${page}...`);
        
        const response = await axios.post(url, {
          fields: [],
          filters: [],
          order_by: 'id', 
          order_by_direction: 'DESC',
          limit: 300,
          page: page
        }, {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}, User ${this.userToken}`,
            'Accept': 'application/vnd.yclients.v2+json',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        
        const clients = response.data?.data || [];
        console.log(`    Получено: ${clients.length} клиентов`);
        
        if (clients.length === 0) {
          hasMore = false;
        } else {
          allClients.push(...clients);
          page++;
          
          // Проверяем, есть ли еще страницы
          if (clients.length < 300) {
            hasMore = false;
          }
          
          // Пауза между запросами
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`  ❌ Ошибка на странице ${page}:`, error.message);
        hasMore = false;
      }
    }
    
    return allClients;
  }
  
  normalizePhone(phone) {
    if (!phone) return null;
    // Удаляем все нецифровые символы
    let normalized = phone.toString().replace(/\D/g, '');
    // Заменяем 8 на 7 в начале
    if (normalized.startsWith('8') && normalized.length === 11) {
      normalized = '7' + normalized.substring(1);
    }
    // Добавляем 7 если номер 10-значный
    if (normalized.length === 10) {
      normalized = '7' + normalized;
    }
    return normalized;
  }
  
  detectGender(sexId, name) {
    // По ID из YClients
    if (sexId === 1) return 'male';
    if (sexId === 2) return 'female';
    
    // По имени (простая эвристика для русских имен)
    if (!name) return null;
    
    const femaleEndings = ['а', 'я', 'ь'];
    const lastName = name.toLowerCase();
    
    if (femaleEndings.some(ending => lastName.endsWith(ending))) {
      // Исключения для мужских имен
      const maleExceptions = ['илья', 'никита', 'данила', 'савва', 'лука', 'фома'];
      if (!maleExceptions.some(ex => lastName.includes(ex))) {
        return 'female';
      }
    }
    
    return 'male'; // По умолчанию для барбершопа
  }
  
  calculateLoyaltyLevel(visits, spent) {
    if (visits >= 20 || spent >= 50000) return 'VIP';
    if (visits >= 10 || spent >= 20000) return 'Gold';
    if (visits >= 5 || spent >= 10000) return 'Silver';
    if (visits >= 1) return 'Bronze';
    return 'New';
  }
}

// Запускаем
const sync = new FullClientsSync();
sync.syncAll().catch(console.error);