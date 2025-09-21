/**
 * WhatsApp Session Pool Manager - IMPROVED VERSION
 * Исправленная версия с учетом официальной документации Baileys
 *
 * Ключевые улучшения:
 * - Правильная проверка статуса подключения
 * - Корректная очистка сессий
 * - Улучшенная обработка ошибок
 * - Правильные настройки browser
 * - Совместимость с Baileys 7.0.0
 */

const {
    makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs-extra');
const EventEmitter = require('events');
const logger = require('../../utils/logger');
const QRCode = require('qrcode');

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
        this.healthCheckInterval = 60000; // 60 seconds - реже проверяем

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
            logger.info('✅ Improved WhatsApp Session Pool initialized');
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
     * Start health checks for all sessions
     * ВАЖНО: Не проверяем session.user активно, чтобы избежать ошибки 440 (connectionReplaced)
     * Полагаемся только на события Baileys для обнаружения отключений
     */
    startHealthChecks() {
        // Отключаем активную проверку здоровья, чтобы избежать конфликтов
        // Baileys сам уведомит нас через события, если соединение потеряно
        logger.info('Health checks initialized (passive mode to prevent error 440)');

        // Вместо активной проверки, просто логируем статистику
        setInterval(() => {
            const activeCount = Array.from(this.sessions.values()).filter(s => s.user).length;
            logger.debug(`Session pool status: ${activeCount}/${this.sessions.size} active sessions`);
        }, this.healthCheckInterval);
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
     * Gets existing session without creating new one
     */
    getSession(companyId) {
        const validatedId = this.validateCompanyId(companyId);
        return this.sessions.get(validatedId);
    }

    /**
     * Gets or creates session for company with mutex protection
     */
    async getOrCreateSession(companyId) {
        const validatedId = this.validateCompanyId(companyId);

        // Check existing session
        if (this.sessions.has(validatedId)) {
            const session = this.sessions.get(validatedId);
            // Правильная проверка для Baileys - проверяем user вместо ws.readyState
            if (session && session.user) {
                logger.debug(`✅ Using existing session for company ${validatedId}`);
                return session;
            } else {
                logger.info(`🔄 Session exists but not connected for company ${validatedId}`);
            }
        }

        // Check if already creating this session (mutex)
        if (this.creatingSession.has(validatedId)) {
            logger.debug(`⏳ Waiting for session creation for company ${validatedId}`);
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
            // Check if session already exists and properly close it
            const existingSession = this.sessions.get(validatedId);
            if (existingSession) {
                logger.info(`🔄 Closing existing session for company ${validatedId} before creating new one`);
                try {
                    // Правильный способ закрытия для Baileys
                    if (existingSession.end) {
                        existingSession.end();
                    }
                } catch (err) {
                    logger.debug(`Close error for ${validatedId}: ${err.message}`);
                }
                this.sessions.delete(validatedId);
            }

            // Auth data path for company
            const authPath = path.join(this.baseAuthPath, `company_${validatedId}`);
            await fs.ensureDir(authPath);
            this.authPaths.set(validatedId, authPath);

            // Load or create auth state
            const { state, saveCreds } = await useMultiFileAuthState(authPath);

            // Get latest Baileys version for better compatibility
            const { version, isLatest } = await fetchLatestBaileysVersion();
            logger.info(`📦 Using Baileys version: ${version.join('.')} (latest: ${isLatest})`);

            // Check if we should use pairing code
            const usePairingCode = options.usePairingCode || process.env.USE_PAIRING_CODE === 'true';
            const phoneNumber = options.phoneNumber || process.env.WHATSAPP_PHONE_NUMBER;

            // Create socket with optimized config from official example
            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                printQRInTerminal: false,
                logger: pino({ level: 'error' }),
                browser: Browsers.ubuntu('Chrome'), // Используем рекомендуемые настройки
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                retryRequestDelayMs: 250,
                maxRetries: 3,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000, // Увеличили интервал
                qrTimeout: 60000,
                defaultQueryTimeoutMs: undefined,
                // Функция для получения сообщений (без store в v7.0.0)
                getMessage: async () => undefined
            });

            // Store pairing code info for later use when socket is ready
            if (usePairingCode && phoneNumber) {
                // Format phone number for E.164 without plus sign
                let cleanPhone = phoneNumber.replace(/\D/g, '');
                // Ensure it starts with country code (add 7 for Russia if needed)
                if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
                    cleanPhone = '7' + cleanPhone.substring(1);
                }
                sock.pairingPhoneNumber = cleanPhone;
                sock.shouldRequestPairingCode = true;
                sock.usePairingCode = true;
                logger.info(`📱 Will request pairing code for company ${validatedId} with phone ${cleanPhone}`);
            }

            // Save in pool
            this.sessions.set(validatedId, sock);
            this.metrics.totalSessions++;

            // Setup event handlers with pairing code support
            this.setupEventHandlers(validatedId, sock, saveCreds, options);

            logger.info(`✅ Session created for company ${validatedId}`);
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
        let pairingCodeTimeout = null;

        // Connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Check if we should immediately request pairing code when QR is available
            if (qr && sock.usePairingCode && sock.shouldRequestPairingCode) {
                // Mark as handled to prevent multiple requests
                sock.shouldRequestPairingCode = false;

                // Clear previous timeout if exists
                if (pairingCodeTimeout) {
                    clearTimeout(pairingCodeTimeout);
                }

                // Request pairing code immediately when QR is available
                (async () => {
                    try {
                        logger.info(`📱 QR available, requesting pairing code for company ${companyId} with phone ${sock.pairingPhoneNumber}`);

                        const code = await sock.requestPairingCode(sock.pairingPhoneNumber);
                        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

                        logger.info(`✅ Pairing code generated for company ${companyId}: ${formattedCode}`);
                        logger.info(`📱 Enter this code in WhatsApp within 60 seconds!`);

                        this.emit('pairing-code', { companyId, code: formattedCode, phoneNumber: sock.pairingPhoneNumber });
                        this.qrCodes.set(`pairing-${companyId}`, formattedCode);

                        // Set timeout for pairing code expiration
                        pairingCodeTimeout = setTimeout(() => {
                            logger.warn(`⏱️ Pairing code expired for company ${companyId}`);
                            this.qrCodes.delete(`pairing-${companyId}`);
                            // Request new code or fallback to QR
                            sock.usePairingCode = false;
                        }, 60000);

                        return;
                    } catch (error) {
                        logger.error(`Failed to request pairing code: ${error.message}`);
                        logger.info(`Will fallback to QR code method`);
                        sock.usePairingCode = false;
                    }
                })();
            }

            if (qr && !sock.usePairingCode) {
                qrCount++;
                logger.info(`📱 QR Code generated for company ${companyId} (attempt ${qrCount})`);
                this.metrics.qrCodesGenerated++;

                // Store and emit raw QR code
                this.qrCodes.set(companyId, qr);
                this.emit('qr', { companyId, qr });

                // Check if we should switch to pairing code after multiple QR attempts
                if (qrCount >= maxQRAttempts && process.env.USE_PAIRING_CODE === 'true') {
                    logger.warn(`⚠️ Too many QR attempts (${qrCount}) for company ${companyId}`);
                    logger.info(`💡 Consider using pairing code method to avoid 'linking devices' block`);
                }
            }

            if (connection === 'close') {
                this.metrics.activeConnections--;

                // Clear pairing code timeout
                if (pairingCodeTimeout) {
                    clearTimeout(pairingCodeTimeout);
                    pairingCodeTimeout = null;
                }

                // Проверяем причину отключения
                const statusCode = (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output.statusCode
                    : 0;

                // Логируем детальную информацию об отключении
                logger.warn(`Connection closed for company ${companyId}`, {
                    statusCode,
                    error: lastDisconnect?.error?.message,
                    disconnectReason: Object.keys(DisconnectReason).find(key => DisconnectReason[key] === statusCode)
                });

                // Обработка ошибки 440 (connectionReplaced) - НЕ переподключаемся
                if (statusCode === DisconnectReason.connectionReplaced) {
                    logger.error(`⚠️ Connection replaced (error 440) for company ${companyId}. Another device/instance took over the session.`);
                    logger.info(`Clearing session data and waiting for manual reconnection...`);
                    await this.removeSession(companyId);
                    this.emit('connection_replaced', { companyId });
                    return;
                }

                // Обработка ошибки 515 (restartRequired) - переподключаемся немедленно
                if (statusCode === DisconnectReason.restartRequired) {
                    logger.info(`Restart required for company ${companyId}, reconnecting immediately...`);
                    await this.handleReconnect(companyId);
                    return;
                }

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    logger.info(`Connection closed for company ${companyId}, will reconnect...`);
                    await this.handleReconnect(companyId);
                } else {
                    logger.warn(`Session logged out for company ${companyId}`);
                    await this.removeSession(companyId);
                    this.emit('logout', { companyId });
                }
            }

            if (connection === 'open') {
                logger.info(`✅ WhatsApp connected for company ${companyId}`, {
                    user: sock.user
                });
                this.metrics.activeConnections++;
                this.reconnectAttempts.set(companyId, 0);
                this.qrCodes.delete(companyId);
                this.qrCodes.delete(`pairing-${companyId}`);

                // Clear pairing code timeout
                if (pairingCodeTimeout) {
                    clearTimeout(pairingCodeTimeout);
                    pairingCodeTimeout = null;
                }

                this.emit('connected', {
                    companyId,
                    user: sock.user,
                    phoneNumber: sock.user?.id?.split('@')[0]
                });
            }
        });

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            logger.info(`📩 Messages upsert for company ${companyId}, type: ${type}, count: ${messages?.length}`);

            // Only process new messages
            if (type === 'notify') {
                for (const msg of messages) {
                    logger.info(`Processing message:`, {
                        from: msg.key.remoteJid,
                        fromMe: msg.key.fromMe,
                        hasMessage: !!msg.message,
                        messageType: msg.message ? Object.keys(msg.message) : null
                    });

                    if (!msg.key.fromMe && msg.message) {
                        this.metrics.messagesReceived++;
                        logger.info(`✅ Emitting message event for company ${companyId}`);
                        this.emit('message', { companyId, message: msg });
                    }
                }
            }
        });

        // Handle message updates (receipts, etc.)
        sock.ev.on('messages.update', (updates) => {
            logger.debug(`Messages updated for company ${companyId}:`, updates.length);
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

        const delay = Math.min(this.reconnectDelay * Math.pow(2, attempts), 60000);
        logger.info(`🔄 Reconnecting company ${companyId} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);

        this.reconnectAttempts.set(companyId, attempts + 1);

        // Clear existing timer if any
        const existingTimer = this.reconnectTimers.get(companyId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new reconnect timer
        const timer = setTimeout(async () => {
            this.reconnectTimers.delete(companyId);
            try {
                await this.createSession(companyId);
            } catch (error) {
                logger.error(`Reconnection failed for company ${companyId}:`, error.message);
            }
        }, delay);

        this.reconnectTimers.set(companyId, timer);
    }

    /**
     * Removes session and cleans up resources
     */
    async removeSession(companyId) {
        const session = this.sessions.get(companyId);
        if (session) {
            try {
                // Properly close session
                if (session.end) {
                    session.end();
                }
            } catch (err) {
                logger.debug(`Error closing session for ${companyId}: ${err.message}`);
            }
        }

        // Clear all related data
        this.sessions.delete(companyId);
        this.reconnectAttempts.delete(companyId);
        this.qrCodes.delete(companyId);
        this.qrCodes.delete(`pairing-${companyId}`);

        // Clear reconnect timer
        const timer = this.reconnectTimers.get(companyId);
        if (timer) {
            clearTimeout(timer);
            this.reconnectTimers.delete(companyId);
        }

        logger.info(`🔌 Session removed for company ${companyId}`);
    }

    /**
     * Sends message to WhatsApp
     */
    async sendMessage(companyId, phone, message, options = {}) {
        // Получаем существующую сессию
        const validatedId = this.validateCompanyId(companyId);
        const session = this.sessions.get(validatedId);

        if (!session || !session.user) {
            throw new Error(`WhatsApp not connected for company ${companyId}. Please ensure baileys-service is running.`);
        }

        // Format phone number
        const formattedNumber = this.formatPhoneNumber(phone);

        try {
            const result = await session.sendMessage(formattedNumber, {
                text: message
            });

            this.metrics.messagesSent++;
            logger.info(`✅ Message sent to ${formattedNumber} for company ${companyId}`);

            return result;
        } catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }

    /**
     * Formats phone number for WhatsApp
     */
    formatPhoneNumber(phone) {
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');

        // If starts with 8, replace with 7
        if (cleaned.startsWith('8')) {
            cleaned = '7' + cleaned.slice(1);
        }

        // Add @s.whatsapp.net suffix
        return `${cleaned}@s.whatsapp.net`;
    }

    /**
     * Gets session status
     */
    getSessionStatus(companyId) {
        const session = this.sessions.get(companyId);

        if (!session) {
            return { status: 'not_initialized', connected: false };
        }

        return {
            status: session.user ? 'connected' : 'disconnected',
            connected: !!session.user,
            user: session.user,
            phoneNumber: session.user?.id?.split('@')[0],
            hasQR: this.qrCodes.has(companyId),
            hasPairingCode: this.qrCodes.has(`pairing-${companyId}`)
        };
    }

    /**
     * Gets active sessions list
     */
    getActiveSessions() {
        const sessions = [];

        for (const [companyId, session] of this.sessions) {
            sessions.push({
                companyId,
                connected: !!session.user,
                phoneNumber: session.user?.id?.split('@')[0],
                user: session.user
            });
        }

        return sessions;
    }

    /**
     * Disconnects session
     */
    async disconnectSession(companyId) {
        await this.removeSession(companyId);
        return true;
    }

    /**
     * Get metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            connectedSessions: this.getActiveSessions().filter(s => s.connected).length,
            totalSessions: this.sessions.size
        };
    }
}

// Singleton instance
let sessionPoolInstance = null;

/**
 * Gets or creates session pool singleton
 */
function getSessionPool() {
    if (!sessionPoolInstance) {
        sessionPoolInstance = new WhatsAppSessionPool();
    }
    return sessionPoolInstance;
}

// Экспортируем с обратной совместимостью
module.exports = {
    WhatsAppSessionPool,
    getSessionPool
};