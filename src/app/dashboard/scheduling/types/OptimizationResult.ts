import { ScheduledTask } from './ScheduledTask';

// Optimization Result type definitions
export interface OptimizationResult {
  id: string;
  scheduledTasks: ScheduledTask[];
  unscheduledTasks: UnscheduledTask[];
  optimization: {
    algorithm: 'genetic' | 'greedy' | 'simulated_annealing' | 'linear_programming' | 'hybrid';
    parameters: OptimizationParameters;
    results: OptimizationMetrics;
    iterations?: number;
    convergence?: {
      generation: number;
      score: number;
      improvement: number;
    }[];
  };
  resourceUtilization: ResourceUtilization[];
  conflicts: OptimizationConflict[];
  recommendations: OptimizationRecommendation[];
  performance: {
    executionTime: number; // in milliseconds
    memoryUsage?: number; // in MB
    cpuUsage?: number; // percentage
  };
  createdAt: string;
  createdBy: string;
  appliedAt?: string;
  appliedBy?: string;
  status: 'pending' | 'optimizing' | 'completed' | 'failed' | 'applied' | 'cancelled';
  version: string;
}

// Optimization parameters
export interface OptimizationParameters {
  objectives: Array<{
    type: 'minimize_travel_time' | 'maximize_utilization' | 'minimize_cost' | 'maximize_customer_satisfaction' | 'minimize_overtime' | 'balance_workload';
    weight: number; // 0-1
    priority: number; // 1-10
  }>;
  constraints: {
    timeWindows: {
      start: string;
      end: string;
    };
    resourceAvailability: boolean;
    skillRequirements: boolean;
    locationConstraints: boolean;
    workOrderDependencies: boolean;
    maxTravelTime?: number; // in minutes
    maxOvertimePerResource?: number; // in minutes
    minBreakTime?: number; // in minutes between tasks
  };
  algorithmSettings: {
    maxIterations?: number;
    populationSize?: number; // for genetic algorithm
    mutationRate?: number; // for genetic algorithm
    crossoverRate?: number; // for genetic algorithm
    temperature?: number; // for simulated annealing
    coolingRate?: number; // for simulated annealing
    tolerance?: number; // convergence tolerance
    timeLimit?: number; // max execution time in seconds
  };
  preferences: {
    preferEarlyStart: boolean;
    preferResourceContinuity: boolean;
    minimizeResourceSwitching: boolean;
    respectBreakTimes: boolean;
    allowOvertime: boolean;
    prioritizeDeadlines: boolean;
  };
}

// Optimization metrics
export interface OptimizationMetrics {
  finalScore: number; // 0-100
  improvementPercentage: number;
  objectiveScores: Record<string, number>;
  scheduledTasks: number;
  unscheduledTasks: number;
  totalWorkOrders: number;
  averageTravelTime: number; // in minutes
  totalTravelTime: number; // in minutes
  resourceUtilization: number; // average percentage
  overtimeHours: number;
  costSavings: number; // estimated cost savings
  customerSatisfactionScore: number; // 0-100
  qualityMetrics: {
    scheduleCompactness: number; // 0-100
    resourceBalance: number; // 0-100
    timeEfficiency: number; // 0-100
    constraintViolations: number;
    softConstraintViolations: number;
  };
  convergenceInfo?: {
    converged: boolean;
    finalGeneration: number;
    bestScore: number;
    averageScore: number;
    convergenceRate: number;
  };
}

// Unscheduled task information
export interface UnscheduledTask {
  workOrderId: string;
  reason: 'no_available_resources' | 'skill_mismatch' | 'time_constraint' | 'location_constraint' | 'dependency_not_met' | 'cost_limit_exceeded';
  details: string;
  suggestedActions: Array<{
    action: 'hire_resource' | 'train_resource' | 'extend_deadline' | 'relax_constraints' | 'increase_budget';
    description: string;
    estimatedCost?: number;
    estimatedTime?: number; // in days
    priority: 'low' | 'medium' | 'high';
  }>;
  alternativeOptions: Array<{
    description: string;
    feasibilityScore: number; // 0-100
    requiredChanges: string[];
  }>;
}

// Resource utilization information
export interface ResourceUtilization {
  resourceId: string;
  resourceName: string;
  resourceType: 'staff' | 'equipment' | 'vehicle';
  totalAvailableTime: number; // in minutes
  scheduledTime: number; // in minutes
  utilizationPercentage: number;
  efficiency: number; // 0-100
  taskCount: number;
  travelTime: number; // in minutes
  idleTime: number; // in minutes
  overtimeHours: number;
  tasks: Array<{
    taskId: string;
    workOrderId: string;
    start: string;
    end: string;
    duration: number;
    travelTimeBefore: number;
    travelTimeAfter: number;
  }>;
  performance: {
    averageTaskDuration: number;
    longestGap: number; // longest idle period in minutes
    numberOfGaps: number;
    workloadBalance: number; // 0-100, how evenly distributed the work is
  };
}

// Optimization conflicts
export interface OptimizationConflict {
  id: string;
  type: 'hard_constraint_violation' | 'soft_constraint_violation' | 'resource_overallocation' | 'time_overlap';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedTasks: string[];
  affectedResources: string[];
  impact: {
    optimizationScore: number; // negative impact on score
    additionalCost?: number;
    delayMinutes?: number;
    resourceUtilizationImpact?: number;
  };
  resolution: {
    automatic: boolean;
    options: Array<{
      description: string;
      cost: number; // impact on optimization score
      feasible: boolean;
      recommendationLevel: 'not_recommended' | 'acceptable' | 'recommended' | 'highly_recommended';
    }>;
  };
}

// Optimization recommendations
export interface OptimizationRecommendation {
  id: string;
  type: 'performance_improvement' | 'cost_reduction' | 'resource_optimization' | 'schedule_adjustment' | 'capacity_planning';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedBenefit: {
    scoreImprovement?: number;
    costSavings?: number;
    timeReduction?: number; // in minutes
    utilizationImprovement?: number; // percentage points
  };
  implementation: {
    effort: 'low' | 'medium' | 'high';
    timeRequired: string; // human readable
    requiredActions: string[];
    estimatedCost?: number;
  };
  category: 'immediate' | 'short_term' | 'long_term' | 'strategic';
  relatedTasks?: string[];
  relatedResources?: string[];
}

// Optimization comparison
export interface OptimizationComparison {
  baselineId?: string;
  optimizedId: string;
  improvements: {
    totalImprovement: number; // percentage
    objectiveImprovements: Record<string, number>;
    metricComparisons: Array<{
      metric: string;
      baseline: number;
      optimized: number;
      improvement: number;
      unit: string;
    }>;
  };
  tradeoffs: Array<{
    improved: string;
    degraded: string;
    impactLevel: 'minimal' | 'moderate' | 'significant';
    acceptable: boolean;
  }>;
  recommendation: 'apply' | 'review' | 'reoptimize' | 'reject';
  confidence: number; // 0-100
}

// Optimization history
export interface OptimizationHistory {
  id: string;
  timestamp: string;
  algorithm: OptimizationResult['optimization']['algorithm'];
  finalScore: number;
  improvementPercentage: number;
  executionTime: number;
  tasksScheduled: number;
  appliedToProduction: boolean;
  performanceActual?: {
    actualScore: number;
    accuracyPercentage: number;
    deviationFactors: Array<{
      factor: string;
      impact: number;
    }>;
  };
}

// Real-time optimization status
export interface OptimizationStatus {
  id: string;
  status: 'queued' | 'initializing' | 'running' | 'finalizing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    percentage: number;
    currentPhase: string;
    estimatedTimeRemaining?: number; // in seconds
    currentIteration?: number;
    totalIterations?: number;
    currentScore?: number;
    bestScore?: number;
  };
  startTime: string;
  estimatedEndTime?: string;
  actualEndTime?: string;
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    priority: 'low' | 'normal' | 'high';
  };
  messages: Array<{
    timestamp: string;
    level: 'info' | 'warning' | 'error';
    message: string;
  }>;
}

export default OptimizationResult;
