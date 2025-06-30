// scripts/check-readiness.js
/**
 * Check if the system is ready for production
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 AI Admin MVP Readiness Check');
console.log('================================\n');

let ready = true;
const checks = [];

// 1. Check .env file
if (fs.existsSync('.env')) {
  const env = fs.readFileSync('.env', 'utf8');
  const required = [
    'YCLIENTS_BEARER_TOKEN',
    'YCLIENTS_USER_TOKEN', 
    'DEEPSEEK_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'VENOM_SERVER_URL'
  ];
  
  const missing = required.filter(key => !env.includes(key + '='));
  
  if (missing.length === 0) {
    checks.push({ name: 'Environment variables', status: '✅', message: 'All required vars present' });
  } else {
    checks.push({ name: 'Environment variables', status: '❌', message: `Missing: ${missing.join(', ')}` });
    ready = false;
  }
} else {
  checks.push({ name: 'Environment file', status: '❌', message: '.env file not found' });
  ready = false;
}

// 2. Check dependencies
if (fs.existsSync('node_modules')) {
  checks.push({ name: 'Dependencies', status: '✅', message: 'node_modules exists' });
} else {
  checks.push({ name: 'Dependencies', status: '❌', message: 'Run: npm install' });
  ready = false;
}

// 3. Check critical files
const criticalFiles = [
  'src/index.js',
  'src/workers/index.js',
  'src/services/ai/index.js',
  'src/services/booking/index.js',
  'src/integrations/yclients/client.js'
];

const missingFiles = criticalFiles.filter(file => !fs.existsSync(file));
if (missingFiles.length === 0) {
  checks.push({ name: 'Critical files', status: '✅', message: 'All files present' });
} else {
  checks.push({ name: 'Critical files', status: '❌', message: `Missing: ${missingFiles.join(', ')}` });
  ready = false;
}

// 4. Check logs directory
if (fs.existsSync('logs')) {
  checks.push({ name: 'Logs directory', status: '✅', message: 'logs/ exists' });
} else {
  checks.push({ name: 'Logs directory', status: '⚠️', message: 'Create with: mkdir logs' });
}

// 5. Check PM2
try {
  require('child_process').execSync('pm2 -v', { stdio: 'ignore' });
  checks.push({ name: 'PM2', status: '✅', message: 'PM2 installed' });
} catch {
  checks.push({ name: 'PM2', status: '⚠️', message: 'Install with: npm install -g pm2' });
}

// Print results
console.log('Checklist:');
checks.forEach(check => {
  console.log(`${check.status} ${check.name}: ${check.message}`);
});

console.log('\n' + '='.repeat(50));

if (ready) {
  console.log('✅ System is ready for deployment!');
  console.log('\nNext steps:');
  console.log('1. Run: ./deploy.sh');
  console.log('2. Test with: node scripts/test-flow.js');
  console.log('3. Monitor with: node scripts/monitor.js');
} else {
  console.log('❌ System is not ready. Please fix the issues above.');
}

process.exit(ready ? 0 : 1);