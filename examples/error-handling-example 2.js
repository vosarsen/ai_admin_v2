// examples/error-handling-example.js
const errorMessages = require('../src/utils/error-messages');

// Примеры использования системы user-friendly сообщений об ошибках

console.log('=== Примеры обработки ошибок ===\n');

// 1. Сетевая ошибка
const networkError = new Error('Connection refused');
networkError.code = 'ECONNREFUSED';
const result1 = errorMessages.getUserMessage(networkError);
console.log('1. Сетевая ошибка:');
console.log('   Техническая:', networkError.message);
console.log('   Для пользователя:', result1.message);
console.log('   Нужен retry:', result1.needsRetry);
console.log('');

// 2. Ошибка YClients API - время занято
const yclientsError = new Error('Слот занят другим клиентом');
const result2 = errorMessages.getUserMessage(yclientsError, { operation: 'booking' });
console.log('2. Время занято:');
console.log('   Техническая:', yclientsError.message);
console.log('   Для пользователя:', result2.message);
console.log('   Подсказки:', result2.help);
console.log('');

// 3. Ошибка валидации
const validationError = 'Invalid phone number format';
const result3 = errorMessages.getUserMessage(validationError);
console.log('3. Неверный формат телефона:');
console.log('   Техническая:', validationError);
console.log('   Для пользователя:', result3.message);
console.log('   Подсказки:', result3.help);
console.log('');

// 4. HTTP ошибка 502
const httpError = new Error('Bad Gateway');
httpError.response = { status: 502 };
const result4 = errorMessages.getUserMessage(httpError);
console.log('4. HTTP 502 ошибка:');
console.log('   Техническая:', httpError.message);
console.log('   Для пользователя:', result4.message);
console.log('   Серьезность:', result4.severity);
console.log('');

// 5. Неизвестная ошибка с контекстом
const unknownError = new Error('Something went wrong in database');
const result5 = errorMessages.getUserMessage(unknownError, { operation: 'booking' });
console.log('5. Неизвестная ошибка при записи:');
console.log('   Техническая:', unknownError.message);
console.log('   Для пользователя:', result5.message);
console.log('');

// 6. Форматирование полного ответа
console.log('=== Примеры форматированных ответов ===\n');

const errorResult = {
  message: 'Сервис недоступен',
  help: ['Попробуйте через 5 минут', 'Или позвоните нам: +7 900 123-45-67'],
  severity: 'high',
  needsRetry: true
};

const formatted = errorMessages.formatUserResponse(errorResult);
console.log('Полный ответ пользователю:');
console.log(formatted);
console.log('');

// 7. Команды с ошибками
const commandError = new Error('Мастер не определен');
commandError.code = 'STAFF_NOT_SPECIFIED';
const result6 = errorMessages.getUserMessage(commandError, { 
  operation: 'command_execution',
  command: 'CREATE_BOOKING'
});
console.log('7. Ошибка при выполнении команды:');
console.log('   Команда: CREATE_BOOKING');
console.log('   Техническая:', commandError.message);
console.log('   Для пользователя:', result6.message);
console.log('');

// 8. Проверка на повторяемость
console.log('=== Проверка повторяемости ошибок ===\n');

const retryableErrors = ['ECONNREFUSED', '503', 'Request timeout'];
const nonRetryableErrors = ['400', 'Invalid phone', 'занят'];

console.log('Можно повторить:');
retryableErrors.forEach(err => {
  console.log(`   ${err}: ${errorMessages.isRetryableError(err)}`);
});

console.log('\nНельзя повторить:');
nonRetryableErrors.forEach(err => {
  console.log(`   ${err}: ${errorMessages.isRetryableError(err)}`);
});