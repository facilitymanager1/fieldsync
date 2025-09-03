/**
 * Session Cache Service
 * Specialized caching service for user sessions, authentication tokens, and user data
 */

import cacheService from './cacheService';
import loggingService from './loggingService';
import { monitoring } from './monitoringService';

// Session cache keys
const CACHE_KEYS = {
  USER_SESSION: 'session:user:',
  USER_PROFILE: 'profile:user:',
  USER_PERMISSIONS: 'permissions:user:',
  REFRESH_TOKEN: 'token:refresh:',
  ACCESS_TOKEN_BLACKLIST: 'blacklist:access:',
  RATE_LIMIT: 'ratelimit:',
  USER_PREFERENCES: 'preferences:user:',
  ACTIVE_SHIFTS: 'shifts:active:user:',
  USER_SITES: 'sites:user:',
} as const;

// Cache TTL values (in seconds)
const TTL = {
  SESSION: 1800,        // 30 minutes
  PROFILE: 3600,        // 1 hour
  PERMISSIONS: 1800,    // 30 minutes
  REFRESH_TOKEN: 86400 * 7, // 7 days
  BLACKLIST: 3600,      // 1 hour
  RATE_LIMIT: 900,      // 15 minutes
  PREFERENCES: 7200,    // 2 hours
  ACTIVE_SHIFTS: 300,   // 5 minutes
  USER_SITES: 1800,     // 30 minutes
} as const;

interface UserSession {
  userId: string;
  email: string;
  role: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  tokenId?: string;
}

interface UserProfile {
  userId: string;
  email: string;
  role: string;
  profile: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    department?: string;
    avatar?: string;
  };
  preferences: Record<string, any>;
  isActive: boolean;
  lastLogin?: Date;
}

interface UserPermissions {
  userId: string;
  role: string;
  permissions: string[];
  accessLevels: Record<string, string>;
  restrictions: string[];
  lastUpdated: Date;
}

interface RateLimitData {
  count: number;
  resetTime: number;
  windowStart: number;
}

/**
 * Session Cache Service for managing user sessions and related data
 */
export class SessionCacheService {
  
  /**
   * Set user session data
   */
  async setUserSession(userId: string, sessionData: UserSession): Promise<boolean> {
    try {
      const timer = monitoring.startTimer('session_cache_set_duration');
      const success = await cacheService.set(
        `${CACHE_KEYS.USER_SESSION}${userId}`,
        sessionData,
        TTL.SESSION
      );
      timer();

      if (success) {
        monitoring.incrementCounter('session_cache_operations_total', 1, {
          operation: 'set_session',
          status: 'success'
        });
        loggingService.debug('User session cached', { userId, sessionId: sessionData.tokenId });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to cache user session', error, { userId });
      monitoring.incrementCounter('session_cache_operations_total', 1, {
        operation: 'set_session',
        status: 'error'
      });
      return false;
    }
  }

  /**
   * Get user session data
   */
  async getUserSession(userId: string): Promise<UserSession | null> {
    try {
      const timer = monitoring.startTimer('session_cache_get_duration');
      const session = await cacheService.get<UserSession>(`${CACHE_KEYS.USER_SESSION}${userId}`);
      timer();

      monitoring.incrementCounter('session_cache_operations_total', 1, {
        operation: 'get_session',
        status: session ? 'hit' : 'miss'
      });

      return session;
    } catch (error) {
      loggingService.error('Failed to get user session', error, { userId });
      monitoring.incrementCounter('session_cache_operations_total', 1, {
        operation: 'get_session',
        status: 'error'
      });
      return null;
    }
  }

  /**
   * Update session last activity
   */
  async updateSessionActivity(userId: string): Promise<boolean> {
    try {
      const session = await this.getUserSession(userId);
      if (!session) {
        return false;
      }

      session.lastActivity = new Date();
      return await this.setUserSession(userId, session);
    } catch (error) {
      loggingService.error('Failed to update session activity', error, { userId });
      return false;
    }
  }

  /**
   * Remove user session
   */
  async removeUserSession(userId: string): Promise<boolean> {
    try {
      const success = await cacheService.del(`${CACHE_KEYS.USER_SESSION}${userId}`);
      
      monitoring.incrementCounter('session_cache_operations_total', 1, {
        operation: 'remove_session',
        status: success ? 'success' : 'error'
      });

      if (success) {
        loggingService.debug('User session removed from cache', { userId });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to remove user session', error, { userId });
      return false;
    }
  }

  /**
   * Set user profile cache
   */
  async setUserProfile(userId: string, profile: UserProfile): Promise<boolean> {
    try {
      const success = await cacheService.set(
        `${CACHE_KEYS.USER_PROFILE}${userId}`,
        profile,
        TTL.PROFILE
      );

      if (success) {
        loggingService.debug('User profile cached', { userId });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to cache user profile', error, { userId });
      return false;
    }
  }

  /**
   * Get user profile from cache
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      return await cacheService.get<UserProfile>(`${CACHE_KEYS.USER_PROFILE}${userId}`);
    } catch (error) {
      loggingService.error('Failed to get user profile', error, { userId });
      return null;
    }
  }

  /**
   * Set user permissions cache
   */
  async setUserPermissions(userId: string, permissions: UserPermissions): Promise<boolean> {
    try {
      const success = await cacheService.set(
        `${CACHE_KEYS.USER_PERMISSIONS}${userId}`,
        permissions,
        TTL.PERMISSIONS
      );

      if (success) {
        loggingService.debug('User permissions cached', { userId, role: permissions.role });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to cache user permissions', error, { userId });
      return false;
    }
  }

  /**
   * Get user permissions from cache
   */
  async getUserPermissions(userId: string): Promise<UserPermissions | null> {
    try {
      return await cacheService.get<UserPermissions>(`${CACHE_KEYS.USER_PERMISSIONS}${userId}`);
    } catch (error) {
      loggingService.error('Failed to get user permissions', error, { userId });
      return null;
    }
  }

  /**
   * Cache refresh token
   */
  async setRefreshToken(tokenId: string, tokenData: any): Promise<boolean> {
    try {
      const success = await cacheService.set(
        `${CACHE_KEYS.REFRESH_TOKEN}${tokenId}`,
        tokenData,
        TTL.REFRESH_TOKEN
      );

      if (success) {
        loggingService.debug('Refresh token cached', { tokenId });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to cache refresh token', error, { tokenId });
      return false;
    }
  }

  /**
   * Get refresh token from cache
   */
  async getRefreshToken(tokenId: string): Promise<any | null> {
    try {
      return await cacheService.get(`${CACHE_KEYS.REFRESH_TOKEN}${tokenId}`);
    } catch (error) {
      loggingService.error('Failed to get refresh token', error, { tokenId });
      return null;
    }
  }

  /**
   * Remove refresh token from cache
   */
  async removeRefreshToken(tokenId: string): Promise<boolean> {
    try {
      const success = await cacheService.del(`${CACHE_KEYS.REFRESH_TOKEN}${tokenId}`);
      
      if (success) {
        loggingService.debug('Refresh token removed from cache', { tokenId });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to remove refresh token', error, { tokenId });
      return false;
    }
  }

  /**
   * Blacklist access token
   */
  async blacklistAccessToken(tokenId: string, expiresAt: Date): Promise<boolean> {
    try {
      const ttl = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      const success = await cacheService.set(
        `${CACHE_KEYS.ACCESS_TOKEN_BLACKLIST}${tokenId}`,
        { blacklistedAt: new Date() },
        ttl
      );

      if (success) {
        loggingService.debug('Access token blacklisted', { tokenId, ttl });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to blacklist access token', error, { tokenId });
      return false;
    }
  }

  /**
   * Check if access token is blacklisted
   */
  async isAccessTokenBlacklisted(tokenId: string): Promise<boolean> {
    try {
      const result = await cacheService.exists(`${CACHE_KEYS.ACCESS_TOKEN_BLACKLIST}${tokenId}`);
      return result;
    } catch (error) {
      loggingService.error('Failed to check token blacklist', error, { tokenId });
      return false;
    }
  }

  /**
   * Set rate limit data
   */
  async setRateLimit(key: string, data: RateLimitData): Promise<boolean> {
    try {
      const success = await cacheService.set(
        `${CACHE_KEYS.RATE_LIMIT}${key}`,
        data,
        TTL.RATE_LIMIT
      );

      return success;
    } catch (error) {
      loggingService.error('Failed to set rate limit', error, { key });
      return false;
    }
  }

  /**
   * Get rate limit data
   */
  async getRateLimit(key: string): Promise<RateLimitData | null> {
    try {
      return await cacheService.get<RateLimitData>(`${CACHE_KEYS.RATE_LIMIT}${key}`);
    } catch (error) {
      loggingService.error('Failed to get rate limit', error, { key });
      return null;
    }
  }

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(key: string): Promise<number> {
    try {
      const rateLimitKey = `${CACHE_KEYS.RATE_LIMIT}${key}`;
      return await cacheService.incr(rateLimitKey, 1);
    } catch (error) {
      loggingService.error('Failed to increment rate limit', error, { key });
      return 0;
    }
  }

  /**
   * Cache user preferences
   */
  async setUserPreferences(userId: string, preferences: Record<string, any>): Promise<boolean> {
    try {
      const success = await cacheService.set(
        `${CACHE_KEYS.USER_PREFERENCES}${userId}`,
        preferences,
        TTL.PREFERENCES
      );

      if (success) {
        loggingService.debug('User preferences cached', { userId });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to cache user preferences', error, { userId });
      return false;
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<Record<string, any> | null> {
    try {
      return await cacheService.get(`${CACHE_KEYS.USER_PREFERENCES}${userId}`);
    } catch (error) {
      loggingService.error('Failed to get user preferences', error, { userId });
      return null;
    }
  }

  /**
   * Cache active shifts for user
   */
  async setActiveShifts(userId: string, shifts: any[]): Promise<boolean> {
    try {
      const success = await cacheService.set(
        `${CACHE_KEYS.ACTIVE_SHIFTS}${userId}`,
        shifts,
        TTL.ACTIVE_SHIFTS
      );

      if (success) {
        loggingService.debug('Active shifts cached', { userId, shiftsCount: shifts.length });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to cache active shifts', error, { userId });
      return false;
    }
  }

  /**
   * Get active shifts for user
   */
  async getActiveShifts(userId: string): Promise<any[] | null> {
    try {
      return await cacheService.get(`${CACHE_KEYS.ACTIVE_SHIFTS}${userId}`);
    } catch (error) {
      loggingService.error('Failed to get active shifts', error, { userId });
      return null;
    }
  }

  /**
   * Cache user sites access
   */
  async setUserSites(userId: string, sites: any[]): Promise<boolean> {
    try {
      const success = await cacheService.set(
        `${CACHE_KEYS.USER_SITES}${userId}`,
        sites,
        TTL.USER_SITES
      );

      if (success) {
        loggingService.debug('User sites cached', { userId, sitesCount: sites.length });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to cache user sites', error, { userId });
      return false;
    }
  }

  /**
   * Get user sites access
   */
  async getUserSites(userId: string): Promise<any[] | null> {
    try {
      return await cacheService.get(`${CACHE_KEYS.USER_SITES}${userId}`);
    } catch (error) {
      loggingService.error('Failed to get user sites', error, { userId });
      return null;
    }
  }

  /**
   * Clear all user-related cache
   */
  async clearUserCache(userId: string): Promise<boolean> {
    try {
      const promises = [
        this.removeUserSession(userId),
        cacheService.del(`${CACHE_KEYS.USER_PROFILE}${userId}`),
        cacheService.del(`${CACHE_KEYS.USER_PERMISSIONS}${userId}`),
        cacheService.del(`${CACHE_KEYS.USER_PREFERENCES}${userId}`),
        cacheService.del(`${CACHE_KEYS.ACTIVE_SHIFTS}${userId}`),
        cacheService.del(`${CACHE_KEYS.USER_SITES}${userId}`)
      ];

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      loggingService.info('User cache cleared', { 
        userId, 
        clearedCount: successCount, 
        totalCount: promises.length 
      });

      monitoring.incrementCounter('session_cache_operations_total', 1, {
        operation: 'clear_user_cache',
        status: successCount === promises.length ? 'success' : 'partial'
      });

      return successCount === promises.length;
    } catch (error) {
      loggingService.error('Failed to clear user cache', error, { userId });
      return false;
    }
  }

  /**
   * Invalidate permissions cache for role
   */
  async invalidateRolePermissions(role: string): Promise<boolean> {
    try {
      // This would require a more sophisticated approach in production
      // For now, we'll clear all permission cache
      const pattern = `${CACHE_KEYS.USER_PERMISSIONS}*`;
      const success = await cacheService.clear(pattern);

      if (success) {
        loggingService.info('Role permissions cache invalidated', { role });
      }

      return success;
    } catch (error) {
      loggingService.error('Failed to invalidate role permissions', error, { role });
      return false;
    }
  }

  /**
   * Get session cache statistics
   */
  async getCacheStats(): Promise<{
    metrics: any;
    health: any;
  }> {
    try {
      const [metrics, health] = await Promise.all([
        cacheService.getMetrics(),
        cacheService.healthCheck()
      ]);

      return { metrics, health };
    } catch (error) {
      loggingService.error('Failed to get cache stats', error);
      return {
        metrics: null,
        health: { redis: false, fallback: true, metrics: null }
      };
    }
  }

  /**
   * Warm up user cache with essential data
   */
  async warmupUserCache(userId: string, userData: {
    profile?: UserProfile;
    permissions?: UserPermissions;
    preferences?: Record<string, any>;
    sites?: any[];
  }): Promise<boolean> {
    try {
      const promises: Promise<boolean>[] = [];

      if (userData.profile) {
        promises.push(this.setUserProfile(userId, userData.profile));
      }

      if (userData.permissions) {
        promises.push(this.setUserPermissions(userId, userData.permissions));
      }

      if (userData.preferences) {
        promises.push(this.setUserPreferences(userId, userData.preferences));
      }

      if (userData.sites) {
        promises.push(this.setUserSites(userId, userData.sites));
      }

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      loggingService.debug('User cache warmed up', { 
        userId, 
        successCount, 
        totalCount: promises.length 
      });

      return successCount === promises.length;
    } catch (error) {
      loggingService.error('Failed to warm up user cache', error, { userId });
      return false;
    }
  }
}

// Export singleton instance
export const sessionCacheService = new SessionCacheService();
export default sessionCacheService;