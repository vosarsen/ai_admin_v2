#!/usr/bin/env node

/**
 * Добавление колонки declensions в таблицу staff
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('Adding declensions column to staff table...');
    
    // Выполняем SQL запрос через RPC
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        ALTER TABLE staff 
        ADD COLUMN IF NOT EXISTS declensions jsonb;
      `
    });
    
    if (error) {
      // Если RPC не существует, попробуем другой подход
      console.log('Direct SQL failed, trying alternative approach...');
      
      // Проверяем существующие колонки
      const { data: staffData, error: checkError } = await supabase
        .from('staff')
        .select('*')
        .limit(1);
      
      if (checkError) {
        console.error('Error checking staff table:', checkError);
      } else {
        console.log('Staff table columns:', Object.keys(staffData[0] || {}));
        
        // Если колонки нет, нужно добавить через Supabase Dashboard
        if (staffData[0] && !staffData[0].hasOwnProperty('declensions')) {
          console.log(`
⚠️  MANUAL ACTION REQUIRED:
Please add the 'declensions' column to the 'staff' table in Supabase Dashboard:

1. Go to Supabase Dashboard
2. Navigate to Table Editor → staff
3. Click "Add column" button
4. Set:
   - Name: declensions
   - Type: jsonb
   - Nullable: yes
5. Save the column

After adding the column, run:
node scripts/fix-staff-declensions-quick.js
          `);
        } else {
          console.log('✅ Column declensions already exists!');
        }
      }
    } else {
      console.log('✅ Column added successfully!');
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();