
import express from 'express';
import { startShift, endShift, recordVisit, getShifts } from '../modules/shiftStateMachine';
import { requireAuth, requireRole } from '../modules/authentication';

const router = express.Router();

// POST /shift/start (FieldTech, SiteStaff)
router.post('/start', requireAuth, requireRole(['FieldTech', 'SiteStaff']), startShift);

// POST /shift/end (FieldTech, SiteStaff)
router.post('/end', requireAuth, requireRole(['FieldTech', 'SiteStaff']), endShift);

// POST /shift/visit (FieldTech, SiteStaff)
router.post('/visit', requireAuth, requireRole(['FieldTech', 'SiteStaff']), recordVisit);

// GET /shift (all authenticated roles)
router.get('/', requireAuth, requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), getShifts);

export default router;
