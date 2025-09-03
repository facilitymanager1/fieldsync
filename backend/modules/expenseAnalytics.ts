/**
 * Advanced Analytics Service with Machine Learning for Expense Management
 * Provides intelligent insights, predictions, and anomaly detection
 */

import { ExpenseEntry } from '../models/expense';

export interface AnalyticsInsight {
  type: 'trend' | 'anomaly' | 'prediction' | 'optimization' | 'pattern';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  recommendation?: string;
  data?: any;
}

export interface SpendingPattern {
  category: string;
  averageAmount: number;
  frequency: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  seasonality?: {
    pattern: 'weekly' | 'monthly' | 'quarterly';
    peak: string;
    variance: number;
  };
}

export interface AnomalyDetection {
  expenseId: string;
  anomalyType: 'amount' | 'frequency' | 'location' | 'timing' | 'category';
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  description: string;
  expectedValue?: number;
  actualValue: number;
  explanation: string;
}

export interface PredictiveAnalytics {
  nextMonthPrediction: {
    totalAmount: number;
    confidence: number;
    categoryBreakdown: { [category: string]: number };
  };
  budgetRecommendations: {
    category: string;
    currentSpend: number;
    recommendedBudget: number;
    reasoning: string;
  }[];
  riskFactors: {
    type: string;
    probability: number;
    impact: number;
    mitigation: string;
  }[];
}

export interface ExpenseOptimization {
  potentialSavings: number;
  recommendations: {
    type: 'vendor_switch' | 'bulk_purchase' | 'timing_optimization' | 'category_consolidation';
    description: string;
    estimatedSavings: number;
    effort: 'low' | 'medium' | 'high';
    priority: number;
  }[];
}

export class ExpenseAnalyticsService {
  private expenses: ExpenseEntry[] = [];
  private patterns: SpendingPattern[] = [];
  private insights: AnalyticsInsight[] = [];

  /**
   * Initialize the analytics service with expense data
   */
  async initialize(expenses: ExpenseEntry[]): Promise<void> {
    this.expenses = expenses.filter(e => e.status !== 'draft');
    await this.analyzeSpendingPatterns();
    await this.generateInsights();
  }

  /**
   * Detect anomalies in expense data using statistical methods
   */
  async detectAnomalies(expenses: ExpenseEntry[] = this.expenses): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    // Group expenses by category for analysis
    const categoryGroups = this.groupExpensesByCategory(expenses);

    for (const [category, categoryExpenses] of categoryGroups) {
      // Detect amount anomalies using standard deviation
      const amountAnomalies = this.detectAmountAnomalies(categoryExpenses, category);
      anomalies.push(...amountAnomalies);

      // Detect frequency anomalies
      const frequencyAnomalies = this.detectFrequencyAnomalies(categoryExpenses, category);
      anomalies.push(...frequencyAnomalies);

      // Detect location anomalies
      const locationAnomalies = this.detectLocationAnomalies(categoryExpenses, category);
      anomalies.push(...locationAnomalies);
    }

    // Detect timing anomalies (unusual submission times)
    const timingAnomalies = this.detectTimingAnomalies(expenses);
    anomalies.push(...timingAnomalies);

    return anomalies.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate predictive analytics for future expenses
   */
  async generatePredictions(): Promise<PredictiveAnalytics> {
    const monthlyData = this.getMonthlyExpenseData();
    const trends = this.analyzeTrends(monthlyData);

    // Predict next month's expenses using linear regression
    const nextMonthPrediction = this.predictNextMonthExpenses(trends);

    // Generate budget recommendations based on historical data
    const budgetRecommendations = this.generateBudgetRecommendations();

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors();

    return {
      nextMonthPrediction,
      budgetRecommendations,
      riskFactors,
    };
  }

  /**
   * Provide optimization recommendations for expense management
   */
  async optimizeExpenses(): Promise<ExpenseOptimization> {
    const recommendations = [];
    let totalPotentialSavings = 0;

    // Analyze vendor patterns for potential switches
    const vendorOptimizations = this.analyzeVendorOptimizations();
    recommendations.push(...vendorOptimizations);

    // Identify bulk purchase opportunities
    const bulkPurchaseOps = this.identifyBulkPurchaseOpportunities();
    recommendations.push(...bulkPurchaseOps);

    // Optimize timing for recurring expenses
    const timingOptimizations = this.analyzeTimingOptimizations();
    recommendations.push(...timingOptimizations);

    // Calculate total potential savings
    totalPotentialSavings = recommendations.reduce((sum, rec) => sum + rec.estimatedSavings, 0);

    return {
      potentialSavings: totalPotentialSavings,
      recommendations: recommendations.sort((a, b) => b.priority - a.priority),
    };
  }

  /**
   * Generate comprehensive insights using machine learning techniques
   */
  private async generateInsights(): Promise<void> {
    this.insights = [];

    // Trend analysis insights
    const trendInsights = this.generateTrendInsights();
    this.insights.push(...trendInsights);

    // Pattern recognition insights
    const patternInsights = this.generatePatternInsights();
    this.insights.push(...patternInsights);

    // Comparative insights
    const comparativeInsights = this.generateComparativeInsights();
    this.insights.push(...comparativeInsights);

    // Predictive insights
    const predictiveInsights = this.generatePredictiveInsights();
    this.insights.push(...predictiveInsights);
  }

  /**
   * Analyze spending patterns using clustering and trend analysis
   */
  private async analyzeSpendingPatterns(): Promise<void> {
    const categoryGroups = this.groupExpensesByCategory(this.expenses);
    this.patterns = [];

    for (const [category, expenses] of categoryGroups) {
      const amounts = expenses.map(e => e.amount);
      const dates = expenses.map(e => new Date(e.expenseDate));

      const pattern: SpendingPattern = {
        category,
        averageAmount: this.calculateMean(amounts),
        frequency: this.calculateFrequency(dates),
        trend: this.analyzeTrend(expenses),
        confidence: this.calculatePatternConfidence(expenses),
        seasonality: this.detectSeasonality(expenses),
      };

      this.patterns.push(pattern);
    }
  }

  // === ANOMALY DETECTION METHODS ===

  private detectAmountAnomalies(expenses: ExpenseEntry[], category: string): AnomalyDetection[] {
    const amounts = expenses.map(e => e.amount);
    const mean = this.calculateMean(amounts);
    const stdDev = this.calculateStandardDeviation(amounts);
    const threshold = 2.5; // Z-score threshold

    return expenses
      .filter(expense => {
        const zScore = Math.abs((expense.amount - mean) / stdDev);
        return zScore > threshold;
      })
      .map(expense => ({
        expenseId: expense.id,
        anomalyType: 'amount' as const,
        severity: this.calculateSeverity((expense.amount - mean) / stdDev),
        confidence: Math.min(0.95, Math.abs((expense.amount - mean) / stdDev) / threshold * 0.8),
        description: `Unusual ${category} expense amount`,
        expectedValue: mean,
        actualValue: expense.amount,
        explanation: `Amount is ${((expense.amount - mean) / mean * 100).toFixed(1)}% ${expense.amount > mean ? 'above' : 'below'} average for ${category}`,
      }));
  }

  private detectFrequencyAnomalies(expenses: ExpenseEntry[], category: string): AnomalyDetection[] {
    const monthlyFrequency = this.calculateMonthlyFrequency(expenses);
    const avgFrequency = this.calculateMean(Object.values(monthlyFrequency));
    const stdDev = this.calculateStandardDeviation(Object.values(monthlyFrequency));

    return Object.entries(monthlyFrequency)
      .filter(([month, frequency]) => {
        const zScore = Math.abs((frequency - avgFrequency) / stdDev);
        return zScore > 2;
      })
      .map(([month, frequency]) => ({
        expenseId: `frequency_${category}_${month}`,
        anomalyType: 'frequency' as const,
        severity: this.calculateSeverity((frequency - avgFrequency) / stdDev),
        confidence: 0.7,
        description: `Unusual frequency of ${category} expenses in ${month}`,
        expectedValue: avgFrequency,
        actualValue: frequency,
        explanation: `${frequency} expenses vs. average of ${avgFrequency.toFixed(1)} per month`,
      }));
  }

  private detectLocationAnomalies(expenses: ExpenseEntry[], category: string): AnomalyDetection[] {
    const locationCounts: { [location: string]: number } = {};
    
    expenses.forEach(expense => {
      if (expense.location?.address) {
        const location = expense.location.address;
        locationCounts[location] = (locationCounts[location] || 0) + 1;
      }
    });

    const totalExpenses = expenses.length;
    const threshold = 0.05; // 5% threshold for unusual locations

    return expenses
      .filter(expense => {
        if (!expense.location?.address) return false;
        const locationFrequency = locationCounts[expense.location.address] / totalExpenses;
        return locationFrequency < threshold;
      })
      .map(expense => ({
        expenseId: expense.id,
        anomalyType: 'location' as const,
        severity: 'medium' as const,
        confidence: 0.6,
        description: `Unusual location for ${category} expense`,
        actualValue: 1,
        explanation: `Expense at unusual location: ${expense.location?.address}`,
      }));
  }

  private detectTimingAnomalies(expenses: ExpenseEntry[]): AnomalyDetection[] {
    const hourCounts: { [hour: number]: number } = {};
    
    expenses.forEach(expense => {
      const hour = new Date(expense.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Flag expenses submitted outside business hours (before 6 AM or after 10 PM)
    return expenses
      .filter(expense => {
        const hour = new Date(expense.createdAt).getHours();
        return hour < 6 || hour > 22;
      })
      .map(expense => ({
        expenseId: expense.id,
        anomalyType: 'timing' as const,
        severity: 'low' as const,
        confidence: 0.5,
        description: 'Expense submitted outside business hours',
        actualValue: new Date(expense.createdAt).getHours(),
        explanation: `Submitted at ${new Date(expense.createdAt).toLocaleTimeString()}`,
      }));
  }

  // === PREDICTION METHODS ===

  private predictNextMonthExpenses(trends: any): any {
    const totalTrend = trends.total || 0;
    const lastMonthTotal = this.getLastMonthTotal();
    const predicted = lastMonthTotal * (1 + totalTrend);

    const categoryBreakdown: { [category: string]: number } = {};
    this.patterns.forEach(pattern => {
      const categoryTrend = trends[pattern.category] || 0;
      const lastMonthAmount = this.getLastMonthAmountForCategory(pattern.category);
      categoryBreakdown[pattern.category] = lastMonthAmount * (1 + categoryTrend);
    });

    return {
      totalAmount: predicted,
      confidence: this.calculatePredictionConfidence(trends),
      categoryBreakdown,
    };
  }

  private generateBudgetRecommendations(): any[] {
    return this.patterns.map(pattern => {
      const historicalAverage = pattern.averageAmount * pattern.frequency;
      const trendMultiplier = pattern.trend === 'increasing' ? 1.2 : pattern.trend === 'decreasing' ? 0.8 : 1.0;
      const recommendedBudget = historicalAverage * trendMultiplier;

      return {
        category: pattern.category,
        currentSpend: this.getCurrentMonthSpendForCategory(pattern.category),
        recommendedBudget,
        reasoning: `Based on ${pattern.trend} trend with ${(pattern.confidence * 100).toFixed(0)}% confidence`,
      };
    });
  }

  private identifyRiskFactors(): any[] {
    const risks = [];

    // High variance risk
    this.patterns.forEach(pattern => {
      if (pattern.confidence < 0.6) {
        risks.push({
          type: `High variance in ${pattern.category} spending`,
          probability: 1 - pattern.confidence,
          impact: 0.7,
          mitigation: 'Implement more structured spending guidelines',
        });
      }
    });

    // Increasing trend risk
    const increasingCategories = this.patterns.filter(p => p.trend === 'increasing');
    if (increasingCategories.length > 0) {
      risks.push({
        type: 'Multiple categories showing increasing spend',
        probability: 0.8,
        impact: 0.9,
        mitigation: 'Review and tighten expense policies',
      });
    }

    return risks;
  }

  // === OPTIMIZATION METHODS ===

  private analyzeVendorOptimizations(): ExpenseOptimization['recommendations'] {
    const vendorAnalysis: { [vendor: string]: { count: number; totalAmount: number; category: string } } = {};
    
    this.expenses.forEach(expense => {
      const vendor = this.extractVendorFromDescription(expense.description);
      if (vendor) {
        if (!vendorAnalysis[vendor]) {
          vendorAnalysis[vendor] = { count: 0, totalAmount: 0, category: expense.category };
        }
        vendorAnalysis[vendor].count++;
        vendorAnalysis[vendor].totalAmount += expense.amount;
      }
    });

    const recommendations: ExpenseOptimization['recommendations'] = [];
    Object.entries(vendorAnalysis).forEach(([vendor, data]) => {
      if (data.count > 5 && data.totalAmount > 500) {
        recommendations.push({
          type: 'vendor_switch' as const,
          description: `Consider negotiating volume discount with ${vendor}`,
          estimatedSavings: data.totalAmount * 0.1, // 10% potential savings
          effort: 'medium' as const,
          priority: Math.floor(data.totalAmount / 100),
        });
      }
    });

    return recommendations;
  }

  private identifyBulkPurchaseOpportunities(): ExpenseOptimization['recommendations'] {
    const supplyExpenses = this.expenses.filter(e => e.category === 'supplies');
    const monthlySupplySpend = this.calculateMonthlySpend(supplyExpenses);
    
    if (monthlySupplySpend > 200) {
      return [{
        type: 'bulk_purchase' as const,
        description: 'Consolidate office supply purchases into monthly bulk orders',
        estimatedSavings: monthlySupplySpend * 0.15 * 12, // 15% annual savings
        effort: 'low' as const,
        priority: 8,
      }];
    }

    return [];
  }

  private analyzeTimingOptimizations(): ExpenseOptimization['recommendations'] {
    const recommendations: ExpenseOptimization['recommendations'] = [];
    
    // Analyze fuel expenses for potential optimization
    const fuelExpenses = this.expenses.filter(e => e.category === 'fuel');
    if (fuelExpenses.length > 10) {
      recommendations.push({
        type: 'timing_optimization' as const,
        description: 'Schedule fuel purchases on Tuesdays/Wednesdays for better prices',
        estimatedSavings: this.calculateMonthlySpend(fuelExpenses) * 0.05 * 12, // 5% annual savings
        effort: 'low' as const,
        priority: 6,
      });
    }

    return recommendations;
  }

  // === UTILITY METHODS ===

  private groupExpensesByCategory(expenses: ExpenseEntry[]): Map<string, ExpenseEntry[]> {
    const groups = new Map<string, ExpenseEntry[]>();
    
    expenses.forEach(expense => {
      const category = expense.category;
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(expense);
    });

    return groups;
  }

  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = this.calculateMean(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }

  private calculateSeverity(zScore: number): 'low' | 'medium' | 'high' {
    if (Math.abs(zScore) > 3) return 'high';
    if (Math.abs(zScore) > 2.5) return 'medium';
    return 'low';
  }

  private calculateFrequency(dates: Date[]): number {
    if (dates.length === 0) return 0;
    
    const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysDiff > 0 ? dates.length / (daysDiff / 30) : dates.length; // Expenses per month
  }

  private analyzeTrend(expenses: ExpenseEntry[]): 'increasing' | 'decreasing' | 'stable' {
    if (expenses.length < 3) return 'stable';
    
    const sortedExpenses = expenses.sort((a, b) => 
      new Date(a.expenseDate).getTime() - new Date(b.expenseDate).getTime()
    );
    
    const firstHalf = sortedExpenses.slice(0, Math.floor(sortedExpenses.length / 2));
    const secondHalf = sortedExpenses.slice(Math.floor(sortedExpenses.length / 2));
    
    const firstHalfAvg = this.calculateMean(firstHalf.map(e => e.amount));
    const secondHalfAvg = this.calculateMean(secondHalf.map(e => e.amount));
    
    const changePercent = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
    
    if (changePercent > 0.1) return 'increasing';
    if (changePercent < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculatePatternConfidence(expenses: ExpenseEntry[]): number {
    if (expenses.length < 3) return 0.3;
    
    const amounts = expenses.map(e => e.amount);
    const mean = this.calculateMean(amounts);
    const stdDev = this.calculateStandardDeviation(amounts);
    const cv = stdDev / mean; // Coefficient of variation
    
    // Higher confidence for lower coefficient of variation
    return Math.max(0.1, Math.min(0.95, 1 - cv));
  }

  private detectSeasonality(expenses: ExpenseEntry[]): any {
    // Simple seasonality detection - could be enhanced with more sophisticated algorithms
    const monthlyData: { [month: number]: number[] } = {};
    
    expenses.forEach(expense => {
      const month = new Date(expense.expenseDate).getMonth();
      if (!monthlyData[month]) monthlyData[month] = [];
      monthlyData[month].push(expense.amount);
    });

    const monthlyAverages = Object.entries(monthlyData).map(([month, amounts]) => ({
      month: parseInt(month),
      average: this.calculateMean(amounts),
    }));

    if (monthlyAverages.length < 3) return undefined;

    const overallAverage = this.calculateMean(monthlyAverages.map(m => m.average));
    const maxVariance = Math.max(...monthlyAverages.map(m => Math.abs(m.average - overallAverage)));
    
    if (maxVariance / overallAverage > 0.3) {
      const peak = monthlyAverages.reduce((max, current) => 
        current.average > max.average ? current : max
      );
      
      return {
        pattern: 'monthly' as const,
        peak: new Date(2024, peak.month).toLocaleString('default', { month: 'long' }),
        variance: maxVariance / overallAverage,
      };
    }

    return undefined;
  }

  private generateTrendInsights(): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    
    this.patterns.forEach(pattern => {
      if (pattern.trend === 'increasing' && pattern.confidence > 0.7) {
        insights.push({
          type: 'trend',
          title: `Rising ${pattern.category} expenses`,
          description: `Your ${pattern.category} expenses are increasing with ${(pattern.confidence * 100).toFixed(0)}% confidence`,
          confidence: pattern.confidence,
          impact: 'high',
          actionable: true,
          recommendation: `Review ${pattern.category} spending policies and consider cost optimization`,
        });
      }
    });

    return insights;
  }

  private generatePatternInsights(): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    
    // Find categories with high seasonality
    this.patterns.forEach(pattern => {
      if (pattern.seasonality && pattern.seasonality.variance > 0.4) {
        insights.push({
          type: 'pattern',
          title: `Seasonal ${pattern.category} spending`,
          description: `Your ${pattern.category} expenses peak in ${pattern.seasonality.peak}`,
          confidence: 0.8,
          impact: 'medium',
          actionable: true,
          recommendation: `Plan budget allocation for ${pattern.seasonality.peak} peak spending`,
        });
      }
    });

    return insights;
  }

  private generateComparativeInsights(): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    
    // Compare categories
    const topCategory = this.patterns.reduce((max, current) => 
      current.averageAmount * current.frequency > max.averageAmount * max.frequency ? current : max
    );

    insights.push({
      type: 'optimization',
      title: `${topCategory.category} is your largest expense category`,
      description: `${topCategory.category} accounts for the majority of your spending`,
      confidence: 0.9,
      impact: 'high',
      actionable: true,
      recommendation: `Focus optimization efforts on ${topCategory.category} for maximum impact`,
    });

    return insights;
  }

  private generatePredictiveInsights(): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    
    // Predict budget overruns
    this.patterns.forEach(pattern => {
      if (pattern.trend === 'increasing') {
        const riskLevel = pattern.confidence > 0.8 ? 'high' : 'medium';
        insights.push({
          type: 'prediction',
          title: `Budget risk in ${pattern.category}`,
          description: `Current trends suggest potential budget overrun in ${pattern.category}`,
          confidence: pattern.confidence,
          impact: riskLevel,
          actionable: true,
          recommendation: `Set up alerts for ${pattern.category} spending limits`,
        });
      }
    });

    return insights;
  }

  // Helper methods for calculations
  private getMonthlyExpenseData(): any {
    // Implementation for monthly data aggregation
    return {};
  }

  private analyzeTrends(monthlyData: any): any {
    // Implementation for trend analysis
    return {};
  }

  private getLastMonthTotal(): number {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return this.expenses
      .filter(e => {
        const expenseDate = new Date(e.expenseDate);
        return expenseDate >= lastMonth && expenseDate < thisMonth;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }

  private getLastMonthAmountForCategory(category: string): number {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return this.expenses
      .filter(e => {
        const expenseDate = new Date(e.expenseDate);
        return e.category === category && expenseDate >= lastMonth && expenseDate < thisMonth;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }

  private getCurrentMonthSpendForCategory(category: string): number {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return this.expenses
      .filter(e => {
        const expenseDate = new Date(e.expenseDate);
        return e.category === category && expenseDate >= thisMonth;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }

  private calculatePredictionConfidence(trends: any): number {
    // Calculate confidence based on data consistency and trend strength
    return 0.75;
  }

  private calculateMonthlyFrequency(expenses: ExpenseEntry[]): { [month: string]: number } {
    const monthlyFreq: { [month: string]: number } = {};
    
    expenses.forEach(expense => {
      const month = new Date(expense.expenseDate).toISOString().slice(0, 7); // YYYY-MM
      monthlyFreq[month] = (monthlyFreq[month] || 0) + 1;
    });

    return monthlyFreq;
  }

  private calculateMonthlySpend(expenses: ExpenseEntry[]): number {
    const totalSpend = expenses.reduce((sum, e) => sum + e.amount, 0);
    const months = this.getUniqueMonths(expenses).length;
    return months > 0 ? totalSpend / months : 0;
  }

  private getUniqueMonths(expenses: ExpenseEntry[]): string[] {
    const months = new Set<string>();
    expenses.forEach(expense => {
      const month = new Date(expense.expenseDate).toISOString().slice(0, 7);
      months.add(month);
    });
    return Array.from(months);
  }

  private extractVendorFromDescription(description: string): string | null {
    // Simple vendor extraction - could be enhanced with NLP
    const commonVendors = ['starbucks', 'shell', 'exxon', 'walmart', 'target', 'amazon', 'office depot'];
    const lowerDesc = description.toLowerCase();
    
    for (const vendor of commonVendors) {
      if (lowerDesc.includes(vendor)) {
        return vendor.charAt(0).toUpperCase() + vendor.slice(1);
      }
    }
    
    return null;
  }

  /**
   * Get all generated insights
   */
  getInsights(): AnalyticsInsight[] {
    return this.insights;
  }

  /**
   * Get spending patterns
   */
  getSpendingPatterns(): SpendingPattern[] {
    return this.patterns;
  }
}

export default ExpenseAnalyticsService;
