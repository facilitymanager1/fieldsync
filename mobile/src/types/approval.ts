/**
 * HR Approval Workflow Types
 * Core types for the approval system matching Empulse requirements
 */

// Employee status based on Empulse requirements
export enum EmployeeStatus {
  IN_PROGRESS = 'In Progress',
  EXIST = 'Exist', 
  REJECTED = 'Rejected'
}

// Validation checkboxes for HR approval process
export interface ValidationChecks {
  hr: boolean;
  esi: boolean;
  pf: boolean;
  uan: boolean;
}

// Approval form data structure
export interface ApprovalFormData {
  employeeId: string;
  tempId?: string;
  permanentId?: string;
  status: EmployeeStatus;
  contractEndDate?: Date;
  rejectionReason?: string;
  validationChecks: ValidationChecks;
  hrComments?: string;
  approvedBy?: string;
  approvedAt?: Date;
  lastModifiedBy: string;
  lastModifiedAt: Date;
}

// Employee summary for approval lists
export interface EmployeeApprovalSummary {
  id: string;
  tempId?: string;
  permanentId?: string;
  profilePhoto?: string;
  name: string;
  phoneNumber: string;
  status: EmployeeStatus;
  validationChecks: ValidationChecks;
  rejectionReason?: string;
  submittedAt: Date;
  approvedAt?: Date;
  priority: 'low' | 'medium' | 'high';
}

// Filter options for HR approval dashboard
export interface ApprovalFilters {
  status?: EmployeeStatus[];
  validationStatus?: 'pending' | 'partial' | 'complete';
  submittedDateRange?: {
    from: Date;
    to: Date;
  };
  priority?: ('low' | 'medium' | 'high')[];
  searchQuery?: string;
}

// Approval action types
export enum ApprovalAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_CHANGES = 'request_changes',
  ESCALATE = 'escalate'
}

// Approval workflow event
export interface ApprovalEvent {
  id: string;
  employeeId: string;
  action: ApprovalAction;
  performedBy: string;
  performedAt: Date;
  reason?: string;
  previousStatus: EmployeeStatus;
  newStatus: EmployeeStatus;
  validationChanges?: Partial<ValidationChecks>;
  comments?: string;
}

// Notification types for approval workflow
export interface ApprovalNotification {
  id: string;
  type: 'approval_required' | 'status_changed' | 'rejection' | 'escalation';
  employeeId: string;
  employeeName: string;
  message: string;
  recipientRole: 'hr' | 'field_officer' | 'admin';
  recipientId?: string;
  isRead: boolean;
  createdAt: Date;
  actionUrl?: string;
}

// Bulk approval operations
export interface BulkApprovalOperation {
  employeeIds: string[];
  action: ApprovalAction;
  reason?: string;
  validationUpdates?: Partial<ValidationChecks>;
}

// Approval dashboard statistics
export interface ApprovalStats {
  total: number;
  inProgress: number;
  exist: number;
  rejected: number;
  pendingHRApproval: number;
  pendingESIApproval: number;
  pendingPFApproval: number;
  pendingUANApproval: number;
  averageApprovalTime: number; // in hours
  todaysSubmissions: number;
  overdueApprovals: number;
}

// Update approval data interface
export interface UpdateApprovalData {
  status?: EmployeeStatus;
  hrComments?: string;
  rejectionReason?: string;
  rejectionCategory?: string;
  customRejectionReason?: string;
  additionalComments?: string;
  validationChecks?: {
    hr?: boolean;
    esi?: boolean;
    pf?: boolean;
    uan?: boolean;
  };
  contractEndDate?: Date;
  permanentId?: string;
}

// Role-based permissions for approval system
export interface ApprovalPermissions {
  canViewAll: boolean;
  canApprove: boolean;
  canReject: boolean;
  canEditDetails: boolean;
  canGeneratePermanentId: boolean;
  canViewSensitiveInfo: boolean;
  canBulkApprove: boolean;
}

// Approval form validation rules
export interface ApprovalValidationRules {
  requireAllValidations: boolean;
  mandatoryFields: string[];
  minimumAge: number;
  documentExpiryChecks: boolean;
  addressValidation: boolean;
  salaryThresholds: {
    esi: number;
    pf: number;
    gmc: number;
  };
}