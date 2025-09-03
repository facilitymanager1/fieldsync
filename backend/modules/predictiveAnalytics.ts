// Predictive Analytics for SLA Engine
// ML-based predictions and risk analysis
import { SlaTracker } from '../models/advancedSla';

export interface RiskPrediction {
  riskScore: number; // 0-1 scale
  confidence: number; // 0-1 scale
  factors: RiskFactor[];
  recommendation: string;
}

export interface RiskFactor {
  factor: string;
  impact: number; // -1 to 1
  description: string;
}

export interface WorkloadPrediction {
  predictedTicketCount: number;
  predictedWorkloadHours: number;
  confidenceLevel: number;
  timeframe: number; // hours
}

export class PredictiveAnalytics {
  private historicalData: Map<string, any[]> = new Map();

  async calculateBreachRisk(tracker: SlaTracker): Promise<number> {
    // Simplified risk calculation based on time remaining and historical patterns
    const now = new Date();
    const responseTimeRemaining = tracker.responseDeadline.getTime() - now.getTime();
    const resolutionTimeRemaining = tracker.resolutionDeadline.getTime() - now.getTime();
    
    // Base risk factors
    let riskScore = 0;
    
    // Time pressure factor
    const responseHoursRemaining = responseTimeRemaining / (1000 * 60 * 60);
    const resolutionHoursRemaining = resolutionTimeRemaining / (1000 * 60 * 60);
    
    if (responseHoursRemaining < 1) riskScore += 0.4;
    else if (responseHoursRemaining < 2) riskScore += 0.3;
    else if (responseHoursRemaining < 4) riskScore += 0.2;
    
    if (resolutionHoursRemaining < 2) riskScore += 0.3;
    else if (resolutionHoursRemaining < 4) riskScore += 0.2;
    else if (resolutionHoursRemaining < 8) riskScore += 0.1;
    
    // Escalation level factor
    riskScore += tracker.escalationLevel * 0.1;
    
    // Current stage factor
    if (tracker.currentStage === 'awaiting_response') riskScore += 0.2;
    
    // Historical pattern factor (simplified)
    const historicalBreachRate = await this.getHistoricalBreachRate(tracker.entityType);
    riskScore += historicalBreachRate * 0.2;
    
    return Math.min(1, Math.max(0, riskScore));
  }

  async predictWorkload(userId: string, timeframeHours: number): Promise<WorkloadPrediction> {
    // Simplified workload prediction
    const historical = this.getHistoricalWorkload(userId);
    
    // Calculate average tickets per hour
    const avgTicketsPerHour = historical.length > 0 ? 
      historical.reduce((sum, item) => sum + item.ticketsPerHour, 0) / historical.length : 0.5;
    
    // Calculate average hours per ticket
    const avgHoursPerTicket = historical.length > 0 ?
      historical.reduce((sum, item) => sum + item.hoursPerTicket, 0) / historical.length : 2;
    
    const predictedTickets = Math.round(avgTicketsPerHour * timeframeHours);
    const predictedHours = predictedTickets * avgHoursPerTicket;
    
    return {
      predictedTicketCount: predictedTickets,
      predictedWorkloadHours: predictedHours,
      confidenceLevel: historical.length > 10 ? 0.8 : 0.5,
      timeframe: timeframeHours,
    };
  }

  async analyzeBreachRisk(tracker: SlaTracker): Promise<RiskPrediction> {
    const riskScore = await this.calculateBreachRisk(tracker);
    const factors: RiskFactor[] = [];
    
    const now = new Date();
    const responseTimeRemaining = tracker.responseDeadline.getTime() - now.getTime();
    const resolutionTimeRemaining = tracker.resolutionDeadline.getTime() - now.getTime();
    
    // Analyze time pressure
    const responseHoursRemaining = responseTimeRemaining / (1000 * 60 * 60);
    if (responseHoursRemaining < 2) {
      factors.push({
        factor: 'time_pressure',
        impact: 0.4,
        description: `Only ${responseHoursRemaining.toFixed(1)} hours until response deadline`,
      });
    }
    
    // Analyze escalation level
    if (tracker.escalationLevel > 0) {
      factors.push({
        factor: 'escalation_level',
        impact: tracker.escalationLevel * 0.1,
        description: `Currently at escalation level ${tracker.escalationLevel}`,
      });
    }
    
    // Analyze current stage
    if (tracker.currentStage === 'awaiting_response') {
      factors.push({
        factor: 'awaiting_response',
        impact: 0.2,
        description: 'Still awaiting initial response',
      });
    }
    
    let recommendation = '';
    if (riskScore > 0.8) {
      recommendation = 'Immediate attention required - very high breach risk';
    } else if (riskScore > 0.6) {
      recommendation = 'Urgent action needed - high breach risk';
    } else if (riskScore > 0.4) {
      recommendation = 'Monitor closely - moderate breach risk';
    } else {
      recommendation = 'On track - low breach risk';
    }
    
    return {
      riskScore,
      confidence: 0.75, // Simplified confidence score
      factors,
      recommendation,
    };
  }

  async getOptimizationSuggestions(templateId: string): Promise<Array<{
    type: string;
    suggestion: string;
    impact: string;
    confidence: number;
  }>> {
    // Simplified optimization suggestions
    const suggestions = [];
    
    const metrics = await this.getTemplateMetrics(templateId);
    
    if (metrics.breachRate > 0.2) {
      suggestions.push({
        type: 'response_time',
        suggestion: 'Consider increasing response time targets by 25%',
        impact: 'Could reduce breach rate by 10-15%',
        confidence: 0.7,
      });
    }
    
    if (metrics.escalationRate > 0.3) {
      suggestions.push({
        type: 'escalation_timing',
        suggestion: 'Trigger first escalation earlier in the process',
        impact: 'Could improve resolution time by 20%',
        confidence: 0.8,
      });
    }
    
    return suggestions;
  }

  // Private helper methods
  
  private async getHistoricalBreachRate(entityType: string): Promise<number> {
    // Simplified historical breach rate calculation
    const data = this.historicalData.get(entityType) || [];
    if (data.length === 0) return 0.1; // Default 10% breach rate
    
    const breaches = data.filter(item => item.isBreached).length;
    return breaches / data.length;
  }

  private getHistoricalWorkload(userId: string): Array<{
    ticketsPerHour: number;
    hoursPerTicket: number;
  }> {
    // Simplified historical workload data
    const data = this.historicalData.get(`workload_${userId}`) || [];
    return data.length > 0 ? data : [
      { ticketsPerHour: 0.5, hoursPerTicket: 2 },
      { ticketsPerHour: 0.6, hoursPerTicket: 1.8 },
      { ticketsPerHour: 0.4, hoursPerTicket: 2.2 },
    ];
  }

  private async getTemplateMetrics(templateId: string): Promise<{
    breachRate: number;
    escalationRate: number;
    avgResponseTime: number;
    avgResolutionTime: number;
  }> {
    // Simplified template metrics
    return {
      breachRate: 0.15, // 15% breach rate
      escalationRate: 0.25, // 25% escalation rate
      avgResponseTime: 2.5, // 2.5 hours average response
      avgResolutionTime: 8.0, // 8 hours average resolution
    };
  }

  // Data management methods
  
  addHistoricalData(key: string, data: any): void {
    if (!this.historicalData.has(key)) {
      this.historicalData.set(key, []);
    }
    this.historicalData.get(key)!.push({
      ...data,
      timestamp: new Date(),
    });
    
    // Keep only last 100 entries per key
    const entries = this.historicalData.get(key)!;
    if (entries.length > 100) {
      this.historicalData.set(key, entries.slice(-100));
    }
  }

  clearHistoricalData(key?: string): void {
    if (key) {
      this.historicalData.delete(key);
    } else {
      this.historicalData.clear();
    }
  }
}
