/**
 * Database Optimization Routes
 * API endpoints for database performance optimization, indexing, and analytics
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateQuery, validateBody } from '../middleware/validationMiddleware';
import Joi from 'joi';
import databaseIndexService from '../services/databaseIndexService';
import analyticsAggregationService from '../services/analyticsAggregationService';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

const router = Router();

// Validation schemas
const analyticsFiltersSchema = Joi.object({
  userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  siteId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  clientId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  role: Joi.string().valid('FieldTech', 'Supervisor', 'Admin', 'Client', 'SiteStaff').optional(),
  department: Joi.string().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).optional()
});

const indexCreationSchema = Joi.object({
  force: Joi.boolean().default(false),
  priority: Joi.string().valid('critical', 'high', 'medium', 'low').optional()
});

/**
 * @route   POST /api/db-optimization/indexes/create
 * @desc    Create all defined database indexes
 * @access  Private (Admin only)
 */
router.post('/indexes/create',
  authenticateToken,
  validateBody(indexCreationSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check admin permissions
      if (req.user!.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const timer = monitoring.startTimer('database_index_creation_request_duration');
      const { force, priority } = req.body;

      loggingService.info('Database index creation initiated', {
        userId: req.user!.id,
        force,
        priority
      });

      const result = await databaseIndexService.createIndexes();

      timer();

      monitoring.incrementCounter('database_optimization_operations_total', 1, {
        operation: 'create_indexes',
        status: result.success ? 'success' : 'partial_failure'
      });

      res.json({
        success: result.success,
        message: `Index creation completed: ${result.created} created, ${result.failed} failed`,
        data: {
          summary: {
            created: result.created,
            failed: result.failed,
            total: result.details.length
          },
          details: result.details
        },
        initiatedBy: req.user!.email,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Database index creation failed', error, {
        userId: req.user!.id
      });

      monitoring.incrementCounter('database_optimization_operations_total', 1, {
        operation: 'create_indexes',
        status: 'error'
      });

      res.status(500).json({
        success: false,
        error: 'Database index creation failed'
      });
    }
  }
);

/**
 * @route   GET /api/db-optimization/indexes/analyze
 * @desc    Analyze existing database indexes
 * @access  Private (Admin/Supervisor)
 */
router.get('/indexes/analyze',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check permissions
      if (!['Admin', 'Supervisor'].includes(req.user!.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const timer = monitoring.startTimer('database_index_analysis_duration');

      const analysis = await databaseIndexService.analyzeIndexes();

      timer();

      monitoring.incrementCounter('database_optimization_operations_total', 1, {
        operation: 'analyze_indexes',
        status: 'success'
      });

      // Calculate summary statistics
      const summary = {
        totalCollections: analysis.collections.length,
        totalIndexes: analysis.collections.reduce((sum, col) => sum + col.totalIndexes, 0),
        totalSize: analysis.collections.reduce((sum, col) => sum + col.totalSize, 0),
        recommendationsCount: analysis.recommendations.length
      };

      res.json({
        success: true,
        data: {
          summary,
          collections: analysis.collections,
          recommendations: analysis.recommendations
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Database index analysis failed', error, {
        userId: req.user!.id
      });

      monitoring.incrementCounter('database_optimization_operations_total', 1, {
        operation: 'analyze_indexes',
        status: 'error'
      });

      res.status(500).json({
        success: false,
        error: 'Database index analysis failed'
      });
    }
  }
);

/**
 * @route   GET /api/db-optimization/slow-queries
 * @desc    Analyze and optimize slow queries
 * @access  Private (Admin only)
 */
router.get('/slow-queries',
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

      const timer = monitoring.startTimer('slow_query_analysis_duration');

      const analysis = await databaseIndexService.optimizeSlowQueries();

      timer();

      monitoring.incrementCounter('database_optimization_operations_total', 1, {
        operation: 'analyze_slow_queries',
        status: 'success'
      });

      res.json({
        success: true,
        data: analysis,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Slow query analysis failed', error, {
        userId: req.user!.id
      });

      monitoring.incrementCounter('database_optimization_operations_total', 1, {
        operation: 'analyze_slow_queries',
        status: 'error'
      });

      res.status(500).json({
        success: false,
        error: 'Slow query analysis failed'
      });
    }
  }
);

/**
 * @route   GET /api/db-optimization/recommendations
 * @desc    Get index recommendations
 * @access  Private (Admin/Supervisor)
 */
router.get('/recommendations',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check permissions
      if (!['Admin', 'Supervisor'].includes(req.user!.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const recommendations = databaseIndexService.getIndexRecommendations();

      res.json({
        success: true,
        data: recommendations,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Failed to get recommendations', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recommendations'
      });
    }
  }
);

/**
 * @route   GET /api/db-optimization/pipelines
 * @desc    Get available aggregation pipelines
 * @access  Private (Admin/Supervisor)
 */
router.get('/pipelines',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check permissions
      if (!['Admin', 'Supervisor'].includes(req.user!.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const pipelines = databaseIndexService.getAvailablePipelines();

      res.json({
        success: true,
        data: pipelines,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Failed to get pipelines', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pipelines'
      });
    }
  }
);

/**
 * @route   POST /api/db-optimization/analytics/shifts
 * @desc    Get optimized shift analytics
 * @access  Private
 */
router.post('/analytics/shifts',
  authenticateToken,
  validateBody(analyticsFiltersSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const timer = monitoring.startTimer('shift_analytics_request_duration');
      const filters = req.body;

      // Role-based filtering
      if (req.user!.role === 'FieldTech') {
        filters.userId = req.user!.id;
      }

      const result = await analyticsAggregationService.getShiftAnalytics(filters);

      timer();

      monitoring.incrementCounter('analytics_requests_total', 1, {
        type: 'shifts',
        cached: result.metadata.cached.toString(),
        user_role: req.user!.role
      });

      res.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Shift analytics request failed', error, {
        userId: req.user!.id,
        filters: req.body
      });

      monitoring.incrementCounter('analytics_requests_total', 1, {
        type: 'shifts',
        status: 'error',
        user_role: req.user!.role
      });

      res.status(500).json({
        success: false,
        error: 'Shift analytics request failed'
      });
    }
  }
);

/**
 * @route   POST /api/db-optimization/analytics/sites
 * @desc    Get optimized site analytics
 * @access  Private
 */
router.post('/analytics/sites',
  authenticateToken,
  validateBody(analyticsFiltersSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const timer = monitoring.startTimer('site_analytics_request_duration');
      const filters = req.body;

      const result = await analyticsAggregationService.getSiteAnalytics(filters);

      timer();

      monitoring.incrementCounter('analytics_requests_total', 1, {
        type: 'sites',
        cached: result.metadata.cached.toString(),
        user_role: req.user!.role
      });

      res.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Site analytics request failed', error, {
        userId: req.user!.id,
        filters: req.body
      });

      monitoring.incrementCounter('analytics_requests_total', 1, {
        type: 'sites',
        status: 'error',
        user_role: req.user!.role
      });

      res.status(500).json({
        success: false,
        error: 'Site analytics request failed'
      });
    }
  }
);

/**
 * @route   POST /api/db-optimization/analytics/sla
 * @desc    Get optimized SLA analytics
 * @access  Private (Admin/Supervisor)
 */
router.post('/analytics/sla',
  authenticateToken,
  validateBody(analyticsFiltersSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check permissions
      if (!['Admin', 'Supervisor'].includes(req.user!.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const timer = monitoring.startTimer('sla_analytics_request_duration');
      const filters = req.body;

      const result = await analyticsAggregationService.getSLAAnalytics(filters);

      timer();

      monitoring.incrementCounter('analytics_requests_total', 1, {
        type: 'sla',
        cached: result.metadata.cached.toString(),
        user_role: req.user!.role
      });

      res.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('SLA analytics request failed', error, {
        userId: req.user!.id,
        filters: req.body
      });

      monitoring.incrementCounter('analytics_requests_total', 1, {
        type: 'sla',
        status: 'error',
        user_role: req.user!.role
      });

      res.status(500).json({
        success: false,
        error: 'SLA analytics request failed'
      });
    }
  }
);

/**
 * @route   POST /api/db-optimization/analytics/dashboard
 * @desc    Get comprehensive dashboard analytics
 * @access  Private
 */
router.post('/analytics/dashboard',
  authenticateToken,
  validateBody(analyticsFiltersSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const timer = monitoring.startTimer('dashboard_analytics_request_duration');
      const filters = req.body;

      // Role-based filtering
      if (req.user!.role === 'FieldTech') {
        filters.userId = req.user!.id;
      }

      const result = await analyticsAggregationService.getDashboardAnalytics(filters);

      timer();

      monitoring.incrementCounter('analytics_requests_total', 1, {
        type: 'dashboard',
        user_role: req.user!.role
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Dashboard analytics request failed', error, {
        userId: req.user!.id,
        filters: req.body
      });

      monitoring.incrementCounter('analytics_requests_total', 1, {
        type: 'dashboard',
        status: 'error',
        user_role: req.user!.role
      });

      res.status(500).json({
        success: false,
        error: 'Dashboard analytics request failed'
      });
    }
  }
);

/**
 * @route   GET /api/db-optimization/health
 * @desc    Get database optimization health status
 * @access  Private (Admin/Supervisor)
 */
router.get('/health',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check permissions
      if (!['Admin', 'Supervisor'].includes(req.user!.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const timer = monitoring.startTimer('db_optimization_health_check_duration');

      // Get basic health metrics
      const health = {
        indexing: {
          status: 'healthy',
          lastIndexCreation: null, // Could be tracked
          recommendationsAvailable: databaseIndexService.getIndexRecommendations().length
        },
        aggregations: {
          status: 'healthy',
          availablePipelines: databaseIndexService.getAvailablePipelines().length
        },
        performance: {
          status: 'monitoring',
          slowQueryAnalysisEnabled: true
        }
      };

      timer();

      res.json({
        success: true,
        data: health,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Database optimization health check failed', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  }
);

export default router;