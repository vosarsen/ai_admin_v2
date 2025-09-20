/**
 * WhatsApp Session Pool Manager - Improved Version with Pairing Code Support
 * Централизованное управление всеми WhatsApp сессиями
 * Гарантирует что для каждой компании существует только одна сессия
 * Поддерживает подключение через QR код и Pairing Code
 */

const { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
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

        // Mutex for preventing race conditions
        this.creatingSession = new Set(); // companyIds currently being created
        this.sessionCreationPromises = new Map(); // companyId -> Promise

        // Circuit breaker pattern
        this.failureCount = new Map(); // companyId -> failure count
        this.lastFailureTime = new Map(); // companyId -> timestamp
        this.circuitBreakerThreshold = 5; // failures before opening circuit
        this.circuitBreakerCooldown = 300000; // 5 minutes cooldown

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
     * Gets or creates session for company with mutex protection
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

        // Check if already creating this session (mutex)
        if (this.creatingSession.has(validatedId)) {
            logger.debug(`⏳ Waiting for session creation for company ${validatedId}`);
            // Wait for the existing creation promise
            const promise = this.sessionCreationPromises.get(validatedId);
            if (promise) {
                return await promise;
            }
        }

        // Create new session with mutex protection
        logger.info(`🔄 Creating new session for company ${validatedId}`);
        return await this.createSession(validatedId);
    }

    /**
     * Creates new session for company
     * @param {string} companyId - Company ID
     * @param {Object} options - Creation options
     * @param {boolean} options.usePairingCode - Use pairing code instead of QR
     * @param {string} options.phoneNumber - Phone number for pairing code
     */
    async createSession(companyId, options = {}) {
        const validatedId = this.validateCompanyId(companyId);

        // Check circuit breaker
        if (this.isCircuitOpen(validatedId)) {
            const lastFailure = this.lastFailureTime.get(validatedId);
            const timeSinceFailure = Date.now() - lastFailure;
            const remainingCooldown = Math.ceil((this.circuitBreakerCooldown - timeSinceFailure) / 1000);
            throw new Error(`Circuit breaker open for company ${validatedId}. Too many failures. Retry in ${remainingCooldown} seconds.`);
        }

        // Mutex - prevent concurrent creation
        if (this.creatingSession.has(validatedId)) {
            logger.warn(`Session creation already in progress for company ${validatedId}`);
            const promise = this.sessionCreationPromises.get(validatedId);
            if (promise) {
                return await promise;
            }
        }

        // Create promise for this session creation
        const sessionPromise = this._createSessionWithMutex(validatedId, options);
        this.sessionCreationPromises.set(validatedId, sessionPromise);
        this.creatingSession.add(validatedId);

        try {
            const session = await sessionPromise;
            // Reset failure count on success
            this.failureCount.delete(validatedId);
            this.lastFailureTime.delete(validatedId);
            return session;
        } catch (error) {
            // Track failures for circuit breaker
            const failures = (this.failureCount.get(validatedId) || 0) + 1;
            this.failureCount.set(validatedId, failures);
            this.lastFailureTime.set(validatedId, Date.now());

            logger.error(`Failed to create session for company ${validatedId} (attempt ${failures}):`, error.message);
            throw error;
        } finally {
            // Clear mutex
            this.creatingSession.delete(validatedId);
            this.sessionCreationPromises.delete(validatedId);
        }
    }

    /**
     * Check if circuit breaker is open
     */
    isCircuitOpen(companyId) {
        const failures = this.failureCount.get(companyId) || 0;
        if (failures < this.circuitBreakerThreshold) {
            return false;
        }

        const lastFailure = this.lastFailureTime.get(companyId) || 0;
        const timeSinceFailure = Date.now() - lastFailure;

        // Reset circuit if cooldown period has passed
        if (timeSinceFailure > this.circuitBreakerCooldown) {
            this.failureCount.delete(companyId);
            this.lastFailureTime.delete(companyId);
            return false;
        }

        return true;
    }

    /**
     * Internal method to create session with mutex
     */
    async _createSessionWithMutex(companyId, options = {}) {
        const validatedId = companyId; // Already validated

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

            // Get latest Baileys version for better compatibility
            const { version } = await fetchLatestBaileysVersion();
            logger.info(`📦 Using Baileys version: ${version.join('.')}`);

            // Check if we should use pairing code
            const usePairingCode = options.usePairingCode || process.env.USE_PAIRING_CODE === 'true';
            const phoneNumber = options.phoneNumber || process.env.WHATSAPP_PHONE_NUMBER;

            // Create socket with optimized config
            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                printQRInTerminal: false, // Must be false for pairing code
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

            // Store pairing code info for later use when socket is ready
            if (usePairingCode && phoneNumber && !state.creds.registered) {
                // Format phone number for E.164 without plus sign
                let cleanPhone = phoneNumber.replace(/\D/g, '');
                // Ensure it starts with country code (add 7 for Russia if needed)
                if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
                    cleanPhone = '7' + cleanPhone.substring(1);
                }
                sock.pairingPhoneNumber = cleanPhone;
                sock.shouldRequestPairingCode = true;
                logger.info(`📱 Will request pairing code for company ${validatedId} with phone ${cleanPhone} when connection is ready`);
            }

            // Save in pool
            this.sessions.set(validatedId, sock);
            this.metrics.totalSessions++;

            // Setup event handlers with pairing code support
            this.setupEventHandlers(validatedId, sock, saveCreds, options);

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
    setupEventHandlers(companyId, sock, saveCreds, options = {}) {
        // Track QR generation count for auto-switching to pairing code
        let qrCount = 0;
        const maxQRAttempts = 3;
        // Connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Handle pairing code request when connection is in "connecting" state or QR is available
            // According to Baileys docs: can request pairing code when connection == "connecting" || !!qr
            if (sock.shouldRequestPairingCode && (connection === 'connecting' || qr)) {
                try {
                    logger.info(`📱 Connection ready (${connection || 'qr available'}), requesting pairing code for company ${companyId}`);
                    const code = await sock.requestPairingCode(sock.pairingPhoneNumber);
                    const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

                    logger.info(`✅ Pairing code generated for company ${companyId}: ${formattedCode}`);
                    this.emit('pairing-code', { companyId, code: formattedCode, phoneNumber: sock.pairingPhoneNumber });
                    this.qrCodes.set(`pairing-${companyId}`, formattedCode);

                    // Clear the flag
                    sock.shouldRequestPairingCode = false;
                } catch (error) {
                    logger.error(`Failed to request pairing code: ${error.message}`);
                    // Will fall back to QR if available
                    sock.shouldRequestPairingCode = false;
                }
            }

            if (qr) {
                qrCount++;
                logger.info(`📱 QR Code generated for company ${companyId} (attempt ${qrCount})`);
                this.metrics.qrCodesGenerated++;

                // Check if we should switch to pairing code
                if (qrCount >= maxQRAttempts && process.env.USE_PAIRING_CODE === 'true') {
                    logger.warn(`⚠️ Too many QR attempts (${qrCount}) for company ${companyId}`);
                    logger.info(`💡 Switching to pairing code method to avoid 'linking devices' block`);

                    // Request pairing code instead
                    const phoneNumber = options.phoneNumber || process.env.WHATSAPP_PHONE_NUMBER;
                    if (phoneNumber) {
                        try {
                            const cleanPhone = phoneNumber.replace(/\D/g, '');
                            const code = await sock.requestPairingCode(cleanPhone);
                            const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

                            logger.info(`✅ Pairing code generated: ${formattedCode}`);
                            this.emit('pairing-code', { companyId, code: formattedCode, phoneNumber: cleanPhone });
                            this.qrCodes.set(`pairing-${companyId}`, formattedCode);
                            return; // Don't emit QR
                        } catch (error) {
                            logger.error(`Failed to request pairing code: ${error.message}`);
                        }
                    }
                }

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

            // If too many files (indicating key accumulation), alert but don't force reset
            if (totalSize > 180) {
                logger.error(`🚨 CRITICAL: Session for ${companyId} has ${totalSize} files!`);
                logger.error(`Risk of device_removed! Manual cleanup required urgently!`);

                // Send alert if Telegram configured
                if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
                    const axios = require('axios');
                    try {
                        await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            chat_id: process.env.TELEGRAM_CHAT_ID,
                            text: `🚨 CRITICAL WhatsApp Issue!\n\nCompany: ${companyId}\nAuth files: ${totalSize}\n\nRisk of device_removed!\n\n1. Stop WhatsApp for this company\n2. Run smart cleanup\n3. Restart\n\nDO NOT wait!`,
                            parse_mode: 'HTML'
                        });
                    } catch (alertErr) {
                        logger.error('Failed to send Telegram alert:', alertErr.message);
                    }
                }

                // DO NOT automatically reset - this requires QR rescan!
                // Let smart cleanup handle it properly
            } else if (totalSize > 150) {
                logger.warn(`⚠️ Session for ${companyId} has ${totalSize} files - needs cleanup soon`);
            } else if (totalSize > 120) {
                logger.info(`📊 Session for ${companyId} has ${totalSize} files - monitoring`);
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
     * Gets QR code or pairing code for a company
     */
    getQRCode(companyId) {
        const validatedId = this.validateCompanyId(companyId);
        // Check for pairing code first
        const pairingCode = this.qrCodes.get(`pairing-${validatedId}`);
        if (pairingCode) {
            return { type: 'pairing', code: pairingCode };
        }
        // Then check for QR code
        const qrCode = this.qrCodes.get(validatedId);
        if (qrCode) {
            return { type: 'qr', code: qrCode };
        }
        return null;
    }

    /**
     * Request pairing code for a company
     */
    async requestPairingCode(companyId, phoneNumber) {
        const validatedId = this.validateCompanyId(companyId);

        // Clean phone number
        const cleanPhone = String(phoneNumber).replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 10) {
            throw new Error('Invalid phone number provided');
        }

        logger.info(`Requesting pairing code for company ${validatedId} with phone ${cleanPhone}`);

        return new Promise(async (resolve, reject) => {
            try {
                // Check if we already have a pairing code stored
                const existingCode = this.qrCodes.get(`pairing-${validatedId}`);
                if (existingCode) {
                    logger.info(`Returning existing pairing code for company ${validatedId}`);
                    return resolve(existingCode);
                }

                // Check if we already have an active session
                let sock = this.sessions.get(validatedId);

                // If no session or not connected, create new one
                if (!sock || !sock.user) {
                    logger.info(`Creating new session for pairing code generation for company ${validatedId}`);

                    // Remove old session if exists
                    if (sock) {
                        try {
                            await sock.logout();
                        } catch (err) {
                            // Ignore logout errors
                        }
                        this.sessions.delete(validatedId);
                    }

                    // Set up listener for pairing code event
                    const pairingCodeHandler = (data) => {
                        if (data.companyId === validatedId) {
                            this.removeListener('pairing-code', pairingCodeHandler);
                            resolve(data.code);
                        }
                    };

                    // Set timeout for pairing code generation
                    const timeout = setTimeout(() => {
                        this.removeListener('pairing-code', pairingCodeHandler);
                        reject(new Error('Timeout waiting for pairing code generation'));
                    }, 30000); // 30 seconds timeout

                    this.on('pairing-code', pairingCodeHandler);

                    // Create new session with pairing code option
                    // This will trigger pairing code generation when socket is ready
                    sock = await this._createSessionWithMutex(validatedId, {
                        usePairingCode: true,
                        phoneNumber: cleanPhone
                    });

                    // Clear timeout if code was generated
                    clearTimeout(timeout);
                } else {
                    // Session exists and is connected, try to request code directly
                    try {
                        const code = await sock.requestPairingCode(cleanPhone);
                        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

                        logger.info(`✅ Pairing code generated for company ${validatedId}: ${formattedCode}`);

                        // Store the code
                        this.qrCodes.set(`pairing-${validatedId}`, formattedCode);

                        // Emit event
                        this.emit('pairing-code', {
                            companyId: validatedId,
                            code: formattedCode,
                            phoneNumber: cleanPhone
                        });

                        resolve(formattedCode);
                    } catch (error) {
                        logger.error(`Failed to request pairing code from existing session:`, error);
                        reject(new Error('Failed to generate pairing code. Please try again.'));
                    }
                }
            } catch (error) {
                logger.error(`Failed to generate pairing code for ${validatedId}:`, error);

                // Check for specific error messages
                if (error.message?.includes('Connection Closed')) {
                    reject(new Error('WhatsApp connection is closed. Please try again or use QR code method.'));
                } else if (error.message?.includes('rate')) {
                    reject(new Error('Too many attempts. Please wait a few minutes and try again.'));
                } else {
                    reject(error);
                }
            }
        });
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