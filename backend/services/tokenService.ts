import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Redis } from 'ioredis';
import sessionCacheService from './sessionCacheService';
import SecretsManagerService from './secretsManagerService';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

export interface AccessTokenPayload {
  id: string;
  email: string;
  role: string;
  type: 'access';
  tokenId: string;
  iat: number;
  exp: number;
}

class TokenService {
  private redis: Redis | null = null;
  private readonly ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
  private secretsManager: SecretsManagerService;
  private jwtSecret: string | null = null;
  private refreshSecret: string | null = null;

  constructor() {
    this.secretsManager = SecretsManagerService.getInstance();
    this.initializeRedis();
    this.initializeSecrets();
  }

  private async initializeSecrets() {
    try {
      // Initialize production secrets
      await this.secretsManager.initializeProductionSecrets();
      
      // Cache secrets for performance
      this.jwtSecret = await this.secretsManager.getSecret('JWT_SECRET');
      this.refreshSecret = await this.secretsManager.getSecret('REFRESH_TOKEN_SECRET');
      
      console.log('✅ JWT secrets initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize JWT secrets:', error);
      
      // Fallback to environment variables with warning
      this.jwtSecret = process.env.JWT_SECRET || 'changeme';
      this.refreshSecret = process.env.REFRESH_SECRET || 'refresh_secret';
      
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ Using fallback JWT secrets in production - THIS IS NOT SECURE!');
      }
    }
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
        console.error('Redis connection error:', error);
        this.redis = null;
      });
    } catch (error) {
      console.warn('Redis not available, falling back to memory storage');
      this.redis = null;
    }
  }

  /**
   * Generate access and refresh token pair
   */
  async generateTokenPair(user: {
    id: string;
    email: string;
    role: string;
    deviceId?: string;
    userAgent?: string;
  }): Promise<TokenPair> {
    const tokenId = crypto.randomUUID();
    const now = new Date();
    
    // Access token (short-lived)
    const accessTokenPayload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
      id: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      tokenId
    };

    const accessToken = jwt.sign(accessTokenPayload, this.jwtSecret!, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'fieldsync',
      audience: 'fieldsync-users'
    });

    // Refresh token (long-lived)
    const refreshTokenPayload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      userId: user.id,
      tokenId,
      type: 'refresh'
    };

    const refreshToken = jwt.sign(refreshTokenPayload, this.refreshSecret!, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'fieldsync',
      audience: 'fieldsync-users'
    });

    // Calculate expiry dates
    const accessTokenExpiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
    const refreshTokenExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store refresh token metadata
    await this.storeRefreshToken(tokenId, {
      userId: user.id,
      deviceId: user.deviceId,
      userAgent: user.userAgent,
      createdAt: now,
      expiresAt: refreshTokenExpiresAt,
      isRevoked: false
    });

    // Cache refresh token in session cache
    await sessionCacheService.setRefreshToken(tokenId, {
      userId: user.id,
      deviceId: user.deviceId,
      userAgent: user.userAgent,
      createdAt: now,
      expiresAt: refreshTokenExpiresAt,
      isRevoked: false
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret!, {
        issuer: 'fieldsync',
        audience: 'fieldsync-users'
      }) as AccessTokenPayload;

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const decoded = jwt.verify(token, this.refreshSecret!, {
        issuer: 'fieldsync',
        audience: 'fieldsync-users'
      }) as RefreshTokenPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if token is revoked
      const tokenData = await this.getRefreshToken(decoded.tokenId);
      if (!tokenData || tokenData.isRevoked) {
        throw new Error('Refresh token revoked');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, user: {
    id: string;
    email: string;
    role: string;
  }): Promise<{ accessToken: string; accessTokenExpiresAt: Date }> {
    const decoded = await this.verifyRefreshToken(refreshToken);
    
    if (decoded.userId !== user.id) {
      throw new Error('Token user mismatch');
    }

    // Generate new access token with same tokenId
    const accessTokenPayload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
      id: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      tokenId: decoded.tokenId
    };

    const accessToken = jwt.sign(accessTokenPayload, this.jwtSecret!, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'fieldsync',
      audience: 'fieldsync-users'
    });

    const accessTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return { accessToken, accessTokenExpiresAt };
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(tokenId: string): Promise<void> {
    if (this.redis) {
      await this.redis.hset(`refresh_token:${tokenId}`, 'isRevoked', 'true');
    }
    
    // Remove from session cache
    await sessionCacheService.removeRefreshToken(tokenId);
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.keys(`refresh_token:*`);
      for (const key of keys) {
        const tokenData = await this.redis.hgetall(key);
        if (tokenData.userId === userId) {
          await this.redis.hset(key, 'isRevoked', 'true');
        }
      }
    }
  }

  /**
   * Get user's active refresh tokens
   */
  async getUserActiveTokens(userId: string): Promise<Array<{
    tokenId: string;
    deviceId?: string;
    userAgent?: string;
    createdAt: Date;
    expiresAt: Date;
  }>> {
    if (!this.redis) return [];

    const keys = await this.redis.keys(`refresh_token:*`);
    const activeTokens = [];

    for (const key of keys) {
      const tokenData = await this.redis.hgetall(key);
      if (tokenData.userId === userId && tokenData.isRevoked !== 'true') {
        activeTokens.push({
          tokenId: key.replace('refresh_token:', ''),
          deviceId: tokenData.deviceId,
          userAgent: tokenData.userAgent,
          createdAt: new Date(tokenData.createdAt),
          expiresAt: new Date(tokenData.expiresAt)
        });
      }
    }

    return activeTokens;
  }

  /**
   * Store refresh token metadata
   */
  private async storeRefreshToken(tokenId: string, data: {
    userId: string;
    deviceId?: string;
    userAgent?: string;
    createdAt: Date;
    expiresAt: Date;
    isRevoked: boolean;
  }): Promise<void> {
    if (this.redis) {
      const key = `refresh_token:${tokenId}`;
      await this.redis.hmset(key, {
        userId: data.userId,
        deviceId: data.deviceId || '',
        userAgent: data.userAgent || '',
        createdAt: data.createdAt.toISOString(),
        expiresAt: data.expiresAt.toISOString(),
        isRevoked: data.isRevoked.toString()
      });
      
      // Set expiry for automatic cleanup
      await this.redis.expireat(key, Math.floor(data.expiresAt.getTime() / 1000));
    }
  }

  /**
   * Get refresh token metadata
   */
  private async getRefreshToken(tokenId: string): Promise<{
    userId: string;
    deviceId?: string;
    userAgent?: string;
    createdAt: Date;
    expiresAt: Date;
    isRevoked: boolean;
  } | null> {
    if (!this.redis) return null;

    const key = `refresh_token:${tokenId}`;
    const data = await this.redis.hgetall(key);
    
    if (!data.userId) return null;

    return {
      userId: data.userId,
      deviceId: data.deviceId || undefined,
      userAgent: data.userAgent || undefined,
      createdAt: new Date(data.createdAt),
      expiresAt: new Date(data.expiresAt),
      isRevoked: data.isRevoked === 'true'
    };
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    if (!this.redis) return 0;

    const keys = await this.redis.keys(`refresh_token:*`);
    let cleanedCount = 0;

    for (const key of keys) {
      const tokenData = await this.redis.hgetall(key);
      if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
        await this.redis.del(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}

export default new TokenService();