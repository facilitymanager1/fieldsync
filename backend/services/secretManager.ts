/**
 * Secret Management Service for FieldSync
 * Provides secure secret storage and retrieval with multiple provider support
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface SecretProvider {
  name: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

export interface SecretConfig {
  provider: 'env' | 'file' | 'aws' | 'azure' | 'vault';
  encryption?: {
    enabled: boolean;
    algorithm: string;
    keyPath?: string;
  };
  aws?: {
    region: string;
    secretsManagerEndpoint?: string;
  };
  azure?: {
    vaultUrl: string;
    clientId?: string;
    clientSecret?: string;
  };
  vault?: {
    endpoint: string;
    token?: string;
    mountPath: string;
  };
  file?: {
    path: string;
  };
}

/**
 * Environment Variable Provider
 */
export class EnvProvider implements SecretProvider {
  name = 'environment';

  async get(key: string): Promise<string | null> {
    return process.env[key] || null;
  }

  async set(key: string, value: string): Promise<void> {
    process.env[key] = value;
  }

  async delete(key: string): Promise<void> {
    delete process.env[key];
  }

  async list(): Promise<string[]> {
    return Object.keys(process.env);
  }
}

/**
 * File-based Provider with encryption
 */
export class FileProvider implements SecretProvider {
  name = 'file';
  private filePath: string;
  private encryptionKey?: Buffer;

  constructor(config: SecretConfig) {
    this.filePath = config.file?.path || path.join(process.cwd(), '.secrets.json');
    
    if (config.encryption?.enabled && config.encryption.keyPath) {
      try {
        this.encryptionKey = fs.readFileSync(config.encryption.keyPath);
      } catch (error) {
        console.warn('Encryption key not found, generating new one...');
        this.generateEncryptionKey(config.encryption.keyPath);
      }
    }
  }

  private generateEncryptionKey(keyPath: string): void {
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key);
    fs.chmodSync(keyPath, 0o600); // Read/write for owner only
    this.encryptionKey = key;
    console.log(`Generated new encryption key at ${keyPath}`);
  }

  private encrypt(text: string): string {
    if (!this.encryptionKey) return text;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    if (!this.encryptionKey) return encryptedText;
    
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !encrypted) return encryptedText;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async loadSecrets(): Promise<Record<string, string>> {
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  private async saveSecrets(secrets: Record<string, string>): Promise<void> {
    const dirPath = path.dirname(this.filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(this.filePath, JSON.stringify(secrets, null, 2));
    fs.chmodSync(this.filePath, 0o600); // Read/write for owner only
  }

  async get(key: string): Promise<string | null> {
    const secrets = await this.loadSecrets();
    const value = secrets[key];
    return value ? this.decrypt(value) : null;
  }

  async set(key: string, value: string): Promise<void> {
    const secrets = await this.loadSecrets();
    secrets[key] = this.encrypt(value);
    await this.saveSecrets(secrets);
  }

  async delete(key: string): Promise<void> {
    const secrets = await this.loadSecrets();
    delete secrets[key];
    await this.saveSecrets(secrets);
  }

  async list(): Promise<string[]> {
    const secrets = await this.loadSecrets();
    return Object.keys(secrets);
  }
}

/**
 * AWS Secrets Manager Provider
 */
export class AWSProvider implements SecretProvider {
  name = 'aws-secrets-manager';
  private client: any;

  constructor(config: SecretConfig) {
    try {
      // Dynamic import to avoid requiring AWS SDK if not used
      const AWS = require('aws-sdk');
      this.client = new AWS.SecretsManager({
        region: config.aws?.region || 'us-east-1',
        endpoint: config.aws?.secretsManagerEndpoint
      });
    } catch (error) {
      throw new Error('AWS SDK not installed. Run: npm install aws-sdk');
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const result = await this.client.getSecretValue({ SecretId: key }).promise();
      return result.SecretString || null;
    } catch (error: any) {
      if (error.code === 'ResourceNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.client.updateSecret({
        SecretId: key,
        SecretString: value
      }).promise();
    } catch (error: any) {
      if (error.code === 'ResourceNotFoundException') {
        await this.client.createSecret({
          Name: key,
          SecretString: value
        }).promise();
      } else {
        throw error;
      }
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.deleteSecret({
      SecretId: key,
      ForceDeleteWithoutRecovery: true
    }).promise();
  }

  async list(): Promise<string[]> {
    const result = await this.client.listSecrets().promise();
    return result.SecretList.map((secret: any) => secret.Name);
  }
}

/**
 * Azure Key Vault Provider
 */
export class AzureProvider implements SecretProvider {
  name = 'azure-key-vault';
  private client: any;

  constructor(config: SecretConfig) {
    try {
      const { SecretClient } = require('@azure/keyvault-secrets');
      const { DefaultAzureCredential } = require('@azure/identity');
      
      this.client = new SecretClient(
        config.azure?.vaultUrl || '',
        new DefaultAzureCredential()
      );
    } catch (error) {
      throw new Error('Azure SDK not installed. Run: npm install @azure/keyvault-secrets @azure/identity');
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const secret = await this.client.getSecret(key);
      return secret.value || null;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.setSecret(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.client.beginDeleteSecret(key);
  }

  async list(): Promise<string[]> {
    const secrets = [];
    for await (const secret of this.client.listPropertiesOfSecrets()) {
      secrets.push(secret.name);
    }
    return secrets;
  }
}

/**
 * HashiCorp Vault Provider
 */
export class VaultProvider implements SecretProvider {
  name = 'hashicorp-vault';
  private endpoint: string;
  private token: string;
  private mountPath: string;

  constructor(config: SecretConfig) {
    this.endpoint = config.vault?.endpoint || 'http://localhost:8200';
    this.token = config.vault?.token || process.env.VAULT_TOKEN || '';
    this.mountPath = config.vault?.mountPath || 'secret';
  }

  private async makeRequest(method: string, path: string, data?: any): Promise<any> {
    const url = `${this.endpoint}/v1/${this.mountPath}/${path}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'X-Vault-Token': this.token,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Vault request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async get(key: string): Promise<string | null> {
    try {
      const result = await this.makeRequest('GET', `data/${key}`);
      return result?.data?.data?.[key] || null;
    } catch (error) {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.makeRequest('POST', `data/${key}`, { data: { [key]: value } });
  }

  async delete(key: string): Promise<void> {
    await this.makeRequest('DELETE', `data/${key}`);
  }

  async list(): Promise<string[]> {
    try {
      const result = await this.makeRequest('LIST', 'metadata');
      return result?.data?.keys || [];
    } catch (error) {
      return [];
    }
  }
}

/**
 * Main Secret Manager Service
 */
export class SecretManager {
  private provider: SecretProvider;
  private cache = new Map<string, { value: string; expiry: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(config: SecretConfig) {
    this.provider = this.createProvider(config);
  }

  private createProvider(config: SecretConfig): SecretProvider {
    switch (config.provider) {
      case 'env':
        return new EnvProvider();
      case 'file':
        return new FileProvider(config);
      case 'aws':
        return new AWSProvider(config);
      case 'azure':
        return new AzureProvider(config);
      case 'vault':
        return new VaultProvider(config);
      default:
        throw new Error(`Unsupported secret provider: ${config.provider}`);
    }
  }

  async getSecret(key: string, useCache = true): Promise<string | null> {
    // Check cache first
    if (useCache) {
      const cached = this.cache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.value;
      }
    }

    const value = await this.provider.get(key);
    
    // Cache the result
    if (value && useCache) {
      this.cache.set(key, {
        value,
        expiry: Date.now() + this.cacheTimeout
      });
    }

    return value;
  }

  async setSecret(key: string, value: string): Promise<void> {
    await this.provider.set(key, value);
    
    // Update cache
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.cacheTimeout
    });
  }

  async deleteSecret(key: string): Promise<void> {
    await this.provider.delete(key);
    this.cache.delete(key);
  }

  async listSecrets(): Promise<string[]> {
    return this.provider.list();
  }

  async rotateSecret(key: string, generator?: () => string): Promise<string> {
    const newValue = generator ? generator() : crypto.randomBytes(32).toString('hex');
    await this.setSecret(key, newValue);
    return newValue;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getProviderInfo(): { name: string; provider: string } {
    return {
      name: this.provider.name,
      provider: this.provider.constructor.name
    };
  }
}

// Default configuration
const defaultConfig: SecretConfig = {
  provider: (process.env.SECRET_PROVIDER as any) || 'env',
  encryption: {
    enabled: process.env.SECRET_ENCRYPTION === 'true',
    algorithm: 'aes-256-gcm',
    keyPath: process.env.SECRET_ENCRYPTION_KEY_PATH || './secrets.key'
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1'
  },
  azure: {
    vaultUrl: process.env.AZURE_KEY_VAULT_URL || ''
  },
  vault: {
    endpoint: process.env.VAULT_ENDPOINT || 'http://localhost:8200',
    token: process.env.VAULT_TOKEN,
    mountPath: process.env.VAULT_MOUNT_PATH || 'secret'
  },
  file: {
    path: process.env.SECRET_FILE_PATH || './.secrets.json'
  }
};

// Export singleton instance
export const secretManager = new SecretManager(defaultConfig);

// Export helper functions
export async function getSecret(key: string): Promise<string | null> {
  return secretManager.getSecret(key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  return secretManager.setSecret(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  return secretManager.deleteSecret(key);
}

export async function rotateSecret(key: string, generator?: () => string): Promise<string> {
  return secretManager.rotateSecret(key, generator);
}

export default SecretManager;