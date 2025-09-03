import express from 'express';
import { getStaff } from '../modules/staff';
import { requireAuth, requireRole } from '../modules/authentication';

const router = express.Router();

// GET /staff - List all staff (Admin, Supervisor only)
router.get('/', requireAuth, requireRole(['Admin', 'Supervisor']), getStaff);

export default router;
