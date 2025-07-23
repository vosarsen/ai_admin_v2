// universal-yclients-sync.js - Универсальная синхронизация ВСЕХ данных YClients -> Supabase
require('dotenv').config();
const { supabase } = require('./src/database/supabase');
const axios = require('axios');
const cron = require('node-cron');

// Конфигурация
const CONFIG = {
  COMPANY_ID: 962302,
  BASE_URL: 'https://api.yclients.com/api/v1',
  BEARER_TOKEN: process.env.YCLIENTS_BEARER_TOKEN,
  USER_TOKEN: process.env.YCLIENTS_USER_TOKEN,
  PARTNER_ID: process.env.YCLIENTS_PARTNER_ID,
  
  // Данные для получения fresh user token
  USER_LOGIN: process.env.YCLIENTS_USER_LOGIN || process.env.YCLIENTS_USER_PHONE,
  USER_PASSWORD: process.env.YCLIENTS_USER_PASSWORD,
  
  // YClients API лимиты: 200 запросов/минуту или 5 запросов/секунду
  API_LIMITS: {
    REQUESTS_PER_MINUTE: 200,
    REQUESTS_PER_SECOND: 5,
    MIN_DELAY_MS: 250,        // Минимум 250мс между запросами (4 req/sec)
    BATCH_SIZE: 200,          // Максимум записей за раз согласно документации
    MAX_RETRIES: 3
  },
  
  // Расписание синхронизации (время московское UTC+3)
  SCHEDULE: {
    SERVICES: '0 1 * * *',       // 01:00 - Услуги (редко меняются)
    STAFF: '0 2 * * *',          // 02:00 - Мастера (редко меняются) 
    CLIENTS: '0 3 * * *',        // 03:00 - Клиенты (часто меняются)
    APPOINTMENTS: '0 4 * * *',   // 04:00 - Записи (очень часто меняются)
    SCHEDULES: '0 5 * * *',      // 05:00 - Расписания мастеров
    CLEANUP: '0 6 * * *'         // 06:00 - Очистка старых данных
  }
};

class UniversalYclientsSync {
  constructor() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.isRunning = false;
    this.headers = this._createHeaders();
    this.currentUserToken = CONFIG.USER_TOKEN; // Храним актуальный user token
    
    console.log('🔄 Universal YClients Sync System initialized');
    console.log(`📅 Sync schedule (Moscow time UTC+3):`);
    Object.entries(CONFIG.SCHEDULE).forEach(([type, schedule]) => {
      console.log(`   ${type}: ${schedule}`);
    });
  }

  // =============== АВТОРИЗАЦИЯ ===============

  /**
   * Получить свежий user token через API авторизации
   */
  async refreshUserToken() {
    if (!CONFIG.USER_LOGIN || !CONFIG.USER_PASSWORD) {
      console.log('⚠️ No user credentials provided, using existing token');
      console.log(`   Current token: ${this.currentUserToken?.substring(0, 8)}...`);
      return this.currentUserToken;
    }

    try {
      console.log(`🔐 Getting fresh user token for: ${CONFIG.USER_LOGIN}...`);
      
      const response = await this._apiRequestPost('auth', {
        login: CONFIG.USER_LOGIN,
        password: CONFIG.USER_PASSWORD
      }, false); // Только bearer token для auth

      if (response.success && response.data?.data?.user_token) {
        const oldToken = this.currentUserToken?.substring(0, 8);
        this.currentUserToken = response.data.data.user_token;
        const newToken = this.currentUserToken?.substring(0, 8);
        console.log(`✅ Fresh user token obtained: ${oldToken}... → ${newToken}...`);
        return this.currentUserToken;
      } else {
        console.log('⚠️ Failed to get fresh token, using existing');
        console.log('   Response:', JSON.stringify(response.details || response, null, 2));
        return this.currentUserToken;
      }

    } catch (error) {
      console.error('💥 Error getting user token:', error.message);
      return this.currentUserToken;
    }
  }

  // =============== ОСНОВНЫЕ МЕТОДЫ СИНХРОНИЗАЦИИ ===============

  /**
   * Запуск всех задач синхронизации по расписанию
   */
  startScheduledSync() {
    if (this.isRunning) {
      console.log('⚠️ Sync already running');
      return;
    }
    
    this.isRunning = true;
    console.log('🚀 Starting scheduled synchronization tasks...');

    // Услуги - 01:00 (редко меняются)
    cron.schedule(CONFIG.SCHEDULE.SERVICES, () => {
      console.log('🛍️ Starting services sync...');
      this.syncServices().catch(console.error);
    }, { timezone: 'Europe/Moscow' });

    // Мастера - 02:00
    cron.schedule(CONFIG.SCHEDULE.STAFF, () => {
      console.log('👥 Starting staff sync...');
      this.syncStaff().catch(console.error);
    }, { timezone: 'Europe/Moscow' });

    // Клиенты - 03:00
    cron.schedule(CONFIG.SCHEDULE.CLIENTS, () => {
      console.log('👤 Starting clients sync...');
      this.syncClients().catch(console.error);
    }, { timezone: 'Europe/Moscow' });

    // Записи - 04:00 (самые важные данные)
    cron.schedule(CONFIG.SCHEDULE.APPOINTMENTS, () => {
      console.log('📅 Starting appointments sync...');
      this.syncAppointments().catch(console.error);
    }, { timezone: 'Europe/Moscow' });

    // Расписания - 05:00
    cron.schedule(CONFIG.SCHEDULE.SCHEDULES, () => {
      console.log('⏰ Starting schedules sync...');
      this.syncStaffSchedules().catch(console.error);
    }, { timezone: 'Europe/Moscow' });

    // Очистка - 06:00
    cron.schedule(CONFIG.SCHEDULE.CLEANUP, () => {
      console.log('🗑️ Starting cleanup...');
      this.cleanupOldData().catch(console.error);
    }, { timezone: 'Europe/Moscow' });

    console.log('✅ All sync tasks scheduled successfully');
  }

  /**
   * Принудительная синхронизация всех данных (для первого запуска)
   */
  async fullSync() {
    console.log('🔄 STARTING FULL SYNCHRONIZATION');
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    const results = {};

    try {
      // Сначала получаем свежий user token
      await this.refreshUserToken();
      
      // Синхронизируем компанию первой
      console.log('\n1/6 🏢 Syncing company...');
      results.company = await this.syncCompany();
      await this._delay(5000); // 5 сек пауза
      
      // Синхронизируем в правильном порядке (услуги -> мастера -> клиенты -> записи)
      console.log('\n2/6 🛍️ Syncing services...');
      results.services = await this.syncServices();
      await this._delay(5000); // 5 сек пауза

      console.log('\n3/6 👥 Syncing staff...');
      results.staff = await this.syncStaff();
      await this._delay(5000);

      console.log('\n4/6 👤 Syncing clients...');
      results.clients = await this.syncClients();
      await this._delay(5000);

      console.log('\n5/6 📅 Syncing appointments...');
      results.appointments = await this.syncAppointments();
      await this._delay(5000);

      console.log('\n6/6 ⏰ Syncing schedules...');
      results.schedules = await this.syncStaffSchedules();

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n🎉 FULL SYNC COMPLETED in ${duration}s`);
      console.log('Results:', results);

      return results;

    } catch (error) {
      console.error('💥 Full sync failed:', error.message);
      throw error;
    }
  }

  // =============== СИНХРОНИЗАЦИЯ КОМПАНИИ ===============

  async syncCompany() {
    const startTime = Date.now();
    
    try {
      console.log('📋 Fetching company info from YClients...');
      
      const endpoint = `company/${CONFIG.COMPANY_ID}`;
      const response = await this._apiRequest(endpoint);
      
      if (!response.success || !response.data?.data) {
        console.error('❌ Failed to fetch company data');
        return { processed: 0, errors: 1, total: 1 };
      }
      
      const companyData = response.data.data;
      console.log(`✅ Fetched company: ${companyData.title}`);
      
      // Подготавливаем данные для сохранения
      const preparedData = {
        company_id: CONFIG.COMPANY_ID,
        yclients_id: companyData.id,
        title: companyData.title || 'Unnamed Company',
        address: companyData.address || '',
        phone: companyData.phone || '',
        email: companyData.email || '',
        website: companyData.site || '',
        timezone: companyData.timezone_name || 'Europe/Moscow',
        working_hours: companyData.schedule || {},
        coordinate_lat: companyData.coordinate_lat || null,
        coordinate_lon: companyData.coordinate_lon || null,
        currency: companyData.currency || 'RUB',
        raw_data: companyData,
        last_sync_at: new Date().toISOString()
      };
      
      // Сохраняем в Supabase
      const { error } = await supabase
        .from('companies')
        .upsert(preparedData, {
          onConflict: 'company_id',
          returning: 'minimal'
        });
      
      if (error) {
        console.error('❌ Database save error:', error.message);
        return { processed: 0, errors: 1, total: 1 };
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ Company sync completed in ${duration}ms`);
      
      return { processed: 1, errors: 0, total: 1 };
      
    } catch (error) {
      console.error('💥 Company sync error:', error.message);
      return { processed: 0, errors: 1, total: 1 };
    }
  }

  // =============== СИНХРОНИЗАЦИЯ УСЛУГ ===============

  async syncServices() {
    const tableName = 'services';
    const startTime = Date.now();
    
    try {
      await this._updateSyncStatus(tableName, 'running', 0);
      
      console.log('📋 Fetching services from YClients...');
      const response = await this._apiRequest(`company/${CONFIG.COMPANY_ID}/services`, {}, true); // Пробуем с user авторизацией
      
      if (!response.success || !response.data?.data) {
        throw new Error('Failed to fetch services from API');
      }

      const services = response.data.data;
      console.log(`✅ Fetched ${services.length} services from API`);

      let processed = 0;
      let errors = 0;

      for (const service of services) {
        try {
          const serviceData = {
            yclients_id: service.id,
            company_id: CONFIG.COMPANY_ID,
            title: service.title || 'Unnamed Service',
            category_id: service.category_id || null,
            category_title: service.category?.title || null,
            price_min: service.price_min || 0,
            price_max: service.price_max || service.price_min || 0,
            discount: service.discount || 0,
            duration: service.seance_length || null,
            seance_length: service.seance_length || null,
            is_active: service.active === 1 || service.active === "1",
            is_bookable: service.bookable === 1 || service.bookable === "1" || service.bookable === undefined,
            description: service.comment || null,
            weight: service.weight || 0,
            last_sync_at: new Date().toISOString(),
            raw_data: service
          };

          const { error } = await supabase
            .from('services')
            .upsert(serviceData, { onConflict: 'yclients_id,company_id' });

          if (error) {
            console.log(`   ❌ ${service.title}: ${error.message}`);
            errors++;
          } else {
            processed++;
            if (processed % 10 === 0) {
              console.log(`   📊 Processed ${processed}/${services.length} services`);
            }
          }

        } catch (error) {
          console.error(`   💥 Error processing service ${service.title}:`, error.message);
          errors++;
        }
      }

      const duration = Date.now() - startTime;
      await this._updateSyncStatus(tableName, 'completed', processed, null, duration);

      console.log(`✅ Services sync completed: ${processed} processed, ${errors} errors`);
      return { processed, errors, total: services.length };

    } catch (error) {
      await this._updateSyncStatus(tableName, 'failed', 0, error.message);
      throw error;
    }
  }

  // =============== СИНХРОНИЗАЦИЯ МАСТЕРОВ ===============

  async syncStaff() {
    const tableName = 'staff';
    const startTime = Date.now();
    
    try {
      await this._updateSyncStatus(tableName, 'running', 0);
      
      console.log('📋 Fetching staff from YClients...');
      const response = await this._apiRequest(`book_staff/${CONFIG.COMPANY_ID}`, {}, true); // Пробуем с user авторизацией
      
      if (!response.success || !response.data?.data) {
        throw new Error('Failed to fetch staff from API');
      }

      const staff = response.data.data;
      console.log(`✅ Fetched ${staff.length} staff members from API`);

      // ✅ НОВАЯ ЛОГИКА: Сначала получаем все услуги с привязкой к мастерам
      console.log('📋 Fetching services to get staff assignments...');
      const servicesResponse = await this._apiRequest(`company/${CONFIG.COMPANY_ID}/services`, {}, true); // Пробуем с user авторизацией
      
      // Создаем карту: мастер -> его услуги
      const staffServicesMap = {};
      
      if (servicesResponse.success && servicesResponse.data?.data) {
        const services = servicesResponse.data.data;
        
        // Проходим по всем услугам и собираем данные о мастерах
        services.forEach(service => {
          if (service.staff && Array.isArray(service.staff)) {
            service.staff.forEach(staffInfo => {
              const staffId = staffInfo.id;
              if (!staffServicesMap[staffId]) {
                staffServicesMap[staffId] = [];
              }
              staffServicesMap[staffId].push(service.id);
            });
          }
        });
        
        console.log(`📊 Service assignments found for ${Object.keys(staffServicesMap).length} staff members`);
      }

      let processed = 0;
      let errors = 0;

      for (const master of staff) {
        try {
          // Получаем услуги мастера из карты
          const serviceIds = staffServicesMap[master.id] || [];
          
          console.log(`   👤 ${master.name}: ${serviceIds.length} услуг`);
          
          // Если услуг нет и это барбер, предупреждаем
          if (serviceIds.length === 0 && master.bookable) {
            console.log(`   ⚠️ ${master.name} bookable but no services assigned`);
          }

          const staffData = {
            yclients_id: master.id,
            company_id: CONFIG.COMPANY_ID,
            is_active: master.bookable === true || false,
            specialization: master.specialization || null,
            position: master.position?.title || master.specialization || 'Мастер',
            is_bookable: master.bookable === true || false,  // По умолчанию false если не указано
            rating: master.rating ? parseFloat(master.rating) : null,
            votes_count: master.votes_count || 0,
            comments_count: master.comments_count || 0,
            avatar_url: master.avatar_big || master.avatar || null,
            information: master.information || null,
            service_ids: serviceIds,
            email: master.email || null,
            phone: master.phone || null,
            telegram: master.telegram || null,
            experience_years: master.experience_years || null,
            level_name: master.level?.title || null,
            last_sync_at: new Date().toISOString(),
            raw_data: master
          };

          const { error } = await supabase
            .from('staff')
            .upsert(staffData, { onConflict: 'yclients_id,company_id' });

          if (error) {
            console.log(`   ❌ ${master.name}: ${error.message}`);
            errors++;
          } else {
            processed++;
            console.log(`   ✅ ${master.name} (${serviceIds.length} услуг)`);
          }

          // Задержка между запросами услуг
          await this._delay(200);

        } catch (error) {
          console.error(`   💥 Error processing staff ${master.name}:`, error.message);
          errors++;
        }
      }

      const duration = Date.now() - startTime;
      await this._updateSyncStatus(tableName, 'completed', processed, null, duration);

      console.log(`✅ Staff sync completed: ${processed} processed, ${errors} errors`);
      return { processed, errors, total: staff.length };

    } catch (error) {
      await this._updateSyncStatus(tableName, 'failed', 0, error.message);
      throw error;
    }
  }

  // =============== СИНХРОНИЗАЦИЯ КЛИЕНТОВ ===============

  async syncClients() {
    const tableName = 'clients';
    const startTime = Date.now();
    
    try {
      await this._updateSyncStatus(tableName, 'running', 0);
      
      // Получаем свежий user token если есть креды
      await this.refreshUserToken();
      
      console.log('📋 Fetching clients from YClients...');
      
      // ✅ ИСПРАВЛЕНО: Используем POST метод согласно документации API
      let allClients = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore && page <= 50) { // Лимит 50 страниц для безопасности
        // Используем user авторизацию для clients/search
        const response = await this._apiRequestPost(`company/${CONFIG.COMPANY_ID}/clients/search`, {
          page: page,
          page_size: 200, // Максимум согласно документации
          fields: [
            "id", "name", "phone", "email", "discount",
            "first_visit_date", "last_visit_date", 
            "sold_amount", "visits_count"
          ],
          order_by: "name",
          order_by_direction: "ASC"
        }, true); // Требует user авторизации
        
        if (!response.success || !response.data?.data) {
          console.log(`   ⚠️ Page ${page}: No data received (status: ${response.status})`);
          if (response.details) {
            console.log(`   📄 Error details:`, JSON.stringify(response.details, null, 2));
          }
          break;
        }
        
        const clients = response.data.data;
        allClients = allClients.concat(clients);
        
        console.log(`   📄 Page ${page}: ${clients.length} clients`);
        
        // Проверяем есть ли еще данные
        const totalCount = response.data?.meta?.total_count || 0;
        const processedCount = page * 200;
        hasMore = processedCount < totalCount && clients.length === 200;
        
        page++;
        
        // Соблюдаем rate limit: максимум 5 запросов в секунду
        await this._delay(250); // 250мс = 4 запроса в секунду
      }

      console.log(`✅ Fetched ${allClients.length} clients from API`);

      let processed = 0;
      let errors = 0;

      for (const client of allClients) {
        try {
          const clientData = {
            yclients_id: client.id,
            company_id: CONFIG.COMPANY_ID,
            name: client.name || 'Unnamed Client',
            phone: this._normalizePhone(client.phone),
            raw_phone: client.phone,
            email: client.email || null,
            discount: client.discount || 0,
            branch_ids: client.branch_ids || [],
            tags: client.tags || [],
            status: client.status || null,
            source: 'yclients',
            visit_count: client.visits_count || 0,
            total_spent: client.spent || 0,
            first_visit_date: client.first_visit_date || null,
            last_visit_date: client.last_visit_date || null,
            last_services: client.last_services || [],
            visit_history: client.visit_history || [],
            preferences: client.custom_fields || {},
            loyalty_level: this._calculateLoyaltyLevel(client.visits_count, client.spent),
            client_segment: this._calculateClientSegment(client.visits_count, client.spent),
            average_bill: client.visits_count > 0 ? (client.spent / client.visits_count) : 0,
            blacklisted: client.status === 'blocked',
            notes: client.comment || null,
            last_sync_at: new Date().toISOString(),
            created_by_ai: false
          };

          const { error } = await supabase
            .from('clients')
            .upsert(clientData, { onConflict: 'yclients_id,company_id' });

          if (error) {
            errors++;
            if (errors < 5) { // Показываем только первые 5 ошибок
              console.log(`   ❌ ${client.name}: ${error.message}`);
            }
          } else {
            processed++;
            if (processed % 100 === 0) {
              console.log(`   📊 Processed ${processed}/${allClients.length} clients`);
            }
          }

        } catch (error) {
          errors++;
          if (errors < 5) {
            console.error(`   💥 Error processing client ${client.name}:`, error.message);
          }
        }
      }

      const duration = Date.now() - startTime;
      await this._updateSyncStatus(tableName, 'completed', processed, null, duration);

      console.log(`✅ Clients sync completed: ${processed} processed, ${errors} errors`);
      return { processed, errors, total: allClients.length };

    } catch (error) {
      await this._updateSyncStatus(tableName, 'failed', 0, error.message);
      throw error;
    }
  }

  // =============== СИНХРОНИЗАЦИЯ ЗАПИСЕЙ ===============

  async syncAppointments() {
    const tableName = 'appointments_cache';
    const startTime = Date.now();
    
    try {
      await this._updateSyncStatus(tableName, 'running', 0);
      
      console.log('📋 Fetching appointments from YClients...');
      
      // Получаем записи за последние 30 дней и на 30 дней вперед
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);
      const dateTo = new Date();
      dateTo.setDate(dateTo.getDate() + 30);
      
      // ✅ ИСПРАВЛЕНО: Используем правильный endpoint согласно PHP SDK
      console.log(`   🔍 Using endpoint: records/${CONFIG.COMPANY_ID}`);
      const response = await this._apiRequest(`records/${CONFIG.COMPANY_ID}`, {
        start_date: dateFrom.toISOString().split('T')[0],
        end_date: dateTo.toISOString().split('T')[0],
        count: 200 // Соблюдаем лимит API
      }, true); // Требует user авторизации
      
      if (!response || !response.success || !response.data?.data) {
        console.log('⚠️ Appointment endpoint failed, skipping appointments sync');
        const duration = Date.now() - startTime;
        await this._updateSyncStatus(tableName, 'completed', 0, 'No appointment data available', duration);
        return { processed: 0, errors: 0, total: 0, message: 'No appointment data available' };
      } else {
        console.log(`   ✅ Success with endpoint: records/${CONFIG.COMPANY_ID}`);
      }

      const appointments = response.data.data;
      console.log(`✅ Fetched ${appointments.length} appointments from API`);

      let processed = 0;
      let errors = 0;

      for (const appointment of appointments) {
        try {
          // Находим клиента в нашей базе
          const { data: clientData } = await supabase
            .from('clients')
            .select('id')
            .eq('yclients_id', appointment.client_id)
            .single();

          const appointmentData = {
            yclients_record_id: appointment.id,
            client_id: clientData?.id || null,
            company_id: CONFIG.COMPANY_ID,
            service_id: appointment.services?.[0]?.id || null,
            staff_id: appointment.staff_id,
            appointment_datetime: appointment.datetime,
            status: appointment.status || 'confirmed',
            cost: appointment.cost || 0,
            paid_amount: appointment.paid_full || 0,
            attendance: appointment.attendance,
            visit_length: appointment.visit_length || null,
            comment: appointment.comment || null,
            staff_comment: appointment.staff_comment || null,
            is_cancelled: appointment.status === 'cancelled',
            cancellation_reason: appointment.cancellation_reason || null,
            sms_before: appointment.sms_before || null,
            email_before: appointment.email_before || null,
            synced_at: new Date().toISOString(),
            raw_data: appointment
          };

          const { error } = await supabase
            .from('appointments_cache')
            .upsert(appointmentData, { onConflict: 'yclients_record_id' });

          if (error) {
            errors++;
            if (errors < 5) {
              console.log(`   ❌ Appointment ${appointment.id}: ${error.message}`);
            }
          } else {
            processed++;
            if (processed % 50 === 0) {
              console.log(`   📊 Processed ${processed}/${appointments.length} appointments`);
            }
          }

        } catch (error) {
          errors++;
          if (errors < 5) {
            console.error(`   💥 Error processing appointment ${appointment.id}:`, error.message);
          }
        }
      }

      const duration = Date.now() - startTime;
      await this._updateSyncStatus(tableName, 'completed', processed, null, duration);

      console.log(`✅ Appointments sync completed: ${processed} processed, ${errors} errors`);
      return { processed, errors, total: appointments.length };

    } catch (error) {
      await this._updateSyncStatus(tableName, 'failed', 0, error.message);
      throw error;
    }
  }

  // =============== СИНХРОНИЗАЦИЯ РАСПИСАНИЙ ===============

  async syncStaffSchedules() {
    const tableName = 'staff_schedules';
    const startTime = Date.now();
    
    try {
      await this._updateSyncStatus(tableName, 'running', 0);
      
      // Получаем всех активных мастеров
      const { data: staff } = await supabase
        .from('staff')
        .select('yclients_id, name')
        .eq('company_id', CONFIG.COMPANY_ID)
        .eq('is_active', true);

      if (!staff || staff.length === 0) {
        console.log('⚠️ No active staff found for schedule sync');
        return { processed: 0, errors: 0, total: 0 };
      }

      console.log(`📋 Syncing schedules for ${staff.length} staff members...`);

      let processed = 0;
      let errors = 0;
      let totalDays = 0;

      // Получаем расписание на следующие 14 дней  
      const today = new Date();
      
      for (const master of staff) {
        try {
          console.log(`   📅 Processing staff: ${master.name} (ID: ${master.yclients_id})`);
          
          // ✅ ИСПРАВЛЕНО: Используем book_dates endpoint для определения рабочих дней
          const bookDatesResponse = await this._apiRequest(`book_dates/${CONFIG.COMPANY_ID}`, {
            staff_id: master.yclients_id,
            date: today.toISOString().split('T')[0] // Дата для месяца
          });

          let workingDates = [];
          let bookingDates = [];
          
          if (bookDatesResponse.success && bookDatesResponse.data?.data) {
            const data = bookDatesResponse.data.data;
            workingDates = data.working_dates || [];
            bookingDates = data.booking_dates || [];
            
            console.log(`   📊 Working dates found: ${workingDates.length}, Booking dates: ${bookingDates.length}`);
          }

          // Обрабатываем следующие 14 дней
          for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const dateTimestamp = Math.floor(date.getTime() / 1000); // Unix timestamp

            try {
              // ✅ ИСПРАВЛЕНО: Сравниваем строки дат, а не timestamps
              const isWorking = workingDates.includes(dateStr);
              const hasBookingSlots = bookingDates.includes(dateStr);
              
              // Debug logging (disabled for production)
              // if (process.env.NODE_ENV === 'development' && i < 3) {
              //   console.log(`   🔍 DEBUG ${dateStr}:`);
              //   console.log(`      Date string: ${dateStr}`);
              //   console.log(`      Working dates sample: [${workingDates.slice(0, 3).join(', ')}]`);
              //   console.log(`      Is working: ${isWorking}, Has slots: ${hasBookingSlots}`);
              // }
              
              let workStart = null;
              let workEnd = null;
              let workingHours = {};

              // Если день рабочий, получаем детальное расписание
              if (isWorking) {
                try {
                  const seancesResponse = await this._apiRequest(`timetable/seances/${CONFIG.COMPANY_ID}/${master.yclients_id}/${dateStr}`, {}, true);
                  
                  if (seancesResponse.success && seancesResponse.data?.data) {
                    const schedule = seancesResponse.data.data;
                    workStart = schedule.start_time || null;
                    workEnd = schedule.end_time || null;
                    workingHours = schedule;
                  }
                  
                  await this._delay(100); // Пауза между запросами детального расписания
                } catch (seanceError) {
                  console.log(`   ⚠️ Could not get detailed schedule for ${master.name} on ${dateStr}: ${seanceError.message}`);
                  // Не ломаем процесс, если не удалось получить детальное расписание
                }
              }

              const scheduleData = {
                staff_id: master.yclients_id,
                staff_name: master.name,
                date: dateStr,
                is_working: isWorking, // ✅ ИСПРАВЛЕНО: Используем данные из working_dates
                work_start: workStart,
                work_end: workEnd,
                working_hours: workingHours,
                has_booking_slots: hasBookingSlots, // Дополнительная информация
                last_updated: new Date().toISOString()
              };

              const { error } = await supabase
                .from('staff_schedules')
                .upsert(scheduleData, { onConflict: 'staff_id,date' });

              if (error) {
                errors++;
                console.error(`   💥 DB Error for ${master.name} on ${dateStr}:`, error.message);
              } else {
                processed++;
                if (isWorking) {
                  console.log(`   ✅ ${master.name} ${dateStr}: WORKING (${workStart || 'N/A'} - ${workEnd || 'N/A'})`);
                }
              }

              totalDays++;

            } catch (dayError) {
              errors++;
              console.error(`   💥 Error processing ${master.name} on ${dateStr}:`, dayError.message);
            }
          }

          // Пауза между мастерами
          await this._delay(300);

        } catch (masterError) {
          errors++;
          console.error(`   💥 Error processing master ${master.name}:`, masterError.message);
        }
      }

      const duration = Date.now() - startTime;
      await this._updateSyncStatus(tableName, 'completed', processed, null, duration);

      console.log(`✅ Schedules sync completed: ${processed} processed, ${errors} errors, ${totalDays} total days`);
      return { processed, errors, total: totalDays };

    } catch (error) {
      await this._updateSyncStatus(tableName, 'failed', 0, error.message);
      throw error;
    }
  }

  // =============== ОЧИСТКА СТАРЫХ ДАННЫХ ===============

  async cleanupOldData() {
    console.log('🗑️ Starting cleanup of old data...');
    
    try {
      // Удаляем старые записи (старше 90 дней)
      const { data: oldAppointments } = await supabase
        .from('appointments_cache')
        .delete()
        .lt('appointment_datetime', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      // Удаляем старые расписания (старше 30 дней)
      const { data: oldSchedules } = await supabase
        .from('staff_schedules')
        .delete()
        .lt('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      // Удаляем старые логи сообщений (старше 30 дней)
      const { data: oldLogs } = await supabase
        .from('message_logs')
        .delete()
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      console.log('✅ Cleanup completed');
      return { success: true };

    } catch (error) {
      console.error('💥 Cleanup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // =============== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===============

  _createHeaders() {
    return this._createUserHeaders(); // По умолчанию используем user авторизацию
  }

  _createPartnerHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.api.v2+json',
      'Authorization': `Bearer ${CONFIG.BEARER_TOKEN}`,
      'X-Partner-Id': CONFIG.PARTNER_ID,
      'User-Agent': 'AI-Admin-Universal-Sync/1.0.0'
    };
  }

  _createUserHeaders() {
    // Попробуем разные варианты авторизации
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.api.v2+json',
      'Authorization': `Bearer ${CONFIG.BEARER_TOKEN}, User ${this.currentUserToken}`,
      'X-Partner-Id': CONFIG.PARTNER_ID,
      'User-Agent': 'AI-Admin-Universal-Sync/1.0.0'
    };
    
    // Добавляем дополнительные заголовки для user авторизации
    if (this.currentUserToken) {
      headers['X-User-Token'] = this.currentUserToken;
    }
    
    return headers;
  }

  async _apiRequest(endpoint, params = {}, requiresUserAuth = false) {
    // Rate limiting
    await this._enforceRateLimit();
    
    const url = `${CONFIG.BASE_URL}/${endpoint}`;
    
    // Выбираем заголовки в зависимости от требований авторизации
    const headers = requiresUserAuth ? this._createUserHeaders() : this._createPartnerHeaders();
    
    try {
      const response = await axios.get(url, { 
        headers, 
        params 
      });
      
      this.requestCount++;
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error(`API Request failed: ${url}`, error.response?.status, error.message);
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  async _apiRequestPost(endpoint, data = {}, requiresUserAuth = false) {
    // Rate limiting
    await this._enforceRateLimit();
    
    const url = `${CONFIG.BASE_URL}/${endpoint}`;
    
    // Выбираем заголовки в зависимости от требований авторизации
    const headers = requiresUserAuth ? this._createUserHeaders() : this._createPartnerHeaders();
    
    // Отладочная информация убрана после успешного тестирования
    
    try {
      const response = await axios.post(url, data, { 
        headers
      });
      
      this.requestCount++;
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error(`API POST Request failed: ${url}`, error.response?.status, error.message);
      if (error.response?.data) {
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        details: error.response?.data
      };
    }
  }

  async _enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < CONFIG.API_LIMITS.MIN_DELAY_MS) {
      const delay = CONFIG.API_LIMITS.MIN_DELAY_MS - timeSinceLastRequest;
      await this._delay(delay);
    }
    
    this.lastRequestTime = Date.now();
  }

  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _updateSyncStatus(tableName, status, recordsProcessed = 0, errorMessage = null, duration = null) {
    try {
      const syncData = {
        table_name: tableName,
        company_id: CONFIG.COMPANY_ID,
        last_sync_at: new Date().toISOString(),
        sync_status: status,
        records_processed: recordsProcessed,
        error_message: errorMessage,
        sync_duration_ms: duration
      };

      await supabase
        .from('sync_status')
        .upsert(syncData, { onConflict: 'table_name,company_id' });

    } catch (error) {
      console.error('Failed to update sync status:', error.message);
    }
  }

  _normalizePhone(phone) {
    if (!phone) return null;
    return phone.replace(/\D/g, '').replace(/^8/, '7');
  }

  _calculateLoyaltyLevel(visitsCount, totalSpent) {
    if (visitsCount >= 20 && totalSpent >= 50000) return 'VIP';
    if (visitsCount >= 10 && totalSpent >= 20000) return 'Gold';
    if (visitsCount >= 5 && totalSpent >= 8000) return 'Silver';
    if (visitsCount >= 2) return 'Bronze';
    return 'New';
  }

  _calculateClientSegment(visitsCount, totalSpent) {
    return this._calculateLoyaltyLevel(visitsCount, totalSpent);
  }

  // =============== ПУБЛИЧНЫЕ МЕТОДЫ ===============

  /**
   * Получить статус синхронизации
   */
  async getSyncStatus() {
    try {
      const { data } = await supabase
        .from('sync_status')
        .select('*')
        .eq('company_id', CONFIG.COMPANY_ID)
        .order('last_sync_at', { ascending: false });

      return data || [];
    } catch (error) {
      console.error('Failed to get sync status:', error.message);
      return [];
    }
  }

  /**
   * Остановить все задачи синхронизации
   */
  stopSync() {
    this.isRunning = false;
    console.log('⏹️ Sync stopped');
  }
}

// =============== ЗАПУСК ===============

async function main() {
  const sync = new UniversalYclientsSync();
  
  // Проверяем аргументы командной строки
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'full':
        console.log('🚀 Running full synchronization...');
        await sync.fullSync();
        break;
        
      case 'services':
        await sync.syncServices();
        break;
        
      case 'staff':
        await sync.syncStaff();
        break;
        
      case 'clients':
        await sync.syncClients();
        break;
        
      case 'appointments':
        await sync.syncAppointments();
        break;
        
      case 'schedules':
        await sync.syncStaffSchedules();
        break;
        
      case 'status':
        const status = await sync.getSyncStatus();
        console.log('📊 Sync Status:');
        console.table(status);
        break;
        
      case 'schedule':
        console.log('⏰ Starting scheduled sync...');
        sync.startScheduledSync();
        console.log('📅 Scheduled sync is now running. Press Ctrl+C to stop.');
        // Держим процесс запущенным
        process.on('SIGINT', () => {
          console.log('\n⏹️ Stopping scheduled sync...');
          sync.stopSync();
          process.exit(0);
        });
        break;
        
      default:
        console.log('🔄 UNIVERSAL YCLIENTS SYNC');
        console.log('=' .repeat(40));
        console.log('Usage:');
        console.log('  node universal-yclients-sync.js full        - Full sync all data');
        console.log('  node universal-yclients-sync.js services    - Sync services only');
        console.log('  node universal-yclients-sync.js staff       - Sync staff only');
        console.log('  node universal-yclients-sync.js clients     - Sync clients only');
        console.log('  node universal-yclients-sync.js appointments- Sync appointments only');
        console.log('  node universal-yclients-sync.js schedules   - Sync schedules only');
        console.log('  node universal-yclients-sync.js status      - Show sync status');
        console.log('  node universal-yclients-sync.js schedule    - Start scheduled sync');
        break;
    }
    
    if (command !== 'schedule') {
      process.exit(0);
    }
    
  } catch (error) {
    console.error('💥 Command failed:', error.message);
    process.exit(1);
  }
}

// Запуск только если файл выполняется напрямую
if (require.main === module) {
  main();
}

module.exports = { UniversalYclientsSync };