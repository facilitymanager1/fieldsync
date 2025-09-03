// Express routes for audit log endpoints
import express from 'express';
import { getAuditLogs } from '../modules/auditLog';
import { requireAuth, requireRole } from '../middleware/auth';

const router = express.Router();

// GET /api/backend/audit-logs
router.get('/', requireAuth, requireRole(['admin', 'manager']), (req, res) => {
  const logs = getAuditLogs(req.query || {});
  res.json({ logs });
});

export default router;
