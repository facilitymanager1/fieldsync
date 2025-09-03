// Leave Management Routes
import express from 'express';
import { requestLeave, approveLeave, getLeaves } from '../modules/leave';
import { requireAuth, requireRole } from '../modules/authentication';

const router = express.Router();

// POST /leave/apply (FieldTech, SiteStaff)
router.post('/apply', requireAuth, requireRole(['FieldTech', 'SiteStaff']), requestLeave);

// POST /leave/approve (Supervisor, Admin)
router.post('/approve', requireAuth, requireRole(['Supervisor', 'Admin']), approveLeave);

// GET /leave (all authenticated roles)
router.get('/', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), getLeaves);

export default router;
