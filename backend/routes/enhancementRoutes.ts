// Advanced Enhancements & Future Roadmap Routes
import { Router } from 'express';
import { getEnhancements, createEnhancement, updateEnhancement, deleteEnhancement } from '../modules/enhancement';
import { requireAuth, requireRole } from '../modules/authentication';

const router = Router();

// Get all enhancements (Admin, Supervisor)
router.get('/', requireAuth, requireRole(['Admin', 'Supervisor']), getEnhancements);

// Create enhancement (Admin)
router.post('/', requireAuth, requireRole(['Admin']), createEnhancement);

// Update enhancement (Admin)
router.put('/:id', requireAuth, requireRole(['Admin']), updateEnhancement);

// Delete enhancement (Admin)
router.delete('/:id', requireAuth, requireRole(['Admin']), deleteEnhancement);

export default router;
