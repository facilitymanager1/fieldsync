import crypto from 'crypto';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  keyDerivation: {
    iterations: number;
    saltLength: number;
    digest: string;
  };
}

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  salt: string;
  tag: string;
}

export interface FieldEncryptionOptions {
  fields: string[];
  excludeFromQuery: boolean;
  enableSearchable: boolean;
}

class EncryptionService {
  private config: EncryptionConfig;
  private masterKey: Buffer;

  constructor() {
    this.config = {
      algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      keyLength: parseInt(process.env.ENCRYPTION_KEY_LENGTH || '32'),
      ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH || '16'),
      tagLength: 16,
      keyDerivation: {
        iterations: parseInt(process.env.PBKDF2_ITERATIONS || '100000'),
        saltLength: parseInt(process.env.SALT_LENGTH || '32'),
        digest: process.env.KEY_DERIVATION_DIGEST || 'sha256'
      }
    };

    this.initializeMasterKey();
  }

  private initializeMasterKey() {
    const keySource = process.env.ENCRYPTION_MASTER_KEY;
    
    if (!keySource) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_MASTER_KEY must be set in production');
      }
      // Generate a key for development
      this.masterKey = crypto.randomBytes(this.config.keyLength);
      console.warn('⚠️ Using generated encryption key for development. Set ENCRYPTION_MASTER_KEY in production.');
    } else {
      // Derive key from provided secret
      this.masterKey = crypto.scryptSync(keySource, 'fieldsync-salt', this.config.keyLength);
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string, context?: string): EncryptionResult {
    try {
      const iv = crypto.randomBytes(this.config.ivLength);
      const salt = crypto.randomBytes(this.config.keyDerivation.saltLength);
      
      // Derive encryption key with context
      const derivedKey = this.deriveKey(salt, context);
      
      const cipher = crypto.createCipher(this.config.algorithm, derivedKey);
      cipher.setAAD(Buffer.from(context || 'fieldsync'));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptionResult: EncryptionResult, context?: string): string {
    try {
      const { encryptedData, iv, salt, tag } = encryptionResult;
      
      // Derive the same key used for encryption
      const derivedKey = this.deriveKey(Buffer.from(salt, 'hex'), context);
      
      const decipher = crypto.createDecipher(this.config.algorithm, derivedKey);
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      decipher.setAAD(Buffer.from(context || 'fieldsync'));
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Derive encryption key from master key and salt
   */
  private deriveKey(salt: Buffer, context?: string): Buffer {
    const info = context ? `fieldsync:${context}` : 'fieldsync';
    return crypto.pbkdf2Sync(
      this.masterKey,
      salt,
      this.config.keyDerivation.iterations,
      this.config.keyLength,
      this.config.keyDerivation.digest
    );
  }

  /**
   * Create searchable hash for encrypted fields
   */
  createSearchableHash(plaintext: string): string {
    const hash = crypto.createHmac('sha256', this.masterKey);
    hash.update(plaintext.toLowerCase().trim());
    return hash.digest('hex');
  }

  /**
   * Encrypt multiple fields in an object
   */
  encryptFields(obj: any, fields: string[], context?: string): any {
    const result = { ...obj };
    
    fields.forEach(field => {
      if (result[field] && typeof result[field] === 'string') {
        const encrypted = this.encrypt(result[field], `${context}:${field}`);
        result[`${field}_encrypted`] = encrypted;
        result[`${field}_hash`] = this.createSearchableHash(result[field]);
        delete result[field]; // Remove plaintext
      }
    });
    
    return result;
  }

  /**
   * Decrypt multiple fields in an object
   */
  decryptFields(obj: any, fields: string[], context?: string): any {
    const result = { ...obj };
    
    fields.forEach(field => {
      const encryptedField = `${field}_encrypted`;
      if (result[encryptedField]) {
        try {
          result[field] = this.decrypt(result[encryptedField], `${context}:${field}`);
          delete result[encryptedField]; // Remove encrypted data from result
          delete result[`${field}_hash`]; // Remove hash from result
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          // Keep encrypted field in case of error
        }
      }
    });
    
    return result;
  }

  /**
   * File encryption for uploads
   */
  encryptFile(buffer: Buffer, filename: string): EncryptionResult {
    const plaintext = buffer.toString('base64');
    return this.encrypt(plaintext, `file:${filename}`);
  }

  /**
   * File decryption for downloads
   */
  decryptFile(encryptionResult: EncryptionResult, filename: string): Buffer {
    const plaintext = this.decrypt(encryptionResult, `file:${filename}`);
    return Buffer.from(plaintext, 'base64');
  }

  /**
   * Generate key rotation token
   */
  generateRotationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Key rotation - encrypt with new key, decrypt with old
   */
  rotateEncryption(encryptedData: EncryptionResult, oldContext: string, newContext: string): EncryptionResult {
    const plaintext = this.decrypt(encryptedData, oldContext);
    return this.encrypt(plaintext, newContext);
  }

  /**
   * Secure random token generation
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Password-based encryption for user data
   */
  encryptWithPassword(plaintext: string, password: string): EncryptionResult {
    const salt = crypto.randomBytes(this.config.keyDerivation.saltLength);
    const key = crypto.pbkdf2Sync(
      password,
      salt,
      this.config.keyDerivation.iterations,
      this.config.keyLength,
      this.config.keyDerivation.digest
    );

    const iv = crypto.randomBytes(this.config.ivLength);
    const cipher = crypto.createCipher(this.config.algorithm, key);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Password-based decryption
   */
  decryptWithPassword(encryptionResult: EncryptionResult, password: string): string {
    const { encryptedData, iv, salt, tag } = encryptionResult;
    
    const key = crypto.pbkdf2Sync(
      password,
      Buffer.from(salt, 'hex'),
      this.config.keyDerivation.iterations,
      this.config.keyLength,
      this.config.keyDerivation.digest
    );

    const decipher = crypto.createDecipher(this.config.algorithm, key);
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get encryption configuration
   */
  getConfig(): EncryptionConfig {
    return { ...this.config };
  }

  /**
   * Health check for encryption service
   */
  healthCheck(): boolean {
    try {
      const testData = 'encryption-health-check';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      return decrypted === testData;
    } catch (error) {
      return false;
    }
  }
}

export default new EncryptionService();