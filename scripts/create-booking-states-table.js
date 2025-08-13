#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createBookingStatesTable() {
  console.log('📋 Creating booking_states table...');

  // SQL для создания таблицы
  const sql = `
    -- Создаем новую таблицу для отслеживания состояний записей
    CREATE TABLE IF NOT EXISTS booking_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        yclients_record_id TEXT NOT NULL UNIQUE,
        company_id INTEGER NOT NULL,
        
        -- Текущее состояние записи
        attendance INTEGER DEFAULT 0, -- 2=подтверждена, 1=пришел, 0=ожидание, -1=не пришел
        datetime TIMESTAMP NOT NULL,
        
        -- Основные данные для отслеживания изменений
        services JSONB,
        staff_id INTEGER,
        staff_name TEXT,
        client_phone TEXT,
        client_name TEXT,
        price DECIMAL(10,2),
        
        -- История изменений
        last_attendance INTEGER, -- Предыдущий статус attendance
        last_datetime TIMESTAMP, -- Предыдущее время
        last_services JSONB, -- Предыдущие услуги
        last_staff_id INTEGER, -- Предыдущий мастер
        
        -- Метаданные
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_checked_at TIMESTAMP DEFAULT NOW()
    );

    -- Индексы для быстрого поиска
    CREATE INDEX IF NOT EXISTS idx_booking_states_record_id ON booking_states(yclients_record_id);
    CREATE INDEX IF NOT EXISTS idx_booking_states_company ON booking_states(company_id);
    CREATE INDEX IF NOT EXISTS idx_booking_states_datetime ON booking_states(datetime);
    CREATE INDEX IF NOT EXISTS idx_booking_states_attendance ON booking_states(attendance);

    -- Комментарии
    COMMENT ON TABLE booking_states IS 'Отслеживание состояний записей для определения изменений';
    COMMENT ON COLUMN booking_states.attendance IS '2=подтверждена, 1=пришел, 0=ожидание, -1=не пришел';
    COMMENT ON COLUMN booking_states.last_attendance IS 'Предыдущий статус для определения изменений';
  `;

  try {
    // Выполняем SQL через RPC функцию (если она есть) или через прямой SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();
    
    if (error) {
      // Если RPC функция не существует, пытаемся другим способом
      console.log('⚠️ RPC function not available, trying alternative method...');
      
      // Проверяем, существует ли таблица
      const { data: tables, error: checkError } = await supabase
        .from('booking_states')
        .select('id')
        .limit(1);
      
      if (checkError && checkError.code === 'PGRST116') {
        console.error('❌ Table does not exist and cannot be created via API');
        console.log('📝 Please execute the following SQL in Supabase SQL Editor:');
        console.log(sql);
        return;
      } else if (!checkError) {
        console.log('✅ Table booking_states already exists');
        return;
      }
    }

    console.log('✅ Table booking_states created successfully');
    
    // Проверяем, что таблица создана
    const { count, error: countError } = await supabase
      .from('booking_states')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`✅ Table booking_states exists with ${count || 0} rows`);
    }

  } catch (err) {
    console.error('❌ Error creating table:', err);
    console.log('\n📝 Please execute the following SQL in Supabase SQL Editor:');
    console.log(sql);
  }
}

// Запускаем создание таблицы
createBookingStatesTable();