/**
 * Staff Data Model with Enhanced Relationships
 * Comprehensive staff management with proper entity relationships
 */

import mongoose, { Schema, model } from 'mongoose';
import { StaffDocument } from '../types/modelTypes';
import { createBaseAuditableEntitySchema } from './baseModel';

// Staff Types and Enums
export enum StaffStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated'
}

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  SEASONAL = 'seasonal',
  INTERN = 'intern'
}

export enum ShiftType {
  DAY = 'day',
  NIGHT = 'night',
  ROTATING = 'rotating',
  ON_CALL = 'on_call',
  FLEXIBLE = 'flexible'
}

export interface StaffEmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: string;
  isPrimary: boolean;
}

export interface StaffCertification {
  id: string;
  name: string;
  issuingAuthority: string;
  certificateNumber: string;
  issueDate: Date;
  expiryDate?: Date;
  status: 'active' | 'expired' | 'revoked';
  attachmentUrl?: string;
}

export interface StaffSkill {
  id: string;
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsExperience: number;
  certified: boolean;
  certificationDate?: Date;
}

export interface StaffAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isPrimary: boolean;
  type: 'home' | 'mailing' | 'emergency';
}

export interface StaffPayroll {
  employeeId: string;
  hourlyRate?: number;
  salary?: number;
  payFrequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
  overtimeRate?: number;
  currency: string;
  bankAccount?: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
  taxWithholdings: {
    federal: number;
    state: number;
    social: number;
    medicare: number;
  };
}

export interface StaffSchedule {
  shiftType: ShiftType;
  workingHours: {
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  workingDays: number[]; // 0-6 (Sunday-Saturday)
  timeZone: string;
  breakDuration: number; // minutes
  lunchDuration: number; // minutes
}

// Enhanced Staff interface using proper inheritance
export interface Staff extends StaffDocument {
  employeeId: string;
  
  // Personal Information
  profile: {
    firstName: string;
    lastName: string;
    middleName?: string;
    preferredName?: string;
    dateOfBirth: Date;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    nationality?: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    emergencyContact: {
      name: string;
      relationship: string;
      phone: string;
      email?: string;
    };
  };
  
  // Employment Information
  employment: {
    startDate: Date;
    endDate?: Date;
    position: string;
    department: string;
    reportingManager: mongoose.Types.ObjectId;
    employmentType: 'full_time' | 'part_time' | 'contract' | 'intern' | 'consultant';
    status: 'active' | 'inactive' | 'terminated' | 'on_leave';
    probationEndDate?: Date;
  };
  
  // Compensation
  compensation: {
    baseSalary: number;
    currency: string;
    payFrequency: 'weekly' | 'bi_weekly' | 'monthly';
    benefits: string[];
    bonusEligible: boolean;
  };
  
  // Skills and Qualifications
  skills: Array<{
    name: string;
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    certified: boolean;
    certificationDate?: Date;
    expiryDate?: Date;
  }>;
  
  // Schedule
  schedule: {
    workDays: string[];
    startTime: string;
    endTime: string;
    timeZone: string;
    flexibleHours: boolean;
    lunchDuration: number;
  };
  
  // Biometric data (optional)
  biometric?: {
    faceEncoding?: string;
    fingerprint?: string;
    retinaScan?: string;
  };
}

// Schema Definitions
const StaffEmergencyContactSchema = new Schema<StaffEmergencyContact>({
  name: { type: String, required: true },
  relationship: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  address: { type: String },
  isPrimary: { type: Boolean, default: false }
});

const StaffCertificationSchema = new Schema<StaffCertification>({
  name: { type: String, required: true },
  issuingAuthority: { type: String, required: true },
  certificateNumber: { type: String, required: true },
  issueDate: { type: Date, required: true },
  expiryDate: { type: Date },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active'
  },
  attachmentUrl: { type: String }
});

const StaffSkillSchema = new Schema<StaffSkill>({
  name: { type: String, required: true },
  category: { type: String, required: true },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    required: true
  },
  yearsExperience: { type: Number, default: 0 },
  certified: { type: Boolean, default: false },
  certificationDate: { type: Date }
});

const StaffAddressSchema = new Schema<StaffAddress>({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: 'US' },
  isPrimary: { type: Boolean, default: false },
  type: {
    type: String,
    enum: ['home', 'mailing', 'emergency'],
    default: 'home'
  }
});

const StaffScheduleSchema = new Schema<StaffSchedule>({
  shiftType: {
    type: String,
    enum: Object.values(ShiftType),
    required: true
  },
  workingHours: {
    start: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
    end: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
  },
  workingDays: [{ type: Number, min: 0, max: 6 }],
  timeZone: { type: String, required: true },
  breakDuration: { type: Number, default: 15 },
  lunchDuration: { type: Number, default: 30 }
});

// Staff-specific schema fields (excluding base entity fields)
const staffFields = {
  employeeId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  
  // Personal Information
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  middleName: { type: String, trim: true },
  preferredName: { type: String, trim: true },
  dateOfBirth: { type: Date, required: true },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say']
  },
  nationality: { type: String },
  
  // Contact Information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  phone: { type: String, required: true },
  alternatePhone: { type: String },
  addresses: [StaffAddressSchema],
  emergencyContacts: [StaffEmergencyContactSchema],
  
  // Employment Information
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  hireDate: { type: Date, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  employmentType: {
    type: String,
    enum: Object.values(EmploymentType),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(StaffStatus),
    default: StaffStatus.ACTIVE,
    index: true
  },
  department: { type: String, required: true, index: true },
  position: { type: String, required: true },
  jobTitle: { type: String, required: true },
  jobDescription: { type: String },
  
  // Reporting Structure
  supervisorId: {
    type: Schema.Types.ObjectId,
    ref: 'Staff',
    index: true
  },
  managerId: {
    type: Schema.Types.ObjectId,
    ref: 'Staff',
    index: true
  },
  subordinates: [{
    type: Schema.Types.ObjectId,
    ref: 'Staff'
  }],
  
  // Work Assignment
  assignedSites: [{
    type: Schema.Types.ObjectId,
    ref: 'Site',
    index: true
  }],
  primarySiteId: {
    type: Schema.Types.ObjectId,
    ref: 'Site',
    index: true
  },
  workingRegion: { type: String, index: true },
  vehicleAssigned: { type: String },
  equipmentAssigned: [{ type: String }],
  
  // Schedule and Availability
  schedule: { type: StaffScheduleSchema, required: true },
  availabilityHours: {
    monday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: true }
    },
    tuesday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: true }
    },
    wednesday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: true }
    },
    thursday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: true }
    },
    friday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: true }
    },
    saturday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: false }
    },
    sunday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: false }
    }
  },
  
  // Skills and Qualifications
  skills: [StaffSkillSchema],
  certifications: [StaffCertificationSchema],
  education: [{
    degree: { type: String },
    institution: { type: String },
    graduationYear: { type: Number },
    major: { type: String }
  }],
  languages: [{
    language: { type: String, required: true },
    proficiency: {
      type: String,
      enum: ['basic', 'conversational', 'fluent', 'native'],
      required: true
    }
  }],
  
  // Performance and Compliance
  performanceRating: { type: Number, min: 1, max: 5 },
  lastPerformanceReview: { type: Date },
  nextPerformanceReview: { type: Date, index: true },
  complianceTrainingComplete: { type: Boolean, default: false },
  lastComplianceTraining: { type: Date },
  backgroundCheckComplete: { type: Boolean, default: false },
  backgroundCheckDate: { type: Date },
  drugTestComplete: { type: Boolean, default: false },
  drugTestDate: { type: Date },
  
  // Benefits
  benefits: {
    healthInsurance: { type: Boolean, default: false },
    dentalInsurance: { type: Boolean, default: false },
    visionInsurance: { type: Boolean, default: false },
    retirement401k: { type: Boolean, default: false },
    paidTimeOff: { type: Number, default: 0 },
    sickLeave: { type: Number, default: 0 }
  },
  
  // Leave and Time Off
  vacationDaysUsed: { type: Number, default: 0 },
  sickDaysUsed: { type: Number, default: 0 },
  leaveBalance: {
    vacation: { type: Number, default: 0 },
    sick: { type: Number, default: 0 },
    personal: { type: Number, default: 0 },
    bereavement: { type: Number, default: 0 }
  },
  
  // Documents
  documents: [{
    name: { type: String, required: true },
    type: { type: String, required: true },
    url: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now },
    expiryDate: { type: Date }
  }],
  
  // Relationships
  clientAssignments: [{
    type: Schema.Types.ObjectId,
    ref: 'Client'
  }],
  teamMemberships: [{ type: String }],
  
  // Metadata
  tags: [{ type: String, index: true }],
  customFields: { type: Schema.Types.Mixed },
  notes: { type: String },
  
  // Activity Tracking
  lastActiveDate: { type: Date },
  lastShiftDate: { type: Date },
  totalHoursWorked: { type: Number, default: 0 },
  averageHoursPerWeek: { type: Number, default: 0 },
  
  // Additional staff-specific fields
  profile: {
    firstName: { 
      type: String, 
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: { 
      type: String, 
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    phone: { 
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: function(v: string) {
          return /^\+?[\d\s\-\(\)]+$/.test(v);
        },
        message: 'Please enter a valid phone number'
      }
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: function(v: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please enter a valid email address'
      }
    },
    dateOfBirth: { 
      type: Date, 
      required: [true, 'Date of birth is required'],
      validate: {
        validator: function(v: Date) {
          const age = (new Date().getTime() - v.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          return age >= 16 && age <= 100;
        },
        message: 'Age must be between 16 and 100 years'
      }
    },
    gender: {
      type: String,
      enum: {
        values: ['male', 'female', 'other', 'prefer_not_to_say'],
        message: 'Invalid gender specified'
      }
    },
    address: {
      street: { 
        type: String, 
        required: [true, 'Street address is required'],
        trim: true,
        maxlength: [200, 'Street address cannot exceed 200 characters']
      },
      city: { 
        type: String, 
        required: [true, 'City is required'],
        trim: true,
        maxlength: [100, 'City cannot exceed 100 characters']
      },
      state: { 
        type: String, 
        required: [true, 'State is required'],
        trim: true,
        maxlength: [50, 'State cannot exceed 50 characters']
      },
      zipCode: { 
        type: String, 
        required: [true, 'ZIP code is required'],
        trim: true,
        validate: {
          validator: function(v: string) {
            return /^\d{5}(-\d{4})?$/.test(v);
          },
          message: 'Please enter a valid ZIP code'
        }
      },
      country: { 
        type: String, 
        default: 'US',
        trim: true,
        maxlength: [50, 'Country cannot exceed 50 characters']
      }
    },
    emergencyContact: {
      name: { 
        type: String, 
        required: [true, 'Emergency contact name is required'],
        trim: true,
        maxlength: [100, 'Emergency contact name cannot exceed 100 characters']
      },
      relationship: { 
        type: String, 
        required: [true, 'Emergency contact relationship is required'],
        trim: true,
        maxlength: [50, 'Relationship cannot exceed 50 characters']
      },
      phone: { 
        type: String, 
        required: [true, 'Emergency contact phone is required'],
        trim: true,
        validate: {
          validator: function(v: string) {
            return /^\+?[\d\s\-\(\)]+$/.test(v);
          },
          message: 'Please enter a valid phone number'
        }
      },
      email: { 
        type: String,
        trim: true,
        lowercase: true,
        validate: {
          validator: function(v: string) {
            if (!v) return true;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
          },
          message: 'Please enter a valid email address'
        }
      }
    }
  },
  
  employment: {
    startDate: { 
      type: Date, 
      required: [true, 'Start date is required'],
      index: true
    },
    endDate: { type: Date },
    position: { 
      type: String, 
      required: [true, 'Position is required'],
      trim: true,
      maxlength: [100, 'Position cannot exceed 100 characters'],
      index: true
    },
    department: { 
      type: String, 
      required: [true, 'Department is required'],
      trim: true,
      maxlength: [100, 'Department cannot exceed 100 characters'],
      index: true
    },
    reportingManager: { 
      type: Schema.Types.ObjectId, 
      ref: 'Staff',
      required: [true, 'Reporting manager is required'],
      index: true
    },
    employmentType: {
      type: String,
      required: [true, 'Employment type is required'],
      enum: {
        values: ['full_time', 'part_time', 'contract', 'intern', 'consultant'],
        message: 'Invalid employment type'
      },
      index: true
    },
    status: {
      type: String,
      required: [true, 'Employment status is required'],
      enum: {
        values: ['active', 'inactive', 'terminated', 'on_leave'],
        message: 'Invalid employment status'
      },
      default: 'active',
      index: true
    },
    probationEndDate: { type: Date }
  },
  
  compensation: {
    baseSalary: { 
      type: Number, 
      required: [true, 'Base salary is required'],
      min: [0, 'Salary cannot be negative']
    },
    currency: { 
      type: String, 
      required: [true, 'Currency is required'],
      default: 'USD',
      uppercase: true,
      minlength: [3, 'Currency code must be 3 characters'],
      maxlength: [3, 'Currency code must be 3 characters']
    },
    payFrequency: {
      type: String,
      required: [true, 'Pay frequency is required'],
      enum: {
        values: ['weekly', 'bi_weekly', 'monthly'],
        message: 'Invalid pay frequency'
      },
      default: 'monthly'
    },
    benefits: {
      type: [String],
      default: [],
      validate: {
        validator: function(benefits: string[]) {
          return benefits.length <= 20;
        },
        message: 'Cannot have more than 20 benefits'
      }
    },
    bonusEligible: { type: Boolean, default: false }
  },
  
  skills: [{
    name: { 
      type: String, 
      required: [true, 'Skill name is required'],
      trim: true,
      maxlength: [100, 'Skill name cannot exceed 100 characters']
    },
    level: {
      type: String,
      required: [true, 'Skill level is required'],
      enum: {
        values: ['beginner', 'intermediate', 'advanced', 'expert'],
        message: 'Invalid skill level'
      }
    },
    certified: { type: Boolean, default: false },
    certificationDate: { type: Date },
    expiryDate: { type: Date }
  }],
  
  schedule: {
    workDays: {
      type: [String],
      required: [true, 'Work days are required'],
      enum: {
        values: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        message: 'Invalid work day'
      },
      validate: {
        validator: function(days: string[]) {
          return days.length >= 1 && days.length <= 7;
        },
        message: 'Must have between 1 and 7 work days'
      }
    },
    startTime: { 
      type: String, 
      required: [true, 'Start time is required'],
      validate: {
        validator: function(v: string) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Start time must be in HH:MM format'
      }
    },
    endTime: { 
      type: String, 
      required: [true, 'End time is required'],
      validate: {
        validator: function(v: string) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'End time must be in HH:MM format'
      }
    },
    timeZone: { 
      type: String, 
      required: [true, 'Time zone is required'],
      default: 'UTC',
      validate: {
        validator: function(v: string) {
          try {
            Intl.DateTimeFormat(undefined, { timeZone: v });
            return true;
          } catch (e) {
            return false;
          }
        },
        message: 'Invalid timezone'
      }
    },
    flexibleHours: { type: Boolean, default: false },
    lunchDuration: { 
      type: Number, 
      default: 60,
      min: [0, 'Lunch duration cannot be negative'],
      max: [180, 'Lunch duration cannot exceed 3 hours']
    }
  },
  
  biometric: {
    faceEncoding: { type: String },
    fingerprint: { type: String },
    retinaScan: { type: String }
  }
};

// Create Staff schema using base auditable entity pattern
const StaffSchema = createBaseAuditableEntitySchema<Staff>(staffFields, {
  collection: 'staff',
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      // Remove sensitive biometric data from JSON output
      if (ret.biometric) {
        delete ret.biometric.faceEncoding;
        delete ret.biometric.fingerprint;
        delete ret.biometric.retinaScan;
      }
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Additional indexes for performance
StaffSchema.index({ employeeId: 1 }, { unique: true });
StaffSchema.index({ 'profile.email': 1 }, { unique: true });
StaffSchema.index({ 'employment.status': 1, 'employment.department': 1 });
StaffSchema.index({ 'employment.reportingManager': 1 });
StaffSchema.index({ 'employment.startDate': -1 });
StaffSchema.index({ 'skills.name': 1 });
StaffSchema.index({ tags: 1 });
StaffSchema.index({ 'profile.firstName': 'text', 'profile.lastName': 'text' });

// Compound indexes for common queries
StaffSchema.index({ 'employment.status': 1, 'employment.department': 1, 'employment.position': 1 });
StaffSchema.index({ isActive: 1, 'employment.status': 1, 'employment.startDate': -1 });
StaffSchema.index({ 'employment.reportingManager': 1, 'employment.status': 1 });

// Auto-generate employee ID
StaffSchema.pre('save', async function(next) {
  if (this.isNew && !this.employeeId) {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await mongoose.model('Staff').countDocuments({});
    this.employeeId = `EMP-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  
  // Ensure email is lowercase
  if (this.profile?.email) {
    this.profile.email = this.profile.email.toLowerCase();
  }
  
  // Validate end time is after start time
  if (this.schedule?.startTime && this.schedule?.endTime) {
    const start = this.schedule.startTime.split(':').map(Number);
    const end = this.schedule.endTime.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    
    if (endMinutes <= startMinutes) {
      const error = new Error('End time must be after start time');
      return next(error);
    }
  }
  
  next();
});

// Virtual for full name
StaffSchema.virtual('fullName').get(function(this: Staff) {
  if (!this.profile?.firstName && !this.profile?.lastName) return '';
  return `${this.profile?.firstName || ''} ${this.profile?.lastName || ''}`.trim();
});

// Virtual for display name
StaffSchema.virtual('displayName').get(function(this: Staff) {
  return this.fullName || this.profile?.email?.split('@')[0] || this.employeeId;
});

// Virtual for age
StaffSchema.virtual('age').get(function(this: Staff) {
  if (!this.profile?.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.profile.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Method to check if staff member has skill
StaffSchema.methods.hasSkill = function(skillName: string, minLevel?: string): boolean {
  const skill = this.skills.find((s: any) => s.name.toLowerCase() === skillName.toLowerCase());
  if (!skill) return false;
  
  if (!minLevel) return true;
  
  const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
  const skillLevelIndex = levels.indexOf(skill.level);
  const minLevelIndex = levels.indexOf(minLevel);
  
  return skillLevelIndex >= minLevelIndex;
};

// Method to calculate years of service
StaffSchema.methods.getYearsOfService = function(): number {
  if (!this.employment?.startDate) return 0;
  const today = new Date();
  const startDate = new Date(this.employment.startDate);
  return Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
};

// Method to check if staff is available on given day
StaffSchema.methods.isAvailableOnDay = function(dayName: string): boolean {
  return this.schedule?.workDays?.includes(dayName.toLowerCase()) || false;
};

// Static method to find active staff
StaffSchema.statics.findActive = function() {
  return this.find({ 
    'employment.status': 'active',
    isActive: true 
  });
};

// Static method to find by department
StaffSchema.statics.findByDepartment = function(department: string) {
  return this.find({ 
    'employment.department': department,
    'employment.status': 'active',
    isActive: true 
  });
};

// Static method to find by manager
StaffSchema.statics.findByManager = function(managerId: string) {
  return this.find({ 
    'employment.reportingManager': managerId,
    'employment.status': 'active',
    isActive: true 
  });
};


// Export the model with proper typing
export const StaffModel = model<Staff>('Staff', StaffSchema);
export default StaffModel;