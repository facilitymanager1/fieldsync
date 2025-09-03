/**
 * Site Data Model with Enhanced Relationships
 * Comprehensive site management with proper entity relationships
 */

import mongoose, { Schema, model } from 'mongoose';
import { SiteDocument } from '../types/modelTypes';
import { createBaseAuditableEntitySchema } from './baseModel';

// Site Types and Enums
export enum SiteType {
  OFFICE = 'office',
  WAREHOUSE = 'warehouse',
  RETAIL = 'retail',
  INDUSTRIAL = 'industrial',
  RESIDENTIAL = 'residential',
  HEALTHCARE = 'healthcare',
  EDUCATION = 'education',
  GOVERNMENT = 'government',
  OTHER = 'other'
}

export enum SiteStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  CONSTRUCTION = 'construction',
  CLOSED = 'closed'
}

export interface SiteContact {
  id: string;
  name: string;
  title: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  isEmergency: boolean;
}

export interface SiteAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
  accessInstructions?: string;
}

export interface SiteOperatingHours {
  day: number; // 0-6 (Sunday-Saturday)
  open: string; // HH:mm format
  close: string; // HH:mm format
  isOpen: boolean;
}

export interface SiteAsset {
  id: string;
  name: string;
  type: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  installDate?: Date;
  warrantyExpiry?: Date;
  maintenanceSchedule?: string;
  lastMaintenance?: Date;
  nextMaintenance?: Date;
  status: 'operational' | 'maintenance' | 'repair' | 'decommissioned';
}

// Enhanced Site interface using proper inheritance
export interface Site extends SiteDocument {
  siteCode: string;
  name: string;
  type: 'office' | 'warehouse' | 'factory' | 'retail' | 'remote' | 'client_site';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  contact: {
    manager: string;
    phone: string;
    email: string;
  };
  client: mongoose.Types.ObjectId;
  geofence: {
    center: {
      latitude: number;
      longitude: number;
    };
    radius: number;
    strictMode: boolean;
  };
  operatingHours: {
    monday: { start: string; end: string; closed: boolean };
    tuesday: { start: string; end: string; closed: boolean };
    wednesday: { start: string; end: string; closed: boolean };
    thursday: { start: string; end: string; closed: boolean };
    friday: { start: string; end: string; closed: boolean };
    saturday: { start: string; end: string; closed: boolean };
    sunday: { start: string; end: string; closed: boolean };
  };
  facilities: Array<{
    name: string;
    type: 'parking' | 'cafeteria' | 'restroom' | 'conference_room' | 'security' | 'other';
    capacity?: number;
    status: 'operational' | 'maintenance' | 'repair' | 'decommissioned';
  }>;
  status: 'active' | 'inactive' | 'under_construction' | 'decommissioned';
  safetyProtocols: string[];
  equipment: Array<{
    id: string;
    name: string;
    type: string;
    serialNumber: string;
    purchaseDate: Date;
    warrantyExpiry?: Date;
    maintenanceSchedule: 'weekly' | 'monthly' | 'quarterly' | 'annually';
    lastMaintenance?: Date;
    nextMaintenance?: Date;
    status: 'operational' | 'maintenance' | 'repair' | 'decommissioned';
  }>;
}

// Schema Definitions
const SiteContactSchema = new Schema<SiteContact>({
  name: { type: String, required: true },
  title: { type: String },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  isPrimary: { type: Boolean, default: false },
  isEmergency: { type: Boolean, default: false }
});

const SiteAddressSchema = new Schema<SiteAddress>({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: 'US' },
  coordinates: {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 }
  },
  timezone: { type: String, required: true },
  accessInstructions: { type: String }
});

const SiteOperatingHoursSchema = new Schema<SiteOperatingHours>({
  day: { type: Number, required: true, min: 0, max: 6 },
  open: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
  close: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
  isOpen: { type: Boolean, default: true }
});

const SiteAssetSchema = new Schema<SiteAsset>({
  name: { type: String, required: true },
  type: { type: String, required: true },
  serialNumber: { type: String },
  model: { type: String },
  manufacturer: { type: String },
  installDate: { type: Date },
  warrantyExpiry: { type: Date },
  maintenanceSchedule: { type: String },
  lastMaintenance: { type: Date },
  nextMaintenance: { type: Date },
  status: {
    type: String,
    enum: ['operational', 'maintenance', 'repair', 'decommissioned'],
    default: 'operational'
  }
});

// Site-specific schema fields (excluding base entity fields)
const siteFields = {
  siteCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  description: { type: String },
  type: {
    type: String,
    enum: Object.values(SiteType),
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(SiteStatus),
    default: SiteStatus.ACTIVE,
    index: true
  },
  
  // Address and Location
  address: { type: SiteAddressSchema, required: true },
  
  // Client and Contract Information
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  contractId: { type: String, index: true },
  contractStartDate: { type: Date },
  contractEndDate: { type: Date, index: true },
  
  // Contacts
  contacts: [SiteContactSchema],
  
  // Operating Information
  operatingHours: [SiteOperatingHoursSchema],
  timezone: { type: String, required: true },
  
  // Site Assets
  assets: [SiteAssetSchema],
  
  // Service Information
  serviceTypes: [{ type: String, index: true }],
  specialRequirements: [{ type: String }],
  accessCodes: {
    gate: { type: String },
    building: { type: String },
    alarm: { type: String },
    notes: { type: String }
  },
  
  // Safety and Compliance
  safetyRequirements: [{ type: String }],
  certificationRequired: [{ type: String }],
  hazards: [{ type: String }],
  emergencyProcedures: { type: String },
  
  // Relationships
  assignedSupervisor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  assignedTechnicians: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],
  geofenceIds: [{ type: String, index: true }],
  
  // Financial
  billingAddress: SiteAddressSchema,
  billingContact: { type: String },
  serviceRate: { type: Number, min: 0 },
  currency: { type: String, default: 'USD' },
  
  // Metadata
  tags: [{ type: String, index: true }],
  customFields: { type: Schema.Types.Mixed },
  
  // Activity Tracking
  lastVisitDate: { type: Date, index: true },
  lastMaintenanceDate: { type: Date },
  nextScheduledVisit: { type: Date, index: true },
  visitFrequency: { type: String },
  
  // Enhanced site-specific fields
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
    },
    coordinates: {
      latitude: { 
        type: Number, 
        required: [true, 'Latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: { 
        type: Number, 
        required: [true, 'Longitude is required'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      }
    }
  },
  
  contact: {
    manager: { 
      type: String, 
      required: [true, 'Site manager is required'],
      trim: true,
      maxlength: [100, 'Manager name cannot exceed 100 characters']
    },
    phone: { 
      type: String, 
      required: [true, 'Contact phone is required'],
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
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please enter a valid email address'
      }
    }
  },
  
  client: { 
    type: Schema.Types.ObjectId, 
    ref: 'Client',
    required: [true, 'Client reference is required'],
    index: true
  },
  
  geofence: {
    center: {
      latitude: { 
        type: Number, 
        required: [true, 'Geofence center latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: { 
        type: Number, 
        required: [true, 'Geofence center longitude is required'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      }
    },
    radius: { 
      type: Number, 
      required: [true, 'Geofence radius is required'],
      min: [1, 'Radius must be at least 1 meter'],
      max: [10000, 'Radius cannot exceed 10,000 meters']
    },
    strictMode: { type: Boolean, default: false }
  },
  
  operatingHours: {
    monday: {
      start: { type: String, default: '09:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      end: { type: String, default: '17:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      closed: { type: Boolean, default: false }
    },
    tuesday: {
      start: { type: String, default: '09:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      end: { type: String, default: '17:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      closed: { type: Boolean, default: false }
    },
    wednesday: {
      start: { type: String, default: '09:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      end: { type: String, default: '17:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      closed: { type: Boolean, default: false }
    },
    thursday: {
      start: { type: String, default: '09:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      end: { type: String, default: '17:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      closed: { type: Boolean, default: false }
    },
    friday: {
      start: { type: String, default: '09:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      end: { type: String, default: '17:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      closed: { type: Boolean, default: false }
    },
    saturday: {
      start: { type: String, default: '09:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      end: { type: String, default: '17:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      closed: { type: Boolean, default: true }
    },
    sunday: {
      start: { type: String, default: '09:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      end: { type: String, default: '17:00', match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      closed: { type: Boolean, default: true }
    }
  },
  
  facilities: [{
    name: { 
      type: String, 
      required: [true, 'Facility name is required'],
      trim: true,
      maxlength: [100, 'Facility name cannot exceed 100 characters']
    },
    type: {
      type: String,
      required: [true, 'Facility type is required'],
      enum: {
        values: ['parking', 'cafeteria', 'restroom', 'conference_room', 'security', 'other'],
        message: 'Invalid facility type'
      }
    },
    capacity: { 
      type: Number,
      min: [0, 'Capacity cannot be negative']
    },
    status: {
      type: String,
      enum: {
        values: ['operational', 'maintenance', 'repair', 'decommissioned'],
        message: 'Invalid facility status'
      },
      default: 'operational'
    }
  }],
  
  safetyProtocols: {
    type: [String],
    default: [],
    validate: {
      validator: function(protocols: string[]) {
        return protocols.length <= 50;
      },
      message: 'Cannot have more than 50 safety protocols'
    }
  },
  
  equipment: [{
    name: { 
      type: String, 
      required: [true, 'Equipment name is required'],
      trim: true,
      maxlength: [100, 'Equipment name cannot exceed 100 characters']
    },
    type: { 
      type: String, 
      required: [true, 'Equipment type is required'],
      trim: true,
      maxlength: [50, 'Equipment type cannot exceed 50 characters']
    },
    serialNumber: { 
      type: String, 
      required: [true, 'Serial number is required'],
      trim: true,
      unique: true,
      maxlength: [100, 'Serial number cannot exceed 100 characters']
    },
    purchaseDate: { 
      type: Date, 
      required: [true, 'Purchase date is required']
    },
    warrantyExpiry: { type: Date },
    maintenanceSchedule: {
      type: String,
      enum: {
        values: ['weekly', 'monthly', 'quarterly', 'annually'],
        message: 'Invalid maintenance schedule'
      },
      default: 'monthly'
    },
    lastMaintenance: { type: Date },
    nextMaintenance: { type: Date },
    status: {
      type: String,
      enum: {
        values: ['operational', 'maintenance', 'repair', 'decommissioned'],
        message: 'Invalid equipment status'
      },
      default: 'operational'
    }
  }]
};

// Create Site schema using base auditable entity pattern
const SiteSchema = createBaseAuditableEntitySchema<Site>(siteFields, {
  collection: 'sites',
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
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
SiteSchema.index({ siteCode: 1 }, { unique: true });
SiteSchema.index({ name: 1 });
SiteSchema.index({ client: 1, status: 1 });
SiteSchema.index({ type: 1, status: 1 });
SiteSchema.index({ 'address.coordinates': '2dsphere' });
SiteSchema.index({ 'geofence.center': '2dsphere' });
SiteSchema.index({ 'contact.email': 1 });
SiteSchema.index({ tags: 1 });
SiteSchema.index({ name: 'text' });

// Compound indexes for common queries
SiteSchema.index({ client: 1, type: 1, status: 1 });
SiteSchema.index({ isActive: 1, status: 1, type: 1 });
SiteSchema.index({ 'equipment.status': 1, 'equipment.nextMaintenance': 1 });

// Auto-generate site code
SiteSchema.pre('save', async function(next) {
  if (this.isNew && !this.siteCode) {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await mongoose.model('Site').countDocuments({});
    this.siteCode = `SITE-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  
  // Validate operating hours
  if (this.operatingHours) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      const hours = (this.operatingHours as any)[day];
      if (hours && !hours.closed && hours.start && hours.end) {
        const start = hours.start.split(':').map(Number);
        const end = hours.end.split(':').map(Number);
        const startMinutes = start[0] * 60 + start[1];
        const endMinutes = end[0] * 60 + end[1];
        
        if (endMinutes <= startMinutes) {
          const error = new Error(`End time must be after start time for ${day}`);
          return next(error);
        }
      }
    }
  }
  
  // Update equipment maintenance dates
  if (this.equipment) {
    for (const item of this.equipment) {
      if (item.lastMaintenance && item.maintenanceSchedule && !item.nextMaintenance) {
        const scheduleMap = {
          'weekly': 7,
          'monthly': 30,
          'quarterly': 90,
          'annually': 365
        };
        
        const days = scheduleMap[item.maintenanceSchedule as keyof typeof scheduleMap] || 30;
        item.nextMaintenance = new Date(item.lastMaintenance.getTime() + (days * 24 * 60 * 60 * 1000));
      }
    }
  }
  
  next();
});

// Virtual for full address
SiteSchema.virtual('fullAddress').get(function(this: Site) {
  if (!this.address) return '';
  const { street, city, state, zipCode, country } = this.address;
  return `${street}, ${city}, ${state} ${zipCode}, ${country}`;
});

// Virtual for open status
SiteSchema.virtual('isCurrentlyOpen').get(function(this: Site) {
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()] as keyof typeof this.operatingHours;
  
  if (!this.operatingHours || !this.operatingHours[currentDay]) return false;
  
  const todayHours = this.operatingHours[currentDay];
  if (todayHours.closed) return false;
  
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return currentTime >= todayHours.start && currentTime <= todayHours.end;
});

// Virtual for operational equipment count
SiteSchema.virtual('operationalEquipmentCount').get(function(this: Site) {
  if (!this.equipment) return 0;
  return this.equipment.filter(item => item.status === 'operational').length;
});

// Method to check if site is within geofence
SiteSchema.methods.isWithinGeofence = function(latitude: number, longitude: number): boolean {
  if (!this.geofence) return false;
  
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = this.geofence.center.latitude * Math.PI / 180;
  const lat2Rad = latitude * Math.PI / 180;
  const deltaLatRad = (latitude - this.geofence.center.latitude) * Math.PI / 180;
  const deltaLonRad = (longitude - this.geofence.center.longitude) * Math.PI / 180;
  
  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
           Math.cos(lat1Rad) * Math.cos(lat2Rad) *
           Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance <= this.geofence.radius;
};

// Method to get equipment needing maintenance
SiteSchema.methods.getEquipmentNeedingMaintenance = function(): any[] {
  if (!this.equipment) return [];
  const now = new Date();
  return this.equipment.filter(item => 
    item.nextMaintenance && 
    item.nextMaintenance <= now && 
    item.status === 'operational'
  );
};

// Static method to find sites by client
SiteSchema.statics.findByClient = function(clientId: string) {
  return this.find({ 
    client: clientId,
    isActive: true 
  });
};

// Static method to find sites needing maintenance
SiteSchema.statics.findNeedingMaintenance = function() {
  return this.find({
    'equipment.nextMaintenance': { $lte: new Date() },
    'equipment.status': 'operational',
    isActive: true
  });
};


// Export the model with proper typing
export const SiteModel = model<Site>('Site', SiteSchema);
export default SiteModel;