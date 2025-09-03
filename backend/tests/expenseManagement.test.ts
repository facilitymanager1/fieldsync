/**
 * Expense Management Module Unit Tests  
 * Comprehensive testing for expense submission, approval workflows, and analytics
 */

import { ExpenseManagementService } from '../modules/expense';
import { ExpenseEntryModel, ExpensePolicyModel, ExpenseReportModel } from '../models/expense';

// Mock dependencies
jest.mock('../models/expense');
jest.mock('../utils/errorHandler');
jest.mock('../modules/auditLog');

describe('Expense Management Service', () => {
  let expenseService: ExpenseManagementService;
  let mockExpense: any;
  let mockPolicy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    expenseService = new ExpenseManagementService();

    // Mock expense entry
    mockExpense = {
      _id: 'expense_123',
      staffId: 'user_456',
      amount: 150.00,
      currency: 'USD',
      category: 'meals',
      description: 'Business lunch with client',
      receiptPhoto: 'receipt_123.jpg',
      location: { lat: 40.7128, lng: -74.0060 },
      expenseDate: new Date('2024-01-01T12:00:00Z'),
      status: 'submitted',
      approvalWorkflow: [
        {
          level: 1,
          approverId: 'supervisor_1',
          approverName: 'Site Supervisor',
          approverRole: 'Supervisor',
          status: 'pending',
          approvalLimit: 500
        }
      ],
      currentApprovalLevel: 1,
      save: jest.fn().mockResolvedValue(true)
    };

    // Mock policy
    mockPolicy = {
      _id: 'policy_123',
      name: 'Standard Expense Policy',
      isActive: true,
      rules: [
        {
          category: 'meals',
          maxAmount: 100,
          requiresReceipt: true,
          description: 'Meal expenses'
        }
      ]
    };

    // Setup model mocks
    (ExpenseEntryModel as any).mockImplementation(() => mockExpense);
    (ExpenseEntryModel.findById as jest.Mock).mockResolvedValue(mockExpense);
    (ExpenseEntryModel.find as jest.Mock).mockResolvedValue([mockExpense]);
    (ExpenseEntryModel.countDocuments as jest.Mock).mockResolvedValue(1);
    (ExpenseEntryModel.aggregate as jest.Mock).mockResolvedValue([
      { _id: null, totalAmount: 150, count: 1 }
    ]);

    (ExpensePolicyModel.findOne as jest.Mock).mockResolvedValue(mockPolicy);
  });

  describe('Expense Submission', () => {
    it('should submit valid expense successfully', async () => {
      const expenseData = {
        staffId: 'user_456',
        amount: 75.00,
        category: 'meals',
        description: 'Business lunch',
        receiptPhoto: 'receipt_123.jpg',
        location: { lat: 40.7128, lng: -74.0060 },
        expenseDate: new Date('2024-01-01T12:00:00Z')
      };

      const result = await expenseService.submitExpense(expenseData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        expenseId: expect.any(String),
        status: 'submitted',
        approvalRequired: true,
        nextApprover: 'Site Supervisor'
      }));
    });

    it('should reject expense exceeding category limit', async () => {
      const expenseData = {
        staffId: 'user_456',
        amount: 150.00, // Exceeds meals limit of 100
        category: 'meals',
        description: 'Expensive business dinner',
        receiptPhoto: 'receipt_123.jpg',
        location: { lat: 40.7128, lng: -74.0060 },
        expenseDate: new Date('2024-01-01T12:00:00Z')
      };

      const result = await expenseService.submitExpense(expenseData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('violates company policy');
      expect(result.data.violations).toContain('Amount exceeds category limit of $100');
    });

    it('should auto-approve small expenses', async () => {
      const expenseData = {
        staffId: 'user_456',
        amount: 25.00, // Below approval threshold
        category: 'parking',
        description: 'Parking fee',
        location: { lat: 40.7128, lng: -74.0060 },
        expenseDate: new Date('2024-01-01T12:00:00Z')
      };

      const result = await expenseService.submitExpense(expenseData);

      expect(result.success).toBe(true);
      expect(result.data.approvalRequired).toBe(false);
      expect(mockExpense.status).toBe('approved');
    });

    it('should handle missing required fields', async () => {
      const incompleteData = {
        staffId: 'user_456',
        amount: 75.00
        // Missing category and description
      };

      const result = await expenseService.submitExpense(incompleteData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to submit expense');
    });

    it('should generate correct approval workflow', async () => {
      const expenseData = {
        staffId: 'user_456',
        amount: 750.00, // Requires multiple approvals
        category: 'travel',
        description: 'Business travel expenses',
        receiptPhoto: 'receipt_123.jpg',
        location: { lat: 40.7128, lng: -74.0060 },
        expenseDate: new Date('2024-01-01T12:00:00Z')
      };

      const result = await expenseService.submitExpense(expenseData);

      expect(result.success).toBe(true);
      expect(mockExpense.approvalWorkflow.length).toBeGreaterThan(1);
      expect(mockExpense.approvalWorkflow[0].approverRole).toBe('Supervisor');
      expect(mockExpense.approvalWorkflow[1].approverRole).toBe('Manager');
    });
  });

  describe('Approval Processing', () => {
    beforeEach(() => {
      mockExpense.status = 'submitted';
      mockExpense.currentApprovalLevel = 1;
      mockExpense.approvalWorkflow = [
        {
          level: 1,
          approverId: 'supervisor_1',
          approverName: 'Site Supervisor',
          status: 'pending',
          approvalLimit: 500
        },
        {
          level: 2,
          approverId: 'manager_1',
          approverName: 'Area Manager',
          status: 'pending',
          approvalLimit: 2000
        }
      ];
    });

    it('should approve expense successfully', async () => {
      const result = await expenseService.processApproval(
        'expense_123',
        'supervisor_1',
        'approve',
        'Approved - valid business expense'
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        expenseId: 'expense_123',
        status: 'submitted', // Still needs manager approval
        currentLevel: 2
      }));
    });

    it('should reject expense with reason', async () => {
      const result = await expenseService.processApproval(
        'expense_123',
        'supervisor_1',
        'reject',
        'Missing receipt for meal expense'
      );

      expect(result.success).toBe(true);
      expect(mockExpense.status).toBe('rejected');
      expect(mockExpense.approvalWorkflow[0].status).toBe('rejected');
      expect(mockExpense.approvalWorkflow[0].comments).toBe('Missing receipt for meal expense');
    });

    it('should handle delegation', async () => {
      const result = await expenseService.processApproval(
        'expense_123',
        'supervisor_1',
        'delegate',
        'Delegating to another supervisor',
        'supervisor_2'
      );

      expect(result.success).toBe(true);
      expect(mockExpense.approvalWorkflow[0].isDelegated).toBe(true);
      expect(mockExpense.approvalWorkflow[0].delegatedTo).toBe('supervisor_2');
    });

    it('should prevent unauthorized approval', async () => {
      const result = await expenseService.processApproval(
        'expense_123',
        'wrong_approver', // Not authorized for this level
        'approve'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('not authorized to approve');
    });

    it('should complete approval workflow', async () => {
      // Mock single-level approval
      mockExpense.approvalWorkflow = [{
        level: 1,
        approverId: 'supervisor_1',
        status: 'pending',
        approvalLimit: 500
      }];

      const result = await expenseService.processApproval(
        'expense_123',
        'supervisor_1',
        'approve'
      );

      expect(result.success).toBe(true);
      expect(mockExpense.status).toBe('approved');
    });
  });

  describe('Bulk Operations', () => {
    it('should bulk approve multiple expenses', async () => {
      const bulkRequest = {
        expenseIds: ['expense_123', 'expense_456', 'expense_789'],
        approverId: 'supervisor_1',
        action: 'approve',
        comments: 'Bulk approval for team expenses'
      };

      // Mock multiple successful approvals
      jest.spyOn(expenseService, 'processApproval')
        .mockResolvedValue({ success: true, message: 'Approved' });

      const result = await expenseService.bulkApprove(bulkRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        totalProcessed: 3,
        successful: 3,
        failed: 0
      }));
    });

    it('should handle partial bulk approval failures', async () => {
      const bulkRequest = {
        expenseIds: ['expense_123', 'expense_456'],
        approverId: 'supervisor_1',
        action: 'approve'
      };

      // Mock mixed results
      jest.spyOn(expenseService, 'processApproval')
        .mockResolvedValueOnce({ success: true, message: 'Approved' })
        .mockResolvedValueOnce({ success: false, message: 'Already processed' });

      const result = await expenseService.bulkApprove(bulkRequest);

      expect(result.success).toBe(true);
      expect(result.data.successful).toBe(1);
      expect(result.data.failed).toBe(1);
    });
  });

  describe('Expense Retrieval', () => {
    it('should retrieve expenses for field technician', async () => {
      const result = await expenseService.getExpenses(
        'user_456',
        'FieldTech',
        { status: ['submitted', 'approved'] }
      );

      expect(result.success).toBe(true);
      expect(result.data.expenses).toBeDefined();
      expect(result.data.pagination).toEqual(expect.objectContaining({
        total: 1,
        hasMore: false
      }));
    });

    it('should apply role-based access control', async () => {
      const result = await expenseService.getExpenses(
        'supervisor_1',
        'Supervisor',
        {}
      );

      expect(result.success).toBe(true);
      expect(ExpenseEntryModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { staffId: 'supervisor_1' },
            { 'approvalWorkflow.approverId': 'supervisor_1', 'approvalWorkflow.status': 'pending' }
          ]
        })
      );
    });

    it('should filter by date range', async () => {
      const filters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const result = await expenseService.getExpenses('user_456', 'Admin', filters);

      expect(result.success).toBe(true);
      expect(ExpenseEntryModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseDate: {
            $gte: filters.startDate,
            $lte: filters.endDate
          }
        })
      );
    });

    it('should handle pagination', async () => {
      const result = await expenseService.getExpenses(
        'user_456',
        'Admin',
        { limit: 25, offset: 50 }
      );

      expect(result.success).toBe(true);
      expect(ExpenseEntryModel.find).toHaveBeenCalledWith(
        expect.any(Object)
      );
    });
  });

  describe('Expense Reports', () => {
    beforeEach(() => {
      (ExpenseReportModel as any).mockImplementation(() => ({
        _id: 'report_123',
        reportNumber: 'EXP-202401-ABC123',
        staffId: 'user_456',
        title: 'January 2024 Expenses',
        totalAmount: 350.00,
        status: 'draft',
        save: jest.fn().mockResolvedValue(true)
      }));
    });

    it('should create expense report successfully', async () => {
      const expenseIds = ['expense_123', 'expense_456'];
      
      // Mock expenses for the report
      (ExpenseEntryModel.find as jest.Mock).mockResolvedValue([
        { _id: 'expense_123', amount: 150.00, status: 'approved' },
        { _id: 'expense_456', amount: 200.00, status: 'approved' }
      ]);

      const result = await expenseService.createExpenseReport(
        'user_456',
        'January 2024 Expenses',
        'Monthly expense report for January',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        expenseIds
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        reportId: expect.any(String),
        reportNumber: expect.stringMatching(/EXP-\d{6}-\w{6}/),
        totalAmount: 350.00,
        expenseCount: 2
      }));
    });

    it('should validate expense ownership', async () => {
      // Mock expenses that don't belong to the staff member
      (ExpenseEntryModel.find as jest.Mock).mockResolvedValue([]);

      const result = await expenseService.createExpenseReport(
        'user_456',
        'Invalid Report',
        'Report with invalid expenses',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        ['expense_999'] // Non-existent or unauthorized expense
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid or not accessible');
    });
  });

  describe('Analytics', () => {
    beforeEach(() => {
      // Mock comprehensive analytics data
      (ExpenseEntryModel.aggregate as jest.Mock).mockImplementation((pipeline) => {
        const firstStage = pipeline[0];
        
        if (firstStage.$group && firstStage.$group._id === null) {
          // Summary analytics
          return Promise.resolve([{
            _id: null,
            totalExpenses: 5,
            totalAmount: 1250.00,
            averageAmount: 250.00,
            approvedAmount: 1000.00,
            pendingAmount: 200.00,
            rejectedAmount: 50.00
          }]);
        }
        
        if (firstStage.$group && firstStage.$group._id === '$category') {
          // Category analytics
          return Promise.resolve([
            { _id: 'meals', count: 3, totalAmount: 450.00, averageAmount: 150.00 },
            { _id: 'travel', count: 2, totalAmount: 800.00, averageAmount: 400.00 }
          ]);
        }
        
        if (firstStage.$group && firstStage.$group._id?.year) {
          // Monthly trends
          return Promise.resolve([
            { _id: { year: 2024, month: 1 }, count: 3, totalAmount: 750.00 },
            { _id: { year: 2024, month: 2 }, count: 2, totalAmount: 500.00 }
          ]);
        }
        
        return Promise.resolve([]);
      });
    });

    it('should generate comprehensive expense analytics', async () => {
      const filters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-29'),
        staffIds: ['user_456', 'user_789']
      };

      const result = await expenseService.getExpenseAnalytics(filters);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        summary: expect.objectContaining({
          totalExpenses: 5,
          totalAmount: 1250.00,
          averageAmount: 250.00,
          approvedAmount: 1000.00
        }),
        categoryBreakdown: expect.arrayContaining([
          expect.objectContaining({
            _id: 'meals',
            count: 3,
            totalAmount: 450.00
          })
        ]),
        monthlyTrends: expect.any(Array),
        topSpenders: expect.any(Array)
      }));
    });

    it('should handle empty analytics datasets', async () => {
      (ExpenseEntryModel.aggregate as jest.Mock).mockResolvedValue([]);

      const result = await expenseService.getExpenseAnalytics({
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-30')
      });

      expect(result.success).toBe(true);
      expect(result.data.summary).toEqual({});
    });

    it('should filter analytics by staff and category', async () => {
      const filters = {
        staffIds: ['user_456'],
        categories: ['meals', 'travel'],
        minAmount: 100,
        maxAmount: 500
      };

      const result = await expenseService.getExpenseAnalytics(filters);

      expect(result.success).toBe(true);
      expect(ExpenseEntryModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              staffId: { $in: ['user_456'] },
              category: { $in: ['meals', 'travel'] },
              amount: { $gte: 100, $lte: 500 }
            })
          })
        ])
      );
    });
  });

  describe('Receipt Management', () => {
    it('should upload receipt successfully', async () => {
      const mockFile = {
        originalname: 'receipt.jpg',
        size: 1024 * 500, // 500KB
        buffer: Buffer.from('mock image data')
      } as Express.Multer.File;

      const result = await expenseService.uploadReceipt(mockFile);

      expect(result).toMatch(/^receipt_\d+_[a-f0-9]+\.jpg$/);
    });

    it('should reject unsupported file formats', async () => {
      const mockFile = {
        originalname: 'receipt.txt',
        size: 1024,
        buffer: Buffer.from('text data')
      } as Express.Multer.File;

      await expect(expenseService.uploadReceipt(mockFile))
        .rejects.toThrow('Unsupported file format');
    });

    it('should reject oversized files', async () => {
      const mockFile = {
        originalname: 'receipt.jpg',
        size: 15 * 1024 * 1024, // 15MB (over 10MB limit)
        buffer: Buffer.alloc(15 * 1024 * 1024)
      } as Express.Multer.File;

      await expect(expenseService.uploadReceipt(mockFile))
        .rejects.toThrow('File size exceeds limit');
    });
  });

  describe('Policy Validation', () => {
    it('should validate against category-specific rules', async () => {
      // Test meals category with receipt requirement
      const result = await (expenseService as any).validateAgainstPolicy(
        'user_456',
        'meals',
        75.00
      );

      expect(result.isValid).toBe(true);
      expect(result.violations).toBeUndefined();
    });

    it('should enforce receipt requirements', async () => {
      mockPolicy.rules[0].requiresReceipt = true;
      
      const expenseData = {
        staffId: 'user_456',
        amount: 75.00,
        category: 'meals',
        description: 'Business lunch'
        // Missing receiptPhoto
      };

      const result = await expenseService.submitExpense(expenseData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Receipt required');
    });

    it('should handle multiple policy violations', async () => {
      const result = await (expenseService as any).validateAgainstPolicy(
        'user_456',
        'meals',
        150.00 // Exceeds limit
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Amount exceeds category limit of $100');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures', async () => {
      (ExpenseEntryModel.prototype.save as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const expenseData = {
        staffId: 'user_456',
        amount: 75.00,
        category: 'meals',
        description: 'Business lunch'
      };

      const result = await expenseService.submitExpense(expenseData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to submit expense');
    });

    it('should handle missing expense records', async () => {
      (ExpenseEntryModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await expenseService.processApproval(
        'nonexistent_expense',
        'supervisor_1',
        'approve'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Expense not found');
    });

    it('should handle analytics query failures', async () => {
      (ExpenseEntryModel.aggregate as jest.Mock).mockRejectedValue(
        new Error('Aggregation pipeline failed')
      );

      const result = await expenseService.getExpenseAnalytics({});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to retrieve analytics');
    });
  });

  describe('Integration Features', () => {
    it('should generate expense report numbers correctly', async () => {
      const reportNumber = (expenseService as any).generateReportNumber();
      
      expect(reportNumber).toMatch(/^EXP-\d{6}-[A-Z0-9]{6}$/);
      expect(reportNumber).toContain(new Date().getFullYear().toString());
    });

    it('should notify approvers of new expenses', async () => {
      const mockNotifyApprovers = jest.spyOn(expenseService as any, 'notifyApprovers');

      await expenseService.submitExpense({
        staffId: 'user_456',
        amount: 150.00,
        category: 'travel',
        description: 'Business travel'
      });

      expect(mockNotifyApprovers).toHaveBeenCalled();
    });
  });
});