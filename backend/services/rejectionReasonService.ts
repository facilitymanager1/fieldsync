/**
 * Rejection Reason Service - Manages rejection categories and reasons
 * Provides CRUD operations and analytics for rejection workflow
 */

import { Types } from 'mongoose';
import { 
  RejectionCategory, 
  RejectionReason, 
  RejectionHistory,
  IRejectionCategory,
  IRejectionReason 
} from '../models/rejectionReason';

// Default rejection categories and reasons
const DEFAULT_REJECTION_DATA = [
  {
    categoryId: 'documents',
    label: 'Document Issues',
    icon: 'document-text-outline',
    color: '#FF9500',
    description: 'Issues related to document submission and verification',
    reasons: [
      { reason: 'Missing Aadhaar card', severity: 'high' },
      { reason: 'Invalid PAN card details', severity: 'high' },
      { reason: 'Blurred or unclear documents', severity: 'medium' },
      { reason: 'Document verification failed', severity: 'high' },
      { reason: 'Expired documents', severity: 'high' },
      { reason: 'Mismatched information across documents', severity: 'critical' }
    ]
  },
  {
    categoryId: 'personal_info',
    label: 'Personal Information',
    icon: 'person-outline',
    color: '#007AFF',
    description: 'Issues with personal details and contact information',
    reasons: [
      { reason: 'Incomplete personal details', severity: 'medium' },
      { reason: 'Invalid contact information', severity: 'medium' },
      { reason: 'Address verification failed', severity: 'high' },
      { reason: 'Age criteria not met', severity: 'critical' },
      { reason: 'Educational qualification mismatch', severity: 'high' }
    ]
  },
  {
    categoryId: 'statutory',
    label: 'Statutory Compliance',
    icon: 'shield-outline',
    color: '#34C759',
    description: 'Statutory and compliance-related issues',
    reasons: [
      { reason: 'ESI registration issues', severity: 'high' },
      { reason: 'PF account verification failed', severity: 'high' },
      { reason: 'UAN details incorrect', severity: 'medium' },
      { reason: 'Previous employment conflicts', severity: 'high' },
      { reason: 'Statutory form incomplete', severity: 'medium' }
    ]
  },
  {
    categoryId: 'background',
    label: 'Background Verification',
    icon: 'search-outline',
    color: '#FF3B30',
    description: 'Background check and verification issues',
    reasons: [
      { reason: 'Previous employer verification failed', severity: 'critical' },
      { reason: 'Employment gap concerns', severity: 'medium' },
      { reason: 'Reference check issues', severity: 'high' },
      { reason: 'Criminal background check failed', severity: 'critical' },
      { reason: 'Credit history concerns', severity: 'medium' }
    ]
  },
  {
    categoryId: 'medical',
    label: 'Medical/Health',
    icon: 'medical-outline',
    color: '#AF52DE',
    description: 'Health and medical fitness related issues',
    reasons: [
      { reason: 'Medical fitness certificate missing', severity: 'high' },
      { reason: 'Health screening failed', severity: 'critical' },
      { reason: 'Pre-existing condition concerns', severity: 'medium' },
      { reason: 'Vaccination records incomplete', severity: 'medium' },
      { reason: 'Medical examination pending', severity: 'low' }
    ]
  },
  {
    categoryId: 'policy',
    label: 'Policy Violations',
    icon: 'warning-outline',
    color: '#FF6B6B',
    description: 'Company policy and ethics violations',
    reasons: [
      { reason: 'Company policy violations', severity: 'critical' },
      { reason: 'Conflict of interest', severity: 'high' },
      { reason: 'Previous termination record', severity: 'high' },
      { reason: 'Non-compete agreement issues', severity: 'high' },
      { reason: 'Ethics code violations', severity: 'critical' }
    ]
  }
];

export class RejectionReasonService {
  
  /**
   * Initialize default rejection categories and reasons
   */
  async initializeDefaultReasons(): Promise<void> {
    try {
      // Check if categories already exist
      const existingCount = await RejectionCategory.countDocuments();
      if (existingCount > 0) {
        console.log('Rejection reasons already initialized');
        return;
      }

      let sortOrder = 0;
      
      for (const categoryData of DEFAULT_REJECTION_DATA) {
        // Create category
        const category = new RejectionCategory({
          categoryId: categoryData.categoryId,
          label: categoryData.label,
          icon: categoryData.icon,
          color: categoryData.color,
          description: categoryData.description,
          sortOrder: sortOrder++
        });
        
        await category.save();
        
        // Create reasons for this category
        let reasonSortOrder = 0;
        for (const reasonData of categoryData.reasons) {
          const reason = new RejectionReason({
            categoryId: categoryData.categoryId,
            reason: reasonData.reason,
            severity: reasonData.severity,
            sortOrder: reasonSortOrder++
          });
          
          await reason.save();
        }
      }
      
      console.log('Default rejection reasons initialized successfully');
      
    } catch (error) {
      console.error('Error initializing rejection reasons:', error);
      throw error;
    }
  }

  /**
   * Get all active rejection categories with their reasons
   */
  async getRejectionCategories(): Promise<any[]> {
    try {
      const categories = await RejectionCategory.find({ isActive: true })
        .sort({ sortOrder: 1, label: 1 })
        .lean();

      const categoriesWithReasons = await Promise.all(
        categories.map(async (category) => {
          const reasons = await RejectionReason.find({
            categoryId: category.categoryId,
            isActive: true
          })
          .sort({ sortOrder: 1, usageCount: -1 })
          .lean();

          return {
            ...category,
            reasons: reasons.map(reason => ({
              id: reason._id,
              reason: reason.reason,
              severity: reason.severity,
              usageCount: reason.usageCount
            }))
          };
        })
      );

      return categoriesWithReasons;

    } catch (error) {
      console.error('Error fetching rejection categories:', error);
      throw error;
    }
  }

  /**
   * Get popular rejection reasons across all categories
   */
  async getPopularReasons(limit: number = 10): Promise<any[]> {
    try {
      const popularReasons = await RejectionReason.find({ isActive: true })
        .sort({ usageCount: -1, lastUsedAt: -1 })
        .limit(limit)
        .populate('categoryId', 'label color')
        .lean();

      return popularReasons;

    } catch (error) {
      console.error('Error fetching popular reasons:', error);
      throw error;
    }
  }

  /**
   * Record a rejection with detailed tracking
   */
  async recordRejection(data: {
    employeeApprovalId: Types.ObjectId;
    employeeId: string;
    categoryId: string;
    reason: string;
    customReason?: string;
    additionalComments?: string;
    rejectedBy: Types.ObjectId;
    ipAddress: string;
    userAgent: string;
    source: 'mobile' | 'web' | 'api';
  }): Promise<void> {
    try {
      // Get category info
      const category = await RejectionCategory.findOne({ 
        categoryId: data.categoryId, 
        isActive: true 
      });
      
      if (!category) {
        throw new Error('Invalid rejection category');
      }

      // Create rejection history record
      const rejectionHistory = new RejectionHistory({
        employeeApprovalId: data.employeeApprovalId,
        employeeId: data.employeeId,
        categoryId: data.categoryId,
        categoryLabel: category.label,
        reason: data.reason,
        customReason: data.customReason,
        additionalComments: data.additionalComments,
        rejectedBy: data.rejectedBy,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        source: data.source
      });

      await rejectionHistory.save();

      // Update usage statistics for the reason (if not custom)
      if (!data.customReason) {
        await RejectionReason.updateOne(
          { 
            categoryId: data.categoryId, 
            reason: data.reason,
            isActive: true
          },
          { 
            $inc: { usageCount: 1 },
            $set: { lastUsedAt: new Date() }
          }
        );
      }

    } catch (error) {
      console.error('Error recording rejection:', error);
      throw error;
    }
  }

  /**
   * Get rejection analytics and trends
   */
  async getRejectionAnalytics(options: {
    dateRange?: { from: Date; to: Date };
    categoryId?: string;
    rejectedBy?: Types.ObjectId;
  } = {}): Promise<any> {
    try {
      const matchStage: any = {};

      if (options.dateRange) {
        matchStage.rejectedAt = {
          $gte: options.dateRange.from,
          $lte: options.dateRange.to
        };
      }

      if (options.categoryId) {
        matchStage.categoryId = options.categoryId;
      }

      if (options.rejectedBy) {
        matchStage.rejectedBy = options.rejectedBy;
      }

      const analytics = await RejectionHistory.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              categoryId: '$categoryId',
              categoryLabel: '$categoryLabel'
            },
            count: { $sum: 1 },
            reasons: {
              $push: {
                reason: '$reason',
                customReason: '$customReason',
                severity: '$severity'
              }
            },
            lastRejection: { $max: '$rejectedAt' },
            rejectedBy: { $addToSet: '$rejectedBy' }
          }
        },
        {
          $project: {
            _id: 0,
            categoryId: '$_id.categoryId',
            categoryLabel: '$_id.categoryLabel',
            count: 1,
            lastRejection: 1,
            uniqueReviewers: { $size: '$rejectedBy' },
            topReasons: {
              $slice: [
                {
                  $sortArray: {
                    input: {
                      $map: {
                        input: { 
                          $setUnion: ['$reasons.reason']
                        },
                        as: 'reason',
                        in: {
                          reason: '$$reason',
                          count: {
                            $size: {
                              $filter: {
                                input: '$reasons',
                                cond: { $eq: ['$$this.reason', '$$reason'] }
                              }
                            }
                          }
                        }
                      }
                    },
                    sortBy: { count: -1 }
                  }
                },
                5
              ]
            }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Get overall statistics
      const totalRejections = await RejectionHistory.countDocuments(matchStage);
      const avgRejectionsPerDay = options.dateRange 
        ? totalRejections / Math.ceil((options.dateRange.to.getTime() - options.dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        totalRejections,
        avgRejectionsPerDay,
        categories: analytics
      };

    } catch (error) {
      console.error('Error fetching rejection analytics:', error);
      throw error;
    }
  }

  /**
   * Add custom rejection category
   */
  async addRejectionCategory(data: {
    categoryId: string;
    label: string;
    icon: string;
    color: string;
    description?: string;
  }): Promise<IRejectionCategory> {
    try {
      // Check if category already exists
      const existing = await RejectionCategory.findOne({ categoryId: data.categoryId });
      if (existing) {
        throw new Error('Category with this ID already exists');
      }

      const maxSortOrder = await RejectionCategory.findOne({}, { sortOrder: 1 })
        .sort({ sortOrder: -1 });

      const category = new RejectionCategory({
        ...data,
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1
      });

      return await category.save();

    } catch (error) {
      console.error('Error adding rejection category:', error);
      throw error;
    }
  }

  /**
   * Add custom rejection reason to a category
   */
  async addRejectionReason(data: {
    categoryId: string;
    reason: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
  }): Promise<IRejectionReason> {
    try {
      // Verify category exists
      const category = await RejectionCategory.findOne({ 
        categoryId: data.categoryId, 
        isActive: true 
      });
      
      if (!category) {
        throw new Error('Invalid category ID');
      }

      // Check if reason already exists in this category
      const existing = await RejectionReason.findOne({
        categoryId: data.categoryId,
        reason: data.reason
      });
      
      if (existing) {
        throw new Error('Reason already exists in this category');
      }

      const maxSortOrder = await RejectionReason.findOne(
        { categoryId: data.categoryId }, 
        { sortOrder: 1 }
      ).sort({ sortOrder: -1 });

      const reason = new RejectionReason({
        ...data,
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1
      });

      return await reason.save();

    } catch (error) {
      console.error('Error adding rejection reason:', error);
      throw error;
    }
  }
}

export default new RejectionReasonService();