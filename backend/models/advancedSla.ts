// Advanced SLA Engine Data Models
// Enhanced models for comprehensive SLA management
import { Schema, model, Document } from 'mongoose';

// Core SLA Template with advanced features
export interface AdvancedSlaTemplate {
  id: string;
  name: string;
  description: string;
  
  // Service Categories
  category: 'ticket' | 'service_request' | 'leave' | 'meeting' | 'work_order';
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  // Time Definitions
  responseTime: {
    hours: number;
    businessHoursOnly: boolean;
    excludeWeekends: boolean;
    excludeHolidays: boolean;
  };
  
  resolutionTime: {
    hours: number;
    businessHoursOnly: boolean;
    excludeWeekends: boolean;
    excludeHolidays: boolean;
  };
  
  // Advanced Escalation Rules
  escalationRules: EscalationRule[];
  
  // Conditional Logic
  conditions: SlaCondition[];
  
  // Client & Contract Specific
  clientId?: string;
  contractId?: string;
  
  // Metrics & Targets
  targetMetrics: {
    responseTarget: number; // percentage
    resolutionTarget: number; // percentage
    customerSatisfactionTarget: number;
  };
  
  // Automation Rules
  autoAssignment: {
    enabled: boolean;
    rules: AutoAssignmentRule[];
  };
  
  // Advanced Features
  autoEscalateOnHighRisk: boolean;
  enablePredictiveAlerts: boolean;
  pauseOnWeekends: boolean;
  pauseOnHolidays: boolean;
  
  // Status & Lifecycle
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  version: number;
  
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
}

export interface EscalationRule {
  id: string;
  level: number;
  triggerAfterHours: number;
  triggerConditions: string[]; // JSON Logic conditions
  actions: EscalationAction[];
  isActive: boolean;
  notificationTemplate?: string;
}

export interface EscalationAction {
  type: 'notify' | 'reassign' | 'escalate' | 'auto_resolve' | 'create_ticket';
  target: string[]; // user IDs, roles, or external systems
  template: string; // notification template ID
  priority: number;
  parameters?: Record<string, any>;
}

export interface SlaCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface AutoAssignmentRule {
  conditions: SlaCondition[];
  assignmentType: 'round_robin' | 'skill_based' | 'workload_based' | 'location_based';
  targetPool: string[]; // user IDs or team IDs
  weight: number;
}

// SLA Tracking & Events
export interface SlaTracker {
  id: string;
  entityId: string; // ticket ID, leave ID, etc.
  entityType: string;
  slaTemplateId: string;
  
  // Timeline
  startTime: Date;
  responseDeadline: Date;
  resolutionDeadline: Date;
  
  // Status Tracking
  status: 'active' | 'paused' | 'resolved' | 'breached' | 'cancelled';
  currentStage: 'awaiting_response' | 'in_progress' | 'awaiting_approval' | 'resolved';
  
  // Response Metrics
  responseTime?: Date;
  resolutionTime?: Date;
  actualResponseHours?: number;
  actualResolutionHours?: number;
  
  // Breach Information
  isBreached: boolean;
  breachType?: 'response' | 'resolution';
  breachTime?: Date;
  breachReason?: string;
  
  // Escalation Tracking
  escalationLevel: number;
  escalationHistory: EscalationEvent[];
  
  // Performance Metrics
  customerSatisfactionScore?: number;
  qualityScore?: number;
  
  // Assignment
  assignedTo?: string;
  assignedAt?: Date;
  assignmentHistory: AssignmentEvent[];
  
  // Pause/Resume
  pausedDuration: number; // minutes
  pauseReasons: PauseReason[];
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationEvent {
  id: string;
  level: number;
  triggeredAt: Date;
  triggeredBy: 'system' | 'user';
  userId?: string;
  reason: string;
  actions: EscalationAction[];
  notificationsSent: NotificationLog[];
  outcome?: string;
}

export interface AssignmentEvent {
  assignedTo: string;
  assignedAt: Date;
  assignedBy: string;
  reason: string;
  previousAssignee?: string;
}

export interface PauseReason {
  pausedAt: Date;
  resumedAt?: Date;
  reason: string;
  pausedBy: string;
  category: 'waiting_for_client' | 'waiting_for_approval' | 'technical_issue' | 'other';
}

export interface NotificationLog {
  id: string;
  type: 'email' | 'push' | 'sms' | 'slack' | 'teams';
  recipient: string;
  sentAt: Date;
  status: 'sent' | 'delivered' | 'failed';
  template: string;
  content?: string;
}

// Performance and Analytics Models
export interface SlaMetricsSummary {
  totalSlas: number;
  breachedSlas: number;
  complianceRate: number;
  
  responseTimeMetrics: {
    average: number;
    p50: number;
    p90: number;
    p99: number;
  };
  
  resolutionTimeMetrics: {
    average: number;
    p50: number;
    p90: number;
    p99: number;
  };
  
  escalationMetrics: {
    totalEscalations: number;
    averageEscalationLevel: number;
    escalationRate: number;
  };
  
  trendData: MetricTrendData[];
  breachReasons: BreachReasonSummary[];
}

export interface MetricTrendData {
  timestamp: Date;
  complianceRate: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  escalationCount: number;
}

export interface BreachReasonSummary {
  reason: string;
  count: number;
  percentage: number;
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: Date;
  timeRange: TimeRange;
  clientId?: string;
  
  summary: {
    overallCompliance: number;
    industryBenchmark: number;
    performanceGap: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  
  detailedMetrics: SlaMetricsSummary;
  recommendations: OptimizationSuggestion[];
  executiveSummary: string;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface OptimizationSuggestion {
  type: 'response_time_adjustment' | 'escalation_timing' | 'resource_allocation' | 'template_optimization';
  currentValue: any;
  suggestedValue: any;
  reasoning: string;
  impact: string;
  confidence: number;
  implementation: 'easy' | 'moderate' | 'complex';
}

// Predictive Analytics Models
export interface WorkloadPrediction {
  predictedTicketCount: number;
  predictedWorkloadHours: number;
  confidenceLevel: number;
  timeframe: number;
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  factor: string;
  impact: number;
  description: string;
}

export interface SlaContext {
  priority?: string;
  issueType?: string;
  clientId?: string;
  reporterId?: string;
  location?: string;
  timeOfDay?: number;
  dayOfWeek?: number;
  seasonalFactor?: number;
  currentWorkload?: number;
  [key: string]: any;
}

// Integration Models
export interface ServiceDeskIntegration {
  type: 'jira' | 'servicenow' | 'zendesk' | 'freshdesk';
  baseUrl: string;
  apiKey: string;
  secret: string;
  mappingRules: FieldMapping[];
  webhookUrl?: string;
  isActive: boolean;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformation?: string;
  defaultValue?: any;
}

export interface SlackIntegration {
  workspaceId: string;
  botToken: string;
  signingSecret: string;
  channels: ChannelMapping[];
  isActive: boolean;
}

export interface ChannelMapping {
  eventType: string;
  channelId: string;
  template: string;
}

export interface TeamsIntegration {
  tenantId: string;
  appId: string;
  appSecret: string;
  channels: ChannelMapping[];
  isActive: boolean;
}

// Experiment and Testing Models
export interface SlaExperiment {
  id: string;
  name: string;
  description: string;
  controlTemplate: string;
  testTemplate: string;
  trafficSplit: number; // percentage for test group
  startDate: Date;
  endDate: Date;
  successMetrics: string[];
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  results?: ExperimentResults;
}

export interface ExperimentResults {
  controlMetrics: SlaMetricsSummary;
  testMetrics: SlaMetricsSummary;
  significance: number;
  winner?: 'control' | 'test' | 'inconclusive';
  recommendation: string;
}

// MongoDB Schemas
const AdvancedSlaTemplateSchema = new Schema<AdvancedSlaTemplate>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['ticket', 'service_request', 'leave', 'meeting', 'work_order'],
    required: true 
  },
  priority: { 
    type: String, 
    enum: ['critical', 'high', 'medium', 'low'],
    required: true 
  },
  responseTime: {
    hours: { type: Number, required: true },
    businessHoursOnly: { type: Boolean, default: true },
    excludeWeekends: { type: Boolean, default: true },
    excludeHolidays: { type: Boolean, default: true }
  },
  resolutionTime: {
    hours: { type: Number, required: true },
    businessHoursOnly: { type: Boolean, default: true },
    excludeWeekends: { type: Boolean, default: true },
    excludeHolidays: { type: Boolean, default: true }
  },
  escalationRules: [{
    level: { type: Number, required: true },
    triggerAfterHours: { type: Number, required: true },
    triggerConditions: [{ type: String }],
    actions: [{
      type: { 
        type: String, 
        enum: ['notify', 'reassign', 'escalate', 'auto_resolve', 'create_ticket'],
        required: true 
      },
      target: [{ type: String }],
      template: { type: String, required: true },
      priority: { type: Number, default: 1 },
      parameters: { type: Schema.Types.Mixed }
    }],
    isActive: { type: Boolean, default: true },
    notificationTemplate: { type: String }
  }],
  conditions: [{
    field: { type: String, required: true },
    operator: { 
      type: String, 
      enum: ['equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in'],
      required: true 
    },
    value: { type: Schema.Types.Mixed, required: true },
    logicalOperator: { type: String, enum: ['AND', 'OR'] }
  }],
  clientId: { type: String },
  contractId: { type: String },
  targetMetrics: {
    responseTarget: { type: Number, min: 0, max: 100, default: 95 },
    resolutionTarget: { type: Number, min: 0, max: 100, default: 95 },
    customerSatisfactionTarget: { type: Number, min: 0, max: 5, default: 4.0 }
  },
  autoAssignment: {
    enabled: { type: Boolean, default: false },
    rules: [{
      conditions: [{
        field: { type: String, required: true },
        operator: { type: String, required: true },
        value: { type: Schema.Types.Mixed, required: true },
        logicalOperator: { type: String, enum: ['AND', 'OR'] }
      }],
      assignmentType: { 
        type: String, 
        enum: ['round_robin', 'skill_based', 'workload_based', 'location_based'],
        required: true 
      },
      targetPool: [{ type: String }],
      weight: { type: Number, default: 1 }
    }]
  },
  autoEscalateOnHighRisk: { type: Boolean, default: false },
  enablePredictiveAlerts: { type: Boolean, default: true },
  pauseOnWeekends: { type: Boolean, default: false },
  pauseOnHolidays: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  effectiveFrom: { type: Date, default: Date.now },
  effectiveTo: { type: Date },
  version: { type: Number, default: 1 },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedBy: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const SlaTrackerSchema = new Schema<SlaTracker>({
  entityId: { type: String, required: true },
  entityType: { type: String, required: true },
  slaTemplateId: { type: String, required: true },
  startTime: { type: Date, required: true },
  responseDeadline: { type: Date, required: true },
  resolutionDeadline: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['active', 'paused', 'resolved', 'breached', 'cancelled'],
    default: 'active' 
  },
  currentStage: { 
    type: String, 
    enum: ['awaiting_response', 'in_progress', 'awaiting_approval', 'resolved'],
    default: 'awaiting_response' 
  },
  responseTime: { type: Date },
  resolutionTime: { type: Date },
  actualResponseHours: { type: Number },
  actualResolutionHours: { type: Number },
  isBreached: { type: Boolean, default: false },
  breachType: { type: String, enum: ['response', 'resolution'] },
  breachTime: { type: Date },
  breachReason: { type: String },
  escalationLevel: { type: Number, default: 0 },
  escalationHistory: [{
    level: { type: Number, required: true },
    triggeredAt: { type: Date, required: true },
    triggeredBy: { type: String, enum: ['system', 'user'], required: true },
    userId: { type: String },
    reason: { type: String, required: true },
    actions: [{ type: Schema.Types.Mixed }],
    notificationsSent: [{ type: Schema.Types.Mixed }],
    outcome: { type: String }
  }],
  customerSatisfactionScore: { type: Number, min: 0, max: 5 },
  qualityScore: { type: Number, min: 0, max: 100 },
  assignedTo: { type: String },
  assignedAt: { type: Date },
  assignmentHistory: [{
    assignedTo: { type: String, required: true },
    assignedAt: { type: Date, required: true },
    assignedBy: { type: String, required: true },
    reason: { type: String, required: true },
    previousAssignee: { type: String }
  }],
  pausedDuration: { type: Number, default: 0 },
  pauseReasons: [{
    pausedAt: { type: Date, required: true },
    resumedAt: { type: Date },
    reason: { type: String, required: true },
    pausedBy: { type: String, required: true },
    category: { 
      type: String, 
      enum: ['waiting_for_client', 'waiting_for_approval', 'technical_issue', 'other'],
      required: true 
    }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create indexes for optimal performance
AdvancedSlaTemplateSchema.index({ category: 1, priority: 1 });
AdvancedSlaTemplateSchema.index({ clientId: 1, isActive: 1 });
AdvancedSlaTemplateSchema.index({ effectiveFrom: 1, effectiveTo: 1 });

SlaTrackerSchema.index({ entityId: 1, entityType: 1 }, { unique: true });
SlaTrackerSchema.index({ slaTemplateId: 1 });
SlaTrackerSchema.index({ status: 1, responseDeadline: 1 });
SlaTrackerSchema.index({ status: 1, resolutionDeadline: 1 });
SlaTrackerSchema.index({ isBreached: 1, breachTime: 1 });
SlaTrackerSchema.index({ escalationLevel: 1 });
SlaTrackerSchema.index({ assignedTo: 1, status: 1 });

export const AdvancedSlaTemplateModel = model<AdvancedSlaTemplate>('AdvancedSlaTemplate', AdvancedSlaTemplateSchema);
export const SlaTrackerModel = model<SlaTracker>('SlaTracker', SlaTrackerSchema);
