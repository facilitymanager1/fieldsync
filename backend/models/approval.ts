/**
 * Approval Workflow Data Models
 * Backend MongoDB models for HR approval system
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Employee approval status enum
export enum EmployeeStatus {
  IN_PROGRESS = 'In Progress',
  EXIST = 'Exist',
  REJECTED = 'Rejected'
}

// Approval action types
export enum ApprovalAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_CHANGES = 'request_changes',
  ESCALATE = 'escalate'
}

// Validation checks interface
interface IValidationChecks {
  hr: boolean;
  hrApprovedBy?: Types.ObjectId;
  hrApprovedAt?: Date;
  esi: boolean;
  esiApprovedBy?: Types.ObjectId;
  esiApprovedAt?: Date;
  pf: boolean;
  pfApprovedBy?: Types.ObjectId;
  pfApprovedAt?: Date;
  uan: boolean;
  uanApprovedBy?: Types.ObjectId;
  uanApprovedAt?: Date;
}

// Main approval record interface
export interface IEmployeeApproval extends Document {
  _id: Types.ObjectId;
  
  // Employee reference
  employeeId: string; // Reference to onboarding record
  onboardingRecordId: Types.ObjectId;
  
  // ID management
  tempId: string;
  permanentId?: string;
  
  // Status and workflow
  status: EmployeeStatus;
  contractEndDate?: Date;
  rejectionReason?: string;
  
  // Validation checkboxes
  validationChecks: IValidationChecks;
  
  // Approval metadata  
  hrComments?: string;
  priority: 'low' | 'medium' | 'high';
  
  // Timestamps
  submittedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  lastModifiedAt: Date;
  
  // Audit trail
  createdBy: Types.ObjectId;
  lastModifiedBy: Types.ObjectId;
  
  // System metadata
  source: 'mobile' | 'web' | 'api';
  ipAddress: string;
  deviceInfo: string;
}

// Approval event/history interface
export interface IApprovalEvent extends Document {
  _id: Types.ObjectId;
  
  employeeApprovalId: Types.ObjectId;
  employeeId: string;
  
  action: ApprovalAction;
  performedBy: Types.ObjectId;
  performedAt: Date;
  
  previousStatus: EmployeeStatus;
  newStatus: EmployeeStatus;
  
  reason?: string;
  comments?: string;
  
  validationChanges?: {
    field: 'hr' | 'esi' | 'pf' | 'uan';
    previousValue: boolean;
    newValue: boolean;
  }[];
  
  // System metadata
  ipAddress: string;
  userAgent: string;
}

// Notification interface
export interface IApprovalNotification extends Document {
  _id: Types.ObjectId;
  
  type: 'approval_required' | 'status_changed' | 'rejection' | 'escalation';
  employeeApprovalId: Types.ObjectId;
  employeeId: string;
  employeeName: string;
  
  message: string;
  actionUrl?: string;
  
  recipientRole: 'hr' | 'field_officer' | 'admin';
  recipientId?: Types.ObjectId;
  
  isRead: boolean;
  readAt?: Date;
  
  createdAt: Date;
  expiresAt?: Date;
}

// Employee Approval Schema
const EmployeeApprovalSchema = new Schema<IEmployeeApproval>({
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  onboardingRecordId: {
    type: Schema.Types.ObjectId,
    ref: 'OnboardingRecord',
    required: true,
    index: true
  },
  
  // ID management
  tempId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  permanentId: {
    type: String,
    sparse: true,
    unique: true,
    index: true
  },
  
  // Status management
  status: {
    type: String,
    enum: Object.values(EmployeeStatus),
    default: EmployeeStatus.IN_PROGRESS,
    required: true,
    index: true
  },
  contractEndDate: Date,
  rejectionReason: String,
  
  // Validation checks
  validationChecks: {
    hr: { type: Boolean, default: false },
    hrApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    hrApprovedAt: Date,
    
    esi: { type: Boolean, default: false },
    esiApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    esiApprovedAt: Date,
    
    pf: { type: Boolean, default: false },
    pfApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    pfApprovedAt: Date,
    
    uan: { type: Boolean, default: false },
    uanApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uanApprovedAt: Date
  },
  
  // Metadata
  hrComments: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  
  // Timestamps
  submittedAt: { type: Date, default: Date.now },
  approvedAt: Date,
  rejectedAt: Date,
  lastModifiedAt: { type: Date, default: Date.now },
  
  // Audit
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastModifiedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // System
  source: { type: String, enum: ['mobile', 'web', 'api'], default: 'mobile' },
  ipAddress: String,
  deviceInfo: String
}, {
  timestamps: true,
  versionKey: false
});

// Approval Event Schema
const ApprovalEventSchema = new Schema<IApprovalEvent>({
  employeeApprovalId: {
    type: Schema.Types.ObjectId,
    ref: 'EmployeeApproval',
    required: true,
    index: true
  },
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  
  action: {
    type: String,
    enum: Object.values(ApprovalAction),
    required: true
  },
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  performedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  previousStatus: {
    type: String,
    enum: Object.values(EmployeeStatus),
    required: true
  },
  newStatus: {
    type: String,
    enum: Object.values(EmployeeStatus),
    required: true
  },
  
  reason: String,
  comments: String,
  
  validationChanges: [{
    field: { type: String, enum: ['hr', 'esi', 'pf', 'uan'] },
    previousValue: Boolean,
    newValue: Boolean
  }],
  
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true,
  versionKey: false
});

// Approval Notification Schema
const ApprovalNotificationSchema = new Schema<IApprovalNotification>({
  type: {
    type: String,
    enum: ['approval_required', 'status_changed', 'rejection', 'escalation'],
    required: true,
    index: true
  },
  employeeApprovalId: {
    type: Schema.Types.ObjectId,
    ref: 'EmployeeApproval',
    required: true
  },
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  actionUrl: String,
  
  recipientRole: {
    type: String,
    enum: ['hr', 'field_officer', 'admin'],
    required: true,
    index: true
  },
  recipientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: Date,
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: Date
}, {
  versionKey: false
});

// Indexes for performance
EmployeeApprovalSchema.index({ status: 1, submittedAt: -1 });
EmployeeApprovalSchema.index({ 'validationChecks.hr': 1, 'validationChecks.esi': 1 });
EmployeeApprovalSchema.index({ createdBy: 1, status: 1 });
EmployeeApprovalSchema.index({ lastModifiedAt: -1 });

ApprovalEventSchema.index({ employeeApprovalId: 1, performedAt: -1 });
ApprovalEventSchema.index({ performedBy: 1, performedAt: -1 });

ApprovalNotificationSchema.index({ recipientRole: 1, isRead: 1, createdAt: -1 });
ApprovalNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

// Pre-save middleware
EmployeeApprovalSchema.pre('save', function(next) {
  this.lastModifiedAt = new Date();
  next();
});

// Virtual for completion percentage
EmployeeApprovalSchema.virtual('completionPercentage').get(function() {
  const checks = this.validationChecks;
  const totalChecks = 4; // hr, esi, pf, uan
  const completedChecks = [checks.hr, checks.esi, checks.pf, checks.uan].filter(Boolean).length;
  return Math.round((completedChecks / totalChecks) * 100);
});

// Method to check if all validations are complete
EmployeeApprovalSchema.methods.isFullyApproved = function(): boolean {
  const checks = this.validationChecks;
  return checks.hr && checks.esi && checks.pf && checks.uan;
};

// Method to generate permanent ID
EmployeeApprovalSchema.methods.generatePermanentId = function(): string {
  const prefix = 'EMP';
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `${prefix}${year}${month}${random}`;
};

// Static method to get approval statistics
EmployeeApprovalSchema.statics.getApprovalStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', EmployeeStatus.IN_PROGRESS] }, 1, 0] }
        },
        exist: {
          $sum: { $cond: [{ $eq: ['$status', EmployeeStatus.EXIST] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', EmployeeStatus.REJECTED] }, 1, 0] }
        },
        pendingHRApproval: {
          $sum: { $cond: [{ $eq: ['$validationChecks.hr', false] }, 1, 0] }
        },
        pendingESIApproval: {
          $sum: { $cond: [{ $eq: ['$validationChecks.esi', false] }, 1, 0] }
        },
        pendingPFApproval: {
          $sum: { $cond: [{ $eq: ['$validationChecks.pf', false] }, 1, 0] }
        },
        pendingUANApproval: {
          $sum: { $cond: [{ $eq: ['$validationChecks.uan', false] }, 1, 0] }
        },
        averageApprovalTime: { $avg: { $subtract: ['$approvedAt', '$submittedAt'] } },
        todaysSubmissions: {
          $sum: {
            $cond: [
              { $gte: ['$submittedAt', new Date(new Date().setHours(0, 0, 0, 0))] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  return stats[0] || {};
};

// Export models
export const EmployeeApproval = mongoose.model<IEmployeeApproval>('EmployeeApproval', EmployeeApprovalSchema);
export const ApprovalEvent = mongoose.model<IApprovalEvent>('ApprovalEvent', ApprovalEventSchema);
export const ApprovalNotification = mongoose.model<IApprovalNotification>('ApprovalNotification', ApprovalNotificationSchema);