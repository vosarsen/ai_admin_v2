/**
 * WhatsApp Session Pool Manager - Improved Version
 * Централизованное управление всеми WhatsApp сессиями
 * Гарантирует что для каждой компании существует только одна сессия
 */

const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs-extra');
const EventEmitter = require('events');
const logger = require('../../utils/logger');
const validator = require('validator');
const RateLimiter = require('../../utils/rate-limiter');

class WhatsAppSessionPool extends EventEmitter {
    constructor() {
        super();
        
        // Core data structures
        this.sessions = new Map(); // companyId -> session
        this.authPaths = new Map(); // companyId -> authPath
        this.reconnectAttempts = new Map(); // companyId -> attempts
        this.reconnectTimers = new Map(); // companyId -> timer
        this.qrCodes = new Map(); // companyId -> qrCode
        
        // Configuration
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.healthCheckInterval = 30000; // 30 seconds
        
        // Metrics
        this.metrics = {
            totalSessions: 0,
            activeConnections: 0,
            failedReconnects: 0,
            messagesSent: 0,
            messagesReceived: 0,
            qrCodesGenerated: 0,
            errors: 0,
            lastError: null
        };
        
        // Rate limiting
        this.rateLimiter = new RateLimiter({
            windowMs: 60000, // 1 minute
            maxRequests: 30, // 30 messages per minute per company
            keyPrefix: 'whatsapp:ratelimit:'
        });
        
        // Directory for storing sessions
        this.baseAuthPath = path.join(process.cwd(), 'baileys_sessions');
        
        // Initialize async
        this.initialize();
    }

    /**
     * Async initialization
     */
    async initialize() {
        try {
            await this.ensureBaseDirectory();
            this.startHealthChecks();
            logger.info('✅ WhatsApp Session Pool initialized');
        } catch (error) {
            logger.error('Failed to initialize WhatsApp Session Pool:', error);
            this.metrics.errors++;
            this.metrics.lastError = error.message;
        }
    }

    /**
     * Creates base directory for sessions
     */
    async ensureBaseDirectory() {
        await fs.ensureDir(this.baseAuthPath);
        
        // Ensure proper permissions
        await fs.chmod(this.baseAuthPath, 0o700);
    }

    /**
     * Validates company ID
     */
    validateCompanyId(companyId) {
        if (!companyId) {
            throw new Error('Company ID is required');
        }
        
        if (typeof companyId !== 'string' && typeof companyId !== 'number') {
            throw new Error('Invalid company ID type');
        }
        
        // Convert to string and sanitize
        const sanitized = String(companyId).replace(/[^a-zA-Z0-9_-]/g, '');
        
        if (sanitized.length === 0 || sanitized.length > 50) {
            throw new Error('Invalid company ID format');
        }
        
        return sanitized;
    }

    /**
     * Gets or creates session for company
     */
    async getOrCreateSession(companyId) {
        const validatedId = this.validateCompanyId(companyId);
        
        // Check existing session
        if (this.sessions.has(validatedId)) {
            const session = this.sessions.get(validatedId);
            // For Baileys, check if user is authenticated instead of ws.readyState
            if (session && session.user) {
                logger.debug(`✅ Using existing session for company ${validatedId}`);
                return session;
            }
        }

        // Create new session
        logger.info(`🔄 Creating new session for company ${validatedId}`);
        return await this.createSession(validatedId);
    }

    /**
     * Creates new session for company
     */
    async createSession(companyId) {
        const validatedId = this.validateCompanyId(companyId);
        
        try {
            // Check if session already exists and close it
            const existingSession = this.sessions.get(validatedId);
            if (existingSession) {
                logger.info(`🔄 Closing existing session for company ${validatedId} before creating new one`);
                try {
                    await existingSession.logout();
                } catch (err) {
                    // Ignore logout errors - session might be already closed
                    logger.debug(`Logout error for ${validatedId}:`, err.message);
                }
                this.sessions.delete(validatedId);

                // Force cleanup auth directory to prevent stale sessions
                const authPath = this.authPaths.get(validatedId);
                if (authPath) {
                    try {
                        await fs.remove(authPath);
                        logger.info(`🧹 Cleaned up auth directory for ${validatedId}`);
                    } catch (cleanupErr) {
                        logger.warn(`Failed to cleanup auth directory: ${cleanupErr.message}`);
                    }
                }
            }
            
            // Auth data path for company
            const authPath = path.join(this.baseAuthPath, `company_${validatedId}`);
            await fs.ensureDir(authPath);
            this.authPaths.set(validatedId, authPath);

            // Load or create auth state
            const { state, saveCreds } = await useMultiFileAuthState(authPath);

            // Create socket with optimized config
            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'error' }),
                browser: ['AI Admin', 'Chrome', '1.0.0'],
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                retryRequestDelayMs: 250,
                maxRetries: 3,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
                qrTimeout: 60000
            });

            // Save in pool
            this.sessions.set(validatedId, sock);
            this.metrics.totalSessions++;

            // Setup event handlers
            this.setupEventHandlers(validatedId, sock, saveCreds);

            return sock;
        } catch (error) {
            logger.error(`Failed to create session for company ${validatedId}:`, error);
            this.metrics.errors++;
            this.metrics.lastError = error.message;
            throw error;
        }
    }

    /**
     * Sets up event handlers for session
     */
    setupEventHandlers(companyId, sock, saveCreds) {
        // Connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                logger.info(`📱 QR Code generated for company ${companyId}`);
                this.metrics.qrCodesGenerated++;
                this.qrCodes.set(companyId, qr); // Store QR code
                this.emit('qr', { companyId, qr });
            }

            if (connection === 'close') {
                this.metrics.activeConnections--;
                
                const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                    : true;

                if (shouldReconnect) {
                    await this.handleReconnect(companyId);
                } else {
                    logger.warn(`Session logged out for company ${companyId}`);
                    await this.removeSession(companyId);
                    this.emit('logout', { companyId });
                }
            }

            if (connection === 'open') {
                logger.info(`✅ WhatsApp connected for company ${companyId}`);
                this.metrics.activeConnections++;
                this.reconnectAttempts.set(companyId, 0);
                this.qrCodes.delete(companyId); // Clear QR code on successful connection
                this.emit('connected', { companyId });
            }
        });

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const msg of messages) {
                if (!msg.key.fromMe && msg.message) {
                    this.metrics.messagesReceived++;
                    this.emit('message', { companyId, message: msg });
                }
            }
        });

        // Handle errors
        sock.ev.on('error', (error) => {
            logger.error(`Session error for company ${companyId}:`, error);
            this.metrics.errors++;
            this.metrics.lastError = error.message;
            this.emit('error', { companyId, error });
        });
    }

    /**
     * Monitors session health and cleans up if needed
     */
    async monitorSessionHealth(companyId) {
        const authPath = this.authPaths.get(companyId);
        if (!authPath) return;

        try {
            // Check auth directory size
            const files = await fs.readdir(authPath);
            const totalSize = files.length;

            // If too many files (indicating key accumulation), force cleanup
            if (totalSize > 100) {
                logger.warn(`⚠️ Session for ${companyId} has ${totalSize} files - forcing cleanup`);
                await this.removeSession(companyId);
                await this.createSession(companyId);
            }
        } catch (err) {
            logger.debug(`Health check failed for ${companyId}: ${err.message}`);
        }
    }

    /**
     * Handles reconnection with exponential backoff
     */
    async handleReconnect(companyId) {
        const attempts = this.reconnectAttempts.get(companyId) || 0;
        
        if (attempts >= this.maxReconnectAttempts) {
            logger.error(`Max reconnection attempts reached for company ${companyId}`);
            this.metrics.failedReconnects++;
            await this.removeSession(companyId);
            this.emit('reconnect_failed', { companyId });
            return;
        }

        const delay = Math.min(this.reconnectDelay * Math.pow(2, attempts), 60000); // Max 1 minute
        logger.info(`🔄 Reconnecting company ${companyId} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
        
        this.reconnectAttempts.set(companyId, attempts + 1);
        
        // Clear existing timer if any
        const existingTimer = this.reconnectTimers.get(companyId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        
        // Set new timer
        const timer = setTimeout(async () => {
            this.reconnectTimers.delete(companyId);
            try {
                await this.createSession(companyId);
            } catch (error) {
                logger.error(`Reconnection failed for company ${companyId}:`, error);
                await this.handleReconnect(companyId); // Retry
            }
        }, delay);
        
        this.reconnectTimers.set(companyId, timer);
    }

    /**
     * Removes session for company
     */
    async removeSession(companyId) {
        const validatedId = this.validateCompanyId(companyId);
        
        // Clear reconnect timer
        const timer = this.reconnectTimers.get(validatedId);
        if (timer) {
            clearTimeout(timer);
            this.reconnectTimers.delete(validatedId);
        }
        
        // Close socket
        const sock = this.sessions.get(validatedId);
        if (sock) {
            sock.ev.removeAllListeners();
            sock.ws?.close();
            this.metrics.activeConnections--;
        }
        
        // Clean up maps
        this.sessions.delete(validatedId);
        this.reconnectAttempts.delete(validatedId);
        this.metrics.totalSessions = Math.max(0, this.metrics.totalSessions - 1);
        
        logger.info(`🗑️ Session removed for company ${validatedId}`);
    }

    /**
     * Sends message through company session with rate limiting
     */
    async sendMessage(companyId, phone, message, options = {}) {
        const validatedId = this.validateCompanyId(companyId);
        
        // Validate phone number
        if (!phone || !validator.isMobilePhone(String(phone))) {
            throw new Error('Invalid phone number');
        }
        
        // Check rate limit
        const rateLimitKey = `${validatedId}:${phone}`;
        if (!await this.rateLimiter.checkLimit(rateLimitKey)) {
            throw new Error('Rate limit exceeded');
        }
        
        // Get or create session
        const sock = await this.getOrCreateSession(validatedId);
        
        if (!sock || !sock.user) {
            throw new Error(`No active session for company ${validatedId}`);
        }

        const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
        
        try {
            const messageOptions = { text: message, ...options };
            const result = await sock.sendMessage(jid, messageOptions);
            
            this.metrics.messagesSent++;
            logger.info(`✅ Message sent for company ${validatedId} to ${phone}`);
            
            return result;
        } catch (error) {
            logger.error(`Failed to send message for company ${validatedId}:`, error);
            this.metrics.errors++;
            this.metrics.lastError = error.message;
            throw error;
        }
    }

    /**
     * Send reaction to a message
     */
    async sendReaction(companyId, phone, emoji, messageId) {
        const validatedId = this.validateCompanyId(companyId);
        
        // Get or create session (same as sendMessage)
        const sock = await this.getOrCreateSession(validatedId);
        
        if (!sock || !sock.user) {
            throw new Error(`No active session for company ${validatedId}`);
        }

        const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
        
        try {
            const reactionMessage = {
                react: {
                    text: emoji,
                    key: {
                        remoteJid: jid,
                        fromMe: false,
                        id: messageId
                    }
                }
            };
            
            const result = await sock.sendMessage(jid, reactionMessage);
            
            logger.info(`✅ Reaction ${emoji} sent for company ${validatedId} to ${phone}`);
            
            return result;
        } catch (error) {
            logger.error(`Failed to send reaction for company ${validatedId}:`, error);
            throw error;
        }
    }

    /**
     * Gets session status with health info
     */
    getSessionStatus(companyId) {
        try {
            const validatedId = this.validateCompanyId(companyId);
            const sock = this.sessions.get(validatedId);
            
            if (!sock) {
                return { 
                    connected: false, 
                    status: 'not_initialized',
                    health: 'unknown'
                };
            }

            // In Baileys, check if user exists to determine connection status
            const connected = sock.user ? true : false;
            const status = connected ? 'connected' : 'disconnected';
            
            return { 
                connected, 
                status,
                reconnectAttempts: this.reconnectAttempts.get(validatedId) || 0,
                health: connected ? 'healthy' : 'unhealthy',
                uptime: sock.uptime || 0
            };
        } catch (error) {
            return { 
                connected: false, 
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Initializes session and waits for QR code
     */
    async initializeSession(companyId) {
        const validatedId = this.validateCompanyId(companyId);
        
        // Remove old session if exists
        await this.removeSession(validatedId);
        
        // Clear auth data for new session
        const authPath = path.join(this.baseAuthPath, `company_${validatedId}`);
        await fs.remove(authPath);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.off('qr', qrHandler);
                this.off('connected', connectedHandler);
                reject(new Error('QR code generation timeout'));
            }, 60000);

            const qrHandler = (data) => {
                if (data.companyId === validatedId) {
                    clearTimeout(timeout);
                    this.off('connected', connectedHandler);
                    resolve({ qr: data.qr });
                }
            };

            const connectedHandler = (data) => {
                if (data.companyId === validatedId) {
                    clearTimeout(timeout);
                    this.off('qr', qrHandler);
                    resolve({ connected: true });
                }
            };

            // Set up handlers BEFORE creating session
            this.on('qr', qrHandler);
            this.on('connected', connectedHandler);
            
            // Now create session
            this.createSession(validatedId).catch(error => {
                clearTimeout(timeout);
                this.off('qr', qrHandler);
                this.off('connected', connectedHandler);
                reject(error);
            });
        });
    }

    /**
     * Performs health check on session
     */
    async healthCheck(companyId) {
        try {
            const validatedId = this.validateCompanyId(companyId);
            const sock = this.sessions.get(validatedId);
            
            if (!sock || !sock.user) {
                return { 
                    healthy: false, 
                    reason: 'Session not connected',
                    companyId: validatedId
                };
            }
            
            // Try to get user info as health check
            const user = sock.user;
            if (user) {
                return { 
                    healthy: true,
                    companyId: validatedId,
                    phoneNumber: user.id
                };
            }
            
            return { 
                healthy: false, 
                reason: 'User info not available',
                companyId: validatedId
            };
        } catch (error) {
            return { 
                healthy: false, 
                reason: error.message,
                companyId
            };
        }
    }

    /**
     * Starts periodic health checks
     */
    startHealthChecks() {
        setInterval(async () => {
            for (const [companyId] of this.sessions) {
                const health = await this.healthCheck(companyId);
                if (!health.healthy) {
                    logger.warn(`Health check failed for company ${companyId}:`, health.reason);
                    this.emit('health_check_failed', health);
                }

                // Also monitor for key accumulation
                await this.monitorSessionHealth(companyId);
            }
        }, this.healthCheckInterval);
    }

    /**
     * Gets list of all active sessions with details
     */
    getActiveSessions() {
        const sessions = [];
        
        for (const [companyId] of this.sessions) {
            sessions.push({
                companyId,
                ...this.getSessionStatus(companyId)
            });
        }
        
        return sessions;
    }

    /**
     * Gets QR code for a company
     */
    getQRCode(companyId) {
        const validatedId = this.validateCompanyId(companyId);
        return this.qrCodes.get(validatedId) || null;
    }

    /**
     * Gets current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger.info('Shutting down WhatsApp Session Pool...');
        
        // Clear all timers
        for (const timer of this.reconnectTimers.values()) {
            clearTimeout(timer);
        }
        this.reconnectTimers.clear();
        
        // Close all sessions
        for (const [companyId] of this.sessions) {
            await this.removeSession(companyId);
        }
        
        logger.info('WhatsApp Session Pool shutdown complete');
    }
}

// Singleton instance
let sessionPool = null;

function getSessionPool() {
    if (!sessionPool) {
        sessionPool = new WhatsAppSessionPool();
    }
    return sessionPool;
}

module.exports = {
    WhatsAppSessionPool,
    getSessionPool
};