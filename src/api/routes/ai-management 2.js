const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger').child({ module: 'ai-management-api' });
const providerFactory = require('../../services/ai/provider-factory');
const promptManager = require('../../services/ai-admin-v2/prompt-manager');

/**
 * API для управления AI провайдерами и промптами
 */

// Получить список доступных провайдеров
router.get('/providers', async (req, res) => {
  try {
    const providers = providerFactory.getAvailableProviders();
    const current = process.env.AI_PROVIDER || 'deepseek';
    
    res.json({
      success: true,
      providers,
      current
    });
  } catch (error) {
    logger.error('Failed to get providers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Переключить провайдера
router.post('/providers/switch', async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider name is required'
      });
    }
    
    const available = providerFactory.getAvailableProviders();
    if (!available.includes(provider)) {
      return res.status(400).json({
        success: false,
        error: `Provider ${provider} is not available. Available: ${available.join(', ')}`
      });
    }
    
    // Устанавливаем нового провайдера
    providerFactory.setDefaultProvider(provider);
    process.env.AI_PROVIDER = provider;
    
    logger.info(`AI provider switched to: ${provider}`);
    
    res.json({
      success: true,
      provider
    });
  } catch (error) {
    logger.error('Failed to switch provider:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получить список промптов
router.get('/prompts', async (req, res) => {
  try {
    const prompts = promptManager.getAvailablePrompts();
    const stats = promptManager.getStats();
    
    res.json({
      success: true,
      prompts,
      stats,
      current: process.env.AI_PROMPT_VERSION || 'enhanced-prompt',
      abTestEnabled: process.env.AI_PROMPT_AB_TEST === 'true'
    });
  } catch (error) {
    logger.error('Failed to get prompts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Переключить промпт
router.post('/prompts/switch', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt name is required'
      });
    }
    
    const success = promptManager.setActivePrompt(prompt);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: `Prompt ${prompt} not found`
      });
    }
    
    process.env.AI_PROMPT_VERSION = prompt;
    
    res.json({
      success: true,
      prompt
    });
  } catch (error) {
    logger.error('Failed to switch prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Включить/выключить A/B тестирование
router.post('/prompts/ab-test', async (req, res) => {
  try {
    const { enabled } = req.body;
    
    process.env.AI_PROMPT_AB_TEST = enabled ? 'true' : 'false';
    
    logger.info(`A/B testing ${enabled ? 'enabled' : 'disabled'}`);
    
    res.json({
      success: true,
      abTestEnabled: enabled
    });
  } catch (error) {
    logger.error('Failed to toggle A/B test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получить статистику промптов
router.get('/prompts/stats', async (req, res) => {
  try {
    const stats = promptManager.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get prompt stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Тестировать промпт
router.post('/prompts/test', async (req, res) => {
  try {
    const { message, promptName } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    // Подготавливаем тестовый контекст
    const testContext = {
      businessInfo: {
        title: 'Test Salon',
        type: 'beauty',
        workHours: '9:00-21:00',
        address: 'Test Address',
        phone: '+7 999 123-45-67'
      },
      services: [
        { title: 'Стрижка', price_min: 1500, duration: 60 },
        { title: 'Маникюр', price_min: 2000, duration: 90 }
      ],
      staff: [
        { name: 'Мария', specialization: 'Парикмахер' },
        { name: 'Анна', specialization: 'Мастер маникюра' }
      ],
      recentBookings: [],
      userInfo: {
        name: 'Тест',
        phone: '+79991234567',
        isReturning: false
      }
    };
    
    // Получаем промпт
    let promptResult;
    if (promptName) {
      promptResult = promptManager.getPromptForABTest(testContext, promptName);
    } else {
      promptResult = {
        name: process.env.AI_PROMPT_VERSION || 'enhanced-prompt',
        text: promptManager.getActivePrompt(testContext)
      };
    }
    
    // Заменяем плейсхолдер
    const prompt = promptResult.text.replace('{message}', message);
    
    res.json({
      success: true,
      promptName: promptResult.name,
      prompt
    });
  } catch (error) {
    logger.error('Failed to test prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;