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

// New repositories for supabase-broken-references-fix (2025-11-26)
const WebhookEventsRepository = require('./WebhookEventsRepository');
const MarketplaceEventsRepository = require('./MarketplaceEventsRepository');
const AppointmentsCacheRepository = require('./AppointmentsCacheRepository');
const MessageRepository = require('./MessageRepository');
const DemoChatAnalyticsRepository = require('./DemoChatAnalyticsRepository');

// Telegram integration (2025-11-29)
const TelegramConnectionRepository = require('./TelegramConnectionRepository');
const TelegramLinkingRepository = require('./TelegramLinkingRepository');

// Robokassa integration (2025-12-04)
const RobokassaPaymentRepository = require('./RobokassaPaymentRepository');

module.exports = {
  BaseRepository,
  ClientRepository,
  ServiceRepository,
  StaffRepository,
  StaffScheduleRepository,
  DialogContextRepository,
  CompanyRepository,
  BookingRepository,
  BookingNotificationRepository,
  // New repositories
  WebhookEventsRepository,
  MarketplaceEventsRepository,
  AppointmentsCacheRepository,
  MessageRepository,
  DemoChatAnalyticsRepository,
  // Telegram integration
  TelegramConnectionRepository,
  TelegramLinkingRepository,
  // Robokassa integration
  RobokassaPaymentRepository
};
