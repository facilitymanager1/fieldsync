import { Router } from 'express';
import { startReplacementDuty } from '../modules/replacementDuty';
import { requireAuth, requireRole } from '../modules/authentication';

const router = Router();

// Start replacement duty (Supervisor, Admin, SiteStaff)
router.post('/start', requireAuth, requireRole(['Supervisor', 'Admin', 'SiteStaff']), (req, res) => {
  startReplacementDuty(req.body);
  res.status(200).json({ message: 'Replacement duty started' });
});

export default router;
