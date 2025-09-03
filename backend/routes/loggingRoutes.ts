import express from 'express';
import loggingService from '../services/loggingService';
import logAnalyticsService from '../services/logAnalyticsService';
import auth from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /api/logging/stats
 * @desc Get logging statistics
 * @access Admin only
 */
router.get('/stats', auth(['admin']), async (req, res) => {
  try {
    const stats = await loggingService.getLogStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    req.log.error('Failed to get log stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve log statistics'
    });
  }
});

/**
 * @route POST /api/logging/search
 * @desc Search logs with filters
 * @access Admin only
 */
router.post('/search', auth(['admin']), async (req, res) => {
  try {
    const {
      level,
      service,
      startDate,
      endDate,
      keyword,
      limit = 100
    } = req.body;

    const filters: any = { limit };
    
    if (level) filters.level = level;
    if (service) filters.service = service;
    if (keyword) filters.keyword = keyword;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const results = await loggingService.searchLogs(filters);

    res.json({
      success: true,
      data: {
        results,
        count: results.length,
        filters
      }
    });
  } catch (error) {
    req.log.error('Failed to search logs', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search logs'
    });
  }
});

/**
 * @route GET /api/logging/analytics
 * @desc Get log analytics for a time period
 * @access Admin only
 */
router.get('/analytics', auth(['admin']), async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      period = '1h'
    } = req.query;

    let start: Date;
    let end: Date = new Date();

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      // Default to last hour if no dates provided
      const periodMap: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      
      const duration = periodMap[period as string] || periodMap['1h'];
      start = new Date(end.getTime() - duration);
    }

    const analytics = await logAnalyticsService.analyzeLogs(start, end);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    req.log.error('Failed to get log analytics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve log analytics'
    });
  }
});

/**
 * @route GET /api/logging/dashboard
 * @desc Get real-time dashboard data
 * @access Admin, Supervisor
 */
router.get('/dashboard', auth(['admin', 'supervisor']), async (req, res) => {
  try {
    const dashboardData = await logAnalyticsService.generateDashboardData();

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    req.log.error('Failed to get dashboard data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data'
    });
  }
});

/**
 * @route POST /api/logging/export
 * @desc Export analytics data
 * @access Admin only
 */
router.post('/export', auth(['admin']), async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      format = 'json'
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    if (!['json', 'csv', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Must be json, csv, or pdf'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const analytics = await logAnalyticsService.analyzeLogs(start, end);
    const filePath = await logAnalyticsService.exportAnalytics(analytics, format);

    res.json({
      success: true,
      data: {
        filePath,
        downloadUrl: `/api/logging/download/${encodeURIComponent(filePath)}`,
        format,
        period: analytics.period
      }
    });
  } catch (error) {
    req.log.error('Failed to export analytics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics'
    });
  }
});

/**
 * @route GET /api/logging/download/:filename
 * @desc Download exported analytics file
 * @access Admin only
 */
router.get('/download/:filename', auth(['admin']), async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = decodeURIComponent(filename);
    
    // Security check - ensure file is in logs directory
    if (!filePath.includes('/logs/exports/')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.download(filePath, (err) => {
      if (err) {
        req.log.error('Failed to download file', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download file'
        });
      }
    });
  } catch (error) {
    req.log.error('Failed to serve download', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve download'
    });
  }
});

/**
 * @route GET /api/logging/alerts
 * @desc Get all alert rules
 * @access Admin only
 */
router.get('/alerts', auth(['admin']), async (req, res) => {
  try {
    const alertRules = logAnalyticsService.getAlertRules();

    res.json({
      success: true,
      data: alertRules
    });
  } catch (error) {
    req.log.error('Failed to get alert rules', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert rules'
    });
  }
});

/**
 * @route POST /api/logging/alerts
 * @desc Create new alert rule
 * @access Admin only
 */
router.post('/alerts', auth(['admin']), async (req, res) => {
  try {
    const {
      name,
      description,
      condition,
      threshold,
      severity = 'medium',
      enabled = true,
      notificationChannels = []
    } = req.body;

    if (!name || !condition || threshold === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Name, condition, and threshold are required'
      });
    }

    const alertRule = {
      name,
      description,
      condition,
      threshold: Number(threshold),
      severity,
      enabled: Boolean(enabled),
      notificationChannels
    };

    const alertId = logAnalyticsService.addAlertRule(alertRule);

    req.log.info('Alert rule created', { alertId, alertRule });

    res.status(201).json({
      success: true,
      data: {
        id: alertId,
        ...alertRule
      }
    });
  } catch (error) {
    req.log.error('Failed to create alert rule', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert rule'
    });
  }
});

/**
 * @route PUT /api/logging/alerts/:id
 * @desc Update alert rule
 * @access Admin only
 */
router.put('/alerts/:id', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const success = logAnalyticsService.updateAlertRule(id, updates);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Alert rule not found'
      });
    }

    req.log.info('Alert rule updated', { alertId: id, updates });

    res.json({
      success: true,
      message: 'Alert rule updated successfully'
    });
  } catch (error) {
    req.log.error('Failed to update alert rule', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert rule'
    });
  }
});

/**
 * @route DELETE /api/logging/alerts/:id
 * @desc Delete alert rule
 * @access Admin only
 */
router.delete('/alerts/:id', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const success = logAnalyticsService.removeAlertRule(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Alert rule not found'
      });
    }

    req.log.info('Alert rule deleted', { alertId: id });

    res.json({
      success: true,
      message: 'Alert rule deleted successfully'
    });
  } catch (error) {
    req.log.error('Failed to delete alert rule', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert rule'
    });
  }
});

/**
 * @route POST /api/logging/archive
 * @desc Archive old logs
 * @access Admin only
 */
router.post('/archive', auth(['admin']), async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.body;

    await loggingService.archiveLogs(Number(olderThanDays));

    req.log.info('Logs archived', { olderThanDays });

    res.json({
      success: true,
      message: `Logs older than ${olderThanDays} days have been archived`
    });
  } catch (error) {
    req.log.error('Failed to archive logs', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive logs'
    });
  }
});

/**
 * @route GET /api/logging/config
 * @desc Get logging configuration
 * @access Admin only
 */
router.get('/config', auth(['admin']), async (req, res) => {
  try {
    const config = loggingService.getConfig();

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    req.log.error('Failed to get logging config', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logging configuration'
    });
  }
});

/**
 * @route PUT /api/logging/config
 * @desc Update logging configuration
 * @access Admin only
 */
router.put('/config', auth(['admin']), async (req, res) => {
  try {
    const updates = req.body;

    loggingService.updateConfig(updates);

    req.log.info('Logging configuration updated', updates);

    res.json({
      success: true,
      message: 'Logging configuration updated successfully'
    });
  } catch (error) {
    req.log.error('Failed to update logging config', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update logging configuration'
    });
  }
});

/**
 * @route GET /api/logging/health
 * @desc Get logging system health
 * @access Admin only
 */
router.get('/health', auth(['admin']), async (req, res) => {
  try {
    const stats = await loggingService.getLogStats();
    const config = loggingService.getConfig();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      config: {
        level: config.level,
        enableFile: config.enableFile,
        enableConsole: config.enableConsole,
        enableRotation: config.enableRotation
      },
      stats: {
        totalFiles: stats.totalFiles || 0,
        totalSize: stats.totalSize || 0,
        sizeFormatted: formatBytes(stats.totalSize || 0)
      },
      checks: {
        logDirectory: config.logDirectory,
        writeable: true, // You could add an actual write test here
        diskSpace: 'available' // You could add disk space check here
      }
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    req.log.error('Failed to get logging health', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logging health'
    });
  }
});

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default router;