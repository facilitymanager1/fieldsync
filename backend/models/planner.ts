// Advanced Scheduling & Resource Optimization Data Models
import mongoose from 'mongoose';

// Core Scheduling Interfaces
export interface ISchedulingConstraint {
  id: string;
  type: 'time' | 'resource' | 'skill' | 'location' | 'priority' | 'dependency';
  description: string;
  weight: number; // 1-100, higher = more important
  mandatory: boolean;
  parameters: Record<string, any>;
}

export interface IResourceAvailability {
  resourceId: string;
  resourceType: 'staff' | 'equipment' | 'vehicle' | 'tool';
  availableSlots: Array<{
    start: Date;
    end: Date;
    capacity: number;
    location?: string;
  }>;
  skills: string[];
  certifications: string[];
  maintenanceSchedule?: Array<{
    start: Date;
    end: Date;
    type: 'maintenance' | 'inspection' | 'repair';
  }>;
}

export interface IWorkOrder {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical' | 'emergency';
  estimatedDuration: number; // minutes
  requiredSkills: string[];
  requiredCertifications: string[];
  location: {
    address: string;
    coordinates: { lat: number; lng: number };
    siteId?: string;
  };
  deadline?: Date;
  preferredTimeSlots?: Array<{
    start: Date;
    end: Date;
    preference: number; // 1-10
  }>;
  dependencies: string[]; // other work order IDs
  resourceRequirements: Array<{
    type: 'staff' | 'equipment' | 'vehicle' | 'tool';
    quantity: number;
    specifications?: Record<string, any>;
  }>;
  clientId?: string;
  slaId?: string;
  estimatedCost?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface IScheduledTask {
  id: string;
  workOrderId: string;
  assignedResources: Array<{
    resourceId: string;
    resourceType: string;
    role: 'primary' | 'secondary' | 'support';
  }>;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  location: {
    address: string;
    coordinates: { lat: number; lng: number };
  };
  travelTime: {
    toLocation: number; // minutes
    fromLocation: number; // minutes
    previousTaskId?: string;
    nextTaskId?: string;
  };
  optimizationScore: number; // 0-100
  constraints: ISchedulingConstraint[];
  bufferTime: number; // minutes
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISchedulingOptimization {
  id: string;
  optimizationId: string;
  algorithm: 'genetic' | 'greedy' | 'simulated_annealing' | 'linear_programming' | 'hybrid';
  objectives: Array<{
    type: 'minimize_travel_time' | 'maximize_utilization' | 'minimize_overtime' | 'minimize_cost' | 'maximize_customer_satisfaction';
    weight: number;
  }>;
  constraints: ISchedulingConstraint[];
  parameters: {
    populationSize?: number;
    generations?: number;
    mutationRate?: number;
    crossoverRate?: number;
    temperature?: number;
    coolingRate?: number;
  };
  results: {
    executionTime: number; // milliseconds
    iterations: number;
    finalScore: number;
    improvementPercentage: number;
    scheduledTasks: number;
    unscheduledTasks: number;
    averageTravelTime: number;
    resourceUtilization: number;
    customerSatisfactionScore: number;
  };
  createdAt: Date;
}

export interface IResourceOptimization {
  resourceId: string;
  utilizationRate: number; // 0-100%
  efficiency: number; // 0-100%
  idleTime: number; // minutes
  travelTime: number; // minutes
  workTime: number; // minutes
  overtimeHours: number;
  tasksCompleted: number;
  averageTaskDuration: number;
  skillUtilization: Record<string, number>;
  recommendations: Array<{
    type: 'skill_training' | 'schedule_adjustment' | 'resource_reallocation' | 'workload_balancing';
    description: string;
    expectedImprovement: number;
    priority: 'low' | 'medium' | 'high';
  }>;
}

export interface ISchedulingMetrics {
  date: Date;
  totalWorkOrders: number;
  scheduledWorkOrders: number;
  completedWorkOrders: number;
  averageSchedulingAccuracy: number;
  resourceUtilization: {
    staff: number;
    equipment: number;
    vehicles: number;
  };
  customerSatisfaction: {
    onTimeCompletion: number;
    qualityRating: number;
    responseTime: number;
  };
  costs: {
    totalLabor: number;
    totalTravel: number;
    totalOvertime: number;
    totalMaintenance: number;
  };
  optimizationInsights: Array<{
    metric: string;
    value: number;
    trend: 'improving' | 'declining' | 'stable';
    recommendation: string;
  }>;
}

// Mongoose Schemas
const SchedulingConstraintSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['time', 'resource', 'skill', 'location', 'priority', 'dependency'],
    required: true 
  },
  description: { type: String, required: true },
  weight: { type: Number, min: 1, max: 100, required: true },
  mandatory: { type: Boolean, default: false },
  parameters: { type: mongoose.Schema.Types.Mixed }
});

const WorkOrderSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical', 'emergency'],
    default: 'medium'
  },
  estimatedDuration: { type: Number, required: true },
  requiredSkills: [{ type: String }],
  requiredCertifications: [{ type: String }],
  location: {
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    siteId: { type: String }
  },
  deadline: { type: Date },
  preferredTimeSlots: [{
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    preference: { type: Number, min: 1, max: 10, default: 5 }
  }],
  dependencies: [{ type: String }],
  resourceRequirements: [{
    type: { 
      type: String, 
      enum: ['staff', 'equipment', 'vehicle', 'tool'],
      required: true 
    },
    quantity: { type: Number, required: true, min: 1 },
    specifications: { type: mongoose.Schema.Types.Mixed }
  }],
  clientId: { type: String },
  slaId: { type: String },
  estimatedCost: { type: Number, min: 0 },
  tags: [{ type: String }],
  status: { 
    type: String, 
    enum: ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  }
}, {
  timestamps: true
});

const ScheduledTaskSchema = new mongoose.Schema({
  workOrderId: { type: String, required: true },
  assignedResources: [{
    resourceId: { type: String, required: true },
    resourceType: { 
      type: String, 
      enum: ['staff', 'equipment', 'vehicle', 'tool'],
      required: true 
    },
    role: { 
      type: String, 
      enum: ['primary', 'secondary', 'support'],
      default: 'primary'
    }
  }],
  scheduledStart: { type: Date, required: true },
  scheduledEnd: { type: Date, required: true },
  actualStart: { type: Date },
  actualEnd: { type: Date },
  location: {
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },
  travelTime: {
    toLocation: { type: Number, required: true },
    fromLocation: { type: Number, required: true },
    previousTaskId: { type: String },
    nextTaskId: { type: String }
  },
  optimizationScore: { type: Number, min: 0, max: 100, default: 0 },
  constraints: [SchedulingConstraintSchema],
  bufferTime: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'delayed', 'cancelled'],
    default: 'scheduled'
  },
  notes: { type: String }
}, {
  timestamps: true
});

const SchedulingOptimizationSchema = new mongoose.Schema({
  optimizationId: { type: String, required: true, unique: true },
  algorithm: { 
    type: String, 
    enum: ['genetic', 'greedy', 'simulated_annealing', 'linear_programming', 'hybrid'],
    required: true 
  },
  objectives: [{
    type: { 
      type: String, 
      enum: ['minimize_travel_time', 'maximize_utilization', 'minimize_overtime', 'minimize_cost', 'maximize_customer_satisfaction'],
      required: true 
    },
    weight: { type: Number, min: 0, max: 1, required: true }
  }],
  constraints: [SchedulingConstraintSchema],
  parameters: {
    populationSize: { type: Number },
    generations: { type: Number },
    mutationRate: { type: Number },
    crossoverRate: { type: Number },
    temperature: { type: Number },
    coolingRate: { type: Number }
  },
  results: {
    executionTime: { type: Number },
    iterations: { type: Number },
    finalScore: { type: Number },
    improvementPercentage: { type: Number },
    scheduledTasks: { type: Number },
    unscheduledTasks: { type: Number },
    averageTravelTime: { type: Number },
    resourceUtilization: { type: Number },
    customerSatisfactionScore: { type: Number }
  }
}, {
  timestamps: true
});

const SchedulingMetricsSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  totalWorkOrders: { type: Number, default: 0 },
  scheduledWorkOrders: { type: Number, default: 0 },
  completedWorkOrders: { type: Number, default: 0 },
  averageSchedulingAccuracy: { type: Number, default: 0 },
  resourceUtilization: {
    staff: { type: Number, default: 0 },
    equipment: { type: Number, default: 0 },
    vehicles: { type: Number, default: 0 }
  },
  customerSatisfaction: {
    onTimeCompletion: { type: Number, default: 0 },
    qualityRating: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 }
  },
  costs: {
    totalLabor: { type: Number, default: 0 },
    totalTravel: { type: Number, default: 0 },
    totalOvertime: { type: Number, default: 0 },
    totalMaintenance: { type: Number, default: 0 }
  },
  optimizationInsights: [{
    metric: { type: String, required: true },
    value: { type: Number, required: true },
    trend: { 
      type: String, 
      enum: ['improving', 'declining', 'stable'],
      required: true 
    },
    recommendation: { type: String, required: true }
  }]
}, {
  timestamps: true
});

// Create indexes for performance
WorkOrderSchema.index({ status: 1, priority: -1, deadline: 1 });
WorkOrderSchema.index({ 'location.coordinates': '2dsphere' });
WorkOrderSchema.index({ createdAt: -1 });

ScheduledTaskSchema.index({ scheduledStart: 1, scheduledEnd: 1 });
ScheduledTaskSchema.index({ 'assignedResources.resourceId': 1 });
ScheduledTaskSchema.index({ status: 1 });

SchedulingOptimizationSchema.index({ optimizationId: 1 });
SchedulingOptimizationSchema.index({ createdAt: -1 });

SchedulingMetricsSchema.index({ date: -1 });

// Export models
export const WorkOrder = mongoose.model<IWorkOrder>('WorkOrder', WorkOrderSchema);
export const ScheduledTask = mongoose.model<IScheduledTask>('ScheduledTask', ScheduledTaskSchema);
export const SchedulingOptimization = mongoose.model<ISchedulingOptimization>('SchedulingOptimization', SchedulingOptimizationSchema);
export const SchedulingMetrics = mongoose.model<ISchedulingMetrics>('SchedulingMetrics', SchedulingMetricsSchema);

// Legacy interface for backward compatibility
export interface PlannerEvent {
  id: string;
  userId: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  siteId: string;
  calendarType: 'google' | 'outlook' | 'local';
  createdAt: Date;
  updatedAt: Date;
}
