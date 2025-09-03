// Referral Engine & CRM module
// Handles referral tracking, rewards, CRM integration
import { Request, Response } from 'express';
import { Referral } from '../models/referral';
import { User } from '../models/user';
import { auditLogger } from '../middleware/auditLogger';
import { notification } from './notification';

// Referral interfaces
export interface IReferral {
  _id?: string;
  referrerId: string;
  refereeEmail: string;
  refereeName: string;
  refereePhone?: string;
  refereeCompany?: string;
  status: 'pending' | 'contacted' | 'qualified' | 'converted' | 'rejected';
  source: 'web' | 'mobile' | 'email' | 'phone' | 'social' | 'other';
  referralCode: string;
  notes?: string;
  expectedValue?: number;
  actualValue?: number;
  conversionDate?: Date;
  contactedDate?: Date;
  qualifiedDate?: Date;
  rejectedDate?: Date;
  rejectionReason?: string;
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  customFields?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    referrer_url?: string;
    ip_address?: string;
    user_agent?: string;
  };
}

export interface IReferralReward {
  _id?: string;
  referralId: string;
  referrerId: string;
  rewardType: 'points' | 'cash' | 'credit' | 'gift' | 'commission';
  amount: number;
  currency?: string;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  calculatedAt: Date;
  approvedAt?: Date;
  paidAt?: Date;
  approvedBy?: string;
  paidBy?: string;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  expiresAt?: Date;
}

export interface IReferralProgram {
  _id?: string;
  name: string;
  description: string;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
  rewardStructure: {
    tier: string;
    referralReward: number;
    conversionReward: number;
    maxRewards?: number;
    qualificationCriteria: string[];
  }[];
  rules: {
    minReferrals: number;
    minConversionValue: number;
    cooldownPeriod: number; // days
    blacklistDomains?: string[];
    requiresApproval: boolean;
  };
  targetAudience: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ICRMIntegration {
  provider: 'salesforce' | 'hubspot' | 'pipedrive' | 'zoho' | 'custom';
  config: {
    apiKey?: string;
    baseUrl?: string;
    webhookUrl?: string;
    fieldMappings: Record<string, string>;
  };
  syncSettings: {
    autoSync: boolean;
    syncFrequency: number; // minutes
    lastSync?: Date;
    failureCount: number;
  };
}

/**
 * Submit new referral
 */
export async function submitReferral(req: Request, res: Response) {
  try {
    const referrerId = req.user?.id;
    const {
      refereeEmail,
      refereeName,
      refereePhone,
      refereeCompany,
      notes,
      expectedValue,
      source = 'web',
      priority = 'medium',
      tags = [],
      customFields = {},
      metadata = {}
    } = req.body;

    if (!refereeEmail || !refereeName) {
      return res.status(400).json({
        success: false,
        error: 'Referee email and name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(refereeEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Check for duplicate referrals
    const existingReferral = await Referral.findOne({
      refereeEmail: refereeEmail.toLowerCase(),
      status: { $in: ['pending', 'contacted', 'qualified'] }
    });

    if (existingReferral) {
      return res.status(400).json({
        success: false,
        error: 'This person has already been referred'
      });
    }

    // Generate unique referral code
    const referralCode = await generateReferralCode();

    // Create referral object
    const referralData: Partial<IReferral> = {
      referrerId,
      refereeEmail: refereeEmail.toLowerCase(),
      refereeName,
      refereePhone,
      refereeCompany,
      status: 'pending',
      source,
      referralCode,
      notes,
      expectedValue,
      priority,
      tags: Array.isArray(tags) ? tags : [tags],
      customFields,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        ...metadata,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      }
    };

    // Apply referral program rules
    const program = await getActiveReferralProgram();
    if (program) {
      const validation = await validateReferralEligibility(referrerId, referralData, program);
      if (!validation.eligible) {
        return res.status(400).json({
          success: false,
          error: validation.reason
        });
      }
    }

    const referral = await Referral.create(referralData);

    // Auto-assign to sales team if available
    const assignment = await autoAssignReferral(referral._id.toString());
    if (assignment.success) {
      await Referral.findByIdAndUpdate(referral._id, {
        assignedTo: assignment.agentId,
        updatedAt: new Date()
      });
    }

    // Sync with CRM if configured
    await syncReferralToCRM(referral._id.toString());

    // Send notifications
    await sendReferralNotifications(referral._id.toString(), 'submitted');

    // Log referral submission
    auditLogger.info('Referral submitted', {
      userId: referrerId,
      action: 'SUBMIT_REFERRAL',
      resource: 'referral',
      resourceId: referral._id.toString(),
      changes: referralData
    });

    res.status(201).json({
      success: true,
      message: 'Referral submitted successfully',
      data: {
        referral: await Referral.findById(referral._id)
          .populate('referrerId', 'name email')
          .populate('assignedTo', 'name email')
          .lean(),
        referralCode
      }
    });

  } catch (error) {
    console.error('Error submitting referral:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit referral'
    });
  }
}

/**
 * Get referrals with filtering and pagination
 */
export async function getReferrals(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const {
      status,
      referrerId,
      assignedTo,
      source,
      priority,
      startDate,
      endDate,
      search,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filters
    const filters: any = {};

    // Role-based filtering
    if (['admin', 'supervisor'].includes(userRole)) {
      if (referrerId) filters.referrerId = referrerId;
      if (assignedTo) filters.assignedTo = assignedTo;
    } else if (userRole === 'fieldtech') {
      // Field techs can see assigned referrals
      filters.$or = [
        { referrerId: userId },
        { assignedTo: userId }
      ];
    } else {
      // Regular users can only see their own referrals
      filters.referrerId = userId;
    }

    if (status) filters.status = status;
    if (source) filters.source = source;
    if (priority) filters.priority = priority;

    // Date range filter
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate as string);
      if (endDate) filters.createdAt.$lte = new Date(endDate as string);
    }

    // Search filter
    if (search) {
      filters.$or = [
        { refereeName: { $regex: search, $options: 'i' } },
        { refereeEmail: { $regex: search, $options: 'i' } },
        { refereeCompany: { $regex: search, $options: 'i' } },
        { referralCode: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort options
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const [referrals, totalCount] = await Promise.all([
      Referral.find(filters)
        .populate('referrerId', 'name email')
        .populate('assignedTo', 'name email department')
        .sort(sortOptions)
        .skip(Number(offset))
        .limit(Number(limit))
        .lean(),
      Referral.countDocuments(filters)
    ]);

    res.json({
      success: true,
      data: {
        referrals,
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error getting referrals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve referrals'
    });
  }
}

/**
 * Update referral status
 */
export async function updateReferralStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, notes, actualValue, rejectionReason, assignedTo } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const referral = await Referral.findById(id);

    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'Referral not found'
      });
    }

    // Check permissions
    const canUpdate = ['admin', 'supervisor'].includes(userRole) || 
                     referral.assignedTo?.toString() === userId;

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const updateData: any = {
      updatedAt: new Date()
    };

    if (status) {
      updateData.status = status;
      
      // Set status-specific timestamps
      switch (status) {
        case 'contacted':
          updateData.contactedDate = new Date();
          break;
        case 'qualified':
          updateData.qualifiedDate = new Date();
          break;
        case 'converted':
          updateData.conversionDate = new Date();
          if (actualValue) updateData.actualValue = actualValue;
          break;
        case 'rejected':
          updateData.rejectedDate = new Date();
          if (rejectionReason) updateData.rejectionReason = rejectionReason;
          break;
      }
    }

    if (notes) updateData.notes = notes;
    if (assignedTo) updateData.assignedTo = assignedTo;

    await Referral.findByIdAndUpdate(id, updateData);

    // Handle conversion rewards
    if (status === 'converted') {
      await processReferralRewardCalculation(id, actualValue);
    }

    // Sync with CRM
    await syncReferralToCRM(id);

    // Send notifications
    await sendReferralNotifications(id, status);

    // Log status update
    auditLogger.info('Referral status updated', {
      userId,
      action: 'UPDATE_REFERRAL_STATUS',
      resource: 'referral',
      resourceId: id,
      changes: updateData
    });

    res.json({
      success: true,
      message: 'Referral status updated successfully',
      data: {
        referral: await Referral.findById(id)
          .populate('referrerId', 'name email')
          .populate('assignedTo', 'name email')
          .lean()
      }
    });

  } catch (error) {
    console.error('Error updating referral status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update referral status'
    });
  }
}

/**
 * Get referral analytics and statistics
 */
export async function getReferralAnalytics(req: Request, res: Response) {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { period = '30d', referrerId } = req.query;

    if (!['admin', 'supervisor'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Calculate date range
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const matchFilter: any = {
      createdAt: { $gte: startDate }
    };

    if (referrerId) {
      matchFilter.referrerId = referrerId;
    }

    const [
      totalReferrals,
      statusBreakdown,
      sourceBreakdown,
      conversionStats,
      topReferrers,
      revenueStats,
      trendData
    ] = await Promise.all([
      Referral.countDocuments(matchFilter),
      Referral.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Referral.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]),
      Referral.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalSubmitted: { $sum: 1 },
            converted: {
              $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] }
            },
            totalValue: {
              $sum: { $cond: [{ $eq: ['$status', 'converted'] }, '$actualValue', 0] }
            },
            avgValue: {
              $avg: { $cond: [{ $eq: ['$status', 'converted'] }, '$actualValue', null] }
            }
          }
        }
      ]),
      Referral.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$referrerId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        }
      ]),
      Referral.aggregate([
        {
          $match: {
            ...matchFilter,
            status: 'converted'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$actualValue' },
            avgDealSize: { $avg: '$actualValue' },
            totalDeals: { $sum: 1 }
          }
        }
      ]),
      Referral.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 },
            converted: {
              $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] }
            }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ])
    ]);

    const conversionRate = conversionStats[0] ? 
      (conversionStats[0].converted / conversionStats[0].totalSubmitted * 100).toFixed(2) : 0;

    const analytics = {
      overview: {
        totalReferrals,
        conversionRate: parseFloat(conversionRate as string),
        totalRevenue: revenueStats[0]?.totalRevenue || 0,
        averageDealSize: revenueStats[0]?.avgDealSize || 0
      },
      breakdowns: {
        status: statusBreakdown.map(item => ({
          status: item._id,
          count: item.count
        })),
        source: sourceBreakdown.map(item => ({
          source: item._id,
          count: item.count
        }))
      },
      topReferrers: topReferrers.map(item => ({
        referrerId: item._id,
        referrerName: item.user[0]?.name || 'Unknown',
        referralCount: item.count
      })),
      trends: trendData.map(item => ({
        date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}-${item._id.day.toString().padStart(2, '0')}`,
        submitted: item.count,
        converted: item.converted
      }))
    };

    res.json({
      success: true,
      data: { analytics }
    });

  } catch (error) {
    console.error('Error getting referral analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve referral analytics'
    });
  }
}

/**
 * Get referral rewards
 */
export async function getReferralRewards(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { referrerId, status, limit = 20, offset = 0 } = req.query;

    // Build filters
    const filters: any = {};

    if (['admin', 'supervisor'].includes(userRole)) {
      if (referrerId) filters.referrerId = referrerId;
    } else {
      filters.referrerId = userId;
    }

    if (status) filters.status = status;

    const [rewards, totalCount] = await Promise.all([
      // Mock rewards data - would be from actual rewards collection
      Promise.resolve([
        {
          _id: 'reward1',
          referralId: 'ref1',
          referrerId: userId,
          rewardType: 'points',
          amount: 100,
          status: 'approved',
          tier: 'silver',
          calculatedAt: new Date(),
          approvedAt: new Date()
        },
        {
          _id: 'reward2',
          referralId: 'ref2',
          referrerId: userId,
          rewardType: 'cash',
          amount: 50,
          currency: 'USD',
          status: 'pending',
          tier: 'bronze',
          calculatedAt: new Date()
        }
      ] as IReferralReward[]),
      Promise.resolve(2)
    ]);

    res.json({
      success: true,
      data: {
        rewards: rewards.slice(Number(offset), Number(offset) + Number(limit)),
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error getting referral rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve referral rewards'
    });
  }
}

/**
 * Process referral reward calculation
 */
export async function processReferralReward(req: Request, res: Response) {
  try {
    const { referralId } = req.params;
    const { actualValue } = req.body;
    const userId = req.user?.id;

    const result = await processReferralRewardCalculation(referralId, actualValue);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Log reward processing
    auditLogger.info('Referral reward processed', {
      userId,
      action: 'PROCESS_REFERRAL_REWARD',
      resource: 'referral_reward',
      resourceId: referralId,
      metadata: { actualValue, rewardAmount: result.rewardAmount }
    });

    res.json({
      success: true,
      message: 'Referral reward processed successfully',
      data: result
    });

  } catch (error) {
    console.error('Error processing referral reward:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process referral reward'
    });
  }
}

/**
 * Get CRM integration status and sync data
 */
export async function getCRMIntegrationStatus(req: Request, res: Response) {
  try {
    const userRole = req.user?.role;

    if (!['admin', 'supervisor'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Mock CRM integration status
    const integrationStatus: ICRMIntegration = {
      provider: 'hubspot',
      config: {
        baseUrl: 'https://api.hubapi.com',
        fieldMappings: {
          'refereeName': 'firstname',
          'refereeEmail': 'email',
          'refereeCompany': 'company',
          'refereePhone': 'phone'
        }
      },
      syncSettings: {
        autoSync: true,
        syncFrequency: 30, // 30 minutes
        lastSync: new Date(Date.now() - 1800000), // 30 minutes ago
        failureCount: 0
      }
    };

    res.json({
      success: true,
      data: { integration: integrationStatus }
    });

  } catch (error) {
    console.error('Error getting CRM integration status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve CRM integration status'
    });
  }
}

// Utility functions

async function generateReferralCode(): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  // Check for uniqueness
  const existingCode = await Referral.findOne({ referralCode: code });
  if (existingCode) {
    return generateReferralCode(); // Recursively generate new code
  }
  
  return code;
}

async function getActiveReferralProgram(): Promise<IReferralProgram | null> {
  // Mock active program - would be from database
  return {
    name: 'Standard Referral Program',
    description: 'Earn rewards for successful referrals',
    isActive: true,
    startDate: new Date('2024-01-01'),
    rewardStructure: [
      {
        tier: 'bronze',
        referralReward: 25,
        conversionReward: 100,
        qualificationCriteria: ['email_verified']
      },
      {
        tier: 'silver',
        referralReward: 50,
        conversionReward: 200,
        qualificationCriteria: ['email_verified', 'phone_verified']
      },
      {
        tier: 'gold',
        referralReward: 100,
        conversionReward: 500,
        qualificationCriteria: ['email_verified', 'phone_verified', 'company_verified']
      }
    ],
    rules: {
      minReferrals: 1,
      minConversionValue: 100,
      cooldownPeriod: 30,
      requiresApproval: false
    },
    targetAudience: ['employee', 'supervisor'],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

async function validateReferralEligibility(
  referrerId: string, 
  referralData: any, 
  program: IReferralProgram
): Promise<{ eligible: boolean; reason?: string }> {
  
  // Check cooldown period
  const cooldownDate = new Date();
  cooldownDate.setDate(cooldownDate.getDate() - program.rules.cooldownPeriod);
  
  const recentReferral = await Referral.findOne({
    referrerId,
    refereeEmail: referralData.refereeEmail,
    createdAt: { $gte: cooldownDate }
  });

  if (recentReferral) {
    return {
      eligible: false,
      reason: `Cooldown period active. Wait ${program.rules.cooldownPeriod} days between referrals.`
    };
  }

  // Check blacklisted domains
  if (program.rules.blacklistDomains) {
    const emailDomain = referralData.refereeEmail.split('@')[1];
    if (program.rules.blacklistDomains.includes(emailDomain)) {
      return {
        eligible: false,
        reason: 'Email domain is not eligible for referrals.'
      };
    }
  }

  return { eligible: true };
}

async function autoAssignReferral(referralId: string): Promise<{ success: boolean; agentId?: string }> {
  // Get available sales agents
  const salesAgents = await User.find({
    role: { $in: ['fieldtech', 'supervisor'] },
    isActive: true,
    'metadata.department': 'sales'
  }).limit(5).lean();

  if (salesAgents.length === 0) {
    return { success: false };
  }

  // Simple round-robin assignment
  const selectedAgent = salesAgents[Math.floor(Math.random() * salesAgents.length)];

  return {
    success: true,
    agentId: selectedAgent._id.toString()
  };
}

async function syncReferralToCRM(referralId: string): Promise<void> {
  // Mock CRM sync - would integrate with actual CRM API
  console.log(`Syncing referral ${referralId} to CRM`);
  
  // Implementation would depend on CRM provider
  // - Salesforce: Use REST API or Bulk API
  // - HubSpot: Use Contacts API
  // - Pipedrive: Use Persons API
  // - Custom: Use webhook or API integration
}

async function sendReferralNotifications(referralId: string, action: string): Promise<void> {
  const referral = await Referral.findById(referralId)
    .populate('referrerId', 'name email')
    .populate('assignedTo', 'name email');

  if (!referral) return;

  // Notify referrer
  await notification.sendNotification({
    userId: referral.referrerId._id.toString(),
    title: `Referral ${action}`,
    message: `Your referral for ${referral.refereeName} has been ${action}`,
    type: 'info',
    priority: 'medium'
  });

  // Notify assigned agent
  if (referral.assignedTo && action === 'submitted') {
    await notification.sendNotification({
      userId: referral.assignedTo._id.toString(),
      title: 'New Referral Assigned',
      message: `A new referral has been assigned to you: ${referral.refereeName}`,
      type: 'info',
      priority: 'high',
      actionUrl: `/dashboard/referrals/${referralId}`
    });
  }
}

async function processReferralRewardCalculation(referralId: string, actualValue?: number): Promise<{
  success: boolean;
  error?: string;
  rewardAmount?: number;
  tier?: string;
}> {
  const referral = await Referral.findById(referralId);
  if (!referral) {
    return { success: false, error: 'Referral not found' };
  }

  const program = await getActiveReferralProgram();
  if (!program) {
    return { success: false, error: 'No active referral program' };
  }

  // Determine tier based on referral criteria
  const tier = 'silver'; // Simplified - would calculate based on actual criteria
  const tierConfig = program.rewardStructure.find(r => r.tier === tier);
  
  if (!tierConfig) {
    return { success: false, error: 'Invalid tier configuration' };
  }

  const rewardAmount = tierConfig.conversionReward;

  // Create reward record (mock implementation)
  console.log(`Creating reward: ${rewardAmount} points for referral ${referralId}`);

  return {
    success: true,
    rewardAmount,
    tier
  };
}

// Export functions
export {
  getReferrals,
  updateReferralStatus,
  getReferralAnalytics,
  getReferralRewards,
  processReferralReward,
  getCRMIntegrationStatus,
  IReferral,
  IReferralReward,
  IReferralProgram,
  ICRMIntegration
};