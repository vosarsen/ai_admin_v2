// src/api/routes/demo-chat.js
const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger').child({ module: 'demo-chat' });
const { body, validationResult } = require('express-validator');
const aiAdminV2 = require('../../services/ai-admin-v2');
const smartCache = require('../../services/cache/smart-cache');

// Demo configuration
const DEMO_COMPANY_ID = 999999; // Special company ID for demo mode
const DEMO_COMPANY_DATA = {
  name: "Demo Beauty Salon",
  services: [
    { id: 1, title: "Стрижка", price: 1500 },
    { id: 2, title: "Окрашивание", price: 3000 },
    { id: 3, title: "Маникюр", price: 1200 },
    { id: 4, title: "Педикюр", price: 1500 }
  ],
  staff: [
    { id: 1, name: "Анна Мастер" },
    { id: 2, name: "Ольга Стилист" }
  ]
};

// Rate limiter: 10 messages per session
const sessionLimiter = async (req, res, next) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return next();
  }

  try {
    // Wait for Redis initialization
    await smartCache.initPromise;
    const redis = smartCache.redis;

    if (!redis) {
      logger.warn('Redis not available, skipping session limit');
      return next();
    }

    const key = `demo:session:${sessionId}:count`;

    // Get current count
    const count = await redis.get(key) || 0;
    const messageCount = parseInt(count);

    // Check limit
    if (messageCount >= 10) {
      return res.status(429).json({
        success: false,
        error: 'demo_limit_reached',
        message: 'Вы достигли лимита демо-версии (10 сообщений). Пожалуйста, свяжитесь с нами для полного доступа.',
        contactUrl: '#contact-section'
      });
    }

    // Increment counter
    await redis.setex(key, 3600, messageCount + 1); // 1 hour TTL

    next();
  } catch (error) {
    logger.error('Session limiter error:', error);
    next(); // Continue on error
  }
};

// Simple IP-based rate limiter using our existing Redis
const ipLimiter = async (req, res, next) => {
  try {
    await smartCache.initPromise;
    const redis = smartCache.redis;

    if (!redis) {
      return next();
    }

    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `demo:ip:${ip}:daily`;

    const count = await redis.get(key) || 0;
    const dailyCount = parseInt(count);

    if (dailyCount >= 100) {
      return res.status(429).json({
        success: false,
        error: 'ip_limit_reached',
        message: 'Слишком много запросов с вашего IP. Попробуйте завтра или свяжитесь с нами напрямую.',
        contactUrl: '#contact-section'
      });
    }

    // Increment with 24h expiry
    if (dailyCount === 0) {
      await redis.setex(key, 86400, 1); // 24 hours
    } else {
      await redis.incr(key);
    }

    next();
  } catch (error) {
    logger.error('IP limiter error:', error);
    next();
  }
};

// Generate contextual suggestions based on conversation
function generateSuggestions(userMessage, botResponse) {
  const lowerMessage = userMessage.toLowerCase();
  const lowerResponse = botResponse.toLowerCase();

  // Default suggestions
  const defaultSuggestions = [
    "Записаться на стрижку",
    "Узнать цены",
    "Свободное время на завтра",
    "Перенести запись"
  ];

  // If user asked about booking/appointment
  if (lowerMessage.includes('запис') || lowerMessage.includes('хочу')) {
    return [
      "Стрижка",
      "Окрашивание",
      "Маникюр",
      "Узнать цены на все услуги"
    ];
  }

  // If user asked about prices
  if (lowerMessage.includes('цен') || lowerMessage.includes('стоимость') || lowerMessage.includes('сколько')) {
    return [
      "Записаться на стрижку",
      "Записаться на окрашивание",
      "Записаться на маникюр",
      "Свободное время на завтра"
    ];
  }

  // If bot is asking about time/date
  if (lowerResponse.includes('какое время') || lowerResponse.includes('когда') || lowerResponse.includes('на какое число')) {
    return [
      "Завтра утром",
      "Завтра вечером",
      "Послезавтра",
      "Свободное время на неделю"
    ];
  }

  // If bot mentioned available time slots
  if (lowerResponse.includes('14:00') || lowerResponse.includes('16:30') || lowerResponse.includes('свободн')) {
    return [
      "14:00 подходит",
      "16:30 подходит",
      "18:00 подходит",
      "Показать другие варианты"
    ];
  }

  // If user asked about rescheduling
  if (lowerMessage.includes('перенес') || lowerMessage.includes('изменить')) {
    return [
      "Перенести на завтра",
      "Перенести на следующую неделю",
      "Отменить запись",
      "Узнать свободное время"
    ];
  }

  // If user selected a service
  if (lowerMessage.includes('стрижк') || lowerMessage.includes('окрашив') || lowerMessage.includes('маникюр')) {
    return [
      "Завтра",
      "Послезавтра",
      "На следующей неделе",
      "Узнать цену"
    ];
  }

  // If conversation seems complete (booking confirmed)
  if (lowerResponse.includes('записал') || lowerResponse.includes('подтверждаю') || lowerResponse.includes('напомню')) {
    return [
      "Узнать цены на другие услуги",
      "Записаться еще на одну услугу",
      "Перенести эту запись",
      "Начать новый диалог"
    ];
  }

  return defaultSuggestions;
}

/**
 * @swagger
 * /api/demo-chat:
 *   post:
 *     summary: Demo chat with AI bot
 *     description: Send message to AI bot in demo mode (limited to 10 messages per session)
 *     tags:
 *       - Demo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - message
 *             properties:
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID v4 session identifier
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               message:
 *                 type: string
 *                 description: User message to send to bot
 *                 example: "Записаться на стрижку"
 *     responses:
 *       200:
 *         description: Bot response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 response:
 *                   type: string
 *                   example: "Конечно! На какую услугу вы хотите записаться?"
 *                 sessionId:
 *                   type: string
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 isDemoMode:
 *                   type: boolean
 *                   example: true
 *                 messagesRemaining:
 *                   type: number
 *                   example: 9
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post('/demo-chat',
  ipLimiter,
  sessionLimiter,
  [
    // Validation
    body('sessionId')
      .trim()
      .notEmpty().withMessage('SessionId обязателен')
      .isUUID(4).withMessage('SessionId должен быть UUID v4'),
    body('message')
      .trim()
      .notEmpty().withMessage('Сообщение обязательно')
      .isLength({ max: 500 }).withMessage('Сообщение слишком длинное (максимум 500 символов)')
  ],
  async (req, res) => {
    const startTime = Date.now();

    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array().map(e => e.msg)
        });
      }

      const { sessionId, message } = req.body;

      logger.info('Demo chat request', {
        sessionId,
        message: message.substring(0, 50) + '...',
        ip: req.ip
      });

      // Use sessionId as phone number to maintain conversation context
      // Format: demo_{sessionId} to make it distinguishable
      const demoPhone = `demo_${sessionId}`;

      // Process message with AI
      // We pass demo company ID and special phone format
      // Use Gemini for demo (2.6x faster than DeepSeek: 9s vs 24s, 3.6x cheaper: $29 vs $106/mo)
      const result = await aiAdminV2.processMessage(
        message,
        demoPhone,
        DEMO_COMPANY_ID,
        {
          isDemoMode: true, // Add demo mode flag
          demoCompanyData: DEMO_COMPANY_DATA,
          aiProvider: 'gemini-flash' // Use Gemini for demo chat (via Xray VPN)
        }
      );

      // Get messages remaining
      await smartCache.initPromise;
      const redis = smartCache.redis;
      const count = redis ? await redis.get(`demo:session:${sessionId}:count`) || 0 : 0;
      const messagesRemaining = Math.max(0, 10 - parseInt(count));

      const duration = Date.now() - startTime;

      logger.info('Demo chat response sent', {
        sessionId,
        duration,
        messagesRemaining
      });

      // Generate contextual suggestions based on the conversation
      const suggestions = generateSuggestions(message, result.message || result.response || result);

      res.json({
        success: true,
        response: result.message || result.response || result,
        sessionId,
        isDemoMode: true,
        messagesRemaining,
        processingTime: duration,
        suggestions // Add contextual suggestions
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Demo chat error:', {
        error: error.message,
        stack: error.stack,
        duration
      });

      // Handle different error types
      let statusCode = 500;
      let errorMessage = 'Произошла ошибка. Попробуйте еще раз или свяжитесь с нами.';

      if (error.name === 'ValidationError') {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error.message?.includes('timeout')) {
        statusCode = 504;
        errorMessage = 'Превышено время ожидания ответа. Попробуйте еще раз.';
      }

      res.status(statusCode).json({
        success: false,
        error: 'processing_error',
        message: errorMessage,
        isDemoMode: true
      });
    }
  }
);

/**
 * @swagger
 * /api/demo-chat/status:
 *   get:
 *     summary: Get demo chat session status
 *     description: Check how many messages remaining for a session
 *     tags:
 *       - Demo
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID to check
 *     responses:
 *       200:
 *         description: Session status
 */
router.get('/demo-chat/status', async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'SessionId required'
      });
    }

    await smartCache.initPromise;
    const redis = smartCache.redis;
    const count = redis ? await redis.get(`demo:session:${sessionId}:count`) || 0 : 0;
    const messagesUsed = parseInt(count);
    const messagesRemaining = Math.max(0, 10 - messagesUsed);

    res.json({
      success: true,
      sessionId,
      messagesUsed,
      messagesRemaining,
      limitReached: messagesRemaining === 0
    });

  } catch (error) {
    logger.error('Demo status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session status'
    });
  }
});

module.exports = router;
