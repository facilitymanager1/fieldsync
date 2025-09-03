/**
 * Predefined Database Index Configurations
 * Optimized compound indexes for FieldSync business models
 */

export interface IndexDefinition {
  name: string;
  fields: Record<string, 1 | -1 | 'text' | '2dsphere'>;
  options?: {
    unique?: boolean;
    sparse?: boolean;
    background?: boolean;
    partialFilterExpression?: any;
    expireAfterSeconds?: number;
  };
  description: string;
  justification: string;
}

export interface ModelIndexConfig {
  modelName: string;
  collectionName: string;
  indexes: IndexDefinition[];
}

// Predefined index configurations for core business models
export const PREDEFINED_INDEXES: ModelIndexConfig[] = [
  {
    modelName: 'User',
    collectionName: 'users',
    indexes: [
      {
        name: 'idx_user_email_status',
        fields: { email: 1, status: 1 },
        options: { unique: true, sparse: true },
        description: 'Unique email lookup with status filtering',
        justification: 'Authentication queries frequently filter by email and check status'
      },
      {
        name: 'idx_user_role_status_lastLogin',
        fields: { role: 1, status: 1, lastLogin: -1 },
        description: 'User management queries by role and activity',
        justification: 'Admin dashboards frequently query users by role and sort by last login'
      },
      {
        name: 'idx_user_department_active',
        fields: { department: 1, status: 1 },
        description: 'Department-based user queries',
        justification: 'Shift planning and team management queries filter by department'
      },
      {
        name: 'idx_user_location_coordinates',
        fields: { 'location.coordinates': '2dsphere' },
        options: { sparse: true },
        description: 'Geospatial queries for user location',
        justification: 'Field service apps need to find nearby users and track locations'
      }
    ]
  },
  {
    modelName: 'Shift',
    collectionName: 'shifts',
    indexes: [
      {
        name: 'idx_shift_user_date_status',
        fields: { userId: 1, startTime: -1, status: 1 },
        description: 'User shift history and current status',
        justification: 'Most common query pattern for shift management and reporting'
      },
      {
        name: 'idx_shift_site_date_status',
        fields: { siteId: 1, startTime: -1, status: 1 },
        description: 'Site-based shift scheduling and management',
        justification: 'Site managers need to view all shifts at their locations'
      },
      {
        name: 'idx_shift_status_startTime',
        fields: { status: 1, startTime: -1 },
        description: 'Active shift monitoring and chronological ordering',
        justification: 'Dashboard queries for active shifts ordered by start time'
      },
      {
        name: 'idx_shift_geofence_status',
        fields: { 'geofence.id': 1, status: 1, startTime: -1 },
        options: { sparse: true },
        description: 'Geofence-based shift tracking',
        justification: 'Location-based shift validation and compliance monitoring'
      },
      {
        name: 'idx_shift_compliance_flags',
        fields: { 'compliance.hasViolations': 1, 'compliance.riskLevel': 1, startTime: -1 },
        description: 'Compliance monitoring and risk assessment',
        justification: 'Compliance dashboards need to quickly identify violations and risks'
      }
    ]
  },
  {
    modelName: 'Ticket',
    collectionName: 'tickets',
    indexes: [
      {
        name: 'idx_ticket_assignee_status_priority',
        fields: { assignedTo: 1, status: 1, priority: -1 },
        description: 'Personal ticket queue with priority ordering',
        justification: 'Field technicians need to see their tickets by status and priority'
      },
      {
        name: 'idx_ticket_site_status_created',
        fields: { siteId: 1, status: 1, createdAt: -1 },
        description: 'Site-based ticket management',
        justification: 'Site managers track tickets at their locations chronologically'
      },
      {
        name: 'idx_ticket_category_status_sla',
        fields: { category: 1, status: 1, 'sla.dueDate': 1 },
        description: 'Category-based SLA monitoring',
        justification: 'SLA compliance tracking requires category and due date filtering'
      },
      {
        name: 'idx_ticket_client_status_satisfaction',
        fields: { clientId: 1, status: 1, 'feedback.satisfactionRating': -1 },
        description: 'Client service quality tracking',
        justification: 'Client managers need to monitor service quality and satisfaction'
      },
      {
        name: 'idx_ticket_text_search',
        fields: { title: 'text', description: 'text', tags: 'text' },
        description: 'Full-text search across ticket content',
        justification: 'Support teams need to search tickets by keywords and descriptions'
      },
      {
        name: 'idx_ticket_escalation_timeline',
        fields: { 'escalation.level': 1, 'escalation.escalatedAt': -1, status: 1 },
        options: { sparse: true },
        description: 'Escalation tracking and management',
        justification: 'Management needs to track escalated tickets and response times'
      }
    ]
  },
  {
    modelName: 'SLA',
    collectionName: 'slas',
    indexes: [
      {
        name: 'idx_sla_entity_status_due',
        fields: { entityType: 1, entityId: 1, status: 1, dueDate: 1 },
        description: 'Entity-specific SLA monitoring',
        justification: 'SLA engine needs efficient lookups by entity and due dates'
      },
      {
        name: 'idx_sla_breach_severity_date',
        fields: { 'breach.occurred': 1, severity: 1, createdAt: -1 },
        description: 'SLA breach analysis and reporting',
        justification: 'Compliance reporting requires breach analysis by severity and time'
      },
      {
        name: 'idx_sla_client_category_performance',
        fields: { clientId: 1, category: 1, 'metrics.responseTime': 1 },
        description: 'Client-specific SLA performance tracking',
        justification: 'Client reporting requires performance metrics by service category'
      }
    ]
  },
  {
    modelName: 'Meeting',
    collectionName: 'meetings',
    indexes: [
      {
        name: 'idx_meeting_attendees_date',
        fields: { 'attendees.userId': 1, scheduledDate: -1 },
        description: 'Personal meeting schedule',
        justification: 'Users need to see their meetings in chronological order'
      },
      {
        name: 'idx_meeting_type_status_date',
        fields: { type: 1, status: 1, scheduledDate: -1 },
        description: 'Meeting management by type and status',
        justification: 'Meeting coordinators organize by meeting type and current status'
      },
      {
        name: 'idx_meeting_project_date',
        fields: { projectId: 1, scheduledDate: -1 },
        options: { sparse: true },
        description: 'Project-specific meeting tracking',
        justification: 'Project managers need chronological view of project meetings'
      }
    ]
  },
  {
    modelName: 'Geofence',
    collectionName: 'geofences',
    indexes: [
      {
        name: 'idx_geofence_site_active',
        fields: { siteId: 1, isActive: 1 },
        description: 'Site-based geofence management',
        justification: 'Location services need active geofences for specific sites'
      },
      {
        name: 'idx_geofence_location_type',
        fields: { 'center.coordinates': '2dsphere', type: 1 },
        description: 'Geospatial geofence queries',
        justification: 'Location tracking requires spatial queries for proximity detection'
      },
      {
        name: 'idx_geofence_client_type_active',
        fields: { clientId: 1, type: 1, isActive: 1 },
        description: 'Client-specific geofence configuration',
        justification: 'Multi-tenant setup requires client-isolated geofence management'
      }
    ]
  },
  {
    modelName: 'AuditLog',
    collectionName: 'audit_logs',
    indexes: [
      {
        name: 'idx_audit_user_action_date',
        fields: { userId: 1, action: 1, timestamp: -1 },
        description: 'User activity audit trail',
        justification: 'Security audits require user action history in chronological order'
      },
      {
        name: 'idx_audit_category_severity_date',
        fields: { category: 1, severity: 1, timestamp: -1 },
        description: 'Audit log analysis by category and severity',
        justification: 'Compliance reporting needs categorized audit analysis'
      },
      {
        name: 'idx_audit_correlation_date',
        fields: { correlationId: 1, timestamp: -1 },
        options: { sparse: true },
        description: 'Related audit event tracking',
        justification: 'Investigation workflows need to correlate related events'
      },
      {
        name: 'idx_audit_risk_level_date',
        fields: { 'riskAssessment.level': 1, timestamp: -1 },
        options: { sparse: true },
        description: 'Security risk monitoring',
        justification: 'Security teams monitor high-risk activities chronologically'
      }
    ]
  },
  {
    modelName: 'Expense',
    collectionName: 'expenses',
    indexes: [
      {
        name: 'idx_expense_user_status_date',
        fields: { userId: 1, status: 1, submittedAt: -1 },
        description: 'Personal expense management',
        justification: 'Users track their expense submissions by status and submission date'
      },
      {
        name: 'idx_expense_approver_status_amount',
        fields: { 'approval.approverId': 1, status: 1, amount: -1 },
        description: 'Expense approval workflow',
        justification: 'Approvers review pending expenses by amount for priority processing'
      },
      {
        name: 'idx_expense_category_date_amount',
        fields: { category: 1, submittedAt: -1, amount: -1 },
        description: 'Expense reporting and analysis',
        justification: 'Financial reporting requires category-based expense analysis'
      },
      {
        name: 'idx_expense_project_budget_tracking',
        fields: { projectId: 1, category: 1, submittedAt: -1 },
        options: { sparse: true },
        description: 'Project budget tracking',
        justification: 'Project managers monitor expenses by category and timeline'
      }
    ]
  },
  {
    modelName: 'Analytics',
    collectionName: 'analytics',
    indexes: [
      {
        name: 'idx_analytics_metric_date_value',
        fields: { metricName: 1, timestamp: -1, value: 1 },
        description: 'Time-series analytics data',
        justification: 'Analytics dashboards require efficient time-series queries'
      },
      {
        name: 'idx_analytics_entity_metric_period',
        fields: { entityType: 1, entityId: 1, metricName: 1, period: 1 },
        description: 'Entity-specific analytics aggregation',
        justification: 'Performance reports need entity-specific metric aggregation'
      },
      {
        name: 'idx_analytics_kpi_threshold_date',
        fields: { metricName: 1, 'threshold.exceeded': 1, timestamp: -1 },
        options: { sparse: true },
        description: 'KPI threshold monitoring',
        justification: 'Alert systems monitor KPI threshold breaches chronologically'
      }
    ]
  },
  {
    modelName: 'Leave',
    collectionName: 'leaves',
    indexes: [
      {
        name: 'idx_leave_user_status_dates',
        fields: { userId: 1, status: 1, startDate: 1, endDate: 1 },
        description: 'Personal leave management',
        justification: 'Users and managers track leave requests by status and date ranges'
      },
      {
        name: 'idx_leave_approver_status_type',
        fields: { 'approval.approverId': 1, status: 1, type: 1 },
        description: 'Leave approval workflow',
        justification: 'Managers review pending leave requests by type for processing'
      },
      {
        name: 'idx_leave_department_period_coverage',
        fields: { 'employee.department': 1, startDate: 1, endDate: 1, status: 1 },
        description: 'Department leave planning',
        justification: 'HR planning requires department leave coverage analysis'
      }
    ]
  }
];

// Critical indexes that should be created first
export const CRITICAL_INDEXES = [
  'users.idx_user_email_status',
  'shifts.idx_shift_user_date_status',
  'tickets.idx_ticket_assignee_status_priority',
  'slas.idx_sla_entity_status_due',
  'audit_logs.idx_audit_user_action_date'
];

// Geospatial indexes for location-based features
export const GEOSPATIAL_INDEXES = [
  'users.idx_user_location_coordinates',
  'geofences.idx_geofence_location_type'
];

// Text search indexes for full-text search features
export const TEXT_SEARCH_INDEXES = [
  'tickets.idx_ticket_text_search'
];

// Performance monitoring indexes
export const PERFORMANCE_INDEXES = [
  'analytics.idx_analytics_metric_date_value',
  'analytics.idx_analytics_kpi_threshold_date'
];

/**
 * Get index configuration for a specific model
 */
export function getModelIndexConfig(modelName: string): ModelIndexConfig | undefined {
  return PREDEFINED_INDEXES.find(config => config.modelName === modelName);
}

/**
 * Get all index definitions for a model
 */
export function getModelIndexes(modelName: string): IndexDefinition[] {
  const config = getModelIndexConfig(modelName);
  return config ? config.indexes : [];
}

/**
 * Check if an index is critical for application performance
 */
export function isCriticalIndex(collectionName: string, indexName: string): boolean {
  return CRITICAL_INDEXES.includes(`${collectionName}.${indexName}`);
}

/**
 * Get recommended indexes based on application features
 */
export function getRecommendedIndexes(features: string[]): IndexDefinition[] {
  const recommended: IndexDefinition[] = [];
  
  // Always include critical indexes
  CRITICAL_INDEXES.forEach(indexPath => {
    const [collection, indexName] = indexPath.split('.');
    const modelConfig = PREDEFINED_INDEXES.find(config => 
      config.collectionName === collection
    );
    if (modelConfig) {
      const index = modelConfig.indexes.find(idx => idx.name === indexName);
      if (index) {
        recommended.push(index);
      }
    }
  });
  
  // Add feature-specific indexes
  if (features.includes('geolocation')) {
    GEOSPATIAL_INDEXES.forEach(indexPath => {
      const [collection, indexName] = indexPath.split('.');
      const modelConfig = PREDEFINED_INDEXES.find(config => 
        config.collectionName === collection
      );
      if (modelConfig) {
        const index = modelConfig.indexes.find(idx => idx.name === indexName);
        if (index) {
          recommended.push(index);
        }
      }
    });
  }
  
  if (features.includes('search')) {
    TEXT_SEARCH_INDEXES.forEach(indexPath => {
      const [collection, indexName] = indexPath.split('.');
      const modelConfig = PREDEFINED_INDEXES.find(config => 
        config.collectionName === collection
      );
      if (modelConfig) {
        const index = modelConfig.indexes.find(idx => idx.name === indexName);
        if (index) {
          recommended.push(index);
        }
      }
    });
  }
  
  if (features.includes('analytics')) {
    PERFORMANCE_INDEXES.forEach(indexPath => {
      const [collection, indexName] = indexPath.split('.');
      const modelConfig = PREDEFINED_INDEXES.find(config => 
        config.collectionName === collection
      );
      if (modelConfig) {
        const index = modelConfig.indexes.find(idx => idx.name === indexName);
        if (index) {
          recommended.push(index);
        }
      }
    });
  }
  
  return recommended;
}

export default {
  PREDEFINED_INDEXES,
  CRITICAL_INDEXES,
  GEOSPATIAL_INDEXES,
  TEXT_SEARCH_INDEXES,
  PERFORMANCE_INDEXES,
  getModelIndexConfig,
  getModelIndexes,
  isCriticalIndex,
  getRecommendedIndexes
};