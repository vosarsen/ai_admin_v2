#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function applyMigration() {
  console.log('📝 Applying marketplace migration...\n');

  // Test if columns already exist
  const { data: testData, error: testError } = await supabase
    .from('companies')
    .select('id')
    .limit(1);

  if (testError) {
    console.error('❌ Cannot connect to database:', testError.message);
    return;
  }

  // Individual column additions
  const columns = [
    { name: 'integration_status', type: 'VARCHAR(50)', default: "'pending'" },
    { name: 'marketplace_user_id', type: 'VARCHAR(255)', default: 'NULL' },
    { name: 'marketplace_user_name', type: 'VARCHAR(255)', default: 'NULL' },
    { name: 'marketplace_user_phone', type: 'VARCHAR(50)', default: 'NULL' },
    { name: 'marketplace_user_email', type: 'VARCHAR(255)', default: 'NULL' },
    { name: 'whatsapp_connected', type: 'BOOLEAN', default: 'FALSE' },
    { name: 'whatsapp_phone', type: 'VARCHAR(50)', default: 'NULL' },
    { name: 'whatsapp_connected_at', type: 'TIMESTAMPTZ', default: 'NULL' },
    { name: 'whatsapp_session_data', type: 'TEXT', default: 'NULL' },
    { name: 'api_key', type: 'VARCHAR(255)', default: 'NULL' },
    { name: 'webhook_secret', type: 'VARCHAR(255)', default: 'NULL' },
    { name: 'last_payment_date', type: 'TIMESTAMPTZ', default: 'NULL' },
    { name: 'connected_at', type: 'TIMESTAMPTZ', default: 'NULL' }
  ];

  console.log('Adding columns to companies table...\n');

  // Since we can't execute raw SQL via Supabase JS client directly,
  // we'll check if columns exist by trying to select them
  const { data: checkData, error: checkError } = await supabase
    .from('companies')
    .select('integration_status, marketplace_user_id, whatsapp_connected')
    .limit(1);

  if (checkError && checkError.message.includes('column')) {
    console.log('⚠️  Some columns do not exist yet.');
    console.log('📝 Please run the following SQL in Supabase Dashboard SQL Editor:\n');

    console.log('-- Add marketplace fields to companies table');
    columns.forEach(col => {
      console.log(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} DEFAULT ${col.default};`);
    });

    console.log('\n-- Create marketplace_events table');
    console.log(`CREATE TABLE IF NOT EXISTS marketplace_events (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    salon_id INTEGER NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`);

    console.log('\n-- Create marketplace_tokens table');
    console.log(`CREATE TABLE IF NOT EXISTS marketplace_tokens (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    salon_id INTEGER NOT NULL,
    token_type VARCHAR(50) NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);`);

    console.log('\n📋 Copy the SQL above and run it in:');
    console.log('   https://supabase.com/dashboard/project/yazteodihdglhoxgqunp/sql/new');

  } else if (!checkError) {
    console.log('✅ Marketplace columns already exist in companies table');

    // Check for marketplace_events table
    const { data: eventsData, error: eventsError } = await supabase
      .from('marketplace_events')
      .select('id')
      .limit(1);

    if (eventsError && eventsError.message.includes('relation')) {
      console.log('⚠️  marketplace_events table does not exist');
      console.log('Please create it in Supabase Dashboard');
    } else {
      console.log('✅ marketplace_events table exists');
    }

    // Check for marketplace_tokens table
    const { data: tokensData, error: tokensError } = await supabase
      .from('marketplace_tokens')
      .select('id')
      .limit(1);

    if (tokensError && tokensError.message.includes('relation')) {
      console.log('⚠️  marketplace_tokens table does not exist');
      console.log('Please create it in Supabase Dashboard');
    } else {
      console.log('✅ marketplace_tokens table exists');
    }
  }
}

applyMigration().catch(console.error);