// Scheduled Task type definitions
export interface ScheduledTask {
  id: string;
  workOrderId: string;
  assignedResources: Array<{
    resourceId: string;
    resourceType: 'staff' | 'equipment' | 'vehicle';
    name: string;
    role: 'primary' | 'secondary' | 'support';
    availability?: {
      start: string;
      end: string;
    };
  }>;
  scheduledStart: string; // ISO date string
  scheduledEnd: string; // ISO date string
  actualStart?: string;
  actualEnd?: string;
  location: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  travelTime: {
    toLocation: number; // in minutes
    fromLocation: number; // in minutes
    route?: {
      distance: number; // in km
      duration: number; // in minutes
      waypoints: Array<{
        lat: number;
        lng: number;
      }>;
    };
  };
  optimizationScore: number; // 0-100
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';
  priority: number; // calculated priority score
  constraints: {
    skillRequirements: string[];
    timeWindows: Array<{
      start: string;
      end: string;
    }>;
    resourceConstraints: Array<{
      resourceType: string;
      minimumRequired: number;
      maximumAllowed: number;
    }>;
    dependencies: string[]; // IDs of tasks that must be completed first
  };
  createdAt: string;
  updatedAt?: string;
  scheduledBy: string; // user ID who scheduled the task
  notes?: string;
  checklistItems?: Array<{
    id: string;
    description: string;
    completed: boolean;
    completedAt?: string;
    completedBy?: string;
  }>;
}

// Task scheduling request
export interface ScheduleTaskRequest {
  workOrderId: string;
  preferredStart?: string;
  preferredEnd?: string;
  assignedResources: Array<{
    resourceId: string;
    resourceType: string;
    role: string;
  }>;
  constraints?: {
    skillRequirements?: string[];
    timeWindows?: Array<{
      start: string;
      end: string;
    }>;
    dependencies?: string[];
  };
  notes?: string;
}

// Task update payload
export interface UpdateTaskPayload {
  scheduledStart?: string;
  scheduledEnd?: string;
  assignedResources?: ScheduledTask['assignedResources'];
  status?: ScheduledTask['status'];
  actualStart?: string;
  actualEnd?: string;
  notes?: string;
  checklistItems?: ScheduledTask['checklistItems'];
}

// Task conflict information
export interface TaskConflict {
  type: 'resource_conflict' | 'time_conflict' | 'skill_conflict' | 'dependency_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  conflictingTasks: string[]; // task IDs
  suggestedResolution: {
    action: 'reschedule' | 'reassign' | 'split_task' | 'add_resource';
    details: string;
    estimatedImpact: number; // optimization score impact
  };
  autoResolvable: boolean;
}

// Task performance metrics
export interface TaskPerformance {
  taskId: string;
  plannedDuration: number;
  actualDuration: number;
  efficiency: number; // actual vs planned ratio
  qualityScore: number; // 0-100
  customerSatisfaction?: number; // 0-100
  resourceUtilization: Array<{
    resourceId: string;
    utilizationPercentage: number;
    efficiency: number;
  }>;
  delayFactors?: Array<{
    factor: string;
    impact: number; // in minutes
    category: 'traffic' | 'weather' | 'resource' | 'customer' | 'equipment' | 'other';
  }>;
  completionDate: string;
}

// Task filters
export interface TaskFilters {
  status?: ScheduledTask['status'][];
  resourceType?: string[];
  resourceId?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  priority?: {
    min: number;
    max: number;
  };
  optimizationScore?: {
    min: number;
    max: number;
  };
  location?: {
    radius: number;
    center: {
      lat: number;
      lng: number;
    };
  };
  workOrderId?: string;
  hasConflicts?: boolean;
}

// Task calendar event
export interface TaskCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: {
    id: string;
    name: string;
    type: string;
  };
  status: ScheduledTask['status'];
  priority: number;
  location: string;
  workOrderId: string;
  assignedResources: ScheduledTask['assignedResources'];
  conflicts?: TaskConflict[];
  style?: {
    backgroundColor: string;
    borderColor: string;
    color: string;
  };
}

// Task timeline view
export interface TaskTimelineItem {
  id: string;
  title: string;
  start: string;
  end: string;
  duration: number;
  resourceId: string;
  resourceName: string;
  status: ScheduledTask['status'];
  workOrderTitle: string;
  location: string;
  travelTimeBefore: number;
  travelTimeAfter: number;
  optimizationScore: number;
  conflicts: TaskConflict[];
  dependencies: Array<{
    taskId: string;
    type: 'start_after' | 'finish_before' | 'same_resource';
  }>;
}

// Bulk task operations
export interface BulkTaskOperation {
  operation: 'reschedule' | 'reassign' | 'cancel' | 'update_status';
  taskIds: string[];
  parameters: {
    newStart?: string;
    newEnd?: string;
    newResources?: ScheduledTask['assignedResources'];
    newStatus?: ScheduledTask['status'];
    reason?: string;
  };
  validateConflicts: boolean;
  autoResolveConflicts: boolean;
}

// Task statistics
export interface TaskStats {
  total: number;
  byStatus: Record<ScheduledTask['status'], number>;
  avgOptimizationScore: number;
  avgDuration: number;
  completionRate: number;
  onTimePerformance: number;
  resourceUtilization: Record<string, number>;
  conflictCount: number;
  autoResolvedConflicts: number;
}

export default ScheduledTask;
