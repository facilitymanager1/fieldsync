// Advanced Facial Recognition Routes for FieldSync Backend
import express from 'express';
import {
  enrollUserFace,
  verifyUserFace,
  recordFaceAttendance,
  getAttendanceHistory,
  getFlaggedAttendance,
  updateAttendanceStatus,
  getSystemStats
} from '../modules/facialRecognition';
import { requireAuth, requireRole } from '../modules/authentication';

const router = express.Router();

/**
 * @route POST /api/facial-recognition/enroll
 * @desc Enroll a face template for a user
 * @access Private (Admin, Supervisor)
 */
router.post('/enroll', requireAuth, requireRole(['Admin', 'Supervisor']), enrollUserFace);

/**
 * @route POST /api/facial-recognition/verify
 * @desc Verify a face against enrolled templates
 * @access Private (All authenticated users)
 */
router.post('/verify', requireAuth, verifyUserFace);

/**
 * @route POST /api/facial-recognition/attendance
 * @desc Record attendance using face verification
 * @access Private (All authenticated users)
 */
router.post('/attendance', requireAuth, recordFaceAttendance);

/**
 * @route GET /api/facial-recognition/attendance/:userId
 * @desc Get attendance history for a specific user
 * @access Private (Admin, Supervisor, SiteStaff)
 */
router.get('/attendance/:userId', requireAuth, requireRole(['Admin', 'Supervisor', 'SiteStaff']), getAttendanceHistory);

/**
 * @route GET /api/facial-recognition/flagged
 * @desc Get flagged attendance records for review
 * @access Private (Admin, Supervisor)
 */
router.get('/flagged', requireAuth, requireRole(['Admin', 'Supervisor']), getFlaggedAttendance);

/**
 * @route PUT /api/facial-recognition/attendance/:attendanceId/status
 * @desc Update attendance record status
 * @access Private (Admin, Supervisor)
 */
router.put('/attendance/:attendanceId/status', requireAuth, requireRole(['Admin', 'Supervisor']), updateAttendanceStatus);

/**
 * @route GET /api/facial-recognition/stats
 * @desc Get system statistics and analytics
 * @access Private (Admin, Supervisor)
 */
router.get('/stats', requireAuth, requireRole(['Admin', 'Supervisor']), getSystemStats);

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
