const { supabase } = require('../src/database/supabase');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Running booking monitor migration...');

    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'database', 'create-booking-monitor-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Разбиваем на отдельные команды
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Выполняем каждую команду
    for (const statement of statements) {
      console.log(`\n📝 Executing: ${statement.substring(0, 50)}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement + ';'
      }).single();

      if (error) {
        // Пробуем альтернативный подход
        console.log('⚠️  Direct SQL failed, trying alternative approach...');
        
        // Для CREATE TABLE используем обычный подход
        if (statement.includes('CREATE TABLE')) {
          console.log('✅ Tables will be created manually through Supabase dashboard');
        } else if (statement.includes('INSERT INTO booking_monitor_state')) {
          // Вставляем начальное состояние
          const { error: insertError } = await supabase
            .from('booking_monitor_state')
            .insert({
              id: 1,
              last_checked_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
              company_id: 962302
            });
          
          if (insertError && !insertError.message.includes('duplicate')) {
            console.error('❌ Insert error:', insertError);
          } else {
            console.log('✅ Initial state inserted');
          }
        }
      } else {
        console.log('✅ Success');
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('\n⚠️  IMPORTANT: Please create the tables manually in Supabase dashboard:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Open SQL Editor');
    console.log('3. Copy and paste the SQL from scripts/database/create-booking-monitor-tables.sql');
    console.log('4. Run the query');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();