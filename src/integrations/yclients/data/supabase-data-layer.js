// src/integrations/yclients/data/supabase-data-layer.js
const { supabase } = require('../../../database/supabase');
const postgres = require('../../../database/postgres');
const logger = require("../../../utils/logger");
const DataTransformers = require("../../../utils/data-transformers");
const dbFlags = require("../../../config/database-flags");

// Repository Pattern (Phase 2)
const {
  ClientRepository,
  ServiceRepository,
  StaffRepository,
  StaffScheduleRepository,
  DialogContextRepository,
  CompanyRepository
} = require("../../../repositories");

/**
 * 💾 SUPABASE DATA LAYER - UPDATED
 * 
 * ДОБАВЛЕНЫ МЕТОДЫ:
 * ✅ getStaffById - получение мастера по ID
 * ✅ getStaffSchedules - получение расписаний мастеров
 * ✅ getClientAppointments - обновлен для поддержки параметров
 * 
 * ПРИНЦИПЫ:
 * - Single Responsibility: ТОЛЬКО database queries + data protection
 * - Input Validation: защита от некорректных данных и SQL injection
 * - Consistent API: унифицированный format ответов
 * - Error Resilience: graceful handling всех типов ошибок
 * - Performance Protection: limits и optimizations
 * - Easy Testing: dependency injection + predictable behavior
 * - Configuration: настраиваемые limits и timeouts
 * - Complete Coverage: все CRUD операции для всех entities
 */
class SupabaseDataLayer {
  constructor(database = supabase, config = {}) {
    this.db = database;

    // Configurable limits and settings
    this.config = {
      maxLimit: config.maxLimit || 1000,
      defaultLimit: config.defaultLimit || 100,
      healthCheckTimeout: config.healthCheckTimeout || 5000,
      queryTimeout: config.queryTimeout || 30000,
      maxBatchSize: config.maxBatchSize || 500,
      enableValidation: config.enableValidation !== false,
      enableSanitization: config.enableSanitization !== false,
      ...config
    };

    // Initialize repositories (Phase 2)
    // Only initialize if USE_REPOSITORY_PATTERN is enabled
    if (dbFlags.USE_REPOSITORY_PATTERN) {
      if (!postgres.pool) {
        logger.warn('⚠️  Repository Pattern enabled but PostgreSQL pool not available');
        logger.warn('   Falling back to Supabase. Check USE_LEGACY_SUPABASE configuration.');
      } else {
        // Initialize all repositories
        this.clientRepo = new ClientRepository(postgres.pool);
        this.serviceRepo = new ServiceRepository(postgres.pool);
        this.staffRepo = new StaffRepository(postgres.pool);
        this.scheduleRepo = new StaffScheduleRepository(postgres.pool);
        this.contextRepo = new DialogContextRepository(postgres.pool);
        this.companyRepo = new CompanyRepository(postgres.pool);

        logger.info(`✅ Repository Pattern initialized (backend: ${dbFlags.getCurrentBackend()})`);
      }
    } else {
      logger.info(`ℹ️  Using legacy Supabase (USE_REPOSITORY_PATTERN=${dbFlags.USE_REPOSITORY_PATTERN})`);
    }
  }

  // =============== VALIDATION & PROTECTION ===============

  /**
   * Validate company ID
   */
  _validateCompanyId(companyId) {
    if (!this.config.enableValidation) return;

    if (!companyId || !Number.isInteger(Number(companyId)) || companyId <= 0) {
      throw new Error(`Invalid company ID: ${companyId}. Must be a positive integer`);
    }
  }

  /**
   * Validate phone number
   */
  _validatePhone(phone) {
    if (!this.config.enableValidation) return phone;

    if (!phone || typeof phone !== 'string') {
      throw new Error('Phone must be a non-empty string');
    }

    const normalized = DataTransformers.normalizePhone(phone);

    if (!normalized || normalized.length < 10) {
      throw new Error(`Invalid phone number format: ${phone}`);
    }

    return normalized;
  }

  /**
   * Validate and limit batch/query size
   */
  _validateAndLimitSize(requestedLimit = null) {
    const limit = requestedLimit === null 
      ? this.config.defaultLimit 
      : Math.min(Math.abs(parseInt(requestedLimit) || this.config.defaultLimit), this.config.maxLimit);

    return { limit };
  }

  /**
   * Sanitize string for ILIKE queries
   */
  _sanitizeStringFilter(str) {
    if (!this.config.enableSanitization) return str;

    return str
      .replace(/[%_\\]/g, '\\$&')
      .trim();
  }

  /**
   * Handle Supabase errors consistently
   */
  _handleSupabaseError(error, operation, isNotFoundOk = false) {
    if (!error) return;

    if (error.code === 'PGRST116' && isNotFoundOk) {
      return;
    }

    throw new Error(`Supabase error in ${operation}: ${error.message || error}`);
  }

  /**
   * Build consistent response format
   */
  _buildResponse(data, operation, metadata = {}) {
    return {
      success: true,
      data,
      operation,
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }

  /**
   * Build error response
   */
  _buildErrorResponse(error, operation) {
    return {
      success: false,
      data: null,
      operation,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }

  // =============== DIALOG CONTEXT QUERIES ===============

  /**
   * 💬 Get dialog context for user
   */
  async getDialogContext(userId) {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('User ID must be a non-empty string');
      }

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.contextRepo) {
        const data = await this.contextRepo.findByUserId(userId);
        return this._buildResponse(data, 'getDialogContext');
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('dialog_contexts')
        .select('*')
        .eq('user_id', userId)
        .single();

      this._handleSupabaseError(error, 'getDialogContext', true);

      return this._buildResponse(data, 'getDialogContext');

    } catch (error) {
      logger.error('getDialogContext failed:', error);
      return this._buildErrorResponse(error, 'getDialogContext');
    }
  }

  /**
   * 💬 Save/update dialog context
   */
  async upsertDialogContext(contextData) {
    try {
      if (!contextData.user_id || typeof contextData.user_id !== 'string') {
        throw new Error('User ID must be a non-empty string');
      }

      const dataToSave = {
        ...contextData,
        last_activity: new Date(),
        updated_at: new Date()
      };

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.contextRepo) {
        const data = await this.contextRepo.upsert(dataToSave);
        return this._buildResponse(data, 'upsertDialogContext');
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('dialog_contexts')
        .upsert(dataToSave, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      this._handleSupabaseError(error, 'upsertDialogContext');

      return this._buildResponse(data, 'upsertDialogContext');

    } catch (error) {
      logger.error('upsertDialogContext failed:', error);
      return this._buildErrorResponse(error, 'upsertDialogContext');
    }
  }

  // =============== CLIENT QUERIES ===============

  /**
   * 📞 Get client by phone number
   */
  async getClientByPhone(phone) {
    try {
      const normalizedPhone = this._validatePhone(phone);

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.clientRepo) {
        const data = await this.clientRepo.findByPhone(normalizedPhone);
        return this._buildResponse(data, 'getClientByPhone');
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('clients')
        .select('*')
        .eq('phone', normalizedPhone)
        .single();

      this._handleSupabaseError(error, 'getClientByPhone', true);

      return this._buildResponse(data, 'getClientByPhone');

    } catch (error) {
      logger.error('getClientByPhone failed:', error);
      return this._buildErrorResponse(error, 'getClientByPhone');
    }
  }

  /**
   * 🆔 Get client by yclients ID
   */
  async getClientById(clientYclientsId, companyId = null) {
    try {
      if (!clientYclientsId || !Number.isInteger(Number(clientYclientsId))) {
        throw new Error('Invalid client yclients_id');
      }

      if (companyId) {
        this._validateCompanyId(companyId);
      }

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.clientRepo) {
        const data = await this.clientRepo.findById(clientYclientsId, companyId);
        return this._buildResponse(data, 'getClientById');
      }

      // FALLBACK: Use legacy Supabase
      let query = this.db
        .from('clients')
        .select('*')
        .eq('yclients_id', clientYclientsId);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query.single();
      this._handleSupabaseError(error, 'getClientById', true);

      return this._buildResponse(data, 'getClientById');

    } catch (error) {
      logger.error('getClientById failed:', error);
      return this._buildErrorResponse(error, 'getClientById');
    }
  }

  /**
   * 📅 Get client appointments with enhanced options
   * UPDATED: Added support for ordering, limiting, and company filtering
   * SIMPLIFIED: Removed complex JOINs, use separate queries if names needed
   */
  async getClientAppointments(clientId, options = {}) {
    try {
      if (!clientId || !Number.isInteger(Number(clientId))) {
        throw new Error('Invalid client ID');
      }

      const {
        companyId,
        limit = this.config.defaultLimit,
        orderBy = 'appointment_datetime',
        orderDirection = 'desc'
      } = options;

      const { limit: validatedLimit } = this._validateAndLimitSize(limit);

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.clientRepo) {
        const data = await this.clientRepo.findAppointments(clientId, {
          companyId,
          limit: validatedLimit,
          orderBy,
          orderDirection
        });
        return this._buildResponse(data || [], 'getClientAppointments', {
          clientId,
          recordCount: data?.length || 0,
          options
        });
      }

      // FALLBACK: Use legacy Supabase
      // Simple query without JOINs
      let query = this.db
        .from('appointments_cache')
        .select('*')
        .eq('client_id', clientId);

      if (companyId) {
        this._validateCompanyId(companyId);
        query = query.eq('company_id', companyId);
      }

      // Apply ordering
      const validOrderColumns = ['appointment_datetime', 'created_at', 'cost'];
      const orderColumn = validOrderColumns.includes(orderBy) ? orderBy : 'appointment_datetime';
      const ascending = orderDirection === 'asc';

      query = query.order(orderColumn, { ascending });

      // Apply limit
      query = query.limit(validatedLimit);

      const { data, error } = await query;
      this._handleSupabaseError(error, 'getClientAppointments');

      return this._buildResponse(data || [], 'getClientAppointments', {
        clientId,
        recordCount: data?.length || 0,
        options
      });

    } catch (error) {
      logger.error('getClientAppointments failed:', error);
      return this._buildErrorResponse(error, 'getClientAppointments');
    }
  }

  /**
   * 📅 Get upcoming appointments for a client
   * NEW: Added to support reschedule functionality
   */
  async getUpcomingAppointments(clientId, companyId) {
    try {
      if (!clientId || !Number.isInteger(Number(clientId))) {
        throw new Error('Invalid client ID');
      }

      this._validateCompanyId(companyId);

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.clientRepo) {
        const data = await this.clientRepo.findUpcoming(clientId, companyId);
        return this._buildResponse(data || [], 'getUpcomingAppointments', {
          clientId,
          companyId,
          recordCount: data?.length || 0
        });
      }

      // FALLBACK: Use legacy Supabase
      const now = new Date().toISOString();

      const { data, error } = await this.db
        .from('appointments_cache')
        .select('*')
        .eq('client_id', clientId)
        .eq('company_id', companyId)
        .gte('appointment_datetime', now)
        .neq('status', 'cancelled')
        .order('appointment_datetime', { ascending: true })
        .limit(10);

      this._handleSupabaseError(error, 'getUpcomingAppointments');

      return this._buildResponse(data || [], 'getUpcomingAppointments', {
        clientId,
        companyId,
        recordCount: data?.length || 0
      });

    } catch (error) {
      logger.error('getUpcomingAppointments failed:', error);
      return this._buildErrorResponse(error, 'getUpcomingAppointments');
    }
  }

  /**
   * 👥 Search clients by name
   */
  async searchClientsByName(companyId, name, limit = null) {
    try {
      this._validateCompanyId(companyId);

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('Search name cannot be empty');
      }

      const { limit: validatedLimit } = this._validateAndLimitSize(limit);

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.clientRepo) {
        const data = await this.clientRepo.searchByName(companyId, name, validatedLimit);
        return this._buildResponse(data, 'searchClientsByName', {
          searchTerm: name,
          limit: validatedLimit
        });
      }

      // FALLBACK: Use legacy Supabase
      const sanitizedName = this._sanitizeStringFilter(name);

      const { data, error } = await this.db
        .from('clients')
        .select(`
          id, yclients_id, name, phone, email,
          visit_count, total_spent, loyalty_level,
          last_visit_date
        `)
        .eq('company_id', companyId)
        .ilike('name', `%${sanitizedName}%`)
        .order('last_visit_date', { ascending: false, nullsLast: true })
        .order('visit_count', { ascending: false })
        .limit(validatedLimit);

      this._handleSupabaseError(error, 'searchClientsByName');

      return this._buildResponse(data, 'searchClientsByName', {
        searchTerm: name,
        limit: validatedLimit
      });

    } catch (error) {
      logger.error('searchClientsByName failed:', error);
      return this._buildErrorResponse(error, 'searchClientsByName');
    }
  }

  /**
   * 👤 Save single client
   */
  async upsertClient(clientData) {
    try {
      if (!clientData.yclients_id || !Number.isInteger(Number(clientData.yclients_id))) {
        throw new Error('Invalid yclients_id');
      }
      if (!clientData.company_id) {
        throw new Error('Missing company_id');
      }
      if (!clientData.name || typeof clientData.name !== 'string' || clientData.name.trim().length === 0) {
        throw new Error('Invalid name: must be a non-empty string');
      }
      if (!clientData.phone) {
        throw new Error('Missing phone number');
      }

      const processedData = {
        ...clientData,
        name: clientData.name.trim(),
        phone: this._validatePhone(clientData.phone),
        updated_at: new Date()
      };

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.clientRepo) {
        const data = await this.clientRepo.upsert(processedData);
        return this._buildResponse(data, 'upsertClient');
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('clients')
        .upsert(processedData, {
          onConflict: 'yclients_id,company_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      this._handleSupabaseError(error, 'upsertClient');

      return this._buildResponse(data, 'upsertClient');

    } catch (error) {
      logger.error('upsertClient failed:', error);
      return this._buildErrorResponse(error, 'upsertClient');
    }
  }

  /**
   * 🔄 Save clients (bulk upsert with validation)
   */
  async upsertClients(clientsData) {
    try {
      if (!Array.isArray(clientsData)) {
        clientsData = [clientsData];
      }

      if (clientsData.length === 0) {
        throw new Error('Clients data array cannot be empty');
      }

      if (clientsData.length > this.config.maxBatchSize) {
        throw new Error(`Cannot upsert more than ${this.config.maxBatchSize} clients at once`);
      }

      // Validate each client record
      const validatedData = clientsData.map((client, index) => {
        if (!client.yclients_id || !Number.isInteger(Number(client.yclients_id))) {
          throw new Error(`Invalid yclients_id at index ${index}`);
        }
        if (!client.company_id) {
          throw new Error(`Missing company_id at index ${index}`);
        }
        if (!client.name || typeof client.name !== 'string' || client.name.trim().length === 0) {
          throw new Error(`Invalid name at index ${index}`);
        }
        if (!client.phone) {
          throw new Error(`Missing phone at index ${index}`);
        }

        return {
          ...client,
          name: client.name.trim(),
          phone: this._validatePhone(client.phone),
          updated_at: new Date()
        };
      });

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.clientRepo) {
        const data = await this.clientRepo.bulkUpsert(validatedData);
        return this._buildResponse(data, 'upsertClients', {
          inputCount: clientsData.length,
          processedCount: data?.length || 0
        });
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('clients')
        .upsert(validatedData, {
          onConflict: 'yclients_id,company_id',
          ignoreDuplicates: false
        })
        .select('id, yclients_id, name, phone');

      this._handleSupabaseError(error, 'upsertClients');

      return this._buildResponse(data, 'upsertClients', {
        inputCount: clientsData.length,
        processedCount: data?.length || 0
      });

    } catch (error) {
      logger.error('upsertClients failed:', error);
      return this._buildErrorResponse(error, 'upsertClients');
    }
  }

  // =============== STAFF QUERIES (NEW) ===============

  /**
   * 👤 Get staff member by ID
   * NEW: Added to support context builder
   */
  async getStaffById(staffId, companyId) {
    try {
      if (!staffId || !Number.isInteger(Number(staffId))) {
        throw new Error('Invalid staff ID: must be a positive integer');
      }

      this._validateCompanyId(companyId);

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.staffRepo) {
        const data = await this.staffRepo.findById(staffId, companyId);
        return this._buildResponse(data, 'getStaffById');
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('staff')
        .select('*')
        .eq('yclients_id', staffId)
        .eq('company_id', companyId)
        .single();

      this._handleSupabaseError(error, 'getStaffById', true);

      return this._buildResponse(data, 'getStaffById');

    } catch (error) {
      logger.error('getStaffById failed:', error);
      return this._buildErrorResponse(error, 'getStaffById');
    }
  }

  /**
   * 📅 Get staff schedules
   * NEW: Added to support working schedule queries
   */
  async getStaffSchedules(query = {}) {
    try {
      const {
        company_id,
        staff_id,
        staff_name,
        date_from,
        date_to,
        is_working,
        limit = this.config.defaultLimit
      } = query;

      if (!company_id) {
        throw new Error('company_id is required for staff schedules query');
      }

      this._validateCompanyId(company_id);
      const { limit: validatedLimit } = this._validateAndLimitSize(limit);

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.scheduleRepo) {
        const data = await this.scheduleRepo.findSchedules({
          company_id,
          staff_id,
          staff_name,
          date_from,
          date_to,
          is_working,
          limit: validatedLimit
        });
        return this._buildResponse(data, 'getStaffSchedules', {
          query,
          recordCount: data?.length || 0
        });
      }

      // FALLBACK: Use legacy Supabase
      // Build query
      let dbQuery = this.db
        .from('staff_schedules')
        .select('*');

      // Apply filters
      if (staff_id) {
        dbQuery = dbQuery.eq('staff_id', staff_id);
      }

      if (staff_name) {
        const sanitizedName = this._sanitizeStringFilter(staff_name);
        dbQuery = dbQuery.ilike('staff_name', `%${sanitizedName}%`);
      }

      if (date_from) {
        dbQuery = dbQuery.gte('date', date_from);
      }

      if (date_to) {
        dbQuery = dbQuery.lte('date', date_to);
      }

      if (typeof is_working === 'boolean') {
        dbQuery = dbQuery.eq('is_working', is_working);
      }

      // Order by date
      dbQuery = dbQuery
        .order('date', { ascending: true })
        .order('staff_name', { ascending: true })
        .limit(validatedLimit);

      const { data, error } = await dbQuery;
      this._handleSupabaseError(error, 'getStaffSchedules');

      return this._buildResponse(data, 'getStaffSchedules', {
        query,
        recordCount: data?.length || 0
      });

    } catch (error) {
      logger.error('getStaffSchedules failed:', error);
      return this._buildErrorResponse(error, 'getStaffSchedules');
    }
  }

  // =============== SCHEDULES QUERIES (EXISTING) ===============

  /**
   * 📅 Get staff schedule for specific date
   */
  async getStaffSchedule(staffId, date, companyId = null) {
    try {
      if (!staffId || !Number.isInteger(Number(staffId))) {
        throw new Error('Invalid staff ID: must be a positive integer');
      }

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Invalid date: must be in YYYY-MM-DD format');
      }

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.scheduleRepo) {
        const data = await this.scheduleRepo.findSchedule(staffId, date, companyId);
        return this._buildResponse(data, 'getStaffSchedule');
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('staff_schedules')
        .select('*')
        .eq('staff_id', staffId)
        .eq('date', date)
        .single();

      this._handleSupabaseError(error, 'getStaffSchedule', true);

      return this._buildResponse(data, 'getStaffSchedule');

    } catch (error) {
      logger.error('getStaffSchedule failed:', error);
      return this._buildErrorResponse(error, 'getStaffSchedule');
    }
  }

  /**
   * 📅 Save staff schedules (bulk upsert)
   */
  async upsertStaffSchedules(scheduleData) {
    try {
      if (!Array.isArray(scheduleData)) {
        scheduleData = [scheduleData];
      }

      if (scheduleData.length === 0) {
        throw new Error('Schedule data array cannot be empty');
      }

      if (scheduleData.length > this.config.maxBatchSize) {
        throw new Error(`Cannot upsert more than ${this.config.maxBatchSize} schedules at once`);
      }

      const validatedData = scheduleData.map((schedule, index) => {
        if (!schedule.staff_id || !Number.isInteger(Number(schedule.staff_id))) {
          throw new Error(`Invalid staff_id at index ${index}`);
        }
        if (!schedule.date || !/^\d{4}-\d{2}-\d{2}$/.test(schedule.date)) {
          throw new Error(`Invalid date format at index ${index}`);
        }
        if (!schedule.staff_name || typeof schedule.staff_name !== 'string') {
          throw new Error(`Invalid staff_name at index ${index}`);
        }

        return {
          ...schedule,
          staff_name: schedule.staff_name.trim(),
          last_updated: new Date()
        };
      });

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.scheduleRepo) {
        const data = await this.scheduleRepo.bulkUpsert(validatedData);
        return this._buildResponse(data, 'upsertStaffSchedules', {
          inputCount: scheduleData.length,
          processedCount: data?.length || 0
        });
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('staff_schedules')
        .upsert(validatedData, {
          onConflict: 'staff_id,date',
          ignoreDuplicates: false
        })
        .select('staff_id, date, is_working');

      this._handleSupabaseError(error, 'upsertStaffSchedules');

      return this._buildResponse(data, 'upsertStaffSchedules', {
        inputCount: scheduleData.length,
        processedCount: data?.length || 0
      });

    } catch (error) {
      logger.error('upsertStaffSchedules failed:', error);
      return this._buildErrorResponse(error, 'upsertStaffSchedules');
    }
  }

  // =============== SERVICES QUERIES ===============

  /**
   * 🛍️ Get all services for company
   */
  async getServices(companyId, includeInactive = false) {
    try {
      this._validateCompanyId(companyId);

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.serviceRepo) {
        const data = await this.serviceRepo.findAll(companyId, includeInactive);
        return this._buildResponse(data, 'getServices', {
          companyId,
          includeInactive,
          serviceCount: data?.length || 0
        });
      }

      // FALLBACK: Use legacy Supabase
      let query = this.db
        .from('services')
        .select('*')
        .eq('company_id', companyId)
        .order('weight', { ascending: false })
        .order('title', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      this._handleSupabaseError(error, 'getServices');

      return this._buildResponse(data, 'getServices', {
        companyId,
        includeInactive,
        serviceCount: data?.length || 0
      });

    } catch (error) {
      logger.error('getServices failed:', error);
      return this._buildErrorResponse(error, 'getServices');
    }
  }

  /**
   * 👥 Get all staff members for a company
   */
  async getStaff(companyId, includeInactive = false) {
    try {
      this._validateCompanyId(companyId);

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.staffRepo) {
        const data = await this.staffRepo.findAll(companyId, includeInactive);
        return this._buildResponse(data, 'getStaff', {
          companyId,
          includeInactive,
          staffCount: data?.length || 0
        });
      }

      // FALLBACK: Use legacy Supabase
      let query = this.db
        .from('staff')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      this._handleSupabaseError(error, 'getStaff');

      return this._buildResponse(data, 'getStaff', {
        companyId,
        includeInactive,
        staffCount: data?.length || 0
      });

    } catch (error) {
      logger.error('getStaff failed:', error);
      return this._buildErrorResponse(error, 'getStaff');
    }
  }

  /**
   * 🛍️ Get service by ID
   */
  async getServiceById(serviceYclientsId, companyId = null) {
    try {
      if (!serviceYclientsId || !Number.isInteger(Number(serviceYclientsId))) {
        throw new Error('Invalid service yclients_id');
      }

      if (companyId) {
        this._validateCompanyId(companyId);
      }

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.serviceRepo) {
        const data = await this.serviceRepo.findById(serviceYclientsId, companyId);
        return this._buildResponse(data, 'getServiceById');
      }

      // FALLBACK: Use legacy Supabase
      let query = this.db
        .from('services')
        .select('*')
        .eq('yclients_id', serviceYclientsId);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query.single();
      this._handleSupabaseError(error, 'getServiceById', true);

      return this._buildResponse(data, 'getServiceById');

    } catch (error) {
      logger.error('getServiceById failed:', error);
      return this._buildErrorResponse(error, 'getServiceById');
    }
  }

  /**
   * 🛍️ Get services by category
   */
  async getServicesByCategory(companyId, categoryId) {
    try {
      this._validateCompanyId(companyId);

      if (!categoryId || !Number.isInteger(Number(categoryId))) {
        throw new Error('Invalid category ID');
      }

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.serviceRepo) {
        const data = await this.serviceRepo.findByCategory(companyId, categoryId);
        return this._buildResponse(data, 'getServicesByCategory', { categoryId });
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('services')
        .select('*')
        .eq('company_id', companyId)
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('weight', { ascending: false })
        .order('title', { ascending: true });

      this._handleSupabaseError(error, 'getServicesByCategory');

      return this._buildResponse(data, 'getServicesByCategory', { categoryId });

    } catch (error) {
      logger.error('getServicesByCategory failed:', error);
      return this._buildErrorResponse(error, 'getServicesByCategory');
    }
  }

  /**
   * 🔄 Save services (bulk upsert with validation)
   */
  async upsertServices(servicesData) {
    try {
      if (!Array.isArray(servicesData)) {
        servicesData = [servicesData];
      }

      if (servicesData.length === 0) {
        throw new Error('Services data array cannot be empty');
      }

      if (servicesData.length > this.config.maxBatchSize) {
        throw new Error(`Cannot upsert more than ${this.config.maxBatchSize} services at once`);
      }

      // Validate each service record
      const validatedData = servicesData.map((service, index) => {
        if (!service.yclients_id || !Number.isInteger(Number(service.yclients_id))) {
          throw new Error(`Invalid yclients_id at index ${index}`);
        }
        if (!service.company_id) {
          throw new Error(`Missing company_id at index ${index}`);
        }
        if (!service.title || typeof service.title !== 'string' || service.title.trim().length === 0) {
          throw new Error(`Invalid title at index ${index}`);
        }

        return {
          ...service,
          title: service.title.trim(),
          updated_at: new Date(),
          last_sync_at: new Date()
        };
      });

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.serviceRepo) {
        const data = await this.serviceRepo.bulkUpsert(validatedData);
        return this._buildResponse(data, 'upsertServices', {
          inputCount: servicesData.length,
          processedCount: data?.length || 0
        });
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('services')
        .upsert(validatedData, {
          onConflict: 'yclients_id,company_id',
          ignoreDuplicates: false
        })
        .select('id, yclients_id, title');

      this._handleSupabaseError(error, 'upsertServices');

      return this._buildResponse(data, 'upsertServices', {
        inputCount: servicesData.length,
        processedCount: data?.length || 0
      });

    } catch (error) {
      logger.error('upsertServices failed:', error);
      return this._buildErrorResponse(error, 'upsertServices');
    }
  }

  // =============== COMPANIES QUERIES ===============

  /**
   * 🏢 Get company information
   */
  async getCompany(companyId) {
    try {
      this._validateCompanyId(companyId);

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.companyRepo) {
        const data = await this.companyRepo.findById(companyId);
        return this._buildResponse(data, 'getCompany');
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('companies')
        .select('*')
        .eq('company_id', companyId)
        .single();

      this._handleSupabaseError(error, 'getCompany', true);

      return this._buildResponse(data, 'getCompany');

    } catch (error) {
      logger.error('getCompany failed:', error);
      return this._buildErrorResponse(error, 'getCompany');
    }
  }

  /**
   * 🏢 Save company information
   */
  async upsertCompany(companyData) {
    try {
      if (!companyData.company_id) {
        throw new Error('Missing company_id');
      }
      if (!companyData.title || typeof companyData.title !== 'string') {
        throw new Error('Company title must be a non-empty string');
      }

      const processedData = {
        ...companyData,
        title: companyData.title.trim(),
        updated_at: new Date()
      };

      // USE REPOSITORY PATTERN (Phase 2)
      if (dbFlags.USE_REPOSITORY_PATTERN && this.companyRepo) {
        const data = await this.companyRepo.upsert(processedData);
        return this._buildResponse(data, 'upsertCompany');
      }

      // FALLBACK: Use legacy Supabase
      const { data, error } = await this.db
        .from('companies')
        .upsert(processedData, {
          onConflict: 'company_id'
        })
        .select()
        .single();

      this._handleSupabaseError(error, 'upsertCompany');

      return this._buildResponse(data, 'upsertCompany');

    } catch (error) {
      logger.error('upsertCompany failed:', error);
      return this._buildErrorResponse(error, 'upsertCompany');
    }
  }

  // =============== HEALTH CHECK ===============

  /**
   * 🏥 Health check
   */
  async healthCheck() {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout);
      });

      const queryPromise = this.db
        .from('companies')
        .select('company_id')
        .limit(1);

      const { error } = await Promise.race([queryPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      const isHealthy = !error && responseTime < this.config.healthCheckTimeout;

      return this._buildResponse({
        healthy: isHealthy,
        responseTime,
        maxTimeout: this.config.healthCheckTimeout
      }, 'healthCheck');

    } catch (error) {
      return this._buildErrorResponse(error, 'healthCheck');
    }
  }

  // =============== UTILITY METHODS ===============

  /**
   * 🔧 Get data layer configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 🔧 Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    return this.getConfig();
  }
}

module.exports = { SupabaseDataLayer };