// src/api/webhooks/whatsapp-reaction.js
const express = require('express');
const router = express.Router();
const config = require('../../config');
const logger = require('../../utils/logger');
const { validateWebhookSignature } = require('../../middlewares/webhook-auth');
const rateLimiter = require('../../middlewares/rate-limiter');
const reminderContextTracker = require('../../services/reminder/reminder-context-tracker');
const { YclientsClient } = require('../../integrations/yclients/client');
const whatsappClient = require('../../integrations/whatsapp/client');

/**
 * Классификация реакций
 */
const REACTION_TYPES = {
  POSITIVE: [
    '👍', '👍🏻', '👍🏼', '👍🏽', '👍🏾', '👍🏿', // thumbs up (all skin tones)
    '❤️', '❤', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', // hearts
    '😊', '😃', '😄', '😁', '🙂', '😀', '😍', '🥰', '😘', // happy faces
    '🎉', '🎊', '✨', '⭐', '🌟', '💯', '🔥', // celebration
    '✅', '☑️', '✔️', // check marks
    '👌', '👌🏻', '👌🏼', '👌🏽', '👌🏾', '👌🏿', // OK hand
    '🤝', '🙏', '🙏🏻', '🙏🏼', '🙏🏽', '🙏🏾', '🙏🏿' // handshake, pray
  ],
  NEGATIVE: [
    '👎', '👎🏻', '👎🏼', '👎🏽', '👎🏾', '👎🏿', // thumbs down
    '😞', '😔', '😢', '😭', '😤', '😠', '😡', // sad/angry faces
    '❌', '✖️', '🚫', '⛔', // crosses/blocks
    '💔', // broken heart
    '😕', '🙁', '☹️', // confused/disappointed
  ],
  NEUTRAL: [
    '🤔', // thinking
    '😐', '😑', // neutral faces
    '🤷', '🤷‍♂️', '🤷‍♀️', // shrug
  ]
};

/**
 * Определяет тип реакции (позитивная/негативная/нейтральная)
 */
function classifyReaction(emoji) {
  if (!emoji) return 'NEUTRAL';

  if (REACTION_TYPES.POSITIVE.includes(emoji)) {
    return 'POSITIVE';
  }

  if (REACTION_TYPES.NEGATIVE.includes(emoji)) {
    return 'NEGATIVE';
  }

  return 'NEUTRAL';
}

/**
 * WhatsApp webhook для обработки реакций клиентов
 */
router.post('/webhook/whatsapp/reaction', rateLimiter, validateWebhookSignature, async (req, res) => {
  const startTime = Date.now();

  try {
    const { from, emoji, messageId, timestamp } = req.body;

    logger.info('👍 Reaction webhook received:', {
      from,
      emoji,
      messageId,
      timestamp
    });

    // Валидация
    if (!from || !emoji) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from, emoji'
      });
    }

    // Классифицируем реакцию
    const reactionType = classifyReaction(emoji);
    logger.info(`📊 Reaction classified as: ${reactionType}`, { emoji });

    // Проверяем, является ли это ответом на напоминание
    const isReminderResponse = await reminderContextTracker.hasActiveReminder(from);

    if (isReminderResponse) {
      logger.info(`✅ Reaction is response to reminder from ${from}`);

      // Получаем контекст напоминания
      const reminderContext = await reminderContextTracker.getReminderContext(from);

      if (reminderContext && reminderContext.booking) {
        // Обрабатываем в зависимости от типа реакции
        if (reactionType === 'POSITIVE') {
          logger.info(`❤️ Positive reaction - confirming booking ${reminderContext.booking.recordId}`);

          try {
            // Отправляем реакцию сердечком в ответ
            await whatsappClient.sendReaction(from, '❤️');
            logger.info(`❤️ Sent heart reaction to ${from}`);

            // Обновляем статус записи в YClients на "подтвержден" (attendance = 2)
            const yclientsClient = new YclientsClient();
            const updateResult = await yclientsClient.updateBookingStatus(
              reminderContext.booking.recordId,
              2 // attendance = 2 (подтвержден)
            );

            if (updateResult.success) {
              logger.info(`✅ Booking ${reminderContext.booking.recordId} confirmed via reaction`);
            } else {
              logger.warn(`Failed to update booking status: ${updateResult.error}`);
            }

            // Помечаем напоминание как подтвержденное
            await reminderContextTracker.markAsConfirmed(from);

            return res.json({
              success: true,
              action: 'booking_confirmed',
              reactionType,
              processingTime: Date.now() - startTime
            });

          } catch (error) {
            logger.error('Error confirming booking via reaction:', error);
            // Продолжаем, но возвращаем ошибку
          }

        } else if (reactionType === 'NEGATIVE') {
          logger.info(`👎 Negative reaction - client may want to cancel/reschedule`);

          // Для негативных реакций можно добавить логику:
          // - отправить сообщение с предложением перенести запись
          // - или просто зафиксировать негативную реакцию

          // Пока просто логируем и очищаем контекст
          await reminderContextTracker.clearContext(from);

          return res.json({
            success: true,
            action: 'negative_reaction_noted',
            reactionType,
            processingTime: Date.now() - startTime
          });

        } else {
          // Нейтральная реакция - просто фиксируем
          logger.info(`😐 Neutral reaction - just noting it`);

          return res.json({
            success: true,
            action: 'neutral_reaction_noted',
            reactionType,
            processingTime: Date.now() - startTime
          });
        }
      }
    }

    // Если это не ответ на напоминание, просто фиксируем реакцию
    logger.info(`📝 Reaction not related to reminder - just logging`, {
      from,
      emoji,
      reactionType
    });

    // Быстрый ответ webhook'у
    res.json({
      success: true,
      action: 'reaction_logged',
      reactionType,
      processingTime: Date.now() - startTime
    });

    logger.info(`👍 Reaction processed in ${Date.now() - startTime}ms`);

  } catch (error) {
    logger.error('Reaction webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
