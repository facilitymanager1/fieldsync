import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Redis } from 'ioredis';

export interface CSRFConfig {
  secret: string;
  tokenLength: number;
  sessionTimeout: number; // in milliseconds
  ignoreMethods: string[];
  cookieName: string;
  headerName: string;
  sameSite: 'strict' | 'lax' | 'none';
  secure: boolean;
  httpOnly: boolean;
}

export interface CSRFRequest extends Request {
  csrfToken?: () => string;
  csrfSecret?: string;
  sessionID?: string;
}

class CSRFProtection {
  private redis: Redis | null = null;
  private memoryStore = new Map<string, { secret: string; createdAt: number }>();
  private config: CSRFConfig;

  constructor(config?: Partial<CSRFConfig>) {
    this.config = {
      secret: process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex'),
      tokenLength: 32,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
      cookieName: '_csrf',
      headerName: 'x-csrf-token',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      ...config
    };

    this.initializeRedis();
  }

  private initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
      } else {
        this.redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: 3
        });
      }
      
      this.redis.on('error', (error) => {
        console.error('Redis connection error for CSRF protection:', error);
        this.redis = null;
      });
    } catch (error) {
      console.warn('Redis not available for CSRF protection, using memory store');
      this.redis = null;
    }
  }

  /**
   * Generate CSRF token pair (secret + token)
   */
  private generateTokenPair(): { secret: string; token: string } {
    const secret = crypto.randomBytes(this.config.tokenLength).toString('hex');
    const token = this.hashToken(secret);
    return { secret, token };
  }

  /**
   * Hash token with secret
   */
  private hashToken(secret: string): string {
    return crypto
      .createHmac('sha256', this.config.secret)
      .update(secret)
      .digest('hex');
  }

  /**
   * Verify CSRF token
   */
  private verifyToken(secret: string, token: string): boolean {
    try {
      const expectedToken = this.hashToken(secret);
      return crypto.timingSafeEqual(
        Buffer.from(token, 'hex'),
        Buffer.from(expectedToken, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Store CSRF secret
   */
  private async storeSecret(sessionId: string, secret: string): Promise<void> {
    const data = {
      secret,
      createdAt: Date.now()
    };

    if (this.redis) {
      try {
        await this.redis.setex(
          `csrf:${sessionId}`,
          Math.floor(this.config.sessionTimeout / 1000),
          JSON.stringify(data)
        );
      } catch (error) {
        console.error('Error storing CSRF secret in Redis:', error);
        // Fallback to memory store
        this.memoryStore.set(sessionId, data);
      }
    } else {
      this.memoryStore.set(sessionId, data);
      
      // Clean up memory store after timeout
      setTimeout(() => {
        this.memoryStore.delete(sessionId);
      }, this.config.sessionTimeout);
    }
  }

  /**
   * Retrieve CSRF secret
   */
  private async getSecret(sessionId: string): Promise<string | null> {
    if (this.redis) {
      try {
        const data = await this.redis.get(`csrf:${sessionId}`);
        if (data) {
          const parsed = JSON.parse(data);
          return parsed.secret;
        }
      } catch (error) {
        console.error('Error retrieving CSRF secret from Redis:', error);
      }
    }

    // Fallback to memory store
    const data = this.memoryStore.get(sessionId);
    if (data) {
      // Check if expired
      if (Date.now() - data.createdAt > this.config.sessionTimeout) {
        this.memoryStore.delete(sessionId);
        return null;
      }
      return data.secret;
    }

    return null;
  }

  /**
   * Get session ID from request
   */
  private getSessionId(req: CSRFRequest): string {
    // Try to get session ID from various sources
    const sessionId = 
      req.sessionID ||
      req.headers['x-session-id'] as string ||
      req.cookies?.sessionId ||
      req.ip ||
      'anonymous';
    
    return sessionId;
  }

  /**
   * CSRF protection middleware
   */
  middleware() {
    return async (req: CSRFRequest, res: Response, next: NextFunction) => {
      try {
        const method = req.method.toUpperCase();
        
        // Skip CSRF protection for safe methods
        if (this.config.ignoreMethods.includes(method)) {
          await this.generateTokenForRequest(req, res);
          return next();
        }

        // For state-changing methods, verify CSRF token
        const sessionId = this.getSessionId(req);
        const storedSecret = await this.getSecret(sessionId);

        if (!storedSecret) {
          return res.status(403).json({
            error: 'CSRF token missing or expired',
            code: 'CSRF_TOKEN_MISSING'
          });
        }

        // Get token from header or body
        const token = 
          req.headers[this.config.headerName] as string ||
          req.body?._csrf ||
          req.query?._csrf as string;

        if (!token) {
          return res.status(403).json({
            error: 'CSRF token required',
            code: 'CSRF_TOKEN_REQUIRED'
          });
        }

        // Verify token
        if (!this.verifyToken(storedSecret, token)) {
          return res.status(403).json({
            error: 'Invalid CSRF token',
            code: 'CSRF_TOKEN_INVALID'
          });
        }

        // Token is valid, regenerate for next request
        await this.generateTokenForRequest(req, res);
        next();

      } catch (error) {
        console.error('CSRF protection error:', error);
        res.status(500).json({
          error: 'CSRF protection error',
          code: 'CSRF_INTERNAL_ERROR'
        });
      }
    };
  }

  /**
   * Generate token for request
   */
  private async generateTokenForRequest(req: CSRFRequest, res: Response): Promise<void> {
    const sessionId = this.getSessionId(req);
    const { secret, token } = this.generateTokenPair();
    
    // Store secret
    await this.storeSecret(sessionId, secret);
    
    // Set cookie
    res.cookie(this.config.cookieName, token, {
      httpOnly: this.config.httpOnly,
      secure: this.config.secure,
      sameSite: this.config.sameSite,
      maxAge: this.config.sessionTimeout
    });

    // Add token generator function to request
    req.csrfToken = () => token;
    req.csrfSecret = secret;

    // Add token to response headers for SPA
    res.setHeader('X-CSRF-Token', token);
  }

  /**
   * Get CSRF token endpoint
   */
  tokenEndpoint() {
    return async (req: CSRFRequest, res: Response) => {
      try {
        await this.generateTokenForRequest(req, res);
        
        res.json({
          csrfToken: req.csrfToken?.() || '',
          message: 'CSRF token generated'
        });
      } catch (error) {
        console.error('Error generating CSRF token:', error);
        res.status(500).json({
          error: 'Failed to generate CSRF token'
        });
      }
    };
  }

  /**
   * Double submit cookie pattern for SPA
   */
  doubleSubmitCookie() {
    return async (req: CSRFRequest, res: Response, next: NextFunction) => {
      try {
        const method = req.method.toUpperCase();
        
        // Skip for safe methods
        if (this.config.ignoreMethods.includes(method)) {
          return next();
        }

        // Get token from cookie and header
        const cookieToken = req.cookies?.[this.config.cookieName];
        const headerToken = req.headers[this.config.headerName] as string;

        if (!cookieToken || !headerToken) {
          return res.status(403).json({
            error: 'CSRF tokens required',
            code: 'CSRF_DOUBLE_SUBMIT_MISSING'
          });
        }

        // Tokens must match
        if (!crypto.timingSafeEqual(
          Buffer.from(cookieToken, 'hex'),
          Buffer.from(headerToken, 'hex')
        )) {
          return res.status(403).json({
            error: 'CSRF token mismatch',
            code: 'CSRF_DOUBLE_SUBMIT_MISMATCH'
          });
        }

        next();
      } catch (error) {
        console.error('Double submit CSRF error:', error);
        res.status(500).json({
          error: 'CSRF validation error'
        });
      }
    };
  }

  /**
   * Clean up expired tokens
   */
  async cleanup(): Promise<number> {
    let cleanedCount = 0;

    if (this.redis) {
      try {
        const keys = await this.redis.keys('csrf:*');
        if (keys.length > 0) {
          const pipeline = this.redis.pipeline();
          keys.forEach(key => pipeline.del(key));
          await pipeline.exec();
          cleanedCount = keys.length;
        }
      } catch (error) {
        console.error('Error cleaning up CSRF tokens from Redis:', error);
      }
    }

    // Clean up memory store
    const now = Date.now();
    for (const [key, data] of this.memoryStore) {
      if (now - data.createdAt > this.config.sessionTimeout) {
        this.memoryStore.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}

// Export singleton instance with default configuration
export const csrfProtection = new CSRFProtection();

// Export class for custom configurations
export default CSRFProtection;