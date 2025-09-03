/**
 * Notification API Routes - REST endpoints for notification system
 * Handles CRUD operations for approval notifications
 */

import express, { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ApprovalNotification } from '../models/approval';

const router = express.Router();

/**
 * GET /api/notifications
 * Get notifications for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      types,
      roles,
      isRead,
      fromDate,
      toDate,
      page = 1,
      limit = 20
    } = req.query;

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Build query based on user role and filters
    const query: any = {
      $or: [
        { recipientRole: req.user.role },
        { recipientId: new Types.ObjectId(req.user.id) }
      ]
    };

    // Apply filters
    if (types) {
      const typeArray = (types as string).split(',');
      query.type = { $in: typeArray };
    }

    if (roles) {
      const roleArray = (roles as string).split(',');
      query.recipientRole = { $in: roleArray };
    }

    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate as string);
      if (toDate) query.createdAt.$lte = new Date(toDate as string);
    }

    // Execute query with pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const [notifications, totalCount, unreadCount] = await Promise.all([
      ApprovalNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .populate('employeeApprovalId', 'tempId permanentId')
        .lean(),
      
      ApprovalNotification.countDocuments(query),
      
      ApprovalNotification.countDocuments({
        ...query,
        isRead: false
      })
    ]);

    res.json({
      notifications: notifications.map(notification => ({
        id: notification._id,
        type: notification.type,
        employeeId: notification.employeeId,
        employeeName: notification.employeeName,
        message: notification.message,
        recipientRole: notification.recipientRole,
        recipientId: notification.recipientId,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        actionUrl: notification.actionUrl
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit as string))
      },
      unreadCount
    });

  } catch (error) {
    console.error('Error in GET /notifications:', error);
    res.status(500).json({ 
      error: 'Failed to fetch notifications',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/notifications/:id/read
 * Mark specific notification as read
 */
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Update notification
    const notification = await ApprovalNotification.findOneAndUpdate(
      { 
        _id: new Types.ObjectId(id),
        $or: [
          { recipientRole: req.user.role },
          { recipientId: new Types.ObjectId(req.user.id) }
        ]
      },
      { 
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });

  } catch (error) {
    console.error('Error in POST /notifications/:id/read:', error);
    res.status(500).json({ 
      error: 'Failed to mark notification as read',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for current user
 */
router.post('/mark-all-read', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Update all unread notifications for this user
    const result = await ApprovalNotification.updateMany(
      {
        $or: [
          { recipientRole: req.user.role },
          { recipientId: new Types.ObjectId(req.user.id) }
        ],
        isRead: false
      },
      { 
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({ 
      success: true, 
      message: `${result.modifiedCount} notifications marked as read` 
    });

  } catch (error) {
    console.error('Error in POST /notifications/mark-all-read:', error);
    res.status(500).json({ 
      error: 'Failed to mark all notifications as read',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete specific notification
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Delete notification
    const notification = await ApprovalNotification.findOneAndDelete({
      _id: new Types.ObjectId(id),
      $or: [
        { recipientRole: req.user.role },
        { recipientId: new Types.ObjectId(req.user.id) }
      ]
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted successfully' });

  } catch (error) {
    console.error('Error in DELETE /notifications/:id:', error);
    res.status(500).json({ 
      error: 'Failed to delete notification',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/notifications/send
 * Send custom notification (admin/system use)
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Only admins and HR can send custom notifications
    if (req.user.role !== 'admin' && req.user.role !== 'hr') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const {
      type,
      message,
      recipientRole,
      recipientId,
      employeeId,
      employeeName,
      actionUrl
    } = req.body;

    if (!type || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, message' 
      });
    }

    // Create notification
    const notification = new ApprovalNotification({
      type,
      employeeId: employeeId || 'system',
      employeeName: employeeName || 'System',
      message,
      recipientRole: recipientRole || 'user',
      recipientId: recipientId ? new Types.ObjectId(recipientId) : undefined,
      actionUrl,
      isRead: false
    });

    await notification.save();

    res.status(201).json({ 
      success: true, 
      message: 'Notification sent successfully',
      notificationId: notification._id
    });

  } catch (error) {
    console.error('Error in POST /notifications/send:', error);
    res.status(500).json({ 
      error: 'Failed to send notification',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
