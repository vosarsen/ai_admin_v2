// Quick test for entity extractor improvements
const EntityExtractor = require('./src/services/nlu/entity-extractor');
const logger = require('./src/utils/logger');

const extractor = new EntityExtractor();

// Test cases for info intent
const testCases = [
  { message: 'Какие цены на стрижку?', expectedIntent: 'info' },
  { message: 'Сколько стоит борода?', expectedIntent: 'info' },
  { message: 'Какие услуги есть?', expectedIntent: 'info' },
  { message: 'Что делаете в салоне?', expectedIntent: 'info' },
  { message: 'Хочу записаться', expectedIntent: 'booking' },
  { message: 'Записать меня завтра', expectedIntent: 'booking' },
];

logger.info('🧪 Testing Entity Extractor...\n');

testCases.forEach(({ message, expectedIntent }) => {
  const result = extractor.extract(message);
  const passed = result.intent.name === expectedIntent;
  
  logger.info(`Message: "${message}"`);
  logger.info(`Expected: ${expectedIntent}, Got: ${result.intent.name} (confidence: ${result.intent.confidence.toFixed(2)})`);
  logger.info(passed ? '✅ PASSED' : '❌ FAILED');
  logger.info('---');
});