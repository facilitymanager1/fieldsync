import { Router } from 'express';
import { getFeatureFlag, getFeatureFlags, setFeatureFlag } from '../modules/featureFlags';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Get all feature flags (Admin)
router.get('/', requireAuth, requireRole(['Admin']), getFeatureFlags);

// Set feature flag (Admin)
router.post('/', requireAuth, requireRole(['Admin']), setFeatureFlag);

export default router;
