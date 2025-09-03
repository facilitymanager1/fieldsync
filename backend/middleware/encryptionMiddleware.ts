import { Request, Response, NextFunction } from 'express';
import encryptionService from '../services/encryptionService';

export interface EncryptionMiddlewareConfig {
  sensitiveFields: string[];
  encryptFiles: boolean;
  enableFieldEncryption: boolean;
  context: string;
}

class EncryptionMiddleware {
  private config: EncryptionMiddlewareConfig;

  constructor(config?: Partial<EncryptionMiddlewareConfig>) {
    this.config = {
      sensitiveFields: [
        'password',
        'ssn',
        'aadhaar',
        'pan',
        'dob',
        'phone',
        'email',
        'address',
        'bankAccount',
        'creditCard',
        'personalNotes'
      ],
      encryptFiles: true,
      enableFieldEncryption: true,
      context: 'api',
      ...config
    };
  }

  /**
   * Middleware to encrypt sensitive fields in request body
   */
  encryptRequest(fields?: string[]) {
    const fieldsToEncrypt = fields || this.config.sensitiveFields;
    
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableFieldEncryption) {
        return next();
      }

      try {
        if (req.body && typeof req.body === 'object') {
          req.body = encryptionService.encryptFields(
            req.body,
            fieldsToEncrypt,
            `${this.config.context}:${req.path}`
          );
        }
        next();
      } catch (error) {
        console.error('Request encryption error:', error);
        res.status(500).json({
          error: 'Request processing failed',
          code: 'ENCRYPTION_ERROR'
        });
      }
    };
  }

  /**
   * Middleware to decrypt sensitive fields in response data
   */
  decryptResponse(fields?: string[]) {
    const fieldsToDecrypt = fields || this.config.sensitiveFields;
    
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableFieldEncryption) {
        return next();
      }

      const originalJson = res.json.bind(res);
      
      res.json = function(data: any) {
        try {
          if (data && typeof data === 'object') {
            // Handle arrays of objects
            if (Array.isArray(data)) {
              data = data.map(item => 
                encryptionService.decryptFields(
                  item,
                  fieldsToDecrypt,
                  `${this.config.context}:${req.path}`
                )
              );
            } else {
              data = encryptionService.decryptFields(
                data,
                fieldsToDecrypt,
                `${this.config.context}:${req.path}`
              );
            }
          }
        } catch (error) {
          console.error('Response decryption error:', error);
          // Return original data if decryption fails
        }
        
        return originalJson(data);
      }.bind(this);
      
      next();
    };
  }

  /**
   * File encryption middleware for uploads
   */
  encryptFileUploads() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.encryptFiles) {
        return next();
      }

      try {
        // Handle single file
        if (req.file) {
          const encrypted = encryptionService.encryptFile(
            req.file.buffer,
            req.file.originalname
          );
          
          (req.file as any).encryptedData = encrypted;
          (req.file as any).isEncrypted = true;
        }

        // Handle multiple files
        if (req.files) {
          const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
          
          files.forEach(file => {
            if (file.buffer) {
              const encrypted = encryptionService.encryptFile(
                file.buffer,
                file.originalname
              );
              
              (file as any).encryptedData = encrypted;
              (file as any).isEncrypted = true;
            }
          });
        }

        next();
      } catch (error) {
        console.error('File encryption error:', error);
        res.status(500).json({
          error: 'File processing failed',
          code: 'FILE_ENCRYPTION_ERROR'
        });
      }
    };
  }

  /**
   * File decryption middleware for downloads
   */
  decryptFileDownloads() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.encryptFiles) {
        return next();
      }

      const originalSend = res.send.bind(res);
      
      res.send = function(data: any) {
        try {
          // Check if this is encrypted file data
          if (data && data.encryptedData && data.filename) {
            const decryptedBuffer = encryptionService.decryptFile(
              data.encryptedData,
              data.filename
            );
            return originalSend(decryptedBuffer);
          }
        } catch (error) {
          console.error('File decryption error:', error);
          // Return original data if decryption fails
        }
        
        return originalSend(data);
      };
      
      next();
    };
  }

  /**
   * Middleware for user-specific encryption context
   */
  userEncryptionContext() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (user) {
        this.config.context = `user:${user.id}`;
      }
      next();
    };
  }

  /**
   * Selective field encryption for different routes
   */
  selectiveEncryption(routeConfig: Record<string, string[]>) {
    return (req: Request, res: Response, next: NextFunction) => {
      const route = req.route?.path || req.path;
      const fieldsForRoute = routeConfig[route];
      
      if (fieldsForRoute && req.body) {
        req.body = encryptionService.encryptFields(
          req.body,
          fieldsForRoute,
          `${this.config.context}:${route}`
        );
      }
      
      next();
    };
  }

  /**
   * Database model encryption hooks
   */
  static createModelHooks(schema: any, options: { fields: string[], context: string }) {
    // Pre-save hook to encrypt fields
    schema.pre('save', function(next: any) {
      try {
        const doc = this;
        options.fields.forEach(field => {
          if (doc[field] && !doc[`${field}_encrypted`]) {
            const encrypted = encryptionService.encrypt(
              doc[field],
              `${options.context}:${field}`
            );
            doc[`${field}_encrypted`] = encrypted;
            doc[`${field}_hash`] = encryptionService.createSearchableHash(doc[field]);
            doc[field] = undefined; // Remove plaintext
          }
        });
        next();
      } catch (error) {
        next(error);
      }
    });

    // Post-find hooks to decrypt fields
    schema.post(['find', 'findOne', 'findOneAndUpdate'], function(docs: any) {
      if (!docs) return;
      
      const decryptDoc = (doc: any) => {
        options.fields.forEach(field => {
          const encryptedField = `${field}_encrypted`;
          if (doc[encryptedField]) {
            try {
              doc[field] = encryptionService.decrypt(
                doc[encryptedField],
                `${options.context}:${field}`
              );
              delete doc[encryptedField];
              delete doc[`${field}_hash`];
            } catch (error) {
              console.error(`Failed to decrypt field ${field}:`, error);
            }
          }
        });
      };

      if (Array.isArray(docs)) {
        docs.forEach(decryptDoc);
      } else {
        decryptDoc(docs);
      }
    });

    // Enable searching by encrypted fields
    schema.statics.findByEncryptedField = function(field: string, value: string) {
      const hash = encryptionService.createSearchableHash(value);
      return this.find({ [`${field}_hash`]: hash });
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<EncryptionMiddlewareConfig>) {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): EncryptionMiddlewareConfig {
    return { ...this.config };
  }
}

export default EncryptionMiddleware;