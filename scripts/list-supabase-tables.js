require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют SUPABASE_URL или SUPABASE_KEY в .env файле');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  try {
    console.log('📊 Получение списка таблиц из Supabase...\n');
    
    // Получаем список таблиц через SQL запрос
    const { data, error } = await supabase
      .rpc('get_tables_info', {}, {
        get: true,
        head: false
      })
      .single();

    if (error) {
      // Если функция не существует, используем альтернативный метод
      console.log('Используем альтернативный метод получения таблиц...\n');
      
      // Список известных таблиц из CLAUDE.md
      const knownTables = [
        'companies',
        'bookings', 
        'clients',
        'messages',
        'actions',
        'staff_schedules',
        'services',
        'staff',
        'dialog_contexts',
        'booking_slots'
      ];
      
      console.log('📋 Известные таблицы в базе данных:\n');
      
      for (const table of knownTables) {
        try {
          const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          if (!error) {
            console.log(`✅ ${table.padEnd(20)} - ${count || 0} записей`);
          } else {
            console.log(`❓ ${table.padEnd(20)} - недоступна`);
          }
        } catch (e) {
          console.log(`❌ ${table.padEnd(20)} - ошибка`);
        }
      }
    } else {
      // Если функция существует, выводим результат
      console.log('📋 Таблицы в базе данных:\n');
      console.log(data);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

listTables();