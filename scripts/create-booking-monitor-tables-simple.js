require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log('🚀 Creating booking monitor tables...\n');
  
  console.log('ℹ️  Tables need to be created manually in Supabase dashboard:');
  console.log('1. Go to your Supabase project dashboard');
  console.log('2. Click on "SQL Editor" in the left sidebar');
  console.log('3. Copy and paste the following SQL:');
  console.log('\n' + '='.repeat(60) + '\n');
  
  const sql = `-- Таблица для хранения состояния мониторинга записей
CREATE TABLE IF NOT EXISTS booking_monitor_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    company_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Таблица для отслеживания отправленных уведомлений
CREATE TABLE IF NOT EXISTS booking_notifications (
    id SERIAL PRIMARY KEY,
    yclients_record_id INTEGER NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    booking_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_booking_notifications_phone ON booking_notifications(phone);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_sent_at ON booking_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_record_id ON booking_notifications(yclients_record_id);

-- Комментарии к таблицам
COMMENT ON TABLE booking_monitor_state IS 'Состояние мониторинга новых записей';
COMMENT ON TABLE booking_notifications IS 'История отправленных уведомлений о записях';

-- Инициализируем состояние мониторинга
INSERT INTO booking_monitor_state (id, last_checked_at, company_id)
VALUES (1, NOW() - INTERVAL '1 hour', 962302)
ON CONFLICT (id) DO NOTHING;`;
  
  console.log(sql);
  console.log('\n' + '='.repeat(60) + '\n');
  
  console.log('4. Click "Run" button');
  console.log('5. Tables will be created successfully!\n');
  
  // Попробуем проверить, существуют ли таблицы
  const { data: tables } = await supabase
    .from('booking_monitor_state')
    .select('id')
    .limit(1);
  
  if (tables) {
    console.log('✅ Table booking_monitor_state already exists!');
  } else {
    console.log('⚠️  Table booking_monitor_state does not exist yet');
  }
}

createTables().catch(console.error);