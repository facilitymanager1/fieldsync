import { Router } from 'express';
import { syncData, getSyncStatus, syncPayload } from '../modules/sync';
import { requireAuth, requireRole } from '../modules/authentication';

const router = Router();

// Sync data (all authenticated roles)
router.post('/', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), syncData);

// Get sync status (all authenticated roles)
router.get('/status', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), getSyncStatus);

// Sync payload (all authenticated roles)
router.post('/push', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), (req, res) => {
  syncPayload(req.body);
  res.status(200).json({ message: 'Sync payload received' });
});

export default router;
