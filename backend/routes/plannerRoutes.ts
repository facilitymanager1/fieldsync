import { Router } from 'express';
import { 
  scheduleWorkOrder, 
  optimizeScheduleForPeriod,
  getSchedulingMetrics,
  analyzeResourceOptimization,
  AdvancedSchedulingEngine
} from '../modules/planner';
import { 
  WorkOrder, 
  ScheduledTask, 
  SchedulingOptimization,
  SchedulingMetrics,
  IWorkOrder,
  IScheduledTask,
  IResourceAvailability
} from '../models/planner';
import { requireAuth, requireRole } from '../modules/authentication';

const router = Router();

// Work Order Management Routes

// Create new work order
router.post('/work-orders', requireAuth, requireRole(['Supervisor', 'Admin', 'SiteStaff']), async (req, res) => {
  try {
    const workOrderData: IWorkOrder = {
      id: `wo_${Date.now()}`,
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending'
    };

    const workOrder = new WorkOrder(workOrderData);
    await workOrder.save();

    res.status(201).json({
      success: true,
      data: workOrder,
      message: 'Work order created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to create work order'
    });
  }
});

// Get all work orders with filtering and pagination
router.get('/work-orders', requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      startDate,
      endDate,
      clientId,
      search
    } = req.query;

    const filter: any = {};

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (clientId) filter.clientId = clientId;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const workOrders = await WorkOrder.find(filter)
      .sort({ createdAt: -1, priority: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await WorkOrder.countDocuments(filter);

    res.json({
      success: true,
      data: {
        workOrders,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch work orders'
    });
  }
});

// Get specific work order
router.get('/work-orders/:id', requireAuth, async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOne({ id: req.params.id });

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: 'Work order not found'
      });
    }

    res.json({
      success: true,
      data: workOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch work order'
    });
  }
});

// Update work order
router.put('/work-orders/:id', requireAuth, requireRole(['Supervisor', 'Admin', 'SiteStaff']), async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOneAndUpdate(
      { id: req.params.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: 'Work order not found'
      });
    }

    res.json({
      success: true,
      data: workOrder,
      message: 'Work order updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to update work order'
    });
  }
});

// Delete work order
router.delete('/work-orders/:id', requireAuth, requireRole(['Admin', 'Supervisor']), async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOneAndDelete({ id: req.params.id });

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: 'Work order not found'
      });
    }

    res.json({
      success: true,
      message: 'Work order deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to delete work order'
    });
  }
});

// Advanced Scheduling Routes

// Schedule single work order
router.post('/schedule/work-order/:id', requireAuth, requireRole(['Supervisor', 'Admin', 'SiteStaff']), async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOne({ id: req.params.id });

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: 'Work order not found'
      });
    }

    const scheduledTask = await scheduleWorkOrder(workOrder);

    if (!scheduledTask) {
      return res.status(400).json({
        success: false,
        error: 'Unable to schedule work order - no available resources or time slots'
      });
    }

    res.json({
      success: true,
      data: scheduledTask,
      message: 'Work order scheduled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to schedule work order'
    });
  }
});

// Optimize schedule for a period
router.post('/optimize', requireAuth, requireRole(['Supervisor', 'Admin']), async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      algorithm = 'hybrid',
      objectives = [
        { type: 'minimize_travel_time', weight: 0.3 },
        { type: 'maximize_utilization', weight: 0.3 },
        { type: 'minimize_cost', weight: 0.2 },
        { type: 'maximize_customer_satisfaction', weight: 0.2 }
      ]
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const optimizationResult = await optimizeScheduleForPeriod(
      new Date(startDate),
      new Date(endDate),
      algorithm
    );

    res.json({
      success: true,
      data: optimizationResult,
      message: `Schedule optimized using ${algorithm} algorithm`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to optimize schedule'
    });
  }
});

// Run custom optimization with parameters
router.post('/optimize/custom', requireAuth, requireRole(['Admin']), async (req, res) => {
  try {
    const {
      workOrderIds,
      resourceIds,
      algorithm,
      objectives,
      constraints = []
    } = req.body;

    // Fetch work orders
    const workOrders = await WorkOrder.find({
      id: { $in: workOrderIds },
      status: 'pending'
    });

    // Create mock resource availability (in production, fetch from resource management system)
    const resources: IResourceAvailability[] = resourceIds.map((id: string) => ({
      resourceId: id,
      resourceType: 'staff',
      availableSlots: [
        {
          start: new Date(),
          end: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
          capacity: 1
        }
      ],
      skills: ['general'],
      certifications: []
    }));

    const schedulingEngine = new AdvancedSchedulingEngine();
    const result = await schedulingEngine.optimizeSchedule(
      workOrders,
      resources,
      constraints,
      algorithm,
      objectives
    );

    res.json({
      success: true,
      data: result,
      message: 'Custom optimization completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to run custom optimization'
    });
  }
});

// Scheduled Task Management Routes

// Get scheduled tasks
router.get('/scheduled-tasks', requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      resourceId,
      startDate,
      endDate
    } = req.query;

    const filter: any = {};

    if (status) filter.status = status;
    if (resourceId) filter['assignedResources.resourceId'] = resourceId;
    
    if (startDate || endDate) {
      filter.scheduledStart = {};
      if (startDate) filter.scheduledStart.$gte = new Date(startDate as string);
      if (endDate) filter.scheduledStart.$lte = new Date(endDate as string);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const scheduledTasks = await ScheduledTask.find(filter)
      .sort({ scheduledStart: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await ScheduledTask.countDocuments(filter);

    res.json({
      success: true,
      data: {
        scheduledTasks,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch scheduled tasks'
    });
  }
});

// Get scheduled tasks for specific resource
router.get('/scheduled-tasks/resource/:resourceId', requireAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { startDate, endDate } = req.query;

    const filter: any = {
      'assignedResources.resourceId': resourceId
    };

    if (startDate || endDate) {
      filter.scheduledStart = {};
      if (startDate) filter.scheduledStart.$gte = new Date(startDate as string);
      if (endDate) filter.scheduledStart.$lte = new Date(endDate as string);
    }

    const scheduledTasks = await ScheduledTask.find(filter)
      .sort({ scheduledStart: 1 });

    res.json({
      success: true,
      data: scheduledTasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch resource schedule'
    });
  }
});

// Update scheduled task status
router.put('/scheduled-tasks/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actualStart, actualEnd, notes } = req.body;

    const updateData: any = { status, updatedAt: new Date() };
    if (actualStart) updateData.actualStart = new Date(actualStart);
    if (actualEnd) updateData.actualEnd = new Date(actualEnd);
    if (notes) updateData.notes = notes;

    const scheduledTask = await ScheduledTask.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!scheduledTask) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled task not found'
      });
    }

    res.json({
      success: true,
      data: scheduledTask,
      message: 'Scheduled task updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to update scheduled task'
    });
  }
});

// Analytics and Metrics Routes

// Get scheduling metrics
router.get('/metrics', requireAuth, requireRole(['Supervisor', 'Admin']), async (req, res) => {
  try {
    const { date, period = 'daily' } = req.query;

    let targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const metrics = await getSchedulingMetrics(targetDate);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'No metrics found for the specified date'
      });
    }

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch scheduling metrics'
    });
  }
});

// Get optimization history
router.get('/optimizations', requireAuth, requireRole(['Supervisor', 'Admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, algorithm } = req.query;

    const filter: any = {};
    if (algorithm) filter.algorithm = algorithm;

    const skip = (Number(page) - 1) * Number(limit);
    const optimizations = await SchedulingOptimization.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await SchedulingOptimization.countDocuments(filter);

    res.json({
      success: true,
      data: {
        optimizations,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch optimization history'
    });
  }
});

// Resource optimization analysis
router.get('/resource-optimization/:resourceId', requireAuth, requireRole(['Supervisor', 'Admin']), async (req, res) => {
  try {
    const { resourceId } = req.params;

    const optimization = await analyzeResourceOptimization(resourceId);

    res.json({
      success: true,
      data: optimization,
      message: 'Resource optimization analysis completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to analyze resource optimization'
    });
  }
});

// Calendar integration routes

// Export schedule to calendar format
router.get('/calendar/export', requireAuth, async (req, res) => {
  try {
    const { resourceId, startDate, endDate, format = 'ical' } = req.query;

    const filter: any = {};
    if (resourceId) filter['assignedResources.resourceId'] = resourceId;
    
    if (startDate || endDate) {
      filter.scheduledStart = {};
      if (startDate) filter.scheduledStart.$gte = new Date(startDate as string);
      if (endDate) filter.scheduledStart.$lte = new Date(endDate as string);
    }

    const scheduledTasks = await ScheduledTask.find(filter)
      .sort({ scheduledStart: 1 });

    // Generate calendar format (simplified iCal format)
    let calendarData = '';
    
    if (format === 'ical') {
      calendarData = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:FieldSync\n';
      
      for (const task of scheduledTasks) {
        const workOrder = await WorkOrder.findOne({ id: task.workOrderId });
        if (workOrder) {
          calendarData += `BEGIN:VEVENT\n`;
          calendarData += `UID:${task.id}\n`;
          calendarData += `DTSTART:${task.scheduledStart.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
          calendarData += `DTEND:${task.scheduledEnd.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
          calendarData += `SUMMARY:${workOrder.title}\n`;
          calendarData += `DESCRIPTION:${workOrder.description}\n`;
          calendarData += `LOCATION:${workOrder.location.address}\n`;
          calendarData += `END:VEVENT\n`;
        }
      }
      
      calendarData += 'END:VCALENDAR';
    }

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="schedule.ics"');
    res.send(calendarData);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to export calendar'
    });
  }
});

// Dashboard summary
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's statistics
    const todayStats = await Promise.all([
      WorkOrder.countDocuments({ 
        status: 'pending',
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      WorkOrder.countDocuments({ 
        status: 'scheduled',
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      WorkOrder.countDocuments({ 
        status: 'completed',
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      ScheduledTask.countDocuments({
        scheduledStart: { $gte: today, $lt: tomorrow }
      })
    ]);

    // Get recent optimizations
    const recentOptimizations = await SchedulingOptimization.find()
      .sort({ createdAt: -1 })
      .limit(5);

    // Get upcoming high-priority tasks
    const upcomingTasks = await ScheduledTask.find({
      scheduledStart: { $gte: today },
      status: { $in: ['scheduled', 'confirmed'] }
    })
      .sort({ scheduledStart: 1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        statistics: {
          pendingWorkOrders: todayStats[0],
          scheduledWorkOrders: todayStats[1],
          completedWorkOrders: todayStats[2],
          todaysTasks: todayStats[3]
        },
        recentOptimizations,
        upcomingTasks
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch dashboard data'
    });
  }
});

export default router;
