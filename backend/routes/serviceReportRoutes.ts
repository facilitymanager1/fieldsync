import { Router } from 'express';
import { submitServiceReport, getServiceReports } from '../modules/serviceReporting';
import { requireAuth, requireRole } from '../modules/authentication';

const router = Router();

// List all service reports (all authenticated roles)
router.get('/', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), getServiceReports);

// Submit service report (FieldTech, SiteStaff)
router.post('/submit', requireAuth, requireRole(['FieldTech', 'SiteStaff']), (req, res) => {
  submitServiceReport(req.body);
  res.status(200).json({ message: 'Service report submitted' });
});

export default router;
