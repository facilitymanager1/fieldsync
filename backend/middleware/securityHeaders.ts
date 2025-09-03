import { Request, Response, NextFunction } from 'express';

export interface SecurityHeadersConfig {
  // Content Security Policy
  csp: {
    enabled: boolean;
    directives: Record<string, string[]>;
    reportUri?: string;
    reportOnly?: boolean;
  };
  
  // HTTP Strict Transport Security
  hsts: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  
  // Cross-Origin policies
  crossOrigin: {
    embedderPolicy: 'unsafe-none' | 'require-corp' | 'credentialless';
    openerPolicy: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';
    resourcePolicy: 'same-site' | 'same-origin' | 'cross-origin';
  };
  
  // Frame options
  frameOptions: 'DENY' | 'SAMEORIGIN' | string;
  
  // Referrer Policy
  referrerPolicy: string[];
  
  // Permissions Policy
  permissionsPolicy: Record<string, string[]>;
  
  // Custom headers
  customHeaders: Record<string, string>;
  
  // Feature flags
  features: {
    noSniff: boolean;
    xssProtection: boolean;
    dnsPrefetchControl: boolean;
    downloadOptions: boolean;
    originAgentCluster: boolean;
  };
}

class SecurityHeaders {
  private config: SecurityHeadersConfig;

  constructor(config?: Partial<SecurityHeadersConfig>) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    this.config = {
      csp: {
        enabled: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https:'],
          'img-src': ["'self'", 'data:', 'https:', 'blob:'],
          'font-src': ["'self'", 'https:', 'data:'],
          'connect-src': ["'self'", 'https:', 'wss:', 'ws:'],
          'media-src': ["'self'", 'https:', 'blob:'],
          'object-src': ["'none'"],
          'child-src': ["'self'"],
          'worker-src': ["'self'", 'blob:'],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'base-uri': ["'self'"],
          'manifest-src': ["'self'"]
        },
        reportUri: process.env.CSP_REPORT_URI,
        reportOnly: !isProduction
      },
      
      hsts: {
        enabled: isProduction,
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      
      crossOrigin: {
        embedderPolicy: isProduction ? 'require-corp' : 'unsafe-none',
        openerPolicy: 'same-origin',
        resourcePolicy: 'cross-origin'
      },
      
      frameOptions: 'DENY',
      
      referrerPolicy: ['no-referrer', 'strict-origin-when-cross-origin'],
      
      permissionsPolicy: {
        'accelerometer': ["'none'"],
        'ambient-light-sensor': ["'none'"],
        'autoplay': ["'self'"],
        'battery': ["'none'"],
        'camera': ["'self'"],
        'cross-origin-isolated': ["'none'"],
        'display-capture': ["'none'"],
        'document-domain': ["'none'"],
        'encrypted-media': ["'none'"],
        'execution-while-not-rendered': ["'none'"],
        'execution-while-out-of-viewport': ["'none'"],
        'fullscreen': ["'self'"],
        'geolocation': ["'self'"],
        'gyroscope': ["'none'"],
        'keyboard-map': ["'none'"],
        'magnetometer': ["'none'"],
        'microphone': ["'self'"],
        'midi': ["'none'"],
        'navigation-override': ["'none'"],
        'payment': ["'none'"],
        'picture-in-picture': ["'none'"],
        'publickey-credentials-get': ["'self'"],
        'screen-wake-lock': ["'none'"],
        'sync-xhr': ["'none'"],
        'usb': ["'none'"],
        'web-share': ["'self'"],
        'xr-spatial-tracking': ["'none'"]
      },
      
      customHeaders: {
        'X-Powered-By': '', // Remove this header
        'Server': '', // Remove server information
        'X-Request-ID': '', // Will be set dynamically
        'X-Response-Time': '', // Will be set dynamically
        'X-Content-Type-Options': 'nosniff',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Expect-CT': isProduction ? 'max-age=86400, enforce' : '',
        'Feature-Policy': '', // Legacy, replaced by Permissions-Policy
        'X-UA-Compatible': 'IE=edge'
      },
      
      features: {
        noSniff: true,
        xssProtection: false, // Modern browsers don't need this
        dnsPrefetchControl: true,
        downloadOptions: true,
        originAgentCluster: true
      },
      
      ...config
    };
  }

  /**
   * Generate Content Security Policy header value
   */
  private generateCSP(): string {
    const directives = Object.entries(this.config.csp.directives)
      .map(([directive, values]) => `${directive} ${values.join(' ')}`)
      .join('; ');
    
    if (this.config.csp.reportUri) {
      return `${directives}; report-uri ${this.config.csp.reportUri}`;
    }
    
    return directives;
  }

  /**
   * Generate Permissions Policy header value
   */
  private generatePermissionsPolicy(): string {
    return Object.entries(this.config.permissionsPolicy)
      .map(([directive, values]) => `${directive}=(${values.join(' ')})`)
      .join(', ');
  }

  /**
   * Generate HSTS header value
   */
  private generateHSTS(): string {
    let hsts = `max-age=${this.config.hsts.maxAge}`;
    
    if (this.config.hsts.includeSubDomains) {
      hsts += '; includeSubDomains';
    }
    
    if (this.config.hsts.preload) {
      hsts += '; preload';
    }
    
    return hsts;
  }

  /**
   * Security headers middleware
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Remove identifying headers
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      // Content Security Policy
      if (this.config.csp.enabled) {
        const cspHeader = this.config.csp.reportOnly ? 
          'Content-Security-Policy-Report-Only' : 
          'Content-Security-Policy';
        res.setHeader(cspHeader, this.generateCSP());
      }
      
      // HTTP Strict Transport Security
      if (this.config.hsts.enabled) {
        res.setHeader('Strict-Transport-Security', this.generateHSTS());
      }
      
      // Cross-Origin policies
      res.setHeader('Cross-Origin-Embedder-Policy', this.config.crossOrigin.embedderPolicy);
      res.setHeader('Cross-Origin-Opener-Policy', this.config.crossOrigin.openerPolicy);
      res.setHeader('Cross-Origin-Resource-Policy', this.config.crossOrigin.resourcePolicy);
      
      // Frame options
      res.setHeader('X-Frame-Options', this.config.frameOptions);
      
      // Referrer Policy
      res.setHeader('Referrer-Policy', this.config.referrerPolicy.join(', '));
      
      // Permissions Policy
      res.setHeader('Permissions-Policy', this.generatePermissionsPolicy());
      
      // Feature-based headers
      if (this.config.features.noSniff) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
      
      if (this.config.features.xssProtection) {
        res.setHeader('X-XSS-Protection', '1; mode=block');
      }
      
      if (this.config.features.dnsPrefetchControl) {
        res.setHeader('X-DNS-Prefetch-Control', 'off');
      }
      
      if (this.config.features.downloadOptions) {
        res.setHeader('X-Download-Options', 'noopen');
      }
      
      if (this.config.features.originAgentCluster) {
        res.setHeader('Origin-Agent-Cluster', '?1');
      }
      
      // Custom headers
      Object.entries(this.config.customHeaders).forEach(([name, value]) => {
        if (value) {
          res.setHeader(name, value);
        }
      });
      
      // Request tracking
      const requestId = req.headers['x-request-id'] || 
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', requestId);
      
      // Response time header (set on response finish)
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        res.setHeader('X-Response-Time', `${responseTime}ms`);
      });
      
      // Security-focused cache control for sensitive endpoints
      if (req.path.includes('/auth') || req.path.includes('/admin')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
      }
      
      next();
    };
  }

  /**
   * Update CSP directives
   */
  updateCSP(directives: Partial<Record<string, string[]>>) {
    this.config.csp.directives = { ...this.config.csp.directives, ...directives };
  }

  /**
   * Add CSP nonce for inline scripts
   */
  generateNonce(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Middleware for CSP nonce
   */
  nonceMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const nonce = this.generateNonce();
      (req as any).nonce = nonce;
      (res as any).locals = { ...res.locals, nonce };
      
      // Update CSP with nonce
      const updatedCSP = this.generateCSP().replace(
        "'unsafe-inline'",
        `'nonce-${nonce}' 'unsafe-inline'`
      );
      
      const cspHeader = this.config.csp.reportOnly ? 
        'Content-Security-Policy-Report-Only' : 
        'Content-Security-Policy';
      res.setHeader(cspHeader, updatedCSP);
      
      next();
    };
  }

  /**
   * API-specific security headers
   */
  apiHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // JSON-specific headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      
      // API versioning header
      res.setHeader('API-Version', process.env.API_VERSION || '1.0.0');
      
      // Rate limit info (will be overridden by rate limiter if present)
      if (!res.getHeader('X-RateLimit-Limit')) {
        res.setHeader('X-RateLimit-Limit', '100');
        res.setHeader('X-RateLimit-Remaining', '99');
        res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + 900);
      }
      
      next();
    };
  }

  /**
   * Development-specific headers
   */
  developmentHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (process.env.NODE_ENV === 'development') {
        res.setHeader('X-Development-Mode', 'true');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
      }
      next();
    };
  }

  /**
   * Security report endpoint
   */
  reportEndpoint() {
    return (req: Request, res: Response) => {
      const report = req.body;
      const timestamp = new Date().toISOString();
      
      // Log security violations
      console.warn('Security Policy Violation:', {
        timestamp,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        report
      });
      
      // In production, you might want to send to a monitoring service
      if (process.env.NODE_ENV === 'production' && process.env.SECURITY_WEBHOOK_URL) {
        // Send to external monitoring service
        fetch(process.env.SECURITY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamp, ip: req.ip, report })
        }).catch(err => console.error('Failed to send security report:', err));
      }
      
      res.status(204).send();
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityHeadersConfig {
    return { ...this.config };
  }
}

// Export singleton instance with default configuration
export const securityHeaders = new SecurityHeaders();

// Export class for custom configurations
export default SecurityHeaders;