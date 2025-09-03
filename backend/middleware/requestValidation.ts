import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

export interface ValidationConfig {
  sanitizeInput: boolean;
  maxBodySize: number;
  allowedContentTypes: string[];
  maxHeaderSize: number;
  maxQueryParams: number;
  maxUrlLength: number;
  blockedUserAgents: RegExp[];
  allowedOrigins: string[];
  requireHttps: boolean;
}

export interface SanitizationOptions {
  removeNullBytes: boolean;
  trimWhitespace: boolean;
  normalizeUnicode: boolean;
  removeControlChars: boolean;
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectDepth: number;
}

class RequestValidation {
  private config: ValidationConfig;
  private sanitizationOptions: SanitizationOptions;

  constructor(config?: Partial<ValidationConfig>) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    this.config = {
      sanitizeInput: true,
      maxBodySize: 10 * 1024 * 1024, // 10MB
      allowedContentTypes: [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/plain',
        'application/xml'
      ],
      maxHeaderSize: 16 * 1024, // 16KB
      maxQueryParams: 50,
      maxUrlLength: 2048,
      blockedUserAgents: [
        /sqlmap/i,
        /nikto/i,
        /nessus/i,
        /masscan/i,
        /nmap/i,
        /zap/i,
        /burp/i,
        /dirbuster/i,
        /gobuster/i,
        /hydra/i
      ],
      allowedOrigins: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      requireHttps: isProduction,
      ...config
    };

    this.sanitizationOptions = {
      removeNullBytes: true,
      trimWhitespace: true,
      normalizeUnicode: true,
      removeControlChars: true,
      maxStringLength: 10000,
      maxArrayLength: 1000,
      maxObjectDepth: 10
    };
  }

  /**
   * Basic request validation middleware
   */
  basicValidation() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // URL length validation
        if (req.url.length > this.config.maxUrlLength) {
          return res.status(414).json({
            error: 'Request URL too long',
            code: 'URL_TOO_LONG'
          });
        }

        // Query parameters count validation
        const queryParamCount = Object.keys(req.query).length;
        if (queryParamCount > this.config.maxQueryParams) {
          return res.status(400).json({
            error: 'Too many query parameters',
            code: 'TOO_MANY_QUERY_PARAMS'
          });
        }

        // Content-Type validation for non-GET requests
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
          const contentType = req.headers['content-type'];
          if (contentType && !this.config.allowedContentTypes.some(type => 
            contentType.toLowerCase().includes(type.toLowerCase())
          )) {
            return res.status(415).json({
              error: 'Unsupported content type',
              code: 'UNSUPPORTED_CONTENT_TYPE'
            });
          }
        }

        // User-Agent validation
        const userAgent = req.headers['user-agent'] || '';
        if (this.config.blockedUserAgents.some(pattern => pattern.test(userAgent))) {
          return res.status(403).json({
            error: 'Blocked user agent',
            code: 'BLOCKED_USER_AGENT'
          });
        }

        // HTTPS requirement in production
        if (this.config.requireHttps && !req.secure && req.headers['x-forwarded-proto'] !== 'https') {
          return res.status(403).json({
            error: 'HTTPS required',
            code: 'HTTPS_REQUIRED'
          });
        }

        // Origin validation for POST/PUT/DELETE requests
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
          const origin = req.headers.origin || req.headers.referer;
          if (origin && !this.config.allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            return res.status(403).json({
              error: 'Invalid origin',
              code: 'INVALID_ORIGIN'
            });
          }
        }

        next();
      } catch (error) {
        console.error('Basic validation error:', error);
        res.status(500).json({
          error: 'Request validation failed',
          code: 'VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Input sanitization middleware
   */
  sanitization() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.sanitizeInput) {
        return next();
      }

      try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeObject(req.body, 0);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
          req.query = this.sanitizeObject(req.query, 0);
        }

        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
          req.params = this.sanitizeObject(req.params, 0);
        }

        next();
      } catch (error) {
        console.error('Sanitization error:', error);
        res.status(400).json({
          error: 'Invalid input data',
          code: 'SANITIZATION_ERROR'
        });
      }
    };
  }

  /**
   * Recursively sanitize object
   */
  private sanitizeObject(obj: any, depth: number): any {
    if (depth > this.sanitizationOptions.maxObjectDepth) {
      throw new Error('Object depth limit exceeded');
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      if (obj.length > this.sanitizationOptions.maxArrayLength) {
        throw new Error('Array length limit exceeded');
      }
      return obj.map(item => this.sanitizeObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value, depth + 1);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize string value
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    let sanitized = str;

    // Length limit
    if (sanitized.length > this.sanitizationOptions.maxStringLength) {
      sanitized = sanitized.substring(0, this.sanitizationOptions.maxStringLength);
    }

    // Remove null bytes
    if (this.sanitizationOptions.removeNullBytes) {
      sanitized = sanitized.replace(/\0/g, '');
    }

    // Remove control characters (except newlines and tabs)
    if (this.sanitizationOptions.removeControlChars) {
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    // Normalize unicode
    if (this.sanitizationOptions.normalizeUnicode) {
      sanitized = sanitized.normalize('NFC');
    }

    // Trim whitespace
    if (this.sanitizationOptions.trimWhitespace) {
      sanitized = sanitized.trim();
    }

    return sanitized;
  }

  /**
   * Express-validator integration
   */
  handleValidationErrors() {
    return (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_FAILED',
          details: errors.array().map(error => ({
            field: error.type === 'field' ? (error as any).path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? (error as any).value : undefined
          }))
        });
      }

      next();
    };
  }

  /**
   * File upload validation
   */
  fileUploadValidation(options?: {
    maxFileSize?: number;
    allowedMimeTypes?: string[];
    maxFiles?: number;
  }) {
    const config = {
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      maxFiles: 10,
      ...options
    };

    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.files && !req.file) {
        return next();
      }

      try {
        const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
        
        // Check file count
        if (files.length > config.maxFiles) {
          return res.status(400).json({
            error: 'Too many files',
            code: 'TOO_MANY_FILES',
            maxFiles: config.maxFiles
          });
        }

        // Validate each file
        for (const file of files) {
          if (!file) continue;

          // File size validation
          if (file.size > config.maxFileSize) {
            return res.status(413).json({
              error: 'File too large',
              code: 'FILE_TOO_LARGE',
              filename: file.originalname || 'unknown',
              maxSize: config.maxFileSize
            });
          }

          // MIME type validation
          if (!config.allowedMimeTypes.includes(file.mimetype)) {
            return res.status(415).json({
              error: 'Unsupported file type',
              code: 'UNSUPPORTED_FILE_TYPE',
              filename: file.originalname || 'unknown',
              mimeType: file.mimetype,
              allowedTypes: config.allowedMimeTypes
            });
          }

          // Filename validation
          const filename = file.originalname || '';
          if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({
              error: 'Invalid filename',
              code: 'INVALID_FILENAME',
              filename
            });
          }
        }

        next();
      } catch (error) {
        console.error('File upload validation error:', error);
        res.status(500).json({
          error: 'File validation failed',
          code: 'FILE_VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * JSON schema validation middleware
   */
  jsonSchemaValidation(schema: object) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Basic JSON schema validation would go here
        // For now, we'll do basic type checking
        
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
          if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({
              error: 'Invalid JSON body',
              code: 'INVALID_JSON'
            });
          }
        }

        next();
      } catch (error) {
        console.error('JSON schema validation error:', error);
        res.status(400).json({
          error: 'Schema validation failed',
          code: 'SCHEMA_VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * Rate limit bypass detection
   */
  rateLimitBypassDetection() {
    return (req: Request, res: Response, next: NextFunction) => {
      const suspiciousHeaders = [
        'x-originating-ip',
        'x-forwarded-for',
        'x-remote-ip',
        'x-remote-addr',
        'x-cluster-client-ip',
        'x-real-ip',
        'cf-connecting-ip'
      ];

      const headerCount = suspiciousHeaders.filter(header => req.headers[header]).length;
      
      // If multiple IP headers are present, it might be an attempt to bypass rate limiting
      if (headerCount > 2) {
        console.warn('Potential rate limit bypass attempt:', {
          ip: req.ip,
          headers: Object.fromEntries(
            suspiciousHeaders.map(h => [h, req.headers[h]]).filter(([,v]) => v)
          ),
          userAgent: req.headers['user-agent']
        });
        
        // Log but don't block - could be legitimate proxy setup
      }

      next();
    };
  }

  /**
   * Get validation configuration
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ValidationConfig>) {
    this.config = { ...this.config, ...updates };
  }
}

// Export singleton instance
export const requestValidation = new RequestValidation();

// Export class for custom configurations
export default RequestValidation;