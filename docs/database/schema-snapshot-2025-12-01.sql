-- Database Schema Dump
-- Generated: 2025-12-01T15:44:44.016Z
-- Database: default_db
-- Purpose: Phase 0.5 Schema Verification for Database Code Review

-- ============================================
-- Table: actions
-- ============================================

-- Columns:
--   id                             uuid                 NOT NULL DEFAULT gen_random_uuid()
--   company_id                     integer              NULL
--   client_phone                   character varying    NULL
--   action_type                    character varying    NULL
--   action_data                    jsonb                NULL
--   status                         character varying    NULL
--   created_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   executed_at                    timestamp without time zone NULL

-- Indexes:
--   actions_pkey
--   idx_actions_client_phone
--   idx_actions_company_id
--   idx_actions_status

-- ============================================
-- Table: appointments_cache
-- ============================================

-- Columns:
--   id                             integer              NOT NULL DEFAULT nextval('appointments_cache_id_seq'::regclass)
--   yclients_record_id             integer              NOT NULL
--   company_id                     integer              NOT NULL
--   client_id                      integer              NULL
--   client_phone                   character varying    NULL
--   service_id                     integer              NULL
--   staff_id                       integer              NULL
--   appointment_datetime           timestamp with time zone NULL
--   cost                           numeric              NULL DEFAULT 0
--   status                         character varying    NULL DEFAULT 'confirmed'::character varying
--   is_cancelled                   boolean              NULL DEFAULT false
--   deleted                        boolean              NULL DEFAULT false
--   cancellation_reason            text                 NULL
--   raw_data                       jsonb                NULL
--   created_at                     timestamp with time zone NULL DEFAULT now()
--   updated_at                     timestamp with time zone NULL DEFAULT now()

-- Indexes:
--   appointments_cache_pkey
--   appointments_cache_yclients_record_id_key
--   idx_appointments_cache_company
--   idx_appointments_cache_datetime
--   idx_appointments_cache_record_id
--   idx_appointments_cache_status

-- ============================================
-- Table: booking_notifications
-- ============================================

-- Columns:
--   id                             integer              NOT NULL DEFAULT nextval('booking_notifications_id_seq'::regclass)
--   yclients_record_id             integer              NOT NULL
--   company_id                     integer              NOT NULL
--   phone                          character varying    NOT NULL
--   notification_type              character varying    NOT NULL
--   message                        text                 NULL
--   sent_at                        timestamp with time zone NOT NULL DEFAULT now()
--   status                         character varying    NULL DEFAULT 'sent'::character varying
--   error_message                  text                 NULL
--   created_at                     timestamp with time zone NULL DEFAULT now()
--   notification_date              date                 NULL DEFAULT CURRENT_DATE

-- Indexes:
--   booking_notifications_pkey
--   idx_bn_company
--   idx_bn_duplicate_check
--   idx_bn_phone
--   idx_bn_sent_at
--   idx_bn_unique_notification

-- ============================================
-- Table: bookings
-- ============================================

-- Columns:
--   id                             uuid                 NOT NULL DEFAULT gen_random_uuid()
--   yclients_record_id             integer              NOT NULL
--   company_id                     integer              NULL
--   client_phone                   character varying    NULL
--   client_name                    character varying    NULL
--   client_yclients_id             integer              NULL
--   staff_id                       integer              NULL
--   staff_name                     character varying    NULL
--   services                       ARRAY                NULL
--   service_ids                    ARRAY                NULL
--   datetime                       timestamp without time zone NOT NULL
--   date                           date                 NULL
--   duration                       integer              NULL
--   cost                           numeric              NULL
--   prepaid                        numeric              NULL
--   status                         character varying    NULL
--   visit_attendance               integer              NULL
--   comment                        text                 NULL
--   online                         boolean              NULL DEFAULT false
--   record_hash                    character varying    NULL
--   created_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   updated_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   synced_at                      timestamp without time zone NULL
--   created_by_bot                 boolean              NULL DEFAULT false

-- Indexes:
--   bookings_pkey
--   bookings_yclients_company_unique
--   idx_bookings_client_phone
--   idx_bookings_company_id
--   idx_bookings_date
--   idx_bookings_datetime
--   idx_bookings_yclients_record_id

-- ============================================
-- Table: clients
-- ============================================

-- Columns:
--   id                             integer              NOT NULL DEFAULT nextval('clients_id_seq'::regclass)
--   yclients_id                    integer              NOT NULL
--   name                           character varying    NULL
--   phone                          character varying    NOT NULL
--   raw_phone                      character varying    NULL
--   email                          character varying    NULL
--   discount                       numeric              NULL
--   company_id                     integer              NULL
--   branch_ids                     ARRAY                NULL
--   tags                           ARRAY                NULL
--   status                         character varying    NULL
--   source                         character varying    NULL
--   created_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   updated_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   visit_count                    integer              NULL DEFAULT 0
--   total_spent                    numeric              NULL
--   first_visit_date               date                 NULL
--   last_visit_date                date                 NULL
--   last_services                  ARRAY                NULL
--   visit_history                  jsonb                NULL
--   preferences                    jsonb                NULL
--   last_sync_at                   timestamp without time zone NULL
--   loyalty_level                  character varying    NULL
--   client_segment                 character varying    NULL
--   average_bill                   numeric              NULL
--   last_service_ids               ARRAY                NULL
--   favorite_staff_ids             ARRAY                NULL
--   preferred_time_slots           ARRAY                NULL
--   blacklisted                    boolean              NULL DEFAULT false
--   notes                          text                 NULL
--   created_by_ai                  boolean              NULL DEFAULT false
--   last_ai_interaction            timestamp without time zone NULL
--   ai_context                     jsonb                NULL
--   ai_messages_count              integer              NULL DEFAULT 0
--   ai_satisfaction_score          numeric              NULL
--   services_amount                numeric              NULL
--   goods_amount                   numeric              NULL
--   goods_purchases                jsonb                NULL
--   goods_count                    integer              NULL DEFAULT 0

-- Indexes:
--   clients_pkey
--   clients_yclients_company_unique
--   idx_clients_company_id
--   idx_clients_last_visit_date
--   idx_clients_phone
--   idx_clients_yclients_id

-- ============================================
-- Table: companies
-- ============================================

-- Columns:
--   id                             integer              NOT NULL DEFAULT nextval('companies_id_seq'::regclass)
--   company_id                     integer              NOT NULL
--   yclients_id                    integer              NULL
--   title                          character varying    NULL
--   address                        character varying    NULL
--   phone                          character varying    NULL
--   email                          character varying    NULL
--   website                        character varying    NULL
--   timezone                       character varying    NULL
--   working_hours                  character varying    NULL
--   coordinate_lat                 numeric              NULL
--   coordinate_lon                 numeric              NULL
--   currency                       character varying    NULL
--   ai_enabled                     boolean              NULL DEFAULT false
--   sync_enabled                   boolean              NULL DEFAULT true
--   created_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   updated_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   last_sync_at                   timestamp without time zone NULL
--   raw_data                       jsonb                NULL
--   whatsapp_enabled               boolean              NULL DEFAULT false
--   whatsapp_config                jsonb                NULL
--   whatsapp_connected             boolean              NULL DEFAULT false
--   whatsapp_phone                 character varying    NULL
--   whatsapp_connected_at          timestamp without time zone NULL
--   integration_status             character varying    NULL
--   connected_at                   timestamp without time zone NULL
--   marketplace_user_id            character varying    NULL
--   marketplace_user_name          character varying    NULL
--   marketplace_user_phone         character varying    NULL
--   marketplace_user_email         character varying    NULL
--   whatsapp_session_data          jsonb                NULL
--   api_key                        character varying    NULL
--   webhook_secret                 character varying    NULL
--   last_payment_date              timestamp without time zone NULL
--   subscription_expires_at        timestamp with time zone NULL
--   whatsapp_channel_enabled       boolean              NULL DEFAULT true
--   sms_channel_enabled            boolean              NULL DEFAULT false
--   sms_short_names                ARRAY                NULL
--   disconnected_at                timestamp with time zone NULL
--   status                         character varying    NULL
--   telegram_enabled               boolean              NULL DEFAULT false
--   telegram_premium_until         timestamp without time zone NULL

-- Indexes:
--   companies_pkey
--   idx_companies_company_id
--   idx_companies_status
--   idx_companies_subscription_expires
--   idx_companies_yclients_id

-- ============================================
-- Table: company_sync_status
-- ============================================

-- Columns:
--   id                             integer              NOT NULL DEFAULT nextval('company_sync_status_id_seq'::regclass)
--   company_id                     integer              NOT NULL
--   last_sync_at                   timestamp without time zone NULL
--   last_sync_success              boolean              NULL
--   last_sync_error                text                 NULL
--   clients_synced                 integer              NULL DEFAULT 0
--   services_synced                integer              NULL DEFAULT 0
--   staff_synced                   integer              NULL DEFAULT 0
--   bookings_synced                integer              NULL DEFAULT 0
--   created_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   updated_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP

-- Indexes:
--   company_sync_status_pkey
--   idx_company_sync_status_company_id

-- ============================================
-- Table: demo_chat_events
-- ============================================

-- Columns:
--   id                             bigint               NOT NULL DEFAULT nextval('demo_chat_events_id_seq'::regclass)
--   session_id                     uuid                 NOT NULL
--   event_type                     character varying    NOT NULL
--   message                        text                 NULL
--   response                       text                 NULL
--   user_ip                        character varying    NULL
--   processing_time_ms             integer              NULL
--   ai_provider                    character varying    NULL
--   error_type                     character varying    NULL
--   error_message                  text                 NULL
--   event_data                     jsonb                NULL
--   created_at                     timestamp with time zone NULL DEFAULT now()

-- Indexes:
--   demo_chat_events_pkey
--   idx_demo_chat_events_ai_provider
--   idx_demo_chat_events_created_at
--   idx_demo_chat_events_event_type
--   idx_demo_chat_events_session_created
--   idx_demo_chat_events_session_id
--   idx_demo_chat_events_user_ip

-- ============================================
-- Table: dialog_contexts
-- ============================================

-- Columns:
--   id                             uuid                 NOT NULL DEFAULT gen_random_uuid()
--   user_id                        character varying    NOT NULL
--   state                          character varying    NULL
--   data                           jsonb                NULL
--   messages                       jsonb                NULL
--   created_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   updated_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   client_id                      integer              NULL
--   last_activity                  timestamp without time zone NULL
--   message_count                  integer              NULL DEFAULT 0
--   last_booking_id                uuid                 NULL
--   session_type                   character varying    NULL
--   context_metadata               jsonb                NULL
--   company_id                     integer              NULL

-- Indexes:
--   dialog_contexts_pkey
--   idx_dialog_contexts_company_id
--   idx_dialog_contexts_last_activity
--   idx_dialog_contexts_user_id

-- ============================================
-- Table: marketplace_events
-- ============================================

-- Columns:
--   id                             bigint               NOT NULL DEFAULT nextval('marketplace_events_id_seq'::regclass)
--   company_id                     bigint               NULL
--   salon_id                       integer              NOT NULL
--   event_type                     character varying    NOT NULL
--   event_data                     jsonb                NULL
--   created_at                     timestamp with time zone NULL DEFAULT now()

-- Indexes:
--   idx_marketplace_events_company_id
--   idx_marketplace_events_salon_id
--   idx_marketplace_events_type
--   marketplace_events_pkey

-- ============================================
-- Table: messages
-- ============================================

-- Columns:
--   id                             uuid                 NOT NULL DEFAULT gen_random_uuid()
--   company_id                     integer              NULL
--   client_phone                   character varying    NULL
--   direction                      character varying    NULL
--   content                        text                 NULL
--   message_type                   character varying    NULL
--   status                         character varying    NULL
--   created_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   metadata                       jsonb                NULL
--   platform                       character varying    NULL DEFAULT 'whatsapp'::character varying

-- Indexes:
--   idx_messages_client_phone
--   idx_messages_company_id
--   idx_messages_created_at
--   idx_messages_platform
--   messages_pkey

-- ============================================
-- Table: services
-- ============================================

-- Columns:
--   id                             integer              NOT NULL DEFAULT nextval('services_id_seq'::regclass)
--   yclients_id                    integer              NOT NULL
--   company_id                     integer              NULL
--   title                          character varying    NOT NULL
--   category_id                    integer              NULL
--   category_title                 character varying    NULL
--   price_min                      numeric              NULL
--   price_max                      numeric              NULL
--   discount                       numeric              NULL
--   duration                       integer              NULL
--   seance_length                  integer              NULL
--   is_active                      boolean              NULL DEFAULT true
--   is_bookable                    boolean              NULL DEFAULT true
--   description                    text                 NULL
--   weight                         integer              NULL DEFAULT 0
--   created_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   updated_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   last_sync_at                   timestamp without time zone NULL
--   raw_data                       jsonb                NULL
--   image_url                      character varying    NULL
--   declensions                    jsonb                NULL

-- Indexes:
--   idx_services_company_id
--   idx_services_is_active
--   idx_services_yclients_id
--   services_pkey
--   services_yclients_company_unique

-- ============================================
-- Table: staff
-- ============================================

-- Columns:
--   id                             integer              NOT NULL DEFAULT nextval('staff_id_seq'::regclass)
--   yclients_id                    integer              NOT NULL
--   company_id                     integer              NULL
--   name                           character varying    NOT NULL
--   specialization                 character varying    NULL
--   position                       character varying    NULL
--   is_active                      boolean              NULL DEFAULT true
--   is_bookable                    boolean              NULL DEFAULT true
--   rating                         numeric              NULL
--   votes_count                    integer              NULL DEFAULT 0
--   comments_count                 integer              NULL DEFAULT 0
--   avatar_url                     text                 NULL
--   information                    text                 NULL
--   service_ids                    ARRAY                NULL
--   email                          character varying    NULL
--   phone                          character varying    NULL
--   telegram                       character varying    NULL
--   experience_years               integer              NULL
--   level_name                     character varying    NULL
--   created_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   updated_at                     timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   last_sync_at                   timestamp without time zone NULL
--   raw_data                       jsonb                NULL
--   declensions                    jsonb                NULL

-- Indexes:
--   idx_staff_company_id
--   idx_staff_is_active
--   idx_staff_yclients_id
--   staff_pkey
--   staff_yclients_company_unique

-- ============================================
-- Table: staff_schedules
-- ============================================

-- Columns:
--   id                             bigint               NOT NULL DEFAULT nextval('staff_schedules_id_seq'::regclass)
--   yclients_staff_id              integer              NOT NULL
--   staff_name                     character varying    NULL
--   date                           date                 NOT NULL
--   is_working                     boolean              NULL DEFAULT true
--   work_start                     time without time zone NULL
--   work_end                       time without time zone NULL
--   working_hours                  character varying    NULL
--   last_updated                   timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
--   has_booking_slots              boolean              NULL DEFAULT true
--   company_id                     integer              NULL

-- Indexes:
--   idx_staff_schedules_date
--   idx_staff_schedules_staff_date
--   idx_staff_schedules_staff_id
--   staff_schedules_pkey
--   staff_schedules_unique_key

-- ============================================
-- Table: telegram_business_connections
-- ============================================

-- Columns:
--   id                             integer              NOT NULL DEFAULT nextval('telegram_business_connections_id_seq'::regclass)
--   company_id                     integer              NOT NULL
--   business_connection_id         character varying    NOT NULL
--   telegram_user_id               bigint               NOT NULL
--   telegram_username              character varying    NULL
--   telegram_first_name            character varying    NULL
--   can_reply                      boolean              NULL DEFAULT false
--   is_active                      boolean              NULL DEFAULT true
--   connected_at                   timestamp without time zone NULL DEFAULT now()
--   disconnected_at                timestamp without time zone NULL
--   created_at                     timestamp without time zone NULL DEFAULT now()
--   updated_at                     timestamp without time zone NULL DEFAULT now()

-- Indexes:
--   idx_telegram_active
--   idx_telegram_business_connection
--   idx_telegram_company_active
--   idx_telegram_company_id
--   idx_telegram_user_id
--   telegram_business_connections_business_connection_id_key
--   telegram_business_connections_pkey

-- ============================================
-- Table: telegram_linking_codes
-- ============================================

-- Columns:
--   id                             integer              NOT NULL DEFAULT nextval('telegram_linking_codes_id_seq'::regclass)
--   code                           character varying    NOT NULL
--   company_id                     integer              NOT NULL
--   status                         character varying    NULL DEFAULT 'pending'::character varying
--   expires_at                     timestamp with time zone NOT NULL
--   used_at                        timestamp with time zone NULL
--   used_by_telegram_id            bigint               NULL
--   used_by_username               character varying    NULL
--   created_by                     character varying    NULL DEFAULT 'system'::character varying
--   created_at                     timestamp with time zone NULL DEFAULT now()

-- Indexes:
--   idx_linking_codes_code
--   idx_linking_codes_company
--   idx_linking_codes_company_pending
--   telegram_linking_codes_code_key
--   telegram_linking_codes_pkey

-- ============================================
-- Table: telegram_user_company_links
-- ============================================

-- Columns:
--   id                             integer              NOT NULL DEFAULT nextval('telegram_user_company_links_id_seq'::regclass)
--   telegram_user_id               bigint               NOT NULL
--   telegram_username              character varying    NULL
--   company_id                     integer              NOT NULL
--   linked_at                      timestamp with time zone NULL DEFAULT now()
--   linked_via_code                character varying    NULL
--   is_active                      boolean              NULL DEFAULT true
--   created_at                     timestamp with time zone NULL DEFAULT now()
--   updated_at                     timestamp with time zone NULL DEFAULT now()

-- Indexes:
--   idx_user_links_active
--   idx_user_links_company
--   idx_user_links_telegram_id
--   telegram_user_company_links_pkey
--   telegram_user_company_links_telegram_user_id_key

-- ============================================
-- Table: webhook_events
-- ============================================

-- Columns:
--   id                             uuid                 NOT NULL DEFAULT gen_random_uuid()
--   event_id                       character varying    NOT NULL
--   event_type                     character varying    NOT NULL
--   company_id                     integer              NOT NULL
--   record_id                      integer              NULL
--   payload                        jsonb                NOT NULL
--   processed_at                   timestamp without time zone NULL
--   created_at                     timestamp without time zone NULL DEFAULT now()

-- Indexes:
--   idx_webhook_events_company_id
--   idx_webhook_events_created_at
--   idx_webhook_events_event_id
--   webhook_events_event_id_key
--   webhook_events_pkey

-- ============================================
-- Table: whatsapp_auth
-- ============================================

-- Columns:
--   company_id                     text                 NOT NULL
--   creds                          jsonb                NOT NULL
--   created_at                     timestamp with time zone NULL DEFAULT now()
--   updated_at                     timestamp with time zone NULL DEFAULT now()

-- Indexes:
--   idx_whatsapp_auth_company
--   whatsapp_auth_pkey

-- ============================================
-- Table: whatsapp_keys
-- ============================================

-- Columns:
--   company_id                     text                 NOT NULL
--   key_type                       text                 NOT NULL
--   key_id                         text                 NOT NULL
--   value                          jsonb                NOT NULL
--   created_at                     timestamp with time zone NULL DEFAULT now()
--   updated_at                     timestamp with time zone NULL DEFAULT now()
--   expires_at                     timestamp with time zone NULL

-- Indexes:
--   idx_whatsapp_keys_company
--   idx_whatsapp_keys_expires
--   idx_whatsapp_keys_expires_cleanup
--   idx_whatsapp_keys_type
--   idx_whatsapp_keys_type_company
--   whatsapp_keys_pkey


-- ============================================
-- QUICK REFERENCE: Column Names for Code Review
-- ============================================

-- staff_schedules: id, yclients_staff_id, staff_name, date, is_working, work_start, work_end, working_hours, last_updated, has_booking_slots, company_id
-- staff: id, yclients_id, company_id, name, specialization, position, is_active, is_bookable, rating, votes_count, comments_count, avatar_url, information, service_ids, email, phone, telegram, experience_years, level_name, created_at, updated_at, last_sync_at, raw_data, declensions
-- bookings: id, yclients_record_id, company_id, client_phone, client_name, client_yclients_id, staff_id, staff_name, services, service_ids, datetime, date, duration, cost, prepaid, status, visit_attendance, comment, online, record_hash, created_at, updated_at, synced_at, created_by_bot
-- clients: id, yclients_id, name, phone, raw_phone, email, discount, company_id, branch_ids, tags, status, source, created_at, updated_at, visit_count, total_spent, first_visit_date, last_visit_date, last_services, visit_history, preferences, last_sync_at, loyalty_level, client_segment, average_bill, last_service_ids, favorite_staff_ids, preferred_time_slots, blacklisted, notes, created_by_ai, last_ai_interaction, ai_context, ai_messages_count, ai_satisfaction_score, services_amount, goods_amount, goods_purchases, goods_count
-- services: id, yclients_id, company_id, title, category_id, category_title, price_min, price_max, discount, duration, seance_length, is_active, is_bookable, description, weight, created_at, updated_at, last_sync_at, raw_data, image_url, declensions
-- companies: id, company_id, yclients_id, title, address, phone, email, website, timezone, working_hours, coordinate_lat, coordinate_lon, currency, ai_enabled, sync_enabled, created_at, updated_at, last_sync_at, raw_data, whatsapp_enabled, whatsapp_config, whatsapp_connected, whatsapp_phone, whatsapp_connected_at, integration_status, connected_at, marketplace_user_id, marketplace_user_name, marketplace_user_phone, marketplace_user_email, whatsapp_session_data, api_key, webhook_secret, last_payment_date, subscription_expires_at, whatsapp_channel_enabled, sms_channel_enabled, sms_short_names, disconnected_at, status, telegram_enabled, telegram_premium_until
