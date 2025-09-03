import express from 'express';
import errorTrackingService from '../services/errorTrackingService';
import auth from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /api/errors
 * @desc Get errors with filtering
 * @access Admin, Supervisor
 */
router.get('/', auth(['admin', 'supervisor']), (req, res) => {
  try {
    const {
      severity,
      service,
      resolved,
      limit = '50',
      offset = '0',
      since
    } = req.query;

    const options: any = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    if (severity) {
      options.severity = (severity as string).split(',');
    }

    if (service) {
      options.service = service as string;
    }

    if (resolved !== undefined) {
      options.resolved = resolved === 'true';
    }

    if (since) {
      options.since = since as string;
    }

    const errors = errorTrackingService.getErrors(options);

    res.json({
      success: true,
      data: {
        errors,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: errors.length
        }
      }
    });
  } catch (error) {
    req.log.error('Failed to get errors', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve errors'
    });
  }
});

/**
 * @route GET /api/errors/stats
 * @desc Get error statistics
 * @access Admin, Supervisor
 */
router.get('/stats', auth(['admin', 'supervisor']), (req, res) => {
  try {
    const { timeWindow = '24' } = req.query;
    const stats = errorTrackingService.getErrorStats(parseInt(timeWindow as string));

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    req.log.error('Failed to get error stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error statistics'
    });
  }
});

/**
 * @route GET /api/errors/:id
 * @desc Get specific error by ID
 * @access Admin, Supervisor
 */
router.get('/:id', auth(['admin', 'supervisor']), (req, res) => {
  try {
    const { id } = req.params;
    const error = errorTrackingService.getError(id);

    if (!error) {
      return res.status(404).json({
        success: false,
        error: 'Error not found'
      });
    }

    res.json({
      success: true,
      data: error
    });
  } catch (error) {
    req.log.error('Failed to get error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error'
    });
  }
});

/**
 * @route POST /api/errors/:fingerprint/resolve
 * @desc Mark error as resolved
 * @access Admin, Supervisor
 */
router.post('/:fingerprint/resolve', auth(['admin', 'supervisor']), (req, res) => {
  try {
    const { fingerprint } = req.params;
    const userId = (req as any).user?.id || 'unknown';

    const success = errorTrackingService.resolveError(fingerprint, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Error not found'
      });
    }

    req.log.info('Error marked as resolved', { 
      fingerprint, 
      resolvedBy: userId 
    });

    res.json({
      success: true,
      message: 'Error marked as resolved'
    });
  } catch (error) {
    req.log.error('Failed to resolve error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve error'
    });
  }
});

/**
 * @route POST /api/errors/capture
 * @desc Manually capture an error (for testing or client-side errors)
 * @access Admin, Supervisor, FieldTech
 */
router.post('/capture', auth(['admin', 'supervisor', 'fieldtech']), (req, res) => {
  try {
    const {
      name,
      message,
      stack,
      service,
      endpoint,
      severity = 'medium',
      tags = [],
      extra = {}
    } = req.body;

    if (!name || !message || !service) {
      return res.status(400).json({
        success: false,
        error: 'Name, message, and service are required'
      });
    }

    const error = new Error(message);
    error.name = name;
    if (stack) error.stack = stack;

    const errorId = errorTrackingService.captureError(error, {
      service,
      endpoint,
      userId: (req as any).user?.id,
      sessionId: req.sessionID,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      severity,
      tags,
      extra
    });

    req.log.info('Error manually captured', { 
      errorId, 
      name, 
      service, 
      capturedBy: (req as any).user?.id 
    });

    res.json({
      success: true,
      data: {
        errorId,
        message: 'Error captured successfully'
      }
    });
  } catch (error) {
    req.log.error('Failed to capture error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to capture error'
    });
  }
});

/**
 * @route POST /api/errors/breadcrumb
 * @desc Add breadcrumb for debugging context
 * @access All authenticated users
 */
router.post('/breadcrumb', auth(), (req, res) => {
  try {
    const {
      message,
      category,
      level = 'info',
      data = {}
    } = req.body;

    if (!message || !category) {
      return res.status(400).json({
        success: false,
        error: 'Message and category are required'
      });
    }

    const sessionId = req.sessionID || req.ip || 'unknown';
    
    errorTrackingService.addBreadcrumb(sessionId, {
      message,
      category,
      level,
      data
    });

    res.json({
      success: true,
      message: 'Breadcrumb added successfully'
    });
  } catch (error) {
    req.log.error('Failed to add breadcrumb', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add breadcrumb'
    });
  }
});

/**
 * @route GET /api/errors/alerts/channels
 * @desc Get all alert channels
 * @access Admin only
 */
router.get('/alerts/channels', auth(['admin']), (req, res) => {
  try {
    const channels = errorTrackingService.getAlertChannels();

    // Remove sensitive configuration data
    const sanitizedChannels = channels.map(channel => ({
      ...channel,
      configuration: {
        ...channel.configuration,
        // Redact sensitive fields
        ...(channel.configuration.smtp?.auth && {
          smtp: {
            ...channel.configuration.smtp,
            auth: { ...channel.configuration.smtp.auth, pass: '[REDACTED]' }
          }
        }),
        ...(channel.configuration.integrationKey && {
          integrationKey: '[REDACTED]'
        }),
        ...(channel.configuration.webhookUrl && {
          webhookUrl: channel.configuration.webhookUrl.replace(
            /\/[^\/]*$/,
            '/[REDACTED]'
          )
        })
      }
    }));

    res.json({
      success: true,
      data: sanitizedChannels
    });
  } catch (error) {
    req.log.error('Failed to get alert channels', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert channels'
    });
  }
});

/**
 * @route POST /api/errors/alerts/channels
 * @desc Create or update alert channel
 * @access Admin only
 */
router.post('/alerts/channels', auth(['admin']), (req, res) => {
  try {
    const channel = req.body;

    if (!channel.id || !channel.name || !channel.type) {
      return res.status(400).json({
        success: false,
        error: 'ID, name, and type are required'
      });
    }

    if (!['email', 'slack', 'webhook', 'pagerduty'].includes(channel.type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid channel type'
      });
    }

    errorTrackingService.setAlertChannel(channel);

    req.log.info('Alert channel updated', { 
      channelId: channel.id, 
      type: channel.type,
      updatedBy: (req as any).user?.id 
    });

    res.json({
      success: true,
      message: 'Alert channel updated successfully'
    });
  } catch (error) {
    req.log.error('Failed to update alert channel', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert channel'
    });
  }
});

/**
 * @route POST /api/errors/alerts/channels/:id/test
 * @desc Test alert channel
 * @access Admin only
 */
router.post('/alerts/channels/:id/test', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const success = await errorTrackingService.testAlertChannel(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Alert channel not found or test failed'
      });
    }

    req.log.info('Alert channel tested', { 
      channelId: id, 
      testedBy: (req as any).user?.id 
    });

    res.json({
      success: true,
      message: 'Alert channel test successful'
    });
  } catch (error) {
    req.log.error('Failed to test alert channel', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test alert channel'
    });
  }
});

/**
 * @route GET /api/errors/alerts/rules
 * @desc Get all alert rules
 * @access Admin only
 */
router.get('/alerts/rules', auth(['admin']), (req, res) => {
  try {
    const rules = errorTrackingService.getAlertRules();

    res.json({
      success: true,
      data: rules
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
 * @route POST /api/errors/alerts/rules
 * @desc Create or update alert rule
 * @access Admin only
 */
router.post('/alerts/rules', auth(['admin']), (req, res) => {
  try {
    const rule = req.body;

    if (!rule.id || !rule.name || !rule.conditions || !Array.isArray(rule.conditions)) {
      return res.status(400).json({
        success: false,
        error: 'ID, name, and conditions are required'
      });
    }

    // Validate conditions
    for (const condition of rule.conditions) {
      if (!condition.field || !condition.operator || condition.value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Each condition must have field, operator, and value'
        });
      }
    }

    errorTrackingService.setAlertRule(rule);

    req.log.info('Alert rule updated', { 
      ruleId: rule.id, 
      name: rule.name,
      updatedBy: (req as any).user?.id 
    });

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
 * @route GET /api/errors/dashboard
 * @desc Get error dashboard data
 * @access Admin, Supervisor
 */
router.get('/dashboard', auth(['admin', 'supervisor']), (req, res) => {
  try {
    const { timeWindow = '24' } = req.query;
    const stats = errorTrackingService.getErrorStats(parseInt(timeWindow as string));
    
    // Get recent critical errors
    const criticalErrors = errorTrackingService.getErrors({
      severity: ['critical'],
      resolved: false,
      limit: 10
    });

    // Get recent high-frequency errors
    const frequentErrors = errorTrackingService.getErrors({
      limit: 10
    }).sort((a, b) => b.count - a.count);

    const dashboardData = {
      stats,
      alerts: {
        critical: criticalErrors.length,
        unresolved: stats.unresolved
      },
      recentCriticalErrors: criticalErrors.slice(0, 5),
      topFrequentErrors: frequentErrors.slice(0, 5),
      trends: {
        timeWindow: parseInt(timeWindow as string),
        // Add more trend data as needed
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    req.log.error('Failed to get error dashboard data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data'
    });
  }
});

/**
 * @route POST /api/errors/simulate
 * @desc Simulate an error for testing (development only)
 * @access Admin only
 */
router.post('/simulate', auth(['admin']), (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Error simulation not allowed in production'
      });
    }

    const { type = 'generic', severity = 'medium' } = req.body;

    let error: Error;
    let service = 'test';

    switch (type) {
      case 'database':
        error = new Error('Connection timeout to database');
        error.name = 'DatabaseError';
        service = 'database';
        break;
      case 'authentication':
        error = new Error('Invalid credentials provided');
        error.name = 'AuthenticationError';
        service = 'authentication';
        break;
      case 'validation':
        error = new Error('Invalid input data');
        error.name = 'ValidationError';
        service = 'api';
        break;
      default:
        error = new Error('Simulated error for testing');
        error.name = 'TestError';
        service = 'test';
    }

    const errorId = errorTrackingService.captureError(error, {
      service,
      endpoint: 'POST /api/errors/simulate',
      userId: (req as any).user?.id,
      sessionId: req.sessionID,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      severity: severity as any,
      tags: ['simulated', 'test'],
      extra: {
        simulationType: type,
        simulatedBy: (req as any).user?.id
      }
    });

    req.log.info('Error simulation triggered', { 
      errorId, 
      type, 
      severity, 
      simulatedBy: (req as any).user?.id 
    });

    res.json({
      success: true,
      data: {
        errorId,
        message: 'Error simulated successfully'
      }
    });
  } catch (error) {
    req.log.error('Failed to simulate error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate error'
    });
  }
});

export default router;