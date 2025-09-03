/**
 * Approval Service - Core business logic for HR approval workflow
 * Handles all approval operations, status transitions, and validation
 */

import { Types } from 'mongoose';
import { EmployeeApproval, ApprovalEvent, ApprovalNotification, EmployeeStatus, ApprovalAction } from '../models/approval';
import { OnboardingRecord } from '../models/onboarding/onboardingRecord';
import rejectionReasonService from './rejectionReasonService';

interface CreateApprovalData {
  onboardingRecordId: Types.ObjectId;
  employeeId: string;
  createdBy: Types.ObjectId;
  source: 'mobile' | 'web' | 'api';
  ipAddress: string;
  deviceInfo: string;
}

interface UpdateApprovalData {
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

export class ApprovalService {
  
  /**
   * Create approval record when onboarding is submitted
   */
  async createApprovalRecord(data: CreateApprovalData): Promise<string> {
    try {
      // Generate temporary ID
      const tempId = await this.generateTempId();
      
      // Get onboarding record for employee details
      const onboardingRecord = await OnboardingRecord.findById(data.onboardingRecordId);
      if (!onboardingRecord) {
        throw new Error('Onboarding record not found');
      }

      // Create approval record
      const approval = new EmployeeApproval({
        employeeId: data.employeeId,
        onboardingRecordId: data.onboardingRecordId,
        tempId,
        status: EmployeeStatus.IN_PROGRESS,
        validationChecks: {
          hr: false,
          esi: false,
          pf: false,
          uan: false
        },
        priority: this.calculatePriority(onboardingRecord),
        createdBy: data.createdBy,
        lastModifiedBy: data.createdBy,
        source: data.source,
        ipAddress: data.ipAddress,
        deviceInfo: data.deviceInfo
      });

      await approval.save();

      // Log the creation event
      await this.logApprovalEvent({
        employeeApprovalId: approval._id,
        employeeId: data.employeeId,
        action: ApprovalAction.APPROVE, // Initial creation
        performedBy: data.createdBy,
        previousStatus: EmployeeStatus.IN_PROGRESS,
        newStatus: EmployeeStatus.IN_PROGRESS,
        reason: 'Onboarding submitted for approval',
        ipAddress: data.ipAddress,
        userAgent: data.deviceInfo
      });

      // Create notification for HR
      await this.createApprovalNotification({
        type: 'approval_required',
        employeeApprovalId: approval._id,
        employeeId: data.employeeId,
        employeeName: onboardingRecord.personalInfo.aadhaarName,
        message: `New employee ${onboardingRecord.personalInfo.aadhaarName} submitted for approval`,
        recipientRole: 'hr',
        actionUrl: `/approvals/${approval._id}`
      });

      return tempId;

    } catch (error) {
      console.error('Error creating approval record:', error);
      throw error;
    }
  }

  /**
   * Update approval record (HR actions)
   */
  async updateApproval(
    approvalId: string, 
    updateData: UpdateApprovalData,
    performedBy: Types.ObjectId,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      const approval = await EmployeeApproval.findById(approvalId);
      if (!approval) {
        throw new Error('Approval record not found');
      }

      const previousStatus = approval.status;
      const previousValidation = { ...approval.validationChecks };

      // Update approval record
      if (updateData.status) approval.status = updateData.status;
      if (updateData.hrComments) approval.hrComments = updateData.hrComments;
      if (updateData.rejectionReason) approval.rejectionReason = updateData.rejectionReason;
      if (updateData.contractEndDate) approval.contractEndDate = updateData.contractEndDate;
      if (updateData.permanentId) approval.permanentId = updateData.permanentId;

      // Update validation checks with timestamps
      if (updateData.validationChecks) {
        Object.keys(updateData.validationChecks).forEach(key => {
          const checkKey = key as keyof typeof updateData.validationChecks;
          if (updateData.validationChecks![checkKey] !== undefined) {
            approval.validationChecks[checkKey] = updateData.validationChecks![checkKey]!;
            
            // Add approval timestamp and user
            if (updateData.validationChecks![checkKey]) {
              (approval.validationChecks as any)[`${checkKey}ApprovedBy`] = performedBy;
              (approval.validationChecks as any)[`${checkKey}ApprovedAt`] = new Date();
            }
          }
        });
      }

      // Set approval/rejection timestamps
      if (updateData.status === EmployeeStatus.EXIST && !approval.approvedAt) {
        approval.approvedAt = new Date();
      }
      if (updateData.status === EmployeeStatus.REJECTED && !approval.rejectedAt) {
        approval.rejectedAt = new Date();
      }

      approval.lastModifiedBy = performedBy;
      await approval.save();

      // Determine action type
      let action: ApprovalAction;
      if (updateData.status === EmployeeStatus.REJECTED) {
        action = ApprovalAction.REJECT;
      } else if (updateData.status === EmployeeStatus.EXIST) {
        action = ApprovalAction.APPROVE;
      } else {
        action = ApprovalAction.REQUEST_CHANGES;
      }

      // Log the event
      await this.logApprovalEvent({
        employeeApprovalId: approval._id,
        employeeId: approval.employeeId,
        action,
        performedBy,
        previousStatus,
        newStatus: approval.status,
        reason: updateData.rejectionReason || updateData.hrComments,
        validationChanges: this.calculateValidationChanges(previousValidation, approval.validationChecks),
        ipAddress,
        userAgent
      });

      // Record rejection details if status is rejected
      if (updateData.status === EmployeeStatus.REJECTED && updateData.rejectionCategory) {
        await rejectionReasonService.recordRejection({
          employeeApprovalId: approval._id,
          employeeId: approval.employeeId,
          categoryId: updateData.rejectionCategory,
          reason: updateData.rejectionReason || updateData.customRejectionReason || 'No reason provided',
          customReason: updateData.customRejectionReason,
          additionalComments: updateData.additionalComments,
          rejectedBy: performedBy,
          ipAddress,
          userAgent: userAgent,
          source: 'mobile' // This could be determined from the request
        });
      }

      // Send notifications based on status change
      await this.handleStatusChangeNotifications(approval, previousStatus);

    } catch (error) {
      console.error('Error updating approval:', error);
      throw error;
    }
  }

  /**
   * Get approval records with filtering and pagination
   */
  async getApprovals(
    filters: {
      status?: EmployeeStatus[];
      validationStatus?: 'pending' | 'partial' | 'complete';
      createdBy?: Types.ObjectId;
      searchQuery?: string;
      priority?: string[];
    },
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const query: any = {};

      // Status filter
      if (filters.status && filters.status.length > 0) {
        query.status = { $in: filters.status };
      }

      // Validation status filter
      if (filters.validationStatus) {
        switch (filters.validationStatus) {
          case 'pending':
            query.$or = [
              { 'validationChecks.hr': false },
              { 'validationChecks.esi': false },
              { 'validationChecks.pf': false },
              { 'validationChecks.uan': false }
            ];
            break;
          case 'complete':
            query['validationChecks.hr'] = true;
            query['validationChecks.esi'] = true;
            query['validationChecks.pf'] = true;
            query['validationChecks.uan'] = true;
            break;
          case 'partial':
            query.$and = [
              {
                $or: [
                  { 'validationChecks.hr': true },
                  { 'validationChecks.esi': true },
                  { 'validationChecks.pf': true },
                  { 'validationChecks.uan': true }
                ]
              },
              {
                $or: [
                  { 'validationChecks.hr': false },
                  { 'validationChecks.esi': false },
                  { 'validationChecks.pf': false },
                  { 'validationChecks.uan': false }
                ]
              }
            ];
            break;
        }
      }

      // Created by filter (for field officer view)
      if (filters.createdBy) {
        query.createdBy = filters.createdBy;
      }

      // Priority filter
      if (filters.priority && filters.priority.length > 0) {
        query.priority = { $in: filters.priority };
      }

      // Search functionality
      if (filters.searchQuery) {
        const searchRegex = new RegExp(filters.searchQuery, 'i');
        query.$or = [
          { employeeId: searchRegex },
          { tempId: searchRegex },
          { permanentId: searchRegex }
        ];
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [approvals, total] = await Promise.all([
        EmployeeApproval.find(query)
          .populate('onboardingRecordId', 'personalInfo.aadhaarName personalInfo.mobileNumber')
          .populate('createdBy', 'name role')
          .populate('lastModifiedBy', 'name')
          .sort({ submittedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        EmployeeApproval.countDocuments(query)
      ]);

      return {
        approvals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      console.error('Error fetching approvals:', error);
      throw error;
    }
  }

  /**
   * Get approval statistics for dashboard
   */
  async getApprovalStats(): Promise<any> {
    try {
      return await (EmployeeApproval as any).getApprovalStats();
    } catch (error) {
      console.error('Error fetching approval stats:', error);
      throw error;
    }
  }

  /**
   * Bulk approval operations
   */
  async bulkUpdateApprovals(
    approvalIds: string[],
    updateData: UpdateApprovalData,
    performedBy: Types.ObjectId,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      const approvals = await EmployeeApproval.find({ _id: { $in: approvalIds } });
      
      for (const approval of approvals) {
        await this.updateApproval(
          approval._id.toString(),
          updateData,
          performedBy,
          ipAddress,
          userAgent
        );
      }
    } catch (error) {
      console.error('Error in bulk approval update:', error);
      throw error;
    }
  }

  /**
   * Generate temporary employee ID
   */
  private async generateTempId(): Promise<string> {
    const prefix = 'TEMP';
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    // Get the next sequence number for this month
    const count = await EmployeeApproval.countDocuments({
      tempId: { $regex: `^${prefix}${year}${month}` }
    });
    
    const sequence = (count + 1).toString().padStart(4, '0');
    return `${prefix}${year}${month}${sequence}`;
  }

  /**
   * Generate permanent employee ID
   */
  async generatePermanentId(): Promise<string> {
    const prefix = 'EMP';
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    // Get the next sequence number for this month
    const count = await EmployeeApproval.countDocuments({
      permanentId: { $regex: `^${prefix}${year}${month}` }
    });
    
    const sequence = (count + 1).toString().padStart(4, '0');
    return `${prefix}${year}${month}${sequence}`;
  }

  /**
   * Calculate priority based on onboarding data
   */
  private calculatePriority(onboardingRecord: any): 'low' | 'medium' | 'high' {
    // Business logic for priority calculation
    const daysSinceSubmission = Math.floor(
      (Date.now() - onboardingRecord.initiatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceSubmission > 7) return 'high';
    if (daysSinceSubmission > 3) return 'medium';
    return 'low';
  }

  /**
   * Log approval events for audit trail
   */
  private async logApprovalEvent(eventData: any): Promise<void> {
    try {
      const event = new ApprovalEvent(eventData);
      await event.save();
    } catch (error) {
      console.error('Error logging approval event:', error);
      // Don't throw error to avoid breaking main flow
    }
  }

  /**
   * Create approval notifications
   */
  private async createApprovalNotification(notificationData: any): Promise<void> {
    try {
      const notification = new ApprovalNotification(notificationData);
      await notification.save();
    } catch (error) {
      console.error('Error creating approval notification:', error);
      // Don't throw error to avoid breaking main flow
    }
  }

  /**
   * Calculate validation changes for audit log
   */
  private calculateValidationChanges(previous: any, current: any): any[] {
    const changes: any[] = [];
    const fields = ['hr', 'esi', 'pf', 'uan'];
    
    fields.forEach(field => {
      if (previous[field] !== current[field]) {
        changes.push({
          field,
          previousValue: previous[field],
          newValue: current[field]
        });
      }
    });
    
    return changes;
  }

  /**
   * Handle notifications when status changes
   */
  private async handleStatusChangeNotifications(approval: any, previousStatus: EmployeeStatus): Promise<void> {
    if (approval.status === previousStatus) return;

    const onboardingRecord = await OnboardingRecord.findById(approval.onboardingRecordId);
    if (!onboardingRecord) return;

    let notificationType: string;
    let message: string;
    let recipientRole: 'hr' | 'field_officer' | 'admin';

    switch (approval.status) {
      case EmployeeStatus.EXIST:
        notificationType = 'status_changed';
        message = `Employee ${onboardingRecord.personalInfo.aadhaarName} has been approved and moved to Exist status`;
        recipientRole = 'field_officer';
        break;
      
      case EmployeeStatus.REJECTED:
        notificationType = 'rejection';
        message = `Employee ${onboardingRecord.personalInfo.aadhaarName} has been rejected: ${approval.rejectionReason}`;
        recipientRole = 'field_officer';
        break;
      
      default:
        return; // No notification for other status changes
    }

    await this.createApprovalNotification({
      type: notificationType,
      employeeApprovalId: approval._id,
      employeeId: approval.employeeId,
      employeeName: onboardingRecord.personalInfo.aadhaarName,
      message,
      recipientRole,
      recipientId: approval.createdBy // Send to the field officer who created it
    });
  }
}

export default new ApprovalService();