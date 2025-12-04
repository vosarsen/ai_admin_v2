#!/usr/bin/env node

/**
 * Baileys WhatsApp Service for AI Admin
 * Runs as a PM2 service on the server
 */

const { getSessionPool } = require('../src/integrations/whatsapp/session-pool');
const logger = require('../src/utils/logger');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs').promises;
const path = require('path');
const Redis = require('ioredis');

// Redis publisher for cross-process communication with ai-admin-api
const redisPublisher = new Redis(process.env.REDIS_URL);
redisPublisher.on('error', (err) => logger.error('Redis publisher error:', err));
redisPublisher.on('connect', () => logger.info('✅ Redis publisher connected'));

// CRITICAL: Use prefixed format to match marketplace onboarding
// Format: "company_{salon_id}" - consistent with yclients-marketplace.js and marketplace-socket.js
const salonId = process.env.YCLIENTS_COMPANY_ID || process.env.COMPANY_ID || '962302';
const companyId = salonId.startsWith('company_') ? salonId : `company_${salonId}`;

logger.info('🚀 Starting Baileys WhatsApp Service');
logger.info(`Company ID: ${companyId} (salon_id: ${salonId})`);

// Global variable to track if we're already connected
let isConnected = false;
let connectionAttempt = 0;

async function startBaileysService() {
    try {
        // Get session pool instance
        const pool = getSessionPool();

        // Set up event listeners
        pool.on('qr', async ({ companyId: cId, qr }) => {
            if (cId !== companyId) return;
            logger.info('📱 QR Code generated for scanning');

            // Save full QR to file
            const qrPath = path.join(process.cwd(), `qr_${companyId}.txt`);
            await fs.writeFile(qrPath, qr, 'utf8');

            console.log('\n==============================================');
            console.log('QR CODE GENERATED - SCAN WITH WHATSAPP');
            console.log('==============================================');

            // Display QR code in terminal
            qrcodeTerminal.generate(qr, { small: true });

            console.log('\n==============================================');
            console.log(`Full QR saved to: ${qrPath}`);
            console.log('Use cat command to view full QR string');
            console.log('==============================================\n');
        });

        pool.on('pairing-code', ({ companyId: cId, code, phoneNumber }) => {
            if (cId !== companyId) return;
            logger.info(`🔑 Pairing code generated: ${code}`);
            console.log('\n==============================================');
            console.log(`PAIRING CODE: ${code}`);
            console.log(`Phone: ${phoneNumber}`);
            console.log('==============================================\n');
        });

        pool.on('connected', async ({ companyId: cId, user, phoneNumber }) => {
            if (cId !== companyId) return;
            isConnected = true;
            connectionAttempt = 0;
            logger.info(`✅ WhatsApp connected for company ${cId}`, { user, phoneNumber });
            console.log('\n✅ WHATSAPP CONNECTED SUCCESSFULLY!');
            console.log(`Phone: ${phoneNumber}`);
            console.log('Ready to send and receive messages\n');

            // Publish to Redis for cross-process communication (Phase 3 WebSocket fix)
            try {
                await redisPublisher.publish('whatsapp:events', JSON.stringify({
                    type: 'connected',
                    companyId: cId,
                    phoneNumber,
                    timestamp: Date.now()
                }));
                logger.info('📤 Published connected event to Redis', { companyId: cId });
            } catch (redisError) {
                logger.error('Failed to publish connected event to Redis:', redisError);
            }
        });

        pool.on('message', async ({ companyId: cId, message }) => {
            if (cId !== companyId) return;

            const from = message.key.remoteJid;
            const text = message.message?.conversation ||
                        message.message?.extendedTextMessage?.text ||
                        '[Non-text message]';

            logger.info(`📨 New message from ${from}: ${text}`);

            // Forward to webhook for processing
            try {
                const axios = require('axios');
                const phone = from.replace('@s.whatsapp.net', '');

                await axios.post('http://localhost:3000/webhook/whatsapp/batched', {
                    from: phone,
                    message: text,
                    messageId: message.key.id,
                    timestamp: Date.now()
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Source': 'baileys-service'
                    }
                });

                logger.info(`✅ Message forwarded to webhook for processing`);
            } catch (error) {
                logger.error('Failed to forward message to webhook:', error.message);
            }
        });

        pool.on('reaction', async ({ companyId: cId, reaction }) => {
            if (cId !== companyId) return;

            const from = reaction.from;
            const emoji = reaction.emoji;
            const messageId = reaction.messageId;

            logger.info(`👍 Reaction received from ${from}: ${emoji}`);

            // Forward to webhook for processing
            try {
                const axios = require('axios');
                const phone = from.replace('@s.whatsapp.net', '');

                await axios.post('http://localhost:3000/webhook/whatsapp/reaction', {
                    from: phone,
                    emoji: emoji,
                    messageId: messageId,
                    timestamp: reaction.timestamp || Date.now()
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Source': 'baileys-service'
                    }
                });

                logger.info(`✅ Reaction forwarded to webhook for processing`);
            } catch (error) {
                logger.error('Failed to forward reaction to webhook:', error.message);
            }
        });

        pool.on('logout', ({ companyId: cId }) => {
            if (cId !== companyId) return;
            isConnected = false;
            logger.warn('❌ Session logged out, will need to re-authenticate');
        });

        pool.on('disconnected', ({ companyId: cId }) => {
            if (cId !== companyId) return;
            isConnected = false;
            logger.warn('⚠️ WhatsApp disconnected');
        });

        pool.on('error', ({ companyId: cId, error }) => {
            if (cId !== companyId) return;
            logger.error('Session error:', error);
        });

        // Create session with protection against multiple connections
        logger.info('🔄 Creating WhatsApp session...');

        // Check if already connected
        if (isConnected) {
            logger.info('✅ Already connected, skipping session creation');
            return;
        }

        // Prevent multiple rapid connection attempts
        if (connectionAttempt > 0 && Date.now() - connectionAttempt < 10000) {
            logger.info('⏳ Connection attempt in progress, waiting...');
            return;
        }

        connectionAttempt = Date.now();

        const session = await pool.createSession(companyId, {
            usePairingCode: process.env.USE_PAIRING_CODE === 'true',
            phoneNumber: process.env.WHATSAPP_PHONE_NUMBER
        });

        logger.info('✅ Baileys service started successfully');

        // Keep the service running
        process.on('SIGINT', async () => {
            logger.info('Shutting down Baileys service...');
            await pool.disconnectSession(companyId);
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Shutting down Baileys service...');
            await pool.disconnectSession(companyId);
            process.exit(0);
        });

        // Health check endpoint for monitoring
        const express = require('express');
        const app = express();
        app.use(express.json());

        // Simple in-memory rate limiter
        const reactionRateLimiter = new Map(); // phone -> { count, resetTime }
        const RATE_LIMIT_WINDOW = 60000; // 1 minute
        const MAX_REACTIONS_PER_MINUTE = 10;

        function checkRateLimit(phone) {
            const now = Date.now();
            const record = reactionRateLimiter.get(phone);

            if (!record || now > record.resetTime) {
                reactionRateLimiter.set(phone, {
                    count: 1,
                    resetTime: now + RATE_LIMIT_WINDOW
                });
                return true;
            }

            if (record.count >= MAX_REACTIONS_PER_MINUTE) {
                return false;
            }

            record.count++;
            return true;
        }

        app.get('/health', (req, res) => {
            const status = pool.getSessionStatus(companyId);
            res.json({
                service: 'baileys-whatsapp',
                companyId,
                ...status,
                metrics: pool.getMetrics()
            });
        });

        // Endpoint to send messages
        app.post('/send', async (req, res) => {
            try {
                const { phone, message } = req.body;

                if (!phone || !message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Phone and message are required'
                    });
                }

                logger.info(`📤 Sending message to ${phone} via baileys-service`);

                const result = await pool.sendMessage(companyId, phone, message);

                res.json({
                    success: true,
                    messageId: result?.key?.id,
                    phone,
                    companyId
                });
            } catch (error) {
                logger.error('Failed to send message:', error.message);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Endpoint to send reactions
        app.post('/reaction', async (req, res) => {
            try {
                const { phone, emoji, messageId, companyId: requestCompanyId } = req.body;

                if (!phone || !emoji || !messageId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Phone, emoji, and messageId are required'
                    });
                }

                // Check rate limit
                if (!checkRateLimit(phone)) {
                    logger.warn(`⚠️ Rate limit exceeded for reactions to ${phone}`);
                    return res.status(429).json({
                        success: false,
                        error: 'Too many reactions. Please try again later.'
                    });
                }

                // Use provided companyId or fallback to default
                const targetCompanyId = requestCompanyId || companyId;

                logger.info(`❤️ Sending reaction ${emoji} to ${phone} via baileys-service (company: ${targetCompanyId})`);

                const result = await pool.sendReaction(targetCompanyId, phone, emoji, messageId);

                res.json({
                    success: true,
                    phone,
                    emoji,
                    messageId,
                    companyId: targetCompanyId
                });
            } catch (error) {
                logger.error('Failed to send reaction:', error.message);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        const PORT = process.env.BAILEYS_PORT || 3003;
        app.listen(PORT, () => {
            logger.info(`Health check endpoint running on port ${PORT}`);
        });

    } catch (error) {
        logger.error('Failed to start Baileys service:', error);
        process.exit(1);
    }
}

// Start the service
startBaileysService();