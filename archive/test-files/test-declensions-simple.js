#!/usr/bin/env node

/**
 * Простой тест генерации склонений без зависимостей от Redis
 */

require('dotenv').config();
const axios = require('axios');

async function testDeclensionGeneration() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY not configured');
    return;
  }

  const serviceName = 'Мужская стрижка';
  
  const prompt = `
Сгенерируй склонения для названия услуги "${serviceName}" в русском языке.
Верни ТОЛЬКО JSON объект без дополнительного текста в формате:
{
  "nominative": "${serviceName}",
  "genitive": "родительный падеж (кого? чего?)",
  "dative": "дательный падеж (кому? чему?)",
  "accusative": "винительный падеж (кого? что?)",
  "instrumental": "творительный падеж (кем? чем?)",
  "prepositional": "предложный падеж (о ком? о чём?)",
  "prepositional_na": "предложный падеж с предлогом НА (на ком? на чём?)"
}

Примеры:
- "Мужская стрижка" -> accusative: "мужскую стрижку", prepositional_na: "мужской стрижке"
- "Маникюр с покрытием" -> accusative: "маникюр с покрытием", prepositional_na: "маникюре с покрытием"

Важно: prepositional_na используется после предлога "на" (записаться НА что?)
`;

  try {
    console.log('📡 Calling DeepSeek API...');
    
    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const aiResponse = response.data.choices[0].message.content;
    console.log('\n📝 AI Response:');
    console.log(aiResponse);
    
    // Пытаемся извлечь JSON
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const declensions = JSON.parse(jsonMatch[0]);
      
      console.log('\n✅ Parsed declensions:');
      console.log(JSON.stringify(declensions, null, 2));
      
      console.log('\n📋 Examples of usage:');
      console.log(`  "Завтра ждём вас на ${declensions.prepositional_na}"`);
      console.log(`  "Ваша запись на ${declensions.accusative} подтверждена"`);
      console.log(`  "Напоминаем о ${declensions.prepositional}"`);
    } else {
      console.error('❌ Could not find JSON in response');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testDeclensionGeneration();