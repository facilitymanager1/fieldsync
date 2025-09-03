/**
 * Secrets Manager Service
 * Production-grade secret management with multiple provider support
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface SecretsConfig {
  provider: 'env' | 'aws' | 'azure' | 'vault' | 'file';
  region?: string;
  vaultUrl?: string;
  keyVaultUrl?: string;
  secretsPath?: string;
  encryptionKey?: string;
}

interface SecretValue {
  value: string;
  version?: string;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Production Secrets Manager Service
 */
export class SecretsManagerService {
  private static instance: SecretsManagerService;
  private config: SecretsConfig;
  private cache: Map<string, SecretValue> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  private constructor(config: SecretsConfig) {
    this.config = config;
    this.validateConfiguration();
  }

  static getInstance(config?: SecretsConfig): SecretsManagerService {
    if (!SecretsManagerService.instance) {
      const defaultConfig: SecretsConfig = {
        provider: process.env.NODE_ENV === 'production' ? 'env' : 'env',
        region: process.env.AWS_REGION || 'us-east-1',
        vaultUrl: process.env.VAULT_URL,
        keyVaultUrl: process.env.AZURE_KEY_VAULT_URL,
        secretsPath: process.env.SECRETS_PATH || path.join(process.cwd(), 'secrets'),
        encryptionKey: process.env.ENCRYPTION_KEY
      };
      
      SecretsManagerService.instance = new SecretsManagerService(config || defaultConfig);
    }
    return SecretsManagerService.instance;
  }

  private validateConfiguration(): void {
    if (this.config.provider === 'aws' && !process.env.AWS_ACCESS_KEY_ID) {
      throw new Error('AWS credentials required for AWS Secrets Manager');
    }
    
    if (this.config.provider === 'azure' && !this.config.keyVaultUrl) {
      throw new Error('Azure Key Vault URL required for Azure Key Vault');
    }
    
    if (this.config.provider === 'vault' && !this.config.vaultUrl) {
      throw new Error('Vault URL required for HashiCorp Vault');
    }

    if (this.config.provider === 'file' && this.config.secretsPath) {
      this.ensureSecretsDirectory();
    }
  }

  /**
   * Get secret value with caching support
   */
  async getSecret(secretName: string, options: { 
    useCache?: boolean; 
    cacheTTL?: number;
    version?: string;
  } = {}): Promise<string> {
    const { useCache = true, cacheTTL = 300000, version } = options; // 5 minute default TTL

    // Check cache first
    if (useCache && this.isValidCached(secretName)) {
      const cached = this.cache.get(secretName);
      if (cached) {
        return cached.value;
      }
    }

    let secretValue: string;
    
    try {
      switch (this.config.provider) {
        case 'env':
          secretValue = await this.getFromEnvironment(secretName);
          break;
        case 'aws':
          secretValue = await this.getFromAWS(secretName, version);
          break;
        case 'azure':
          secretValue = await this.getFromAzure(secretName, version);
          break;
        case 'vault':
          secretValue = await this.getFromVault(secretName, version);
          break;
        case 'file':
          secretValue = await this.getFromFile(secretName);
          break;
        default:
          throw new Error(`Unsupported secrets provider: ${this.config.provider}`);
      }

      // Cache the result
      if (useCache) {
        this.cache.set(secretName, {
          value: secretValue,
          version,
          createdAt: new Date()
        });
        this.cacheExpiry.set(secretName, Date.now() + cacheTTL);
      }

      return secretValue;
      
    } catch (error) {
      console.error(`Failed to retrieve secret ${secretName}:`, error);
      throw new Error(`Secret retrieval failed: ${secretName}`);
    }
  }

  /**
   * Set secret value (for file-based provider)
   */
  async setSecret(secretName: string, value: string, options: {
    encrypt?: boolean;
    expiresIn?: number;
    version?: string;
  } = {}): Promise<void> {
    if (this.config.provider !== 'file') {
      throw new Error('Setting secrets is only supported for file provider');
    }

    const { encrypt = true, expiresIn, version } = options;
    
    const secretData: SecretValue = {
      value: encrypt ? this.encrypt(value) : value,
      version,
      createdAt: new Date(),
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : undefined
    };

    const secretPath = path.join(this.config.secretsPath!, `${secretName}.json`);
    await fs.promises.writeFile(secretPath, JSON.stringify(secretData, null, 2), { mode: 0o600 });
    
    // Update cache
    this.cache.set(secretName, secretData);
    this.cacheExpiry.set(secretName, Date.now() + 300000); // 5 minutes
  }

  /**
   * Generate secure JWT secret
   */
  generateJWTSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Initialize production secrets
   */
  async initializeProductionSecrets(): Promise<void> {
    const requiredSecrets = [
      'JWT_SECRET',
      'REFRESH_TOKEN_SECRET',
      'DATABASE_PASSWORD',
      'REDIS_PASSWORD',
      'ENCRYPTION_KEY'
    ];

    for (const secretName of requiredSecrets) {
      try {
        await this.getSecret(secretName);
        console.log(`✅ Secret ${secretName} is configured`);
      } catch (error) {
        console.warn(`⚠️ Secret ${secretName} is not configured`);
        
        if (this.config.provider === 'file') {
          // Generate secure default for file provider
          let defaultValue: string;
          
          switch (secretName) {
            case 'JWT_SECRET':
            case 'REFRESH_TOKEN_SECRET':
              defaultValue = this.generateJWTSecret();
              break;
            case 'ENCRYPTION_KEY':
              defaultValue = crypto.randomBytes(32).toString('hex');
              break;
            default:
              defaultValue = crypto.randomBytes(32).toString('hex');
          }
          
          await this.setSecret(secretName, defaultValue);
          console.log(`✅ Generated secure default for ${secretName}`);
        }
      }
    }
  }

  /**
   * Rotate secret (generate new version)
   */
  async rotateSecret(secretName: string): Promise<void> {
    if (this.config.provider !== 'file') {
      throw new Error('Secret rotation is only supported for file provider');
    }

    const newValue = this.generateJWTSecret();
    const newVersion = `v${Date.now()}`;
    
    await this.setSecret(secretName, newValue, { version: newVersion });
    
    // Invalidate cache
    this.cache.delete(secretName);
    this.cacheExpiry.delete(secretName);
    
    console.log(`🔄 Rotated secret ${secretName} to version ${newVersion}`);
  }

  // Provider-specific implementations

  private async getFromEnvironment(secretName: string): Promise<string> {
    const value = process.env[secretName];
    if (!value) {
      throw new Error(`Environment variable ${secretName} not found`);
    }
    return value;
  }

  private async getFromAWS(secretName: string, version?: string): Promise<string> {
    // AWS Secrets Manager implementation
    // This would use AWS SDK in production
    try {
      const AWS = require('@aws-sdk/client-secrets-manager');
      const client = new AWS.SecretsManagerClient({ region: this.config.region });
      
      const params = {
        SecretId: secretName,
        VersionId: version
      };
      
      const command = new AWS.GetSecretValueCommand(params);
      const response = await client.send(command);
      
      return response.SecretString || '';
    } catch (error) {
      throw new Error(`AWS Secrets Manager error: ${error}`);
    }
  }

  private async getFromAzure(secretName: string, version?: string): Promise<string> {
    // Azure Key Vault implementation
    // This would use Azure SDK in production
    try {
      const { SecretClient } = require('@azure/keyvault-secrets');
      const { DefaultAzureCredential } = require('@azure/identity');
      
      const credential = new DefaultAzureCredential();
      const client = new SecretClient(this.config.keyVaultUrl!, credential);
      
      const secret = await client.getSecret(secretName, { version });
      return secret.value || '';
    } catch (error) {
      throw new Error(`Azure Key Vault error: ${error}`);
    }
  }

  private async getFromVault(secretName: string, version?: string): Promise<string> {
    // HashiCorp Vault implementation
    // This would use Vault API in production
    try {
      const vault = require('node-vault')({
        apiVersion: 'v1',
        endpoint: this.config.vaultUrl
      });
      
      const result = await vault.read(`secret/data/${secretName}`);
      return result.data.data.value;
    } catch (error) {
      throw new Error(`HashiCorp Vault error: ${error}`);
    }
  }

  private async getFromFile(secretName: string): Promise<string> {
    const secretPath = path.join(this.config.secretsPath!, `${secretName}.json`);
    
    if (!fs.existsSync(secretPath)) {
      throw new Error(`Secret file not found: ${secretPath}`);
    }

    const secretData = JSON.parse(await fs.promises.readFile(secretPath, 'utf8'));
    
    // Check expiration
    if (secretData.expiresAt && new Date(secretData.expiresAt) < new Date()) {
      throw new Error(`Secret ${secretName} has expired`);
    }

    // Decrypt if needed
    return secretData.value.startsWith('enc:') ? 
      this.decrypt(secretData.value.substring(4)) : 
      secretData.value;
  }

  // Utility methods

  private isValidCached(secretName: string): boolean {
    const expiry = this.cacheExpiry.get(secretName);
    if (!expiry || expiry < Date.now()) {
      this.cache.delete(secretName);
      this.cacheExpiry.delete(secretName);
      return false;
    }
    return this.cache.has(secretName);
  }

  private encrypt(value: string): string {
    if (!this.config.encryptionKey) {
      return value; // No encryption if no key
    }
    
    const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `enc:${encrypted}`;
  }

  private decrypt(encryptedValue: string): string {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key required for decryption');
    }
    
    const decipher = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);
    let decrypted = decipher.update(encryptedValue, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private ensureSecretsDirectory(): void {
    if (this.config.secretsPath && !fs.existsSync(this.config.secretsPath)) {
      fs.mkdirSync(this.config.secretsPath, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; provider: string; cached: number }> {
    try {
      // Test secret retrieval
      await this.getSecret('JWT_SECRET', { useCache: false });
      
      return {
        status: 'healthy',
        provider: this.config.provider,
        cached: this.cache.size
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.config.provider,
        cached: this.cache.size
      };
    }
  }
}

export default SecretsManagerService;