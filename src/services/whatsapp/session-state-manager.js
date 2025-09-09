// src/services/whatsapp/session-state-manager.js
const redis = require('../../utils/redis-factory');
const logger = require('../../utils/logger');

class SessionStateManager {
  constructor() {
    this.redis = null;
    this.TTL = 3600; // 1 hour TTL for session state
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      this.redis = redis.getClient();
      this.initialized = true;
      logger.info('📊 Session state manager initialized with Redis');
    } catch (error) {
      logger.error('Failed to initialize session state manager:', error);
      // Fallback to in-memory if Redis is not available
      this.redis = null;
      this.memoryStore = new Map();
      logger.warn('⚠️ Using in-memory storage for session state (Redis unavailable)');
    }
  }

  async saveSessionState(companyId, state) {
    if (!this.initialized) await this.initialize();
    
    const key = `whatsapp:session:${companyId}`;
    const data = {
      state: state.status || 'unknown',
      connectedAt: state.connectedAt || null,
      disconnectedAt: state.disconnectedAt || null,
      lastActivity: new Date().toISOString(),
      phoneNumber: state.phoneNumber || null,
      qrCode: state.qrCode || null,
      reconnectAttempts: state.reconnectAttempts || 0,
      lastDisconnectReason: state.lastDisconnectReason || null
    };
    
    try {
      if (this.redis) {
        await this.redis.setex(key, this.TTL, JSON.stringify(data));
      } else {
        // Fallback to memory store
        this.memoryStore.set(key, data);
      }
      logger.debug(`💾 Session state saved for company ${companyId}: ${data.state}`);
    } catch (error) {
      logger.error(`Failed to save session state for ${companyId}:`, error);
      // Use memory store as fallback
      if (!this.memoryStore) this.memoryStore = new Map();
      this.memoryStore.set(key, data);
    }
  }

  async getSessionState(companyId) {
    if (!this.initialized) await this.initialize();
    
    const key = `whatsapp:session:${companyId}`;
    
    try {
      let data;
      if (this.redis) {
        const rawData = await this.redis.get(key);
        if (!rawData) return null;
        data = JSON.parse(rawData);
      } else {
        // Get from memory store
        data = this.memoryStore.get(key);
      }
      
      if (!data) return null;
      
      // Check if state is too old (older than TTL)
      const lastActivity = new Date(data.lastActivity);
      const age = Date.now() - lastActivity.getTime();
      if (age > this.TTL * 1000) {
        logger.debug(`Session state for ${companyId} is too old, clearing...`);
        await this.clearSessionState(companyId);
        return null;
      }
      
      return data;
    } catch (error) {
      logger.error(`Failed to get session state for ${companyId}:`, error);
      return null;
    }
  }

  async updateLastActivity(companyId) {
    const state = await this.getSessionState(companyId);
    if (state) {
      state.lastActivity = new Date().toISOString();
      await this.saveSessionState(companyId, state);
    }
  }

  async updateConnectionStatus(companyId, status, additionalData = {}) {
    const currentState = await this.getSessionState(companyId) || {};
    
    const updatedState = {
      ...currentState,
      status,
      ...additionalData
    };
    
    if (status === 'connected') {
      updatedState.connectedAt = new Date().toISOString();
      updatedState.reconnectAttempts = 0;
    } else if (status === 'disconnected') {
      updatedState.disconnectedAt = new Date().toISOString();
    }
    
    await this.saveSessionState(companyId, updatedState);
  }

  async incrementReconnectAttempts(companyId) {
    const state = await this.getSessionState(companyId) || {};
    state.reconnectAttempts = (state.reconnectAttempts || 0) + 1;
    await this.saveSessionState(companyId, state);
    return state.reconnectAttempts;
  }

  async clearSessionState(companyId) {
    if (!this.initialized) await this.initialize();
    
    const key = `whatsapp:session:${companyId}`;
    
    try {
      if (this.redis) {
        await this.redis.del(key);
      } else {
        this.memoryStore.delete(key);
      }
      logger.info(`🗑️ Session state cleared for company ${companyId}`);
    } catch (error) {
      logger.error(`Failed to clear session state for ${companyId}:`, error);
    }
  }

  async getAllSessionStates() {
    if (!this.initialized) await this.initialize();
    
    const states = [];
    
    try {
      if (this.redis) {
        // Get all whatsapp:session:* keys
        const keys = await this.redis.keys('whatsapp:session:*');
        
        for (const key of keys) {
          const rawData = await this.redis.get(key);
          if (rawData) {
            try {
              const data = JSON.parse(rawData);
              const companyId = key.replace('whatsapp:session:', '');
              states.push({ companyId, ...data });
            } catch (e) {
              logger.warn(`Failed to parse session state for key ${key}`);
            }
          }
        }
      } else {
        // Get from memory store
        for (const [key, data] of this.memoryStore.entries()) {
          const companyId = key.replace('whatsapp:session:', '');
          states.push({ companyId, ...data });
        }
      }
    } catch (error) {
      logger.error('Failed to get all session states:', error);
    }
    
    return states;
  }

  async getConnectionMetrics(companyId) {
    const state = await this.getSessionState(companyId);
    if (!state) return null;
    
    const now = Date.now();
    const metrics = {
      currentStatus: state.status,
      uptime: null,
      downtime: null,
      lastActivityAge: null,
      reconnectAttempts: state.reconnectAttempts || 0
    };
    
    if (state.status === 'connected' && state.connectedAt) {
      metrics.uptime = now - new Date(state.connectedAt).getTime();
    } else if (state.status === 'disconnected' && state.disconnectedAt) {
      metrics.downtime = now - new Date(state.disconnectedAt).getTime();
    }
    
    if (state.lastActivity) {
      metrics.lastActivityAge = now - new Date(state.lastActivity).getTime();
    }
    
    return metrics;
  }
}

// Export singleton instance
module.exports = new SessionStateManager();