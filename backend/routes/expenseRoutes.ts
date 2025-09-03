// Comprehensive Expense Management Routes for FieldSync Backend
import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  submitExpense,
  approveExpense,
  bulkApproveExpenses,
  getExpenses,
  createExpenseReport,
  getExpenseAnalytics
} from '../modules/expense';
import { requireAuth, requireRole } from '../modules/authentication';
import { AuthenticatedRequest } from '../types/standardInterfaces';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  },
});

/**
 * @route POST /api/expenses/submit
 * @desc Submit a new expense entry
 * @access Private (All authenticated users)
 */
router.post('/submit', requireAuth, upload.single('receipt'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Handle file upload if present
    if (req.file) {
      // In production, upload to cloud storage (AWS S3, etc.)
      const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${req.file.mimetype.split('/')[1]}`;
      req.body.receiptPhoto = fileName;
      // Store file logic here
    }

    const result = await submitExpense(authReq, res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to submit expense',
      error: error?.message || 'Unknown error',
    });
  }
});

/**
 * @route GET /api/expenses
 * @desc Get expenses with filtering and pagination
 * @access Private (All authenticated users - role-based access)
 */
// Wrapper function for getExpenses
const getExpensesWrapper = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  return getExpenses(authReq, res);
};

router.get('/', requireAuth, getExpensesWrapper);

/**
 * @route GET /api/expenses/pending-approval
 * @desc Get expenses pending approval for current user
 * @access Private (Supervisor, Manager, Admin)
 */
router.get('/pending-approval', requireAuth, requireRole(['Supervisor', 'Manager', 'Admin']), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Override query to show only pending approvals for this user
    req.query.status = 'submitted,pending_review';
    const result = await getExpenses(authReq, res);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending approvals',
      error: error?.message || 'Unknown error',
    });
  }
});

/**
 * @route PUT /api/expenses/:expenseId/approve
 * @desc Approve, reject, or delegate an expense
 * @access Private (Supervisor, Manager, Admin)
 */
// Wrapper function for approveExpense
const approveExpenseWrapper = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  return approveExpense(authReq, res);
};

router.put('/:expenseId/approve', requireAuth, requireRole(['Supervisor', 'Manager', 'Admin']), approveExpenseWrapper);

/**
 * @route POST /api/expenses/bulk-approve
 * @desc Bulk approve or reject multiple expenses
 * @access Private (Supervisor, Manager, Admin)
 */
// Wrapper function for bulkApproveExpenses
const bulkApproveExpensesWrapper = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  return bulkApproveExpenses(authReq, res);
};

router.post('/bulk-approve', requireAuth, requireRole(['Supervisor', 'Manager', 'Admin']), bulkApproveExpensesWrapper);

/**
 * @route GET /api/expenses/:expenseId
 * @desc Get details of a specific expense
 * @access Private (Owner, Supervisor, Manager, Admin)
 */
router.get('/:expenseId', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ExpenseEntryModel } = await import('../models/expense');
    const { expenseId } = req.params;
    const userId = authReq.user?.id;
    const userRole = authReq.user?.role;

    // Build access query based on role
    let query: any = { _id: expenseId };
    
    if (userRole === 'FieldTech' || userRole === 'SiteStaff') {
      // Users can only see their own expenses
      query.staffId = userId;
    } else if (userRole === 'Supervisor') {
      // Supervisors can see their own expenses and those they need to approve
      query.$or = [
        { staffId: userId },
        { 'approvalWorkflow.approverId': userId }
      ];
    }
    // Admins and Managers can see all expenses

    const expense = await ExpenseEntryModel.findOne(query);
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found or access denied',
      });
    }

    res.json({
      success: true,
      data: expense,
      message: 'Expense details retrieved successfully',
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve expense details',
      error: error?.message || 'Unknown error',
    });
  }
});

/**
 * @route PUT /api/expenses/:expenseId
 * @desc Update an expense (only if in draft status)
 * @access Private (Owner only)
 */
router.put('/:expenseId', requireAuth, upload.single('receipt'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ExpenseEntryModel } = await import('../models/expense');
    const { expenseId } = req.params;
    const userId = authReq.user?.id;

    const expense = await ExpenseEntryModel.findOne({
      _id: expenseId,
      staffId: userId,
      status: 'draft'
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found or cannot be modified',
      });
    }

    // Handle file upload if present
    if (req.file) {
      const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${req.file.mimetype.split('/')[1]}`;
      req.body.receiptPhoto = fileName;
    }

    // Update allowed fields
    const allowedUpdates = [
      'amount', 'category', 'subcategory', 'description', 'receiptPhoto',
      'expenseDate', 'metadata', 'tags', 'notes'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        (expense as any)[field] = req.body[field];
      }
    });

    expense.updatedAt = new Date();
    await expense.save();

    res.json({
      success: true,
      data: expense,
      message: 'Expense updated successfully',
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update expense',
      error: error?.message || 'Unknown error',
    });
  }
});

/**
 * @route DELETE /api/expenses/:expenseId
 * @desc Delete an expense (only if in draft status)
 * @access Private (Owner only)
 */
router.delete('/:expenseId', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ExpenseEntryModel } = await import('../models/expense');
    const { expenseId } = req.params;
    const userId = authReq.user?.id;

    const result = await ExpenseEntryModel.deleteOne({
      _id: expenseId,
      staffId: userId,
      status: 'draft'
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found or cannot be deleted',
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully',
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense',
      error: error?.message || 'Unknown error',
    });
  }
});

/**
 * @route POST /api/expenses/reports
 * @desc Create an expense report
 * @access Private (All authenticated users)
 */
// Wrapper function for createExpenseReport
const createExpenseReportWrapper = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  return createExpenseReport(authReq, res);
};

router.post('/reports', requireAuth, createExpenseReportWrapper);

/**
 * @route GET /api/expenses/reports
 * @desc Get expense reports
 * @access Private (All authenticated users)
 */
router.get('/reports', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ExpenseReportModel } = await import('../models/expense');
    const userId = authReq.user?.id;
    const userRole = authReq.user?.role;
    const { status, limit = 20, offset = 0 } = req.query;

    let query: any = {};
    
    if (userRole === 'FieldTech' || userRole === 'SiteStaff') {
      query.staffId = userId;
    }
    // Admins, Managers, Supervisors can see all reports

    if (status) {
      query.status = { $in: (status as string).split(',') };
    }

    const reports = await ExpenseReportModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .populate('expenses', 'amount category description expenseDate status');

    const total = await ExpenseReportModel.countDocuments(query);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + reports.length < total,
        },
      },
      message: 'Expense reports retrieved successfully',
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve expense reports',
      error: error?.message || 'Unknown error',
    });
  }
});

/**
 * @route GET /api/expenses/analytics
 * @desc Get expense analytics and statistics
 * @access Private (Manager, Admin)
 */
// Wrapper function for getExpenseAnalytics
const getExpenseAnalyticsWrapper = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  return getExpenseAnalytics(authReq, res);
};

router.get('/analytics', requireAuth, requireRole(['Manager', 'Admin']), getExpenseAnalyticsWrapper);

/**
 * @route GET /api/expenses/categories
 * @desc Get expense categories and subcategories
 * @access Private (All authenticated users)
 */
router.get('/categories', requireAuth, (req, res) => {
  const categories = {
    travel: {
      name: 'Travel',
      subcategories: ['Flight', 'Train', 'Bus', 'Taxi', 'Rental Car', 'Mileage']
    },
    meals: {
      name: 'Meals & Entertainment',
      subcategories: ['Breakfast', 'Lunch', 'Dinner', 'Client Entertainment', 'Team Meals']
    },
    accommodation: {
      name: 'Accommodation',
      subcategories: ['Hotel', 'Airbnb', 'Corporate Housing', 'Extended Stay']
    },
    fuel: {
      name: 'Fuel',
      subcategories: ['Gasoline', 'Diesel', 'Electric Charging']
    },
    supplies: {
      name: 'Supplies',
      subcategories: ['Office Supplies', 'Tools', 'Safety Equipment', 'Uniforms']
    },
    maintenance: {
      name: 'Maintenance',
      subcategories: ['Vehicle Maintenance', 'Equipment Repair', 'Facility Maintenance']
    },
    parking: {
      name: 'Parking',
      subcategories: ['Airport Parking', 'City Parking', 'Valet Service']
    },
    tolls: {
      name: 'Tolls',
      subcategories: ['Highway Tolls', 'Bridge Tolls', 'Tunnel Fees']
    },
    other: {
      name: 'Other',
      subcategories: ['Miscellaneous', 'Training', 'Communication', 'Software']
    }
  };

  res.json({
    success: true,
    data: categories,
    message: 'Expense categories retrieved successfully',
  });
});

/**
 * @route GET /api/expenses/health
 * @desc Health check for expense management system
 * @access Private (Admin)
 */
router.get('/health', requireAuth, requireRole(['Admin']), (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date(),
    services: {
      expenseSubmission: 'operational',
      approvalWorkflow: 'operational',
      fileUpload: 'operational',
      analytics: 'operational'
    }
  });
});

export default router;
