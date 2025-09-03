// Work Order type definitions
export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical' | 'emergency';
  estimatedDuration: number; // in minutes
  requiredSkills: string[];
  location: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  deadline?: string; // ISO date string
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string; // ISO date string
  updatedAt?: string; // ISO date string
  customerId?: string;
  customerInfo?: {
    name: string;
    phone?: string;
    email?: string;
  };
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
  }>;
  notes?: string;
  tags?: string[];
  estimatedCost?: number;
  actualCost?: number;
  recurringSchedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
  };
}

// Work Order creation payload
export interface CreateWorkOrderPayload {
  title: string;
  description: string;
  priority: WorkOrder['priority'];
  estimatedDuration: number;
  requiredSkills: string[];
  location: WorkOrder['location'];
  deadline?: string;
  customerId?: string;
  customerInfo?: WorkOrder['customerInfo'];
  notes?: string;
  tags?: string[];
  estimatedCost?: number;
  recurringSchedule?: WorkOrder['recurringSchedule'];
}

// Work Order update payload
export interface UpdateWorkOrderPayload extends Partial<CreateWorkOrderPayload> {
  status?: WorkOrder['status'];
  actualCost?: number;
}

// Work Order filters
export interface WorkOrderFilters {
  status?: WorkOrder['status'][];
  priority?: WorkOrder['priority'][];
  skills?: string[];
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  location?: {
    radius: number; // in km
    center: {
      lat: number;
      lng: number;
    };
  };
  customer?: string;
  assignedResource?: string;
}

// Work Order sort options
export interface WorkOrderSortOptions {
  field: 'createdAt' | 'deadline' | 'priority' | 'estimatedDuration' | 'title';
  direction: 'asc' | 'desc';
}

// Work Order search options
export interface WorkOrderSearchOptions {
  query: string;
  fields: Array<'title' | 'description' | 'customerInfo' | 'notes' | 'tags'>;
}

// Work Order statistics
export interface WorkOrderStats {
  total: number;
  byStatus: Record<WorkOrder['status'], number>;
  byPriority: Record<WorkOrder['priority'], number>;
  avgDuration: number;
  avgCost: number;
  completionRate: number;
  overdueCount: number;
  upcomingDeadlines: number;
}

// Work Order with calculated fields
export interface EnrichedWorkOrder extends WorkOrder {
  isOverdue: boolean;
  isUrgent: boolean;
  daysUntilDeadline?: number;
  estimatedEndTime?: string;
  assignedResources?: Array<{
    resourceId: string;
    resourceType: string;
    name: string;
    role: string;
  }>;
  scheduledTask?: {
    id: string;
    scheduledStart: string;
    scheduledEnd: string;
    status: string;
  };
  progress?: {
    percentage: number;
    lastUpdated: string;
    milestones: Array<{
      name: string;
      completed: boolean;
      completedAt?: string;
    }>;
  };
}

export default WorkOrder;
