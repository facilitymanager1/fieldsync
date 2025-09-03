// Advanced SLA Routes - Working implementation with simplified facade
import { Router, Request, Response } from 'express';
import { AdvancedSlaEngine } from '../modules/advancedSlaEngineFacade';
import { SlaTrackerModel, AdvancedSlaTemplateModel } from '../models/advancedSla';
import { AuthenticatedRequest } from '../types/standardInterfaces';

const router = Router();
const slaEngine = new AdvancedSlaEngine();

/**
 * @route POST /api/sla/tracker
 * @desc Create new SLA tracker
 */
router.post('/tracker', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { entityId, entityType, context } = req.body;

    if (!entityId || !entityType) {
      return res.status(400).json({
        success: false,
        message: 'entityId and entityType are required'
      });
    }

    const tracker = await slaEngine.createSlaTracker(entityId, entityType, context);

    if (!tracker) {
      return res.status(400).json({
        success: false,
        message: 'No SLA template found for this entity type'
      });
    }

    res.status(201).json({
      success: true,
      data: tracker,
      message: 'SLA tracker created successfully'
    });
  } catch (error) {
    console.error('Error creating SLA tracker:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route PUT /api/sla/tracker/:id
 * @desc Update SLA tracker
 */
router.put('/tracker/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { entityType, ...updates } = req.body;

    const tracker = await slaEngine.updateSlaTracker(id, entityType, updates);

    if (!tracker) {
      return res.status(404).json({
        success: false,
        message: 'SLA tracker not found'
      });
    }

    res.json({
      success: true,
      data: tracker,
      message: 'SLA tracker updated successfully'
    });
  } catch (error) {
    console.error('Error updating SLA tracker:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route POST /api/sla/tracker/:id/pause
 * @desc Pause SLA tracker
 */
router.post('/tracker/:id/pause', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { reason, category, entityType } = req.body;
    const pausedBy = authReq.user?.id || 'system';

    await slaEngine.pauseSla(id, entityType, reason, category, pausedBy);

    res.json({
      success: true,
      message: 'SLA tracker paused successfully'
    });
  } catch (error) {
    console.error('Error pausing SLA tracker:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route POST /api/sla/tracker/:id/resume
 * @desc Resume SLA tracker
 */
router.post('/tracker/:id/resume', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { entityType } = req.body;
    const resumedBy = authReq.user?.id || 'system';

    await slaEngine.resumeSla(id, entityType, resumedBy);

    res.json({
      success: true,
      message: 'SLA tracker resumed successfully'
    });
  } catch (error) {
    console.error('Error resuming SLA tracker:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route POST /api/sla/tracker/:id/resolve
 * @desc Resolve SLA tracker
 */
router.post('/tracker/:id/resolve', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { entityType, resolutionTime } = req.body;

    await slaEngine.resolveSla(
      id,
      entityType,
      resolutionTime ? new Date(resolutionTime) : undefined
    );

    res.json({
      success: true,
      message: 'SLA tracker resolved successfully'
    });
  } catch (error) {
    console.error('Error resolving SLA tracker:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/sla/tracker/:id
 * @desc Get SLA tracker status
 */
router.get('/tracker/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const tracker = await SlaTrackerModel.findOne({ 
      $or: [
        { id },
        { entityId: id }
      ]
    });

    if (!tracker) {
      return res.status(404).json({
        success: false,
        message: 'SLA tracker not found'
      });
    }

    res.json({
      success: true,
      data: tracker
    });
  } catch (error) {
    console.error('Error getting SLA tracker:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/sla/trackers
 * @desc Get SLA trackers with filtering
 */
router.get('/trackers', async (req: Request, res: Response) => {
  try {
    const { status, entityType, assignedTo, page = 1, limit = 20 } = req.query;
    
    const filters: any = {};
    if (status) filters.status = status;
    if (entityType) filters.entityType = entityType;
    if (assignedTo) filters.assignedTo = assignedTo;

    const skip = (Number(page) - 1) * Number(limit);

    const [trackers, total] = await Promise.all([
      SlaTrackerModel.find(filters)
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      SlaTrackerModel.countDocuments(filters)
    ]);

    res.json({
      success: true,
      data: trackers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error getting SLA trackers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/sla/templates
 * @desc Get SLA templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { category, isActive = true } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const templates = await AdvancedSlaTemplateModel.find(filters)
      .sort({ priority: -1, name: 1 });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error getting SLA templates:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route POST /api/sla/templates
 * @desc Create SLA template
 */
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const templateData = req.body;
    
    const template = await AdvancedSlaTemplateModel.create({
      ...templateData,
      createdBy: authReq.user?.id || 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'SLA template created successfully'
    });
  } catch (error) {
    console.error('Error creating SLA template:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/sla/metrics
 * @desc Get SLA metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { entityType, startDate, endDate } = req.query;
    
    const filters: any = {};
    if (entityType) filters.entityType = entityType;
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate as string);
      if (endDate) filters.createdAt.$lte = new Date(endDate as string);
    }

    const metrics = await slaEngine.getSlaMetrics(filters);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting SLA metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/sla/dashboard
 * @desc Get SLA dashboard data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const dashboardData = await slaEngine.getDashboardData();

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error getting SLA dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/sla/breached
 * @desc Get breached SLAs
 */
router.get('/breached', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [breachedSlas, total] = await Promise.all([
      SlaTrackerModel.find({ isBreached: true })
        .skip(skip)
        .limit(Number(limit))
        .sort({ breachTime: -1 }),
      SlaTrackerModel.countDocuments({ isBreached: true })
    ]);

    res.json({
      success: true,
      data: breachedSlas,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error getting breached SLAs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/sla/health
 * @desc Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await slaEngine.healthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date(),
        error: 'Health check failed',
        version: '1.0.0'
      }
    });
  }
});

export default router;
