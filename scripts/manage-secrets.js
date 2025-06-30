#!/usr/bin/env node
// scripts/manage-secrets.js
const secretsManager = require('../src/utils/secrets-manager');
const readline = require('readline');
const { promisify } = require('util');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = promisify(rl.question).bind(rl);

async function main() {
  const command = process.argv[2];
  const secretName = process.argv[3];

  try {
    switch (command) {
      case 'generate-key':
        console.log('Generated master key:', secretsManager.constructor.generateMasterKey());
        console.log('Save this key as MASTER_KEY environment variable');
        break;

      case 'set':
        if (!secretName) {
          console.error('Usage: node manage-secrets.js set <secret-name>');
          process.exit(1);
        }
        const value = await question(`Enter value for ${secretName}: `);
        await secretsManager.setSecret(secretName, value);
        console.log(`Secret '${secretName}' saved successfully`);
        break;

      case 'get':
        if (!secretName) {
          console.error('Usage: node manage-secrets.js get <secret-name>');
          process.exit(1);
        }
        const secret = await secretsManager.getSecret(secretName);
        if (secret) {
          console.log(`${secretName}: ${secret}`);
        } else {
          console.log(`Secret '${secretName}' not found`);
        }
        break;

      case 'list':
        const secrets = await secretsManager.listSecrets();
        console.log('Stored secrets:', secrets.join(', ') || 'none');
        break;

      case 'delete':
        if (!secretName) {
          console.error('Usage: node manage-secrets.js delete <secret-name>');
          process.exit(1);
        }
        const deleted = await secretsManager.deleteSecret(secretName);
        console.log(deleted ? `Secret '${secretName}' deleted` : `Secret '${secretName}' not found`);
        break;

      default:
        console.log('AI Admin Secrets Manager');
        console.log('');
        console.log('Commands:');
        console.log('  generate-key           - Generate a new master key');
        console.log('  set <name>            - Store a secret');
        console.log('  get <name>            - Retrieve a secret');
        console.log('  list                  - List all secret names');
        console.log('  delete <name>         - Delete a secret');
        console.log('');
        console.log('Example:');
        console.log('  node scripts/manage-secrets.js generate-key');
        console.log('  node scripts/manage-secrets.js set redis-password');
        console.log('  node scripts/manage-secrets.js list');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();