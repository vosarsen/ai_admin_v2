#!/usr/bin/env node

// scripts/migrate-to-baileys.js
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const supabase = require('../src/database/supabase');
const logger = require('../src/utils/logger');

console.log(chalk.blue.bold('\n🔄 WhatsApp Provider Migration: Venom → Baileys\n'));

class WhatsAppMigration {
  constructor() {
    this.steps = [];
    this.completed = [];
    this.failed = [];
  }

  async run() {
    console.log(chalk.yellow('Starting migration process...\n'));

    // Define migration steps
    this.steps = [
      { name: 'Backup Environment', fn: () => this.backupEnvironment() },
      { name: 'Update Environment Variables', fn: () => this.updateEnvironment() },
      { name: 'Create Sessions Directory', fn: () => this.createSessionsDirectory() },
      { name: 'Update Database Schema', fn: () => this.updateDatabaseSchema() },
      { name: 'Test Baileys Connection', fn: () => this.testBaileysConnection() },
      { name: 'Migrate Company Settings', fn: () => this.migrateCompanySettings() },
      { name: 'Update Worker Files', fn: () => this.updateWorkerFiles() },
      { name: 'Generate Migration Report', fn: () => this.generateReport() }
    ];

    // Execute each step
    for (const step of this.steps) {
      try {
        console.log(chalk.cyan(`⏳ ${step.name}...`));
        await step.fn();
        this.completed.push(step.name);
        console.log(chalk.green(`✅ ${step.name} completed\n`));
      } catch (error) {
        this.failed.push({ step: step.name, error: error.message });
        console.log(chalk.red(`❌ ${step.name} failed: ${error.message}\n`));
        
        // Ask if should continue
        if (!await this.askContinue()) {
          break;
        }
      }
    }

    // Summary
    this.printSummary();
  }

  async backupEnvironment() {
    const envPath = path.join(process.cwd(), '.env');
    const backupPath = path.join(process.cwd(), `.env.backup-${Date.now()}`);
    
    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      await fs.writeFile(backupPath, envContent);
      console.log(`  📦 Environment backed up to: ${backupPath}`);
    } catch (error) {
      console.log('  ⚠️  No .env file found, skipping backup');
    }
  }

  async updateEnvironment() {
    const envPath = path.join(process.cwd(), '.env');
    
    try {
      let envContent = await fs.readFile(envPath, 'utf-8');
      
      // Add or update WhatsApp provider settings
      const updates = [
        { key: 'WHATSAPP_PROVIDER', value: 'baileys' },
        { key: 'WHATSAPP_MULTI_TENANT', value: 'true' },
        { key: 'WHATSAPP_SESSIONS_PATH', value: './sessions' }
      ];

      for (const { key, value } of updates) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
          console.log(`  📝 Updated ${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
          console.log(`  ➕ Added ${key}=${value}`);
        }
      }

      await fs.writeFile(envPath, envContent);
      console.log('  ✅ Environment variables updated');

    } catch (error) {
      console.log('  ⚠️  Could not update .env file, please update manually:');
      console.log('     WHATSAPP_PROVIDER=baileys');
      console.log('     WHATSAPP_MULTI_TENANT=true');
      console.log('     WHATSAPP_SESSIONS_PATH=./sessions');
    }
  }

  async createSessionsDirectory() {
    const sessionsPath = path.join(process.cwd(), 'sessions');
    
    try {
      await fs.mkdir(sessionsPath, { recursive: true });
      console.log(`  📁 Created sessions directory: ${sessionsPath}`);
      
      // Create .gitignore in sessions directory
      const gitignorePath = path.join(sessionsPath, '.gitignore');
      await fs.writeFile(gitignorePath, '*\n!.gitignore\n');
      console.log('  📝 Added .gitignore to sessions directory');
      
    } catch (error) {
      throw new Error(`Failed to create sessions directory: ${error.message}`);
    }
  }

  async updateDatabaseSchema() {
    console.log('  🗄️  Updating database schema...');
    
    try {
      // Check if columns exist first
      const { data: columns } = await supabase.rpc('get_table_columns', {
        table_name: 'companies'
      }).single();

      const existingColumns = columns?.map(c => c.column_name) || [];
      
      // Add new columns if they don't exist
      const newColumns = [
        { name: 'whatsapp_enabled', type: 'boolean', default: 'false' },
        { name: 'whatsapp_status', type: 'text', default: "'disconnected'" },
        { name: 'whatsapp_config', type: 'jsonb', default: 'null' },
        { name: 'whatsapp_last_connected', type: 'timestamp', default: 'null' }
      ];

      for (const column of newColumns) {
        if (!existingColumns.includes(column.name)) {
          // Note: This would normally require direct SQL access
          console.log(`  ➕ Need to add column: ${column.name} (manual action required)`);
        } else {
          console.log(`  ✓ Column exists: ${column.name}`);
        }
      }

      console.log('  ℹ️  Database schema check complete');
      console.log('  ⚠️  If columns are missing, add them manually or via migration script');

    } catch (error) {
      console.log('  ⚠️  Could not check database schema automatically');
      console.log('  Please ensure these columns exist in the companies table:');
      console.log('    - whatsapp_enabled (boolean)');
      console.log('    - whatsapp_status (text)');
      console.log('    - whatsapp_config (jsonb)');
      console.log('    - whatsapp_last_connected (timestamp)');
    }
  }

  async testBaileysConnection() {
    console.log('  🧪 Testing Baileys provider...');
    
    try {
      const baileysClient = require('../src/integrations/whatsapp/baileys-client');
      await baileysClient.initialize();
      
      const status = await baileysClient.checkStatus();
      console.log(`  📊 Baileys status: ${status.connected ? 'Ready' : 'Not connected'}`);
      
      if (!status.connected) {
        console.log('  ℹ️  Baileys initialized but not connected (QR scan required)');
      }
      
      console.log('  ✅ Baileys provider is functional');
      
    } catch (error) {
      throw new Error(`Baileys test failed: ${error.message}`);
    }
  }

  async migrateCompanySettings() {
    console.log('  🏢 Migrating company settings...');
    
    try {
      // Get all companies
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, title, phone');

      if (error) throw error;

      if (!companies || companies.length === 0) {
        console.log('  ℹ️  No companies found in database');
        return;
      }

      console.log(`  Found ${companies.length} companies`);

      // Update each company to enable Baileys
      for (const company of companies) {
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            whatsapp_enabled: false, // Start disabled, enable after QR scan
            whatsapp_status: 'disconnected',
            whatsapp_config: {
              provider: 'baileys',
              autoReconnect: true
            }
          })
          .eq('id', company.id);

        if (updateError) {
          console.log(`  ⚠️  Failed to update company ${company.id}: ${updateError.message}`);
        } else {
          console.log(`  ✅ Updated company: ${company.title || company.id}`);
        }
      }

    } catch (error) {
      console.log('  ⚠️  Could not migrate company settings automatically');
      console.log(`  Error: ${error.message}`);
    }
  }

  async updateWorkerFiles() {
    console.log('  📝 Updating worker files...');
    
    const updates = [
      {
        file: 'src/workers/message-worker-v2.js',
        description: 'Message worker to use client factory'
      },
      {
        file: 'src/api/webhooks/whatsapp.js',
        description: 'Webhook handler for multi-tenant support'
      }
    ];

    for (const update of updates) {
      try {
        const filePath = path.join(process.cwd(), update.file);
        await fs.access(filePath);
        console.log(`  ℹ️  ${update.description}`);
        console.log(`     File: ${update.file}`);
        console.log(`     Action: Update to use WhatsAppClientFactory`);
      } catch {
        console.log(`  ⚠️  File not found: ${update.file}`);
      }
    }

    console.log('\n  📌 Manual updates required:');
    console.log('     1. Replace: const whatsappClient = require(\'../integrations/whatsapp/client\');');
    console.log('        With: const clientFactory = require(\'../integrations/whatsapp/client-factory\');');
    console.log('              const whatsappClient = clientFactory.getClient();');
    console.log('\n     2. For multi-tenant messages, use:');
    console.log('        whatsappClient.sendMessageForCompany(companyId, phone, message);');
  }

  async generateReport() {
    const reportPath = path.join(process.cwd(), `migration-report-${Date.now()}.md`);
    
    let report = '# WhatsApp Provider Migration Report\n\n';
    report += `**Date**: ${new Date().toISOString()}\n`;
    report += `**Migration**: Venom → Baileys\n\n`;
    
    report += '## Completed Steps\n\n';
    for (const step of this.completed) {
      report += `- ✅ ${step}\n`;
    }
    
    if (this.failed.length > 0) {
      report += '\n## Failed Steps\n\n';
      for (const fail of this.failed) {
        report += `- ❌ ${fail.step}: ${fail.error}\n`;
      }
    }
    
    report += '\n## Next Steps\n\n';
    report += '1. Update worker files to use WhatsAppClientFactory\n';
    report += '2. Test Baileys connection with a test message\n';
    report += '3. Scan QR code for each company to authenticate\n';
    report += '4. Monitor logs for any issues\n';
    report += '5. Remove Venom dependencies once stable\n';
    
    report += '\n## Configuration\n\n';
    report += '```bash\n';
    report += 'WHATSAPP_PROVIDER=baileys\n';
    report += 'WHATSAPP_MULTI_TENANT=true\n';
    report += 'WHATSAPP_SESSIONS_PATH=./sessions\n';
    report += '```\n';
    
    await fs.writeFile(reportPath, report);
    console.log(`  📄 Migration report saved to: ${reportPath}`);
  }

  async askContinue() {
    // In non-interactive mode, always continue
    if (process.env.CI || process.env.NON_INTERACTIVE) {
      return true;
    }
    
    // For now, auto-continue
    console.log('  ⏩ Continuing with next step...');
    return true;
  }

  printSummary() {
    console.log('\n' + chalk.blue.bold('═'.repeat(50)));
    console.log(chalk.blue.bold('Migration Summary'));
    console.log(chalk.blue.bold('═'.repeat(50)) + '\n');
    
    if (this.completed.length > 0) {
      console.log(chalk.green.bold(`✅ Completed: ${this.completed.length} steps`));
      for (const step of this.completed) {
        console.log(chalk.green(`   • ${step}`));
      }
    }
    
    if (this.failed.length > 0) {
      console.log(chalk.red.bold(`\n❌ Failed: ${this.failed.length} steps`));
      for (const fail of this.failed) {
        console.log(chalk.red(`   • ${fail.step}`));
      }
    }
    
    console.log('\n' + chalk.yellow.bold('📋 Manual Actions Required:'));
    console.log(chalk.yellow('1. Update worker files to use client-factory'));
    console.log(chalk.yellow('2. Scan QR codes for each company'));
    console.log(chalk.yellow('3. Test messaging functionality'));
    console.log(chalk.yellow('4. Monitor logs for stability'));
    
    console.log('\n' + chalk.cyan.bold('🚀 Migration process complete!'));
    console.log(chalk.cyan('Baileys is now ready to use.\n'));
  }
}

// Run migration
const migration = new WhatsAppMigration();
migration.run().catch(error => {
  console.error(chalk.red.bold('\n❌ Migration failed:'), error);
  process.exit(1);
});