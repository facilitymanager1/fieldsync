import mongoose, { Schema, Document } from 'mongoose';

// User data model for authentication & security
export type UserRole = 'FieldTech' | 'Supervisor' | 'Admin' | 'Client' | 'SiteStaff';

export interface User extends Document {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
    department?: string;
    employeeId?: string;
  };
  preferences: {
    notifications: boolean;
    theme: 'light' | 'dark';
    language: string;
    timezone: string;
  };
  permissions: string[];
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Optionally link to staff or client profile
  staffId?: string;
  clientId?: string;
  // Virtual properties
  isLocked: boolean;
}

const UserSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: ['Admin', 'Supervisor', 'FieldTech', 'SiteStaff', 'Client'],
    default: 'FieldTech'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  profile: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    avatar: { type: String },
    department: { type: String },
    employeeId: { type: String, unique: true, sparse: true }
  },
  preferences: {
    notifications: { type: Boolean, default: true },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' }
  },
  permissions: [{
    type: String
  }],
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  staffId: { type: Schema.Types.ObjectId, ref: 'Staff' },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client' }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.passwordHash;
      return ret;
    }
  }
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ 'profile.employeeId': 1 });
UserSchema.index({ createdAt: -1 });

// Virtual for full name
UserSchema.virtual('profile.fullName').get(function(this: any) {
  return `${this.profile?.firstName || ''} ${this.profile?.lastName || ''}`;
});

// Check if account is locked
UserSchema.virtual('isLocked').get(function(this: any) {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

export default mongoose.model<User>('User', UserSchema);
