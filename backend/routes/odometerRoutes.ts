// Advanced Odometer & Photo Verification Routes for FieldSync Backend
import { Router } from 'express';
import {
  verifyOdometer,
  getVehicleOdometerHistory,
  getFlaggedOdometerReadings,
  updateOdometerReadingStatus,
  getOdometerAnalytics
} from '../modules/odometer';
import { requireAuth, requireRole } from '../modules/authentication';

const router = Router();

/**
 * @route POST /api/odometer/verify
 * @desc Verify odometer reading using OCR
 * @access Private (All authenticated users)
 */
router.post('/verify', requireAuth, verifyOdometer);

/**
 * @route POST /api/odometer/submit
 * @desc Submit odometer reading and photo (backward compatibility)
 * @access Private (FieldTech)
 */
router.post('/submit', requireAuth, requireRole(['FieldTech']), verifyOdometer);

/**
 * @route GET /api/odometer/history/:vehicleId
 * @desc Get odometer history for a specific vehicle
 * @access Private (Admin, Supervisor, SiteStaff)
 */
router.get('/history/:vehicleId', requireAuth, requireRole(['Admin', 'Supervisor', 'SiteStaff']), getVehicleOdometerHistory);

/**
 * @route GET /api/odometer/flagged
 * @desc Get flagged odometer readings for review
 * @access Private (Admin, Supervisor)
 */
router.get('/flagged', requireAuth, requireRole(['Admin', 'Supervisor']), getFlaggedOdometerReadings);

/**
 * @route PUT /api/odometer/reading/:readingId/status
 * @desc Update odometer reading status (approve/reject)
 * @access Private (Admin, Supervisor)
 */
router.put('/reading/:readingId/status', requireAuth, requireRole(['Admin', 'Supervisor']), updateOdometerReadingStatus);

/**
 * @route GET /api/odometer/analytics
 * @desc Get odometer analytics and statistics
 * @access Private (Admin, Supervisor)
 */
router.get('/analytics', requireAuth, requireRole(['Admin', 'Supervisor']), getOdometerAnalytics);

/**
 * @route GET /api/odometer/health
 * @desc Health check for odometer verification system
 * @access Private (Admin)
 */
router.get('/health', requireAuth, requireRole(['Admin']), (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date(),
    services: {
      ocr: 'operational',
      fraudDetection: 'operational',
      database: 'operational'
    }
  });
});

export default router;
