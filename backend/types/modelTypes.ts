/**
 * Comprehensive Model Type Definitions for FieldSync
 * Provides type-safe inheritance patterns and generic constraints
 */

import { Document, Types } from 'mongoose';
import { BaseEntity, BaseAuditableEntity, AuditEntry } from './standardInterfaces';

// Enhanced Document interfaces with proper inheritance
export interface BaseDocument extends Document {
  _id: Types.ObjectId;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: number;
  isActive: boolean;
  metadata?: Record<string, any>;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface BaseAuditableDocument extends BaseDocument {
  auditLog: Types.DocumentArray<AuditEntry>;
  lastAuditedAt?: Date;
  auditFrequency?: number;
  // Virtual properties
  auditLogCount: number;
  latestAuditEntry: AuditEntry | null;
  auditSummary: {
    totalEntries: number;
    actions: Record<string, number>;
    lastAction: string | null;
  };
}

// Generic type constraints for proper inheritance
export type BaseEntityType<T = {}> = BaseDocument & T;
export type BaseAuditableEntityType<T = {}> = BaseAuditableDocument & T;

// Enhanced User Document Interface
export interface UserDocument extends BaseDocument {
  email: string;
  passwordHash: string;
  role: 'FieldTech' | 'Supervisor' | 'Admin' | 'Client' | 'SiteStaff';
  isActive: boolean;
  twoFactorEnabled: boolean;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
    department?: string;
    employeeId?: string;
  };
  preferences: {
    notifications: boolean;
    theme: 'light' | 'dark';
    language: string;
    timezone: string;
  };
  permissions: string[];
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  // Virtual properties
  isLocked: boolean;
  fullName: string;
}

// Enhanced Ticket Document Interface
export interface TicketDocument extends BaseAuditableDocument {
  ticketNumber: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  subcategory?: string;
  assignedTo?: Types.ObjectId;
  assignedTeam?: string;
  reportedBy: Types.ObjectId;
  reportedDate: Date;
  dueDate?: Date;
  resolvedDate?: Date;
  closedDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  attachments: Array<{
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    uploadedBy: string;
    uploadedAt: Date;
  }>;
  history: Array<{
    action: string;
    field?: string;
    oldValue?: any;
    newValue?: any;
    performedBy: string;
    timestamp: Date;
    comment?: string;
  }>;
  slaInfo?: {
    template: string;
    responseTarget: Date;
    resolutionTarget: Date;
    respondedAt?: Date;
    resolvedAt?: Date;
    isBreached: boolean;
    escalationLevel: number;
  };
}

// Enhanced Shift Document Interface
export interface ShiftDocument extends BaseAuditableDocument {
  userId: string;
  assignedStaff: Types.ObjectId;
  state: 'idle' | 'checking_in' | 'in_shift' | 'on_break' | 'checking_out' | 'post_shift' | 'completed' | 'cancelled';
  previousState?: string;
  stateHistory: Array<{
    fromState: string;
    toState: string;
    timestamp: Date;
    triggeredBy: 'user' | 'system' | 'geofence' | 'timer';
    reason?: string;
    location?: {
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp: Date;
    };
  }>;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
  };
  geofence?: {
    id: string;
    name: string;
    radius: number;
    center: {
      latitude: number;
      longitude: number;
    };
  };
  breaks: Array<{
    type: 'lunch' | 'short_break' | 'emergency' | 'authorized' | 'unauthorized';
    startTime: Date;
    endTime?: Date;
    duration?: number;
    reason?: string;
    location?: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
  }>;
  metrics?: {
    totalDuration: number;
    workingTime: number;
    breakTime: number;
    travelTime: number;
    efficiency: number;
    productivityScore: number;
  };
  notes?: string;
}

// Enhanced Client Document Interface
export interface ClientDocument extends BaseAuditableDocument {
  clientCode: string;
  companyName: string;
  contactPerson: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    position: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  businessDetails: {
    industry: string;
    businessType: 'corporate' | 'sme' | 'startup' | 'government' | 'ngo';
    establishedYear: number;
    employeeCount: number;
    annualRevenue?: number;
  };
  contract: {
    type: 'hourly' | 'fixed' | 'retainer' | 'project_based';
    startDate: Date;
    endDate?: Date;
    value: number;
    currency: string;
    terms: string;
    billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  };
  serviceAreas: string[];
  status: 'active' | 'inactive' | 'suspended' | 'terminated';
  billing: {
    preferredMethod: 'email' | 'postal' | 'portal';
    billingAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    taxId?: string;
    paymentTerms: number; // days
  };
}

// Enhanced Staff Document Interface
export interface StaffDocument extends BaseAuditableDocument {
  employeeId: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: Date;
    gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    emergencyContact: {
      name: string;
      relationship: string;
      phone: string;
      email?: string;
    };
  };
  employment: {
    startDate: Date;
    endDate?: Date;
    position: string;
    department: string;
    reportingManager: Types.ObjectId;
    employmentType: 'full_time' | 'part_time' | 'contract' | 'intern' | 'consultant';
    status: 'active' | 'inactive' | 'terminated' | 'on_leave';
    probationEndDate?: Date;
  };
  compensation: {
    baseSalary: number;
    currency: string;
    payFrequency: 'weekly' | 'bi_weekly' | 'monthly';
    benefits: string[];
    bonusEligible: boolean;
  };
  skills: Array<{
    name: string;
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    certified: boolean;
    certificationDate?: Date;
    expiryDate?: Date;
  }>;
  schedule: {
    workDays: string[];
    startTime: string;
    endTime: string;
    timeZone: string;
    flexibleHours: boolean;
    lunchDuration: number; // minutes
  };
  biometric?: {
    faceEncoding?: string;
    fingerprint?: string;
    retinaScan?: string;
  };
}

// Enhanced Site Document Interface
export interface SiteDocument extends BaseAuditableDocument {
  siteCode: string;
  name: string;
  type: 'office' | 'warehouse' | 'factory' | 'retail' | 'remote' | 'client_site';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  contact: {
    manager: string;
    phone: string;
    email: string;
  };
  client: Types.ObjectId;
  geofence: {
    center: {
      latitude: number;
      longitude: number;
    };
    radius: number; // meters
    strictMode: boolean;
  };
  operatingHours: {
    monday: { start: string; end: string; closed: boolean };
    tuesday: { start: string; end: string; closed: boolean };
    wednesday: { start: string; end: string; closed: boolean };
    thursday: { start: string; end: string; closed: boolean };
    friday: { start: string; end: string; closed: boolean };
    saturday: { start: string; end: string; closed: boolean };
    sunday: { start: string; end: string; closed: boolean };
  };
  facilities: Array<{
    name: string;
    type: 'parking' | 'cafeteria' | 'restroom' | 'conference_room' | 'security' | 'other';
    capacity?: number;
    status: 'operational' | 'maintenance' | 'repair' | 'decommissioned';
  }>;
  status: 'active' | 'inactive' | 'under_construction' | 'decommissioned';
  safetyProtocols: string[];
  equipment: Array<{
    id: string;
    name: string;
    type: string;
    serialNumber: string;
    purchaseDate: Date;
    warrantyExpiry?: Date;
    maintenanceSchedule: 'weekly' | 'monthly' | 'quarterly' | 'annually';
    lastMaintenance?: Date;
    nextMaintenance?: Date;
    status: 'operational' | 'maintenance' | 'repair' | 'decommissioned';
  }>;
}

// Meeting Minutes Document Interface
export interface MeetingMinutesDocument extends BaseAuditableDocument {
  meetingId: string;
  title: string;
  date: Date;
  startTime: Date;
  endTime?: Date;
  location: {
    type: 'physical' | 'virtual' | 'hybrid';
    address?: string;
    room?: string;
    meetingUrl?: string;
    dialInNumber?: string;
  };
  organizer: {
    userId: Types.ObjectId;
    name: string;
    email: string;
  };
  attendees: Array<{
    userId: Types.ObjectId;
    name: string;
    email: string;
    role: 'required' | 'optional' | 'resource';
    attendance: 'present' | 'absent' | 'partial';
    joinTime?: Date;
    leaveTime?: Date;
  }>;
  agenda: Array<{
    id: string;
    item: string;
    presenter: string;
    duration: number; // minutes
    type: 'discussion' | 'presentation' | 'decision' | 'information';
    attachments?: string[];
  }>;
  discussions: Array<{
    agendaItemId: string;
    topic: string;
    keyPoints: string[];
    concerns: string[];
    participant: string;
    timestamp: Date;
  }>;
  decisions: Array<{
    id: string;
    agendaItemId?: string;
    decision: string;
    rationale: string;
    decisionMaker: string;
    timestamp: Date;
    impact: 'low' | 'medium' | 'high';
    effectiveDate?: Date;
  }>;
  actionItems: Array<{
    id: string;
    task: string;
    assignee: Types.ObjectId;
    assigneeName: string;
    dueDate: Date;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
    dependencies?: string[];
    notes?: string;
    completedDate?: Date;
  }>;
  attachments: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    uploadedBy: string;
    uploadedAt: Date;
    url: string;
  }>;
  summary: string;
  nextMeeting?: {
    scheduledDate: Date;
    tentativeAgenda: string[];
  };
  status: 'draft' | 'in_review' | 'approved' | 'distributed';
  approvals: Array<{
    userId: Types.ObjectId;
    userName: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp?: Date;
    comments?: string;
  }>;
  distribution: Array<{
    userId: Types.ObjectId;
    userName: string;
    email: string;
    sentAt?: Date;
    readAt?: Date;
    acknowledged: boolean;
  }>;
  template?: Types.ObjectId;
  series?: Types.ObjectId;
}

// Enhanced Notification Document Interface
export interface NotificationDocument extends BaseDocument {
  userId: string;
  preferences: Array<{
    type: 'email' | 'push' | 'sms' | 'in_app';
    enabled: boolean;
    categories: Record<string, boolean>;
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    };
  }>;
  logs: Array<{
    id: string;
    type: 'email' | 'push' | 'sms' | 'in_app';
    category: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    sentAt: Date;
    deliveredAt?: Date;
    readAt?: Date;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    failureReason?: string;
    via: 'email' | 'push' | 'sms';
  }>;
}

// Enhanced Audit Log Document Interface
export interface AuditLogDocument extends BaseDocument {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'access' | 'export' | 'backup' | 'restore';
  userId: string;
  userName: string;
  userRole: string;
  ipAddress?: string;
  userAgent?: string;
  changes: Record<string, { from: any; to: any }>;
  reason?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'data' | 'security' | 'system' | 'user' | 'compliance';
  correlationId?: string;
  timestamp: Date;
  sessionId?: string;
  requestId?: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  deviceInfo?: {
    type: 'mobile' | 'tablet' | 'desktop';
    os: string;
    browser: string;
    version: string;
  };
  compliance?: {
    regulation: string; // GDPR, HIPAA, SOX, etc.
    requiresNotification: boolean;
    retentionPeriod: number; // days
    classification: 'public' | 'internal' | 'confidential' | 'restricted';
  };
}

// Enhanced Analytics Document Interface
export interface AnalyticsDocument extends BaseDocument {
  eventType: 'user_action' | 'system_event' | 'performance_metric' | 'business_event' | 'error_event' | 'security_event' | 'api_call' | 'page_view' | 'feature_usage' | 'conversion_event';
  category: 'authentication' | 'navigation' | 'data_management' | 'communication' | 'reporting' | 'system_health' | 'user_engagement' | 'business_process';
  action: string;
  label?: string;
  value?: number;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  userContext: {
    userId?: string;
    userRole?: string;
    organizationId?: string;
    departmentId?: string;
    locationId?: string;
    timezone?: string;
    language?: string;
    isAuthenticated: boolean;
  };
  sessionInfo: {
    sessionId: string;
    userId?: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    pageViews: number;
    actions: number;
    deviceType: 'mobile' | 'tablet' | 'desktop';
    browser: string;
    os: string;
  };
  technicalDetails: {
    url?: string;
    referrer?: string;
    userAgent?: string;
    ipAddress?: string;
    method?: string;
    statusCode?: number;
    errorMessage?: string;
    stackTrace?: string;
    apiVersion?: string;
  };
  performanceMetrics?: {
    loadTime?: number;
    responseTime?: number;
    renderTime?: number;
    networkLatency?: number;
    databaseLatency?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    errorRate?: number;
  };
  businessContext?: {
    feature?: string;
    module?: string;
    workflow?: string;
    processId?: string;
    entityType?: string;
    entityId?: string;
    transactionId?: string;
    campaignId?: string;
  };
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    timezone?: string;
  };
  customProperties?: Record<string, any>;
  isProcessed: boolean;
  processingErrors?: string[];
  retentionDays: number;
}

// Enhanced SLA Template Document Interface
export interface SlaTemplateDocument extends BaseAuditableDocument {
  name: string;
  description: string;
  category: 'ticket' | 'service_request' | 'leave' | 'meeting' | 'work_order';
  priority: 'critical' | 'high' | 'medium' | 'low';
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
  escalationRules: Array<{
    id: string;
    level: number;
    triggerAfterHours: number;
    triggerConditions: string[];
    actions: Array<{
      type: 'notify' | 'reassign' | 'escalate' | 'auto_resolve' | 'create_ticket';
      target: string[];
      template: string;
      priority: number;
      parameters?: Record<string, any>;
    }>;
    isActive: boolean;
    notificationTemplate?: string;
  }>;
  conditions: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
    value: any;
    logicalOperator?: 'AND' | 'OR';
  }>;
  clientId?: string;
  contractId?: string;
  targetMetrics: {
    responseTarget: number;
    resolutionTarget: number;
    customerSatisfactionTarget: number;
  };
  autoAssignment: {
    enabled: boolean;
    rules: Array<{
      conditions: Array<{
        field: string;
        operator: string;
        value: any;
        logicalOperator?: 'AND' | 'OR';
      }>;
      assignmentType: 'round_robin' | 'skill_based' | 'workload_based' | 'location_based';
      targetPool: string[];
      weight: number;
    }>;
  };
  autoEscalateOnHighRisk: boolean;
  enablePredictiveAlerts: boolean;
  pauseOnWeekends: boolean;
  pauseOnHolidays: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  version: number;
}

// Enhanced SLA Tracker Document Interface
export interface SlaTrackerDocument extends BaseDocument {
  entityId: string;
  entityType: string;
  slaTemplateId: string;
  startTime: Date;
  responseDeadline: Date;
  resolutionDeadline: Date;
  status: 'active' | 'paused' | 'resolved' | 'breached' | 'cancelled';
  currentStage: 'awaiting_response' | 'in_progress' | 'awaiting_approval' | 'resolved';
  responseTime?: Date;
  resolutionTime?: Date;
  actualResponseHours?: number;
  actualResolutionHours?: number;
  isBreached: boolean;
  breachType?: 'response' | 'resolution';
  breachTime?: Date;
  breachReason?: string;
  escalationLevel: number;
  escalationHistory: Array<{
    id: string;
    level: number;
    triggeredAt: Date;
    triggeredBy: 'system' | 'user';
    userId?: string;
    reason: string;
    actions: any[];
    notificationsSent: any[];
    outcome?: string;
  }>;
  customerSatisfactionScore?: number;
  qualityScore?: number;
  assignedTo?: string;
  assignedAt?: Date;
  assignmentHistory: Array<{
    assignedTo: string;
    assignedAt: Date;
    assignedBy: string;
    reason: string;
    previousAssignee?: string;
  }>;
  pausedDuration: number;
  pauseReasons: Array<{
    pausedAt: Date;
    resumedAt?: Date;
    reason: string;
    pausedBy: string;
    category: 'waiting_for_client' | 'waiting_for_approval' | 'technical_issue' | 'other';
  }>;
}

// Kiosk Document Interfaces
export interface KioskLocationDocument extends BaseDocument {
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address: string;
  kioskType: 'indoor' | 'outdoor' | 'mobile';
  capabilities: Array<'face_recognition' | 'fingerprint' | 'qr_code' | 'nfc' | 'voice'>;
  operatingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  lastHeartbeat: Date;
  configuration: Record<string, any>;
}

export interface KioskAttendanceDocument extends BaseDocument {
  employeeId: string;
  employeeName: string;
  kioskLocationId: string;
  timestamp: Date;
  type: 'check_in' | 'check_out' | 'break_start' | 'break_end';
  verificationMethod: 'face' | 'fingerprint' | 'qr_code' | 'nfc' | 'manual';
  confidence?: number;
  biometricData?: {
    faceMatch?: number;
    fingerprintMatch?: number;
    template?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  deviceInfo: {
    kioskId: string;
    version: string;
    temperature?: number;
    batteryLevel?: number;
  };
  processed: boolean;
  syncStatus: 'pending' | 'synced' | 'failed';
  anomalies?: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

// Type utilities for creating typed models
export type ModelDocument<T extends BaseDocument> = T;
export type AuditableModelDocument<T extends BaseAuditableDocument> = T;

// Factory type for creating properly typed documents
export interface DocumentFactory {
  createBaseDocument<T extends Record<string, any>>(data: T): BaseEntityType<T>;
  createAuditableDocument<T extends Record<string, any>>(data: T): BaseAuditableEntityType<T>;
}

// Export all document types for use in models - avoiding conflicts
export type {
  BaseDocument,
  BaseAuditableDocument,
  BaseEntityType,
  BaseAuditableEntityType
};