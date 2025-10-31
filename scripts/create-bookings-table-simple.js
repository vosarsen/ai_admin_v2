#!/usr/bin/env node

/**
 * Создание таблицы bookings в Supabase
 * Таблица для хранения активных записей клиентов
 */

const { supabase } = require('../src/database/supabase');
const logger = require('../src/utils/logger');

async function createBookingsTable() {
  logger.info('Starting bookings table creation...');
  
  try {
    // Проверяем существует ли таблица
    const { data: existingTable, error: checkError } = await supabase
      .from('bookings')
      .select('id')
      .limit(1);
    
    if (!checkError || checkError.code !== '42P01') {
      logger.info('Table bookings already exists');
      
      // Проверяем количество записей
      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });
      
      logger.info(`Table bookings has ${count} records`);
      return;
    }
    
    // SQL для создания таблицы
    const createTableSQL = `
      -- Создаем таблицу для хранения активных записей
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- YClients идентификаторы
        yclients_record_id INTEGER UNIQUE,
        company_id INTEGER NOT NULL,
        
        -- Информация о клиенте
        client_id INTEGER,
        client_phone VARCHAR(20) NOT NULL,
        client_name VARCHAR(255),
        client_yclients_id INTEGER,
        
        -- Информация о мастере
        staff_id INTEGER,
        staff_name VARCHAR(255),
        
        -- Информация об услугах
        services JSONB DEFAULT '[]',
        service_ids INTEGER[] DEFAULT '{}',
        
        -- Время и дата
        appointment_datetime TIMESTAMP NOT NULL,
        date DATE NOT NULL,
        duration INTEGER DEFAULT 0, -- в минутах
        
        -- Финансы
        cost DECIMAL(10,2) DEFAULT 0,
        prepaid DECIMAL(10,2) DEFAULT 0,
        
        -- Статус записи
        status VARCHAR(20) DEFAULT 'active',
        visit_attendance INTEGER DEFAULT 0,
        
        -- Дополнительная информация
        comment TEXT,
        online BOOLEAN DEFAULT false,
        record_hash VARCHAR(255),
        
        -- Метаданные
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        synced_at TIMESTAMP,
        created_by_bot BOOLEAN DEFAULT false
      );
    `;
    
    // Создаем индексы
    const createIndexesSQL = `
      -- Индексы для быстрого поиска
      CREATE INDEX IF NOT EXISTS idx_bookings_company_id ON bookings(company_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_client_phone ON bookings(client_phone);
      CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id) WHERE client_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_bookings_staff_id ON bookings(staff_id) WHERE staff_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
      CREATE INDEX IF NOT EXISTS idx_bookings_appointment_datetime ON bookings(appointment_datetime);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
      
      -- Составной индекс для поиска активных записей клиента
      CREATE INDEX IF NOT EXISTS idx_bookings_active_client ON bookings(company_id, client_phone, status) 
      WHERE status IN ('active', 'confirmed');
    `;
    
    // Выполняем SQL через Supabase RPC или через прямой SQL
    // Для Supabase нужно создать таблицу через Dashboard или использовать миграции
    
    logger.info('⚠️ ВАЖНО: Таблица bookings должна быть создана в Supabase Dashboard');
    logger.info('');
    logger.info('Выполните следующий SQL в Supabase SQL Editor:');
    logger.info('');
    console.log(createTableSQL);
    console.log(createIndexesSQL);
    logger.info('');
    logger.info('После создания таблицы перезапустите воркеры:');
    logger.info('ssh root@46.149.70.219 "pm2 restart ai-admin-worker-v2"');
    
  } catch (error) {
    logger.error('Error creating bookings table:', error);
    process.exit(1);
  }
}

// Запускаем создание таблицы
createBookingsTable()
  .then(() => {
    logger.info('✅ Bookings table check completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Failed to create bookings table:', error);
    process.exit(1);
  });