// src/services/ai-admin-v2/modules/data-loader.js
// Migrated from Supabase to PostgreSQL (2025-11-26)
const postgres = require('../../../database/postgres');
const logger = require('../../../utils/logger').child({ module: 'ai-admin-v2:data-loader' });
const { CompanyInfoSync } = require('../../../sync/company-info-sync');
const companyInfoSync = new CompanyInfoSync();
const InternationalPhone = require('../../../utils/international-phone');

// Repositories
const {
  ClientRepository,
  ServiceRepository,
  StaffRepository,
  StaffScheduleRepository,
  DialogContextRepository,
  CompanyRepository,
  BookingRepository
} = require('../../../repositories');

class DataLoader {
  constructor() {
    // Initialize repositories lazily (pool may not be ready at import time)
    this._repos = null;
  }

  get repos() {
    if (!this._repos && postgres.pool) {
      this._repos = {
        client: new ClientRepository(postgres.pool),
        service: new ServiceRepository(postgres.pool),
        staff: new StaffRepository(postgres.pool),
        schedule: new StaffScheduleRepository(postgres.pool),
        context: new DialogContextRepository(postgres.pool),
        company: new CompanyRepository(postgres.pool),
        booking: new BookingRepository(postgres.pool)
      };
    }
    return this._repos;
  }

  /**
   * Input validation
   * PostgreSQL uses parameterized queries, so sanitization is handled
   */
  validateInput(input, type = 'any') {
    if (input === null || input === undefined) return input;

    switch (type) {
      case 'companyId':
        const numValue = typeof input === 'string' ? parseInt(input, 10) : input;
        if (isNaN(numValue)) {
          throw new Error(`Invalid ${type}: ${input}`);
        }
        return numValue;

      case 'number':
        if (typeof input !== 'number' || isNaN(input)) {
          throw new Error(`Invalid ${type}: ${input}`);
        }
        return input;

      case 'phone':
        if (typeof input !== 'string' || !input.match(/^\+?\d{10,15}$/)) {
          logger.warn(`Invalid phone format: ${input}`);
        }
        return input;

      default:
        return input;
    }
  }

  /**
   * Load company information
   */
  async loadCompany(companyId) {
    try {
      const safeCompanyId = this.validateInput(companyId, 'companyId');

      const data = await this.repos?.company?.findById(safeCompanyId);

      if (!data) {
        logger.info(`Company ${companyId} not found in DB, syncing from YClients...`);
        const syncedData = await companyInfoSync.syncCompanyInfo(companyId);
        return syncedData;
      }

      // Check if data is stale (older than 24 hours)
      if (data.updated_at) {
        const lastUpdate = new Date(data.updated_at);
        const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

        if (hoursSinceUpdate > 24) {
          logger.info(`Company ${companyId} data is ${hoursSinceUpdate.toFixed(1)} hours old, refreshing...`);
          try {
            const syncedData = await companyInfoSync.syncCompanyInfo(companyId);
            return syncedData;
          } catch (syncError) {
            logger.error('Failed to refresh company data, using cached:', syncError);
          }
        }
      }

      // Add business_type from raw_data if missing
      if (!data.business_type && data.raw_data?.short_descr) {
        data.business_type = this.detectBusinessType(data.raw_data.short_descr);
      }

      return data;
    } catch (error) {
      logger.error(`Error loading company ${companyId}:`, error);

      // Return minimal data so bot can continue
      const config = require('../../../config');
      return {
        company_id: companyId,
        title: config.company?.defaultTitle || 'Салон красоты',
        address: config.company?.defaultAddress || '',
        phone: config.company?.defaultPhone || '',
        timezone: config.app?.timezone || 'Europe/Moscow',
        working_hours: config.company?.defaultWorkingHours || {
          monday: { start: '10:00', end: '22:00' },
          tuesday: { start: '10:00', end: '22:00' },
          wednesday: { start: '10:00', end: '22:00' },
          thursday: { start: '10:00', end: '22:00' },
          friday: { start: '10:00', end: '22:00' },
          saturday: { start: '10:00', end: '22:00' },
          sunday: { start: '10:00', end: '20:00' }
        }
      };
    }
  }

  /**
   * Detect business type from YClients description
   */
  detectBusinessType(shortDescr) {
    if (!shortDescr) return 'beauty';

    const description = shortDescr.toLowerCase();

    const businessTypeMap = {
      'барбершоп': 'barbershop',
      'barbershop': 'barbershop',
      'мужская парикмахерская': 'barbershop',
      'для мужчин': 'barbershop',
      'маникюр': 'nails',
      'ногти': 'nails',
      'ногтевая': 'nails',
      'nail': 'nails',
      'массаж': 'massage',
      'спа': 'massage',
      'spa': 'massage',
      'эпиляция': 'epilation',
      'депиляция': 'epilation',
      'шугаринг': 'epilation',
      'воск': 'epilation',
      'брови': 'brows',
      'ресницы': 'brows',
      'brow': 'brows',
      'lash': 'brows'
    };

    for (const [keyword, type] of Object.entries(businessTypeMap)) {
      if (description.includes(keyword)) {
        return type;
      }
    }

    return 'beauty';
  }

  /**
   * Load client information with data enrichment
   */
  async loadClient(phone, companyId) {
    try {
      const safePhone = this.validateInput(phone, 'phone');
      const safeCompanyId = this.validateInput(companyId, 'companyId');

      const cleanPhone = safePhone.replace('@c.us', '');
      const phoneWithPlus = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

      logger.info(`Searching for client with raw_phone: ${phoneWithPlus} in company: ${safeCompanyId}`);

      // Use direct query for raw_phone search
      const result = await postgres.query(
        `SELECT * FROM clients
         WHERE raw_phone = $1 AND company_id = $2
         LIMIT 1`,
        [phoneWithPlus, safeCompanyId]
      );

      const data = result.rows[0] || null;

      if (data) {
        logger.info(`Client found: ${data.name} (${data.phone})`, {
          visitHistoryLength: data.visit_history?.length || 0,
          lastServices: data.last_services || [],
          visitCount: data.visit_count || 0
        });

        // Field mapping for personalization compatibility
        if (data.visit_history) {
          data.visits = data.visit_history;
        }
        if (data.services_amount) {
          data.average_check = Math.round(data.services_amount / (data.visit_count || 1));
        }

        // Load staff names for favorite_staff_ids
        if (data.favorite_staff_ids && data.favorite_staff_ids.length > 0) {
          const staffNames = await this.getStaffNamesByIds(data.favorite_staff_ids, safeCompanyId);
          data.favorite_staff_names = staffNames;
          logger.debug(`Mapped favorite staff: ${staffNames.join(', ')}`);
        }

        // Load service names for last_service_ids
        if (data.last_service_ids && data.last_service_ids.length > 0) {
          const serviceNames = await this.getServiceNamesByIds(data.last_service_ids, safeCompanyId);
          data.favorite_services = serviceNames;
          logger.debug(`Mapped favorite services: ${serviceNames.join(', ')}`);
        }

        // Analyze visit patterns
        data.visit_patterns = this.analyzeVisitPatterns(data);

        logger.debug(`Client data mapped for personalization:`, {
          has_visits: !!data.visits,
          visit_count: data.visit_count,
          average_check: data.average_check,
          has_patterns: !!data.visit_patterns
        });
      } else {
        logger.debug(`No client found for raw_phone: ${phoneWithPlus}`);
      }

      return data;
    } catch (error) {
      logger.error('Error in loadClient:', error);
      return null;
    }
  }

  /**
   * Load company services
   */
  async loadServices(companyId) {
    try {
      const data = await this.repos?.service?.findAll(companyId, false);
      return data || [];
    } catch (error) {
      logger.error('Error loading services:', error);
      return [];
    }
  }

  /**
   * Load company staff
   */
  async loadStaff(companyId) {
    logger.info('Loading staff from database', { companyId });

    try {
      const data = await this.repos?.staff?.findAll(companyId, false);

      logger.info('Staff loaded successfully', {
        companyId,
        count: data?.length || 0,
        staff: data?.map(s => ({
          id: s.yclients_id,
          name: s.name,
          is_active: s.is_active
        })) || []
      });

      return data || [];
    } catch (error) {
      logger.error('Error loading staff:', {
        companyId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Load client bookings
   */
  async loadBookings(clientId, companyId) {
    try {
      if (!clientId) {
        logger.debug('No clientId provided for loadBookings');
        return [];
      }

      const result = await postgres.query(
        `SELECT * FROM bookings
         WHERE client_id = $1 AND company_id = $2
         AND appointment_datetime >= NOW()
         ORDER BY appointment_datetime ASC
         LIMIT 10`,
        [clientId, companyId]
      );

      return result.rows || [];
    } catch (error) {
      if (error.code === '42P01') {
        logger.debug('Bookings table does not exist yet');
      } else {
        logger.error('Error loading bookings:', error);
      }
      return [];
    }
  }

  /**
   * Load recent messages (stored in Redis context)
   */
  async loadRecentMessages(phone, companyId) {
    try {
      logger.debug('loadRecentMessages called - messages are in Redis context');
      return [];
    } catch (error) {
      logger.error('Error in loadRecentMessages:', error);
      return [];
    }
  }

  /**
   * Load conversation history
   */
  async loadConversation(phone, companyId) {
    try {
      const cleanPhone = InternationalPhone.normalize(phone) || phone.replace('@c.us', '');

      const result = await postgres.query(
        `SELECT messages FROM dialog_contexts
         WHERE user_id = $1 AND company_id = $2
         ORDER BY updated_at DESC
         LIMIT 1`,
        [cleanPhone, companyId]
      );

      return result.rows[0]?.messages || [];
    } catch (error) {
      logger.error('Error loading conversation:', error);
      return [];
    }
  }

  /**
   * Load business statistics
   */
  async loadBusinessStats(companyId) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const result = await postgres.query(
        `SELECT COUNT(*) as count FROM appointments_cache
         WHERE company_id = $1
         AND appointment_datetime >= $2::date
         AND appointment_datetime < ($2::date + INTERVAL '1 day')`,
        [companyId, today]
      );

      const totalSlots = 50;
      const bookedSlots = parseInt(result.rows[0]?.count) || 0;
      const todayLoad = Math.round((bookedSlots / totalSlots) * 100);

      return { todayLoad, bookedSlots, totalSlots };
    } catch (error) {
      logger.error('Error in loadBusinessStats:', error);
      return { todayLoad: 0, bookedSlots: 0, totalSlots: 50 };
    }
  }

  /**
   * Load staff schedules
   */
  async loadStaffSchedules(companyId) {
    const today = new Date();
    const weekLater = new Date();
    weekLater.setDate(today.getDate() + 30);

    logger.info(`Loading staff schedules from ${today.toISOString().split('T')[0]} to ${weekLater.toISOString().split('T')[0]}`);

    try {
      // Get staff IDs for this company
      const staffResult = await postgres.query(
        `SELECT yclients_id FROM staff
         WHERE company_id = $1 AND is_active = true`,
        [companyId]
      );

      const staffIds = staffResult.rows?.map(s => s.yclients_id) || [];

      if (staffIds.length === 0) {
        logger.warn('No active staff found for company', companyId);
        return {};
      }

      // Get schedules filtered by yclients_staff_id
      const scheduleResult = await postgres.query(
        `SELECT * FROM staff_schedules
         WHERE yclients_staff_id = ANY($1)
         AND date >= $2 AND date <= $3
         ORDER BY date ASC`,
        [staffIds, today.toISOString().split('T')[0], weekLater.toISOString().split('T')[0]]
      );

      const data = scheduleResult.rows || [];

      logger.info(`Loaded ${data.length} schedule records`);

      // Group by date
      const scheduleByDate = {};
      data.forEach(schedule => {
        const dateKey = schedule.date instanceof Date
          ? schedule.date.toISOString().split('T')[0]
          : schedule.date;
        if (!scheduleByDate[dateKey]) {
          scheduleByDate[dateKey] = [];
        }
        scheduleByDate[dateKey].push(schedule);
      });

      const todayStr = today.toISOString().split('T')[0];
      logger.info(`Today's schedule (${todayStr}):`, {
        recordsCount: scheduleByDate[todayStr]?.length || 0,
        todayData: scheduleByDate[todayStr],
        allDates: Object.keys(scheduleByDate)
      });

      return scheduleByDate;
    } catch (error) {
      logger.error('Error loading staff schedules:', error);
      return {};
    }
  }

  /**
   * Get staff names by IDs
   */
  async getStaffNamesByIds(staffIds, companyId) {
    try {
      // staffIds are YClients external IDs (e.g., 2895125), not internal DB IDs
      // Must use yclients_id column, not id
      const result = await postgres.query(
        `SELECT yclients_id, name FROM staff
         WHERE company_id = $1 AND yclients_id = ANY($2)`,
        [companyId, staffIds]
      );

      return result.rows?.map(staff => staff.name) || [];
    } catch (error) {
      logger.error('Error in getStaffNamesByIds:', error);
      return [];
    }
  }

  /**
   * Get service names by IDs
   */
  async getServiceNamesByIds(serviceIds, companyId) {
    try {
      // serviceIds are YClients external IDs (e.g., 18356010), not internal DB IDs
      // Must use yclients_id column, not id
      const result = await postgres.query(
        `SELECT yclients_id, title FROM services
         WHERE company_id = $1 AND yclients_id = ANY($2)`,
        [companyId, serviceIds]
      );

      return result.rows?.map(service => service.title) || [];
    } catch (error) {
      logger.error('Error in getServiceNamesByIds:', error);
      return [];
    }
  }

  /**
   * Analyze client visit patterns
   */
  analyzeVisitPatterns(clientData) {
    try {
      const patterns = {
        averageFrequency: null,
        preferredDayOfWeek: null,
        preferredTimeOfDay: null,
        lastVisitDaysAgo: null,
        nextExpectedVisit: null,
        serviceStaffPairs: {}
      };

      if (clientData.last_visit_date) {
        const lastVisit = new Date(clientData.last_visit_date);
        const today = new Date();
        const diffTime = Math.abs(today - lastVisit);
        patterns.lastVisitDaysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      if (clientData.visit_history && Array.isArray(clientData.visit_history)) {
        const visits = clientData.visit_history;

        if (visits.length > 1) {
          const sortedVisits = visits.sort((a, b) => new Date(a.date) - new Date(b.date));
          let totalDays = 0;
          for (let i = 1; i < sortedVisits.length; i++) {
            const diff = new Date(sortedVisits[i].date) - new Date(sortedVisits[i-1].date);
            totalDays += diff / (1000 * 60 * 60 * 24);
          }
          patterns.averageFrequency = Math.round(totalDays / (sortedVisits.length - 1));

          if (patterns.lastVisitDaysAgo && patterns.averageFrequency) {
            const daysUntilNext = patterns.averageFrequency - patterns.lastVisitDaysAgo;
            if (daysUntilNext > 0) {
              patterns.nextExpectedVisit = `через ${daysUntilNext} дней`;
            } else {
              patterns.nextExpectedVisit = 'пора записаться';
            }
          }
        }

        const dayCount = {};
        const timeCount = { morning: 0, afternoon: 0, evening: 0 };

        visits.forEach(visit => {
          if (visit.date) {
            const date = new Date(visit.date);
            const dayOfWeek = date.getDay();
            dayCount[dayOfWeek] = (dayCount[dayOfWeek] || 0) + 1;

            if (visit.time) {
              const hour = parseInt(visit.time.split(':')[0]);
              if (hour < 12) timeCount.morning++;
              else if (hour < 18) timeCount.afternoon++;
              else timeCount.evening++;
            }
          }

          if (visit.service && visit.staff) {
            const key = `${visit.service}_${visit.staff}`;
            patterns.serviceStaffPairs[key] = (patterns.serviceStaffPairs[key] || 0) + 1;
          }
        });

        const maxDay = Object.keys(dayCount).reduce((a, b) =>
          dayCount[a] > dayCount[b] ? a : b, null);
        if (maxDay) {
          const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
          patterns.preferredDayOfWeek = days[maxDay];
        }

        const maxTime = Object.keys(timeCount).reduce((a, b) =>
          timeCount[a] > timeCount[b] ? a : b, null);
        if (maxTime) {
          patterns.preferredTimeOfDay = maxTime === 'morning' ? 'утро' :
                                       maxTime === 'afternoon' ? 'день' : 'вечер';
        }
      }

      return patterns;
    } catch (error) {
      logger.error('Error analyzing visit patterns:', error);
      return null;
    }
  }

  /**
   * Save dialog context
   */
  async saveContext(phone, companyId, context, result) {
    try {
      const safePhone = this.validateInput(phone, 'phone');
      const safeCompanyId = this.validateInput(companyId, 'companyId');
      const cleanPhone = safePhone.replace('@c.us', '');

      const messages = context.conversation || [];
      messages.push({
        role: 'user',
        content: this.validateInput(context.currentMessage),
        timestamp: new Date().toISOString()
      });
      messages.push({
        role: 'assistant',
        content: this.validateInput(result.response),
        timestamp: new Date().toISOString()
      });

      const recentMessages = messages.slice(-20);

      // Save to PostgreSQL
      await postgres.query(
        `INSERT INTO dialog_contexts (user_id, company_id, messages, last_command, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, company_id)
         DO UPDATE SET messages = $3, last_command = $4, updated_at = NOW()`,
        [
          cleanPhone,
          companyId,
          JSON.stringify(recentMessages),
          result.executedCommands?.[0]?.command || null
        ]
      );

      // Also save to Redis for fast access
      const contextServiceV2 = require('../../context/context-service-v2');

      const contextUpdates = {
        selection: {
          lastCommand: result.executedCommands?.[0]?.command || null,
          lastService: result.executedCommands?.[0]?.params?.service_name || null,
          lastStaff: result.executedCommands?.[0]?.params?.staff_name || null,
        },
        clientName: context.client?.name || null
      };

      await contextServiceV2.updateDialogContext(cleanPhone, companyId, contextUpdates);

      for (const msg of recentMessages.slice(-5)) {
        await contextServiceV2.addMessage(cleanPhone, companyId, {
          text: msg.content,
          type: msg.role === 'user' ? 'incoming' : 'outgoing',
          timestamp: msg.timestamp || new Date().toISOString()
        });
      }

      logger.info('Context saved to both PostgreSQL and Redis');
    } catch (error) {
      logger.error('Error saving context:', error);
    }
  }
}

module.exports = new DataLoader();
