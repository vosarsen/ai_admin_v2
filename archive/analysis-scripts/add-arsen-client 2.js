#!/usr/bin/env node

const { supabase } = require('./src/database/supabase');

async function addArsenClient() {
  console.log('\n=== Добавление клиента Арсен в базу ===');
  
  const clientData = {
    phone: '79068831915',
    raw_phone: '+79068831915',
    name: 'Арсен',
    company_id: 962302,
    yclients_id: 999999, // Временный ID для тестирования
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  try {
    const { data, error } = await supabase
      .from('clients')
      .insert([clientData])
      .select()
      .single();
      
    if (error) {
      console.error('❌ Ошибка при добавлении:', error);
      return;
    }
    
    console.log('✅ Клиент успешно добавлен:');
    console.log('- ID:', data.id);
    console.log('- Имя:', data.name);
    console.log('- Телефон:', data.phone);
    console.log('- Компания:', data.company_id);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запускаем
addArsenClient();