/**
 * Passive Location Tracking Routes
 * RESTful API endpoints for location batching and tracking
 */

import express from 'express';
import {
  batchLocationPoints,
  getUserTrackingSettings,
  updateUserTrackingSettings,
  getUserLocationHistory,
  getLocationBatchDetails,
  getLocationTrackingAnalytics
} from '../modules/passiveLocation';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Location Batch Processing Routes
router.post('/batch', batchLocationPoints);
router.get('/batch/:batchId', getLocationBatchDetails);

// User Tracking Settings Routes
router.get('/users/:userId/settings', getUserTrackingSettings);
router.put('/users/:userId/settings', updateUserTrackingSettings);

// Location History and Analytics Routes
router.get('/users/:userId/history', getUserLocationHistory);
router.get('/users/:userId/analytics', getLocationTrackingAnalytics);

export default router;
