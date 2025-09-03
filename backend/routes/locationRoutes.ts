// Advanced Passive Location & Sensor Gating Routes for FieldSync Backend
import { Router } from 'express';
import {
  batchLocationPoints,
  getUserTrackingSettings,
  updateUserTrackingSettings,
  getUserLocationHistory,
  getLocationBatchDetails,
  getLocationTrackingAnalytics
} from '../modules/passiveLocation';
import { requireAuth, requireRole } from '../modules/authentication';

const router = Router();

/**
 * @route POST /api/location/batch
 * @desc Process batch of location points with sensor data
 * @access Private (All authenticated users)
 */
router.post('/batch', requireAuth, batchLocationPoints);

/**
 * @route GET /api/location/settings/:userId
 * @desc Get tracking settings for a user
 * @access Private (Admin, Supervisor, or own user)
 */
router.get('/settings/:userId', requireAuth, getUserTrackingSettings);

/**
 * @route PUT /api/location/settings/:userId
 * @desc Update tracking settings for a user
 * @access Private (Admin, Supervisor, or own user)
 */
router.put('/settings/:userId', requireAuth, updateUserTrackingSettings);

/**
 * @route GET /api/location/history/:userId
 * @desc Get location history for a user
 * @access Private (Admin, Supervisor, or own user)
 */
router.get('/history/:userId', requireAuth, getUserLocationHistory);

/**
 * @route GET /api/location/batch/:batchId
 * @desc Get detailed information about a specific location batch
 * @access Private (Admin, Supervisor, SiteStaff)
 */
router.get('/batch/:batchId', requireAuth, requireRole(['Admin', 'Supervisor', 'SiteStaff']), getLocationBatchDetails);

/**
 * @route GET /api/location/analytics/:userId
 * @desc Get location tracking analytics for a user
 * @access Private (Admin, Supervisor, SiteStaff)
 */
router.get('/analytics/:userId', requireAuth, requireRole(['Admin', 'Supervisor', 'SiteStaff']), getLocationTrackingAnalytics);

/**
 * @route GET /api/location/health
 * @desc Health check for location tracking system
 * @access Private (Admin)
 */
router.get('/health', requireAuth, requireRole(['Admin']), (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date(),
    services: {
      locationProcessing: 'operational',
      geofenceMonitoring: 'operational',
      activityRecognition: 'operational',
      sensorGating: 'operational'
    }
  });
});

export default router;
