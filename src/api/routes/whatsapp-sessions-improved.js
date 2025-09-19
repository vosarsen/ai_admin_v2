/**
 * WhatsApp Sessions API Routes - Improved Version
 * Управление WhatsApp сессиями через REST API с метриками и мониторингом
 */

const express = require('express');
const router = express.Router();
const { getSessionPool } = require('../../integrations/whatsapp/session-pool');
const logger = require('../../utils/logger');
const QRCode = require('qrcode');
const { body, param, validationResult } = require('express-validator');
const messageQueue = require('../../queue/message-queue');

// Get singleton session pool instance
let sessionPool = null;

// Initialize session pool lazily
function ensureSessionPool() {
    if (!sessionPool) {
        sessionPool = getSessionPool();
        if (!sessionPool) {
            throw new Error('Failed to initialize session pool');
        }
    }
    return sessionPool;
}

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

/**
 * GET /api/whatsapp/sessions
 * Get list of all active sessions
 */
router.get('/sessions', async (req, res) => {
    try {
        const sessions = ensureSessionPool().getActiveSessions();
        const metrics = ensureSessionPool().getMetrics();
        
        res.json({
            success: true,
            count: sessions.length,
            sessions,
            metrics
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
 * Get session status for company
 */
router.get('/sessions/:companyId/status',
    param('companyId').notEmpty().isAlphanumeric(),
    validate,
    async (req, res) => {
        try {
            const { companyId } = req.params;
            const status = ensureSessionPool().getSessionStatus(companyId);
            const health = await ensureSessionPool().healthCheck(companyId);
            
            res.json({
                success: true,
                companyId,
                ...status,
                health
            });
        } catch (error) {
            logger.error(`Failed to get session status for ${req.params.companyId}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * POST /api/whatsapp/sessions/:companyId/initialize
 * Initialize new session (get QR code)
 */
router.post('/sessions/:companyId/initialize',
    param('companyId').notEmpty().isAlphanumeric(),
    validate,
    async (req, res) => {
        try {
            const { companyId } = req.params;
            
            logger.info(`Initializing WhatsApp session for company ${companyId}`);
            
            // Initialize session and wait for QR code
            const result = await ensureSessionPool().initializeSession(companyId);
            
            if (result.qr) {
                // Generate QR code in Data URL format for browser display
                const qrDataUrl = await QRCode.toDataURL(result.qr);
                
                // Also generate terminal-friendly version
                const qrTerminal = await QRCode.toString(result.qr, { type: 'terminal' });
                
                res.json({
                    success: true,
                    companyId,
                    qr: result.qr,
                    qrDataUrl,
                    qrTerminal,
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
    }
);

/**
 * POST /api/whatsapp/sessions/:companyId/send
 * Send message through company session
 */
router.post('/sessions/:companyId/send',
    param('companyId').notEmpty().isAlphanumeric(),
    body('phone').notEmpty().isMobilePhone(),
    body('message').notEmpty().isLength({ min: 1, max: 4096 }),
    validate,
    async (req, res) => {
        try {
            const { companyId } = req.params;
            const { phone, message, options } = req.body;
            
            const result = await ensureSessionPool().sendMessage(companyId, phone, message, options);
            
            res.json({
                success: true,
                companyId,
                phone,
                messageId: result.key.id,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error(`Failed to send message for ${req.params.companyId}:`, error);
            
            // Determine appropriate status code
            let statusCode = 500;
            if (error.message.includes('Rate limit')) {
                statusCode = 429;
            } else if (error.message.includes('No active session')) {
                statusCode = 503;
            } else if (error.message.includes('Invalid')) {
                statusCode = 400;
            }
            
            res.status(statusCode).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * DELETE /api/whatsapp/sessions/:companyId
 * Close company session
 */
router.delete('/sessions/:companyId',
    param('companyId').notEmpty().isAlphanumeric(),
    validate,
    async (req, res) => {
        try {
            const { companyId } = req.params;
            
            await ensureSessionPool().removeSession(companyId);
            
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
    }
);

/**
 * POST /api/whatsapp/sessions/:companyId/reconnect
 * Reconnect session
 */
router.post('/sessions/:companyId/reconnect',
    param('companyId').notEmpty().isAlphanumeric(),
    validate,
    async (req, res) => {
        try {
            const { companyId } = req.params;
            
            // Remove old session
            await ensureSessionPool().removeSession(companyId);
            
            // Create new one
            await ensureSessionPool().getOrCreateSession(companyId);
            
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
    }
);

/**
 * POST /api/whatsapp/sessions/:companyId/pairing-code
 * Get pairing code for WhatsApp connection
 */
router.post('/sessions/:companyId/pairing-code',
    param('companyId').notEmpty().isAlphanumeric(),
    validate,
    async (req, res) => {
        try {
            const { companyId } = req.params;

            // Get or create session
            const pool = ensureSessionPool();
            const session = await pool.getOrCreateSession(companyId);

            if (!session) {
                return res.status(503).json({
                    success: false,
                    error: 'Failed to create session'
                });
            }

            // Request pairing code using the script that works
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            try {
                // Get phone number from request body or use default
                const { phoneNumber: requestPhone } = req.body || {};
                const phoneNumber = requestPhone ?
                    String(requestPhone).replace(/[^0-9]/g, '') :
                    (process.env.WHATSAPP_PHONE_NUMBER?.replace(/[^0-9]/g, '') || '79686484488');

                logger.info(`Requesting pairing code for company ${companyId} with phone ${phoneNumber}`);

                // Run the working pairing script with auto-input for phone number
                const { stdout } = await execAsync(
                    `echo "${phoneNumber}" | USE_PAIRING_CODE=true COMPANY_ID=${companyId} node scripts/whatsapp-pairing-auth.js`,
                    {
                        timeout: 30000,
                        cwd: process.cwd()
                    }
                );

                // Extract pairing code from output (looking for "ВАШ КОД:" or similar patterns)
                const codeMatch = stdout.match(/(?:PAIRING CODE|ВАШ КОД|CODE):\s*([A-Z0-9-]+)/i);
                const code = codeMatch ? codeMatch[1] : null;

                if (!code) {
                    throw new Error('Failed to extract pairing code from script output');
                }

                logger.info(`Pairing code generated for company ${companyId}`);

                res.json({
                    success: true,
                    code,
                    companyId,
                    expiresIn: 60, // seconds
                    instructions: [
                        'Open WhatsApp on your phone',
                        'Go to Settings → Linked Devices',
                        'Tap "Link a Device"',
                        'Choose "Link with phone number instead"',
                        `Enter the code: ${code}`
                    ]
                });
            } catch (error) {
                logger.error(`Failed to get pairing code for ${companyId}:`, error);

                // If pairing code fails, suggest QR code
                res.status(400).json({
                    success: false,
                    error: 'Failed to generate pairing code. Please use QR code method.',
                    alternativeUrl: `/whatsapp-qr.html?company=${companyId}`
                });
            }
        } catch (error) {
            logger.error(`Error in pairing code endpoint for ${req.params.companyId}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /api/whatsapp/sessions/:companyId/health
 * Get session health status
 */
router.get('/sessions/:companyId/health',
    param('companyId').notEmpty().isAlphanumeric(),
    validate,
    async (req, res) => {
        try {
            const { companyId } = req.params;
            const health = await ensureSessionPool().healthCheck(companyId);
            
            const statusCode = health.healthy ? 200 : 503;
            
            res.status(statusCode).json({
                success: health.healthy,
                companyId,
                ...health
            });
        } catch (error) {
            logger.error(`Failed to check health for ${req.params.companyId}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /api/whatsapp/metrics
 * Get system-wide metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = ensureSessionPool().getMetrics();
        const sessions = ensureSessionPool().getActiveSessions();
        
        res.json({
            success: true,
            metrics,
            sessions: {
                total: sessions.length,
                connected: sessions.filter(s => s.connected).length,
                disconnected: sessions.filter(s => !s.connected).length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get metrics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * WebSocket support for real-time events
 * NOTE: Temporarily disabled - requires express-ws middleware
 */
/*
router.ws('/events', (ws, req) => {
    logger.info('WebSocket connection established for WhatsApp events');
    
    // Event handlers
    const handlers = {
        qr: (data) => {
            ws.send(JSON.stringify({ type: 'qr', ...data }));
        },
        connected: (data) => {
            ws.send(JSON.stringify({ type: 'connected', ...data }));
        },
        message: (data) => {
            ws.send(JSON.stringify({ type: 'message', ...data }));
        },
        error: (data) => {
            ws.send(JSON.stringify({ type: 'error', ...data }));
        },
        logout: (data) => {
            ws.send(JSON.stringify({ type: 'logout', ...data }));
        },
        reconnect_failed: (data) => {
            ws.send(JSON.stringify({ type: 'reconnect_failed', ...data }));
        },
        health_check_failed: (data) => {
            ws.send(JSON.stringify({ type: 'health_check_failed', ...data }));
        }
    };
    
    // Subscribe to events
    for (const [event, handler] of Object.entries(handlers)) {
        ensureSessionPool().on(event, handler);
    }
    
    // Handle WebSocket disconnect
    ws.on('close', () => {
        logger.info('WebSocket connection closed');
        // Unsubscribe from events
        for (const [event, handler] of Object.entries(handlers)) {
            ensureSessionPool().off(event, handler);
        }
    });
    
    // Send initial status
    ws.send(JSON.stringify({
        type: 'status',
        sessions: ensureSessionPool().getActiveSessions(),
        metrics: ensureSessionPool().getMetrics()
    }));
});
*/

// Message handling moved to whatsapp-baileys.js webhook to avoid duplication
// The webhook provides better message processing with client name extraction and validation
/*
ensureSessionPool().on('message', async ({ companyId, message }) => {
    // Disabled - handled in whatsapp-baileys.js
});
*/

// Handle QR codes
ensureSessionPool().on('qr', ({ companyId, qr }) => {
    logger.info(`📱 QR Code available for company ${companyId}`);
    // QR codes are handled through API endpoints
});

// Handle connections
ensureSessionPool().on('connected', ({ companyId }) => {
    // Connection already logged in session-pool.js
    // Could send webhook or notification here
});

// Handle errors
ensureSessionPool().on('error', ({ companyId, error }) => {
    logger.error(`WhatsApp error for company ${companyId}:`, error);
    // Could send alert here
});

// Handle logouts
ensureSessionPool().on('logout', ({ companyId }) => {
    logger.warn(`WhatsApp logged out for company ${companyId}`);
    // Could send notification to admin
});

// Handle reconnection failures
ensureSessionPool().on('reconnect_failed', ({ companyId }) => {
    logger.error(`Reconnection failed for company ${companyId}`);
    // Could trigger alert or alternative action
});

// Handle health check failures
ensureSessionPool().on('health_check_failed', (health) => {
    logger.warn(`Health check failed:`, health);
    // Could trigger auto-recovery or alert
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down WhatsApp sessions API...');
    await ensureSessionPool().shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Shutting down WhatsApp sessions API...');
    await ensureSessionPool().shutdown();
    process.exit(0);
});

module.exports = router;