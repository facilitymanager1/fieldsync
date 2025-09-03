/**
 * Comprehensive Data Validation Schemas
 * Joi validation schemas for all API endpoints
 */

import Joi from 'joi';

// Common validation patterns
const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const phonePattern = /^\+?[\d\s\-\(\)]{10,}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const coordinateLatitude = Joi.number().min(-90).max(90);
const coordinateLongitude = Joi.number().min(-180).max(180);

// Base schemas
export const objectIdSchema = Joi.string().pattern(objectIdPattern).required();
export const optionalObjectIdSchema = Joi.string().pattern(objectIdPattern).optional();

// Location Schema
export const locationSchema = Joi.object({
  latitude: coordinateLatitude.required(),
  longitude: coordinateLongitude.required(),
  accuracy: Joi.number().min(0).required(),
  timestamp: Joi.date().required(),
  source: Joi.string().valid('gps', 'network', 'manual').required(),
  accuracyLevel: Joi.string().valid('high', 'medium', 'low', 'unknown').required()
});

// User Validation Schemas
export const userRegistrationSchema = Joi.object({
  email: Joi.string().pattern(emailPattern).required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  role: Joi.string().valid('Admin', 'Supervisor', 'FieldTech', 'SiteStaff', 'Client').required(),
  profile: Joi.object({
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(phonePattern).optional(),
    department: Joi.string().max(100).optional(),
    employeeId: Joi.string().max(50).optional()
  }).required(),
  preferences: Joi.object({
    notifications: Joi.boolean().default(true),
    theme: Joi.string().valid('light', 'dark').default('light'),
    language: Joi.string().default('en'),
    timezone: Joi.string().default('UTC')
  }).optional()
});

export const userUpdateSchema = Joi.object({
  email: Joi.string().pattern(emailPattern).optional(),
  role: Joi.string().valid('Admin', 'Supervisor', 'FieldTech', 'SiteStaff', 'Client').optional(),
  isActive: Joi.boolean().optional(),
  profile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: Joi.string().pattern(phonePattern).optional(),
    avatar: Joi.string().uri().optional(),
    department: Joi.string().max(100).optional(),
    employeeId: Joi.string().max(50).optional()
  }).optional(),
  preferences: Joi.object({
    notifications: Joi.boolean().optional(),
    theme: Joi.string().valid('light', 'dark').optional(),
    language: Joi.string().optional(),
    timezone: Joi.string().optional()
  }).optional(),
  permissions: Joi.array().items(Joi.string()).optional()
});

export const loginSchema = Joi.object({
  email: Joi.string().pattern(emailPattern).required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().optional()
});

// Staff Validation Schemas
export const staffCreateSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  middleName: Joi.string().max(50).optional(),
  email: Joi.string().pattern(emailPattern).required(),
  phone: Joi.string().pattern(phonePattern).required(),
  dateOfBirth: Joi.date().max('now').required(),
  hireDate: Joi.date().required(),
  startDate: Joi.date().required(),
  employmentType: Joi.string().valid('full_time', 'part_time', 'contract', 'seasonal', 'intern').required(),
  department: Joi.string().min(2).max(100).required(),
  position: Joi.string().min(2).max(100).required(),
  jobTitle: Joi.string().min(2).max(100).required(),
  userId: objectIdSchema,
  supervisorId: optionalObjectIdSchema,
  assignedSites: Joi.array().items(objectIdSchema).optional(),
  schedule: Joi.object({
    shiftType: Joi.string().valid('day', 'night', 'rotating', 'on_call', 'flexible').required(),
    workingHours: Joi.object({
      start: Joi.string().pattern(timePattern).required(),
      end: Joi.string().pattern(timePattern).required()
    }).required(),
    workingDays: Joi.array().items(Joi.number().min(0).max(6)).required(),
    timeZone: Joi.string().required()
  }).required()
});

export const staffUpdateSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  phone: Joi.string().pattern(phonePattern).optional(),
  status: Joi.string().valid('active', 'inactive', 'on_leave', 'suspended', 'terminated').optional(),
  department: Joi.string().min(2).max(100).optional(),
  position: Joi.string().min(2).max(100).optional(),
  supervisorId: optionalObjectIdSchema,
  assignedSites: Joi.array().items(objectIdSchema).optional(),
  performanceRating: Joi.number().min(1).max(5).optional(),
  skills: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    category: Joi.string().required(),
    level: Joi.string().valid('beginner', 'intermediate', 'advanced', 'expert').required(),
    yearsExperience: Joi.number().min(0).optional(),
    certified: Joi.boolean().optional()
  })).optional()
});

// Site Validation Schemas
export const siteCreateSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  type: Joi.string().valid('office', 'warehouse', 'retail', 'industrial', 'residential', 'healthcare', 'education', 'government', 'other').required(),
  clientId: objectIdSchema,
  address: Joi.object({
    street: Joi.string().min(5).max(200).required(),
    city: Joi.string().min(2).max(100).required(),
    state: Joi.string().min(2).max(50).required(),
    zipCode: Joi.string().min(5).max(10).required(),
    country: Joi.string().min(2).max(50).default('US'),
    coordinates: Joi.object({
      latitude: coordinateLatitude.required(),
      longitude: coordinateLongitude.required()
    }).required(),
    timezone: Joi.string().required()
  }).required(),
  contacts: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    title: Joi.string().required(),
    phone: Joi.string().pattern(phonePattern).required(),
    email: Joi.string().pattern(emailPattern).required(),
    isPrimary: Joi.boolean().default(false),
    isEmergency: Joi.boolean().default(false)
  })).min(1).required(),
  operatingHours: Joi.array().items(Joi.object({
    day: Joi.number().min(0).max(6).required(),
    open: Joi.string().pattern(timePattern).required(),
    close: Joi.string().pattern(timePattern).required(),
    isOpen: Joi.boolean().default(true)
  })).optional(),
  serviceTypes: Joi.array().items(Joi.string()).optional(),
  assignedSupervisor: optionalObjectIdSchema,
  assignedTechnicians: Joi.array().items(objectIdSchema).optional()
});

export const siteUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'construction', 'closed').optional(),
  description: Joi.string().max(1000).optional(),
  serviceTypes: Joi.array().items(Joi.string()).optional(),
  assignedSupervisor: optionalObjectIdSchema,
  assignedTechnicians: Joi.array().items(objectIdSchema).optional(),
  specialRequirements: Joi.array().items(Joi.string()).optional(),
  safetyRequirements: Joi.array().items(Joi.string()).optional(),
  nextScheduledVisit: Joi.date().optional(),
  visitFrequency: Joi.string().optional()
});

// Client Validation Schemas
export const clientCreateSchema = Joi.object({
  companyName: Joi.string().min(2).max(200).required(),
  type: Joi.string().valid('enterprise', 'small_business', 'government', 'non_profit', 'individual', 'property_management', 'healthcare', 'education', 'retail').required(),
  industry: Joi.string().min(2).max(100).required(),
  contacts: Joi.array().items(Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    title: Joi.string().required(),
    email: Joi.string().pattern(emailPattern).required(),
    phone: Joi.string().pattern(phonePattern).required(),
    isPrimary: Joi.boolean().default(false),
    isDecisionMaker: Joi.boolean().default(false),
    isBilling: Joi.boolean().default(false)
  })).min(1).required(),
  addresses: Joi.array().items(Joi.object({
    type: Joi.string().valid('headquarters', 'billing', 'mailing', 'site').required(),
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    country: Joi.string().default('US'),
    isPrimary: Joi.boolean().default(false)
  })).min(1).required(),
  billing: Joi.object({
    billingAddressId: Joi.string().required(),
    billingContactId: Joi.string().required(),
    paymentMethod: Joi.string().valid('credit_card', 'ach', 'check', 'wire_transfer').required(),
    paymentTerms: Joi.string().required(),
    currency: Joi.string().default('USD')
  }).required(),
  serviceLevel: Joi.object({
    responseTime: Joi.number().min(1).required(),
    resolutionTime: Joi.number().min(1).required(),
    availability: Joi.string().required()
  }).required()
});

export const clientUpdateSchema = Joi.object({
  companyName: Joi.string().min(2).max(200).optional(),
  status: Joi.string().valid('active', 'inactive', 'prospect', 'suspended', 'terminated', 'onboarding').optional(),
  industry: Joi.string().min(2).max(100).optional(),
  companySize: Joi.string().valid('startup', 'small', 'medium', 'large', 'enterprise').optional(),
  assignedAccountManager: optionalObjectIdSchema,
  satisfactionScore: Joi.number().min(1).max(5).optional(),
  riskLevel: Joi.string().valid('low', 'medium', 'high').optional(),
  accountHealth: Joi.string().valid('excellent', 'good', 'fair', 'poor', 'at_risk').optional()
});

// Shift Validation Schemas
export const shiftStartSchema = Joi.object({
  staffId: objectIdSchema,
  location: locationSchema.required(),
  plannedEndTime: Joi.date().optional(),
  plannedSites: Joi.array().items(objectIdSchema).optional()
});

export const shiftEndSchema = Joi.object({
  shiftId: objectIdSchema,
  location: locationSchema.required(),
  notes: Joi.string().max(1000).optional()
});

export const siteVisitSchema = Joi.object({
  shiftId: objectIdSchema,
  siteId: objectIdSchema,
  siteName: Joi.string().required(),
  event: Joi.string().valid('enter', 'exit', 'emergency_exit', 'timeout_exit').required(),
  location: locationSchema.required(),
  geofenceId: Joi.string().optional(),
  tasks: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    estimatedDuration: Joi.number().min(1).required(),
    requiredTools: Joi.array().items(Joi.string()).optional()
  })).optional()
});

export const shiftBreakSchema = Joi.object({
  shiftId: objectIdSchema,
  type: Joi.string().valid('lunch', 'short_break', 'emergency', 'authorized', 'unauthorized').required(),
  plannedDuration: Joi.number().min(1).required(),
  location: locationSchema.required(),
  reason: Joi.string().max(500).optional()
});

// Ticket Validation Schemas
export const ticketCreateSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().min(10).max(5000).required(),
  category: Joi.string().valid('Maintenance', 'Repair', 'Installation', 'Inspection', 'Emergency', 'Other').required(),
  priority: Joi.string().valid('Low', 'Medium', 'High', 'Critical').default('Medium'),
  severity: Joi.string().valid('Minor', 'Major', 'Critical').default('Minor'),
  siteId: optionalObjectIdSchema,
  assignedTo: optionalObjectIdSchema,
  dueDate: Joi.date().optional(),
  estimatedHours: Joi.number().min(0).optional(),
  location: Joi.object({
    name: Joi.string().optional(),
    address: Joi.string().optional(),
    coordinates: Joi.object({
      lat: coordinateLatitude.optional(),
      lng: coordinateLongitude.optional()
    }).optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  customFields: Joi.object().optional()
});

export const ticketUpdateSchema = Joi.object({
  title: Joi.string().min(5).max(200).optional(),
  description: Joi.string().min(10).max(5000).optional(),
  category: Joi.string().valid('Maintenance', 'Repair', 'Installation', 'Inspection', 'Emergency', 'Other').optional(),
  priority: Joi.string().valid('Low', 'Medium', 'High', 'Critical').optional(),
  status: Joi.string().valid('Open', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Cancelled').optional(),
  assignedTo: optionalObjectIdSchema,
  dueDate: Joi.date().optional(),
  estimatedHours: Joi.number().min(0).optional(),
  actualHours: Joi.number().min(0).optional(),
  resolution: Joi.string().max(2000).optional(),
  customerSatisfaction: Joi.number().min(1).max(5).optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

// Geofence Validation Schemas
export const geofenceCreateSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  type: Joi.string().valid('worksite', 'office', 'warehouse', 'client_location', 'restricted_area', 'emergency_zone').required(),
  area: Joi.object({
    center: Joi.object({
      latitude: coordinateLatitude.required(),
      longitude: coordinateLongitude.required()
    }).required(),
    radius: Joi.number().min(1).max(10000).required(),
    polygon: Joi.array().items(Joi.object({
      latitude: coordinateLatitude.required(),
      longitude: coordinateLongitude.required()
    })).optional()
  }).required(),
  siteId: optionalObjectIdSchema,
  clientId: optionalObjectIdSchema,
  allowedRoles: Joi.array().items(Joi.string().valid('FieldTech', 'SiteStaff', 'Supervisor', 'Admin')).default(['FieldTech', 'SiteStaff']),
  triggers: Joi.array().items(Joi.object({
    eventType: Joi.string().valid('enter', 'exit', 'dwell', 'breach').required(),
    action: Joi.string().valid('automatic_clock_in', 'automatic_clock_out', 'site_visit_start', 'site_visit_end', 'restricted_area_alert', 'emergency_alert', 'notification_only').required(),
    enabled: Joi.boolean().default(true),
    conditions: Joi.object({
      timeOfDay: Joi.object({
        start: Joi.string().pattern(timePattern).optional(),
        end: Joi.string().pattern(timePattern).optional()
      }).optional(),
      daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)).optional(),
      userRoles: Joi.array().items(Joi.string()).optional(),
      minDwellTime: Joi.number().min(0).optional()
    }).optional()
  })).optional()
});

export const geofenceEventSchema = Joi.object({
  geofenceId: objectIdSchema,
  eventType: Joi.string().valid('enter', 'exit', 'dwell', 'breach').required(),
  location: locationSchema.required(),
  shiftId: optionalObjectIdSchema
});

// Analytics Validation Schemas
export const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  userId: optionalObjectIdSchema,
  siteId: optionalObjectIdSchema,
  periodType: Joi.string().valid('day', 'week', 'month', 'quarter', 'year', 'custom').default('month'),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20)
});

// Query Parameter Validation Schemas
export const paginationSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  sort: Joi.string().optional(),
  order: Joi.string().valid('asc', 'desc').default('desc')
});

export const filterSchema = Joi.object({
  status: Joi.string().optional(),
  type: Joi.string().optional(),
  category: Joi.string().optional(),
  priority: Joi.string().optional(),
  assignedTo: optionalObjectIdSchema,
  createdBy: optionalObjectIdSchema,
  siteId: optionalObjectIdSchema,
  clientId: optionalObjectIdSchema,
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  tags: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional()
});

// File Upload Validation
export const fileUploadSchema = Joi.object({
  filename: Joi.string().required(),
  mimetype: Joi.string().required(),
  size: Joi.number().max(10 * 1024 * 1024).required(), // 10MB max
  fieldname: Joi.string().required()
});

// Bulk Operations Validation
export const bulkUpdateSchema = Joi.object({
  ids: Joi.array().items(objectIdSchema).min(1).max(100).required(),
  updates: Joi.object().required(),
  options: Joi.object({
    validateOnly: Joi.boolean().default(false),
    skipValidation: Joi.boolean().default(false)
  }).optional()
});

// Password Reset Validation
export const passwordResetRequestSchema = Joi.object({
  email: Joi.string().pattern(emailPattern).required()
});

export const passwordResetSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

// Two-Factor Authentication Validation
export const twoFactorSetupSchema = Joi.object({
  secret: Joi.string().required(),
  token: Joi.string().length(6).pattern(/^\d+$/).required()
});

export const twoFactorVerifySchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required()
});

// Settings and Configuration Validation
export const settingsUpdateSchema = Joi.object({
  notifications: Joi.object({
    email: Joi.boolean().optional(),
    sms: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
    inApp: Joi.boolean().optional()
  }).optional(),
  privacy: Joi.object({
    profileVisibility: Joi.string().valid('public', 'team', 'private').optional(),
    locationSharing: Joi.boolean().optional(),
    activityStatus: Joi.boolean().optional()
  }).optional(),
  preferences: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto').optional(),
    language: Joi.string().optional(),
    timezone: Joi.string().optional(),
    dateFormat: Joi.string().valid('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD').optional(),
    timeFormat: Joi.string().valid('12', '24').optional()
  }).optional()
});

// Export all schemas for use in middleware
export const validationSchemas = {
  // User schemas
  userRegistrationSchema,
  userUpdateSchema,
  loginSchema,
  
  // Staff schemas
  staffCreateSchema,
  staffUpdateSchema,
  
  // Site schemas
  siteCreateSchema,
  siteUpdateSchema,
  
  // Client schemas
  clientCreateSchema,
  clientUpdateSchema,
  
  // Shift schemas
  shiftStartSchema,
  shiftEndSchema,
  siteVisitSchema,
  shiftBreakSchema,
  
  // Ticket schemas
  ticketCreateSchema,
  ticketUpdateSchema,
  
  // Geofence schemas
  geofenceCreateSchema,
  geofenceEventSchema,
  
  // Analytics schemas
  analyticsQuerySchema,
  
  // Common schemas
  paginationSchema,
  filterSchema,
  fileUploadSchema,
  bulkUpdateSchema,
  
  // Authentication schemas
  passwordResetRequestSchema,
  passwordResetSchema,
  twoFactorSetupSchema,
  twoFactorVerifySchema,
  
  // Settings schemas
  settingsUpdateSchema
};