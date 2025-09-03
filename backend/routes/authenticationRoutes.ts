import { Router, Response, Request } from 'express';
import { AuthenticatedRequest } from '../types/standardInterfaces';

import { 
  login, 
  register, 
  requireAuth, 
  requireRole, 
  getCurrentUser, 
  updateProfile, 
  changePassword 
} from '../modules/authentication';

const router = Router();

// Public endpoints
router.post('/register', register);
router.post('/login', login);

// Protected endpoints
router.get('/me', requireAuth, getCurrentUser);
router.put('/profile', requireAuth, updateProfile);
router.put('/change-password', requireAuth, changePassword);

// Role-based access examples
router.get('/admin', requireAuth, requireRole(['Admin']), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  res.json({ message: 'Admin access granted', user: authReq.user.name });
});

router.get('/supervisor', requireAuth, requireRole(['Admin', 'Supervisor']), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  res.json({ message: 'Supervisor access granted', user: authReq.user.name });
});

router.get('/field', requireAuth, requireRole(['Admin', 'Supervisor', 'FieldTech']), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  res.json({ message: 'Field access granted', user: authReq.user.name });
});

export default router;
