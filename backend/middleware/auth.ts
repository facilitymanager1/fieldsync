import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extended Request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    name: string;
    role: string;
    mobileNumber?: string;
    roles?: string[];
  };
}

// Middleware to authenticate token
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    req.user = {
      id: decoded.id || decoded.userId,
      username: decoded.username,
      name: decoded.name,
      role: decoded.role,
      mobileNumber: decoded.mobileNumber,
      roles: decoded.roles || [decoded.role]
    };
    
    next();
  });
}

// Middleware to require authentication
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Middleware to require specific role
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (req.user.role !== role && !req.user.roles?.includes(role)) {
      return res.status(403).json({ error: `${role} role required` });
    }
    
    next();
  };
}

// Middleware to require any of the specified roles
export function requireAnyRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const hasRequiredRole = roles.some(role => 
      req.user?.role === role || req.user?.roles?.includes(role)
    );
    
    if (!hasRequiredRole) {
      return res.status(403).json({ error: `One of these roles required: ${roles.join(', ')}` });
    }
    
    next();
  };
}

// Export as default for module imports
export default {
  authenticateToken: authenticateToken,
  requireAuth: requireAuth,
  requireRole: requireRole,
  requireAnyRole: requireAnyRole
};
