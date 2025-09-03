import { Router } from 'express';
import { trackEvent, getAnalytics } from '../modules/analytics';
import { requireAuth, requireRole } from '../modules/authentication';
import ExpenseAnalyticsService from '../modules/expenseAnalytics';
import { ExpenseEntry } from '../models/expense';

const router = Router();

// Dashboard analytics summary (Supervisor, Admin, Client)
router.get('/', requireAuth, requireRole(['Supervisor', 'Admin', 'Client']), getAnalytics);

// Track analytics event (Supervisor, Admin)
router.post('/track', requireAuth, requireRole(['Supervisor', 'Admin']), (req, res) => {
  trackEvent(req.body);
  res.status(200).json({ message: 'Event tracked' });
});

// Enhanced Expense Analytics Routes

/**
 * GET /api/analytics/expenses/dashboard
 * Get comprehensive expense analytics dashboard
 */
router.get('/expenses/dashboard', requireAuth, async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    // In a real implementation, fetch expenses from database
    const expenses = await getExpensesByUser(userId as string, startDate as string, endDate as string);
    
    const analyticsService = new ExpenseAnalyticsService();
    await analyticsService.initialize(expenses);

    // Generate analytics data
    const anomalies = await analyticsService.detectAnomalies();
    const predictions = await analyticsService.generatePredictions();
    const optimizations = await analyticsService.optimizeExpenses();
    const insights = analyticsService.getInsights();
    const patterns = analyticsService.getSpendingPatterns();

    res.json({
      success: true,
      data: {
        summary: {
          totalExpenses: expenses.length,
          totalAmount: expenses.reduce((sum, exp) => sum + exp.amount, 0),
          averageAmount: expenses.reduce((sum, exp) => sum + exp.amount, 0) / expenses.length,
          pendingApproval: expenses.filter(exp => exp.status === 'submitted').length,
        },
        anomalies: anomalies.slice(0, 5),
        predictions,
        optimizations,
        insights: insights.slice(0, 10),
        patterns,
        trends: {
          monthly: await generateMonthlyTrends(expenses),
          categories: await generateCategoryTrends(expenses),
        },
      },
    });

  } catch (error) {
    console.error('Expense analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate expense analytics',
    });
  }
});

/**
 * GET /api/analytics/expenses/anomalies
 * Get detailed anomaly detection results
 */
router.get('/expenses/anomalies', requireAuth, async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    const expenses = await getExpensesByUser(userId as string, startDate as string, endDate as string);
    
    const analyticsService = new ExpenseAnalyticsService();
    await analyticsService.initialize(expenses);
    
    const anomalies = await analyticsService.detectAnomalies();

    res.json({
      success: true,
      data: {
        anomalies,
        summary: {
          totalAnomalies: anomalies.length,
          highSeverity: anomalies.filter(a => a.severity === 'high').length,
          mediumSeverity: anomalies.filter(a => a.severity === 'medium').length,
          lowSeverity: anomalies.filter(a => a.severity === 'low').length,
        },
      },
    });

  } catch (error) {
    console.error('Anomaly detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect anomalies',
    });
  }
});

/**
 * GET /api/analytics/expenses/predictions
 * Get predictive analytics for future expenses
 */
router.get('/expenses/predictions', requireAuth, async (req, res) => {
  try {
    const { userId, horizon = '3' } = req.query;
    
    const expenses = await getExpensesByUser(userId as string);
    
    const analyticsService = new ExpenseAnalyticsService();
    await analyticsService.initialize(expenses);
    
    const predictions = await analyticsService.generatePredictions();

    // Generate predictions for multiple months ahead
    const monthsAhead = parseInt(horizon as string);
    const extendedPredictions = [];
    
    for (let i = 1; i <= monthsAhead; i++) {
      extendedPredictions.push({
        month: i,
        prediction: predictions.nextMonthPrediction.totalAmount * Math.pow(1.05, i - 1),
        confidence: Math.max(0.4, predictions.nextMonthPrediction.confidence - (i - 1) * 0.1),
      });
    }

    res.json({
      success: true,
      data: {
        predictions,
        extendedPredictions,
        confidence: predictions.nextMonthPrediction.confidence,
        methodology: 'Linear regression with trend analysis',
      },
    });

  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate predictions',
    });
  }
});

/**
 * GET /api/analytics/expenses/optimization
 * Get expense optimization recommendations
 */
router.get('/expenses/optimization', requireAuth, async (req, res) => {
  try {
    const { userId } = req.query;
    
    const expenses = await getExpensesByUser(userId as string);
    
    const analyticsService = new ExpenseAnalyticsService();
    await analyticsService.initialize(expenses);
    
    const optimizations = await analyticsService.optimizeExpenses();

    res.json({
      success: true,
      data: {
        optimizations,
        implementation: {
          immediate: optimizations.recommendations.filter(r => r.effort === 'low'),
          shortTerm: optimizations.recommendations.filter(r => r.effort === 'medium'),
          longTerm: optimizations.recommendations.filter(r => r.effort === 'high'),
        },
      },
    });

  } catch (error) {
    console.error('Optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate optimizations',
    });
  }
});

// Helper functions
async function getExpensesByUser(userId: string, startDate?: string, endDate?: string): Promise<ExpenseEntry[]> {
  // Sample data for demonstration - in production, query from database
  return [
    {
      id: '1',
      userId: userId || 'user1',
      amount: 45.50,
      category: 'meals',
      description: 'Business lunch with client',
      expenseDate: new Date('2024-01-15'),
      status: 'approved',
      receiptImages: [],
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-16'),
    },
    {
      id: '2',
      userId: userId || 'user1',
      amount: 85.00,
      category: 'fuel',
      description: 'Gas for company vehicle',
      expenseDate: new Date('2024-01-16'),
      status: 'submitted',
      receiptImages: ['receipt1.jpg'],
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        address: 'New York, NY',
      },
      createdAt: new Date('2024-01-16'),
      updatedAt: new Date('2024-01-16'),
    },
    {
      id: '3',
      userId: userId || 'user1',
      amount: 125.00,
      category: 'supplies',
      description: 'Office supplies for field office',
      expenseDate: new Date('2024-01-17'),
      status: 'approved',
      receiptImages: ['receipt2.jpg'],
      createdAt: new Date('2024-01-17'),
      updatedAt: new Date('2024-01-17'),
    },
  ];
}

async function generateMonthlyTrends(expenses: ExpenseEntry[]) {
  const monthlyData: { [key: string]: number } = {};
  
  expenses.forEach(expense => {
    const monthKey = expense.expenseDate.toISOString().slice(0, 7); // YYYY-MM
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + expense.amount;
  });

  return Object.entries(monthlyData).map(([month, amount]) => ({
    month,
    amount,
    count: expenses.filter(e => e.expenseDate.toISOString().slice(0, 7) === month).length,
  }));
}

async function generateCategoryTrends(expenses: ExpenseEntry[]) {
  const categoryData: { [key: string]: { amount: number; count: number } } = {};
  
  expenses.forEach(expense => {
    if (!categoryData[expense.category]) {
      categoryData[expense.category] = { amount: 0, count: 0 };
    }
    categoryData[expense.category].amount += expense.amount;
    categoryData[expense.category].count += 1;
  });

  return Object.entries(categoryData).map(([category, data]) => ({
    category,
    ...data,
    average: data.amount / data.count,
  }));
}

export default router;
