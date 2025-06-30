// src/__tests__/utils/secrets-manager.test.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Create a fresh instance for testing
jest.resetModules();
process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');
process.env.SECRETS_PATH = path.join(__dirname, '../../.test-secrets');

const secretsManager = require('../../utils/secrets-manager');

describe('SecretsManager', () => {
  const testSecretName = 'test-secret';
  const testSecretValue = 'my-secret-value';

  beforeEach(async () => {
    // Clean up test secrets directory
    try {
      await fs.rmdir(process.env.SECRETS_PATH, { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  afterAll(async () => {
    // Final cleanup
    try {
      await fs.rmdir(process.env.SECRETS_PATH, { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('setSecret and getSecret', () => {
    it('should store and retrieve a secret', async () => {
      await secretsManager.setSecret(testSecretName, testSecretValue);
      const retrieved = await secretsManager.getSecret(testSecretName);
      expect(retrieved).toBe(testSecretValue);
    });

    it('should encrypt secrets', async () => {
      await secretsManager.setSecret(testSecretName, testSecretValue);
      
      // Read the encrypted file
      const filePath = path.join(process.env.SECRETS_PATH, `${testSecretName}.json`);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      expect(data.encrypted).toBeDefined();
      expect(data.iv).toBeDefined();
      expect(data.authTag).toBeDefined();
      expect(data.encrypted).not.toBe(testSecretValue);
    });

    it('should return null for non-existent secret', async () => {
      const result = await secretsManager.getSecret('non-existent');
      expect(result).toBeNull();
    });

    it('should cache secrets', async () => {
      await secretsManager.setSecret(testSecretName, testSecretValue);
      
      // First call reads from file
      await secretsManager.getSecret(testSecretName);
      
      // Delete the file
      const filePath = path.join(process.env.SECRETS_PATH, `${testSecretName}.json`);
      await fs.unlink(filePath);
      
      // Should still get value from cache
      const cached = await secretsManager.getSecret(testSecretName);
      expect(cached).toBe(testSecretValue);
    });
  });

  describe('getSecretOrEnv', () => {
    it('should prefer secret over environment variable', async () => {
      process.env.TEST_VAR = 'env-value';
      await secretsManager.setSecret('test-var', 'secret-value');
      
      const result = await secretsManager.getSecretOrEnv('test-var', 'TEST_VAR');
      expect(result).toBe('secret-value');
    });

    it('should fall back to environment variable', async () => {
      process.env.TEST_VAR = 'env-value';
      
      const result = await secretsManager.getSecretOrEnv('non-existent', 'TEST_VAR');
      expect(result).toBe('env-value');
    });
  });

  describe('listSecrets', () => {
    it('should list all secret names', async () => {
      await secretsManager.setSecret('secret1', 'value1');
      await secretsManager.setSecret('secret2', 'value2');
      await secretsManager.setSecret('secret3', 'value3');
      
      const secrets = await secretsManager.listSecrets();
      expect(secrets).toHaveLength(3);
      expect(secrets).toContain('secret1');
      expect(secrets).toContain('secret2');
      expect(secrets).toContain('secret3');
    });

    it('should return empty array when no secrets', async () => {
      const secrets = await secretsManager.listSecrets();
      expect(secrets).toEqual([]);
    });
  });

  describe('deleteSecret', () => {
    it('should delete a secret', async () => {
      await secretsManager.setSecret(testSecretName, testSecretValue);
      const deleted = await secretsManager.deleteSecret(testSecretName);
      
      expect(deleted).toBe(true);
      const result = await secretsManager.getSecret(testSecretName);
      expect(result).toBeNull();
    });

    it('should return false for non-existent secret', async () => {
      const deleted = await secretsManager.deleteSecret('non-existent');
      expect(deleted).toBe(false);
    });

    it('should remove from cache', async () => {
      await secretsManager.setSecret(testSecretName, testSecretValue);
      await secretsManager.getSecret(testSecretName); // Cache it
      await secretsManager.deleteSecret(testSecretName);
      
      const result = await secretsManager.getSecret(testSecretName);
      expect(result).toBeNull();
    });
  });

  describe('generateMasterKey', () => {
    it('should generate a valid master key', () => {
      const key = secretsManager.constructor.generateMasterKey();
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(Buffer.from(key, 'hex').length).toBe(32);
    });
  });
});