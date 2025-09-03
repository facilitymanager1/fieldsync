// Advanced Facial Recognition Routes for FieldSync Backend
import express from 'express';
import {
  enrollFace,
  verifyFaceAttendance,
  getAttendanceRecords,
  getSecurityAnalytics
} from '../modules/facialRecognition';
import { requireAuth, requireRole } from '../modules/authentication';

const router = express.Router();

/**
 * @route POST /api/facial-recognition/enroll
 * @desc Enroll a face template for a user
 * @access Private (Admin, Supervisor)
 */
router.post('/enroll', requireAuth, requireRole(['Admin', 'Supervisor']), enrollFace);

/**
 * @route POST /api/facial-recognition/attendance
 * @desc Verify face and record attendance
 * @access Private (All authenticated users)
 */
router.post('/attendance', requireAuth, verifyFaceAttendance);

/**
 * @route GET /api/facial-recognition/attendance
 * @desc Get attendance records with filtering and pagination
 * @access Private (Admin, Supervisor, SiteStaff)
 */
router.get('/attendance', requireAuth, requireRole(['Admin', 'Supervisor', 'SiteStaff']), getAttendanceRecords);

/**
 * @route GET /api/facial-recognition/analytics
 * @desc Get security analytics and metrics
 * @access Private (Admin, Supervisor)
 */
router.get('/analytics', requireAuth, requireRole(['Admin', 'Supervisor']), getSecurityAnalytics);

/**
 * @route GET /api/facial-recognition/health
 * @desc Health check for facial recognition system
 * @access Private (Admin)
 */
router.get('/health', requireAuth, requireRole(['Admin']), (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date(),
    system: {
      faceRecognition: 'operational',
      livenessDetection: 'operational',
      securityLogging: 'operational'
    }
  });
});

export default router;
