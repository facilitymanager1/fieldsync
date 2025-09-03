/**
 * Approval API Routes - REST endpoints for HR approval workflow
 * Connects frontend to approval service layer
 */

import express, { Request, Response } from 'express';
import { Types } from 'mongoose';
import approvalService from '../services/approvalService';
import { EmployeeStatus } from '../models/approval';

const router = express.Router();

/**
 * GET /api/approvals
 * Get approval records with filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      status,
      validationStatus,
      search,
      priority,
      fromDate,
      toDate,
      page = 1,
      limit = 20
    } = req.query;

    // Build filters object
    const filters: any = {};

    if (status) {
      const statusArray = (status as string).split(',') as EmployeeStatus[];
      filters.status = statusArray;
    }

    if (validationStatus) {
      filters.validationStatus = validationStatus as 'pending' | 'partial' | 'complete';
    }

    if (search) {
      filters.searchQuery = search as string;
    }

    if (priority) {
      const priorityArray = (priority as string).split(',');
      filters.priority = priorityArray;
    }

    if (req.user?.role === 'field_officer') {
      filters.createdBy = new Types.ObjectId(req.user.id);
    }

    const result = await approvalService.getApprovals(
      filters,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json(result);

  } catch (error) {
    console.error('Error in GET /approvals:', error);
    res.status(500).json({ 
      error: 'Failed to fetch approvals',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/approvals/stats
 * Get approval dashboard statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await approvalService.getApprovalStats();
    res.json(stats);

  } catch (error) {
    console.error('Error in GET /approvals/stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch approval statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/approvals/:id
 * Get specific approval details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid approval ID' });
    }

    // Get single approval (this would need to be implemented in the service)
    const approval = await approvalService.getApprovals({ 
      _id: new Types.ObjectId(id) 
    } as any, 1, 1);

    if (approval.approvals.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json(approval.approvals[0]);

  } catch (error) {
    console.error('Error in GET /approvals/:id:', error);
    res.status(500).json({ 
      error: 'Failed to fetch approval details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/approvals/:id
 * Update single approval record
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid approval ID' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate required permissions
    if (req.user.role !== 'hr' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await approvalService.updateApproval(
      id,
      updateData,
      new Types.ObjectId(req.user.id),
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown'
    );

    res.json({ success: true, message: 'Approval updated successfully' });

  } catch (error) {
    console.error('Error in PUT /approvals/:id:', error);
    res.status(500).json({ 
      error: 'Failed to update approval',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/approvals/bulk-update
 * Bulk update multiple approvals
 */
router.post('/bulk-update', async (req: Request, res: Response) => {
  try {
    const { approvalIds, updateData } = req.body;

    if (!Array.isArray(approvalIds) || approvalIds.length === 0) {
      return res.status(400).json({ error: 'No approval IDs provided' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate required permissions
    if (req.user.role !== 'hr' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await approvalService.bulkUpdateApprovals(
      approvalIds,
      updateData,
      new Types.ObjectId(req.user.id),
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown'
    );

    res.json({ 
      success: true, 
      message: `${approvalIds.length} approvals updated successfully` 
    });

  } catch (error) {
    console.error('Error in POST /approvals/bulk-update:', error);
    res.status(500).json({ 
      error: 'Failed to bulk update approvals',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/approvals/:id/generate-permanent-id
 * Generate permanent employee ID
 */
router.post('/:id/generate-permanent-id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid approval ID' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Only HR and admins can generate permanent IDs
    if (req.user.role !== 'hr' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const permanentId = await approvalService.generatePermanentId();

    // Update the approval with the permanent ID
    await approvalService.updateApproval(
      id,
      { permanentId },
      new Types.ObjectId(req.user.id),
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown'
    );

    res.json({ 
      success: true, 
      permanentId,
      message: 'Permanent ID generated successfully' 
    });

  } catch (error) {
    console.error('Error in POST /approvals/:id/generate-permanent-id:', error);
    res.status(500).json({ 
      error: 'Failed to generate permanent ID',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/approvals/:id/history
 * Get approval history/events
 */
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid approval ID' });
    }

    // This would need to be implemented in the service
    // For now, return a placeholder
    const history = []; // await approvalService.getApprovalHistory(id);

    res.json(history);

  } catch (error) {
    console.error('Error in GET /approvals/:id/history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch approval history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/approvals/export
 * Export approvals data
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const {
      format = 'csv',
      status,
      validationStatus,
      search,
      priority
    } = req.query;

    // Build filters object
    const filters: any = {};

    if (status) {
      const statusArray = (status as string).split(',') as EmployeeStatus[];
      filters.status = statusArray;
    }

    if (validationStatus) {
      filters.validationStatus = validationStatus as 'pending' | 'partial' | 'complete';
    }

    if (search) {
      filters.searchQuery = search as string;
    }

    if (priority) {
      const priorityArray = (priority as string).split(',');
      filters.priority = priorityArray;
    }

    // Get all matching records (no pagination for export)
    const result = await approvalService.getApprovals(filters, 1, 10000);

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Temp ID', 'Permanent ID', 'Employee Name', 'Phone Number', 
        'Status', 'HR Validated', 'ESI Validated', 'PF Validated', 'UAN Validated',
        'Priority', 'Submitted Date', 'Approved Date', 'Rejection Reason'
      ].join(',');

      const csvRows = result.approvals.map(approval => [
        approval.tempId || '',
        approval.permanentId || '',
        approval.name,
        approval.phoneNumber,
        approval.status,
        approval.validationChecks.hr ? 'Yes' : 'No',
        approval.validationChecks.esi ? 'Yes' : 'No',
        approval.validationChecks.pf ? 'Yes' : 'No',
        approval.validationChecks.uan ? 'Yes' : 'No',
        approval.priority,
        approval.submittedAt.toISOString().split('T')[0],
        approval.approvedAt ? approval.approvedAt.toISOString().split('T')[0] : '',
        approval.rejectionReason || ''
      ].join(','));

      const csvContent = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="approvals-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);

    } else {
      // JSON export
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="approvals-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(result);
    }

  } catch (error) {
    console.error('Error in GET /approvals/export:', error);
    res.status(500).json({ 
      error: 'Failed to export approvals',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/approvals
 * Create new approval record (called when onboarding is submitted)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { onboardingRecordId, employeeId } = req.body;

    if (!onboardingRecordId || !employeeId) {
      return res.status(400).json({ 
        error: 'Missing required fields: onboardingRecordId, employeeId' 
      });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tempId = await approvalService.createApprovalRecord({
      onboardingRecordId: new Types.ObjectId(onboardingRecordId),
      employeeId,
      createdBy: new Types.ObjectId(req.user.id),
      source: 'mobile', // or determine from request
      ipAddress: req.ip || 'unknown',
      deviceInfo: req.get('User-Agent') || 'unknown'
    });

    res.status(201).json({ 
      success: true, 
      tempId,
      message: 'Approval record created successfully' 
    });

  } catch (error) {
    console.error('Error in POST /approvals:', error);
    res.status(500).json({ 
      error: 'Failed to create approval record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;