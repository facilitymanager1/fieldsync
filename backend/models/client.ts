/**
 * Client Data Model with Enhanced Relationships
 * Comprehensive client management with proper entity relationships
 */

import mongoose, { Schema, model } from 'mongoose';
import { ClientDocument } from '../types/modelTypes';
import { createBaseAuditableEntitySchema } from './baseModel';

// Client Types and Enums
export enum ClientType {
  ENTERPRISE = 'enterprise',
  SMALL_BUSINESS = 'small_business',
  GOVERNMENT = 'government',
  NON_PROFIT = 'non_profit',
  INDIVIDUAL = 'individual',
  PROPERTY_MANAGEMENT = 'property_management',
  HEALTHCARE = 'healthcare',
  EDUCATION = 'education',
  RETAIL = 'retail'
}

export enum ClientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PROSPECT = 'prospect',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
  ONBOARDING = 'onboarding'
}

export enum ContractStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
  RENEWED = 'renewed'
}

export interface ClientContact {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  department?: string;
  email: string;
  phone: string;
  mobile?: string;
  isPrimary: boolean;
  isDecisionMaker: boolean;
  isBilling: boolean;
  isEmergency: boolean;
  preferredContactMethod: 'email' | 'phone' | 'mobile' | 'text';
  notes?: string;
}

export interface ClientAddress {
  id: string;
  type: 'headquarters' | 'billing' | 'mailing' | 'site';
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isPrimary: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ClientContract {
  id: string;
  contractNumber: string;
  name: string;
  type: 'service' | 'maintenance' | 'support' | 'managed_services';
  status: ContractStatus;
  startDate: Date;
  endDate: Date;
  autoRenewal: boolean;
  renewalTerms?: string;
  value: number;
  currency: string;
  paymentTerms: string;
  billingFrequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
  services: string[];
  siteIds: string[];
  termsAndConditions?: string;
  attachments: {
    filename: string;
    url: string;
    uploadDate: Date;
  }[];
}

export interface ClientBilling {
  billingAddressId: string;
  billingContactId: string;
  paymentMethod: 'credit_card' | 'ach' | 'check' | 'wire_transfer';
  creditLimit?: number;
  paymentTerms: string; // e.g., "Net 30"
  taxId?: string;
  taxExempt: boolean;
  currency: string;
  invoiceDelivery: 'email' | 'mail' | 'portal';
  autoPayEnabled: boolean;
  creditCard?: {
    lastFour: string;
    expiryMonth: number;
    expiryYear: number;
    cardType: string;
  };
  achInfo?: {
    accountType: 'checking' | 'savings';
    lastFour: string;
    bankName: string;
  };
}

export interface ClientServiceLevel {
  responseTime: number; // minutes
  resolutionTime: number; // hours
  availability: string; // e.g., "24/7", "Business Hours"
  escalationPath: string[];
  penaltyClause?: string;
  bonusClause?: string;
}

// Enhanced Client interface using proper inheritance
export interface Client extends ClientDocument {
  clientCode: string;
  companyName: string;
  legalName?: string;
  type: ClientType;
  status: ClientStatus;
  
  // Business Information
  industry: string;
  companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  yearEstablished?: number;
  website?: string;
  description?: string;
  
  // Contact Information
  contacts: ClientContact[];
  addresses: ClientAddress[];
  
  // Business Details
  businessLicense?: string;
  taxIdentifier?: string;
  dunsNumber?: string;
  naicsCode?: string;
  
  // Contracts and Agreements
  contracts: ClientContract[];
  
  // Financial Information
  billing: ClientBilling;
  creditRating?: string;
  
  // Service Information
  serviceLevel: ClientServiceLevel;
  emergencyServiceAvailable: boolean;
  
  // Relationships
  assignedAccountManager?: mongoose.Types.ObjectId;
  assignedSupportTeam: mongoose.Types.ObjectId[];
  siteIds: mongoose.Types.ObjectId[];
  parentClientId?: mongoose.Types.ObjectId;
  childClientIds: mongoose.Types.ObjectId[];
  
  // Performance Metrics
  satisfactionScore?: number;
  lastSatisfactionSurvey?: Date;
  renewalProbability?: number;
  lifetimeValue: number;
  monthlyRecurringRevenue: number;
  
  // Communication Preferences
  preferredCommunicationLanguage: string;
  reportingFrequency: 'weekly' | 'monthly' | 'quarterly' | 'on-demand';
  reportingFormat: 'email' | 'dashboard' | 'pdf' | 'excel';
  
  // Risk Assessment
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  insuranceRequired: boolean;
  
  // Compliance
  complianceRequirements: string[];
  certificationRequirements: string[];
  securityClearanceRequired: boolean;
  securityClearanceLevel?: string;
  
  // Activity Tracking
  lastActivityDate?: Date;
  lastServiceDate?: Date;
  nextReviewDate?: Date;
  accountHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'at_risk';
  
  // Integration Data
  crmId?: string;
  erpId?: string;
}

// Schema Definitions
const ClientContactSchema = new Schema<ClientContact>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  title: { type: String, required: true },
  department: { type: String },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  mobile: { type: String },
  isPrimary: { type: Boolean, default: false },
  isDecisionMaker: { type: Boolean, default: false },
  isBilling: { type: Boolean, default: false },
  isEmergency: { type: Boolean, default: false },
  preferredContactMethod: {
    type: String,
    enum: ['email', 'phone', 'mobile', 'text'],
    default: 'email'
  },
  notes: { type: String }
});

const ClientAddressSchema = new Schema<ClientAddress>({
  type: {
    type: String,
    enum: ['headquarters', 'billing', 'mailing', 'site'],
    required: true
  },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: 'US' },
  isPrimary: { type: Boolean, default: false },
  coordinates: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
  }
});

const ClientContractSchema = new Schema<ClientContract>({
  contractNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['service', 'maintenance', 'support', 'managed_services'],
    required: true
  },
  status: {
    type: String,
    enum: Object.values(ContractStatus),
    default: ContractStatus.DRAFT
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  autoRenewal: { type: Boolean, default: false },
  renewalTerms: { type: String },
  value: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },
  paymentTerms: { type: String, required: true },
  billingFrequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'annually', 'one-time'],
    default: 'monthly'
  },
  services: [{ type: String }],
  siteIds: [{ type: String }],
  termsAndConditions: { type: String },
  attachments: [{
    filename: { type: String, required: true },
    url: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now }
  }]
});

// Client-specific schema fields (excluding base entity fields)
const clientFields = {
  clientCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  legalName: { type: String, trim: true },
  type: {
    type: String,
    enum: Object.values(ClientType),
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(ClientStatus),
    default: ClientStatus.PROSPECT,
    index: true
  },
  
  // Business Information
  industry: { type: String, required: true, index: true },
  companySize: {
    type: String,
    enum: ['startup', 'small', 'medium', 'large', 'enterprise'],
    index: true
  },
  yearEstablished: { type: Number },
  website: { type: String },
  description: { type: String },
  
  // Contact Information
  contacts: [ClientContactSchema],
  addresses: [ClientAddressSchema],
  
  // Business Details
  businessLicense: { type: String },
  taxIdentifier: { type: String },
  dunsNumber: { type: String },
  naicsCode: { type: String },
  
  // Contracts
  contracts: [ClientContractSchema],
  masterServiceAgreement: {
    effectiveDate: { type: Date },
    expiryDate: { type: Date },
    documentUrl: { type: String },
    lastReviewed: { type: Date }
  },
  
  // Financial Information
  billing: {
    billingAddressId: { type: String, required: true },
    billingContactId: { type: String, required: true },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'ach', 'check', 'wire_transfer'],
      required: true
    },
    creditLimit: { type: Number, min: 0 },
    paymentTerms: { type: String, required: true },
    taxId: { type: String },
    taxExempt: { type: Boolean, default: false },
    currency: { type: String, default: 'USD' },
    invoiceDelivery: {
      type: String,
      enum: ['email', 'mail', 'portal'],
      default: 'email'
    },
    autoPayEnabled: { type: Boolean, default: false },
    creditCard: {
      lastFour: { type: String },
      expiryMonth: { type: Number, min: 1, max: 12 },
      expiryYear: { type: Number },
      cardType: { type: String }
    },
    achInfo: {
      accountType: { type: String, enum: ['checking', 'savings'] },
      lastFour: { type: String },
      bankName: { type: String }
    }
  },
  
  // Financial History
  paymentHistory: {
    onTimePayments: { type: Number, default: 0 },
    latePayments: { type: Number, default: 0 },
    averagePaymentDelay: { type: Number, default: 0 },
    lastPaymentDate: { type: Date },
    totalPaid: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 }
  },
  
  // Service Information
  serviceLevel: {
    responseTime: { type: Number, required: true }, // minutes
    resolutionTime: { type: Number, required: true }, // hours
    availability: { type: String, required: true },
    escalationPath: [{ type: String }],
    penaltyClause: { type: String },
    bonusClause: { type: String }
  },
  preferredServiceTimes: {
    start: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
    end: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
    timezone: { type: String, required: true },
    excludeHolidays: { type: Boolean, default: true },
    excludeWeekends: { type: Boolean, default: false }
  },
  emergencyServiceAvailable: { type: Boolean, default: false },
  
  // Relationships
  assignedAccountManager: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  assignedSupportTeam: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  siteIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Site',
    index: true
  }],
  parentClientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    index: true
  },
  childClientIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Client'
  }],
  
  // Performance Metrics
  satisfactionScore: { type: Number, min: 1, max: 5 },
  lastSatisfactionSurvey: { type: Date },
  renewalProbability: { type: Number, min: 0, max: 100 },
  lifetimeValue: { type: Number, default: 0 },
  monthlyRecurringRevenue: { type: Number, default: 0 },
  
  // Communication Preferences
  preferredCommunicationLanguage: { type: String, default: 'en' },
  notificationPreferences: {
    serviceUpdates: { type: Boolean, default: true },
    maintenanceAlerts: { type: Boolean, default: true },
    invoiceNotifications: { type: Boolean, default: true },
    emergencyAlerts: { type: Boolean, default: true },
    marketingCommunications: { type: Boolean, default: false }
  },
  reportingFrequency: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'on-demand'],
    default: 'monthly'
  },
  reportingFormat: {
    type: String,
    enum: ['email', 'dashboard', 'pdf', 'excel'],
    default: 'email'
  },
  
  // Risk Assessment
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low',
    index: true
  },
  riskFactors: [{ type: String }],
  insuranceRequired: { type: Boolean, default: false },
  insuranceCoverage: {
    liability: { type: Number },
    property: { type: Number },
    workers_comp: { type: Number },
    expiryDate: { type: Date }
  },
  
  // Compliance
  complianceRequirements: [{ type: String }],
  certificationRequirements: [{ type: String }],
  securityClearanceRequired: { type: Boolean, default: false },
  securityClearanceLevel: { type: String },
  
  // Metadata
  tags: [{ type: String, index: true }],
  customFields: { type: Schema.Types.Mixed },
  notes: { type: String },
  
  // Activity Tracking
  lastActivityDate: { type: Date },
  lastServiceDate: { type: Date },
  nextReviewDate: { type: Date, index: true },
  accountHealth: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor', 'at_risk'],
    default: 'good',
    index: true
  },
  
  // Integration Data
  crmId: { type: String },
  erpId: { type: String },
  externalSystemIds: [{
    system: { type: String, required: true },
    id: { type: String, required: true }
  }],
  
  // Additional client-specific fields
  paymentHistory: {
    onTimePayments: { type: Number, default: 0 },
    latePayments: { type: Number, default: 0 },
    averagePaymentDelay: { type: Number, default: 0 },
    lastPaymentDate: { type: Date },
    totalPaid: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 }
  },
  
  preferredServiceTimes: {
    start: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
    end: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
    timezone: { type: String, required: true },
    excludeHolidays: { type: Boolean, default: true },
    excludeWeekends: { type: Boolean, default: false }
  },
  
  notificationPreferences: {
    serviceUpdates: { type: Boolean, default: true },
    maintenanceAlerts: { type: Boolean, default: true },
    invoiceNotifications: { type: Boolean, default: true },
    emergencyAlerts: { type: Boolean, default: true },
    marketingCommunications: { type: Boolean, default: false }
  },
  
  insuranceCoverage: {
    liability: { type: Number },
    property: { type: Number },
    workers_comp: { type: Number },
    expiryDate: { type: Date }
  },
  
  masterServiceAgreement: {
    effectiveDate: { type: Date },
    expiryDate: { type: Date },
    documentUrl: { type: String },
    lastReviewed: { type: Date }
  },
  
  externalSystemIds: [{
    system: { type: String, required: true },
    id: { type: String, required: true }
  }]
};

// Create Client schema using base auditable entity pattern
const ClientSchema = createBaseAuditableEntitySchema<Client>(clientFields, {
  collection: 'clients',
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
ClientSchema.index({ clientCode: 1 }, { unique: true });
ClientSchema.index({ companyName: 1 });
ClientSchema.index({ status: 1, type: 1 });
ClientSchema.index({ industry: 1, companySize: 1 });
ClientSchema.index({ assignedAccountManager: 1 });
ClientSchema.index({ riskLevel: 1, accountHealth: 1 });
ClientSchema.index({ nextReviewDate: 1 });
ClientSchema.index({ 'contracts.status': 1, 'contracts.endDate': 1 });
ClientSchema.index({ 'paymentHistory.outstandingBalance': 1 });
ClientSchema.index({ tags: 1 });
ClientSchema.index({ companyName: 'text', description: 'text' });

// Compound indexes for common queries
ClientSchema.index({ status: 1, type: 1, industry: 1 });
ClientSchema.index({ isActive: 1, accountHealth: 1, nextReviewDate: 1 });
ClientSchema.index({ assignedAccountManager: 1, status: 1, accountHealth: 1 });

// Auto-generate client code
ClientSchema.pre('save', async function(next) {
  if (this.isNew && !this.clientCode) {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await mongoose.model('Client').countDocuments({});
    this.clientCode = `CL-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  
  // Update account health based on payment history
  if (this.isModified('paymentHistory')) {
    const { onTimePayments, latePayments, outstandingBalance } = this.paymentHistory;
    const totalPayments = onTimePayments + latePayments;
    
    if (totalPayments === 0) {
      this.accountHealth = 'good';
    } else {
      const onTimePercentage = (onTimePayments / totalPayments) * 100;
      
      if (outstandingBalance > 10000 || onTimePercentage < 50) {
        this.accountHealth = 'at_risk';
      } else if (outstandingBalance > 5000 || onTimePercentage < 70) {
        this.accountHealth = 'poor';
      } else if (outstandingBalance > 1000 || onTimePercentage < 85) {
        this.accountHealth = 'fair';
      } else if (onTimePercentage >= 95) {
        this.accountHealth = 'excellent';
      } else {
        this.accountHealth = 'good';
      }
    }
  }
  
  next();
});

// Method to calculate contract value
ClientSchema.methods.calculateTotalContractValue = function(): number {
  return this.contracts
    .filter((contract: ClientContract) => ['active', 'pending'].includes(contract.status))
    .reduce((total: number, contract: ClientContract) => total + contract.value, 0);
};

// Method to check if client is high value
ClientSchema.methods.isHighValueClient = function(): boolean {
  return this.lifetimeValue > 100000 || this.monthlyRecurringRevenue > 10000;
};

// Method to get payment reliability score
ClientSchema.methods.getPaymentReliabilityScore = function(): number {
  const { onTimePayments, latePayments } = this.paymentHistory;
  const totalPayments = onTimePayments + latePayments;
  
  if (totalPayments === 0) return 100;
  return Math.round((onTimePayments / totalPayments) * 100);
};

// Static method to find clients needing review
ClientSchema.statics.findNeedingReview = function() {
  return this.find({
    nextReviewDate: { $lte: new Date() },
    isActive: true
  });
};

// Static method to find by account manager
ClientSchema.statics.findByAccountManager = function(managerId: string) {
  return this.find({
    assignedAccountManager: managerId,
    isActive: true
  });
};

// Virtual for primary contact
ClientSchema.virtual('primaryContact').get(function(this: any) {
  return this.contacts.find((contact: ClientContact) => contact.isPrimary);
});

// Virtual for billing contact
ClientSchema.virtual('billingContact').get(function(this: any) {
  return this.contacts.find((contact: ClientContact) => contact.isBilling);
});

// Virtual for primary address
ClientSchema.virtual('primaryAddress').get(function(this: any) {
  return this.addresses.find((addr: ClientAddress) => addr.isPrimary);
});

// Virtual for active contracts
ClientSchema.virtual('activeContracts').get(function(this: any) {
  return this.contracts.filter((contract: ClientContract) => 
    contract.status === ContractStatus.ACTIVE
  );
});

// Export the model with proper typing
export const ClientModel = model<Client>('Client', ClientSchema);
export default ClientModel;