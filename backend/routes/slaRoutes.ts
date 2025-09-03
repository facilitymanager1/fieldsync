import { Router } from 'express';
import { getSLAs, getSLA, createSLA, updateSLA, deleteSLA } from '../modules/sla';
import { checkSLACompliance, slaEngine } from '../modules/slaEngine';
import { requireAuth, requireRole } from '../modules/authentication';

const router = Router();

// Get all SLA templates (Supervisor, Admin, Client)
router.get('/', requireAuth, requireRole(['Supervisor', 'Admin', 'Client']), getSLAs);

// Get specific SLA template (Supervisor, Admin, Client)
router.get('/:id', requireAuth, requireRole(['Supervisor', 'Admin', 'Client']), getSLA);

// Create SLA template (Admin)
router.post('/', requireAuth, requireRole(['Admin']), createSLA);

// Update SLA template (Admin)
router.put('/:id', requireAuth, requireRole(['Admin']), updateSLA);

// Delete SLA template (Admin)
router.delete('/:id', requireAuth, requireRole(['Admin']), deleteSLA);

// Check SLA compliance (Supervisor, Admin, Client)
router.post('/check', requireAuth, requireRole(['Supervisor', 'Admin', 'Client']), async (req, res) => {
  try {
    const compliance = await checkSLACompliance(req.body);
    res.json({
      success: true,
      data: compliance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check SLA compliance'
    });
  }
});

// Create SLA tracker for an entity (Admin, Supervisor)
router.post('/tracker', requireAuth, requireRole(['Admin', 'Supervisor']), async (req, res) => {
  try {
    const { entityId, entityType, context = {} } = req.body;
    
    if (!entityId || !entityType) {
      res.status(400).json({
        success: false,
        error: 'entityId and entityType are required'
      });
      return;
    }
    
    const tracker = await slaEngine.createSlaTracker(entityId, entityType, context);
    
    if (!tracker) {
      res.status(400).json({
        success: false,
        error: 'No matching SLA template found for the provided entity'
      });
      return;
    }
    
    res.status(201).json({
      success: true,
      message: 'SLA tracker created successfully',
      data: tracker
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create SLA tracker'
    });
  }
});

// Update SLA tracker status (Admin, Supervisor, FieldTech)
router.put('/tracker/:trackerId', requireAuth, requireRole(['Admin', 'Supervisor', 'FieldTech']), async (req, res) => {
  try {
    const { trackerId } = req.params;
    const updates = req.body;
    
    const tracker = await slaEngine.updateSlaTracker(trackerId, updates);
    
    if (!tracker) {
      res.status(404).json({
        success: false,
        error: 'SLA tracker not found'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'SLA tracker updated successfully',
      data: tracker
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update SLA tracker'
    });
  }
});

// Pause SLA tracker (Admin, Supervisor)
router.post('/tracker/:trackerId/pause', requireAuth, requireRole(['Admin', 'Supervisor']), async (req, res) => {
  try {
    const { trackerId } = req.params;
    const { reason, category = 'other' } = req.body;
    const userId = (req as any).user?.id;
    
    if (!reason) {
      res.status(400).json({
        success: false,
        error: 'Reason is required for pausing SLA tracker'
      });
      return;
    }
    
    const success = await slaEngine.pauseSlaTracker(trackerId, reason, userId, category);
    
    if (!success) {
      res.status(404).json({
        success: false,
        error: 'SLA tracker not found or already paused'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'SLA tracker paused successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to pause SLA tracker'
    });
  }
});

// Resume SLA tracker (Admin, Supervisor)
router.post('/tracker/:trackerId/resume', requireAuth, requireRole(['Admin', 'Supervisor']), async (req, res) => {
  try {
    const { trackerId } = req.params;
    const userId = (req as any).user?.id;
    
    const success = await slaEngine.resumeSlaTracker(trackerId, userId);
    
    if (!success) {
      res.status(404).json({
        success: false,
        error: 'SLA tracker not found or not paused'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'SLA tracker resumed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to resume SLA tracker'
    });
  }
});

// Get SLA metrics and analytics (Admin, Supervisor, Client)
router.get('/metrics/analytics', requireAuth, requireRole(['Admin', 'Supervisor', 'Client']), async (req, res) => {
  try {
    const { startDate, endDate, clientId, entityType, priority } = req.query;
    
    const timeRange = {
      start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date()
    };
    
    const filters: any = {};
    if (clientId) filters.clientId = clientId;
    if (entityType) filters.entityType = entityType;
    if (priority) filters.priority = priority;
    
    const metrics = await slaEngine.generateMetrics(timeRange, filters);
    
    res.json({
      success: true,
      data: {
        timeRange,
        filters,
        metrics
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate SLA metrics'
    });
  }
});

// Start SLA Engine (Admin only)
router.post('/engine/start', requireAuth, requireRole(['Admin']), (req, res) => {
  try {
    slaEngine.start();
    res.json({
      success: true,
      message: 'SLA Engine started successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to start SLA Engine'
    });
  }
});

// Stop SLA Engine (Admin only)
router.post('/engine/stop', requireAuth, requireRole(['Admin']), (req, res) => {
  try {
    slaEngine.stop();
    res.json({
      success: true,
      message: 'SLA Engine stopped successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to stop SLA Engine'
    });
  }
});

export default router;
