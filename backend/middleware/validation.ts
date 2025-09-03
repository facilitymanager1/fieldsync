import { Request, Response, NextFunction } from 'express';

export interface ValidationRequest extends Request {
  validationErrors?: any[];
}

// Simple validation helpers
function isEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isMongoId(id: string): boolean {
  const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
  return mongoIdRegex.test(id);
}

function isISO8601(date: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return iso8601Regex.test(date) && !isNaN(Date.parse(date));
}

// Middleware to validate request and return errors
export function validateRequest(validationFn: (req: Request) => string[]) {
  return (req: ValidationRequest, res: Response, next: NextFunction) => {
    const errors = validationFn(req);
    
    if (errors.length > 0) {
      req.validationErrors = errors;
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }
    
    next();
  };
}

// Validation functions
export const userValidation = {
  create: validateRequest((req: Request) => {
    const errors: string[] = [];
    const { email, name, role } = req.body;
    
    if (!email || !isEmail(email)) {
      errors.push('Valid email is required');
    }
    if (!name || typeof name !== 'string' || name.length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    if (!role || !['Admin', 'Manager', 'Staff'].includes(role)) {
      errors.push('Invalid role');
    }
    
    return errors;
  }),
  
  update: validateRequest((req: Request) => {
    const errors: string[] = [];
    const { id } = req.params;
    const { email, name } = req.body;
    
    if (!id || !isMongoId(id)) {
      errors.push('Valid user ID is required');
    }
    if (email && !isEmail(email)) {
      errors.push('Valid email is required');
    }
    if (name && (typeof name !== 'string' || name.length < 2)) {
      errors.push('Name must be at least 2 characters');
    }
    
    return errors;
  })
};

export const ticketValidation = {
  create: validateRequest((req: Request) => {
    const errors: string[] = [];
    const { title, description, priority } = req.body;
    
    if (!title || typeof title !== 'string' || title.length < 5) {
      errors.push('Title must be at least 5 characters');
    }
    if (!description || typeof description !== 'string' || description.length < 10) {
      errors.push('Description must be at least 10 characters');
    }
    if (!priority || !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      errors.push('Invalid priority');
    }
    
    return errors;
  }),
  
  update: validateRequest((req: Request) => {
    const errors: string[] = [];
    const { id } = req.params;
    const { status } = req.body;
    
    if (!id || !isMongoId(id)) {
      errors.push('Valid ticket ID is required');
    }
    if (status && !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      errors.push('Invalid status');
    }
    
    return errors;
  })
};

export const attendanceValidation = {
  record: validateRequest((req: Request) => {
    const errors: string[] = [];
    const { type, location } = req.body;
    
    if (!type || !['check_in', 'check_out'].includes(type)) {
      errors.push('Invalid attendance type');
    }
    if (!location || !location.latitude || !location.longitude) {
      errors.push('Location coordinates are required');
    }
    if (location.latitude < -90 || location.latitude > 90) {
      errors.push('Invalid latitude');
    }
    if (location.longitude < -180 || location.longitude > 180) {
      errors.push('Invalid longitude');
    }
    
    return errors;
  })
};

export const leaveValidation = {
  apply: validateRequest((req: Request) => {
    const errors: string[] = [];
    const { startDate, endDate, type, reason } = req.body;
    
    if (!startDate || !isISO8601(startDate)) {
      errors.push('Valid start date is required');
    }
    if (!endDate || !isISO8601(endDate)) {
      errors.push('Valid end date is required');
    }
    if (!type || !['sick', 'vacation', 'personal', 'emergency'].includes(type)) {
      errors.push('Invalid leave type');
    }
    if (!reason || typeof reason !== 'string' || reason.length < 10) {
      errors.push('Reason must be at least 10 characters');
    }
    
    return errors;
  })
};

export const scheduleValidation = {
  create: validateRequest((req: Request) => {
    const errors: string[] = [];
    const { tasks, resources, algorithm } = req.body;
    
    if (!tasks || !Array.isArray(tasks)) {
      errors.push('Tasks array is required');
    }
    if (!resources || !Array.isArray(resources)) {
      errors.push('Resources array is required');
    }
    if (algorithm && !['genetic', 'simulated_annealing', 'hybrid'].includes(algorithm)) {
      errors.push('Invalid algorithm');
    }
    
    return errors;
  })
};

// Generic validation helpers
export function requireFields(fields: string[]) {
  return validateRequest((req: Request) => {
    const errors: string[] = [];
    
    for (const field of fields) {
      if (!req.body[field]) {
        errors.push(`${field} is required`);
      }
    }
    
    return errors;
  });
}

export function validateObjectId(paramName: string = 'id') {
  return validateRequest((req: Request) => {
    const errors: string[] = [];
    const value = req.params[paramName];
    
    if (!value || !isMongoId(value)) {
      errors.push(`Valid ${paramName} is required`);
    }
    
    return errors;
  });
}

export function validateDateRange() {
  return validateRequest((req: Request) => {
    const errors: string[] = [];
    const { startDate, endDate } = req.query;
    
    if (startDate && !isISO8601(startDate as string)) {
      errors.push('Valid start date is required');
    }
    if (endDate && !isISO8601(endDate as string)) {
      errors.push('Valid end date is required');
    }
    
    return errors;
  });
}

export default { validateRequest, userValidation, ticketValidation, attendanceValidation, leaveValidation, scheduleValidation };
