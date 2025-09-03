// Standardized Interfaces for FieldSync Models and Modules
// Ensures consistency across the application

import { Types } from 'mongoose';
import { Request } from 'express';

// Base interfaces that all entities should extend
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version?: number;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface BaseAuditableEntity extends BaseEntity {
  auditLog: AuditEntry[];
}

export interface AuditEntry {
  action: 'create' | 'update' | 'delete' | 'status_change';
  timestamp: Date;
  userId: string;
  userName: string;
  changes: Record<string, { from: any; to: any }>;
  reason?: string;
}

// Location interface - standardized across all modules
export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

// User-related interfaces
export interface UserInfo {
  id: string;
  name: string;
  role: string;
  email?: string;
  department?: string;
}

export interface AuthenticatedUser extends UserInfo {
  permissions: string[];
  lastLogin?: Date;
  isActive: boolean;
}

// Request/Response interfaces
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  id?: string; // Request ID for tracking
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string | string[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  userId?: string;
  assignedTo?: string;
  tags?: string[];
}

// Communication module standardized interfaces
export interface Thread extends BaseEntity {
  id: string;
  title: string;
  type: 'group' | 'direct' | 'broadcast' | 'emergency';
  participants: ThreadParticipant[];
  lastMessage?: Message;
  lastActivity: Date;
  isActive: boolean;
  settings: ThreadSettings;
}

export interface ThreadParticipant {
  userId: string;
  userName: string;
  role: string;
  joinedAt: Date;
  lastSeen?: Date;
  permissions: string[];
}

export interface ThreadSettings {
  allowFileUpload: boolean;
  allowLocationSharing: boolean;
  autoLocationSharing: boolean;
  ephemeralMessages: boolean;
  ephemeralDuration: number; // in hours
  aiAssistanceEnabled: boolean;
  smartSuggestionsEnabled: boolean;
}

export interface Message extends BaseEntity {
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  type: 'text' | 'voice' | 'image' | 'file' | 'location' | 'system';
  location?: Location;
  attachments: MessageAttachment[];
  metadata?: MessageMetadata;
  readBy: MessageReadStatus[];
  reactions: MessageReaction[];
  aiSuggestions: AISuggestion[];
  isEmergency: boolean;
  isDeleted: boolean;
  editHistory: MessageEdit[];
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'voice';
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface MessageMetadata {
  ticketId?: string;
  workOrderId?: string;
  deviceInfo?: any;
  originalMessageId?: string; // for replies
  mentionedUsers?: string[];
}

export interface MessageReadStatus {
  userId: string;
  readAt: Date;
}

export interface MessageReaction {
  userId: string;
  reaction: string;
  timestamp: Date;
}

export interface MessageEdit {
  timestamp: Date;
  previousContent: string;
  editReason?: string;
}

export interface AISuggestion {
  id: string;
  type: 'quick_reply' | 'action' | 'ticket' | 'location' | 'task' | 'safety';
  content: string;
  confidence: number;
  action?: string;
  expiresAt?: Date;
}

// Ticket module standardized interfaces
export interface Ticket extends BaseAuditableEntity {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled';
  category: string;
  subcategory?: string;
  assignedTo?: string;
  assignedTeam?: string;
  reportedBy: string;
  reportedDate: Date;
  dueDate?: Date;
  resolvedDate?: Date;
  closedDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  attachments: string[];
  location?: Location;
  slaInfo?: SLAInfo;
  customFields?: Record<string, any>;
}

export interface SLAInfo {
  template: string;
  responseTarget: Date;
  resolutionTarget: Date;
  respondedAt?: Date;
  resolvedAt?: Date;
  isBreached: boolean;
  escalationLevel: number;
  escalationHistory: EscalationEntry[];
}

export interface EscalationEntry {
  level: number;
  escalatedAt: Date;
  escalatedTo: string;
  reason: string;
}

// Expense module standardized interfaces
export interface ExpenseEntry extends BaseAuditableEntity {
  staffId: string;
  amount: number;
  currency: string;
  category: string;
  subcategory?: string;
  description: string;
  receiptPhoto?: string;
  additionalDocuments?: string[];
  location?: Location;
  expenseDate: Date;
  status: 'draft' | 'submitted' | 'pending_review' | 'approved' | 'rejected' | 'paid';
  submittedAt?: Date;
  approvalWorkflow: ApprovalStep[];
  currentApprovalLevel: number;
  paymentInfo?: PaymentInfo;
  projectId?: string;
  clientId?: string;
  tags?: string[];
  notes?: string;
}

export interface ApprovalStep {
  level: number;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated';
  timestamp?: Date;
  comments?: string;
  delegatedTo?: string;
}

export interface PaymentInfo {
  method: 'bank_transfer' | 'check' | 'credit_card' | 'reimbursement';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactionId?: string;
  paidAt?: Date;
  amount: number;
}

// Sync module standardized interfaces
export interface SyncPayload extends BaseEntity {
  userId: string;
  deviceId: string;
  dataType: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  version: number;
  checksum: string;
  conflicts?: ConflictData[];
}

export interface ConflictData {
  field: string;
  localValue: any;
  serverValue: any;
  lastModified: Date;
  resolution?: 'local' | 'server' | 'merge' | 'manual';
}

export interface SyncMetrics {
  totalSynced: number;
  conflicts: number;
  errors: number;
  duration: number;
  dataTransferred: number;
  lastSync: Date;
}

// Facial Recognition standardized interfaces
export interface FaceDetectionResult {
  boundingBox: BoundingBox;
  landmarks: FaceLandmarks;
  confidence: number;
  quality: number;
  pose: FacePose;
  expressions: FaceExpression[];
  embeddings?: number[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceLandmarks {
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  leftMouth: Point;
  rightMouth: Point;
  allPoints?: Point[];
}

export interface Point {
  x: number;
  y: number;
}

export interface FacePose {
  pitch: number; // Up/down rotation
  yaw: number;   // Left/right rotation
  roll: number;  // Tilt rotation
}

export interface FaceExpression {
  type: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' | 'fear' | 'disgust';
  confidence: number;
}

export interface AttendanceRecord extends BaseEntity {
  userId: string;
  userName: string;
  type: 'check_in' | 'check_out' | 'break_start' | 'break_end';
  timestamp: Date;
  location?: Location;
  faceData?: FaceDetectionResult;
  deviceInfo: {
    deviceId: string;
    deviceType: string;
    osVersion: string;
    appVersion: string;
  };
  verificationMethod: 'face' | 'manual' | 'qr_code' | 'geofence';
  confidence?: number;
  notes?: string;
}

// Service module interfaces
export interface ServiceModule {
  name: string;
  version: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isHealthy(): boolean;
  getMetrics(): Record<string, any>;
}

export interface ModuleConfig {
  enabled: boolean;
  settings: Record<string, any>;
  dependencies: string[];
  permissions: string[];
}

// Validation helpers
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// Database query helpers
export interface QueryOptions extends PaginationParams {
  populate?: string[];
  select?: string[];
  lean?: boolean;
}

export interface UpdateOptions {
  upsert?: boolean;
  new?: boolean;
  runValidators?: boolean;
}

// Event system interfaces
export interface SystemEvent {
  type: string;
  source: string;
  timestamp: Date;
  userId?: string;
  data: any;
  correlationId?: string;
}

export interface EventHandler {
  eventType: string;
  handler: (event: SystemEvent) => Promise<void>;
}

// Generic service response
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  metadata?: Record<string, any>;
}
