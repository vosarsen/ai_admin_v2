// src/integrations/yclients/data/postgres-data-layer.js
// Migrated from supabase-data-layer.js - Supabase removed (2025-11-26)
const postgres = require('../../../database/postgres');
const logger = require("../../../utils/logger");
const Sentry = require('@sentry/node');
const DataTransformers = require("../../../utils/data-transformers");

// Repository Pattern
const {
  ClientRepository,
  ServiceRepository,
  StaffRepository,
  StaffScheduleRepository,
  DialogContextRepository,
  CompanyRepository
} = require("../../../repositories");

/**
 * 💾 POSTGRES DATA LAYER
 *
 * Unified data access layer using Repository Pattern
 * All Supabase dependencies removed (2025-11-26)
 *
 * METHODS:
 * - getDialogContext, upsertDialogContext
 * - getClientByPhone, getClientById, getClientAppointments, getUpcomingAppointments
 * - searchClientsByName, upsertClient, upsertClients
 * - getStaffById, getStaff, getStaffSchedule, getStaffSchedules, upsertStaffSchedules
 * - getServices, getServiceById, getServicesByCategory, upsertServices
 * - getCompany, upsertCompany
 * - healthCheck
 */
class PostgresDataLayer {
  constructor(config = {}) {
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

    // Initialize repositories
    if (!postgres.pool) {
      throw new Error('PostgreSQL pool not initialized. Check database configuration.');
    }

    this.clientRepo = new ClientRepository(postgres.pool);
    this.serviceRepo = new ServiceRepository(postgres.pool);
    this.staffRepo = new StaffRepository(postgres.pool);
    this.scheduleRepo = new StaffScheduleRepository(postgres.pool);
    this.contextRepo = new DialogContextRepository(postgres.pool);
    this.companyRepo = new CompanyRepository(postgres.pool);

    logger.info('✅ PostgresDataLayer initialized with Repository Pattern');
  }

  // =============== VALIDATION & PROTECTION ===============

  _validateCompanyId(companyId) {
    if (!this.config.enableValidation) return;
    if (!companyId || !Number.isInteger(Number(companyId)) || companyId <= 0) {
      throw new Error(`Invalid company ID: ${companyId}. Must be a positive integer`);
    }
  }

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

  _validateAndLimitSize(requestedLimit = null) {
    const limit = requestedLimit === null
      ? this.config.defaultLimit
      : Math.min(Math.abs(parseInt(requestedLimit) || this.config.defaultLimit), this.config.maxLimit);
    return { limit };
  }

  _buildResponse(data, operation, metadata = {}) {
    return {
      success: true,
      data,
      operation,
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }

  _buildErrorResponse(error, operation) {
    return {
      success: false,
      data: null,
      operation,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }

  // =============== DIALOG CONTEXT ===============

  async getDialogContext(userId) {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('User ID must be a non-empty string');
      }
      const data = await this.contextRepo.findByUserId(userId);
      return this._buildResponse(data, 'getDialogContext');
    } catch (error) {
      logger.error('getDialogContext failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getDialogContext', backend: 'postgres' },
        extra: { userId }
      });
      return this._buildErrorResponse(error, 'getDialogContext');
    }
  }

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
      const data = await this.contextRepo.upsert(dataToSave);
      return this._buildResponse(data, 'upsertDialogContext');
    } catch (error) {
      logger.error('upsertDialogContext failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'upsertDialogContext', backend: 'postgres' },
        extra: { userId: contextData.user_id }
      });
      return this._buildErrorResponse(error, 'upsertDialogContext');
    }
  }

  // =============== CLIENT QUERIES ===============

  async getClientByPhone(phone) {
    try {
      const normalizedPhone = this._validatePhone(phone);
      const data = await this.clientRepo.findByPhone(normalizedPhone);
      return this._buildResponse(data, 'getClientByPhone');
    } catch (error) {
      logger.error('getClientByPhone failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getClientByPhone', backend: 'postgres' },
        extra: { phone }
      });
      return this._buildErrorResponse(error, 'getClientByPhone');
    }
  }

  async getClientById(clientYclientsId, companyId = null) {
    try {
      if (!clientYclientsId || !Number.isInteger(Number(clientYclientsId))) {
        throw new Error('Invalid client yclients_id');
      }
      if (companyId) this._validateCompanyId(companyId);
      const data = await this.clientRepo.findById(clientYclientsId, companyId);
      return this._buildResponse(data, 'getClientById');
    } catch (error) {
      logger.error('getClientById failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getClientById', backend: 'postgres' },
        extra: { clientYclientsId, companyId }
      });
      return this._buildErrorResponse(error, 'getClientById');
    }
  }

  async getClientAppointments(clientId, options = {}) {
    try {
      if (!clientId || !Number.isInteger(Number(clientId))) {
        throw new Error('Invalid client ID');
      }
      const { companyId, limit = this.config.defaultLimit, orderBy = 'appointment_datetime', orderDirection = 'desc' } = options;
      const { limit: validatedLimit } = this._validateAndLimitSize(limit);

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
    } catch (error) {
      logger.error('getClientAppointments failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getClientAppointments', backend: 'postgres' },
        extra: { clientId, options }
      });
      return this._buildErrorResponse(error, 'getClientAppointments');
    }
  }

  async getUpcomingAppointments(clientId, companyId) {
    try {
      if (!clientId || !Number.isInteger(Number(clientId))) {
        throw new Error('Invalid client ID');
      }
      this._validateCompanyId(companyId);
      const data = await this.clientRepo.findUpcoming(clientId, companyId);
      return this._buildResponse(data || [], 'getUpcomingAppointments', {
        clientId,
        companyId,
        recordCount: data?.length || 0
      });
    } catch (error) {
      logger.error('getUpcomingAppointments failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getUpcomingAppointments', backend: 'postgres' },
        extra: { clientId, companyId }
      });
      return this._buildErrorResponse(error, 'getUpcomingAppointments');
    }
  }

  async searchClientsByName(companyId, name, limit = null) {
    try {
      this._validateCompanyId(companyId);
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('Search name cannot be empty');
      }
      const { limit: validatedLimit } = this._validateAndLimitSize(limit);
      const data = await this.clientRepo.searchByName(companyId, name, validatedLimit);
      return this._buildResponse(data, 'searchClientsByName', {
        searchTerm: name,
        limit: validatedLimit
      });
    } catch (error) {
      logger.error('searchClientsByName failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'searchClientsByName', backend: 'postgres' },
        extra: { companyId, name, limit }
      });
      return this._buildErrorResponse(error, 'searchClientsByName');
    }
  }

  async upsertClient(clientData) {
    try {
      if (!clientData.yclients_id || !Number.isInteger(Number(clientData.yclients_id))) {
        throw new Error('Invalid yclients_id');
      }
      if (!clientData.company_id) throw new Error('Missing company_id');
      if (!clientData.name || typeof clientData.name !== 'string' || clientData.name.trim().length === 0) {
        throw new Error('Invalid name: must be a non-empty string');
      }
      if (!clientData.phone) throw new Error('Missing phone number');

      const processedData = {
        ...clientData,
        name: clientData.name.trim(),
        phone: this._validatePhone(clientData.phone),
        updated_at: new Date()
      };
      const data = await this.clientRepo.upsert(processedData);
      return this._buildResponse(data, 'upsertClient');
    } catch (error) {
      logger.error('upsertClient failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'upsertClient', backend: 'postgres' },
        extra: { yclientsId: clientData.yclients_id, companyId: clientData.company_id }
      });
      return this._buildErrorResponse(error, 'upsertClient');
    }
  }

  async upsertClients(clientsData) {
    try {
      if (!Array.isArray(clientsData)) clientsData = [clientsData];
      if (clientsData.length === 0) throw new Error('Clients data array cannot be empty');
      if (clientsData.length > this.config.maxBatchSize) {
        throw new Error(`Cannot upsert more than ${this.config.maxBatchSize} clients at once`);
      }

      const validatedData = clientsData.map((client, index) => {
        if (!client.yclients_id || !Number.isInteger(Number(client.yclients_id))) {
          throw new Error(`Invalid yclients_id at index ${index}`);
        }
        if (!client.company_id) throw new Error(`Missing company_id at index ${index}`);
        if (!client.name || typeof client.name !== 'string' || client.name.trim().length === 0) {
          throw new Error(`Invalid name at index ${index}`);
        }
        if (!client.phone) throw new Error(`Missing phone at index ${index}`);

        return {
          ...client,
          name: client.name.trim(),
          phone: this._validatePhone(client.phone),
          updated_at: new Date()
        };
      });

      const data = await this.clientRepo.bulkUpsert(validatedData);
      return this._buildResponse(data, 'upsertClients', {
        inputCount: clientsData.length,
        processedCount: data?.length || 0
      });
    } catch (error) {
      logger.error('upsertClients failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'upsertClients', backend: 'postgres' },
        extra: { clientCount: clientsData.length }
      });
      return this._buildErrorResponse(error, 'upsertClients');
    }
  }

  // =============== STAFF QUERIES ===============

  async getStaffById(staffId, companyId) {
    try {
      if (!staffId || !Number.isInteger(Number(staffId))) {
        throw new Error('Invalid staff ID: must be a positive integer');
      }
      this._validateCompanyId(companyId);
      const data = await this.staffRepo.findById(staffId, companyId);
      return this._buildResponse(data, 'getStaffById');
    } catch (error) {
      logger.error('getStaffById failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getStaffById', backend: 'postgres' },
        extra: { staffId, companyId }
      });
      return this._buildErrorResponse(error, 'getStaffById');
    }
  }

  async getStaff(companyId, includeInactive = false) {
    try {
      this._validateCompanyId(companyId);
      const data = await this.staffRepo.findAll(companyId, includeInactive);
      return this._buildResponse(data, 'getStaff', {
        companyId,
        includeInactive,
        staffCount: data?.length || 0
      });
    } catch (error) {
      logger.error('getStaff failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getStaff', backend: 'postgres' },
        extra: { companyId, includeInactive }
      });
      return this._buildErrorResponse(error, 'getStaff');
    }
  }

  async getStaffSchedule(staffId, date, companyId = null) {
    try {
      if (!staffId || !Number.isInteger(Number(staffId))) {
        throw new Error('Invalid staff ID: must be a positive integer');
      }
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Invalid date: must be in YYYY-MM-DD format');
      }
      const data = await this.scheduleRepo.findSchedule(staffId, date, companyId);
      return this._buildResponse(data, 'getStaffSchedule');
    } catch (error) {
      logger.error('getStaffSchedule failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getStaffSchedule', backend: 'postgres' },
        extra: { staffId, date, companyId }
      });
      return this._buildErrorResponse(error, 'getStaffSchedule');
    }
  }

  async getStaffSchedules(query = {}) {
    try {
      const { company_id, staff_id, staff_name, date_from, date_to, is_working, limit = this.config.defaultLimit } = query;
      if (!company_id) throw new Error('company_id is required for staff schedules query');
      this._validateCompanyId(company_id);
      const { limit: validatedLimit } = this._validateAndLimitSize(limit);

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
    } catch (error) {
      logger.error('getStaffSchedules failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getStaffSchedules', backend: 'postgres' },
        extra: { query }
      });
      return this._buildErrorResponse(error, 'getStaffSchedules');
    }
  }

  async upsertStaffSchedules(scheduleData) {
    try {
      if (!Array.isArray(scheduleData)) scheduleData = [scheduleData];
      if (scheduleData.length === 0) throw new Error('Schedule data array cannot be empty');
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
        return { ...schedule, staff_name: schedule.staff_name.trim(), last_updated: new Date() };
      });

      const data = await this.scheduleRepo.bulkUpsert(validatedData);
      return this._buildResponse(data, 'upsertStaffSchedules', {
        inputCount: scheduleData.length,
        processedCount: data?.length || 0
      });
    } catch (error) {
      logger.error('upsertStaffSchedules failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'upsertStaffSchedules', backend: 'postgres' },
        extra: { scheduleCount: scheduleData.length }
      });
      return this._buildErrorResponse(error, 'upsertStaffSchedules');
    }
  }

  // =============== SERVICES QUERIES ===============

  async getServices(companyId, includeInactive = false) {
    try {
      this._validateCompanyId(companyId);
      const data = await this.serviceRepo.findAll(companyId, includeInactive);
      return this._buildResponse(data, 'getServices', {
        companyId,
        includeInactive,
        serviceCount: data?.length || 0
      });
    } catch (error) {
      logger.error('getServices failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getServices', backend: 'postgres' },
        extra: { companyId, includeInactive }
      });
      return this._buildErrorResponse(error, 'getServices');
    }
  }

  async getServiceById(serviceYclientsId, companyId = null) {
    try {
      if (!serviceYclientsId || !Number.isInteger(Number(serviceYclientsId))) {
        throw new Error('Invalid service yclients_id');
      }
      if (companyId) this._validateCompanyId(companyId);
      const data = await this.serviceRepo.findById(serviceYclientsId, companyId);
      return this._buildResponse(data, 'getServiceById');
    } catch (error) {
      logger.error('getServiceById failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getServiceById', backend: 'postgres' },
        extra: { serviceYclientsId, companyId }
      });
      return this._buildErrorResponse(error, 'getServiceById');
    }
  }

  async getServicesByCategory(companyId, categoryId) {
    try {
      this._validateCompanyId(companyId);
      if (!categoryId || !Number.isInteger(Number(categoryId))) {
        throw new Error('Invalid category ID');
      }
      const data = await this.serviceRepo.findByCategory(companyId, categoryId);
      return this._buildResponse(data, 'getServicesByCategory', { categoryId });
    } catch (error) {
      logger.error('getServicesByCategory failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getServicesByCategory', backend: 'postgres' },
        extra: { companyId, categoryId }
      });
      return this._buildErrorResponse(error, 'getServicesByCategory');
    }
  }

  async upsertServices(servicesData) {
    try {
      if (!Array.isArray(servicesData)) servicesData = [servicesData];
      if (servicesData.length === 0) throw new Error('Services data array cannot be empty');
      if (servicesData.length > this.config.maxBatchSize) {
        throw new Error(`Cannot upsert more than ${this.config.maxBatchSize} services at once`);
      }

      const validatedData = servicesData.map((service, index) => {
        if (!service.yclients_id || !Number.isInteger(Number(service.yclients_id))) {
          throw new Error(`Invalid yclients_id at index ${index}`);
        }
        if (!service.company_id) throw new Error(`Missing company_id at index ${index}`);
        if (!service.title || typeof service.title !== 'string' || service.title.trim().length === 0) {
          throw new Error(`Invalid title at index ${index}`);
        }
        return { ...service, title: service.title.trim(), updated_at: new Date(), last_sync_at: new Date() };
      });

      const data = await this.serviceRepo.bulkUpsert(validatedData);
      return this._buildResponse(data, 'upsertServices', {
        inputCount: servicesData.length,
        processedCount: data?.length || 0
      });
    } catch (error) {
      logger.error('upsertServices failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'upsertServices', backend: 'postgres' },
        extra: { serviceCount: servicesData.length }
      });
      return this._buildErrorResponse(error, 'upsertServices');
    }
  }

  // =============== COMPANIES QUERIES ===============

  async getCompany(companyId) {
    try {
      this._validateCompanyId(companyId);
      const data = await this.companyRepo.findById(companyId);
      return this._buildResponse(data, 'getCompany');
    } catch (error) {
      logger.error('getCompany failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'getCompany', backend: 'postgres' },
        extra: { companyId }
      });
      return this._buildErrorResponse(error, 'getCompany');
    }
  }

  async upsertCompany(companyData) {
    try {
      if (!companyData.company_id) throw new Error('Missing company_id');
      if (!companyData.title || typeof companyData.title !== 'string') {
        throw new Error('Company title must be a non-empty string');
      }
      const processedData = { ...companyData, title: companyData.title.trim(), updated_at: new Date() };
      const data = await this.companyRepo.upsert(processedData);
      return this._buildResponse(data, 'upsertCompany');
    } catch (error) {
      logger.error('upsertCompany failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'data-layer', operation: 'upsertCompany', backend: 'postgres' },
        extra: { companyId: companyData.company_id }
      });
      return this._buildErrorResponse(error, 'upsertCompany');
    }
  }

  // =============== HEALTH CHECK ===============

  async healthCheck() {
    const startTime = Date.now();
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout);
      });

      const queryPromise = postgres.query('SELECT 1');

      await Promise.race([queryPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      return this._buildResponse({
        healthy: true,
        responseTime,
        maxTimeout: this.config.healthCheckTimeout,
        backend: 'postgres'
      }, 'healthCheck');
    } catch (error) {
      return this._buildErrorResponse(error, 'healthCheck');
    }
  }

  // =============== UTILITY METHODS ===============

  getConfig() {
    return { ...this.config };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    return this.getConfig();
  }
}

// Backward compatibility - export both names
module.exports = { PostgresDataLayer, SupabaseDataLayer: PostgresDataLayer };
