/**
 * Onboarding Engine Service - Core orchestration for employee onboarding workflow
 * 
 * Features:
 * - Step-by-step guided onboarding process
 * - Integration with statutory verification systems
 * - Biometric enrollment coordination
 * - Document management and validation
 * - Compliance and audit trail management
 * - Error handling and retry mechanisms
 */

import { Types } from 'mongoose';
import { OnboardingRecord, OnboardingStatus, IOnboardingRecord } from '../../models/onboarding/onboardingRecord';
import { StatutoryVerification, StatutoryType, VerificationStatus as StatutoryVerificationStatus } from '../../models/onboarding/statutoryVerification';
// Note: These services will be implemented in subsequent modules
// import { BiometricEnrollmentService } from './biometricEnrollment';
// import { StatutoryVerificationService } from './statutoryVerification';
// import { DocumentManagerService } from './documentManager';
// import { ComplianceManagerService } from './complianceManager';
// import { QueueManagerService } from './queueManager';
import crypto from 'crypto';

// Onboarding workflow steps
export enum OnboardingStep {
  PERSONAL_INFO_COLLECTION = 'personal_info_collection',
  ADDRESS_DETAILS = 'address_details',
  EMERGENCY_CONTACT = 'emergency_contact',
  NOMINEE_DETAILS = 'nominee_details',
  EMPLOYMENT_DETAILS = 'employment_details',
  DOCUMENT_UPLOAD = 'document_upload',
  BIOMETRIC_ENROLLMENT = 'biometric_enrollment',
  STATUTORY_VERIFICATION = 'statutory_verification',
  CONSENT_CAPTURE = 'consent_capture',
  HR_APPROVAL = 'hr_approval',
  ATTENDANCE_SETUP = 'attendance_setup',
  FINAL_VERIFICATION = 'final_verification'
}

// Onboarding configuration interface
interface IOnboardingConfig {
  requiredSteps: OnboardingStep[];
  requiredDocuments: string[];
  biometricRequired: boolean;
  statutoryVerificationRequired: boolean;
  hrApprovalRequired: boolean;
  autoProgressEnabled: boolean;
  notificationSettings: {
    smsEnabled: boolean;
    emailEnabled: boolean;
    slackEnabled: boolean;
  };
}

// Step validation result interface
interface IStepValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  nextStep?: OnboardingStep;
  completionPercentage: number;
}

// Onboarding initiation data interface
interface IOnboardingInitiationData {
  personalInfo: {
    aadhaarNumber: string;
    panNumber: string;
    mobileNumber: string;
    emailAddress?: string;
    fullName: string;
    dateOfBirth: Date;
    gender: 'male' | 'female' | 'other';
  };
  employmentDetails: {
    designationId: Types.ObjectId;
    departmentId: Types.ObjectId;
    locationId: Types.ObjectId;
    reportingManagerId?: Types.ObjectId;
    dateOfJoining: Date;
    employmentType: 'permanent' | 'contract' | 'temporary' | 'intern';
    basicSalary: number;
    grossSalary: number;
  };
  initiatedBy: Types.ObjectId;
  source: 'web' | 'mobile' | 'tablet' | 'api';
  deviceInfo: string;
  ipAddress: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export class OnboardingEngineService {
  // Note: These services will be implemented in subsequent modules
  // private biometricService: BiometricEnrollmentService;
  // private statutoryService: StatutoryVerificationService;
  // private documentService: DocumentManagerService;
  // private complianceService: ComplianceManagerService;
  // private queueService: QueueManagerService;

  constructor() {
    // Service initialization will be added when services are implemented
    // this.biometricService = new BiometricEnrollmentService();
    // this.statutoryService = new StatutoryVerificationService();
    // this.documentService = new DocumentManagerService();
    // this.complianceService = new ComplianceManagerService();
    // this.queueService = new QueueManagerService();
  }

  /**
   * Initiate new onboarding process
   */
  async initiateOnboarding(data: IOnboardingInitiationData): Promise<IOnboardingRecord> {
    try {
      // Check for existing onboarding
      const existingRecord = await OnboardingRecord.findByEmployeeDetails(
        data.personalInfo.panNumber,
        data.personalInfo.mobileNumber
      );

      if (existingRecord && existingRecord.overallStatus !== OnboardingStatus.FAILED) {
        throw new Error('Onboarding already exists for this employee');
      }

      // Generate unique onboarding ID
      const onboardingId = this.generateOnboardingId();

      // Create onboarding record
      const onboardingRecord = new OnboardingRecord({
        onboardingId,
        overallStatus: OnboardingStatus.INITIATED,
        personalInfo: {
          ...data.personalInfo,
          aadhaarNumber: await this.encryptSensitiveData(data.personalInfo.aadhaarNumber),
          nationality: 'Indian'
        },
        employmentDetails: {
          ...data.employmentDetails,
          onboardedBy: data.initiatedBy
        },
        currentStep: OnboardingStep.PERSONAL_INFO_COLLECTION,
        workflowSteps: this.initializeWorkflowSteps(),
        onboardingSource: data.source,
        deviceInfo: data.deviceInfo,
        ipAddress: data.ipAddress,
        locationCaptured: data.location ? {
          ...data.location,
          capturedAt: new Date()
        } : undefined,
        lastUpdatedBy: data.initiatedBy,
        consents: [],
        documents: [],
        biometricEnrollment: {
          enrollmentStatus: StatutoryVerificationStatus.PENDING,
          enrollmentAttempts: 0
        },
        complianceFlags: {
          itActCompliance: false,
          spdiRulesCompliance: false,
          contractActCompliance: false,
          evidenceActCompliance: false
        },
        adminNotes: [],
        hrApprovalRequired: true,
        attendanceEnabled: false,
        kioskEnrollmentStatus: StatutoryVerificationStatus.PENDING,
        payrollIntegrationStatus: StatutoryVerificationStatus.PENDING
      });

      await onboardingRecord.save();

      // Log audit trail (will be implemented when ComplianceManagerService is ready)
      // await this.complianceService.logAuditEvent({
      //   entityType: 'onboarding',
      //   entityId: onboardingRecord._id,
      //   action: 'onboarding_initiated',
      //   performedBy: data.initiatedBy,
      //   details: {
      //     onboardingId,
      //     source: data.source,
      //     personalInfoProvided: true
      //   },
      //   ipAddress: data.ipAddress,
      //   deviceInfo: data.deviceInfo
      // });

      // Queue initial notifications (will be implemented when QueueManagerService is ready)
      // await this.queueInitialNotifications(onboardingRecord);

      return onboardingRecord;
    } catch (error) {
      console.error('Error initiating onboarding:', error);
      throw error;
    }
  }

  /**
   * Update onboarding step data
   */
  async updateStep(
    onboardingId: string,
    stepName: OnboardingStep,
    stepData: any,
    updatedBy: Types.ObjectId
  ): Promise<IStepValidationResult> {
    try {
      const onboardingRecord = await OnboardingRecord.findOne({ onboardingId });
      if (!onboardingRecord) {
        throw new Error('Onboarding record not found');
      }

      // Validate step data
      const validationResult = await this.validateStepData(stepName, stepData, onboardingRecord);
      if (!validationResult.isValid) {
        return validationResult;
      }

      // Update the record based on step
      await this.updateRecordForStep(onboardingRecord, stepName, stepData);

      // Update workflow step status
      const stepIndex = onboardingRecord.workflowSteps.findIndex((step: any) => step.stepName === stepName);
      if (stepIndex !== -1) {
        onboardingRecord.workflowSteps[stepIndex].stepStatus = StatutoryVerificationStatus.VERIFIED;
        onboardingRecord.workflowSteps[stepIndex].completedAt = new Date();
      }

      // Determine next step
      const nextStep = await this.determineNextStep(onboardingRecord);
      if (nextStep) {
        onboardingRecord.currentStep = nextStep;
        
        // Start next step if it's automated
        await this.initiateAutomatedStep(onboardingRecord, nextStep);
      } else {
        // All steps completed
        onboardingRecord.overallStatus = OnboardingStatus.COMPLETED;
        onboardingRecord.completedAt = new Date();
      }

      onboardingRecord.lastUpdatedBy = updatedBy;
      await onboardingRecord.save();

      // Log audit trail (will be implemented when ComplianceManagerService is ready)
      // await this.complianceService.logAuditEvent({
      //   entityType: 'onboarding',
      //   entityId: onboardingRecord._id,
      //   action: 'step_updated',
      //   performedBy: updatedBy,
      //   details: {
      //     stepName,
      //     stepData: this.sanitizeDataForLogging(stepData),
      //     nextStep
      //   }
      // });

      return {
        isValid: true,
        errors: [],
        warnings: validationResult.warnings,
        nextStep: nextStep || undefined,
        completionPercentage: onboardingRecord.getCompletionPercentage()
      };
    } catch (error) {
      console.error('Error updating onboarding step:', error);
      throw error;
    }
  }

  /**
   * Get onboarding status and progress
   */
  async getOnboardingStatus(onboardingId: string): Promise<{
    record: IOnboardingRecord;
    progress: {
      completionPercentage: number;
      currentStep: string;
      nextStep?: string;
      estimatedCompletionTime: number; // in minutes
      overdue: boolean;
    };
    validationErrors: string[];
    warnings: string[];
  }> {
    try {
      const record = await OnboardingRecord.findOne({ onboardingId })
        .populate('employmentDetails.designationId')
        .populate('employmentDetails.departmentId')
        .populate('employmentDetails.locationId')
        .populate('employmentDetails.reportingManagerId')
        .populate('lastUpdatedBy');

      if (!record) {
        throw new Error('Onboarding record not found');
      }

      const completionPercentage = record.getCompletionPercentage();
      const nextStep = record.getNextStep();
      const validationErrors = await this.getValidationErrors(record);
      const warnings = await this.getWarnings(record);

      return {
        record,
        progress: {
          completionPercentage,
          currentStep: record.currentStep,
          nextStep,
          estimatedCompletionTime: this.calculateEstimatedCompletionTime(record),
          overdue: record.isOverdue()
        },
        validationErrors,
        warnings
      };
    } catch (error) {
      console.error('Error getting onboarding status:', error);
      throw error;
    }
  }

  /**
   * Retry failed steps
   */
  async retryFailedSteps(onboardingId: string, retryBy: Types.ObjectId): Promise<boolean> {
    try {
      const onboardingRecord = await OnboardingRecord.findOne({ onboardingId });
      if (!onboardingRecord) {
        throw new Error('Onboarding record not found');
      }

      const failedSteps = onboardingRecord.workflowSteps.filter(
        (step: any) => step.stepStatus === StatutoryVerificationStatus.FAILED
      );

      for (const step of failedSteps) {
        step.stepStatus = StatutoryVerificationStatus.RETRY_SCHEDULED;
        step.retryCount += 1;
        step.nextRetryAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes delay
      }

      // Reset overall status if was failed
      if (onboardingRecord.overallStatus === OnboardingStatus.FAILED) {
        onboardingRecord.overallStatus = OnboardingStatus.INITIATED;
      }

      onboardingRecord.isRetryScheduled = true;
      onboardingRecord.lastUpdatedBy = retryBy;
      await onboardingRecord.save();

      // Queue retry tasks (will be implemented when QueueManagerService is ready)
      // await this.queueRetryTasks(onboardingRecord);

      // Log audit trail (will be implemented when ComplianceManagerService is ready)
      // await this.complianceService.logAuditEvent({
      //   entityType: 'onboarding',
      //   entityId: onboardingRecord._id,
      //   action: 'retry_scheduled',
      //   performedBy: retryBy,
      //   details: {
      //     failedStepsCount: failedSteps.length,
      //     retrySteps: failedSteps.map((step: any) => step.stepName)
      //   }
      // });

      return true;
    } catch (error) {
      console.error('Error retrying failed steps:', error);
      throw error;
    }
  }

  /**
   * Generate unique onboarding ID
   */
  private generateOnboardingId(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(4).toString('hex');
    return `ONB-${timestamp}-${randomBytes}`.toUpperCase();
  }

  /**
   * Initialize workflow steps
   */
  private initializeWorkflowSteps() {
    const steps = Object.values(OnboardingStep);
    return steps.map(stepName => ({
      stepName,
      stepStatus: StatutoryVerificationStatus.PENDING,
      retryCount: 0
    }));
  }

  /**
   * Validate step data
   */
  private async validateStepData(
    stepName: OnboardingStep,
    stepData: any,
    record: IOnboardingRecord
  ): Promise<IStepValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (stepName) {
      case OnboardingStep.PERSONAL_INFO_COLLECTION:
        if (!stepData.aadhaarName || stepData.aadhaarName.length < 2) {
          errors.push('Valid Aadhaar name is required');
        }
        if (!stepData.fatherName || stepData.fatherName.length < 2) {
          errors.push('Father\'s name is required');
        }
        if (!stepData.motherName || stepData.motherName.length < 2) {
          errors.push('Mother\'s name is required');
        }
        break;

      case OnboardingStep.ADDRESS_DETAILS:
        if (!stepData.permanent?.addressLine1) {
          errors.push('Permanent address is required');
        }
        if (!stepData.permanent?.pincode || !/^\d{6}$/.test(stepData.permanent.pincode)) {
          errors.push('Valid 6-digit pincode is required');
        }
        break;

      case OnboardingStep.EMERGENCY_CONTACT:
        if (!stepData.name || stepData.name.length < 2) {
          errors.push('Emergency contact name is required');
        }
        if (!stepData.mobileNumber || !/^\d{10}$/.test(stepData.mobileNumber)) {
          errors.push('Valid 10-digit mobile number is required');
        }
        break;

      case OnboardingStep.NOMINEE_DETAILS:
        if (!stepData.nominees || stepData.nominees.length === 0) {
          errors.push('At least one nominee is required');
        } else {
          const totalShare = stepData.nominees.reduce((sum: number, nominee: any) => sum + (nominee.share || 0), 0);
          if (totalShare !== 100) {
            errors.push('Total nominee share must equal 100%');
          }
        }
        break;

      case OnboardingStep.DOCUMENT_UPLOAD:
        const requiredDocs = ['aadhaar_copy', 'pan_copy', 'passport_photo'];
        const uploadedDocs = stepData.documents?.map((doc: any) => doc.documentType) || [];
        const missingDocs = requiredDocs.filter(doc => !uploadedDocs.includes(doc));
        if (missingDocs.length > 0) {
          errors.push(`Missing required documents: ${missingDocs.join(', ')}`);
        }
        break;

      default:
        // No specific validation for other steps
        break;
    }

    // Check for salary-based warnings
    if (stepName === OnboardingStep.EMPLOYMENT_DETAILS) {
      if (stepData.grossSalary <= 21000) {
        warnings.push('Employee is eligible for ESIC benefits');
      }
      if (stepData.basicSalary >= 15000) {
        warnings.push('Employee is subject to EPFO contributions');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completionPercentage: record.getCompletionPercentage()
    };
  }

  /**
   * Update record for specific step
   */
  private async updateRecordForStep(
    record: IOnboardingRecord,
    stepName: OnboardingStep,
    stepData: any
  ): Promise<void> {
    switch (stepName) {
      case OnboardingStep.PERSONAL_INFO_COLLECTION:
        Object.assign(record.personalInfo, stepData);
        record.overallStatus = OnboardingStatus.PERSONAL_INFO_COLLECTED;
        break;

      case OnboardingStep.ADDRESS_DETAILS:
        record.addressInfo = stepData;
        break;

      case OnboardingStep.EMERGENCY_CONTACT:
        record.emergencyContact = stepData;
        break;

      case OnboardingStep.NOMINEE_DETAILS:
        record.nomineeInfo = stepData.nominees;
        break;

      case OnboardingStep.EMPLOYMENT_DETAILS:
        Object.assign(record.employmentDetails, stepData);
        break;

      case OnboardingStep.DOCUMENT_UPLOAD:
        record.documents = stepData.documents;
        record.overallStatus = OnboardingStatus.DOCUMENTS_UPLOADED;
        break;

      case OnboardingStep.BIOMETRIC_ENROLLMENT:
        record.biometricEnrollment = stepData;
        record.overallStatus = OnboardingStatus.BIOMETRIC_ENROLLED;
        break;

      case OnboardingStep.CONSENT_CAPTURE:
        record.consents = stepData.consents;
        record.overallStatus = OnboardingStatus.CONSENT_CAPTURED;
        break;

      default:
        // Handle other steps as needed
        break;
    }
  }

  /**
   * Determine next step in workflow
   */
  private async determineNextStep(record: IOnboardingRecord): Promise<OnboardingStep | null> {
    const pendingSteps = record.workflowSteps.filter(
      (step: any) => step.stepStatus === StatutoryVerificationStatus.PENDING ||
              step.stepStatus === StatutoryVerificationStatus.RETRY_SCHEDULED
    );

    if (pendingSteps.length === 0) {
      return null; // All steps completed
    }

    return pendingSteps[0].stepName as OnboardingStep;
  }

  /**
   * Initiate automated steps
   */
  private async initiateAutomatedStep(
    record: IOnboardingRecord,
    stepName: OnboardingStep
  ): Promise<void> {
    switch (stepName) {
      case OnboardingStep.STATUTORY_VERIFICATION:
        await this.initiateStatutoryVerification(record);
        break;

      case OnboardingStep.ATTENDANCE_SETUP:
        await this.setupAttendanceSystem(record);
        break;

      default:
        // Manual steps - no auto-initiation
        break;
    }
  }

  /**
   * Initiate statutory verification process (placeholder - will be implemented when StatutoryVerificationService is ready)
   */
  private async initiateStatutoryVerification(record: IOnboardingRecord): Promise<void> {
    try {
      // Placeholder implementation
      console.log('Statutory verification will be initiated for:', record.onboardingId);
      
      // TODO: Implement when StatutoryVerificationService is ready
      // EPFO verification
      // const epfoVerification = await this.statutoryService.initiateEpfoVerification({...});
      // record.epfoVerificationId = epfoVerification._id;

      // ESIC verification (if eligible)
      // if (record.employmentDetails.grossSalary <= 21000) {
      //   const esicVerification = await this.statutoryService.initiateEsicVerification({...});
      //   record.esicVerificationId = esicVerification._id;
      // }

      record.overallStatus = OnboardingStatus.STATUTORY_VERIFICATION_PENDING;
      await record.save();
    } catch (error) {
      console.error('Error initiating statutory verification:', error);
      throw error;
    }
  }

  /**
   * Setup attendance system integration (placeholder - will be implemented when BiometricEnrollmentService is ready)
   */
  private async setupAttendanceSystem(record: IOnboardingRecord): Promise<void> {
    try {
      // Placeholder implementation
      console.log('Attendance system setup will be initiated for:', record.onboardingId);
      
      // TODO: Implement when BiometricEnrollmentService is ready
      // Enable biometric attendance if face is enrolled
      // if (record.biometricEnrollment?.faceEmbedding) {
      //   await this.biometricService.enableAttendance(record._id);
      //   record.attendanceEnabled = true;
      //   record.overallStatus = OnboardingStatus.ATTENDANCE_ENABLED;
      // }

      // For now, just mark as enabled
      record.attendanceEnabled = true;
      record.overallStatus = OnboardingStatus.ATTENDANCE_ENABLED;

      await record.save();
    } catch (error) {
      console.error('Error setting up attendance system:', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data
   */
  private async encryptSensitiveData(data: string): Promise<string> {
    // Implementation would use proper encryption library
    // For now, returning masked version
    return data.replace(/.(?=.{4})/g, '*');
  }

  /**
   * Queue initial notifications (placeholder - will be implemented when QueueManagerService is ready)
   */
  private async queueInitialNotifications(record: IOnboardingRecord): Promise<void> {
    // Placeholder implementation
    console.log('Initial notifications will be queued for:', record.onboardingId);
    
    // TODO: Implement when QueueManagerService is ready
    // await this.queueService.queueNotification({
    //   type: 'onboarding_initiated',
    //   recipientId: record.lastUpdatedBy,
    //   data: {
    //     onboardingId: record.onboardingId,
    //     employeeName: record.personalInfo.aadhaarName
    //   }
    // });
  }

  /**
   * Queue retry tasks (placeholder - will be implemented when QueueManagerService is ready)
   */
  private async queueRetryTasks(record: IOnboardingRecord): Promise<void> {
    // Placeholder implementation
    console.log('Retry tasks will be queued for:', record.onboardingId);
    
    // TODO: Implement when QueueManagerService is ready
    // await this.queueService.queueRetryTask({
    //   type: 'onboarding_retry',
    //   entityId: record._id,
    //   retryAt: new Date(Date.now() + 5 * 60 * 1000)
    // });
  }

  /**
   * Get validation errors for current state
   */
  private async getValidationErrors(record: IOnboardingRecord): Promise<string[]> {
    const errors: string[] = [];

    // Check for missing required data
    if (!record.personalInfo.aadhaarName) {
      errors.push('Aadhaar name is missing');
    }
    if (!record.addressInfo) {
      errors.push('Address information is incomplete');
    }
    if (!record.emergencyContact) {
      errors.push('Emergency contact is missing');
    }

    return errors;
  }

  /**
   * Get warnings for current state
   */
  private async getWarnings(record: IOnboardingRecord): Promise<string[]> {
    const warnings: string[] = [];

    // Check for overdue status
    const daysSinceInitiation = Math.floor((Date.now() - record.initiatedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceInitiation > 7 && record.overallStatus !== OnboardingStatus.COMPLETED) {
      warnings.push('Onboarding is overdue');
    }

    // Check for pending verifications
    if (record.epfoVerificationId) {
      const epfoVerification = await StatutoryVerification.findById(record.epfoVerificationId);
      if (epfoVerification) {
        const daysSinceInitiation = Math.floor((Date.now() - epfoVerification.initiatedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceInitiation > 3) {
          warnings.push('EPFO verification is taking longer than expected');
        }
      }
    }

    return warnings;
  }

  /**
   * Calculate estimated completion time
   */
  private calculateEstimatedCompletionTime(record: IOnboardingRecord): number {
    const remainingSteps = record.workflowSteps.filter(
      (step: any) => step.stepStatus === StatutoryVerificationStatus.PENDING
    ).length;

    // Estimate 15 minutes per remaining step
    return remainingSteps * 15;
  }

  /**
   * Sanitize data for logging
   */
  private sanitizeDataForLogging(data: any): any {
    // Remove sensitive fields from audit logs
    const sanitized = { ...data };
    
    if (sanitized.aadhaarNumber) {
      sanitized.aadhaarNumber = '****-****-' + sanitized.aadhaarNumber.slice(-4);
    }
    if (sanitized.panNumber) {
      sanitized.panNumber = '****' + sanitized.panNumber.slice(-6);
    }
    
    return sanitized;
  }
}

export default OnboardingEngineService;
