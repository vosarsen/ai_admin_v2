/**
 * Repository Pattern Exports
 *
 * Provides a unified interface for database access with support for
 * both Supabase and Timeweb PostgreSQL backends.
 *
 * Usage:
 *   const { ClientRepository } = require('./repositories');
 *   const postgres = require('./database/postgres');
 *   const clientRepo = new ClientRepository(postgres);
 *   const client = await clientRepo.findByPhone('89686484488');
 */

const BaseRepository = require('./BaseRepository');
const ClientRepository = require('./ClientRepository');
const ServiceRepository = require('./ServiceRepository');
const StaffRepository = require('./StaffRepository');
const StaffScheduleRepository = require('./StaffScheduleRepository');
const DialogContextRepository = require('./DialogContextRepository');
const CompanyRepository = require('./CompanyRepository');
const BookingRepository = require('./BookingRepository');
const BookingNotificationRepository = require('./BookingNotificationRepository');

module.exports = {
  BaseRepository,
  ClientRepository,
  ServiceRepository,
  StaffRepository,
  StaffScheduleRepository,
  DialogContextRepository,
  CompanyRepository,
  BookingRepository,
  BookingNotificationRepository
};
