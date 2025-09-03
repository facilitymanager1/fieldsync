/**
 * Validation Middleware
 * Express middleware for request validation using Joi schemas
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

// Validation target types
export type ValidationTarget = 'body' | 'params' | 'query' | 'headers' | 'files';

// Validation options
export interface ValidationOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  skipOnError?: boolean;
  context?: any;
}

// Default validation options
const defaultOptions: ValidationOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: true,
  skipOnError: false
};

/**
 * Create validation middleware for specific schema and target
 */
export function validateRequest(
  schema: Joi.ObjectSchema,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  const validationOptions = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const timer = monitoring.startTimer('request_validation_duration');
      
      // Get data to validate based on target
      let dataToValidate: any;
      
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'headers':
          dataToValidate = req.headers;
          break;
        case 'files':
          dataToValidate = req.files || req.file;
          break;
        default:
          throw new Error(`Invalid validation target: ${target}`);
      }

      // Perform validation
      const { error, value } = schema.validate(dataToValidate, validationOptions);

      timer();

      if (error) {
        // Extract validation error details
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
          type: detail.type
        }));

        monitoring.incrementCounter('validation_errors_total', 1, {
          target,
          errorCount: validationErrors.length.toString()
        });

        loggingService.warn('Request validation failed', {
          target,
          errors: validationErrors,
          url: req.url,
          method: req.method,
          userId: (req as any).user?.id
        });

        // Return validation error response
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationErrors,
          message: `Invalid ${target} data provided`
        });
        return;
      }

      // Replace the target data with validated/sanitized version
      switch (target) {
        case 'body':
          req.body = value;
          break;
        case 'params':
          req.params = value;
          break;
        case 'query':
          req.query = value;
          break;
        case 'headers':
          // Don't replace headers, just validate
          break;
        case 'files':
          // Don't replace files, just validate
          break;
      }

      monitoring.incrementCounter('validation_success_total', 1, {
        target
      });

      next();
    } catch (error) {
      loggingService.error('Validation middleware error', error, {
        target,
        url: req.url,
        method: req.method
      });

      monitoring.incrementCounter('validation_middleware_errors_total', 1);

      res.status(500).json({
        success: false,
        error: 'Validation middleware error',
        message: 'An error occurred during request validation'
      });
    }
  };
}

/**
 * Validate multiple targets in a single middleware
 */
export function validateMultiple(
  validations: Array<{
    schema: Joi.ObjectSchema;
    target: ValidationTarget;
    options?: ValidationOptions;
  }>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const validationErrors: any[] = [];
    const timer = monitoring.startTimer('multiple_validation_duration');

    try {
      for (const validation of validations) {
        const { schema, target, options = {} } = validation;
        const validationOptions = { ...defaultOptions, ...options };

        let dataToValidate: any;
        
        switch (target) {
          case 'body':
            dataToValidate = req.body;
            break;
          case 'params':
            dataToValidate = req.params;
            break;
          case 'query':
            dataToValidate = req.query;
            break;
          case 'headers':
            dataToValidate = req.headers;
            break;
          case 'files':
            dataToValidate = req.files || req.file;
            break;
          default:
            throw new Error(`Invalid validation target: ${target}`);
        }

        const { error, value } = schema.validate(dataToValidate, validationOptions);

        if (error) {
          const targetErrors = error.details.map(detail => ({
            target,
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            type: detail.type
          }));
          validationErrors.push(...targetErrors);
        } else {
          // Update request with validated data
          switch (target) {
            case 'body':
              req.body = value;
              break;
            case 'params':
              req.params = value;
              break;
            case 'query':
              req.query = value;
              break;
          }
        }
      }

      timer();

      if (validationErrors.length > 0) {
        monitoring.incrementCounter('multiple_validation_errors_total', 1, {
          errorCount: validationErrors.length.toString()
        });

        loggingService.warn('Multiple validation failed', {
          errors: validationErrors,
          url: req.url,
          method: req.method,
          userId: (req as any).user?.id
        });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationErrors,
          message: 'Multiple validation errors occurred'
        });
        return;
      }

      monitoring.incrementCounter('multiple_validation_success_total', 1);
      next();
    } catch (error) {
      timer();
      loggingService.error('Multiple validation middleware error', error);
      monitoring.incrementCounter('multiple_validation_middleware_errors_total', 1);

      res.status(500).json({
        success: false,
        error: 'Validation middleware error'
      });
    }
  };
}

/**
 * Validate request body with specific schema
 */
export const validateBody = (schema: Joi.ObjectSchema, options?: ValidationOptions) =>
  validateRequest(schema, 'body', options);

/**
 * Validate request params with specific schema
 */
export const validateParams = (schema: Joi.ObjectSchema, options?: ValidationOptions) =>
  validateRequest(schema, 'params', options);

/**
 * Validate request query with specific schema
 */
export const validateQuery = (schema: Joi.ObjectSchema, options?: ValidationOptions) =>
  validateRequest(schema, 'query', options);

/**
 * Validate request headers with specific schema
 */
export const validateHeaders = (schema: Joi.ObjectSchema, options?: ValidationOptions) =>
  validateRequest(schema, 'headers', options);

/**
 * Validate uploaded files with specific schema
 */
export const validateFiles = (schema: Joi.ObjectSchema, options?: ValidationOptions) =>
  validateRequest(schema, 'files', options);

/**
 * Create conditional validation middleware
 */
export function validateConditional(
  condition: (req: Request) => boolean,
  schema: Joi.ObjectSchema,
  target: ValidationTarget = 'body',
  options?: ValidationOptions
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (condition(req)) {
      validateRequest(schema, target, options)(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * Create role-based validation middleware
 */
export function validateByRole(
  roleSchemas: Record<string, Joi.ObjectSchema>,
  target: ValidationTarget = 'body',
  options?: ValidationOptions
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req as any).user?.role;
    
    if (!userRole) {
      res.status(401).json({
        success: false,
        error: 'Authentication required for validation'
      });
      return;
    }

    const schema = roleSchemas[userRole] || roleSchemas['default'];
    
    if (!schema) {
      res.status(403).json({
        success: false,
        error: `No validation schema defined for role: ${userRole}`
      });
      return;
    }

    validateRequest(schema, target, options)(req, res, next);
  };
}

/**
 * Sanitize and validate common query parameters
 */
export const validateCommonQuery = validateQuery(
  Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('desc'),
    search: Joi.string().min(1).max(100).optional(),
    filter: Joi.string().optional()
  })
);

/**
 * Validate ObjectId parameter
 */
export const validateObjectIdParam = (paramName: string = 'id') =>
  validateParams(
    Joi.object({
      [paramName]: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    })
  );

/**
 * Validate date range query parameters
 */
export const validateDateRangeQuery = validateQuery(
  Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().min(Joi.ref('startDate')).optional(),
    period: Joi.string().valid('day', 'week', 'month', 'quarter', 'year').optional()
  }).with('startDate', 'endDate')
);

/**
 * Custom validation helper functions
 */
export const validationHelpers = {
  /**
   * Validate that a field exists and is not empty
   */
  requireField: (fieldName: string) => 
    Joi.any().required().messages({
      'any.required': `${fieldName} is required`,
      'string.empty': `${fieldName} cannot be empty`
    }),

  /**
   * Validate email format
   */
  email: () =>
    Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),

  /**
   * Validate phone number format
   */
  phone: () =>
    Joi.string().pattern(/^\+?[\d\s\-\(\)]{10,}$/).required().messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'any.required': 'Phone number is required'
    }),

  /**
   * Validate password strength
   */
  strongPassword: () =>
    Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),

  /**
   * Validate MongoDB ObjectId
   */
  objectId: (fieldName: string = 'id') =>
    Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
      'string.pattern.base': `${fieldName} must be a valid MongoDB ObjectId`,
      'any.required': `${fieldName} is required`
    }),

  /**
   * Validate coordinate values
   */
  coordinates: () =>
    Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required()
    }).required(),

  /**
   * Validate time format (HH:mm)
   */
  timeFormat: () =>
    Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
      'string.pattern.base': 'Time must be in HH:mm format (24-hour)'
    }),

  /**
   * Validate file size
   */
  fileSize: (maxSizeBytes: number) =>
    Joi.number().max(maxSizeBytes).required().messages({
      'number.max': `File size cannot exceed ${Math.round(maxSizeBytes / (1024 * 1024))}MB`
    })
};

export default validateRequest;