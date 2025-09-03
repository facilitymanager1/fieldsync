// Comprehensive Expense Management Service for FieldSync Backend
// Handles expense submission, approval workflows, policy validation, and analytics

import { Request, Response } from 'express';
import { 
  ExpenseEntry, 
  ExpensePolicy, 
  ExpenseReport,
  ApprovalStep,
  PolicyRule,
  PaymentInfo,
  ExpenseEntryModel,
  ExpensePolicyModel,
  ExpenseReportModel 
} from '../models/expense';
import { 
  AppError, 
  ErrorCodes, 
  formatError, 
  formatSuccess, 
  createValidationError
} from '../utils/errorHandler';
import { AuthenticatedRequest } from '../types/standardInterfaces';
import { ExpenseEntry as IExpenseEntry } from '../types/standardInterfaces';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Service Response Interface
interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

// Expense submission request
interface ExpenseSubmissionRequest {
  staffId: string;
  amount: number;
  currency?: string;
  category: string;
  subcategory?: string;
  description: string;
  receiptPhoto?: string;
  additionalDocuments?: string[];
  location: any;
  expenseDate: Date;
  metadata?: any;
  tags?: string[];
  notes?: string;
}

// Bulk approval request
interface BulkApprovalRequest {
  expenseIds: string[];
  approverId: string;
  action: 'approve' | 'reject';
  comments?: string;
}

// Expense analytics filters
interface ExpenseAnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
  staffIds?: string[];
  categories?: string[];
  status?: string[];
  minAmount?: number;
  maxAmount?: number;
}

// Authentication helper
function ensureAuthenticated(req: AuthenticatedRequest): asserts req is AuthenticatedRequest & { user: NonNullable<AuthenticatedRequest['user']> } {
  if (!req.user) {
    throw new AppError('Authentication required', ErrorCodes.UNAUTHORIZED);
  }
}

export class ExpenseManagementService {
  private readonly RECEIPT_STORAGE_PATH = 'uploads/receipts/';
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.pdf'];

  constructor() {
    // Ensure upload directory exists
    if (!fs.existsSync(this.RECEIPT_STORAGE_PATH)) {
      fs.mkdirSync(this.RECEIPT_STORAGE_PATH, { recursive: true });
    }
  }

  // Submit a new expense
  async submitExpense(request: ExpenseSubmissionRequest): Promise<ApiResponse> {
    try {
      // Validate expense against policy
      const policyValidation = await this.validateAgainstPolicy(
        request.staffId,
        request.category,
        request.amount
      );

      if (!policyValidation.isValid) {
        return {
          success: false,
          message: 'Expense violates company policy',
          data: policyValidation,
        };
      }

      // Get approval workflow
      const approvalWorkflow = await this.getApprovalWorkflow(
        request.staffId,
        request.category,
        request.amount
      );

      // Create expense entry
      const expenseEntry = new ExpenseEntryModel({
        staffId: request.staffId,
        amount: request.amount,
        currency: request.currency || 'USD',
        category: request.category,
        subcategory: request.subcategory,
        description: request.description,
        receiptPhoto: request.receiptPhoto,
        additionalDocuments: request.additionalDocuments || [],
        location: request.location,
        expenseDate: request.expenseDate,
        timestamp: new Date(),
        status: approvalWorkflow.length > 0 ? 'submitted' : 'approved',
        approvalWorkflow: approvalWorkflow,
        currentApprovalLevel: approvalWorkflow.length > 0 ? 1 : 0,
        metadata: request.metadata || {},
        tags: request.tags || [],
        notes: request.notes,
      });

      if (approvalWorkflow.length > 0) {
        expenseEntry.submittedAt = new Date();
      }

      await expenseEntry.save();

      // Send notification to approvers if needed
      if (approvalWorkflow.length > 0) {
        await this.notifyApprovers(expenseEntry, approvalWorkflow[0]);
      }

      return {
        success: true,
        data: {
          expenseId: expenseEntry._id,
          status: expenseEntry.status,
          approvalRequired: approvalWorkflow.length > 0,
          nextApprover: approvalWorkflow.length > 0 ? approvalWorkflow[0].approverName : null,
        },
        message: 'Expense submitted successfully',
      };

    } catch (error: any) {
      console.error('Submit expense error:', error);
      return {
        success: false,
        message: 'Failed to submit expense',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Approve or reject an expense
  async processApproval(
    expenseId: string,
    approverId: string,
    action: 'approve' | 'reject' | 'delegate',
    comments?: string,
    delegatedTo?: string
  ): Promise<ApiResponse> {
    try {
      const expense = await ExpenseEntryModel.findById(expenseId);
      if (!expense) {
        return {
          success: false,
          message: 'Expense not found',
        };
      }

      // Find current approval step
      const currentStep = expense.approvalWorkflow.find(
        step => step.level === expense.currentApprovalLevel && step.status === 'pending'
      );

      if (!currentStep || currentStep.approverId !== approverId) {
        return {
          success: false,
          message: 'You are not authorized to approve this expense at this level',
        };
      }

      // Process the action
      currentStep.status = action === 'delegate' ? 'delegated' : action === 'approve' ? 'approved' : 'rejected';
      currentStep.timestamp = new Date();
      currentStep.comments = comments;

      if (action === 'delegate' && delegatedTo) {
        currentStep.isDelegated = true;
        currentStep.delegatedTo = delegatedTo;
        // Create new approval step for delegated person
        expense.approvalWorkflow.push({
          level: expense.currentApprovalLevel,
          approverId: delegatedTo,
          approverName: 'Delegated Approver', // Would fetch from user service
          approverRole: 'Delegated',
          status: 'pending',
          approvalLimit: currentStep.approvalLimit,
        });
      } else if (action === 'approve') {
        // Move to next approval level or complete
        if (expense.currentApprovalLevel < expense.approvalWorkflow.length) {
          expense.currentApprovalLevel += 1;
          const nextStep = expense.approvalWorkflow.find(
            step => step.level === expense.currentApprovalLevel
          );
          if (nextStep) {
            await this.notifyApprovers(expense, nextStep as any);
          } else {
            // All approvals complete
            expense.status = 'approved';
          }
        } else {
          expense.status = 'approved';
        }
      } else if (action === 'reject') {
        expense.status = 'rejected';
      }

      await expense.save();

      return {
        success: true,
        data: {
          expenseId: expense._id,
          status: expense.status,
          currentLevel: expense.currentApprovalLevel,
        },
        message: `Expense ${action}d successfully`,
      };

    } catch (error: any) {
      console.error('Process approval error:', error);
      return {
        success: false,
        message: 'Failed to process approval',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Bulk approve multiple expenses
  async bulkApprove(request: BulkApprovalRequest): Promise<ApiResponse> {
    try {
      const results = [];
      
      for (const expenseId of request.expenseIds) {
        const result = await this.processApproval(
          expenseId,
          request.approverId,
          request.action,
          request.comments
        );
        results.push({
          expenseId,
          success: result.success,
          message: result.message,
        });
      }

      const successCount = results.filter(r => r.success).length;
      
      return {
        success: true,
        data: {
          totalProcessed: request.expenseIds.length,
          successful: successCount,
          failed: request.expenseIds.length - successCount,
          results,
        },
        message: `Bulk ${request.action} completed: ${successCount}/${request.expenseIds.length} successful`,
      };

    } catch (error: any) {
      console.error('Bulk approve error:', error);
      return {
        success: false,
        message: 'Failed to process bulk approval',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Get expenses for a staff member or manager
  async getExpenses(
    userId: string,
    userRole: string,
    filters?: {
      status?: string[];
      startDate?: Date;
      endDate?: Date;
      category?: string[];
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiResponse> {
    try {
      const query: any = {};

      // Role-based access control
      if (userRole === 'FieldTech' || userRole === 'SiteStaff') {
        query.staffId = userId;
      } else if (userRole === 'Supervisor') {
        // Supervisors can see expenses that need their approval
        query.$or = [
          { staffId: userId },
          { 'approvalWorkflow.approverId': userId, 'approvalWorkflow.status': 'pending' }
        ];
      }
      // Admins can see all expenses (no additional filter)

      // Apply filters
      if (filters?.status?.length) {
        query.status = { $in: filters.status };
      }

      if (filters?.startDate || filters?.endDate) {
        query.expenseDate = {};
        if (filters.startDate) query.expenseDate.$gte = filters.startDate;
        if (filters.endDate) query.expenseDate.$lte = filters.endDate;
      }

      if (filters?.category?.length) {
        query.category = { $in: filters.category };
      }

      const expenses = await ExpenseEntryModel
        .find(query)
        .sort({ expenseDate: -1 })
        .limit(filters?.limit || 50)
        .skip(filters?.offset || 0);

      const total = await ExpenseEntryModel.countDocuments(query);

      return {
        success: true,
        data: {
          expenses,
          pagination: {
            total,
            limit: filters?.limit || 50,
            offset: filters?.offset || 0,
            hasMore: (filters?.offset || 0) + expenses.length < total,
          },
        },
        message: 'Expenses retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get expenses error:', error);
      return {
        success: false,
        message: 'Failed to retrieve expenses',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Create expense report
  async createExpenseReport(
    staffId: string,
    title: string,
    description: string,
    startDate: Date,
    endDate: Date,
    expenseIds: string[]
  ): Promise<ApiResponse> {
    try {
      // Validate expenses belong to staff member and are in valid status
      const expenses = await ExpenseEntryModel.find({
        _id: { $in: expenseIds },
        staffId,
        status: { $in: ['approved', 'submitted'] },
        expenseDate: { $gte: startDate, $lte: endDate },
      });

      if (expenses.length !== expenseIds.length) {
        return {
          success: false,
          message: 'Some expenses are invalid or not accessible',
        };
      }

      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const reportNumber = this.generateReportNumber();

      const expenseReport = new ExpenseReportModel({
        reportNumber,
        staffId,
        title,
        description,
        startDate,
        endDate,
        expenses: expenseIds,
        totalAmount,
        status: 'draft',
      });

      await expenseReport.save();

      return {
        success: true,
        data: {
          reportId: expenseReport._id,
          reportNumber,
          totalAmount,
          expenseCount: expenses.length,
        },
        message: 'Expense report created successfully',
      };

    } catch (error: any) {
      console.error('Create expense report error:', error);
      return {
        success: false,
        message: 'Failed to create expense report',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Get expense analytics
  async getExpenseAnalytics(filters: ExpenseAnalyticsFilter): Promise<ApiResponse> {
    try {
      const matchStage: any = {};

      if (filters.startDate || filters.endDate) {
        matchStage.expenseDate = {};
        if (filters.startDate) matchStage.expenseDate.$gte = filters.startDate;
        if (filters.endDate) matchStage.expenseDate.$lte = filters.endDate;
      }

      if (filters.staffIds?.length) {
        matchStage.staffId = { $in: filters.staffIds };
      }

      if (filters.categories?.length) {
        matchStage.category = { $in: filters.categories };
      }

      if (filters.status?.length) {
        matchStage.status = { $in: filters.status };
      }

      if (filters.minAmount || filters.maxAmount) {
        matchStage.amount = {};
        if (filters.minAmount) matchStage.amount.$gte = filters.minAmount;
        if (filters.maxAmount) matchStage.amount.$lte = filters.maxAmount;
      }

      // Summary analytics
      const summaryAnalytics = await ExpenseEntryModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            averageAmount: { $avg: '$amount' },
            approvedAmount: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0] }
            },
            pendingAmount: {
              $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, '$amount', 0] }
            },
            rejectedAmount: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, '$amount', 0] }
            },
          }
        }
      ]);

      // Category breakdown
      const categoryAnalytics = await ExpenseEntryModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            averageAmount: { $avg: '$amount' },
          }
        },
        { $sort: { totalAmount: -1 } }
      ]);

      // Monthly trends
      const monthlyTrends = await ExpenseEntryModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$expenseDate' },
              month: { $month: '$expenseDate' },
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      // Top spenders
      const topSpenders = await ExpenseEntryModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$staffId',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 10 }
      ]);

      return {
        success: true,
        data: {
          summary: summaryAnalytics[0] || {},
          categoryBreakdown: categoryAnalytics,
          monthlyTrends,
          topSpenders,
        },
        message: 'Analytics retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get expense analytics error:', error);
      return {
        success: false,
        message: 'Failed to retrieve analytics',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Upload receipt photo
  async uploadReceipt(file: Express.Multer.File): Promise<string> {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (!this.SUPPORTED_FORMATS.includes(fileExtension)) {
      throw new Error('Unsupported file format');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error('File size exceeds limit');
    }

    const fileName = `receipt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${fileExtension}`;
    const filePath = path.join(this.RECEIPT_STORAGE_PATH, fileName);

    await fs.promises.writeFile(filePath, file.buffer);
    
    return fileName;
  }

  // Private helper methods
  private async validateAgainstPolicy(
    staffId: string, 
    category: string, 
    amount: number
  ): Promise<{ isValid: boolean; violations?: string[] }> {
    try {
      // For now, implement basic validation rules
      // In production, this would fetch user's applicable policies
      const violations: string[] = [];

      // Basic amount limits by category
      const categoryLimits: { [key: string]: number } = {
        'meals': 100,
        'travel': 1000,
        'accommodation': 500,
        'fuel': 200,
        'supplies': 300,
        'maintenance': 800,
        'parking': 50,
        'tolls': 30,
        'other': 100,
      };

      const limit = categoryLimits[category];
      if (limit && amount > limit) {
        violations.push(`Amount exceeds category limit of $${limit}`);
      }

      return {
        isValid: violations.length === 0,
        violations: violations.length > 0 ? violations : undefined,
      };

    } catch (error) {
      console.error('Policy validation error:', error);
      return { isValid: true }; // Fail open for now
    }
  }

  private async getApprovalWorkflow(
    staffId: string,
    category: string,
    amount: number
  ): Promise<ApprovalStep[]> {
    // Simplified approval workflow
    // In production, this would be configured per organization
    const workflow: ApprovalStep[] = [];

    if (amount > 50) {
      workflow.push({
        level: 1,
        approverId: 'supervisor_1', // Would be fetched from org structure
        approverName: 'Site Supervisor',
        approverRole: 'Supervisor',
        status: 'pending',
        approvalLimit: 500,
      });
    }

    if (amount > 500) {
      workflow.push({
        level: 2,
        approverId: 'manager_1',
        approverName: 'Area Manager',
        approverRole: 'Manager',
        status: 'pending',
        approvalLimit: 2000,
      });
    }

    if (amount > 2000) {
      workflow.push({
        level: 3,
        approverId: 'admin_1',
        approverName: 'Finance Admin',
        approverRole: 'Admin',
        status: 'pending',
      });
    }

    return workflow;
  }

  private async notifyApprovers(expense: any, approvalStep: ApprovalStep): Promise<void> {
    // In production, send email/push notifications to approvers
    console.log(`Notification sent to ${approvalStep.approverName} for expense ${expense._id}`);
  }

  private generateReportNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `EXP-${year}${month}-${random}`;
  }
}

// Export service instance
const expenseService = new ExpenseManagementService();

// Route handlers
export async function submitExpense(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);
    
    if (!req.body.amount || !req.body.category || !req.body.description) {
      throw createValidationError('amount, category, description', 'Required fields are missing');
    }

    const result = await expenseService.submitExpense({
      ...req.body,
      staffId: req.user.id
    });
    
    res.status(201).json(formatSuccess(result.data, result.message || 'Expense submitted successfully'));
  } catch (error) {
    console.error('Error submitting expense:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
}

export async function approveExpense(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);
    const { expenseId } = req.params;
    const { action, comments, delegatedTo } = req.body;

    if (!expenseId) {
      throw createValidationError('expenseId', 'Expense ID is required');
    }
    if (!action || !['approve', 'reject', 'delegate'].includes(action)) {
      throw createValidationError('action', 'Valid action (approve/reject/delegate) is required');
    }

    const result = await expenseService.processApproval(
      expenseId,
      req.user.id,
      action,
      comments,
      delegatedTo
    );
    
    res.json(formatSuccess(result.data, result.message || 'Expense processed successfully'));
  } catch (error) {
    console.error('Error processing expense approval:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
}

export async function bulkApproveExpenses(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);
    const { expenseIds, action, comments } = req.body;

    if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
      throw createValidationError('expenseIds', 'Array of expense IDs is required');
    }
    if (!action || !['approve', 'reject'].includes(action)) {
      throw createValidationError('action', 'Valid action (approve/reject) is required');
    }

    const result = await expenseService.bulkApprove({
      expenseIds,
      action,
      comments,
      approverId: req.user.id,
    });
    
    res.json(formatSuccess(result.data, result.message || 'Bulk action completed successfully'));
  } catch (error) {
    console.error('Error processing bulk approval:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
}

export async function getExpenses(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);
    const { status, startDate, endDate, category, limit, offset } = req.query;
    
    const filters = {
      status: status ? (status as string).split(',') : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      category: category ? (category as string).split(',') : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const result = await expenseService.getExpenses(
      req.user.id,
      req.user.role,
      filters
    );
    
    res.json(formatSuccess(result.data, result.message || 'Expenses retrieved successfully'));
  } catch (error) {
    console.error('Error retrieving expenses:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
}

export async function createExpenseReport(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);
    const { title, description, startDate, endDate, expenseIds } = req.body;
    
    if (!title) {
      throw createValidationError('title', 'Report title is required');
    }
    if (!startDate || !endDate) {
      throw createValidationError('startDate, endDate', 'Start and end dates are required');
    }

    const result = await expenseService.createExpenseReport(
      req.user.id,
      title,
      description,
      new Date(startDate),
      new Date(endDate),
      expenseIds
    );
    
    res.status(201).json(formatSuccess(result.data, result.message || 'Expense report created successfully'));
  } catch (error) {
    console.error('Error creating expense report:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
}

export async function getExpenseAnalytics(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);
    const { startDate, endDate, staffIds, categories, status, minAmount, maxAmount } = req.query;
    
    const filters: ExpenseAnalyticsFilter = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      staffIds: staffIds ? (staffIds as string).split(',') : undefined,
      categories: categories ? (categories as string).split(',') : undefined,
      status: status ? (status as string).split(',') : undefined,
      minAmount: minAmount ? parseFloat(minAmount as string) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount as string) : undefined,
    };

    const result = await expenseService.getExpenseAnalytics(filters);
    
    res.json(formatSuccess(result.data, result.message || 'Analytics retrieved successfully'));
  } catch (error) {
    console.error('Error retrieving expense analytics:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
}
