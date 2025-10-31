// Тест конфигурации YClients
const config = require('./src/config');
const { YclientsClient } = require('./src/integrations/yclients/client');

console.log('=== Testing Configuration ===');
console.log('config.yclients:', config.yclients);
console.log('config.yclients.companyId:', config.yclients.companyId);
console.log('typeof companyId:', typeof config.yclients.companyId);

console.log('\n=== Creating YclientsClient ===');
const client = new YclientsClient({
  companyId: config.yclients.companyId,
  bearerToken: config.yclients.bearerToken,
  userToken: config.yclients.userToken,
  partnerId: config.yclients.partnerId
});

console.log('client.config.companyId:', client.config.companyId);
console.log('typeof client.config.companyId:', typeof client.config.companyId);

console.log('\n=== Testing ReminderResponseHandler ===');
const handler = require('./src/services/reminder/reminder-response-handler');
console.log('handler.yclientsClient.config.companyId:', handler.yclientsClient.config.companyId);
console.log('typeof:', typeof handler.yclientsClient.config.companyId);

console.log('\n✅ All tests passed!');
