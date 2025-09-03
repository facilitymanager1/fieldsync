import { Router } from 'express';
import { 
  getGeofences, 
  processGeofenceEvent,
  GeofenceModel,
  GeofenceEventModel,
  geofenceManager,
  GeofenceEventType
} from '../modules/geofence';
import { requireAuth, requireRole } from '../modules/authentication';
import loggingService from '../services/loggingService';

const router = Router();

// GET /geofence (all authenticated roles)
router.get('/', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), getGeofences);

// GET /geofence/:id (all authenticated roles)
router.get('/:id', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), async (req, res) => {
  try {
    const { id } = req.params;
    const geofence = await GeofenceModel.findById(id).lean().exec();
    
    if (!geofence) {
      res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: geofence
    });
  } catch (error) {
    loggingService.error('Failed to get geofence', error, { geofenceId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve geofence'
    });
  }
});

// POST /geofence (Admin, Supervisor)
router.post('/', requireAuth, requireRole(['Admin', 'Supervisor']), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const geofenceData = {
      ...req.body,
      createdBy: userId,
      updatedBy: userId
    };
    
    const geofence = new GeofenceModel(geofenceData);
    const savedGeofence = await geofence.save();
    
    res.status(201).json({
      success: true,
      message: 'Geofence created successfully',
      data: savedGeofence.toObject()
    });
  } catch (error) {
    loggingService.error('Failed to create geofence', error, { body: req.body });
    res.status(500).json({
      success: false,
      error: 'Failed to create geofence'
    });
  }
});

// PUT /geofence/:id (Admin, Supervisor)
router.put('/:id', requireAuth, requireRole(['Admin', 'Supervisor']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    const updatedGeofence = await GeofenceModel.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updatedBy: userId,
        updatedAt: new Date(),
        $inc: { version: 1 }
      },
      { new: true }
    ).exec();
    
    if (!updatedGeofence) {
      res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Geofence updated successfully',
      data: updatedGeofence.toObject()
    });
  } catch (error) {
    loggingService.error('Failed to update geofence', error, { 
      geofenceId: req.params.id, 
      body: req.body 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update geofence'
    });
  }
});

// DELETE /geofence/:id (Admin only)
router.delete('/:id', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedGeofence = await GeofenceModel.findByIdAndDelete(id).exec();
    
    if (!deletedGeofence) {
      res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Geofence deleted successfully'
    });
  } catch (error) {
    loggingService.error('Failed to delete geofence', error, { geofenceId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to delete geofence'
    });
  }
});

// POST /geofence/event (FieldTech, SiteStaff) - Process geofence events
router.post('/event', requireAuth, requireRole(['FieldTech', 'SiteStaff']), async (req, res) => {
  try {
    const { geofenceId, eventType, location, shiftId } = req.body;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    
    if (!geofenceId || !eventType || !location) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: geofenceId, eventType, location'
      });
      return;
    }
    
    const event = await processGeofenceEvent(
      geofenceId,
      userId,
      eventType as GeofenceEventType,
      location,
      userRole,
      shiftId
    );
    
    if (!event) {
      res.json({
        success: true,
        message: 'Event processed but no actions triggered (cooldown or conditions not met)',
        data: null
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Geofence event processed successfully',
      data: event
    });
  } catch (error) {
    loggingService.error('Failed to process geofence event', error, { body: req.body });
    res.status(500).json({
      success: false,
      error: 'Failed to process geofence event'
    });
  }
});

// GET /geofence/events/history (all authenticated roles)
router.get('/events/history', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), async (req, res) => {
  try {
    const {
      geofenceId,
      userId,
      eventType,
      startDate,
      endDate,
      page = '1',
      limit = '20'
    } = req.query;
    
    const query: any = {};
    
    if (geofenceId) query.geofenceId = geofenceId;
    if (userId) query.userId = userId;
    if (eventType) query.eventType = eventType;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    const [events, total] = await Promise.all([
      GeofenceEventModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      GeofenceEventModel.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    loggingService.error('Failed to get geofence events', error, { query: req.query });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve geofence events'
    });
  }
});

// GET /geofence/:id/events (all authenticated roles) - Get events for specific geofence
router.get('/:id/events', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      startDate, 
      endDate, 
      eventType,
      page = '1', 
      limit = '20' 
    } = req.query;
    
    const query: any = { geofenceId: id };
    
    if (eventType) query.eventType = eventType;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    const [events, total] = await Promise.all([
      GeofenceEventModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      GeofenceEventModel.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    loggingService.error('Failed to get geofence events', error, { 
      geofenceId: req.params.id,
      query: req.query 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve geofence events'
    });
  }
});

// POST /geofence/check-location (FieldTech, SiteStaff) - Check if location is in any geofence
router.post('/check-location', requireAuth, requireRole(['FieldTech', 'SiteStaff']), async (req, res) => {
  try {
    const { location } = req.body;
    const userRole = (req as any).user?.role;
    
    if (!location || !location.latitude || !location.longitude) {
      res.status(400).json({
        success: false,
        error: 'Invalid location data'
      });
      return;
    }
    
    // Find all active geofences that user has access to
    const geofences = await GeofenceModel.find({
      status: 'active',
      allowedRoles: { $in: [userRole] },
      $nor: [
        { restrictedRoles: { $in: [userRole] } }
      ]
    }).lean().exec();
    
    const matches = [];
    
    for (const geofence of geofences) {
      const isInside = geofenceManager.isLocationInGeofence(location, geofence);
      if (isInside) {
        matches.push({
          geofence: {
            id: geofence._id,
            name: geofence.name,
            type: geofence.type,
            triggers: geofence.triggers
          },
          distance: 0 // User is inside
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        location,
        matches,
        timestamp: new Date()
      }
    });
  } catch (error) {
    loggingService.error('Failed to check location against geofences', error, { body: req.body });
    res.status(500).json({
      success: false,
      error: 'Failed to check location'
    });
  }
});

export default router;
