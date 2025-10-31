/**
 * WhatsApp Sessions API Routes
 * Управление WhatsApp сессиями через REST API
 */

const express = require('express');
const router = express.Router();
const { getSessionPool } = require('../../integrations/whatsapp/session-pool');
const logger = require('../../utils/logger');
const QRCode = require('qrcode');

// Получаем единственный экземпляр session pool
const sessionPool = getSessionPool();

/**
 * GET /api/whatsapp/sessions
 * Получить список всех активных сессий
 */
router.get('/sessions', async (req, res) => {
    try {
        const sessions = sessionPool.getActiveSessions();
        res.json({
            success: true,
            count: sessions.length,
            sessions
        });
    } catch (error) {
        logger.error('Failed to get sessions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/whatsapp/sessions/:companyId/status
 * Получить статус сессии компании
 */
router.get('/sessions/:companyId/status', async (req, res) => {
    try {
        const { companyId } = req.params;
        const status = sessionPool.getSessionStatus(companyId);
        
        res.json({
            success: true,
            companyId,
            ...status
        });
    } catch (error) {
        logger.error(`Failed to get session status for ${req.params.companyId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/whatsapp/sessions/:companyId/initialize
 * Инициализировать новую сессию (получить QR код)
 */
router.post('/sessions/:companyId/initialize', async (req, res) => {
    try {
        const { companyId } = req.params;
        
        logger.info(`Initializing WhatsApp session for company ${companyId}`);
        
        // Инициализируем сессию и ждем QR код
        const result = await sessionPool.initializeSession(companyId);
        
        if (result.qr) {
            // Генерируем QR код в формате Data URL для отображения в браузере
            const qrDataUrl = await QRCode.toDataURL(result.qr);
            
            res.json({
                success: true,
                companyId,
                qr: result.qr,
                qrDataUrl,
                message: 'Please scan the QR code with WhatsApp'
            });
        } else if (result.connected) {
            res.json({
                success: true,
                companyId,
                connected: true,
                message: 'Session already connected'
            });
        }
    } catch (error) {
        logger.error(`Failed to initialize session for ${req.params.companyId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/whatsapp/sessions/:companyId/send
 * Отправить сообщение через сессию компании
 */
router.post('/sessions/:companyId/send', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { phone, message } = req.body;
        
        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone and message are required'
            });
        }
        
        const result = await sessionPool.sendMessage(companyId, phone, message);
        
        res.json({
            success: true,
            companyId,
            phone,
            messageId: result.key.id
        });
    } catch (error) {
        logger.error(`Failed to send message for ${req.params.companyId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/whatsapp/sessions/:companyId
 * Закрыть сессию компании
 */
router.delete('/sessions/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        
        await sessionPool.removeSession(companyId);
        
        res.json({
            success: true,
            companyId,
            message: 'Session removed successfully'
        });
    } catch (error) {
        logger.error(`Failed to remove session for ${req.params.companyId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/whatsapp/sessions/:companyId/reconnect
 * Переподключить сессию
 */
router.post('/sessions/:companyId/reconnect', async (req, res) => {
    try {
        const { companyId } = req.params;
        
        // Удаляем старую сессию
        await sessionPool.removeSession(companyId);
        
        // Создаем новую
        await sessionPool.getOrCreateSession(companyId);
        
        res.json({
            success: true,
            companyId,
            message: 'Reconnection initiated'
        });
    } catch (error) {
        logger.error(`Failed to reconnect session for ${req.params.companyId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Обработка входящих сообщений от WhatsApp
sessionPool.on('message', async ({ companyId, message }) => {
    try {
        logger.info(`📱 New message for company ${companyId} from ${message.key.remoteJid}`);
        
        // Здесь должна быть логика обработки входящих сообщений
        // Например, добавление в очередь для обработки AI
        
        // TODO: Интегрировать с message queue
        // await messageQueue.add({
        //     companyId,
        //     from: message.key.remoteJid,
        //     message: message.message.conversation || message.message.extendedTextMessage?.text,
        //     timestamp: message.messageTimestamp
        // });
        
    } catch (error) {
        logger.error('Failed to process incoming message:', error);
    }
});

// Обработка QR кодов
sessionPool.on('qr', ({ companyId, qr }) => {
    logger.info(`📱 QR Code available for company ${companyId}`);
    // QR коды обрабатываются через API endpoint /initialize
});

// Обработка подключений
sessionPool.on('connected', ({ companyId }) => {
    logger.info(`✅ WhatsApp connected for company ${companyId}`);
    // Можно отправить webhook или уведомление
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down WhatsApp sessions...');
    await sessionPool.shutdown();
    process.exit(0);
});

module.exports = router;