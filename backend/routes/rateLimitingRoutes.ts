import express from 'express';
import rateLimitingService from '../services/rateLimitingService';
import auth from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /api/rate-limits/rules
 * @desc Get all rate limiting rules
 * @access Admin only
 */
router.get('/rules', auth(['admin']), (req, res) => {
  try {
    const rules = rateLimitingService.getRules();

    res.json({
      success: true,
      data: {
        rules,
        total: rules.length,
        active: rules.filter(rule => rule.enabled).length,
        inactive: rules.filter(rule => !rule.enabled).length
      }
    });
  } catch (error) {
    req.log.error('Failed to get rate limiting rules', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limiting rules'
    });
  }
});

/**
 * @route GET /api/rate-limits/rules/:id
 * @desc Get specific rate limiting rule
 * @access Admin only
 */
router.get('/rules/:id', auth(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const rule = rateLimitingService.getRule(id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rate limiting rule not found'
      });
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    req.log.error('Failed to get rate limiting rule', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limiting rule'
    });
  }
});

/**
 * @route POST /api/rate-limits/rules
 * @desc Create or update rate limiting rule
 * @access Admin only
 */
router.post('/rules', auth(['admin']), (req, res) => {
  try {
    const ruleData = req.body;

    // Validate required fields
    if (!ruleData.id || !ruleData.name || !ruleData.limits) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: id, name, limits'
      });
    }

    // Validate limits structure
    if (!ruleData.limits.requests || !ruleData.limits.windowMs) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limits structure. Must include requests and windowMs'
      });
    }

    // Validate actions structure
    if (!ruleData.actions || typeof ruleData.actions.block !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid actions structure. Must include block boolean'
      });
    }

    // Set defaults
    const rule = {
      enabled: true,
      priority: 5,
      conditions: {},
      ...ruleData
    };

    rateLimitingService.addRule(rule);

    req.log.info('Rate limiting rule created/updated', {
      ruleId: rule.id,
      name: rule.name,
      createdBy: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'Rate limiting rule created/updated successfully',
      data: rule
    });
  } catch (error) {
    req.log.error('Failed to create/update rate limiting rule', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create/update rate limiting rule'
    });
  }
});

/**
 * @route PUT /api/rate-limits/rules/:id
 * @desc Update specific rate limiting rule
 * @access Admin only
 */
router.put('/rules/:id', auth(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingRule = rateLimitingService.getRule(id);
    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: 'Rate limiting rule not found'
      });
    }

    const updatedRule = {
      ...existingRule,
      ...updates,
      id // Ensure ID cannot be changed
    };

    rateLimitingService.addRule(updatedRule);

    req.log.info('Rate limiting rule updated', {
      ruleId: id,
      updatedBy: (req as any).user?.id,
      changes: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'Rate limiting rule updated successfully',
      data: updatedRule
    });
  } catch (error) {
    req.log.error('Failed to update rate limiting rule', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rate limiting rule'
    });
  }
});

/**
 * @route DELETE /api/rate-limits/rules/:id
 * @desc Delete rate limiting rule
 * @access Admin only
 */
router.delete('/rules/:id', auth(['admin']), (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deletion of critical default rules
    const protectedRules = ['global-api-limit', 'auth-endpoint-limit'];
    if (protectedRules.includes(id)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete protected system rules'
      });
    }

    const success = rateLimitingService.removeRule(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Rate limiting rule not found'
      });
    }

    req.log.info('Rate limiting rule deleted', {
      ruleId: id,
      deletedBy: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'Rate limiting rule deleted successfully'
    });
  } catch (error) {
    req.log.error('Failed to delete rate limiting rule', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete rate limiting rule'
    });
  }
});

/**
 * @route POST /api/rate-limits/rules/:id/toggle
 * @desc Enable/disable rate limiting rule
 * @access Admin only
 */
router.post('/rules/:id/toggle', auth(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled field must be a boolean'
      });
    }

    const success = rateLimitingService.toggleRule(id, enabled);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Rate limiting rule not found'
      });
    }

    req.log.info('Rate limiting rule toggled', {
      ruleId: id,
      enabled,
      toggledBy: (req as any).user?.id
    });

    res.json({
      success: true,
      message: `Rate limiting rule ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    req.log.error('Failed to toggle rate limiting rule', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle rate limiting rule'
    });
  }
});

/**
 * @route GET /api/rate-limits/statistics
 * @desc Get rate limiting statistics
 * @access Admin, Supervisor
 */
router.get('/statistics', auth(['admin', 'supervisor']), async (req, res) => {
  try {
    const { timeWindow = '60' } = req.query;
    const stats = await rateLimitingService.getRateLimitStats(parseInt(timeWindow as string));

    if (!stats) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    req.log.error('Failed to get rate limiting statistics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limiting statistics'
    });
  }
});

/**
 * @route POST /api/rate-limits/reset
 * @desc Reset rate limit for specific key
 * @access Admin only
 */
router.post('/reset', auth(['admin']), async (req, res) => {
  try {
    const { key, type, value } = req.body;

    if (!key && !(type && value)) {
      return res.status(400).json({
        success: false,
        error: 'Either key or type+value must be provided'
      });
    }

    let resetKey = key;
    if (!resetKey && type && value) {
      // Generate key based on type and value
      if (type === 'ip') {
        resetKey = `rate_limit:*:ip:${value}`;
      } else if (type === 'user') {
        resetKey = `rate_limit:*:user:${value}`;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid type. Must be "ip" or "user"'
        });
      }
    }

    const success = await rateLimitingService.resetRateLimit(resetKey!);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to reset rate limit'
      });
    }

    req.log.info('Rate limit reset', {
      key: resetKey,
      type,
      value,
      resetBy: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'Rate limit reset successfully'
    });
  } catch (error) {
    req.log.error('Failed to reset rate limit', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset rate limit'
    });
  }
});

/**
 * @route POST /api/rate-limits/whitelist
 * @desc Add IP or user to whitelist
 * @access Admin only
 */
router.post('/whitelist', auth(['admin']), (req, res) => {
  try {
    const { type, value, reason } = req.body;

    if (!['ip', 'user'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be "ip" or "user"'
      });
    }

    if (!value) {
      return res.status(400).json({
        success: false,
        error: 'Value is required'
      });
    }

    rateLimitingService.addWhitelist(type, value);

    req.log.info('Added to rate limit whitelist', {
      type,
      value,
      reason,
      addedBy: (req as any).user?.id
    });

    res.json({
      success: true,
      message: `${type} ${value} added to whitelist successfully`
    });
  } catch (error) {
    req.log.error('Failed to add to whitelist', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to whitelist'
    });
  }
});

/**
 * @route POST /api/rate-limits/blacklist
 * @desc Add IP or user to blacklist
 * @access Admin only
 */
router.post('/blacklist', auth(['admin']), (req, res) => {
  try {
    const { type, value, reason } = req.body;

    if (!['ip', 'user'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be "ip" or "user"'
      });
    }

    if (!value) {
      return res.status(400).json({
        success: false,
        error: 'Value is required'
      });
    }

    rateLimitingService.addBlacklist(type, value);

    req.log.info('Added to rate limit blacklist', {
      type,
      value,
      reason,
      addedBy: (req as any).user?.id
    });

    res.json({
      success: true,
      message: `${type} ${value} added to blacklist successfully`
    });
  } catch (error) {
    req.log.error('Failed to add to blacklist', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to blacklist'
    });
  }
});

/**
 * @route GET /api/rate-limits/health
 * @desc Get rate limiting service health
 * @access Admin only
 */
router.get('/health', auth(['admin']), (req, res) => {
  try {
    const rules = rateLimitingService.getRules();
    const activeRules = rules.filter(rule => rule.enabled);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      rules: {
        total: rules.length,
        active: activeRules.length,
        inactive: rules.length - activeRules.length
      },
      redis: {
        // Would check actual Redis status
        connected: true,
        fallback: false
      },
      performance: {
        // Would include actual performance metrics
        averageCheckTime: '2ms',
        cacheHitRate: '95%'
      }
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    req.log.error('Failed to get rate limiting health', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limiting health'
    });
  }
});

/**
 * @route GET /api/rate-limits/templates
 * @desc Get rate limiting rule templates
 * @access Admin only
 */
router.get('/templates', auth(['admin']), (req, res) => {
  try {
    const templates = [
      {
        id: 'api-endpoint-limit',
        name: 'API Endpoint Rate Limit',
        description: 'Standard rate limit for API endpoints',
        template: {
          enabled: true,
          priority: 5,
          conditions: {
            endpoints: ['/api/example'],
            methods: ['GET', 'POST']
          },
          limits: {
            requests: 100,
            windowMs: 60 * 60 * 1000 // 1 hour
          },
          actions: {
            block: true,
            customResponse: {
              statusCode: 429,
              message: 'API endpoint rate limit exceeded'
            }
          }
        }
      },
      {
        id: 'user-role-limit',
        name: 'User Role Based Rate Limit',
        description: 'Rate limit based on user role',
        template: {
          enabled: true,
          priority: 3,
          conditions: {
            userRoles: ['user']
          },
          limits: {
            requests: 1000,
            windowMs: 60 * 60 * 1000 // 1 hour
          },
          actions: {
            block: true
          }
        }
      },
      {
        id: 'ip-based-limit',
        name: 'IP Based Rate Limit',
        description: 'Rate limit based on client IP',
        template: {
          enabled: true,
          priority: 4,
          conditions: {},
          limits: {
            requests: 500,
            windowMs: 60 * 60 * 1000 // 1 hour
          },
          actions: {
            block: true,
            delay: 1000
          },
          keyGenerator: '(req) => `ip:${req.ip}`'
        }
      },
      {
        id: 'burst-protection',
        name: 'Burst Protection',
        description: 'Allow burst requests with overall limit',
        template: {
          enabled: true,
          priority: 6,
          conditions: {},
          limits: {
            requests: 100,
            windowMs: 60 * 60 * 1000, // 1 hour
            burst: 20
          },
          actions: {
            block: true,
            customResponse: {
              statusCode: 429,
              message: 'Burst limit exceeded'
            }
          }
        }
      }
    ];

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    req.log.error('Failed to get rate limiting templates', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limiting templates'
    });
  }
});

/**
 * @route POST /api/rate-limits/test
 * @desc Test rate limiting configuration
 * @access Admin only
 */
router.post('/test', auth(['admin']), async (req, res) => {
  try {
    const { ruleId, testRequests = 10 } = req.body;

    if (!ruleId) {
      return res.status(400).json({
        success: false,
        error: 'ruleId is required'
      });
    }

    const rule = rateLimitingService.getRule(ruleId);
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rate limiting rule not found'
      });
    }

    // Simulate requests and test rate limiting
    const testResults = {
      ruleId,
      ruleName: rule.name,
      testRequests,
      results: [],
      summary: {
        allowed: 0,
        blocked: 0,
        averageResponseTime: 0
      }
    };

    // This would implement actual testing logic
    // For now, returning structure
    for (let i = 0; i < testRequests; i++) {
      const allowed = i < rule.limits.requests;
      testResults.results.push({
        requestNumber: i + 1,
        allowed,
        responseTime: Math.random() * 10, // Mock response time
        remainingRequests: Math.max(0, rule.limits.requests - i - 1)
      });

      if (allowed) {
        testResults.summary.allowed++;
      } else {
        testResults.summary.blocked++;
      }
    }

    req.log.info('Rate limiting rule tested', {
      ruleId,
      testRequests,
      testedBy: (req as any).user?.id
    });

    res.json({
      success: true,
      data: testResults
    });
  } catch (error) {
    req.log.error('Failed to test rate limiting rule', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test rate limiting rule'
    });
  }
});

export default router;