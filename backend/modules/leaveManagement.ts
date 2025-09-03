// Leave Management module
// Handles leave types, accrual, approval, calendar sync
import { Request, Response } from 'express';
import { Leave } from '../models/leave';
import { User } from '../models/user';
import { auditLogger } from '../middleware/auditLogger';
import { notification } from './notification';

// Leave interfaces
export interface ILeaveRequest {
  _id?: string;
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'personal' | 'maternity' | 'paternity' | 'bereavement' | 'emergency' | 'unpaid';
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  rejectionReason?: string;
  isHalfDay: boolean;
  halfDayPeriod?: 'morning' | 'afternoon';
  attachments?: {
    name: string;
    url: string;
    type: string;
  }[];
  submittedAt: Date;
  respondedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ILeaveBalance {
  employeeId: string;
  year: number;
  annual: {
    allocated: number;
    used: number;
    pending: number;
    remaining: number;
  };
  sick: {
    allocated: number;
    used: number;
    pending: number;
    remaining: number;
  };
  personal: {
    allocated: number;
    used: number;
    pending: number;
    remaining: number;
  };
  lastUpdated: Date;
}

export interface ILeavePolicy {
  _id?: string;
  leaveType: string;
  annualAllocation: number;
  maxConsecutiveDays: number;
  minNoticeDays: number;
  maxCarryOver: number;
  allowNegativeBalance: boolean;
  requiresApproval: boolean;
  requiresDocumentation: boolean;
  isActive: boolean;
  roles: string[];
  blackoutPeriods?: {
    startDate: Date;
    endDate: Date;
    reason: string;
  }[];
}

/**
 * Request leave
 */
export async function requestLeave(req: Request, res: Response) {
  try {
    const employeeId = req.user?.id;
    const {
      leaveType,
      startDate,
      endDate,
      reason,
      isHalfDay = false,
      halfDayPeriod,
      attachments = []
    } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Leave type, dates, and reason are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (start > end) {
      return res.status(400).json({
        success: false,
        error: 'Start date cannot be after end date'
      });
    }

    // Calculate total days
    const totalDays = isHalfDay ? 0.5 : Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check leave policy
    const policy = await getLeavePolicy(leaveType);
    if (!policy) {
      return res.status(400).json({
        success: false,
        error: 'Invalid leave type'
      });
    }

    // Validate against policy
    const validationResult = await validateLeaveRequest({
      employeeId,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays,
      isHalfDay
    }, policy);

    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: validationResult.error
      });
    }

    // Check for overlapping leave requests
    const overlappingLeave = await Leave.findOne({
      employeeId,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (overlappingLeave) {
      return res.status(400).json({
        success: false,
        error: 'You have an overlapping leave request'
      });
    }

    // Create leave request
    const leaveRequest: Partial<ILeaveRequest> = {
      employeeId,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays,
      reason,
      status: 'pending',
      isHalfDay,
      halfDayPeriod,
      attachments,
      submittedAt: new Date()
    };

    const leave = await Leave.create(leaveRequest);

    // Update leave balance (pending)
    await updateLeaveBalance(employeeId, leaveType, totalDays, 'pending');

    // Notify approvers
    await notifyApprovers(leave._id.toString(), employeeId);

    // Log leave request
    auditLogger.info('Leave request submitted', {
      userId: employeeId,
      action: 'SUBMIT_LEAVE_REQUEST',
      resource: 'leave_request',
      resourceId: leave._id.toString(),
      changes: leaveRequest
    });

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: {
        leave: await Leave.findById(leave._id)
          .populate('employeeId', 'name email')
          .populate('approvedBy', 'name email')
          .lean()
      }
    });

  } catch (error) {
    console.error('Error requesting leave:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit leave request'
    });
  }
}

/**
 * Get leave requests
 */
export async function getLeaveRequests(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const {
      status,
      employeeId,
      leaveType,
      startDate,
      endDate,
      limit = 20,
      offset = 0
    } = req.query;

    // Build filters
    const filters: any = {};

    // Role-based filtering
    if (['admin', 'supervisor'].includes(userRole)) {
      if (employeeId) filters.employeeId = employeeId;
    } else {
      filters.employeeId = userId;
    }

    if (status) filters.status = status;
    if (leaveType) filters.leaveType = leaveType;

    // Date range filter
    if (startDate || endDate) {
      filters.startDate = {};
      if (startDate) filters.startDate.$gte = new Date(startDate as string);
      if (endDate) filters.startDate.$lte = new Date(endDate as string);
    }

    const [leaveRequests, totalCount] = await Promise.all([
      Leave.find(filters)
        .populate('employeeId', 'name email department')
        .populate('approvedBy', 'name email')
        .sort({ submittedAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .lean(),
      Leave.countDocuments(filters)
    ]);

    res.json({
      success: true,
      data: {
        leaveRequests,
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error getting leave requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve leave requests'
    });
  }
}

/**
 * Approve or reject leave request
 */
export async function approveLeaveRequest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body; // 'approve' or 'reject'
    const approverId = req.user?.id;
    const userRole = req.user?.role;

    // Check if user can approve
    if (!['admin', 'supervisor'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const leaveRequest = await Leave.findById(id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found'
      });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Leave request has already been processed'
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    // Update leave request
    const updateData: any = {
      status: newStatus,
      approvedBy: approverId,
      respondedAt: new Date()
    };

    if (action === 'reject' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    await Leave.findByIdAndUpdate(id, updateData);

    // Update leave balance
    if (action === 'approve') {
      // Move from pending to used
      await updateLeaveBalance(
        leaveRequest.employeeId,
        leaveRequest.leaveType,
        leaveRequest.totalDays,
        'used'
      );
      await updateLeaveBalance(
        leaveRequest.employeeId,
        leaveRequest.leaveType,
        -leaveRequest.totalDays,
        'pending'
      );
    } else {
      // Remove from pending
      await updateLeaveBalance(
        leaveRequest.employeeId,
        leaveRequest.leaveType,
        -leaveRequest.totalDays,
        'pending'
      );
    }

    // Notify employee
    await notification.sendNotification({
      userId: leaveRequest.employeeId,
      title: `Leave Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
      message: `Your leave request from ${leaveRequest.startDate.toLocaleDateString()} has been ${action}d`,
      type: action === 'approve' ? 'success' : 'warning',
      priority: 'medium'
    });

    // Log approval/rejection
    auditLogger.info('Leave request processed', {
      userId: approverId,
      action: action === 'approve' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      resource: 'leave_request',
      resourceId: id,
      changes: updateData
    });

    res.json({
      success: true,
      message: `Leave request ${action}d successfully`,
      data: {
        leave: await Leave.findById(id)
          .populate('employeeId', 'name email')
          .populate('approvedBy', 'name email')
          .lean()
      }
    });

  } catch (error) {
    console.error('Error processing leave request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process leave request'
    });
  }
}

/**
 * Cancel leave request
 */
export async function cancelLeaveRequest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const leaveRequest = await Leave.findById(id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found'
      });
    }

    // Check permissions
    const canCancel = leaveRequest.employeeId.toString() === userId || 
                     ['admin', 'supervisor'].includes(userRole);

    if (!canCancel) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (['cancelled', 'rejected'].includes(leaveRequest.status)) {
      return res.status(400).json({
        success: false,
        error: 'Leave request is already cancelled or rejected'
      });
    }

    // Update status
    await Leave.findByIdAndUpdate(id, {
      status: 'cancelled',
      respondedAt: new Date()
    });

    // Restore leave balance
    if (leaveRequest.status === 'pending') {
      await updateLeaveBalance(
        leaveRequest.employeeId,
        leaveRequest.leaveType,
        -leaveRequest.totalDays,
        'pending'
      );
    } else if (leaveRequest.status === 'approved') {
      await updateLeaveBalance(
        leaveRequest.employeeId,
        leaveRequest.leaveType,
        -leaveRequest.totalDays,
        'used'
      );
    }

    // Log cancellation
    auditLogger.info('Leave request cancelled', {
      userId,
      action: 'CANCEL_LEAVE',
      resource: 'leave_request',
      resourceId: id
    });

    res.json({
      success: true,
      message: 'Leave request cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling leave request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel leave request'
    });
  }
}

/**
 * Get leave balance for employee
 */
export async function getLeaveBalance(req: Request, res: Response) {
  try {
    const { employeeId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Check permissions
    const canView = employeeId === userId || ['admin', 'supervisor'].includes(userRole);

    if (!canView) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const balance = await calculateLeaveBalance(employeeId, year);

    res.json({
      success: true,
      data: { balance }
    });

  } catch (error) {
    console.error('Error getting leave balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve leave balance'
    });
  }
}

/**
 * Get leave calendar
 */
export async function getLeaveCalendar(req: Request, res: Response) {
  try {
    const { startDate, endDate, departmentId } = req.query;
    const userRole = req.user?.role;

    if (!['admin', 'supervisor'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const filters: any = {
      status: 'approved',
      startDate: { $gte: new Date(startDate as string) },
      endDate: { $lte: new Date(endDate as string) }
    };

    if (departmentId) {
      // Filter by department - would need to join with User model
    }

    const leaveCalendar = await Leave.find(filters)
      .populate('employeeId', 'name email department')
      .select('employeeId leaveType startDate endDate totalDays')
      .lean();

    res.json({
      success: true,
      data: { calendar: leaveCalendar }
    });

  } catch (error) {
    console.error('Error getting leave calendar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve leave calendar'
    });
  }
}

/**
 * Get leave statistics
 */
export async function getLeaveStatistics(req: Request, res: Response) {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const userRole = req.user?.role;

    if (!['admin', 'supervisor'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      leaveTypeStats,
      monthlyStats
    ] = await Promise.all([
      Leave.countDocuments({
        submittedAt: { $gte: startOfYear, $lte: endOfYear }
      }),
      Leave.countDocuments({
        status: 'pending',
        submittedAt: { $gte: startOfYear, $lte: endOfYear }
      }),
      Leave.countDocuments({
        status: 'approved',
        submittedAt: { $gte: startOfYear, $lte: endOfYear }
      }),
      Leave.countDocuments({
        status: 'rejected',
        submittedAt: { $gte: startOfYear, $lte: endOfYear }
      }),
      Leave.aggregate([
        { $match: { submittedAt: { $gte: startOfYear, $lte: endOfYear } } },
        { $group: { _id: '$leaveType', count: { $sum: 1 }, totalDays: { $sum: '$totalDays' } } },
        { $sort: { count: -1 } }
      ]),
      Leave.aggregate([
        { $match: { submittedAt: { $gte: startOfYear, $lte: endOfYear } } },
        { $group: { 
          _id: { $month: '$submittedAt' },
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' }
        }},
        { $sort: { _id: 1 } }
      ])
    ]);

    const statistics = {
      overview: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        approvalRate: totalRequests > 0 ? (approvedRequests / totalRequests * 100).toFixed(1) : 0
      },
      leaveTypes: leaveTypeStats.map(stat => ({
        type: stat._id,
        count: stat.count,
        totalDays: stat.totalDays
      })),
      monthly: monthlyStats.map(stat => ({
        month: stat._id,
        count: stat.count,
        totalDays: stat.totalDays
      }))
    };

    res.json({
      success: true,
      data: { statistics }
    });

  } catch (error) {
    console.error('Error getting leave statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve leave statistics'
    });
  }
}

// Utility functions

async function getLeavePolicy(leaveType: string): Promise<ILeavePolicy | null> {
  // This would typically fetch from a leave policies collection
  // For now, return default policies
  const defaultPolicies: Record<string, ILeavePolicy> = {
    annual: {
      leaveType: 'annual',
      annualAllocation: 20,
      maxConsecutiveDays: 10,
      minNoticeDays: 14,
      maxCarryOver: 5,
      allowNegativeBalance: false,
      requiresApproval: true,
      requiresDocumentation: false,
      isActive: true,
      roles: ['employee', 'supervisor', 'admin']
    },
    sick: {
      leaveType: 'sick',
      annualAllocation: 10,
      maxConsecutiveDays: 5,
      minNoticeDays: 0,
      maxCarryOver: 0,
      allowNegativeBalance: false,
      requiresApproval: true,
      requiresDocumentation: true,
      isActive: true,
      roles: ['employee', 'supervisor', 'admin']
    },
    personal: {
      leaveType: 'personal',
      annualAllocation: 5,
      maxConsecutiveDays: 3,
      minNoticeDays: 7,
      maxCarryOver: 2,
      allowNegativeBalance: false,
      requiresApproval: true,
      requiresDocumentation: false,
      isActive: true,
      roles: ['employee', 'supervisor', 'admin']
    }
  };

  return defaultPolicies[leaveType] || null;
}

async function validateLeaveRequest(request: any, policy: ILeavePolicy) {
  const errors: string[] = [];

  // Check minimum notice period
  const daysDifference = Math.ceil((request.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysDifference < policy.minNoticeDays) {
    errors.push(`Minimum ${policy.minNoticeDays} days notice required`);
  }

  // Check maximum consecutive days
  if (request.totalDays > policy.maxConsecutiveDays) {
    errors.push(`Maximum ${policy.maxConsecutiveDays} consecutive days allowed`);
  }

  // Check leave balance
  const balance = await calculateLeaveBalance(request.employeeId, request.startDate.getFullYear());
  const typeBalance = balance[request.leaveType as keyof typeof balance];
  
  if (typeBalance && typeBalance.remaining < request.totalDays) {
    if (!policy.allowNegativeBalance) {
      errors.push('Insufficient leave balance');
    }
  }

  return {
    valid: errors.length === 0,
    error: errors.join(', ')
  };
}

async function updateLeaveBalance(employeeId: string, leaveType: string, days: number, type: 'used' | 'pending') {
  // This would update the leave balance in the database
  // Implementation would depend on your balance tracking system
  console.log(`Updating leave balance: ${employeeId}, ${leaveType}, ${days} days, ${type}`);
}

async function calculateLeaveBalance(employeeId: string, year: number): Promise<ILeaveBalance> {
  // Calculate leave balance based on policies and used leave
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const leaveUsage = await Leave.aggregate([
    {
      $match: {
        employeeId,
        startDate: { $gte: startOfYear, $lte: endOfYear },
        status: { $in: ['approved', 'pending'] }
      }
    },
    {
      $group: {
        _id: { leaveType: '$leaveType', status: '$status' },
        totalDays: { $sum: '$totalDays' }
      }
    }
  ]);

  // Default allocations (would come from policies)
  const allocations = {
    annual: 20,
    sick: 10,
    personal: 5
  };

  const balance: ILeaveBalance = {
    employeeId,
    year,
    annual: {
      allocated: allocations.annual,
      used: 0,
      pending: 0,
      remaining: allocations.annual
    },
    sick: {
      allocated: allocations.sick,
      used: 0,
      pending: 0,
      remaining: allocations.sick
    },
    personal: {
      allocated: allocations.personal,
      used: 0,
      pending: 0,
      remaining: allocations.personal
    },
    lastUpdated: new Date()
  };

  // Update with actual usage
  leaveUsage.forEach(usage => {
    const leaveType = usage._id.leaveType as keyof typeof balance;
    const status = usage._id.status;
    
    if (balance[leaveType] && typeof balance[leaveType] === 'object') {
      if (status === 'approved') {
        (balance[leaveType] as any).used += usage.totalDays;
      } else if (status === 'pending') {
        (balance[leaveType] as any).pending += usage.totalDays;
      }
      (balance[leaveType] as any).remaining = 
        (balance[leaveType] as any).allocated - 
        (balance[leaveType] as any).used - 
        (balance[leaveType] as any).pending;
    }
  });

  return balance;
}

async function notifyApprovers(leaveId: string, employeeId: string) {
  // Get approvers (supervisors and admins)
  const approvers = await User.find({
    role: { $in: ['admin', 'supervisor'] }
  }).select('_id name email');

  // Send notifications
  for (const approver of approvers) {
    await notification.sendNotification({
      userId: approver._id.toString(),
      title: 'New Leave Request',
      message: `A new leave request requires your approval`,
      type: 'info',
      priority: 'medium',
      actionUrl: `/dashboard/leave/${leaveId}`
    });
  }
}

// Export functions
export {
  getLeaveRequests,
  approveLeaveRequest,
  cancelLeaveRequest,
  getLeaveBalance,
  getLeaveCalendar,
  getLeaveStatistics,
  ILeaveRequest,
  ILeaveBalance,
  ILeavePolicy
};