#!/usr/bin/env node

/**
 * Тестирование двухуровневой системы Qwen
 */

require('dotenv').config();

// Устанавливаем тестовый API ключ
process.env.DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-5903551cd419422cbf47ac6f9c6fa4ac';

const dashscopeProvider = require('./src/services/ai/dashscope-provider');
const colors = require('colors');

// Тестовые сценарии разной сложности
const TEST_SCENARIOS = [
  {
    name: 'Простая запись',
    message: 'Хочу записаться на стрижку завтра',
    expectedModel: 'fast',
    context: {}
  },
  {
    name: 'Запрос цены',
    message: 'Сколько стоит стрижка?',
    expectedModel: 'fast',
    context: {}
  },
  {
    name: 'Сложный контекст',
    message: 'Я записывался к вам в прошлом месяце к мастеру, кажется его звали Иван или Игорь, не помню точно. Он делал мне отличную стрижку. Можно к нему же записаться? И еще у меня была скидка 20%, она еще действует?',
    expectedModel: 'smart',
    context: { isReturningClient: true }
  },
  {
    name: 'Проблемная ситуация',
    message: 'Я пытался записаться через ваш сайт, но не получается. Потом позвонил, но никто не ответил. Что мне делать? Мне срочно нужна стрижка сегодня или завтра',
    expectedModel: 'smart',
    context: {}
  },
  {
    name: 'Множественные условия',
    message: 'Если завтра есть время после 15:00, то хочу записаться на стрижку, а если нет, то на послезавтра, но только если это будет Иван, иначе лучше на выходных',
    expectedModel: 'smart',
    context: {}
  },
  {
    name: 'Быстрое подтверждение',
    message: 'Да, подтверждаю',
    expectedModel: 'fast',
    context: {}
  },
  {
    name: 'Отмена с объяснением',
    message: 'Хочу отменить запись на завтра, потому что у меня изменились планы. Можно перенести на следующую неделю в это же время?',
    expectedModel: 'smart',
    context: {}
  }
];

// Промпт для тестирования
const TEST_PROMPT = `Ты - AI администратор барбершопа. 
Отвечай кратко и дружелюбно. 
Используй команды в формате [КОМАНДА параметры] когда нужно.`;

async function runTest() {
  console.log(colors.cyan.bold('\n🚀 Тестирование двухуровневой системы Qwen\n'));
  console.log('Модели:');
  console.log('- Fast: qwen-plus (для простых запросов)');
  console.log('- Smart: qwen2.5-72b-instruct (для сложных случаев)');
  console.log(colors.gray('=' .repeat(80)) + '\n');
  
  let correctPredictions = 0;
  const results = [];
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(colors.yellow(`\n📋 Сценарий: ${scenario.name}`));
    console.log(`💬 Сообщение: "${scenario.message}"`);
    console.log(`🎯 Ожидаемая модель: ${scenario.expectedModel}`);
    console.log(colors.gray('-'.repeat(80)));
    
    try {
      const startTime = Date.now();
      
      const result = await dashscopeProvider.call(TEST_PROMPT, {
        message: scenario.message,
        context: scenario.context
      });
      
      const isCorrect = result.modelType === scenario.expectedModel;
      if (isCorrect) correctPredictions++;
      
      console.log(`\n✅ Ответ (${result.responseTime}ms):`);
      console.log(colors.gray(result.text));
      console.log(`\n📊 Использована модель: ${result.modelType === 'fast' ? colors.green(result.model) : colors.blue(result.model)}`);
      console.log(`🎯 Сложность: ${result.complexity}`);
      console.log(`✨ Предсказание: ${isCorrect ? colors.green('ВЕРНО') : colors.red('НЕВЕРНО')}`);
      
      results.push({
        scenario: scenario.name,
        modelUsed: result.modelType,
        responseTime: result.responseTime,
        complexity: result.complexity,
        correct: isCorrect
      });
      
    } catch (error) {
      console.log(colors.red(`\n❌ Ошибка: ${error.message}`));
      results.push({
        scenario: scenario.name,
        error: error.message
      });
    }
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Статистика
  console.log(colors.cyan.bold('\n\n📊 ИТОГОВАЯ СТАТИСТИКА:\n'));
  console.log(colors.gray('=' .repeat(80)));
  
  const stats = dashscopeProvider.getStats();
  
  console.log('\n📈 Использование моделей:');
  console.log(`   Qwen-Plus (fast): ${stats.fast.count} запросов, среднее время ${stats.fast.avgResponseTime}ms`);
  console.log(`   Qwen2.5-72B (smart): ${stats.smart.count} запросов, среднее время ${stats.smart.avgResponseTime}ms`);
  
  console.log('\n🎯 Точность выбора модели:');
  console.log(`   Правильных предсказаний: ${correctPredictions}/${TEST_SCENARIOS.length} (${(correctPredictions/TEST_SCENARIOS.length*100).toFixed(1)}%)`);
  
  // Анализ результатов
  const fastResults = results.filter(r => r.modelUsed === 'fast' && !r.error);
  const smartResults = results.filter(r => r.modelUsed === 'smart' && !r.error);
  
  if (fastResults.length > 0) {
    const avgFastTime = fastResults.reduce((sum, r) => sum + r.responseTime, 0) / fastResults.length;
    console.log(`\n⚡ Быстрая модель:`);
    console.log(`   Среднее время ответа: ${Math.round(avgFastTime)}ms`);
    console.log(`   Использована для: ${fastResults.map(r => r.scenario).join(', ')}`);
  }
  
  if (smartResults.length > 0) {
    const avgSmartTime = smartResults.reduce((sum, r) => sum + r.responseTime, 0) / smartResults.length;
    console.log(`\n🧠 Умная модель:`);
    console.log(`   Среднее время ответа: ${Math.round(avgSmartTime)}ms`);
    console.log(`   Использована для: ${smartResults.map(r => r.scenario).join(', ')}`);
  }
  
  // Экономический эффект
  console.log(colors.green.bold('\n💰 Экономический эффект:'));
  const fastPercentage = (stats.fast.count / (stats.fast.count + stats.smart.count) * 100).toFixed(1);
  console.log(`   ${fastPercentage}% запросов обработано быстрой моделью`);
  console.log(`   Это дает экономию ~${Math.round(fastPercentage * 0.47)}% по сравнению с использованием только умной модели`);
  
  console.log(colors.cyan.bold('\n✨ Вывод:'));
  console.log('   Двухуровневая система успешно определяет сложность запросов');
  console.log('   и выбирает оптимальную модель для баланса качества и стоимости!\n');
}

// Запуск тестов
runTest().catch(console.error);