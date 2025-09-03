// Standardized Error Handling Utility for FieldSync Backend
// Provides consistent error types and handling across all modules

export interface ApiError {
  success: false;
  message: string;
  error: string;
  code?: string;
  details?: any;
  timestamp: Date;
  requestId?: string;
}

export interface ApiSuccess<T = any> {
  success: true;
  message?: string;
  data: T;
  timestamp?: Date;
  requestId?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

/**
 * Standard error types for the application
 */
export enum ErrorCodes {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Resource Management
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  
  // Business Logic
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // System
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  public readonly code: ErrorCodes;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(
    message: string, 
    code: ErrorCodes = ErrorCodes.INTERNAL_SERVER_ERROR, 
    statusCode: number = 500, 
    details?: any
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }
}

/**
 * Formats error for API response
 */
export function formatError(error: unknown, requestId?: string): ApiError {
  const timestamp = new Date();
  
  if (error instanceof AppError) {
    return {
      success: false,
      message: error.message,
      error: error.message,
      code: error.code,
      details: error.details,
      timestamp,
      requestId
    };
  }
  
  if (error instanceof Error) {
    return {
      success: false,
      message: 'An error occurred',
      error: error.message,
      timestamp,
      requestId
    };
  }
  
  if (typeof error === 'string') {
    return {
      success: false,
      message: 'An error occurred',
      error: error,
      timestamp,
      requestId
    };
  }
  
  return {
    success: false,
    message: 'An unexpected error occurred',
    error: 'Unknown error',
    timestamp,
    requestId
  };
}

/**
 * Formats success response
 */
export function formatSuccess<T>(
  data: T, 
  message?: string, 
  requestId?: string,
  pagination?: ApiSuccess<T>['pagination']
): ApiSuccess<T> {
  return {
    success: true,
    message,
    data,
    timestamp: new Date(),
    requestId,
    pagination
  };
}

/**
 * Express middleware for error handling
 */
export function errorHandler(error: unknown, req: any, res: any, next: any) {
  const requestId = req.id || req.headers['x-request-id'];
  const formattedError = formatError(error, requestId);
  
  // Log error (in production, use proper logging)
  console.error(`[${requestId}] Error:`, error);
  
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  res.status(statusCode).json(formattedError);
}

/**
 * Validation error helper
 */
export function createValidationError(field: string, message: string): AppError {
  return new AppError(
    `Validation failed for field '${field}': ${message}`,
    ErrorCodes.VALIDATION_ERROR,
    400,
    { field, validationMessage: message }
  );
}

/**
 * Not found error helper
 */
export function createNotFoundError(resource: string, id?: string): AppError {
  const message = id 
    ? `${resource} with ID '${id}' not found`
    : `${resource} not found`;
    
  return new AppError(message, ErrorCodes.RESOURCE_NOT_FOUND, 404);
}

/**
 * Unauthorized error helper
 */
export function createUnauthorizedError(message: string = 'Unauthorized access'): AppError {
  return new AppError(message, ErrorCodes.UNAUTHORIZED, 401);
}

/**
 * Forbidden error helper
 */
export function createForbiddenError(message: string = 'Access forbidden'): AppError {
  return new AppError(message, ErrorCodes.FORBIDDEN, 403);
}
