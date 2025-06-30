// src/utils/secrets-manager.js
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Simple secrets manager with encryption
 * In production, consider using HashiCorp Vault, AWS Secrets Manager, or similar
 */
class SecretsManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.masterKey = this._getMasterKey();
    this.secretsPath = process.env.SECRETS_PATH || path.join(process.cwd(), '.secrets');
    this.cache = new Map();
  }

  /**
   * Get master key from environment or generate warning
   */
  _getMasterKey() {
    const key = process.env.MASTER_KEY;
    
    if (!key) {
      logger.warn('MASTER_KEY not set. Using default key (INSECURE - only for development)');
      // In production, this should throw an error
      return crypto.scryptSync('default-dev-key', 'salt', 32);
    }
    
    // Validate key length
    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== 32) {
      throw new Error('MASTER_KEY must be 32 bytes (64 hex characters)');
    }
    
    return keyBuffer;
  }

  /**
   * Encrypt a secret
   */
  _encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt a secret
   */
  _decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.masterKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Store a secret
   */
  async setSecret(name, value) {
    try {
      const encrypted = this._encrypt(value);
      
      // Ensure secrets directory exists
      await fs.mkdir(this.secretsPath, { recursive: true });
      
      // Save encrypted secret
      const filePath = path.join(this.secretsPath, `${name}.json`);
      await fs.writeFile(filePath, JSON.stringify(encrypted, null, 2));
      
      // Update cache
      this.cache.set(name, value);
      
      logger.info(`Secret '${name}' stored successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to store secret '${name}':`, error);
      throw error;
    }
  }

  /**
   * Retrieve a secret
   */
  async getSecret(name) {
    try {
      // Check cache first
      if (this.cache.has(name)) {
        return this.cache.get(name);
      }
      
      // Read from file
      const filePath = path.join(this.secretsPath, `${name}.json`);
      const encryptedData = JSON.parse(await fs.readFile(filePath, 'utf8'));
      
      // Decrypt
      const value = this._decrypt(encryptedData);
      
      // Update cache
      this.cache.set(name, value);
      
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Secret not found
      }
      logger.error(`Failed to retrieve secret '${name}':`, error);
      throw error;
    }
  }

  /**
   * Get secret or fallback to environment variable
   */
  async getSecretOrEnv(name, envVar) {
    const secret = await this.getSecret(name);
    return secret || process.env[envVar];
  }

  /**
   * List all secret names
   */
  async listSecrets() {
    try {
      const files = await fs.readdir(this.secretsPath);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(name) {
    try {
      const filePath = path.join(this.secretsPath, `${name}.json`);
      await fs.unlink(filePath);
      this.cache.delete(name);
      logger.info(`Secret '${name}' deleted`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate a secure random key
   */
  static generateMasterKey() {
    return crypto.randomBytes(32).toString('hex');
  }
}

// Singleton instance
module.exports = new SecretsManager();