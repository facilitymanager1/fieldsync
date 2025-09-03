/**
 * Rejection Reason Management Models
 * Categorized rejection reasons for HR approval workflow
 */

import mongoose, { Schema, Document } from 'mongoose';

// Rejection reason category interface
export interface IRejectionCategory extends Document {
  _id: mongoose.Types.ObjectId;
  
  categoryId: string;
  label: string;
  icon: string;
  color: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

// Individual rejection reason interface
export interface IRejectionReason extends Document {
  _id: mongoose.Types.ObjectId;
  
  categoryId: string;
  reason: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  sortOrder: number;
  
  // Usage statistics
  usageCount: number;
  lastUsedAt?: Date;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

// Rejection history for analytics
export interface IRejectionHistory extends Document {
  _id: mongoose.Types.ObjectId;
  
  employeeApprovalId: mongoose.Types.ObjectId;
  employeeId: string;
  
  categoryId: string;
  categoryLabel: string;
  reason: string;
  customReason?: string;
  additionalComments?: string;
  
  rejectedBy: mongoose.Types.ObjectId;
  rejectedAt: Date;
  
  // Context
  ipAddress: string;
  userAgent: string;
  source: 'mobile' | 'web' | 'api';
}

// Rejection Category Schema
const RejectionCategorySchema = new Schema<IRejectionCategory>({
  categoryId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  label: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true,
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },
  description: String,
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  versionKey: false
});

// Rejection Reason Schema
const RejectionReasonSchema = new Schema<IRejectionReason>({
  categoryId: {
    type: String,
    required: true,
    index: true
  },
  reason: {
    type: String,
    required: true
  },
  description: String,
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: Date
}, {
  timestamps: true,
  versionKey: false
});

// Rejection History Schema
const RejectionHistorySchema = new Schema<IRejectionHistory>({
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
  
  categoryId: {
    type: String,
    required: true,
    index: true
  },
  categoryLabel: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  customReason: String,
  additionalComments: String,
  
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rejectedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  ipAddress: String,
  userAgent: String,
  source: {
    type: String,
    enum: ['mobile', 'web', 'api'],
    default: 'mobile'
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for performance
RejectionCategorySchema.index({ isActive: 1, sortOrder: 1 });
RejectionReasonSchema.index({ categoryId: 1, isActive: 1, sortOrder: 1 });
RejectionReasonSchema.index({ usageCount: -1, lastUsedAt: -1 });
RejectionHistorySchema.index({ rejectedAt: -1, categoryId: 1 });
RejectionHistorySchema.index({ rejectedBy: 1, rejectedAt: -1 });

// Methods for updating usage statistics
RejectionReasonSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

// Static method to get popular rejection reasons
RejectionReasonSchema.statics.getPopularReasons = async function(categoryId?: string, limit: number = 10) {
  const query: any = { isActive: true };
  if (categoryId) query.categoryId = categoryId;
  
  return this.find(query)
    .sort({ usageCount: -1, lastUsedAt: -1 })
    .limit(limit);
};

// Static method to get rejection analytics
RejectionHistorySchema.statics.getRejectionAnalytics = async function(dateRange?: { from: Date, to: Date }) {
  const matchStage: any = {};
  
  if (dateRange) {
    matchStage.rejectedAt = {
      $gte: dateRange.from,
      $lte: dateRange.to
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          categoryId: '$categoryId',
          categoryLabel: '$categoryLabel'
        },
        count: { $sum: 1 },
        reasons: { $push: '$reason' },
        lastRejection: { $max: '$rejectedAt' }
      }
    },
    {
      $project: {
        _id: 0,
        categoryId: '$_id.categoryId',
        categoryLabel: '$_id.categoryLabel',
        count: 1,
        topReasons: {
          $slice: [
            {
              $map: {
                input: { 
                  $setUnion: ['$reasons']
                },
                as: 'reason',
                in: {
                  reason: '$$reason',
                  count: {
                    $size: {
                      $filter: {
                        input: '$reasons',
                        cond: { $eq: ['$$this', '$$reason'] }
                      }
                    }
                  }
                }
              }
            },
            5
          ]
        },
        lastRejection: 1
      }
    },
    { $sort: { count: -1 } }
  ]);
};

export const RejectionCategory = mongoose.model<IRejectionCategory>('RejectionCategory', RejectionCategorySchema);
export const RejectionReason = mongoose.model<IRejectionReason>('RejectionReason', RejectionReasonSchema);
export const RejectionHistory = mongoose.model<IRejectionHistory>('RejectionHistory', RejectionHistorySchema);