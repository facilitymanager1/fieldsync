import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extended Request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    name: string;
    role: string;
    email?: string;
    mobileNumber?: string;
    roles?: string[];
  };
}

// Mock JWT secret - replace with environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to authenticate tokens
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // For development, we'll use a mock user
    // In production, verify the actual JWT token
    req.user = {
      id: '1',
      username: 'admin',
      name: 'Admin User',
      role: 'Admin',
      email: 'admin@company.com',
      mobileNumber: '+1234567890',
      roles: ['Admin', 'Manager']
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Middleware to require authentication
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return authenticateToken(req, res, next);
}

// Middleware to require specific roles
export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const userRoles = req.user.roles || [req.user.role];
    const hasRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

export { requireAuth as default };
