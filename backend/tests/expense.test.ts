import { ExpenseManagementService } from '../modules/expense';

describe('Expense Management System', () => {
  let expenseService: ExpenseManagementService;

  beforeEach(() => {
    expenseService = new ExpenseManagementService();
  });

  describe('Service Initialization', () => {
    test('should create expense service instance', () => {
      expect(expenseService).toBeDefined();
      expect(typeof expenseService.getExpenses).toBe('function');
      expect(typeof expenseService.submitExpense).toBe('function');
      expect(typeof expenseService.getExpenseAnalytics).toBe('function');
    });
  });

  describe('Analytics Generation', () => {
    test('should generate analytics for empty dataset', async () => {
      const analytics = await expenseService.getExpenseAnalytics({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(analytics).toHaveProperty('success');
      expect(analytics).toHaveProperty('data');
    });
  });

  describe('Service Methods', () => {
    test('should have all required methods', () => {
      const methods = [
        'getExpenses',
        'submitExpense',
        'processApproval',
        'bulkApprove',
        'createExpenseReport',
        'getExpenseAnalytics',
        'uploadReceipt',
      ];

      methods.forEach(method => {
        expect(typeof (expenseService as any)[method]).toBe('function');
      });
    });
  });
});
