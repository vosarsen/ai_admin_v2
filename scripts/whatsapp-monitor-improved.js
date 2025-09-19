#!/usr/bin/env node

/**
 * Improved WhatsApp Monitor
 * Based on Baileys best practices to avoid "linking devices" block
 */

const axios = require('axios');
const logger = require('../src/utils/logger');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const CHECK_INTERVAL = 60000; // Check every 60 seconds (not 30!)
const MAX_RECONNECT_ATTEMPTS = 3; // Limit reconnection attempts
const RECONNECT_COOLDOWN = 900000; // 15 minutes cooldown after max attempts
const USE_PAIRING_CODE = process.env.USE_PAIRING_CODE === 'true';

// Track reconnection attempts per company
const reconnectAttempts = new Map();
const lastReconnectTime = new Map();
const qrGenerationCount = new Map();

/**
 * Check if we should attempt reconnection
 */
function shouldAttemptReconnect(companyId) {
    const attempts = reconnectAttempts.get(companyId) || 0;
    const lastTime = lastReconnectTime.get(companyId) || 0;
    const timeSinceLastAttempt = Date.now() - lastTime;

    // If max attempts reached, check cooldown
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
        if (timeSinceLastAttempt < RECONNECT_COOLDOWN) {
            logger.warn(`⏳ Company ${companyId} in cooldown (${Math.round((RECONNECT_COOLDOWN - timeSinceLastAttempt) / 60000)} min remaining)`);
            return false;
        } else {
            // Reset attempts after cooldown
            reconnectAttempts.set(companyId, 0);
            qrGenerationCount.set(companyId, 0);
        }
    }

    return true;
}

/**
 * Initialize WhatsApp session with smart reconnection
 */
async function initializeSession(companyId) {
    try {
        // Check if we should reconnect
        if (!shouldAttemptReconnect(companyId)) {
            return { skipped: true, reason: 'cooldown' };
        }

        // Track reconnection attempt
        const attempts = (reconnectAttempts.get(companyId) || 0) + 1;
        reconnectAttempts.set(companyId, attempts);
        lastReconnectTime.set(companyId, Date.now());

        logger.info(`🔄 Initializing session for company ${companyId} (attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS})`);

        // Check QR generation count
        const qrCount = qrGenerationCount.get(companyId) || 0;

        // If too many QR attempts, switch to pairing code
        if (qrCount >= 3 || USE_PAIRING_CODE) {
            logger.info(`📱 Using pairing code method for company ${companyId}`);

            // Get company phone number (you'll need to implement this)
            const phoneNumber = process.env.COMPANY_PHONE || '79686484488';

            const response = await axios.post(
                `${API_URL}/api/whatsapp/sessions/${companyId}/pairing-code`,
                { phoneNumber },
                { timeout: 30000 }
            );

            if (response.data.success && response.data.pairingCode) {
                logger.info(`✅ Pairing code generated: ${response.data.pairingCode}`);
                logger.info(`📱 Enter this code in WhatsApp on phone +${phoneNumber}`);

                // Reset counters on success
                reconnectAttempts.set(companyId, 0);
                qrGenerationCount.set(companyId, 0);

                return response.data;
            }
        } else {
            // Traditional QR code method
            const response = await axios.post(
                `${API_URL}/webhook/whatsapp/baileys/init/${companyId}`,
                {},
                { timeout: 30000 }
            );

            // Track QR generation
            qrGenerationCount.set(companyId, qrCount + 1);

            logger.info(`📱 QR code requested for company ${companyId} (${qrCount + 1} QR generated)`);

            return response.data;
        }

    } catch (error) {
        logger.error(`Failed to initialize session for ${companyId}:`, error.message);

        // If rate limited, set max attempts to trigger cooldown
        if (error.message.includes('rate') || error.message.includes('linking')) {
            reconnectAttempts.set(companyId, MAX_RECONNECT_ATTEMPTS);
            logger.warn(`⚠️ Rate limited for company ${companyId}, entering cooldown`);
        }

        return { error: error.message };
    }
}

/**
 * Check session health
 */
async function checkSessionHealth(companyId) {
    try {
        const response = await axios.get(
            `${API_URL}/webhook/whatsapp/baileys/status/${companyId}`,
            { timeout: 10000 }
        );

        const status = response.data;

        // Log health status
        if (status.connected) {
            // Reset counters when connected
            reconnectAttempts.set(companyId, 0);
            qrGenerationCount.set(companyId, 0);
            logger.debug(`✅ Company ${companyId} connected`);
        } else {
            logger.warn(`⚠️ Company ${companyId} disconnected (status: ${status.status})`);
        }

        return status;

    } catch (error) {
        logger.error(`Health check failed for ${companyId}:`, error.message);
        return { connected: false, error: error.message };
    }
}

/**
 * Monitor single company
 */
async function monitorCompany(companyId) {
    const status = await checkSessionHealth(companyId);

    if (!status.connected && status.status !== 'connecting') {
        // Only try to reconnect if not already connecting
        const result = await initializeSession(companyId);

        if (result.skipped) {
            logger.info(`⏸️ Skipped reconnection for ${companyId}: ${result.reason}`);
        } else if (result.error) {
            logger.error(`❌ Failed to reconnect ${companyId}: ${result.error}`);
        } else {
            logger.info(`🔄 Reconnection initiated for ${companyId}`);
        }
    }
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
    logger.info('🚀 Improved WhatsApp Monitor started');
    logger.info(`Configuration:`);
    logger.info(`- Check interval: ${CHECK_INTERVAL / 1000}s`);
    logger.info(`- Max reconnect attempts: ${MAX_RECONNECT_ATTEMPTS}`);
    logger.info(`- Cooldown period: ${RECONNECT_COOLDOWN / 60000} minutes`);
    logger.info(`- Use pairing code: ${USE_PAIRING_CODE}`);

    // Get list of companies to monitor
    const companies = process.env.MONITOR_COMPANIES
        ? process.env.MONITOR_COMPANIES.split(',')
        : ['962302']; // Default company

    logger.info(`Monitoring companies: ${companies.join(', ')}`);

    // Initial check
    for (const companyId of companies) {
        await monitorCompany(companyId);
    }

    // Set up monitoring interval
    setInterval(async () => {
        for (const companyId of companies) {
            await monitorCompany(companyId);
        }
    }, CHECK_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.info('📛 Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('📛 Received SIGINT, shutting down gracefully');
    process.exit(0);
});

// Error handling
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection:', error);
});

// Start monitoring
startMonitoring().catch(error => {
    logger.error('Failed to start monitoring:', error);
    process.exit(1);
});