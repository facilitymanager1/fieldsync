/**
 * Onboarding Record Model - Core onboarding workflow data
 * 
 * Features:
 * - Complete employee onboarding lifecycle management
 * - Integration with statutory verification workflows
 * - Biometric enrollment tracking
 * - Document and consent management
 * - Audit trail and compliance logging
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Onboarding status enum
export enum OnboardingStatus {
  INITIATED = 'initiated',
  PERSONAL_INFO_COLLECTED = 'personal_info_collected',
  DOCUMENTS_UPLOADED = 'documents_uploaded',
  BIOMETRIC_ENROLLED = 'biometric_enrolled',
  STATUTORY_VERIFICATION_PENDING = 'statutory_verification_pending',
  STATUTORY_VERIFICATION_COMPLETE = 'statutory_verification_complete',
  CONSENT_CAPTURED = 'consent_captured',
  ATTENDANCE_ENABLED = 'attendance_enabled',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected'
}

// Verification status for different documents/processes
export enum VerificationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  VERIFIED = 'verified',
  FAILED = 'failed',
  REJECTED = 'rejected',
  RETRY_SCHEDULED = 'retry_scheduled'
}

// Personal information interface
interface IPersonalInfo {
  aadhaarNumber: string; // Masked/encrypted
  aadhaarName: string;
  panNumber: string;
  panName: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  mobileNumber: string;
  emailAddress?: string;
  fatherName: string;
  motherName: string;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  spouseName?: string;
  bloodGroup?: string;
  nationality: string;
  religion?: string;
  caste?: string;
  category?: 'general' | 'obc' | 'sc' | 'st' | 'other';
}

// Address information interface
interface IAddressInfo {
  permanent: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  current: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    sameAsPermanent: boolean;
  };
}

// Emergency contact interface
interface IEmergencyContact {
  name: string;
  relationship: string;
  mobileNumber: string;
  alternateNumber?: string;
  address: string;
}

// Nominee information interface
interface INomineeInfo {
  name: string;
  relationship: string;
  dateOfBirth: Date;
  aadhaarNumber?: string;
  share: number; // Percentage
  address: string;
  mobileNumber?: string;
}

// Employment details interface
interface IEmploymentDetails {
  employeeId: string;
  designationId: Types.ObjectId;
  departmentId: Types.ObjectId;
  locationId: Types.ObjectId;
  reportingManagerId?: Types.ObjectId;
  dateOfJoining: Date;
  employmentType: 'permanent' | 'contract' | 'temporary' | 'intern';
  probationPeriod: number; // in months
  basicSalary: number;
  grossSalary: number;
  ctc: number;
  shiftId?: Types.ObjectId;
  workingDays: number[];
  onboardedBy: Types.ObjectId;
  hrApprovalBy?: Types.ObjectId;
  hrApprovalDate?: Date;
}

// Document reference interface
interface IDocumentReference {
  documentType: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  verificationStatus: VerificationStatus;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  rejectionReason?: string;
  fileHash: string; // SHA-256 hash for integrity
}

// Biometric enrollment interface
interface IBiometricEnrollment {
  faceEmbedding?: {
    embedding: number[];
    confidence: number;
    capturedAt: Date;
    capturedBy: Types.ObjectId;
    deviceInfo: string;
    livenessScore: number;
    qualityScore: number;
  };
  fingerprint?: {
    template: string; // Encrypted fingerprint template
    capturedAt: Date;
    capturedBy: Types.ObjectId;
    deviceInfo: string;
    qualityScore: number;
  };
  enrollmentStatus: VerificationStatus;
  enrollmentAttempts: number;
  lastAttemptAt?: Date;
  fallbackMethod?: 'pin' | 'qr' | 'manual';
}

// Consent record interface
interface IConsentRecord {
  consentType: string;
  consentText: string;
  language: 'english' | 'hindi' | 'kannada' | 'other';
  consentMethod: 'digital_signature' | 'aadhaar_otp' | 'biometric' | 'video_audio';
  consentGiven: boolean;
  consentTimestamp: Date;
  consentBy: Types.ObjectId;
  digitalSignature?: string;
  videoRecordingUrl?: string;
  audioRecordingUrl?: string;
  witnessSignature?: string;
  ipAddress: string;
  deviceInfo: string;
  legalHash: string; // SHA-256 hash for legal validity
}

// Workflow step interface
interface IWorkflowStep {
  stepName: string;
  stepStatus: VerificationStatus;
  startedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
  retryCount: number;
  nextRetryAt?: Date;
  assignedTo?: Types.ObjectId;
  stepData?: any; // Flexible data for step-specific information
}

// Main onboarding record interface
export interface IOnboardingRecord extends Document {
  _id: Types.ObjectId;
  
  // Basic identification
  onboardingId: string; // Unique onboarding reference
  employeeId?: string; // Generated after successful onboarding
  overallStatus: OnboardingStatus;
  
  // Personal and employment information
  personalInfo: IPersonalInfo;
  addressInfo: IAddressInfo;
  emergencyContact: IEmergencyContact;
  nomineeInfo: INomineeInfo[];
  employmentDetails: IEmploymentDetails;
  
  // Documents and verification
  documents: IDocumentReference[];
  biometricEnrollment: IBiometricEnrollment;
  
  // Consent and compliance
  consents: IConsentRecord[];
  complianceFlags: {
    itActCompliance: boolean;
    spdiRulesCompliance: boolean;
    contractActCompliance: boolean;
    evidenceActCompliance: boolean;
  };
  
  // Workflow management
  currentStep: string;
  workflowSteps: IWorkflowStep[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Statutory verification references
  epfoVerificationId?: Types.ObjectId;
  esicVerificationId?: Types.ObjectId;
  
  // Timestamps and audit
  initiatedAt: Date;
  completedAt?: Date;
  lastUpdatedAt: Date;
  lastUpdatedBy: Types.ObjectId;
  
  // System metadata
  onboardingSource: 'web' | 'mobile' | 'tablet' | 'api';
  locationCaptured: {
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt: Date;
  };
  deviceInfo: string;
  ipAddress: string;
  
  // Failure and retry management
  failureCount: number;
  lastFailureReason?: string;
  isRetryScheduled: boolean;
  nextRetryAt?: Date;
  
  // Admin and HR actions
  adminNotes: string[];
  hrApprovalRequired: boolean;
  hrApprovalStatus?: VerificationStatus;
  hrApprovalBy?: Types.ObjectId;
  hrApprovalAt?: Date;
  hrComments?: string;
  
  // Integration flags
  attendanceEnabled: boolean;
  kioskEnrollmentStatus: VerificationStatus;
  payrollIntegrationStatus: VerificationStatus;
}

// Onboarding record schema
const OnboardingRecordSchema = new Schema<IOnboardingRecord>({
  onboardingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  employeeId: {
    type: String,
    sparse: true,
    index: true
  },
  overallStatus: {
    type: String,
    enum: Object.values(OnboardingStatus),
    default: OnboardingStatus.INITIATED,
    index: true
  },
  
  // Personal information
  personalInfo: {
    aadhaarNumber: { type: String, required: true }, // Should be encrypted
    aadhaarName: { type: String, required: true },
    panNumber: { type: String, required: true, index: true },
    panName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    mobileNumber: { type: String, required: true, index: true },
    emailAddress: { type: String, sparse: true },
    fatherName: { type: String, required: true },
    motherName: { type: String, required: true },
    maritalStatus: { type: String, enum: ['single', 'married', 'divorced', 'widowed'], required: true },
    spouseName: String,
    bloodGroup: String,
    nationality: { type: String, default: 'Indian' },
    religion: String,
    caste: String,
    category: { type: String, enum: ['general', 'obc', 'sc', 'st', 'other'] }
  },
  
  // Address information
  addressInfo: {
    permanent: {
      addressLine1: { type: String, required: true },
      addressLine2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: 'India' }
    },
    current: {
      addressLine1: { type: String, required: true },
      addressLine2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: 'India' },
      sameAsPermanent: { type: Boolean, default: false }
    }
  },
  
  // Emergency contact
  emergencyContact: {
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    alternateNumber: String,
    address: { type: String, required: true }
  },
  
  // Nominee information
  nomineeInfo: [{
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    aadhaarNumber: String,
    share: { type: Number, required: true, min: 0, max: 100 },
    address: { type: String, required: true },
    mobileNumber: String
  }],
  
  // Employment details
  employmentDetails: {
    employeeId: String,
    designationId: { type: Schema.Types.ObjectId, ref: 'Designation', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    reportingManagerId: { type: Schema.Types.ObjectId, ref: 'User' },
    dateOfJoining: { type: Date, required: true },
    employmentType: { type: String, enum: ['permanent', 'contract', 'temporary', 'intern'], required: true },
    probationPeriod: { type: Number, default: 6 },
    basicSalary: { type: Number, required: true },
    grossSalary: { type: Number, required: true },
    ctc: { type: Number, required: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift' },
    workingDays: [{ type: Number, min: 0, max: 6 }],
    onboardedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hrApprovalBy: { type: Schema.Types.ObjectId, ref: 'User' },
    hrApprovalDate: Date
  },
  
  // Documents
  documents: [{
    documentType: { type: String, required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    verificationStatus: { type: String, enum: Object.values(VerificationStatus), default: VerificationStatus.PENDING },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    rejectionReason: String,
    fileHash: { type: String, required: true }
  }],
  
  // Biometric enrollment
  biometricEnrollment: {
    faceEmbedding: {
      embedding: [Number],
      confidence: Number,
      capturedAt: Date,
      capturedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      deviceInfo: String,
      livenessScore: Number,
      qualityScore: Number
    },
    fingerprint: {
      template: String, // Encrypted
      capturedAt: Date,
      capturedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      deviceInfo: String,
      qualityScore: Number
    },
    enrollmentStatus: { type: String, enum: Object.values(VerificationStatus), default: VerificationStatus.PENDING },
    enrollmentAttempts: { type: Number, default: 0 },
    lastAttemptAt: Date,
    fallbackMethod: { type: String, enum: ['pin', 'qr', 'manual'] }
  },
  
  // Consents
  consents: [{
    consentType: { type: String, required: true },
    consentText: { type: String, required: true },
    language: { type: String, enum: ['english', 'hindi', 'kannada', 'other'], default: 'english' },
    consentMethod: { type: String, enum: ['digital_signature', 'aadhaar_otp', 'biometric', 'video_audio'], required: true },
    consentGiven: { type: Boolean, required: true },
    consentTimestamp: { type: Date, required: true },
    consentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    digitalSignature: String,
    videoRecordingUrl: String,
    audioRecordingUrl: String,
    witnessSignature: String,
    ipAddress: { type: String, required: true },
    deviceInfo: { type: String, required: true },
    legalHash: { type: String, required: true }
  }],
  
  // Compliance flags
  complianceFlags: {
    itActCompliance: { type: Boolean, default: false },
    spdiRulesCompliance: { type: Boolean, default: false },
    contractActCompliance: { type: Boolean, default: false },
    evidenceActCompliance: { type: Boolean, default: false }
  },
  
  // Workflow management
  currentStep: { type: String, required: true, default: 'personal_info_collection' },
  workflowSteps: [{
    stepName: { type: String, required: true },
    stepStatus: { type: String, enum: Object.values(VerificationStatus), default: VerificationStatus.PENDING },
    startedAt: Date,
    completedAt: Date,
    failureReason: String,
    retryCount: { type: Number, default: 0 },
    nextRetryAt: Date,
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    stepData: Schema.Types.Mixed
  }],
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  
  // Statutory verification references
  epfoVerificationId: { type: Schema.Types.ObjectId, ref: 'StatutoryVerification' },
  esicVerificationId: { type: Schema.Types.ObjectId, ref: 'StatutoryVerification' },
  
  // Timestamps
  initiatedAt: { type: Date, default: Date.now },
  completedAt: Date,
  lastUpdatedAt: { type: Date, default: Date.now },
  lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // System metadata
  onboardingSource: { type: String, enum: ['web', 'mobile', 'tablet', 'api'], required: true },
  locationCaptured: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    capturedAt: Date
  },
  deviceInfo: { type: String, required: true },
  ipAddress: { type: String, required: true },
  
  // Failure management
  failureCount: { type: Number, default: 0 },
  lastFailureReason: String,
  isRetryScheduled: { type: Boolean, default: false },
  nextRetryAt: Date,
  
  // Admin and HR
  adminNotes: [String],
  hrApprovalRequired: { type: Boolean, default: true },
  hrApprovalStatus: { type: String, enum: Object.values(VerificationStatus) },
  hrApprovalBy: { type: Schema.Types.ObjectId, ref: 'User' },
  hrApprovalAt: Date,
  hrComments: String,
  
  // Integration status
  attendanceEnabled: { type: Boolean, default: false },
  kioskEnrollmentStatus: { type: String, enum: Object.values(VerificationStatus), default: VerificationStatus.PENDING },
  payrollIntegrationStatus: { type: String, enum: Object.values(VerificationStatus), default: VerificationStatus.PENDING }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for performance
OnboardingRecordSchema.index({ overallStatus: 1, initiatedAt: -1 });
OnboardingRecordSchema.index({ 'personalInfo.mobileNumber': 1 });
OnboardingRecordSchema.index({ 'personalInfo.panNumber': 1 });
OnboardingRecordSchema.index({ 'employmentDetails.locationId': 1, overallStatus: 1 });
OnboardingRecordSchema.index({ currentStep: 1, isRetryScheduled: 1 });
OnboardingRecordSchema.index({ lastUpdatedAt: -1 });

// Pre-save middleware for audit trail
OnboardingRecordSchema.pre('save', function(next) {
  this.lastUpdatedAt = new Date();
  next();
});

// Virtual for days since initiation
OnboardingRecordSchema.virtual('daysSinceInitiation').get(function() {
  return Math.floor((Date.now() - this.initiatedAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Method to check if onboarding is overdue
OnboardingRecordSchema.methods.isOverdue = function(): boolean {
  const daysSinceInitiation = this.daysSinceInitiation;
  return daysSinceInitiation > 7 && this.overallStatus !== OnboardingStatus.COMPLETED;
};

// Method to get next required step
OnboardingRecordSchema.methods.getNextStep = function(): string | null {
  const pendingSteps = this.workflowSteps.filter((step: IWorkflowStep) => 
    step.stepStatus === VerificationStatus.PENDING || 
    step.stepStatus === VerificationStatus.RETRY_SCHEDULED
  );
  
  return pendingSteps.length > 0 ? pendingSteps[0].stepName : null;
};

// Method to check completion percentage
OnboardingRecordSchema.methods.getCompletionPercentage = function(): number {
  const totalSteps = this.workflowSteps.length;
  const completedSteps = this.workflowSteps.filter((step: IWorkflowStep) => 
    step.stepStatus === VerificationStatus.VERIFIED
  ).length;
  
  return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
};

// Static method to find onboarding by employee details
OnboardingRecordSchema.statics.findByEmployeeDetails = function(panNumber: string, mobileNumber: string) {
  return this.findOne({
    'personalInfo.panNumber': panNumber,
    'personalInfo.mobileNumber': mobileNumber
  });
};

export const OnboardingRecord = mongoose.model<IOnboardingRecord>('OnboardingRecord', OnboardingRecordSchema);
