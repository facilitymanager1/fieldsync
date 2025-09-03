/**
 * Onboarding Routes - API endpoints for employee onboarding workflow
 * 
 * Features:
 * - Initiate new onboarding process
 * - Update onboarding steps
 * - Get onboarding status and progress
 * - Document upload and management
 * - Biometric enrollment endpoints
 * - Statutory verification status
 * - Admin management interfaces
 */

import express, { Response } from 'express';
import { Types } from 'mongoose';
import OnboardingEngineService, { OnboardingStep } from '../../modules/onboarding/onboardingEngine';
import { OnboardingRecord, OnboardingStatus } from '../../models/onboarding/onboardingRecord';
import { StatutoryVerification, StatutoryType } from '../../models/onboarding/statutoryVerification';
import { authenticateToken, requireRole, requireAnyRole, AuthenticatedRequest } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { AuditLogger } from '../../middleware/auditLogger';

// Create an audit logger instance
const auditLogger = new AuditLogger();
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const onboardingService = new OnboardingEngineService();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/onboarding');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, PDF, DOC, and DOCX files are allowed.'));
    }
  }
});

/**
 * @route POST /api/onboarding/initiate
 * @desc Initiate new employee onboarding process
 * @access HR, Admin
 */
router.post('/initiate', 
  authenticateToken,
  requireAnyRole(['hr', 'admin', 'manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        personalInfo,
        employmentDetails
      } = req.body;

      // Validate required fields
      if (!personalInfo?.aadhaarNumber || !personalInfo?.panNumber || !personalInfo?.mobileNumber) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar number, PAN number, and mobile number are required'
        });
      }

      if (!employmentDetails?.designationId || !employmentDetails?.departmentId || !employmentDetails?.locationId) {
        return res.status(400).json({
          success: false,
          message: 'Designation, department, and location are required'
        });
      }

      // Convert string IDs to ObjectIds
      employmentDetails.designationId = new Types.ObjectId(employmentDetails.designationId);
      employmentDetails.departmentId = new Types.ObjectId(employmentDetails.departmentId);
      employmentDetails.locationId = new Types.ObjectId(employmentDetails.locationId);
      if (employmentDetails.reportingManagerId) {
        employmentDetails.reportingManagerId = new Types.ObjectId(employmentDetails.reportingManagerId);
      }

      const onboardingData = {
        personalInfo: {
          ...personalInfo,
          dateOfBirth: new Date(personalInfo.dateOfBirth)
        },
        employmentDetails: {
          ...employmentDetails,
          dateOfJoining: new Date(employmentDetails.dateOfJoining)
        },
        initiatedBy: new Types.ObjectId(req.user?.id),
        source: 'web' as const,
        deviceInfo: req.get('User-Agent') || 'Unknown',
        ipAddress: req.ip || req.connection.remoteAddress || 'Unknown'
      };

      const onboardingRecord = await onboardingService.initiateOnboarding(onboardingData);

      res.status(201).json({
        success: true,
        message: 'Onboarding process initiated successfully',
        data: {
          onboardingId: onboardingRecord.onboardingId,
          status: onboardingRecord.overallStatus,
          currentStep: onboardingRecord.currentStep,
          employeeDetails: {
            name: onboardingRecord.personalInfo.aadhaarName,
            mobileNumber: onboardingRecord.personalInfo.mobileNumber,
            designation: onboardingRecord.employmentDetails.designationId,
            location: onboardingRecord.employmentDetails.locationId
          }
        }
      });
    } catch (error) {
      console.error('Error initiating onboarding:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to initiate onboarding process'
      });
    }
  }
);

/**
 * @route PUT /api/onboarding/:onboardingId/step/:stepName
 * @desc Update specific onboarding step
 * @access HR, Admin, Employee (own record)
 */
router.put('/:onboardingId/step/:stepName',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { onboardingId, stepName } = req.params;
      const stepData = req.body;
      const updatedBy = new Types.ObjectId(req.user?.id);

      // Validate step name
      if (!Object.values(OnboardingStep).includes(stepName as OnboardingStep)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid step name'
        });
      }

      // Check if user has permission to update this record
      const onboardingRecord = await OnboardingRecord.findOne({ onboardingId });
      if (!onboardingRecord) {
        return res.status(404).json({
          success: false,
          message: 'Onboarding record not found'
        });
      }

      // Permission check (simplified - can be enhanced based on requirements)
      const userRoles = req.user?.roles || [];
      const isHROrAdmin = userRoles.includes('hr') || userRoles.includes('admin');
      const isOwnRecord = onboardingRecord.personalInfo.mobileNumber === req.user?.mobileNumber;

      if (!isHROrAdmin && !isOwnRecord) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update this onboarding record'
        });
      }

      const validationResult = await onboardingService.updateStep(
        onboardingId,
        stepName as OnboardingStep,
        stepData,
        updatedBy
      );

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });
      }

      res.json({
        success: true,
        message: 'Step updated successfully',
        data: {
          currentStep: stepName,
          nextStep: validationResult.nextStep,
          completionPercentage: validationResult.completionPercentage,
          warnings: validationResult.warnings
        }
      });
    } catch (error) {
      console.error('Error updating onboarding step:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update onboarding step'
      });
    }
  }
);

/**
 * @route GET /api/onboarding/:onboardingId/status
 * @desc Get onboarding status and progress
 * @access HR, Admin, Employee (own record)
 */
router.get('/:onboardingId/status',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { onboardingId } = req.params;

      const statusInfo = await onboardingService.getOnboardingStatus(onboardingId);

      // Permission check
      const userRoles = req.user?.roles || [];
      const isHROrAdmin = userRoles.includes('hr') || userRoles.includes('admin');
      const isOwnRecord = statusInfo.record.personalInfo.mobileNumber === req.user?.mobileNumber;

      if (!isHROrAdmin && !isOwnRecord) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to view this onboarding record'
        });
      }

      // Sanitize sensitive data for non-HR/Admin users
      let sanitizedRecord = statusInfo.record;
      if (!isHROrAdmin) {
        sanitizedRecord = {
          ...statusInfo.record,
          personalInfo: {
            ...statusInfo.record.personalInfo,
            aadhaarNumber: '****-****-' + statusInfo.record.personalInfo.aadhaarNumber.slice(-4),
            panNumber: '****' + statusInfo.record.personalInfo.panNumber.slice(-6)
          }
        };
      }

      res.json({
        success: true,
        data: {
          onboardingId: statusInfo.record.onboardingId,
          status: statusInfo.record.overallStatus,
          progress: statusInfo.progress,
          personalInfo: sanitizedRecord.personalInfo,
          employmentDetails: statusInfo.record.employmentDetails,
          workflowSteps: statusInfo.record.workflowSteps,
          validationErrors: statusInfo.validationErrors,
          warnings: statusInfo.warnings,
          timestamps: {
            initiatedAt: statusInfo.record.initiatedAt,
            completedAt: statusInfo.record.completedAt,
            lastUpdatedAt: statusInfo.record.lastUpdatedAt
          }
        }
      });
    } catch (error) {
      console.error('Error getting onboarding status:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get onboarding status'
      });
    }
  }
);

/**
 * @route POST /api/onboarding/:onboardingId/documents/upload
 * @desc Upload documents for onboarding
 * @access HR, Admin, Employee (own record)
 */
router.post('/:onboardingId/documents/upload',
  authenticateToken,
  upload.array('documents', 10), // Max 10 files
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { onboardingId } = req.params;
      const files = req.files as Express.Multer.File[];
      const { documentTypes } = req.body; // Array of document types corresponding to files

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      // Find onboarding record
      const onboardingRecord = await OnboardingRecord.findOne({ onboardingId });
      if (!onboardingRecord) {
        return res.status(404).json({
          success: false,
          message: 'Onboarding record not found'
        });
      }

      // Permission check
      const userRoles = req.user?.roles || [];
      const isHROrAdmin = userRoles.includes('hr') || userRoles.includes('admin');
      const isOwnRecord = onboardingRecord.personalInfo.mobileNumber === req.user?.mobileNumber;

      if (!isHROrAdmin && !isOwnRecord) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to upload documents for this record'
        });
      }

      // Process uploaded files
      const documentReferences = files.map((file, index) => ({
        documentType: documentTypes?.[index] || 'unknown',
        fileName: file.originalname,
        fileUrl: file.path,
        uploadedAt: new Date(),
        verificationStatus: 'pending',
        fileHash: 'placeholder-hash', // TODO: Generate actual hash
      }));

      // Update onboarding record with document references
      onboardingRecord.documents.push(...documentReferences);
      await onboardingRecord.save();

      res.json({
        success: true,
        message: 'Documents uploaded successfully',
        data: {
          uploadedDocuments: documentReferences.map(doc => ({
            documentType: doc.documentType,
            fileName: doc.fileName,
            uploadedAt: doc.uploadedAt,
            verificationStatus: doc.verificationStatus
          }))
        }
      });
    } catch (error) {
      console.error('Error uploading documents:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload documents'
      });
    }
  }
);

/**
 * @route GET /api/onboarding/list
 * @desc Get list of onboarding records with filtering and pagination
 * @access HR, Admin
 */
router.get('/list',
  authenticateToken,
  requireAnyRole(['hr', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        status,
        location,
        department,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20,
        sortBy = 'initiatedAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter query
      const filter: any = {};
      
      if (status) {
        filter.overallStatus = status;
      }
      
      if (location) {
        filter['employmentDetails.locationId'] = new Types.ObjectId(location as string);
      }
      
      if (department) {
        filter['employmentDetails.departmentId'] = new Types.ObjectId(department as string);
      }
      
      if (dateFrom || dateTo) {
        filter.initiatedAt = {};
        if (dateFrom) filter.initiatedAt.$gte = new Date(dateFrom as string);
        if (dateTo) filter.initiatedAt.$lte = new Date(dateTo as string);
      }

      // Calculate pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Execute query
      const [records, totalCount] = await Promise.all([
        OnboardingRecord.find(filter)
          .populate('employmentDetails.designationId', 'title')
          .populate('employmentDetails.departmentId', 'name')
          .populate('employmentDetails.locationId', 'name address')
          .populate('lastUpdatedBy', 'name email')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        OnboardingRecord.countDocuments(filter)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.json({
        success: true,
        data: {
          records: records.map((record: any) => ({
            onboardingId: record.onboardingId,
            employeeId: record.employeeId,
            personalInfo: {
              name: record.personalInfo.aadhaarName,
              mobileNumber: record.personalInfo.mobileNumber,
              dateOfBirth: record.personalInfo.dateOfBirth
            },
            employmentDetails: record.employmentDetails,
            status: record.overallStatus,
            currentStep: record.currentStep,
            completionPercentage: Math.round(
              (record.workflowSteps.filter((step: any) => step.stepStatus === 'verified').length / 
               record.workflowSteps.length) * 100
            ),
            timestamps: {
              initiatedAt: record.initiatedAt,
              completedAt: record.completedAt,
              lastUpdatedAt: record.lastUpdatedAt
            },
            lastUpdatedBy: record.lastUpdatedBy
          })),
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalRecords: totalCount,
            hasNextPage,
            hasPrevPage,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      console.error('Error getting onboarding list:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get onboarding list'
      });
    }
  }
);

/**
 * @route POST /api/onboarding/:onboardingId/retry
 * @desc Retry failed onboarding steps
 * @access HR, Admin
 */
router.post('/:onboardingId/retry',
  authenticateToken,
  requireAnyRole(['hr', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { onboardingId } = req.params;
      const retryBy = new Types.ObjectId(req.user?.id);

      const success = await onboardingService.retryFailedSteps(onboardingId, retryBy);

      if (success) {
        res.json({
          success: true,
          message: 'Failed steps scheduled for retry successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'No failed steps found or retry not possible'
        });
      }
    } catch (error) {
      console.error('Error retrying failed steps:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retry onboarding steps'
      });
    }
  }
);

/**
 * @route GET /api/onboarding/analytics/dashboard
 * @desc Get onboarding analytics for dashboard
 * @access HR, Admin
 */
router.get('/analytics/dashboard',
  authenticateToken,
  requireAnyRole(['hr', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { period = '30d' } = req.query;
      
      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      // Get analytics data
      const [
        totalCount,
        completedCount,
        pendingCount,
        failedCount,
        statusDistribution,
        stepDistribution,
        dailyInitiations
      ] = await Promise.all([
        OnboardingRecord.countDocuments({
          initiatedAt: { $gte: startDate, $lte: endDate }
        }),
        OnboardingRecord.countDocuments({
          overallStatus: OnboardingStatus.COMPLETED,
          initiatedAt: { $gte: startDate, $lte: endDate }
        }),
        OnboardingRecord.countDocuments({
          overallStatus: { $in: [
            OnboardingStatus.INITIATED,
            OnboardingStatus.PERSONAL_INFO_COLLECTED,
            OnboardingStatus.DOCUMENTS_UPLOADED,
            OnboardingStatus.BIOMETRIC_ENROLLED,
            OnboardingStatus.STATUTORY_VERIFICATION_PENDING,
            OnboardingStatus.CONSENT_CAPTURED
          ]},
          initiatedAt: { $gte: startDate, $lte: endDate }
        }),
        OnboardingRecord.countDocuments({
          overallStatus: { $in: [OnboardingStatus.FAILED, OnboardingStatus.REJECTED] },
          initiatedAt: { $gte: startDate, $lte: endDate }
        }),
        OnboardingRecord.aggregate([
          { $match: { initiatedAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$overallStatus', count: { $sum: 1 } } }
        ]),
        OnboardingRecord.aggregate([
          { $match: { initiatedAt: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$currentStep', count: { $sum: 1 } } }
        ]),
        OnboardingRecord.aggregate([
          { $match: { initiatedAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$initiatedAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ])
      ]);

      // Calculate completion rate
      const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      res.json({
        success: true,
        data: {
          summary: {
            totalOnboarding: totalCount,
            completed: completedCount,
            pending: pendingCount,
            failed: failedCount,
            completionRate
          },
          distributions: {
            status: statusDistribution,
            currentStep: stepDistribution
          },
          trends: {
            dailyInitiations
          }
        }
      });
    } catch (error) {
      console.error('Error getting onboarding analytics:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get onboarding analytics'
      });
    }
  }
);

/**
 * @route GET /api/onboarding/statutory/:onboardingId
 * @desc Get statutory verification status for onboarding
 * @access HR, Admin
 */
router.get('/statutory/:onboardingId',
  authenticateToken,
  requireAnyRole(['hr', 'admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { onboardingId } = req.params;

      // Find onboarding record
      const onboardingRecord = await OnboardingRecord.findOne({ onboardingId });
      if (!onboardingRecord) {
        return res.status(404).json({
          success: false,
          message: 'Onboarding record not found'
        });
      }

      // Get statutory verification records
      const statutoryVerifications = await StatutoryVerification.find({
        onboardingRecordId: onboardingRecord._id
      }).populate('createdBy', 'name email');

      res.json({
        success: true,
        data: {
          onboardingId,
          statutoryVerifications: statutoryVerifications.map((verification: any) => ({
            verificationId: verification.verificationId,
            statutoryType: verification.statutoryType,
            verificationStatus: verification.verificationStatus,
            verificationResult: verification.verificationResult,
            apiCost: verification.totalApiCost,
            retryConfig: verification.retryConfig,
            manualIntervention: verification.manualIntervention,
            timestamps: {
              initiatedAt: verification.initiatedAt,
              verifiedAt: verification.verifiedAt,
              lastAttemptAt: verification.lastAttemptAt
            }
          }))
        }
      });
    } catch (error) {
      console.error('Error getting statutory verification status:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get statutory verification status'
      });
    }
  }
);

export default router;
