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
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const QRCode = require('qrcode');
const { useSupabaseAuthState } = require('./auth-state-supabase');
const { useTimewebAuthState } = require('./auth-state-timeweb');
const CredentialsCache = require('./credentials-cache'); // Phase 2 - Refactored cache

// Configuration constants
const CONFIG = {
    CIRCUIT_BREAKER_THRESHOLD: 5,
    CIRCUIT_BREAKER_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY_MS: 5000,
    HEALTH_CHECK_INTERVAL_MS: 60 * 1000, // 1 minute
    PAIRING_CODE_TIMEOUT_MS: 60 * 1000, // 1 minute
    MIN_PHONE_LENGTH: 10,
    MAX_PHONE_LENGTH: 15,
    CACHE_FILE_PATH: path.join(process.cwd(), '.baileys-cache.json'), // Phase 2 - Task 3.1.1
    CACHE_TTL_MS: parseInt(process.env.CREDENTIALS_CACHE_TTL_MS) || (5 * 60 * 1000) // From env or default 5 minutes
};

class WhatsAppSessionPool extends EventEmitter {
    constructor() {
        super();

        // Core data structures
        this.sessions = new Map(); // companyId -> session
        this.reconnectAttempts = new Map(); // companyId -> attempts
        this.reconnectTimers = new Map(); // companyId -> timer
        this.qrCodes = new Map(); // companyId -> qrCode
        this.pairingCodeTimeouts = new Map(); // companyId -> timeout (for cleanup)

        // Mutex for preventing race conditions
        this.creatingSession = new Set(); // companyIds currently being created
        this.sessionCreationPromises = new Map(); // companyId -> Promise

        // Circuit breaker pattern
        this.failureCount = new Map(); // companyId -> failure count
        this.lastFailureTime = new Map(); // companyId -> timestamp
        this.circuitBreakerThreshold = CONFIG.CIRCUIT_BREAKER_THRESHOLD;
        this.circuitBreakerCooldown = CONFIG.CIRCUIT_BREAKER_COOLDOWN_MS;

        // Credentials cache (Phase 2 - Refactored to separate class)
        // Provides 5-minute grace period during PostgreSQL outages
        this.credentialsCache = new CredentialsCache({
            ttlMs: CONFIG.CACHE_TTL_MS,
            cleanupIntervalMs: 60 * 1000,
            cacheFilePath: CONFIG.CACHE_FILE_PATH
        });

        // Configuration
        this.maxReconnectAttempts = CONFIG.MAX_RECONNECT_ATTEMPTS;
        this.reconnectDelay = CONFIG.RECONNECT_DELAY_MS;
        this.healthCheckInterval = CONFIG.HEALTH_CHECK_INTERVAL_MS;

        // Timers (for cleanup)
        this.healthCheckTimer = null;
        // cacheCleanupTimer moved to CredentialsCache class

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

        // Initialize async - store promise for later await
        this.initPromise = this.initialize();
    }

    /**
     * Async initialization
     */
    async initialize() {
        try {
            this.startHealthChecks();

            // Initialize credentials cache (Phase 2 - Refactored to separate class)
            await this.credentialsCache.initialize();

            logger.info('✅ Improved WhatsApp Session Pool initialized');
        } catch (error) {
            logger.error('Failed to initialize WhatsApp Session Pool:', error);
            this.metrics.errors++;
            this.metrics.lastError = error.message;
            throw error; // Re-throw so callers can handle
        }
    }

    /**
     * Wait for initialization to complete
     */
    async waitForInit() {
        await this.initPromise;
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
        this.healthCheckTimer = setInterval(() => {
            // Efficient counting without creating array
            let activeCount = 0;
            for (const session of this.sessions.values()) {
                if (session.user) activeCount++;
            }
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
     * Gets or creates session for company
     * This is an alias for createSession with no options
     */
    async getOrCreateSession(companyId) {
        return await this.createSession(companyId, {});
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
            logger.warn(`Session creation already in progress for company ${validatedId}, waiting for existing promise`);
            const promise = this.sessionCreationPromises.get(validatedId);
            if (promise) {
                try {
                    return await promise;
                } catch (error) {
                    // If the existing promise failed, allow retry
                    logger.debug(`Existing session creation promise failed, will retry`);
                }
            }
            // If no promise or promise failed, throw error to prevent spam
            throw new Error(`Session creation already in progress for company ${validatedId}`);
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

            // Feature flags: Choose auth state backend
            // Priority: USE_LEGACY_SUPABASE > USE_DATABASE_AUTH_STATE > file-based (fallback)
            const useLegacySupabase = process.env.USE_LEGACY_SUPABASE !== 'false';
            const useDatabaseAuth = process.env.USE_DATABASE_AUTH_STATE === 'true';

            let state, saveCreds;

            if (useLegacySupabase) {
                // Supabase auth state (legacy)
                logger.info(`📦 Using Supabase auth state for company ${validatedId}`);
                ({ state, saveCreds } = await useSupabaseAuthState(validatedId));
            } else if (useDatabaseAuth) {
                // Timeweb PostgreSQL auth state (production)
                logger.info(`🗄️  Using Timeweb PostgreSQL auth state for company ${validatedId}`);
                // Pass sessionPool instance for credentials cache support (Phase 2 - Task 3.1)
                ({ state, saveCreds } = await useTimewebAuthState(validatedId, { sessionPool: this }));
            } else {
                throw new Error('No auth state provider configured. Set USE_LEGACY_SUPABASE=true or USE_REPOSITORY_PATTERN=true');
            }

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
                // Use unified E.164 normalization
                const cleanPhone = this.normalizePhoneE164(phoneNumber);
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

        // Connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Check if we should immediately request pairing code when QR is available
            if (qr && sock.usePairingCode && sock.shouldRequestPairingCode) {
                // Mark as handled to prevent multiple requests
                sock.shouldRequestPairingCode = false;

                // Clear previous timeout if exists
                const existingTimeout = this.pairingCodeTimeouts.get(companyId);
                if (existingTimeout) {
                    clearTimeout(existingTimeout);
                    this.pairingCodeTimeouts.delete(companyId);
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
                        const timeout = setTimeout(() => {
                            logger.warn(`⏱️ Pairing code expired for company ${companyId}`);
                            this.qrCodes.delete(`pairing-${companyId}`);
                            this.pairingCodeTimeouts.delete(companyId);
                            // Request new code or fallback to QR
                            sock.usePairingCode = false;
                        }, CONFIG.PAIRING_CODE_TIMEOUT_MS);

                        this.pairingCodeTimeouts.set(companyId, timeout);

                        return;
                    } catch (error) {
                        logger.error(`Failed to request pairing code: ${error.message}`);
                        logger.info(`Will fallback to QR code method`);
                        sock.usePairingCode = false;
                    }
                }).catch(error => {
                    logger.error('Unhandled error in pairing code request:', error);
                    this.emit('error', { companyId, error });
                });
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
                const pairingTimeout = this.pairingCodeTimeouts.get(companyId);
                if (pairingTimeout) {
                    clearTimeout(pairingTimeout);
                    this.pairingCodeTimeouts.delete(companyId);
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
                    // Don't reconnect if we're already creating a session (prevents infinite loop)
                    if (this.creatingSession.has(companyId)) {
                        logger.warn(`Session creation already in progress for ${companyId}, skipping restart to prevent loop`);
                        return;
                    }

                    logger.info(`Restart required for company ${companyId}, reconnecting immediately...`);
                    await this.handleReconnect(companyId);
                    return;
                }

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    // Don't reconnect if we're already creating a session (prevents infinite loop)
                    if (this.creatingSession.has(companyId)) {
                        logger.warn(`Session creation already in progress for ${companyId}, skipping reconnect to prevent loop`);
                        return;
                    }

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
                const pairingTimeout = this.pairingCodeTimeouts.get(companyId);
                if (pairingTimeout) {
                    clearTimeout(pairingTimeout);
                    this.pairingCodeTimeouts.delete(companyId);
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

        // Handle incoming reactions from clients
        sock.ev.on('messages.reaction', async (reaction) => {
            logger.info(`👍 Reaction received for company ${companyId}:`, {
                from: reaction.key.remoteJid,
                emoji: reaction.reaction?.text,
                messageId: reaction.key.id
            });

            // Only process reactions from clients (not our own reactions)
            if (!reaction.key.fromMe && reaction.reaction) {
                logger.info(`✅ Emitting reaction event for company ${companyId}`);
                this.emit('reaction', {
                    companyId,
                    reaction: {
                        from: reaction.key.remoteJid,
                        emoji: reaction.reaction.text,
                        messageId: reaction.key.id,
                        timestamp: Date.now()
                    }
                });
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
     * Handles reconnection with exponential backoff
     */
    async handleReconnect(companyId) {
        // Check if session creation is already in progress
        if (this.creatingSession.has(companyId)) {
            logger.warn(`Session creation already in progress for ${companyId}, skipping reconnect`);
            return;
        }

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
                // Schedule next reconnect attempt
                await this.handleReconnect(companyId);
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
                // Remove all event listeners to prevent memory leaks
                if (session.ev) {
                    session.ev.removeAllListeners('connection.update');
                    session.ev.removeAllListeners('creds.update');
                    session.ev.removeAllListeners('messages.upsert');
                    session.ev.removeAllListeners('messages.update');
                    session.ev.removeAllListeners('messages.reaction');
                    session.ev.removeAllListeners('error');
                }

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

        // Clear circuit breaker data to prevent memory leaks
        this.failureCount.delete(companyId);
        this.lastFailureTime.delete(companyId);

        // Clear reconnect timer
        const reconnectTimer = this.reconnectTimers.get(companyId);
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            this.reconnectTimers.delete(companyId);
        }

        // Clear pairing code timeout
        const pairingTimeout = this.pairingCodeTimeouts.get(companyId);
        if (pairingTimeout) {
            clearTimeout(pairingTimeout);
            this.pairingCodeTimeouts.delete(companyId);
        }

        logger.info(`🔌 Session removed for company ${companyId}`);
    }

    /**
     * =================================================================================
     * CREDENTIALS CACHE METHODS (Phase 2 - Task 3.1)
     * =================================================================================
     * Provides 5-minute grace period during PostgreSQL outages
     */

    /**
     * Get cached credentials for company (if not expired)
     * Wrapper method - delegates to CredentialsCache class
     * @param {string} companyId - Company ID
     * @returns {Object|null} - Cached {creds, keys} or null if expired/missing
     */
    getCachedCredentials(companyId) {
        // Delegate to CredentialsCache class
        const cached = this.credentialsCache.get(companyId);

        if (!cached) {
            return null;
        }

        logger.info(`💾 Using cached credentials for company ${companyId}`);
        return {
            creds: cached.creds,
            keys: cached.keys
        };
    }

    /**
     * Set cached credentials for company
     * Wrapper method - delegates to CredentialsCache class
     * @param {string} companyId - Company ID
     * @param {Object} creds - Credentials object
     * @param {Object} keys - Keys interface (will be serialized to object)
     */
    setCachedCredentials(companyId, creds, keys) {
        // Delegate to CredentialsCache class
        // Cache class handles: deep clone, persistence, TTL
        this.credentialsCache.set(companyId, creds, keys);
    }

    /**
     * Clear cached credentials for company
     * Called on successful reconnection to ensure fresh data
     * Wrapper method - delegates to CredentialsCache class
     * @param {string} companyId - Company ID
     */
    clearCachedCredentials(companyId) {
        // Delegate to CredentialsCache class
        // Cache class handles: persistence
        this.credentialsCache.clear(companyId);
    }

    // Cache methods moved to CredentialsCache class
    // startCacheCleanup(), cleanExpiredCache(), reviveBuffers()
    // loadCacheFromFile(), saveCacheToFile() now handled by cache.initialize()

    /**
     * =================================================================================
     * END CREDENTIALS CACHE METHODS
     * =================================================================================
     */

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
     * Sends reaction to a message
     */
    async sendReaction(companyId, phone, emoji, messageId) {
        const validatedId = this.validateCompanyId(companyId);

        // Validate messageId
        if (!messageId || typeof messageId !== 'string' || messageId.length === 0) {
            throw new Error('Invalid messageId: must be a non-empty string');
        }

        // Validate emoji (1-4 characters to support single and multi-byte emojis)
        if (!emoji || typeof emoji !== 'string' || emoji.length === 0 || emoji.length > 4) {
            throw new Error('Invalid emoji: must be 1-4 characters');
        }

        const session = this.sessions.get(validatedId);

        if (!session || !session.user) {
            throw new Error(`WhatsApp not connected for company ${companyId}. Please ensure baileys-service is running.`);
        }

        // Format phone number
        const formattedNumber = this.formatPhoneNumber(phone);

        try {
            // Build message key for reaction
            const messageKey = {
                remoteJid: formattedNumber,
                id: messageId,
                fromMe: false
            };

            const result = await session.sendMessage(formattedNumber, {
                react: {
                    text: emoji,
                    key: messageKey
                }
            });

            logger.info(`✅ Reaction ${emoji} sent to ${formattedNumber} for company ${companyId}`);

            return result;
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Failed to send reaction to ${formattedNumber}:`, error);
            throw error;
        }
    }

    /**
     * Normalizes phone number to E.164 format (without + sign)
     * @param {string} phone - Phone number in any format
     * @returns {string} - E.164 formatted number (digits only, no +)
     * @example
     * normalizePhoneE164('89001234567') => '79001234567'
     * normalizePhoneE164('+79001234567') => '79001234567'
     * normalizePhoneE164('9001234567') => '79001234567' (assumes Russia)
     */
    normalizePhoneE164(phone) {
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');

        // Validate length
        if (cleaned.length < CONFIG.MIN_PHONE_LENGTH || cleaned.length > CONFIG.MAX_PHONE_LENGTH) {
            throw new Error(`Invalid phone number length: ${cleaned.length}. Expected ${CONFIG.MIN_PHONE_LENGTH}-${CONFIG.MAX_PHONE_LENGTH} digits.`);
        }

        // Convert to E.164 format (without +)
        // If starts with 8 and length is 11 (Russian mobile format), replace with 7
        if (cleaned.startsWith('8') && cleaned.length === 11) {
            cleaned = '7' + cleaned.slice(1);
        }
        // If doesn't start with country code and length is 10, assume Russia (7)
        else if (cleaned.length === 10) {
            cleaned = '7' + cleaned;
        }

        return cleaned;
    }

    /**
     * Formats phone number to E.164 format with WhatsApp suffix
     * @param {string} phone - Phone number in any format
     * @returns {string} - Formatted number with @s.whatsapp.net suffix
     * @example
     * formatPhoneNumber('89001234567') => '79001234567@s.whatsapp.net'
     */
    formatPhoneNumber(phone) {
        return `${this.normalizePhoneE164(phone)}@s.whatsapp.net`;
    }

    /**
     * Gets QR code for a session
     */
    getQR(companyId) {
        const validatedId = this.validateCompanyId(companyId);
        return this.qrCodes.get(validatedId) || null;
    }

    // NOTE: createSession is defined earlier in the file with full mutex logic
    // This alias has been removed to prevent recursion

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

    /**
     * Graceful shutdown - cleanup all resources
     */
    async shutdown() {
        logger.info('🔴 Shutting down WhatsApp Session Pool...');

        // Clear health check interval
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
            logger.debug('Health check timer cleared');
        }

        // Shutdown credentials cache (saves to file and stops cleanup timer)
        await this.credentialsCache.shutdown();

        // Close all sessions
        const sessionIds = Array.from(this.sessions.keys());
        logger.info(`Closing ${sessionIds.length} active sessions...`);

        for (const companyId of sessionIds) {
            try {
                await this.removeSession(companyId);
                logger.debug(`Session ${companyId} removed`);
            } catch (error) {
                logger.error(`Error removing session ${companyId}:`, error.message);
            }
        }

        // Clear all pending reconnect timers
        for (const [companyId, timer] of this.reconnectTimers.entries()) {
            clearTimeout(timer);
            logger.debug(`Cleared reconnect timer for ${companyId}`);
        }
        this.reconnectTimers.clear();

        // Clear all pairing code timeouts
        for (const [companyId, timeout] of this.pairingCodeTimeouts.entries()) {
            clearTimeout(timeout);
            logger.debug(`Cleared pairing timeout for ${companyId}`);
        }
        this.pairingCodeTimeouts.clear();

        // Clear all other data structures
        this.sessionCreationPromises.clear();
        this.creatingSession.clear();
        this.failureCount.clear();
        this.lastFailureTime.clear();
        this.qrCodes.clear();
        this.reconnectAttempts.clear();

        // NOTE: credentialsCache NOT cleared on shutdown
        // Reason: If shutdown is graceful, cache may help on quick restart
        // However, cache is in-memory only and won't persist across process restarts
        // TODO: Consider persisting cache to disk/Redis for true cross-restart resilience

        logger.info('✅ WhatsApp Session Pool shutdown complete');
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