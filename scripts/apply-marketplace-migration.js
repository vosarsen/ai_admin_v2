#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

async function applyMigration() {
  const migrationPath = path.join(__dirname, '..', 'migrations', 'add_marketplace_fields_to_companies.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Reading migration file...');

  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .filter(stmt => stmt.trim())
    .map(stmt => stmt.trim() + ';');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(`📝 Executing ${statements.length} SQL statements...`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comments and rollback section
    if (statement.startsWith('--') || statement.includes('Rollback script')) {
      continue;
    }

    try {
      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);

      // Use raw SQL execution
      const { data, error } = await supabase.rpc('exec_sql', {
        query: statement
      }).single();

      if (error) {
        // Try direct execution as alternative
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: statement })
        });

        if (!response.ok) {
          // Check if it's just a duplicate column/index error
          const errorText = await response.text();
          if (errorText.includes('already exists')) {
            console.log(`✅ Already exists, skipping...`);
            successCount++;
          } else {
            console.error(`❌ Error: ${errorText}`);
            errorCount++;
          }
        } else {
          console.log('✅ Success');
          successCount++;
        }
      } else {
        console.log('✅ Success');
        successCount++;
      }
    } catch (err) {
      // Check if it's just a duplicate error
      if (err.message && err.message.includes('already exists')) {
        console.log(`✅ Already exists, skipping...`);
        successCount++;
      } else {
        console.error(`❌ Error: ${err.message}`);
        errorCount++;
      }
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`✅ Successful statements: ${successCount}`);
  console.log(`❌ Failed statements: ${errorCount}`);

  // Verify the columns were added
  console.log('\n🔍 Verifying columns...');

  const { data: columns, error: columnsError } = await supabase
    .from('companies')
    .select('*')
    .limit(1);

  if (!columnsError && columns && columns.length > 0) {
    const company = columns[0];
    const marketplaceFields = [
      'integration_status',
      'marketplace_user_id',
      'whatsapp_connected',
      'api_key',
      'webhook_secret'
    ];

    const existingFields = marketplaceFields.filter(field => field in company);

    if (existingFields.length === marketplaceFields.length) {
      console.log('✅ All marketplace fields verified in companies table');
    } else {
      console.log(`⚠️ Only ${existingFields.length}/${marketplaceFields.length} fields found`);
      console.log('Missing:', marketplaceFields.filter(f => !existingFields.includes(f)));
    }
  }

  console.log('\n✨ Migration process completed!');
}

// Run the migration
applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});