import express from 'express';
import { 
  createTicket, 
  getTickets, 
  getTicketById, 
  updateTicket, 
  deleteTicket, 
  updateTicketStatus, 
  assignTicket, 
  addComment, 
  getTicketStats 
} from '../modules/ticket';
import { requireAuth, requireRole } from '../modules/authentication';

const router = express.Router();

// All ticket routes require authentication
router.use(requireAuth);

// Enhanced CRUD operations
router.get('/', requireRole(['FieldTech', 'Supervisor', 'Admin', 'SiteStaff', 'Client']), getTickets);
router.post('/', requireRole(['FieldTech', 'SiteStaff', 'Supervisor', 'Admin']), createTicket);
router.get('/stats', requireRole(['Supervisor', 'Admin']), getTicketStats);
router.get('/:id', getTicketById);
router.put('/:id', updateTicket);
router.delete('/:id', requireRole(['Admin', 'Supervisor']), deleteTicket);

// Status and assignment operations
router.put('/:id/status', requireRole(['Supervisor', 'Admin']), updateTicketStatus);
router.put('/:id/assign', requireRole(['Supervisor', 'Admin']), assignTicket);
router.post('/:id/comments', addComment);

// Legacy compatibility endpoints
router.post('/create', requireRole(['FieldTech', 'SiteStaff', 'Supervisor', 'Admin']), createTicket);
router.post('/status', requireRole(['Supervisor', 'Admin']), updateTicketStatus);
router.post('/assign', requireRole(['Supervisor', 'Admin']), assignTicket);

export default router;
