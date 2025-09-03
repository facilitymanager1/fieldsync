/**
 * Centralized Error Handling Middleware
 * Ensures consistent error responses across all API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { StandardAPIResponse, createErrorResponse } from '../types/apiResponse';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
export const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND', 
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Error handler middleware
export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let code = error.code || ErrorTypes.INTERNAL_ERROR;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = ErrorTypes.VALIDATION_ERROR;
    message = 'Validation failed';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = ErrorTypes.VALIDATION_ERROR;
    message = 'Invalid data format';
  } else if (error.name === 'MongoError' && (error as any).code === 11000) {
    statusCode = 409;
    code = ErrorTypes.CONFLICT;
    message = 'Resource already exists';
  }

  // Log error for monitoring
  console.error(`[${code}] ${message}:`, {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    user: (req as any).user?.id,
  });

  // Send standardized error response
  const response: StandardAPIResponse = createErrorResponse(
    message,
    `Request failed with code: ${code}`
  );

  res.status(statusCode).json(response);
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Common error creators
export const createValidationError = (message: string) => 
  new CustomError(message, 400, ErrorTypes.VALIDATION_ERROR);

export const createNotFoundError = (resource: string) => 
  new CustomError(`${resource} not found`, 404, ErrorTypes.NOT_FOUND);

export const createUnauthorizedError = (message = 'Unauthorized') => 
  new CustomError(message, 401, ErrorTypes.UNAUTHORIZED);

export const createForbiddenError = (message = 'Forbidden') => 
  new CustomError(message, 403, ErrorTypes.FORBIDDEN);