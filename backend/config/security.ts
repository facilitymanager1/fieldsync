/**
 * Security Configuration Module
 * Centralized security settings and configurations for FieldSync
 */

export interface SecurityConfig {
  jwt: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    issuer: string;
    audience: string;
  };
  
  password: {
    saltRounds: number;
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  
  session: {
    maxLoginAttempts: number;
    lockoutDuration: number; // in milliseconds
    sessionTimeout: number; // in milliseconds
    maxConcurrentSessions: number;
  };
  
  rateLimiting: {
    general: {
      windowMs: number;
      maxRequests: number;
    };
    login: {
      windowMs: number;
      maxRequests: number;
    };
    api: {
      windowMs: number;
      maxRequests: number;
    };
    strict: {
      windowMs: number;
      maxRequests: number;
    };
  };
  
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
  };
  
  headers: {
    contentSecurityPolicy: string;
    crossOriginEmbedderPolicy: string;
    crossOriginOpenerPolicy: string;
    crossOriginResourcePolicy: string;
    originAgentCluster: string;
    referrerPolicy: string;
    strictTransportSecurity: string;
    xContentTypeOptions: string;
    xDnsPrefetchControl: string;
    xDownloadOptions: string;
    xFrameOptions: string;
    xPermittedCrossDomainPolicies: string;
    xXssProtection: string;
  };
}

// Environment-based configuration
const getSecurityConfig = (): SecurityConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    jwt: {
      accessTokenSecret: process.env.JWT_SECRET || (isDevelopment ? 'dev_access_secret' : 'changeme'),
      refreshTokenSecret: process.env.REFRESH_SECRET || (isDevelopment ? 'dev_refresh_secret' : 'changeme_refresh'),
      accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
      refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
      issuer: process.env.JWT_ISSUER || 'fieldsync',
      audience: process.env.JWT_AUDIENCE || 'fieldsync-users'
    },
    
    password: {
      saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
      minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
      requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE === 'true',
      requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE === 'true',
      requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS === 'true',
      requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL === 'true'
    },
    
    session: {
      maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
      lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || (2 * 60 * 60 * 1000).toString()), // 2 hours
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || (24 * 60 * 60 * 1000).toString()), // 24 hours
      maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5')
    },
    
    rateLimiting: {
      general: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || (15 * 60 * 1000).toString()), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || (isProduction ? '100' : '1000'))
      },
      login: {
        windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW || (15 * 60 * 1000).toString()), // 15 minutes
        maxRequests: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '5')
      },
      api: {
        windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW || (60 * 1000).toString()), // 1 minute
        maxRequests: parseInt(process.env.API_RATE_LIMIT_MAX || (isProduction ? '60' : '1000'))
      },
      strict: {
        windowMs: parseInt(process.env.STRICT_RATE_LIMIT_WINDOW || (15 * 60 * 1000).toString()), // 15 minutes
        maxRequests: parseInt(process.env.STRICT_RATE_LIMIT_MAX || (isProduction ? '50' : '500'))
      }
    },
    
    encryption: {
      algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      keyLength: parseInt(process.env.ENCRYPTION_KEY_LENGTH || '32'),
      ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH || '16')
    },
    
    headers: {
      contentSecurityPolicy: process.env.CSP_POLICY || 
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; media-src 'self'; object-src 'none'; child-src 'none'; worker-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self';",
      crossOriginEmbedderPolicy: isProduction ? 'require-corp' : 'unsafe-none',
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'cross-origin',
      originAgentCluster: '?1',
      referrerPolicy: 'no-referrer',
      strictTransportSecurity: isProduction ? 'max-age=31536000; includeSubDomains; preload' : 'max-age=0',
      xContentTypeOptions: 'nosniff',
      xDnsPrefetchControl: 'off',
      xDownloadOptions: 'noopen',
      xFrameOptions: 'DENY',
      xPermittedCrossDomainPolicies: 'none',
      xXssProtection: '0'
    }
  };
};

export const securityConfig = getSecurityConfig();

/**
 * Validate security configuration
 */
export const validateSecurityConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const config = securityConfig;

  // JWT validation
  if (!config.jwt.accessTokenSecret || config.jwt.accessTokenSecret === 'changeme') {
    errors.push('JWT_SECRET must be set to a secure random value');
  }
  
  if (!config.jwt.refreshTokenSecret || config.jwt.refreshTokenSecret === 'changeme_refresh') {
    errors.push('REFRESH_SECRET must be set to a secure random value');
  }

  if (config.jwt.accessTokenSecret === config.jwt.refreshTokenSecret) {
    errors.push('Access token and refresh token secrets must be different');
  }

  // Password validation
  if (config.password.saltRounds < 10) {
    errors.push('Password salt rounds should be at least 10 for security');
  }

  if (config.password.minLength < 8) {
    errors.push('Password minimum length should be at least 8 characters');
  }

  // Session validation
  if (config.session.maxLoginAttempts < 3) {
    errors.push('Max login attempts should be at least 3');
  }

  if (config.session.lockoutDuration < 60000) { // 1 minute
    errors.push('Lockout duration should be at least 1 minute');
  }

  // Rate limiting validation
  if (config.rateLimiting.login.maxRequests > 10) {
    errors.push('Login rate limit should not exceed 10 attempts per window');
  }

  // Environment-specific validations
  if (process.env.NODE_ENV === 'production') {
    if (config.jwt.accessTokenSecret.length < 32) {
      errors.push('JWT secret should be at least 32 characters in production');
    }
    
    if (config.jwt.refreshTokenSecret.length < 32) {
      errors.push('Refresh token secret should be at least 32 characters in production');
    }
    
    if (config.jwt.accessTokenSecret.includes('changeme') || config.jwt.refreshTokenSecret.includes('changeme')) {
      errors.push('Default secrets must be changed in production');
    }
    
    if (!config.headers.strictTransportSecurity.includes('max-age')) {
      errors.push('HSTS header must be properly configured in production');
    }
    
    if (config.password.saltRounds < 12) {
      errors.push('Password salt rounds should be at least 12 in production');
    }
    
    if (!process.env.REDIS_PASSWORD && process.env.NODE_ENV === 'production') {
      errors.push('Redis password should be set in production');
    }
    
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.includes('localhost')) {
      errors.push('CORS origins should not include localhost in production');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generate secure random secrets for development
 */
export const generateSecrets = () => {
  const crypto = require('crypto');
  
  return {
    jwtSecret: crypto.randomBytes(64).toString('hex'),
    refreshSecret: crypto.randomBytes(64).toString('hex'),
    encryptionKey: crypto.randomBytes(32).toString('hex')
  };
};

/**
 * Security middleware configuration helper
 */
export const getSecurityMiddlewareConfig = () => {
  const config = securityConfig;
  
  return {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https:"],
          connectSrc: ["'self'", "https:"],
          mediaSrc: ["'self'"],
          objectSrc: ["'none'"],
          childSrc: ["'none'"],
          workerSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          baseUri: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: { policy: config.headers.crossOriginEmbedderPolicy as any },
      crossOriginOpenerPolicy: { policy: config.headers.crossOriginOpenerPolicy as any },
      crossOriginResourcePolicy: { policy: config.headers.crossOriginResourcePolicy as any },
      originAgentCluster: true,
      referrerPolicy: { policy: config.headers.referrerPolicy as any },
      strictTransportSecurity: {
        maxAge: process.env.NODE_ENV === 'production' ? 31536000 : 0,
        includeSubDomains: true,
        preload: true
      },
      xContentTypeOptions: false, // We'll set it manually
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: false,
      xFrameOptions: { action: 'deny' },
      xPermittedCrossDomainPolicies: false,
      xXssProtection: false // Modern browsers don't need this
    },
    
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID', 'X-Request-ID']
    }
  };
};

export default securityConfig;