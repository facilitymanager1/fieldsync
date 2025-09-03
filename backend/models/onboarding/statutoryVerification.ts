/**
 * Statutory Verification Model - EPFO and ESIC verification and enrollment
 * 
 * Features:
 * - EPFO UAN verification and linking
 * - ESIC eligibility checking and enrollment
 * - Retry queue management with exponential backoff
 * - Multi-provider fallback mechanisms
 * - Compliance tracking and audit trails
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Statutory verification types
export enum StatutoryType {
  EPFO = 'epfo',
  ESIC = 'esic',
  LABOUR_WELFARE = 'labour_welfare',
  PROFESSIONAL_TAX = 'professional_tax'
}

// Verification status
export enum VerificationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  VERIFIED = 'verified',
  FAILED = 'failed',
  RETRY_SCHEDULED = 'retry_scheduled',
  MANUAL_INTERVENTION_REQUIRED = 'manual_intervention_required',
  NOT_APPLICABLE = 'not_applicable'
}

// API provider types
export enum ApiProvider {
  GOVERNMENT_DIRECT = 'government_direct',
  GRIDLINES = 'gridlines',
  SUREPASS = 'surepass',
  KARZA = 'karza',
  SIGNZY = 'signzy',
  MANUAL = 'manual'
}

// EPFO verification data interface
interface IEpfoVerificationData {
  uan?: string;
  memberName?: string;
  dateOfBirth?: Date;
  fatherHusbandName?: string;
  lastEmployer?: string;
  lastContributionDate?: Date;
  totalContributions?: number;
  passbook?: {
    establishments: Array<{
      establishmentName: string;
      establishmentId: string;
      fromDate: Date;
      toDate?: Date;
      contributions: Array<{
        month: string;
        year: number;
        employeeContribution: number;
        employerContribution: number;
        pensionContribution: number;
        wages: number;
      }>;
    }>;
  };
  kycStatus?: {
    aadhaarSeeded: boolean;
    panSeeded: boolean;
    bankSeeded: boolean;
    nomineeUpdated: boolean;
  };
}

// ESIC verification data interface
interface IEsicVerificationData {
  ipNumber?: string;
  memberName?: string;
  dateOfBirth?: Date;
  fatherName?: string;
  lastEmployer?: string;
  lastContributionDate?: Date;
  eligibilityStatus?: 'eligible' | 'not_eligible' | 'pending_verification';
  salaryThreshold?: number;
  currentSalary?: number;
  benefitStatus?: {
    medicalBenefit: boolean;
    cashBenefit: boolean;
    disabilityBenefit: boolean;
    dependentBenefit: boolean;
  };
  contributions?: Array<{
    month: string;
    year: number;
    employeeContribution: number;
    employerContribution: number;
    wages: number;
    establishmentCode: string;
  }>;
}

// API request/response log interface
interface IApiLog {
  provider: ApiProvider;
  requestTimestamp: Date;
  responseTimestamp?: Date;
  requestPayload?: any;
  responsePayload?: any;
  httpStatus?: number;
  success: boolean;
  errorMessage?: string;
  responseTime?: number; // in milliseconds
  apiCost?: number; // cost per API call
}

// Retry configuration interface
interface IRetryConfig {
  maxAttempts: number;
  currentAttempt: number;
  nextRetryAt?: Date;
  retryInterval: number; // in minutes
  exponentialBackoff: boolean;
  lastAttemptAt?: Date;
  lastFailureReason?: string;
  providerPreference: ApiProvider[];
}

// Manual intervention details interface
interface IManualIntervention {
  flaggedAt: Date;
  flaggedBy: Types.ObjectId;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: Types.ObjectId;
  assignedAt?: Date;
  status: 'pending' | 'in_progress' | 'resolved' | 'escalated';
  resolution?: string;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  escalationLevel: number;
  escalatedAt?: Date;
  escalatedTo?: Types.ObjectId;
  adminNotes: string[];
}

// Compliance and audit interface
interface IComplianceAudit {
  dataProtectionCompliance: boolean;
  consentObtained: boolean;
  dataRetentionPolicy: string;
  encryptionApplied: boolean;
  accessLogMaintained: boolean;
  legalBasisForProcessing: string;
  dataSubjectRights: {
    accessProvided: boolean;
    correctionAllowed: boolean;
    deletionSupported: boolean;
    portabilityEnabled: boolean;
  };
}

// Main statutory verification interface
export interface IStatutoryVerification extends Document {
  _id: Types.ObjectId;
  
  // Basic identification
  verificationId: string; // Unique verification reference
  onboardingRecordId: Types.ObjectId;
  statutoryType: StatutoryType;
  verificationStatus: VerificationStatus;
  
  // Employee details for verification
  employeeDetails: {
    employeeId?: string;
    aadhaarNumber: string; // Encrypted
    panNumber: string;
    dateOfBirth: Date;
    fullName: string;
    fatherName: string;
    mobileNumber: string;
    emailAddress?: string;
    grossSalary: number;
    basicSalary: number;
    dateOfJoining: Date;
    establishmentDetails: {
      establishmentName: string;
      establishmentCode?: string;
      address: string;
      state: string;
      industryType: string;
    };
  };
  
  // Verification data
  epfoData?: IEpfoVerificationData;
  esicData?: IEsicVerificationData;
  
  // API management
  apiLogs: IApiLog[];
  retryConfig: IRetryConfig;
  preferredProvider: ApiProvider;
  fallbackProviders: ApiProvider[];
  
  // Manual intervention
  manualIntervention?: IManualIntervention;
  requiresManualProcessing: boolean;
  
  // Timestamps
  initiatedAt: Date;
  verifiedAt?: Date;
  lastAttemptAt?: Date;
  
  // Result and linking
  verificationResult: {
    isVerified: boolean;
    linkedSuccessfully: boolean;
    verificationScore: number; // 0-100
    confidenceLevel: 'low' | 'medium' | 'high';
    matchingFields: string[];
    mismatchedFields: string[];
    warnings: string[];
    recommendations: string[];
  };
  
  // Enrollment status (for new registrations)
  enrollmentStatus?: {
    enrollmentRequired: boolean;
    enrollmentInitiated: boolean;
    enrollmentCompleted: boolean;
    enrollmentDate?: Date;
    enrollmentReference?: string;
    enrollmentProvider: ApiProvider;
  };
  
  // Cost tracking
  totalApiCost: number;
  costBreakdown: Array<{
    provider: ApiProvider;
    apiCallCount: number;
    totalCost: number;
  }>;
  
  // Compliance and audit
  complianceAudit: IComplianceAudit;
  auditTrail: Array<{
    action: string;
    performedBy: Types.ObjectId;
    performedAt: Date;
    details: any;
    ipAddress: string;
    userAgent: string;
  }>;
  
  // Metadata
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  
  // System metadata
  createdBy: Types.ObjectId;
  lastUpdatedBy: Types.ObjectId;
  createdAt: Date;
  lastUpdatedAt: Date;
}

// Statutory verification schema
const StatutoryVerificationSchema = new Schema<IStatutoryVerification>({
  verificationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  onboardingRecordId: {
    type: Schema.Types.ObjectId,
    ref: 'OnboardingRecord',
    required: true,
    index: true
  },
  statutoryType: {
    type: String,
    enum: Object.values(StatutoryType),
    required: true,
    index: true
  },
  verificationStatus: {
    type: String,
    enum: Object.values(VerificationStatus),
    default: VerificationStatus.PENDING,
    index: true
  },
  
  // Employee details
  employeeDetails: {
    employeeId: String,
    aadhaarNumber: { type: String, required: true }, // Should be encrypted
    panNumber: { type: String, required: true, index: true },
    dateOfBirth: { type: Date, required: true },
    fullName: { type: String, required: true },
    fatherName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    emailAddress: String,
    grossSalary: { type: Number, required: true },
    basicSalary: { type: Number, required: true },
    dateOfJoining: { type: Date, required: true },
    establishmentDetails: {
      establishmentName: { type: String, required: true },
      establishmentCode: String,
      address: { type: String, required: true },
      state: { type: String, required: true },
      industryType: { type: String, required: true }
    }
  },
  
  // EPFO data
  epfoData: {
    uan: String,
    memberName: String,
    dateOfBirth: Date,
    fatherHusbandName: String,
    lastEmployer: String,
    lastContributionDate: Date,
    totalContributions: Number,
    passbook: {
      establishments: [{
        establishmentName: String,
        establishmentId: String,
        fromDate: Date,
        toDate: Date,
        contributions: [{
          month: String,
          year: Number,
          employeeContribution: Number,
          employerContribution: Number,
          pensionContribution: Number,
          wages: Number
        }]
      }]
    },
    kycStatus: {
      aadhaarSeeded: Boolean,
      panSeeded: Boolean,
      bankSeeded: Boolean,
      nomineeUpdated: Boolean
    }
  },
  
  // ESIC data
  esicData: {
    ipNumber: String,
    memberName: String,
    dateOfBirth: Date,
    fatherName: String,
    lastEmployer: String,
    lastContributionDate: Date,
    eligibilityStatus: { type: String, enum: ['eligible', 'not_eligible', 'pending_verification'] },
    salaryThreshold: Number,
    currentSalary: Number,
    benefitStatus: {
      medicalBenefit: Boolean,
      cashBenefit: Boolean,
      disabilityBenefit: Boolean,
      dependentBenefit: Boolean
    },
    contributions: [{
      month: String,
      year: Number,
      employeeContribution: Number,
      employerContribution: Number,
      wages: Number,
      establishmentCode: String
    }]
  },
  
  // API logs
  apiLogs: [{
    provider: { type: String, enum: Object.values(ApiProvider), required: true },
    requestTimestamp: { type: Date, required: true },
    responseTimestamp: Date,
    requestPayload: Schema.Types.Mixed,
    responsePayload: Schema.Types.Mixed,
    httpStatus: Number,
    success: { type: Boolean, required: true },
    errorMessage: String,
    responseTime: Number,
    apiCost: Number
  }],
  
  // Retry configuration
  retryConfig: {
    maxAttempts: { type: Number, default: 5 },
    currentAttempt: { type: Number, default: 0 },
    nextRetryAt: Date,
    retryInterval: { type: Number, default: 30 }, // minutes
    exponentialBackoff: { type: Boolean, default: true },
    lastAttemptAt: Date,
    lastFailureReason: String,
    providerPreference: [{ type: String, enum: Object.values(ApiProvider) }]
  },
  
  preferredProvider: {
    type: String,
    enum: Object.values(ApiProvider),
    default: ApiProvider.GOVERNMENT_DIRECT
  },
  fallbackProviders: [{ type: String, enum: Object.values(ApiProvider) }],
  
  // Manual intervention
  manualIntervention: {
    flaggedAt: Date,
    flaggedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: Date,
    status: { type: String, enum: ['pending', 'in_progress', 'resolved', 'escalated'], default: 'pending' },
    resolution: String,
    resolvedAt: Date,
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    escalationLevel: { type: Number, default: 0 },
    escalatedAt: Date,
    escalatedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    adminNotes: [String]
  },
  requiresManualProcessing: { type: Boolean, default: false },
  
  // Timestamps
  initiatedAt: { type: Date, default: Date.now },
  verifiedAt: Date,
  lastAttemptAt: Date,
  
  // Verification result
  verificationResult: {
    isVerified: { type: Boolean, default: false },
    linkedSuccessfully: { type: Boolean, default: false },
    verificationScore: { type: Number, min: 0, max: 100, default: 0 },
    confidenceLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    matchingFields: [String],
    mismatchedFields: [String],
    warnings: [String],
    recommendations: [String]
  },
  
  // Enrollment status
  enrollmentStatus: {
    enrollmentRequired: { type: Boolean, default: false },
    enrollmentInitiated: { type: Boolean, default: false },
    enrollmentCompleted: { type: Boolean, default: false },
    enrollmentDate: Date,
    enrollmentReference: String,
    enrollmentProvider: { type: String, enum: Object.values(ApiProvider) }
  },
  
  // Cost tracking
  totalApiCost: { type: Number, default: 0 },
  costBreakdown: [{
    provider: { type: String, enum: Object.values(ApiProvider) },
    apiCallCount: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 }
  }],
  
  // Compliance audit
  complianceAudit: {
    dataProtectionCompliance: { type: Boolean, default: false },
    consentObtained: { type: Boolean, default: false },
    dataRetentionPolicy: String,
    encryptionApplied: { type: Boolean, default: false },
    accessLogMaintained: { type: Boolean, default: false },
    legalBasisForProcessing: String,
    dataSubjectRights: {
      accessProvided: { type: Boolean, default: false },
      correctionAllowed: { type: Boolean, default: false },
      deletionSupported: { type: Boolean, default: false },
      portabilityEnabled: { type: Boolean, default: false }
    }
  },
  
  // Audit trail
  auditTrail: [{
    action: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedAt: { type: Date, default: Date.now },
    details: Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }],
  
  // Metadata
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  tags: [String],
  
  // System metadata
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for performance
StatutoryVerificationSchema.index({ statutoryType: 1, verificationStatus: 1 });
StatutoryVerificationSchema.index({ 'employeeDetails.panNumber': 1 });
StatutoryVerificationSchema.index({ 'retryConfig.nextRetryAt': 1, verificationStatus: 1 });
StatutoryVerificationSchema.index({ 'manualIntervention.assignedTo': 1, 'manualIntervention.status': 1 });
StatutoryVerificationSchema.index({ createdAt: -1 });
StatutoryVerificationSchema.index({ priority: 1, verificationStatus: 1 });

// Pre-save middleware
StatutoryVerificationSchema.pre('save', function(next) {
  if (this.isModified('apiLogs')) {
    // Calculate total API cost
    this.totalApiCost = this.apiLogs.reduce((total, log) => total + (log.apiCost || 0), 0);
    
    // Update cost breakdown
    const costMap = new Map();
    this.apiLogs.forEach(log => {
      const provider = log.provider;
      if (!costMap.has(provider)) {
        costMap.set(provider, { apiCallCount: 0, totalCost: 0 });
      }
      const current = costMap.get(provider);
      current.apiCallCount += 1;
      current.totalCost += log.apiCost || 0;
    });
    
    this.costBreakdown = Array.from(costMap.entries()).map(([provider, data]) => ({
      provider,
      ...data
    }));
  }
  
  next();
});

// Virtual for days since initiation
StatutoryVerificationSchema.virtual('daysSinceInitiation').get(function() {
  return Math.floor((Date.now() - this.initiatedAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Method to check if verification is overdue
StatutoryVerificationSchema.methods.isOverdue = function(): boolean {
  const daysSinceInitiation = this.daysSinceInitiation;
  return daysSinceInitiation > 3 && this.verificationStatus === VerificationStatus.PENDING;
};

// Method to get next retry time
StatutoryVerificationSchema.methods.getNextRetryTime = function(): Date | null {
  if (!this.retryConfig.nextRetryAt) return null;
  return this.retryConfig.nextRetryAt;
};

// Method to calculate exponential backoff
StatutoryVerificationSchema.methods.calculateNextRetry = function(): Date {
  const baseInterval = this.retryConfig.retryInterval;
  const attempt = this.retryConfig.currentAttempt;
  
  let intervalMinutes = baseInterval;
  if (this.retryConfig.exponentialBackoff) {
    intervalMinutes = baseInterval * Math.pow(2, attempt);
  }
  
  // Cap at 24 hours
  intervalMinutes = Math.min(intervalMinutes, 24 * 60);
  
  return new Date(Date.now() + intervalMinutes * 60 * 1000);
};

// Method to add audit trail entry
StatutoryVerificationSchema.methods.addAuditEntry = function(
  action: string,
  performedBy: Types.ObjectId,
  details: any,
  ipAddress: string,
  userAgent: string
) {
  this.auditTrail.push({
    action,
    performedBy,
    performedAt: new Date(),
    details,
    ipAddress,
    userAgent
  });
};

// Static method to find verifications ready for retry
StatutoryVerificationSchema.statics.findRetryReady = function() {
  return this.find({
    verificationStatus: VerificationStatus.RETRY_SCHEDULED,
    'retryConfig.nextRetryAt': { $lte: new Date() },
    'retryConfig.currentAttempt': { $lt: '$retryConfig.maxAttempts' }
  });
};

// Static method to find verifications requiring manual intervention
StatutoryVerificationSchema.statics.findManualInterventionRequired = function() {
  return this.find({
    $or: [
      { verificationStatus: VerificationStatus.MANUAL_INTERVENTION_REQUIRED },
      { requiresManualProcessing: true },
      { 'retryConfig.currentAttempt': { $gte: '$retryConfig.maxAttempts' } }
    ]
  });
};

export const StatutoryVerification = mongoose.model<IStatutoryVerification>('StatutoryVerification', StatutoryVerificationSchema);
