/**
 * GraphQL Context
 * Provides request context including user authentication and request data
 */

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';

export interface Context {
  user?: any;
  req: any;
  res: any;
  dataSources?: any;
}

const UserModel = mongoose.model('User');

export async function createContext({ req, res }: { req: any; res: any }): Promise<Context> {
  const context: Context = { req, res };

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      // Verify JWT token
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      
      // Fetch user from database
      const user = await UserModel.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        context.user = user;
      }
    } catch (error) {
      // Token is invalid, but don't throw error here
      // Let individual resolvers handle authentication requirements
      console.warn('Invalid token in GraphQL request:', error);
    }
  }

  return context;
}

export function requireAuth(context: Context): void {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: {
        code: 'UNAUTHENTICATED',
      },
    });
  }
}

export function requireRole(context: Context, roles: string[]): void {
  requireAuth(context);
  
  if (!roles.includes(context.user.role)) {
    throw new GraphQLError('Insufficient permissions', {
      extensions: {
        code: 'FORBIDDEN',
      },
    });
  }
}