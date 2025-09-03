/**
 * Express type extensions for the application
 * Extends the Request interface to include user authentication data
 */

import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface User {
      id: string;
      role: 'admin' | 'hr' | 'field_officer' | 'user';
      name: string;
      email: string;
      permissions?: string[];
    }

    interface Request {
      user?: User;
    }
  }
}

export {};