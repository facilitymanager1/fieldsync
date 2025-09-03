import { Router } from 'express';
import { storeEncryptedData } from '../modules/storage';
import { requireAuth, requireRole } from '../modules/authentication';

const router = Router();

// Store encrypted data (all authenticated roles)
router.post('/store', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), (req, res) => {
  storeEncryptedData(req.body);
  res.status(200).json({ message: 'Data stored' });
});

export default router;
