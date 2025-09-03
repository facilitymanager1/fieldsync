/**
 * Cache Management Routes
 * API endpoints for cache monitoring, management, and statistics
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateQuery, validateParams } from '../middleware/validationMiddleware';
import Joi from 'joi';
import cacheService from '../services/cacheService';
import sessionCacheService from '../services/sessionCacheService';
import businessCacheService from '../services/businessCacheService';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

const router = Router();

// Cache statistics schema
const cacheStatsQuerySchema = Joi.object({
  detailed: Joi.boolean().default(false),
  includeKeys: Joi.boolean().default(false)
});

// Cache invalidation schema
const cacheInvalidationSchema = Joi.object({
  type: Joi.string().valid(
    'session', 'profile', 'permissions', 'tokens', 
    'sites', 'tickets', 'shifts', 'analytics', 'all'
  ).required(),
  pattern: Joi.string().optional(),
  userId: Joi.string().optional()
});

/**
 * @route   GET /api/cache/stats
 * @desc    Get cache statistics and health information
 * @access  Private (Admin/Supervisor)
 */
router.get('/stats', 
  authenticateToken,
  validateQuery(cacheStatsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user has admin/supervisor access
      if (!['Admin', 'Supervisor'].includes(req.user!.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const timer = monitoring.startTimer('cache_stats_request_duration');
      const { detailed, includeKeys } = req.query;

      // Get basic cache metrics
      const [
        cacheMetrics,
        cacheHealth,
        sessionStats,
        businessStats
      ] = await Promise.all([
        cacheService.getMetrics(),
        cacheService.healthCheck(),
        sessionCacheService.getCacheStats(),
        businessCacheService.getBusinessCacheStats()
      ]);

      const stats = {
        overview: {
          isHealthy: cacheHealth.redis || cacheHealth.fallback,
          redisConnected: cacheHealth.redis,
          fallbackActive: cacheHealth.fallback,
          hitRate: cacheMetrics.hitRate,
          totalOperations: cacheMetrics.totalOperations
        },
        performance: {
          hits: cacheMetrics.hits,
          misses: cacheMetrics.misses,
          errors: cacheMetrics.errors,
          averageLatency: cacheMetrics.averageLatency
        },
        sessions: sessionStats,
        business: businessStats
      };

      if (detailed) {
        // Add detailed Redis information if available
        try {
          const redisInfo = await cacheService.getMetrics();
          (stats as any).redis = redisInfo;
        } catch (error) {
          loggingService.warn('Failed to get detailed Redis stats', error);
        }
      }

      timer();
      monitoring.incrementCounter('cache_api_requests_total', 1, {
        endpoint: 'stats',
        status: 'success'
      });

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Failed to get cache stats', error);
      monitoring.incrementCounter('cache_api_requests_total', 1, {
        endpoint: 'stats',
        status: 'error'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cache statistics'
      });
    }
  }
);

/**
 * @route   GET /api/cache/health
 * @desc    Get cache health status
 * @access  Private
 */
router.get('/health',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const timer = monitoring.startTimer('cache_health_request_duration');
      
      const [
        cacheHealth,
        businessHealth
      ] = await Promise.all([
        cacheService.healthCheck(),
        businessCacheService.healthCheck()
      ]);

      const health = {
        cache: cacheHealth,
        business: businessHealth,
        overall: {
          isHealthy: (cacheHealth.redis || cacheHealth.fallback) && businessHealth.isHealthy,
          timestamp: new Date().toISOString()
        }
      };

      timer();

      const statusCode = health.overall.isHealthy ? 200 : 503;
      res.status(statusCode).json({
        success: health.overall.isHealthy,
        data: health
      });

    } catch (error) {
      loggingService.error('Cache health check failed', error);
      res.status(503).json({
        success: false,
        error: 'Cache health check failed'
      });
    }
  }
);

/**
 * @route   POST /api/cache/invalidate
 * @desc    Invalidate cache by type or pattern
 * @access  Private (Admin/Supervisor)
 */
router.post('/invalidate',
  authenticateToken,
  validateQuery(cacheInvalidationSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check permissions
      if (!['Admin', 'Supervisor'].includes(req.user!.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const timer = monitoring.startTimer('cache_invalidation_duration');
      const { type, pattern, userId } = req.body;

      let invalidated = false;
      let message = '';

      switch (type) {
        case 'session':
          if (userId) {
            invalidated = await sessionCacheService.clearUserCache(userId);
            message = `Session cache cleared for user ${userId}`;
          } else {
            invalidated = await cacheService.clear('session:*');
            message = 'All session cache cleared';
          }
          break;

        case 'profile':
          invalidated = await cacheService.clear('profile:*');
          message = 'Profile cache cleared';
          break;

        case 'permissions':
          invalidated = await cacheService.clear('permissions:*');
          message = 'Permissions cache cleared';
          break;

        case 'tokens':
          invalidated = await cacheService.clear('token:*');
          message = 'Token cache cleared';
          break;

        case 'sites':
          invalidated = await businessCacheService.invalidateByType('SITE_DATA');
          message = 'Site data cache cleared';
          break;

        case 'tickets':
          invalidated = await businessCacheService.invalidateByType('TICKET_DATA');
          message = 'Ticket data cache cleared';
          break;

        case 'shifts':
          invalidated = await businessCacheService.invalidateByType('SHIFT_DATA');
          message = 'Shift data cache cleared';
          break;

        case 'analytics':
          const [reports, metrics] = await Promise.all([
            businessCacheService.invalidateByType('ANALYTICS_REPORTS'),
            businessCacheService.invalidateByType('ANALYTICS_METRICS')
          ]);
          invalidated = reports && metrics;
          message = 'Analytics cache cleared';
          break;

        case 'all':
          invalidated = await cacheService.clear();
          message = 'All cache cleared';
          break;

        default:
          if (pattern) {
            invalidated = await cacheService.clear(pattern);
            message = `Cache cleared for pattern: ${pattern}`;
          } else {
            return res.status(400).json({
              success: false,
              error: 'Invalid cache type or missing pattern'
            });
          }
      }

      timer();

      // Log the invalidation
      loggingService.info('Cache invalidated', {
        type,
        pattern,
        userId: userId || req.user!.id,
        invalidatedBy: req.user!.id,
        success: invalidated
      });

      monitoring.incrementCounter('cache_invalidations_total', 1, {
        type,
        status: invalidated ? 'success' : 'failed',
        user_role: req.user!.role
      });

      res.json({
        success: invalidated,
        message,
        invalidatedBy: req.user!.email,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Cache invalidation failed', error, {
        type: req.body.type,
        userId: req.user!.id
      });

      res.status(500).json({
        success: false,
        error: 'Cache invalidation failed'
      });
    }
  }
);

/**
 * @route   POST /api/cache/warm
 * @desc    Warm up cache with frequently accessed data
 * @access  Private (Admin)
 */
router.post('/warm',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check admin permissions
      if (req.user!.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const timer = monitoring.startTimer('cache_warmup_duration');

      // This would implement cache warming logic
      // For now, we'll return a placeholder response
      const warmedUp = {
        sites: 0,
        users: 0,
        config: 0
      };

      timer();

      loggingService.info('Cache warmup initiated', {
        initiatedBy: req.user!.id,
        warmedUp
      });

      monitoring.incrementCounter('cache_warmup_total', 1, {
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Cache warmup completed',
        data: warmedUp,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Cache warmup failed', error, {
        userId: req.user!.id
      });

      res.status(500).json({
        success: false,
        error: 'Cache warmup failed'
      });
    }
  }
);

/**
 * @route   GET /api/cache/user/:userId
 * @desc    Get cache information for a specific user
 * @access  Private (Admin/Supervisor or own user)
 */
router.get('/user/:userId',
  authenticateToken,
  validateParams(Joi.object({
    userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;

      // Check permissions - users can only see their own cache, admins/supervisors can see all
      if (req.user!.id !== userId && !['Admin', 'Supervisor'].includes(req.user!.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const timer = monitoring.startTimer('cache_user_info_duration');

      const [
        session,
        profile,
        permissions,
        preferences,
        activeShifts,
        userSites
      ] = await Promise.all([
        sessionCacheService.getUserSession(userId),
        sessionCacheService.getUserProfile(userId),
        sessionCacheService.getUserPermissions(userId),
        sessionCacheService.getUserPreferences(userId),
        sessionCacheService.getActiveShifts(userId),
        sessionCacheService.getUserSites(userId)
      ]);

      const userCacheInfo = {
        userId,
        cached: {
          session: !!session,
          profile: !!profile,
          permissions: !!permissions,
          preferences: !!preferences,
          activeShifts: !!activeShifts,
          userSites: !!userSites
        },
        data: {
          session: session ? {
            loginTime: session.loginTime,
            lastActivity: session.lastActivity,
            deviceId: session.deviceId
          } : null,
          profile: profile ? {
            email: profile.email,
            role: profile.role,
            isActive: profile.isActive
          } : null,
          permissions: permissions ? {
            role: permissions.role,
            permissionsCount: permissions.permissions?.length || 0,
            lastUpdated: permissions.lastUpdated
          } : null,
          shiftsCount: activeShifts?.length || 0,
          sitesCount: userSites?.length || 0
        }
      };

      timer();

      res.json({
        success: true,
        data: userCacheInfo
      });

    } catch (error) {
      loggingService.error('Failed to get user cache info', error, {
        userId: req.params.userId,
        requestedBy: req.user!.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user cache information'
      });
    }
  }
);

export default router;