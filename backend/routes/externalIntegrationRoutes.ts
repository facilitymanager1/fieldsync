// Express routes for external system integration
import express from 'express';
import { syncWithHRSystem, syncWithPayrollSystem } from '../modules/externalIntegration';
import { requireAuth, requireRole } from '../middleware/auth';

const router = express.Router();

// POST /api/backend/integrate/hr
router.post('/hr', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  const result = await syncWithHRSystem(req.body);
  res.json(result);
});

// POST /api/backend/integrate/payroll
router.post('/payroll', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  const result = await syncWithPayrollSystem(req.body);
  res.json(result);
});

export default router;
