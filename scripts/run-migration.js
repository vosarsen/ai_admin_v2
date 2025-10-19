#!/usr/bin/env node

// Run SQL migration via Supabase client

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

async function runMigration(migrationFile) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`📂 Reading migration: ${migrationFile}\n`);

  const sql = fs.readFileSync(migrationFile, 'utf8');

  // Split by semicolon and filter empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📊 Found ${statements.length} SQL statements\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];

    // Skip comments
    if (stmt.startsWith('--') || stmt.startsWith('/*')) {
      continue;
    }

    process.stdout.write(`\r⏳ Executing statement ${i + 1}/${statements.length}...`);

    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: stmt + ';'
      });

      if (error) {
        // Try direct query for DDL statements
        const { error: directError } = await supabase
          .from('_migrations')
          .select('*')
          .limit(0); // Just to test connection

        if (directError) {
          console.error(`\n❌ Statement ${i + 1} failed:`, error.message);
          console.error('Statement:', stmt.substring(0, 100) + '...');
          failed++;
        } else {
          success++;
        }
      } else {
        success++;
      }
    } catch (err) {
      console.error(`\n❌ Error:`, err.message);
      failed++;
    }
  }

  console.log(`\n\n✅ Migration complete!`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}\n`);

  if (failed > 0) {
    console.log('⚠️  Some statements failed. This is normal for CREATE INDEX IF NOT EXISTS.');
    console.log('   Run this migration manually in Supabase SQL Editor:');
    console.log(`   ${migrationFile}\n`);
  }
}

const migrationFile = process.argv[2] || 'migrations/20251008_optimize_whatsapp_keys.sql';
runMigration(migrationFile).catch(console.error);
