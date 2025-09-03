import express from 'express';
import metricsService from '../services/metricsService';
import metricsMiddleware from '../middleware/metricsMiddleware';
import auth from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /metrics
 * @desc Prometheus metrics endpoint
 * @access Public (for Prometheus scraping)
 */
router.get('/', async (req, res) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error retrieving metrics');
  }
});

/**
 * @route GET /api/metrics/json
 * @desc Get metrics in JSON format
 * @access Admin only
 */
router.get('/json', auth(['admin']), async (req, res) => {
  try {
    const metrics = await metricsService.getMetricsJSON();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    req.log.error('Failed to get metrics JSON', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
});

/**
 * @route GET /api/metrics/health
 * @desc Get metrics service health
 * @access Admin only
 */
router.get('/health', auth(['admin']), async (req, res) => {
  try {
    const health = metricsService.healthCheck();
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    req.log.error('Failed to get metrics health', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics health'
    });
  }
});

/**
 * @route GET /api/metrics/summary
 * @desc Get metrics summary report
 * @access Admin only
 */
router.get('/summary', auth(['admin']), async (req, res) => {
  try {
    const summary = await metricsService.generateSummaryReport();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    req.log.error('Failed to generate metrics summary', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate metrics summary'
    });
  }
});

/**
 * @route POST /api/metrics/custom
 * @desc Create custom metric
 * @access Admin only
 */
router.post('/custom', auth(['admin']), async (req, res) => {
  try {
    const { name, type, help, labelNames, buckets } = req.body;
    
    if (!name || !type || !help) {
      return res.status(400).json({
        success: false,
        error: 'Name, type, and help are required'
      });
    }

    if (!['counter', 'gauge', 'histogram'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be counter, gauge, or histogram'
      });
    }

    let metric;
    switch (type) {
      case 'counter':
        metric = metricsService.createCounter(name, help, labelNames || []);
        break;
      case 'gauge':
        metric = metricsService.createGauge(name, help, labelNames || []);
        break;
      case 'histogram':
        metric = metricsService.createHistogram(name, help, labelNames || [], buckets);
        break;
    }

    req.log.info('Custom metric created', { name, type, help });

    res.status(201).json({
      success: true,
      data: {
        name,
        type,
        help,
        labelNames: labelNames || [],
        created: true
      }
    });
  } catch (error) {
    req.log.error('Failed to create custom metric', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create custom metric'
    });
  }
});

/**
 * @route POST /api/metrics/record
 * @desc Record custom metric value
 * @access Admin only
 */
router.post('/record', auth(['admin']), async (req, res) => {
  try {
    const { metricName, value, labels, operation } = req.body;
    
    if (!metricName || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Metric name and value are required'
      });
    }

    const metric = metricsService.getCustomMetric(metricName);
    if (!metric) {
      return res.status(404).json({
        success: false,
        error: 'Metric not found'
      });
    }

    // Record value based on metric type and operation
    const labelsObj = labels || {};
    
    if (operation === 'inc' && typeof (metric as any).inc === 'function') {
      (metric as any).labels(labelsObj).inc(value || 1);
    } else if (operation === 'set' && typeof (metric as any).set === 'function') {
      (metric as any).labels(labelsObj).set(value);
    } else if (operation === 'observe' && typeof (metric as any).observe === 'function') {
      (metric as any).labels(labelsObj).observe(value);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid operation for metric type'
      });
    }

    res.json({
      success: true,
      message: 'Metric value recorded successfully'
    });
  } catch (error) {
    req.log.error('Failed to record metric value', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record metric value'
    });
  }
});

/**
 * @route GET /api/metrics/active-connections
 * @desc Get current active connections
 * @access Admin, Supervisor
 */
router.get('/active-connections', auth(['admin', 'supervisor']), (req, res) => {
  try {
    const activeConnections = metricsMiddleware.getActiveConnections();
    const requestsInProgress = metricsMiddleware.getRequestsInProgress();

    res.json({
      success: true,
      data: {
        activeConnections,
        requestsInProgress: Object.fromEntries(requestsInProgress),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    req.log.error('Failed to get connection stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve connection statistics'
    });
  }
});

/**
 * @route POST /api/metrics/business-kpi
 * @desc Record business KPI metric
 * @access Admin, Supervisor
 */
router.post('/business-kpi', auth(['admin', 'supervisor']), (req, res) => {
  try {
    const { metric, value, labels } = req.body;
    
    if (!metric || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Metric name and value are required'
      });
    }

    metricsService.recordBusinessKPI(metric, value, labels || {});

    req.log.info('Business KPI recorded', { metric, value, labels });

    res.json({
      success: true,
      message: 'Business KPI recorded successfully'
    });
  } catch (error) {
    req.log.error('Failed to record business KPI', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record business KPI'
    });
  }
});

/**
 * @route GET /api/metrics/performance
 * @desc Get performance monitoring data
 * @access Admin, Supervisor
 */
router.get('/performance', auth(['admin', 'supervisor']), (req, res) => {
  try {
    // Start performance monitoring for this endpoint
    const endTimer = metricsService.startPerformanceMonitoring('metrics_performance_endpoint');

    setTimeout(() => {
      endTimer(); // End the performance measurement
      
      res.json({
        success: true,
        data: {
          message: 'Performance monitoring active',
          timestamp: new Date().toISOString(),
          monitoring: {
            httpRequests: 'active',
            databaseOperations: 'active',
            cacheOperations: 'active',
            businessMetrics: 'active',
            systemMetrics: 'active'
          }
        }
      });
    }, 10); // Small delay to demonstrate performance monitoring
  } catch (error) {
    req.log.error('Failed to get performance data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance data'
    });
  }
});

/**
 * @route POST /api/metrics/clear
 * @desc Clear all metrics (development only)
 * @access Admin only
 */
router.post('/clear', auth(['admin']), (req, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Cannot clear metrics in production'
      });
    }

    metricsService.clearMetrics();

    req.log.warn('All metrics cleared by admin', {
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'All metrics cleared successfully'
    });
  } catch (error) {
    req.log.error('Failed to clear metrics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear metrics'
    });
  }
});

/**
 * @route GET /api/metrics/config
 * @desc Get metrics configuration
 * @access Admin only
 */
router.get('/config', auth(['admin']), (req, res) => {
  try {
    const config = {
      enableDefaultMetrics: process.env.ENABLE_DEFAULT_METRICS !== 'false',
      metricsInterval: process.env.METRICS_COLLECTION_INTERVAL || '10000',
      prefix: process.env.METRICS_PREFIX || 'fieldsync_',
      enableGCMetrics: process.env.ENABLE_GC_METRICS !== 'false',
      enableEventLoopMetrics: process.env.ENABLE_EVENT_LOOP_METRICS !== 'false',
      enableProcessMetrics: process.env.ENABLE_PROCESS_METRICS !== 'false',
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    req.log.error('Failed to get metrics config', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics configuration'
    });
  }
});

export default router;