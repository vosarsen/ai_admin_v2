#!/usr/bin/env node

/**
 * Baileys WhatsApp Service for AI Admin
 * Runs as a PM2 service on the server
 */

const { getSessionPool } = require('../src/integrations/whatsapp/session-pool');
const logger = require('../src/utils/logger');
const supabase = require('../src/database/supabase');

const companyId = process.env.COMPANY_ID || '962302';

logger.info('🚀 Starting Baileys WhatsApp Service');
logger.info(`Company ID: ${companyId}`);

async function startBaileysService() {
    try {
        // Get session pool instance
        const pool = getSessionPool();

        // Set up event listeners
        pool.on('qr', async ({ companyId: cId, qr }) => {
            if (cId !== companyId) return;
            logger.info('📱 QR Code generated for scanning');
            // Save QR to database or send notification
            console.log('\n==============================================');
            console.log('QR CODE GENERATED - SCAN WITH WHATSAPP');
            console.log('==============================================');
            console.log('QR String (use QR generator to scan):');
            console.log(qr.substring(0, 100) + '...');
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

        pool.on('connected', ({ companyId: cId, user, phoneNumber }) => {
            if (cId !== companyId) return;
            logger.info(`✅ WhatsApp connected for company ${cId}`, { user, phoneNumber });
            console.log('\n✅ WHATSAPP CONNECTED SUCCESSFULLY!');
            console.log(`Phone: ${phoneNumber}`);
            console.log('Ready to send and receive messages\n');
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

        pool.on('logout', ({ companyId: cId }) => {
            if (cId !== companyId) return;
            logger.warn('❌ Session logged out, will need to re-authenticate');
        });

        pool.on('error', ({ companyId: cId, error }) => {
            if (cId !== companyId) return;
            logger.error('Session error:', error);
        });

        // Create session
        logger.info('🔄 Creating WhatsApp session...');
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

        app.get('/health', (req, res) => {
            const status = pool.getSessionStatus(companyId);
            res.json({
                service: 'baileys-whatsapp',
                companyId,
                ...status,
                metrics: pool.getMetrics()
            });
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